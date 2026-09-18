import { describe, expect, it } from 'vitest';
import type { DiffFile } from '../domain/repository.js';
import { EnvironmentDetector } from './environment-detector.js';

const context = { application: 'payment-api', repositoryPath: '/workspace/services/payment-api' };

function fileWith(path: string, addedLine: string, removedLine?: string): DiffFile {
  return {
    path,
    changeType: 'modified',
    hunks: [
      {
        startLine: 18,
        lines: [
          ...(removedLine
            ? [{ type: 'removed' as const, content: removedLine, newLineNumber: null }]
            : []),
          { type: 'added' as const, content: addedLine, newLineNumber: 18 },
        ],
      },
    ],
  };
}

describe('EnvironmentDetector', () => {
  const detector = new EnvironmentDetector();

  it('detects a new key added to application.yml without leaking its value', () => {
    const findings = detector.detect(
      [fileWith('src/main/resources/application.yml', 'RECEIPT_BUCKET: receipts-prod-bucket')],
      context,
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ subject: 'RECEIPT_BUCKET', operation: 'added', category: 'environment' });
    expect(findings[0]!.evidence).not.toContain('receipts-prod-bucket');
  });

  it('detects a key added to .env.example', () => {
    const findings = detector.detect([fileWith('.env.example', 'API_KEY=changeme')], context);
    expect(findings[0]!.subject).toBe('API_KEY');
  });

  it('detects a removed key', () => {
    const findings = detector.detect(
      [fileWith('src/main/resources/application.yml', 'NEW_KEY: 1', 'OLD_KEY: 1')],
      context,
    );
    expect(findings.some((f) => f.subject === 'OLD_KEY' && f.operation === 'removed')).toBe(true);
  });

  it('ignores files that are not environment configuration', () => {
    const findings = detector.detect([fileWith('src/App.java', 'RECEIPT_BUCKET: x')], context);
    expect(findings).toHaveLength(0);
  });
});
