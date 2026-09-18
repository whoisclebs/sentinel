import { execa } from 'execa';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RepositoryDiscovery } from './repository-discovery.js';

let workspace: string;

afterEach(async () => {
  if (workspace) await rm(workspace, { recursive: true, force: true });
});

describe('RepositoryDiscovery', () => {
  it('finds git repositories recursively under services/ and webapps/, skipping non-repo directories', async () => {
    workspace = await mkdtemp(join(tmpdir(), 'sentinel-discovery-'));

    const paymentApi = join(workspace, 'services', 'payment-api');
    const deepApp = join(workspace, 'services', 'group', 'deep-app');
    const adminWeb = join(workspace, 'webapps', 'admin-web');
    const notARepo = join(workspace, 'services', 'not-a-repo');

    await mkdir(paymentApi, { recursive: true });
    await mkdir(deepApp, { recursive: true });
    await mkdir(adminWeb, { recursive: true });
    await mkdir(notARepo, { recursive: true });

    for (const dir of [paymentApi, deepApp, adminWeb]) {
      await execa('git', ['init', '-q'], { cwd: dir });
    }

    const discovery = new RepositoryDiscovery(workspace);
    const found = await discovery.discover();
    const applications = found.map((d) => d.application).sort();

    expect(applications).toEqual(['admin-web', 'deep-app', 'payment-api']);
    expect(found.every((d) => d.isSubmodule === false)).toBe(true);
  });
});
