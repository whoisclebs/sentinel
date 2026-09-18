import { describe, expect, it } from 'vitest';
import type { RepositoryAnalysis } from '../domain/repository.js';
import { DryRunReleaseMarker } from './release-marker.js';

function analysis(application: string, hasNewCommits: boolean): RepositoryAnalysis {
  return {
    repository: { application, repositoryPath: `/workspace/services/${application}`, isSubmodule: false },
    base: { kind: 'tag', baseRef: 'v1.0.0', baseCommit: 'v1.0.0', headCommit: 'abc123', hasNewCommits },
    diffFiles: [],
    findings: [],
  };
}

describe('DryRunReleaseMarker', () => {
  it('marks only repositories with new commits as taggable when there are no blocking pending items', async () => {
    const results = await new DryRunReleaseMarker().mark(
      'R2026.12',
      [analysis('payment-api', true), analysis('transaction-api', false)],
      false,
    );

    expect(results.find((r) => r.application === 'payment-api')?.wouldTag).toBe(true);
    expect(results.find((r) => r.application === 'transaction-api')?.wouldTag).toBe(false);
  });

  it('marks nothing as taggable when there are blocking pending items', async () => {
    const results = await new DryRunReleaseMarker().mark('R2026.12', [analysis('payment-api', true)], true);
    expect(results.every((r) => r.wouldTag === false)).toBe(true);
  });
});
