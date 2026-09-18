export interface ReleaseTagMatcher {
  matches(tag: string): boolean;
  /** Negative when tagA < tagB, positive when tagA > tagB, zero when equal. */
  compare(tagA: string, tagB: string): number;
}

const SEMVER_RE = /^v(\d+)\.(\d+)\.(\d+)$/;

export class SemverTagMatcher implements ReleaseTagMatcher {
  matches(tag: string): boolean {
    return SEMVER_RE.test(tag);
  }

  compare(tagA: string, tagB: string): number {
    const a = this.parse(tagA);
    const b = this.parse(tagB);
    if (a[0] !== b[0]) return a[0] - b[0];
    if (a[1] !== b[1]) return a[1] - b[1];
    return a[2] - b[2];
  }

  private parse(tag: string): [number, number, number] {
    const match = SEMVER_RE.exec(tag);
    if (!match) throw new Error(`Tag "${tag}" is not a valid vX.Y.Z SemVer tag`);
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  }
}
