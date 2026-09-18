import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Indexer } from './indexer.js';
import { Retriever } from './retriever.js';
import { HashEmbeddingProvider } from './vendor/retrieval/embeddings/hash-provider.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { execa } from 'execa';

let workspace: string;

afterEach(async () => {
  if (workspace) await rm(workspace, { recursive: true, force: true });
});

describe('Retriever', () => {
  it('filters results by application and by source', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'sentinel-retriever-'));

    const paymentApi = join(workspace, 'services', 'payment-api');
    const adminWeb = join(workspace, 'webapps', 'admin-web');
    await mkdir(paymentApi, { recursive: true });
    await mkdir(adminWeb, { recursive: true });
    await execa('git', ['init', '-q'], { cwd: paymentApi });
    await execa('git', ['init', '-q'], { cwd: adminWeb });
    await writeFile(join(paymentApi, 'notes.md'), '# Payment API\nUses RECEIPT_BUCKET for storage.\n');
    await writeFile(join(adminWeb, 'notes.md'), '# Admin Web\nUses RECEIPT_BUCKET as a display label only.\n');

    const provider = new HashEmbeddingProvider();
    await new Indexer(workspace, provider).run(null);

    const retriever = new Retriever(workspace, provider);
    const paymentOnly = await retriever.search('RECEIPT_BUCKET', 10, { application: 'payment-api', source: 'code' });
    retriever.close();

    expect(paymentOnly.length).toBeGreaterThan(0);
    expect(paymentOnly.every((h) => h.metadata.application === 'payment-api')).toBe(true);
  });
});
