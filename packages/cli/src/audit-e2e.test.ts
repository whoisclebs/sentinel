import { execa } from 'execa';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Relative import to the BUILT file — @sentinel/core's package.json `exports`
// map only exposes its main entry point, so a bare-specifier subpath import
// like `@sentinel/core/dist/...` would be blocked by Node's resolver. A
// relative filesystem path bypasses `exports` entirely and is the correct
// way for this package-external test to reach a dist-only helper.
import { buildFixtureWorkspace } from '../../core/dist/test-support/build-fixture-workspace.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const workspace = join(repoRoot, '.tmp-e2e-workspace');
const artifactsRoot = join(repoRoot, '.tmp-e2e-artifacts');
const cliBin = join(repoRoot, 'packages', 'cli', 'dist', 'bin.js');

beforeAll(async () => {
  await rm(workspace, { recursive: true, force: true });
  await rm(artifactsRoot, { recursive: true, force: true });
  await mkdir(artifactsRoot, { recursive: true });
  await buildFixtureWorkspace(workspace);
}, 60000);

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true });
  await rm(artifactsRoot, { recursive: true, force: true });
});

describe('sentinel audit (built CLI, real process)', () => {
  it('discovers repositories, detects findings, and writes a report without touching a real LLM provider', async () => {
    const result = await execa(
      'node',
      [cliBin, 'audit', '--release', 'R2026.12', '--workspace', workspace, '--dry-run'],
      {
        cwd: artifactsRoot,
        env: { ...process.env, SENTINEL_EMBEDDINGS: 'hash', ANTHROPIC_API_KEY: 'sk-ant-invalid-for-e2e-test' },
        reject: false,
      },
    );

    expect(result.exitCode).toBe(0);

    const reportJson = JSON.parse(await readFile(join(artifactsRoot, 'artifacts', 'R2026.12', 'report.json'), 'utf8'));

    const applications = reportJson.repositoriesWithNewCommits as string[];
    expect(applications).toEqual(expect.arrayContaining(['payment-api', 'admin-web', 'legacy-billing']));
    expect(applications).not.toContain('transaction-api');

    const legacyBilling = reportJson.repositoriesAnalyzed.find((r: { application: string }) => r.application === 'legacy-billing');
    expect(legacyBilling.base.baseRef).toBe('v1.0.0');

    expect(reportJson.findings.length).toBeGreaterThan(0);
    expect(reportJson.findings.every((f: { judgement: { verdict: string } }) => f.judgement.verdict === 'inconclusive')).toBe(
      true,
    );

    const reportMarkdown = await readFile(join(artifactsRoot, 'artifacts', 'R2026.12', 'report.md'), 'utf8');
    expect(reportMarkdown).toContain('# SENTINEL — R2026.12 Audit');
    expect(reportMarkdown).toContain('RECEIPT_BUCKET');
  }, 120000);
});
