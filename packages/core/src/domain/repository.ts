import { z } from 'zod';
import type { Finding } from './finding.js';

export interface RepositoryDescriptor {
  application: string;
  repositoryPath: string;
  isSubmodule: boolean;
}

export const ReleaseBaseKindSchema = z.enum(['tag', 'first_release']);
export type ReleaseBaseKind = z.infer<typeof ReleaseBaseKindSchema>;

export interface ReleaseBaseResult {
  kind: ReleaseBaseKind;
  baseRef: string;
  baseCommit: string;
  headCommit: string;
  hasNewCommits: boolean;
}

export interface DiffLine {
  type: 'added' | 'removed' | 'context';
  content: string;
  newLineNumber: number | null;
}

export interface DiffHunk {
  startLine: number;
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  hunks: DiffHunk[];
}

export interface RepositoryAnalysis {
  repository: RepositoryDescriptor;
  base: ReleaseBaseResult;
  diffFiles: DiffFile[];
  findings: Finding[];
}
