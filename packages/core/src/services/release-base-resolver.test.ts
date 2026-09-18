import { execa } from 'execa';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GitClient } from '../infrastructure/git-client.js';
import { ReleaseBaseResolver } from './release-base-resolver.js';
import { SemverTagMatcher } from './semver-tag-matcher.js';

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

async function tag(path: string, name: string): Promise<void> {
  await execa('git', ['tag', name], { cwd: path });
}

let repoPath: string;

afterEach(async () => {
  if (repoPath) await rm(repoPath, { recursive: true, force: true });
});

describe('ReleaseBaseResolver', () => {
  it('picks the highest ancestral SemVer tag and reports new commits', async () => {
    repoPath = await mkdtemp(join(tmpdir(), 'sentinel-base-'));
    await initRepo(repoPath);
    await commit(repoPath, 'a.txt', '1', 'initial');
    await tag(repoPath, 'v1.0.0');
    await commit(repoPath, 'a.txt', '2', 'add env var');

    const resolver = new ReleaseBaseResolver(new GitClient(repoPath), new SemverTagMatcher());
    const result = await resolver.resolve();

    expect(result.kind).toBe('tag');
    expect(result.baseRef).toBe('v1.0.0');
    expect(result.hasNewCommits).toBe(true);
    expect(result.baseCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(result.baseCommit).not.toBe(result.baseRef);
  });

  it('reports no new commits when HEAD is the base tag', async () => {
    repoPath = await mkdtemp(join(tmpdir(), 'sentinel-base-'));
    await initRepo(repoPath);
    await commit(repoPath, 'a.txt', '1', 'initial');
    await tag(repoPath, 'v1.0.0');

    const resolver = new ReleaseBaseResolver(new GitClient(repoPath), new SemverTagMatcher());
    const result = await resolver.resolve();

    expect(result.baseRef).toBe('v1.0.0');
    expect(result.hasNewCommits).toBe(false);
  });

  it('falls back to first_release when no ancestral SemVer tag exists', async () => {
    repoPath = await mkdtemp(join(tmpdir(), 'sentinel-base-'));
    await initRepo(repoPath);
    await commit(repoPath, 'a.txt', '1', 'initial');

    const resolver = new ReleaseBaseResolver(new GitClient(repoPath), new SemverTagMatcher());
    const result = await resolver.resolve();

    expect(result.kind).toBe('first_release');
    expect(result.hasNewCommits).toBe(false);
  });

  it('picks v1.0.0 on a patch/1.0 branch, never v2.0.0 from main', async () => {
    repoPath = await mkdtemp(join(tmpdir(), 'sentinel-base-'));
    await initRepo(repoPath);
    await commit(repoPath, 'a.txt', '1', 'initial');
    await tag(repoPath, 'v1.0.0');
    await commit(repoPath, 'a.txt', '2', 'feature for v2');
    await tag(repoPath, 'v2.0.0');

    await execa('git', ['checkout', '-q', '-b', 'patch/1.0', 'v1.0.0'], { cwd: repoPath });
    await commit(repoPath, 'a.txt', 'patched', 'backport fix');

    const resolver = new ReleaseBaseResolver(new GitClient(repoPath), new SemverTagMatcher());
    const result = await resolver.resolve();

    expect(result.baseRef).toBe('v1.0.0');
    expect(result.hasNewCommits).toBe(true);
  });
});
