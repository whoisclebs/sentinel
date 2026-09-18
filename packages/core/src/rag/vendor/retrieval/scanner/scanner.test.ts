import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanRepository } from './scanner.js';

let root: string;

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

describe('scanRepository', () => {
  it('lists text files and skips ignored directories', async () => {
    root = await mkdtemp(join(tmpdir(), 'sentinel-scan-'));
    await mkdir(join(root, 'node_modules'), { recursive: true });
    await writeFile(join(root, 'node_modules', 'skip.js'), 'skip me');
    await writeFile(join(root, 'README.md'), '# hello\n');

    const files = await scanRepository(root);
    const paths = files.map((f) => f.relPath);

    expect(paths).toContain('README.md');
    expect(paths.some((p) => p.startsWith('node_modules'))).toBe(false);
  });
});
