import { execa } from 'execa';

export class GitClient {
  constructor(private readonly repositoryPath: string) {}

  private async git(
    args: string[],
    options: { allowFailure?: boolean } = {},
  ): Promise<{ stdout: string; exitCode: number }> {
    const result = await execa('git', args, {
      cwd: this.repositoryPath,
      reject: !options.allowFailure,
    });
    return { stdout: result.stdout, exitCode: result.exitCode ?? 0 };
  }

  async resolveHead(): Promise<string> {
    const { stdout } = await this.git(['rev-parse', 'HEAD']);
    return stdout.trim();
  }

  async listTags(): Promise<string[]> {
    const { stdout } = await this.git(['tag', '--list']);
    return stdout
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async isAncestor(ancestorRef: string, descendantRef: string): Promise<boolean> {
    const { exitCode } = await this.git(
      ['merge-base', '--is-ancestor', ancestorRef, descendantRef],
      { allowFailure: true },
    );
    return exitCode === 0;
  }

  async firstCommit(): Promise<string> {
    const { stdout } = await this.git(['rev-list', '--max-parents=0', 'HEAD']);
    return stdout.split('\n')[0]!.trim();
  }

  async logCommits(baseRef: string, headRef: string): Promise<string[]> {
    const { stdout } = await this.git(['log', '--format=%H', `${baseRef}..${headRef}`]);
    return stdout
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }

  async diff(baseRef: string, headRef: string): Promise<string> {
    const { stdout } = await this.git(['diff', '--no-color', `${baseRef}..${headRef}`]);
    return stdout;
  }
}
