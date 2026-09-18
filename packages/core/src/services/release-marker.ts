import type { RepositoryAnalysis } from '../domain/repository.js';

export interface ReleaseMarkResult {
  application: string;
  repositoryPath: string;
  wouldTag: boolean;
  reason: string;
}

export interface ReleaseMarker {
  mark(release: string, analyses: RepositoryAnalysis[], hasBlockingPendingItems: boolean): Promise<ReleaseMarkResult[]>;
}

/** Never writes a tag. Reports what a real ReleaseMarker would do once one exists. */
export class DryRunReleaseMarker implements ReleaseMarker {
  mark(release: string, analyses: RepositoryAnalysis[], hasBlockingPendingItems: boolean): Promise<ReleaseMarkResult[]> {
    return Promise.resolve(
      analyses.map((analysis) => {
        const { application, repositoryPath } = analysis.repository;
        if (hasBlockingPendingItems) {
          return {
            application,
            repositoryPath,
            wouldTag: false,
            reason: `Audit has blocking pending items; release ${release} would not be tagged.`,
          };
        }
        if (!analysis.base.hasNewCommits) {
          return { application, repositoryPath, wouldTag: false, reason: 'No new commits since the base tag; nothing to release.' };
        }
        return {
          application,
          repositoryPath,
          wouldTag: true,
          reason: `Would tag ${release} at HEAD (${analysis.base.headCommit}).`,
        };
      }),
    );
  }
}
