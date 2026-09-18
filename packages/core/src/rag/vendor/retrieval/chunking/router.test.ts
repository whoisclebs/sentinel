import { describe, expect, it } from 'vitest';
import { ApproxTokenCounter } from '../embeddings/provider.js';
import { createDefaultChunker } from './router.js';

describe('createDefaultChunker', () => {
  it('splits Markdown content by heading section', async () => {
    const chunker = createDefaultChunker(new ApproxTokenCounter());
    const markdown = '# Title\n\nIntro text.\n\n## Migrations\n\nRun V245 before deploying.\n';

    const chunks = await chunker.chunk('instructions.md', markdown, 'markdown');

    expect(chunks.some((c) => c.symbol === 'Migrations' && c.content.includes('V245'))).toBe(true);
  });

  it('falls back to line-based chunking for plain text', async () => {
    const chunker = createDefaultChunker(new ApproxTokenCounter());
    const chunks = await chunker.chunk('notes.txt', 'line one\nline two\n', 'text');
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]!.content).toContain('line one');
  });
});
