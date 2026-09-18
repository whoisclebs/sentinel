import { z } from 'zod';
import type { Finding } from './finding.js';
import type { RagSource } from './rag.js';

export const JudgementVerdictSchema = z.enum(['documented', 'missing', 'inconclusive']);
export type JudgementVerdict = z.infer<typeof JudgementVerdictSchema>;

export const JudgementConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type JudgementConfidence = z.infer<typeof JudgementConfidenceSchema>;

export const CitedEvidenceSchema = z.object({
  source: z.enum(['release_document', 'code', 'knowledge_base']),
  path: z.string(),
  startLine: z.number().int().nonnegative(),
  endLine: z.number().int().nonnegative(),
  explanation: z.string(),
});
export type CitedEvidence = z.infer<typeof CitedEvidenceSchema>;

export const DocumentationJudgementSchema = z.object({
  verdict: JudgementVerdictSchema,
  confidence: JudgementConfidenceSchema,
  rationale: z.string(),
  citedEvidence: z.array(CitedEvidenceSchema),
  requiredDocumentation: z.array(z.string()),
  suggestedReleaseDocumentText: z.string().optional(),
});
export type DocumentationJudgement = z.infer<typeof DocumentationJudgementSchema>;

export interface DeterministicEvidence {
  diff: string;
  detectorRule: string;
  repositoryPath: string;
  filePath: string;
  line?: number;
}

export interface RagHitLike {
  path: string;
  startLine: number;
  endLine: number;
  content: string;
  score: number;
  source: RagSource;
}

export interface DocumentationJudgementInput {
  finding: Finding;
  deterministicEvidence: DeterministicEvidence;
  releaseDocumentCandidates: RagHitLike[];
  relatedCodeAndKnowledge: RagHitLike[];
}
