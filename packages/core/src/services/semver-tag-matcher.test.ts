import { describe, expect, it } from 'vitest';
import { SemverTagMatcher } from './semver-tag-matcher.js';

describe('SemverTagMatcher', () => {
  const matcher = new SemverTagMatcher();

  it('matches vX.Y.Z tags', () => {
    expect(matcher.matches('v1.0.0')).toBe(true);
    expect(matcher.matches('R2026.12')).toBe(false);
    expect(matcher.matches('1.0.0')).toBe(false);
  });

  it('compares by numeric semantic version, not lexically', () => {
    expect(matcher.compare('v2.0.0', 'v1.0.0')).toBeGreaterThan(0);
    expect(matcher.compare('v10.0.0', 'v9.0.0')).toBeGreaterThan(0);
    expect(matcher.compare('v1.2.0', 'v1.10.0')).toBeLessThan(0);
  });
});
