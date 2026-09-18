import { FakeListChatModel } from '@langchain/core/utils/testing';
import { execa } from 'execa';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { HashEmbeddingProvider } from '../rag/vendor/retrieval/embeddings/hash-provider.js';
import { runAudit } from './audit-graph.js';

let workspace: string;
let artifactsRoot: string;

afterEach(async () => {
  if (workspace) await rm(workspace, { recursive: true, force: true });
  if (artifactsRoot) await rm(artifactsRoot, { recursive: true, force: true });
});

describe('runAudit', () => {
  it('runs the full graph end to end and reports an undocumented environment variable as missing', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'sentinel-graph-'));
    artifactsRoot = await mkdtemp(join(tmpdir(), 'sentinel-graph-artifacts-'));

    const paymentApi = join(workspace, 'services', 'payment-api');
    await mkdir(paymentApi, { recursive: true });
    await execa('git', ['init', '-q'], { cwd: paymentApi });
    await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: paymentApi });
    await execa('git', ['config', 'user.name', 'Test'], { cwd: paymentApi });
    await writeFile(join(paymentApi, 'application.yml'), 'existing: true\n');
    await execa('git', ['add', '.'], { cwd: paymentApi });
    await execa('git', ['commit', '-q', '-m', 'initial'], { cwd: paymentApi });
    await execa('git', ['tag', 'v1.0.0'], { cwd: paymentApi });
    await writeFile(join(paymentApi, 'application.yml'), 'existing: true\nRECEIPT_BUCKET: bucket\n');
    await execa('git', ['add', '.'], { cwd: paymentApi });
    await execa('git', ['commit', '-q', '-m', 'add env var'], { cwd: paymentApi });

    const releaseDir = join(workspace, 'release-documents', 'R2026.12');
    await mkdir(releaseDir, { recursive: true });
    await writeFile(join(releaseDir, 'env-vars.md'), '# Env vars\nNo new variables in this release.\n');
    await writeFile(join(releaseDir, 'instructions.md'), 'No special instructions.\n');

    const judgeModel = new FakeListChatModel({
      responses: [
        JSON.stringify({
          verdict: 'missing',
          confidence: 'high',
          rationale: 'env-vars.md does not mention RECEIPT_BUCKET.',
          citedEvidence: [],
          requiredDocumentation: ['Document RECEIPT_BUCKET.'],
        }),
      ],
    });

    const state = await runAudit(
      { release: 'R2026.12', workspacePath: workspace, dryRun: true, markReleased: false },
      { embeddingProvider: new HashEmbeddingProvider(), judgeModel, artifactsRoot },
    );

    expect(state.exitCode).toBe(0);
    expect(state.auditedFindings.some((f) => f.finding.subject === 'RECEIPT_BUCKET' && f.judgement.verdict === 'missing')).toBe(
      true,
    );
    expect(state.reportPaths?.jsonPath).toBeTruthy();
  });
});
