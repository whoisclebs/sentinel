import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readReleaseScripts } from './release-script-reader.js';

let scriptsDir: string;

afterEach(async () => {
  if (scriptsDir) await rm(scriptsDir, { recursive: true, force: true });
});

describe('readReleaseScripts', () => {
  it('classifies scripts by content and flags whether instructions.md references them', async () => {
    scriptsDir = await mkdtemp(join(tmpdir(), 'sentinel-scripts-'));
    await mkdir(join(scriptsDir, 'payment-api'), { recursive: true });
    await writeFile(
      join(scriptsDir, 'payment-api', '001-migrate.sql'),
      'ALTER TABLE receipts ADD COLUMN status VARCHAR(20);',
    );
    await writeFile(
      join(scriptsDir, 'payment-api', '002-backfill.js'),
      "db.receipts.updateMany({}, { $set: { status: 'ok' } });",
    );

    const instructions = 'Run scripts/payment-api/001-migrate.sql before deploying.';
    const scripts = await readReleaseScripts(scriptsDir, instructions);

    const migration = scripts.find((s) => s.relativePath === 'payment-api/001-migrate.sql')!;
    const backfill = scripts.find((s) => s.relativePath === 'payment-api/002-backfill.js')!;

    expect(migration.kind).toBe('sql');
    expect(migration.referencedByInstructions).toBe(true);
    expect(backfill.kind).toBe('mongo');
    expect(backfill.referencedByInstructions).toBe(false);
  });

  it('returns an empty array when the scripts directory does not exist', async () => {
    expect(await readReleaseScripts('/nonexistent/scripts', null)).toEqual([]);
  });
});
