import type { ReleaseBaseResult } from '../domain/repository.js';
import type { GitClient } from '../infrastructure/git-client.js';
import type { ReleaseTagMatcher } from './semver-tag-matcher.js';

export class ReleaseBaseResolver {
  constructor(
    private readonly git: GitClient,
    private readonly matcher: ReleaseTagMatcher,
  ) {}

  async resolve(headRef = 'HEAD'): Promise<ReleaseBaseResult> {
    const headCommit = await this.git.resolveHead();
    const tags = await this.git.listTags();
    const candidates = tags.filter((t) => this.matcher.matches(t));

    const ancestralTags: string[] = [];
    for (const tag of candidates) {
      if (await this.git.isAncestor(tag, headRef)) ancestralTags.push(tag);
    }

    if (ancestralTags.length === 0) {
      const firstCommit = await this.git.firstCommit();
      return {
        kind: 'first_release',
        baseRef: firstCommit,
        baseCommit: firstCommit,
        headCommit,
        hasNewCommits: firstCommit !== headCommit,
      };
    }

    ancestralTags.sort((a, b) => this.matcher.compare(a, b));
    const baseTag = ancestralTags[ancestralTags.length - 1]!;
    const commits = await this.git.logCommits(baseTag, headRef);
    const baseCommit = await this.git.resolveRef(baseTag);
    return {
      kind: 'tag',
      baseRef: baseTag,
      baseCommit,
      headCommit,
      hasNewCommits: commits.length > 0,
    };
  }
}
