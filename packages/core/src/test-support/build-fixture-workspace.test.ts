import { execa } from 'execa';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildFixtureWorkspace } from './build-fixture-workspace.js';

let workspace: string;

afterEach(async () => {
  if (workspace) await rm(workspace, { recursive: true, force: true });
});

describe('buildFixtureWorkspace', () => {
  it('builds all four fixture repositories and the release document bundle', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'sentinel-fixture-build-'));
    await buildFixtureWorkspace(workspace);

    for (const repo of ['services/payment-api', 'webapps/admin-web', 'services/transaction-api', 'services/legacy-billing']) {
      const { stdout } = await execa('git', ['rev-parse', '--is-inside-work-tree'], { cwd: join(workspace, repo) });
      expect(stdout.trim()).toBe('true');
    }

    const legacyBillingBranch = await execa('git', ['branch', '--show-current'], {
      cwd: join(workspace, 'services', 'legacy-billing'),
    });
    expect(legacyBillingBranch.stdout.trim()).toBe('patch/1.0');
  });
});
