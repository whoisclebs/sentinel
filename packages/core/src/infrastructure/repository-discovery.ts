import { readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { RepositoryDescriptor } from '../domain/repository.js';

const SCAN_ROOTS = ['services', 'webapps'];

async function isRepoRoot(dir: string): Promise<boolean> {
  try {
    return (await readdir(dir)).includes('.git');
  } catch {
    return false;
  }
}

async function isSubmodule(dir: string): Promise<boolean> {
  try {
    return (await stat(join(dir, '.git'))).isFile();
  } catch {
    return false;
  }
}

async function walk(dir: string, found: string[]): Promise<void> {
  if (await isRepoRoot(dir)) {
    found.push(dir);
    return;
  }
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) await walk(join(dir, entry.name), found);
  }
}

export class RepositoryDiscovery {
  constructor(private readonly workspacePath: string) {}

  async discover(): Promise<RepositoryDescriptor[]> {
    const found: string[] = [];
    for (const root of SCAN_ROOTS) {
      await walk(join(this.workspacePath, root), found);
    }
    const descriptors: RepositoryDescriptor[] = [];
    for (const repositoryPath of found) {
      descriptors.push({
        application: basename(repositoryPath),
        repositoryPath,
        isSubmodule: await isSubmodule(repositoryPath),
      });
    }
    return descriptors;
  }
}
