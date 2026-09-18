import { resolve } from 'node:path';
import type { Command } from 'commander';
import { Retriever, resolveEmbeddingProvider } from '@sentinel/core';

export function registerRagSearchCommand(program: Command): void {
  const rag = program.command('rag').description('RAG utilities');
  rag
    .command('search')
    .description('Query the local hybrid RAG index directly')
    .requiredOption('--workspace <path>', 'Indexed workspace')
    .requiredOption('--query <query>', 'Search query')
    .option('--limit <limit>', 'Maximum results', '5')
    .action(async (options: { workspace: string; query: string; limit: string }) => {
      const workspacePath = resolve(options.workspace);
      const retriever = new Retriever(workspacePath, resolveEmbeddingProvider());
      const hits = await retriever.search(options.query, Number(options.limit));
      retriever.close();
      for (const hit of hits) {
        console.log(`${hit.path}:${hit.startLine}-${hit.endLine} (${hit.metadata.source}, score ${hit.score.toFixed(3)})`);
        console.log(`  ${hit.content.trim().replace(/\s+/g, ' ').slice(0, 200)}`);
      }
    });
}
