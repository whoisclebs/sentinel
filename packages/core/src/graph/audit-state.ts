import { Annotation } from '@langchain/langgraph';
import type { DocumentationJudgementInput } from '../domain/judgement.js';
import type { Finding } from '../domain/finding.js';
import type { ReleaseDocumentBundle } from '../domain/release-document.js';
import type { AuditedFinding } from '../domain/report.js';
import type { ReleaseBaseResult, RepositoryAnalysis, RepositoryDescriptor } from '../domain/repository.js';
import type { ReleaseDocumentIssue } from '../infrastructure/release-document-reader.js';
import type { ReleaseMarkResult } from '../services/release-marker.js';

export interface PendingJudgement {
  finding: Finding;
  base: ReleaseBaseResult;
  input: DocumentationJudgementInput;
}

const replace = <T>(_current: T, update: T): T => update;

export const AuditStateAnnotation = Annotation.Root({
  release: Annotation<string>,
  workspacePath: Annotation<string>,
  dryRun: Annotation<boolean>,
  markReleased: Annotation<boolean>,
  repositories: Annotation<RepositoryDescriptor[]>({ default: () => [], reducer: replace }),
  analyses: Annotation<RepositoryAnalysis[]>({ default: () => [], reducer: replace }),
  releaseDocuments: Annotation<ReleaseDocumentBundle | null>({ default: () => null, reducer: replace }),
  releaseDocumentIssues: Annotation<ReleaseDocumentIssue[]>({ default: () => [], reducer: replace }),
  pendingJudgements: Annotation<PendingJudgement[]>({ default: () => [], reducer: replace }),
  auditedFindings: Annotation<AuditedFinding[]>({ default: () => [], reducer: replace }),
  releaseMarks: Annotation<ReleaseMarkResult[]>({ default: () => [], reducer: replace }),
  reportPaths: Annotation<{ jsonPath: string; markdownPath: string } | null>({ default: () => null, reducer: replace }),
  exitCode: Annotation<number>({ default: () => 0, reducer: replace }),
});

export type AuditState = typeof AuditStateAnnotation.State;
