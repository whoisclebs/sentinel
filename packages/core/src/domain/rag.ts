export type RagSource = 'code' | 'release_document' | 'knowledge_base';

export interface RagDocumentMetadata {
  repository: string;
  application?: string;
  source: RagSource;
  path: string;
  startLine: number;
  endLine: number;
  gitCommit?: string;
  indexedAt: string;
}

export interface RagHit {
  path: string;
  startLine: number;
  endLine: number;
  symbol: string | null;
  score: number;
  content: string;
  metadata: RagDocumentMetadata;
}
