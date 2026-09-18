import { execa } from 'execa';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GitClient } from './git-client.js';

async function initRepo(path: string): Promise<void> {
  await execa('git', ['init', '-q'], { cwd: path });
  await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: path });
  await execa('git', ['config', 'user.name', 'Test'], { cwd: path });
}

async function commit(path: string, file: string, content: string, message: string): Promise<void> {
  await writeFile(join(path, file), content);
  await execa('git', ['add', file], { cwd: path });
  await execa('git', ['commit', '-q', '-m', message], { cwd: path });
}

describe('GitClient', () => {
  let repoPath: string;
  let client: GitClient;

  beforeAll(async () => {
    repoPath = await mkdtemp(join(tmpdir(), 'sentinel-git-'));
    await initRepo(repoPath);
    await commit(repoPath, 'README.md', '# repo\n', 'initial commit');
    await execa('git', ['tag', 'v1.0.0'], { cwd: repoPath });
    await commit(repoPath, 'app.txt', 'v2\n', 'second commit');
    client = new GitClient(repoPath);
  });

  afterAll(async () => {
    await rm(repoPath, { recursive: true, force: true });
  });

  it('resolves HEAD to a commit sha', async () => {
    expect(await client.resolveHead()).toMatch(/^[0-9a-f]{40}$/);
  });

  it('lists tags', async () => {
    expect(await client.listTags()).toEqual(['v1.0.0']);
  });

  it('confirms v1.0.0 is an ancestor of HEAD', async () => {
    expect(await client.isAncestor('v1.0.0', 'HEAD')).toBe(true);
  });

  it('reports commits between base and head', async () => {
    expect(await client.logCommits('v1.0.0', 'HEAD')).toHaveLength(1);
  });

  it('produces a diff between base and head', async () => {
    expect(await client.diff('v1.0.0', 'HEAD')).toContain('app.txt');
  });
});
