import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocumentRepository } from './documents-repository.js';
import { StateService } from './state-service.js';

let dir: string;
let state: StateService;
let documents: DocumentRepository;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sentinel-db-'));
  state = StateService.open(join(dir, 'state.db'));
  documents = new DocumentRepository(state);
});

afterEach(async () => {
  state.close();
  await rm(dir, { recursive: true, force: true });
});

describe('DocumentRepository', () => {
  it('stores a document with its chunks and finds it via FTS lexical search', async () => {
    await documents.replaceDocument(
      {
        path: 'release-documents/R2026.12/instructions.md',
        repository: '/workspace/release-documents',
        application: null,
        source: 'release_document',
        language: 'markdown',
        sizeBytes: 42,
        contentHash: 'hash-1',
        gitCommit: null,
        indexGeneration: 1,
      },
      [
        {
          kind: 'section',
          symbol: 'Migrations',
          identifiers: 'receipt status migration',
          startLine: 1,
          endLine: 3,
          content: 'Run the receipt status migration for payment-api before deploying.',
          contentHash: 'chunk-hash-1',
          tokenCount: 10,
          embedding: new Float32Array([0.1, 0.2, 0.3]),
        },
      ],
    );

    const hits = documents.searchLexical('receipt migration', 10);
    expect(hits).toHaveLength(1);

    const chunks = documents.chunksByVectorIds(hits.map((h) => h.vectorId));
    expect(chunks[0]).toMatchObject({
      application: null,
      source: 'release_document',
      symbol: 'Migrations',
    });

    const embeddings = documents.embeddingsByVectorIds(hits.map((h) => h.vectorId));
    expect(embeddings.get(hits[0]!.vectorId)).toEqual(new Float32Array([0.1, 0.2, 0.3]));
    expect(documents.counts()).toEqual({ documents: 1, chunks: 1 });
  });
});
