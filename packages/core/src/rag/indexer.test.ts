import { execa } from 'execa';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DocumentRepository } from './vendor/persistence/documents-repository.js';
import { StateService } from './vendor/persistence/state-service.js';
import { HashEmbeddingProvider } from './vendor/retrieval/embeddings/hash-provider.js';
import { Indexer } from './indexer.js';

let workspace: string;

afterEach(async () => {
  if (workspace) await rm(workspace, { recursive: true, force: true });
});

describe('Indexer', () => {
  it('indexes code, release documents, and the knowledge base with correct metadata tags', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'sentinel-indexer-'));

    const paymentApi = join(workspace, 'services', 'payment-api');
    await mkdir(paymentApi, { recursive: true });
    await execa('git', ['init', '-q'], { cwd: paymentApi });
    await writeFile(join(paymentApi, 'application.yml'), 'RECEIPT_BUCKET: receipts-bucket\n');

    const releaseDir = join(workspace, 'release-documents', 'R2026.12');
    await mkdir(join(releaseDir, 'scripts', 'payment-api'), { recursive: true });
    await writeFile(join(releaseDir, 'instructions.md'), 'Run scripts/payment-api/001-migrate.sql.\n');
    await writeFile(join(releaseDir, 'scripts', 'payment-api', '001-migrate.sql'), 'ALTER TABLE receipts ADD status TEXT;');

    await mkdir(join(workspace, 'knowledge-base'), { recursive: true });
    await writeFile(join(workspace, 'knowledge-base', 'receipts.md'), '# Receipts\nThe receipts worker uses an S3 bucket.\n');

    const indexer = new Indexer(workspace, new HashEmbeddingProvider());
    const report = await indexer.run('R2026.12');

    expect(report.filesIndexed).toBeGreaterThanOrEqual(3);
    expect(report.chunksIndexed).toBeGreaterThan(0);

    const state = StateService.open(join(workspace, '.sentinel', 'state.db'));
    const documents = new DocumentRepository(state);
    const hits = documents.searchLexical('RECEIPT_BUCKET', 10);
    const chunks = documents.chunksByVectorIds(hits.map((h) => h.vectorId));
    state.close();

    expect(chunks.some((c) => c.source === 'code' && c.application === 'payment-api')).toBe(true);
  });
});
