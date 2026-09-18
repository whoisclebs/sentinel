import { resolve } from 'node:path';
import type { Command } from 'commander';
import { Indexer, resolveEmbeddingProvider } from '@sentinel/core';

export function registerIndexCommand(program: Command): void {
  program
    .command('index')
    .description('Build (or rebuild) the local RAG index for a workspace')
    .requiredOption('--workspace <path>', 'Workspace to index')
    .action(async (options: { workspace: string }) => {
      const workspacePath = resolve(options.workspace);
      const report = await new Indexer(workspacePath, resolveEmbeddingProvider()).run(null);
      console.log(`Indexed ${report.filesIndexed} files, ${report.chunksIndexed} chunks -> ${report.indexFile}`);
    });
}
