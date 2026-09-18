import type { Finding } from './finding.js';
import type { DocumentationJudgement, RagHitLike } from './judgement.js';
import type { ReleaseBaseResult } from './repository.js';

export interface AuditedFinding {
  finding: Finding;
  base: ReleaseBaseResult;
  judgement: DocumentationJudgement;
  retrievedContext: RagHitLike[];
}

export interface RepositorySummary {
  application: string;
  repositoryPath: string;
  base: ReleaseBaseResult;
  findingCount: number;
}

export interface AuditReport {
  release: string;
  generatedAt: string;
  repositoriesAnalyzed: RepositorySummary[];
  repositoriesWithNewCommits: string[];
  findings: AuditedFinding[];
  releaseDocumentIssues: string[];
}
