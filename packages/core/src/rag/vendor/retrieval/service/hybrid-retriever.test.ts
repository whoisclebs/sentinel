import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HashEmbeddingProvider } from '../embeddings/hash-provider.js';
import { DocumentRepository } from '../../persistence/documents-repository.js';
import { StateService } from '../../persistence/state-service.js';
import { USearchVectorIndex } from '../vector/usearch-index.js';
import { HybridRetriever } from './hybrid-retriever.js';

let dir: string;
let state: StateService;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sentinel-hybrid-'));
  state = StateService.open(join(dir, 'state.db'));
});

afterEach(async () => {
  state.close();
  await rm(dir, { recursive: true, force: true });
});

describe('HybridRetriever', () => {
  it('returns an empty result set when the vector index is empty', async () => {
    const documents = new DocumentRepository(state);
    const provider = new HashEmbeddingProvider(16);
    const index = new USearchVectorIndex({ dimensions: 16, file: null });
    const retriever = new HybridRetriever({ documents, provider, index });

    expect(await retriever.search('anything', { limit: 5 })).toEqual([]);
  });

  it('finds an indexed chunk by hybrid search', async () => {
    const documents = new DocumentRepository(state);
    const provider = new HashEmbeddingProvider(16);
    const index = new USearchVectorIndex({ dimensions: 16, file: null });

    const content = 'The receipts worker reads RECEIPT_BUCKET from the environment.';
    const embedding = await provider.embedDocument(content);
    const { inserted } = await documents.replaceDocument(
      {
        path: 'docs/receipts.md',
        repository: '/workspace/knowledge-base',
        application: null,
        source: 'knowledge_base',
        language: 'markdown',
        sizeBytes: content.length,
        contentHash: 'hash-1',
        gitCommit: null,
        indexGeneration: 1,
      },
      [
        {
          kind: 'section',
          symbol: 'Receipts',
          identifiers: 'receipt bucket environment',
          startLine: 1,
          endLine: 1,
          content,
          contentHash: 'chunk-hash-1',
          tokenCount: 12,
          embedding,
        },
      ],
    );
    index.add(inserted[0]!.vectorId, embedding);

    const retriever = new HybridRetriever({ documents, provider, index });
    const hits = await retriever.search('RECEIPT_BUCKET', { limit: 5 });

    expect(hits).toHaveLength(1);
    expect(hits[0]!.path).toBe('docs/receipts.md');
  });
});
