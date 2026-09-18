import { describe, expect, it } from 'vitest';
import { reciprocalRankFusion } from './rrf.js';

describe('reciprocalRankFusion', () => {
  it('ranks an item found in both lists above one found in only one', () => {
    const fused = reciprocalRankFusion([
      [{ id: 1 }, { id: 2 }],
      [{ id: 2 }, { id: 3 }],
    ]);
    expect(fused[0]!.id).toBe(2);
  });
});
