import type { ChangeDetector } from '../detectors/types.js';
import { AwsDetector } from '../detectors/aws-detector.js';
import { EnvironmentDetector } from '../detectors/environment-detector.js';
import { InfrastructureDetector } from '../detectors/infrastructure-detector.js';
import { IntegrationDetector } from '../detectors/integration-detector.js';
import { MessagingDetector } from '../detectors/messaging-detector.js';
import { MigrationDetector } from '../detectors/migration-detector.js';
import type { RepositoryAnalysis, RepositoryDescriptor } from '../domain/repository.js';
import { parseUnifiedDiff } from '../infrastructure/diff-parser.js';
import { GitClient } from '../infrastructure/git-client.js';
import { ReleaseBaseResolver } from './release-base-resolver.js';
import { SemverTagMatcher } from './semver-tag-matcher.js';

export const DEFAULT_DETECTORS: ChangeDetector[] = [
  new EnvironmentDetector(),
  new MigrationDetector(),
  new AwsDetector(),
  new MessagingDetector(),
  new IntegrationDetector(),
  new InfrastructureDetector(),
];

export async function analyzeRepository(
  repository: RepositoryDescriptor,
  detectors: ChangeDetector[] = DEFAULT_DETECTORS,
): Promise<RepositoryAnalysis> {
  const git = new GitClient(repository.repositoryPath);
  const resolver = new ReleaseBaseResolver(git, new SemverTagMatcher());
  const base = await resolver.resolve();

  if (!base.hasNewCommits) {
    return { repository, base, diffFiles: [], findings: [] };
  }

  const diffText = await git.diff(base.baseRef, base.headCommit);
  const diffFiles = parseUnifiedDiff(diffText);
  const context = { application: repository.application, repositoryPath: repository.repositoryPath };
  const findings = detectors.flatMap((detector) => detector.detect(diffFiles, context));

  return { repository, base, diffFiles, findings };
}

export async function analyzeRepositories(
  repositories: RepositoryDescriptor[],
  concurrency = 4,
): Promise<RepositoryAnalysis[]> {
  const results: RepositoryAnalysis[] = new Array(repositories.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor++;
      if (index >= repositories.length) return;
      results[index] = await analyzeRepository(repositories[index]!);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, repositories.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
