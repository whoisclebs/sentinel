import { join, resolve } from 'node:path';
import type { Command } from 'commander';
import { resolveEmbeddingProvider, resolveJudgeModel, runAudit } from '@sentinel/core';
import { printIndexProgress } from '../print-index-progress.js';

interface AuditOptions {
  release: string;
  workspace: string;
  dryRun: boolean;
  markReleased: boolean;
}

const NODE_PHASE_LABELS: Record<string, string> = {
  validate_input: 'Validating input',
  discover_repositories: 'Discovering repositories',
  analyze_repositories: 'Analyzing repositories',
  load_release_documents: 'Loading release documents & indexing',
  retrieve_context: 'Retrieving context for findings',
  judge_documentation: 'Judging documentation coverage',
  render_report: 'Rendering report',
  finish: 'Finalizing',
};

export function registerAuditCommand(program: Command): void {
  program
    .command('audit')
    .description('Audit a release for undocumented operational changes')
    .requiredOption('--release <release>', 'Release identifier, e.g. R2026.12')
    .requiredOption('--workspace <path>', 'Workspace containing services/, webapps/, and release-documents/')
    .option('--dry-run', 'Always exit 0 and never write a release tag', false)
    .option('--mark-released', 'Report which repositories would receive the release tag', false)
    .action(async (options: AuditOptions) => {
      const workspacePath = resolve(options.workspace);
      const artifactsRoot = join(process.cwd(), 'artifacts');

      const state = await runAudit(
        { release: options.release, workspacePath, dryRun: options.dryRun, markReleased: options.markReleased },
        {
          embeddingProvider: resolveEmbeddingProvider(),
          judgeModel: resolveJudgeModel(),
          artifactsRoot,
          onIndexProgress: printIndexProgress,
        },
        (nodeName) => {
          const label = NODE_PHASE_LABELS[nodeName] ?? nodeName;
          console.log(`[sentinel] ${label} — done`);
        },
      );

      console.log(`Repositories analyzed: ${state.analyses.length}`);
      console.log(`Repositories with new commits: ${state.analyses.filter((a) => a.base.hasNewCommits).length}`);
      console.log(`Findings: ${state.auditedFindings.length}`);
      console.log(`Report written to ${state.reportPaths?.markdownPath}`);

      if (options.markReleased) {
        for (const mark of state.releaseMarks) {
          console.log(`${mark.application}: ${mark.wouldTag ? 'WOULD TAG' : 'skip'} — ${mark.reason}`);
        }
      }

      process.exitCode = state.exitCode;
    });
}
