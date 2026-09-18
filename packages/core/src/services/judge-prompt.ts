import type { DocumentationJudgementInput, RagHitLike } from '../domain/judgement.js';

export const JUDGE_SYSTEM_PROMPT = `You are SENTINEL's documentation-coverage judge for a software release audit.

You receive one detected operational change (a "finding") together with a
bounded package of evidence: the diff excerpt and detector rule that produced
the finding, candidate excerpts from the release documents (found by a
deterministic text search), and related code/knowledge-base excerpts (found
by hybrid retrieval). You do not have access to the full repository, you
cannot run tools, and you must never invent evidence beyond what is given.

Rules:
- Return "documented" only when the provided release-document excerpts
  sufficiently describe the action, resource, configuration, or impact this
  finding requires. A valid description may name the change by its purpose
  or effect rather than repeating the exact identifier from the code.
- A vague mention such as "configuration adjustments" does NOT cover a new
  variable, migration, or new resource without further concrete detail.
- Code and knowledge-base excerpts provide context for why a change might
  matter operationally, but they never substitute for the release document
  itself — a finding can never be "documented" based on code/KB excerpts
  alone.
- When the excerpts are insufficient or contradictory, return "inconclusive".
- "missing" requires explaining, in requiredDocumentation, exactly what
  operational information is absent.
- Every citedEvidence entry must reference one of the excerpts you were
  given, by its exact path and line range. If you cannot cite a specific
  excerpt that supports your verdict, return "inconclusive" instead.
- suggestedReleaseDocumentText, when present, must be short, factual, and
  clearly a suggestion for someone to review — never phrase it as if the
  documentation already exists.

Respond with exactly one JSON object and nothing else: no markdown code
fences, no prose before or after it.`;

function formatHits(hits: RagHitLike[]): string {
  if (hits.length === 0) return '(none provided)';
  return hits
    .map(
      (h) =>
        `- [${h.source}] ${h.path}:${h.startLine}-${h.endLine} (score ${h.score.toFixed(2)})\n  ${h.content
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 300)}`,
    )
    .join('\n');
}

export function buildJudgePrompt(input: DocumentationJudgementInput): string {
  const { finding, deterministicEvidence } = input;
  return [
    '## Finding',
    JSON.stringify(finding, null, 2),
    '',
    '## Deterministic evidence (from the diff)',
    `Detector rule: ${deterministicEvidence.detectorRule}`,
    `File: ${deterministicEvidence.filePath}${deterministicEvidence.line ? `:${deterministicEvidence.line}` : ''}`,
    '```diff',
    deterministicEvidence.diff,
    '```',
    '',
    '## Release document candidates (deterministic search)',
    formatHits(input.releaseDocumentCandidates),
    '',
    '## Related code and knowledge base (hybrid RAG)',
    formatHits(input.relatedCodeAndKnowledge),
    '',
    '## Output format',
    'Return ONLY a JSON object with this exact shape:',
    '{"verdict": "documented" | "missing" | "inconclusive", "confidence": "high" | "medium" | "low", "rationale": string, "citedEvidence": [{"source": "release_document" | "code" | "knowledge_base", "path": string, "startLine": number, "endLine": number, "explanation": string}], "requiredDocumentation": string[], "suggestedReleaseDocumentText"?: string}',
  ].join('\n');
}
