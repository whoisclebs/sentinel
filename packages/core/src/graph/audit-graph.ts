import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { END, START, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import type { Finding } from '../domain/finding.js';
import type { AuditReport } from '../domain/report.js';
import { toRagHitLike } from '../rag/context-formatter.js';
import { Indexer } from '../rag/indexer.js';
import { buildRagQuery } from '../rag/query-builder.js';
import { Retriever } from '../rag/retriever.js';
import type { EmbeddingProvider } from '../rag/vendor/retrieval/embeddings/provider.js';
import { readReleaseDocuments } from '../infrastructure/release-document-reader.js';
import { redactConfigValues } from '../infrastructure/redact-config-values.js';
import { writeReport } from '../infrastructure/report-writer.js';
import { RepositoryDiscovery } from '../infrastructure/repository-discovery.js';
import { DocumentationJudge } from '../services/documentation-judge.js';
import { findDeterministicCandidates } from '../services/documentation-verifier.js';
import { DryRunReleaseMarker } from '../services/release-marker.js';
import { analyzeRepositories } from '../services/repository-analyzer.js';
import { AuditStateAnnotation, type AuditState, type PendingJudgement } from './audit-state.js';

export const AuditInputSchema = z.object({
  release: z.string().min(1),
  workspacePath: z.string().min(1),
  dryRun: z.boolean(),
  markReleased: z.boolean(),
});
export type AuditInput = z.infer<typeof AuditInputSchema>;

export interface AuditGraphDeps {
  embeddingProvider: EmbeddingProvider;
  judgeModel: BaseChatModel;
  artifactsRoot: string;
  onIndexProgress?: (event: { root: string; index: number; total: number; relPath: string }) => void;
}

function buildDiffExcerpt(analysis: AuditState['analyses'][number], finding: Finding): string {
  const file = analysis.diffFiles.find((f) => f.path === finding.filePath);
  if (!file) return finding.evidence;
  const excerpt = file.hunks
    .flatMap((hunk) =>
      hunk.lines.map((line) => `${line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}${line.content}`),
    )
    .join('\n');
  return redactConfigValues(excerpt);
}

async function validateInputNode(state: AuditState): Promise<Partial<AuditState>> {
  AuditInputSchema.parse({
    release: state.release,
    workspacePath: state.workspacePath,
    dryRun: state.dryRun,
    markReleased: state.markReleased,
  });
  const releaseDir = join(state.workspacePath, 'release-documents', state.release);
  if (!existsSync(releaseDir)) {
    throw new Error(`release-documents/${state.release} does not exist under ${state.workspacePath}`);
  }
  return {};
}

async function discoverRepositoriesNode(state: AuditState): Promise<Partial<AuditState>> {
  return { repositories: await new RepositoryDiscovery(state.workspacePath).discover() };
}

async function analyzeRepositoriesNode(state: AuditState): Promise<Partial<AuditState>> {
  return { analyses: await analyzeRepositories(state.repositories) };
}

function loadReleaseDocumentsNode(deps: AuditGraphDeps) {
  return async (state: AuditState): Promise<Partial<AuditState>> => {
    const { bundle, issues } = await readReleaseDocuments(join(state.workspacePath, 'release-documents'), state.release);
    await new Indexer(state.workspacePath, deps.embeddingProvider).run(state.release, deps.onIndexProgress);
    return { releaseDocuments: bundle, releaseDocumentIssues: issues };
  };
}

function retrieveContextNode(deps: AuditGraphDeps) {
  return async (state: AuditState): Promise<Partial<AuditState>> => {
    const retriever = new Retriever(state.workspacePath, deps.embeddingProvider);
    const pendingJudgements: PendingJudgement[] = [];

    for (const analysis of state.analyses) {
      for (const finding of analysis.findings) {
        const releaseDocumentCandidates = state.releaseDocuments
          ? findDeterministicCandidates(finding, state.releaseDocuments)
          : [];
        const query = buildRagQuery(finding);
        const codeHits = await retriever.search(query, 5, { source: 'code', application: finding.application });
        const knowledgeHits = await retriever.search(query, 5, { source: 'knowledge_base' });

        pendingJudgements.push({
          finding,
          base: analysis.base,
          input: {
            finding,
            deterministicEvidence: {
              diff: buildDiffExcerpt(analysis, finding),
              detectorRule: `${finding.category}-detector`,
              repositoryPath: finding.repositoryPath,
              filePath: finding.filePath,
              line: finding.line,
            },
            releaseDocumentCandidates,
            relatedCodeAndKnowledge: [...toRagHitLike(codeHits), ...toRagHitLike(knowledgeHits)],
          },
        });
      }
    }

    retriever.close();
    return { pendingJudgements };
  };
}

function judgeDocumentationNode(deps: AuditGraphDeps) {
  return async (state: AuditState): Promise<Partial<AuditState>> => {
    const judge = new DocumentationJudge(deps.judgeModel);
    const auditedFindings: AuditState['auditedFindings'] = [];
    for (const pending of state.pendingJudgements) {
      const judgement = await judge.judge(pending.input);
      auditedFindings.push({
        finding: pending.finding,
        base: pending.base,
        judgement,
        retrievedContext: pending.input.relatedCodeAndKnowledge,
      });
    }
    return { auditedFindings };
  };
}

function renderReportNode(deps: AuditGraphDeps) {
  return async (state: AuditState): Promise<Partial<AuditState>> => {
    const report: AuditReport = {
      release: state.release,
      generatedAt: new Date().toISOString(),
      repositoriesAnalyzed: state.analyses.map((a) => ({
        application: a.repository.application,
        repositoryPath: a.repository.repositoryPath,
        base: a.base,
        findingCount: a.findings.length,
      })),
      repositoriesWithNewCommits: state.analyses.filter((a) => a.base.hasNewCommits).map((a) => a.repository.application),
      findings: state.auditedFindings,
      releaseDocumentIssues: state.releaseDocumentIssues.map((i) => i.message),
    };
    const reportPaths = await writeReport(deps.artifactsRoot, report);

    let releaseMarks: AuditState['releaseMarks'] = [];
    if (state.markReleased) {
      const hasBlockingPendingItems =
        state.auditedFindings.some((f) => f.judgement.verdict === 'missing') ||
        state.releaseDocumentIssues.some((i) => i.severity === 'blocking');
      releaseMarks = await new DryRunReleaseMarker().mark(state.release, state.analyses, hasBlockingPendingItems);
    }
    return { reportPaths, releaseMarks };
  };
}

function finishNode(state: AuditState): Partial<AuditState> {
  const hasMissing = state.auditedFindings.some((f) => f.judgement.verdict === 'missing');
  return { exitCode: state.dryRun ? 0 : hasMissing ? 1 : 0 };
}

export function buildAuditGraph(deps: AuditGraphDeps) {
  const graph = new StateGraph(AuditStateAnnotation)
    .addNode('validate_input', validateInputNode)
    .addNode('discover_repositories', discoverRepositoriesNode)
    .addNode('analyze_repositories', analyzeRepositoriesNode)
    .addNode('load_release_documents', loadReleaseDocumentsNode(deps))
    .addNode('retrieve_context', retrieveContextNode(deps))
    .addNode('judge_documentation', judgeDocumentationNode(deps))
    .addNode('render_report', renderReportNode(deps))
    .addNode('finish', finishNode)
    .addEdge(START, 'validate_input')
    .addEdge('validate_input', 'discover_repositories')
    .addEdge('discover_repositories', 'analyze_repositories')
    .addEdge('analyze_repositories', 'load_release_documents')
    .addEdge('load_release_documents', 'retrieve_context')
    .addEdge('retrieve_context', 'judge_documentation')
    .addEdge('judge_documentation', 'render_report')
    .addEdge('render_report', 'finish')
    .addEdge('finish', END);
  return graph.compile();
}

export async function runAudit(
  input: AuditInput,
  deps: AuditGraphDeps,
  onNodeComplete?: (nodeName: string) => void,
): Promise<AuditState> {
  const app = buildAuditGraph(deps);

  // Seed the accumulator with the same defaults AuditStateAnnotation declares for each
  // field (see audit-state.ts). Every reducer in that annotation is `replace`, so merging
  // per-node partial updates onto this accumulator via Object.assign is equivalent to what
  // the graph's own reducers would produce — no need to reimplement reducer logic here.
  const accumulator: AuditState = {
    release: input.release,
    workspacePath: input.workspacePath,
    dryRun: input.dryRun,
    markReleased: input.markReleased,
    repositories: [],
    analyses: [],
    releaseDocuments: null,
    releaseDocumentIssues: [],
    pendingJudgements: [],
    auditedFindings: [],
    releaseMarks: [],
    reportPaths: null,
    exitCode: 0,
  };

  const stream = await app.stream(
    {
      release: input.release,
      workspacePath: input.workspacePath,
      dryRun: input.dryRun,
      markReleased: input.markReleased,
    },
    { streamMode: 'updates' },
  );

  for await (const chunk of stream) {
    // In "updates" streaming mode (single mode, no subgraph streaming), each chunk is an
    // object with exactly one key: the name of the node that just completed, mapping to the
    // partial state that node returned (verified against @langchain/langgraph 0.2.74's
    // Pregel#stream / mapOutputUpdates implementation).
    const update = chunk as Record<string, Partial<AuditState>>;
    for (const [nodeName, partial] of Object.entries(update)) {
      Object.assign(accumulator, partial);
      onNodeComplete?.(nodeName);
    }
  }

  return accumulator;
}
