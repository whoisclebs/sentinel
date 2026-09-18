import { describe, expect, it } from 'vitest';
import { HashEmbeddingProvider } from './hash-provider.js';

describe('HashEmbeddingProvider', () => {
  it('is deterministic for the same text', async () => {
    const provider = new HashEmbeddingProvider(16);
    const a = await provider.embedDocument('receipt bucket configuration');
    const b = await provider.embedDocument('receipt bucket configuration');
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('produces different vectors for different text', async () => {
    const provider = new HashEmbeddingProvider(16);
    const a = await provider.embedDocument('receipt bucket');
    const b = await provider.embedDocument('kafka topic');
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});
