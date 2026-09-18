import { describe, expect, it } from 'vitest';
import type { DiffFile } from '../domain/repository.js';
import { InfrastructureDetector } from './infrastructure-detector.js';

const context = { application: 'payment-api', repositoryPath: '/workspace/services/payment-api' };

function file(path: string, changeType: DiffFile['changeType']): DiffFile {
  return { path, changeType, hunks: [] };
}

describe('InfrastructureDetector', () => {
  const detector = new InfrastructureDetector();

  it('detects a changed Dockerfile and a new terraform file', () => {
    const findings = detector.detect(
      [file('Dockerfile', 'modified'), file('terraform/main.tf', 'added')],
      context,
    );
    expect(findings).toHaveLength(2);
    expect(findings.map((f) => f.subject).sort()).toEqual(['Dockerfile', 'main.tf']);
  });

  it('ignores application source files', () => {
    expect(detector.detect([file('src/App.java', 'modified')], context)).toHaveLength(0);
  });
});
