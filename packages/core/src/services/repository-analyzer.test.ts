import { execa } from 'execa';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeRepositories } from './repository-analyzer.js';

async function initRepo(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  await execa('git', ['init', '-q'], { cwd: path });
  await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: path });
  await execa('git', ['config', 'user.name', 'Test'], { cwd: path });
}

async function commit(path: string, file: string, content: string, message: string): Promise<void> {
  await writeFile(join(path, file), content);
  await execa('git', ['add', file], { cwd: path });
  await execa('git', ['commit', '-q', '-m', message], { cwd: path });
}

let workspace: string;

afterEach(async () => {
  if (workspace) await rm(workspace, { recursive: true, force: true });
});

describe('analyzeRepositories', () => {
  it('runs detectors only on repositories with new commits since their base tag', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'sentinel-analyzer-'));
    const paymentApi = join(workspace, 'payment-api');
    const transactionApi = join(workspace, 'transaction-api');
    await Promise.all([initRepo(paymentApi), initRepo(transactionApi)]);

    await commit(paymentApi, 'application.yml', 'existing: true\n', 'initial');
    await execa('git', ['tag', 'v1.0.0'], { cwd: paymentApi });
    await commit(paymentApi, 'application.yml', 'existing: true\nRECEIPT_BUCKET: bucket\n', 'add env var');

    await commit(transactionApi, 'application.yml', 'existing: true\n', 'initial');
    await execa('git', ['tag', 'v1.0.0'], { cwd: transactionApi });

    const results = await analyzeRepositories([
      { application: 'payment-api', repositoryPath: paymentApi, isSubmodule: false },
      { application: 'transaction-api', repositoryPath: transactionApi, isSubmodule: false },
    ]);

    const payment = results.find((r) => r.repository.application === 'payment-api')!;
    const transaction = results.find((r) => r.repository.application === 'transaction-api')!;

    expect(payment.base.hasNewCommits).toBe(true);
    expect(payment.findings.some((f) => f.category === 'environment' && f.subject === 'RECEIPT_BUCKET')).toBe(true);
    expect(transaction.base.hasNewCommits).toBe(false);
    expect(transaction.findings).toHaveLength(0);
  });
});
