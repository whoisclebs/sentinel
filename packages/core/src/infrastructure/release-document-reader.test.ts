import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readReleaseDocuments } from './release-document-reader.js';

let root: string;

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

describe('readReleaseDocuments', () => {
  it('reads env-vars.md, instructions.md, and flags an unreferenced script as inconclusive', async () => {
    root = await mkdtemp(join(tmpdir(), 'sentinel-release-docs-'));
    const releaseDir = join(root, 'R2026.12');
    await mkdir(join(releaseDir, 'scripts', 'payment-api'), { recursive: true });
    await writeFile(join(releaseDir, 'env-vars.md'), '# Env vars\nNo new vars.\n');
    await writeFile(
      join(releaseDir, 'instructions.md'),
      'Run scripts/payment-api/001-migrate.sql before deploying.\n',
    );
    await writeFile(join(releaseDir, 'scripts', 'payment-api', '001-migrate.sql'), 'ALTER TABLE x ADD y INT;');
    await writeFile(join(releaseDir, 'scripts', 'payment-api', '002-orphan.sql'), 'SELECT 1;');

    const { bundle, issues } = await readReleaseDocuments(root, 'R2026.12');

    expect(bundle.envVars?.content).toContain('No new vars');
    expect(bundle.instructions?.content).toContain('001-migrate.sql');
    expect(bundle.scripts).toHaveLength(2);
    expect(issues).toEqual([
      expect.objectContaining({
        severity: 'inconclusive',
        message: expect.stringContaining('002-orphan.sql'),
      }),
    ]);
  });

  it('reports a blocking issue when env-vars.md is missing', async () => {
    root = await mkdtemp(join(tmpdir(), 'sentinel-release-docs-'));
    const releaseDir = join(root, 'R2026.12');
    await mkdir(releaseDir, { recursive: true });
    await writeFile(join(releaseDir, 'instructions.md'), 'No scripts needed.\n');

    const { bundle, issues } = await readReleaseDocuments(root, 'R2026.12');

    expect(bundle.envVars).toBeNull();
    expect(issues.some((i) => i.severity === 'blocking' && i.message.includes('env-vars.md'))).toBe(true);
  });
});
