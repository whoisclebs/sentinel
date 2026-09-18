import { describe, expect, it } from 'vitest';
import type { DiffFile } from '../domain/repository.js';
import { AwsDetector } from './aws-detector.js';

const context = { application: 'payment-api', repositoryPath: '/workspace/services/payment-api' };

function addedFile(path: string, content: string): DiffFile {
  return {
    path,
    changeType: 'modified',
    hunks: [{ startLine: 10, lines: [{ type: 'added', content, newLineNumber: 10 }] }],
  };
}

describe('AwsDetector', () => {
  const detector = new AwsDetector();

  it('detects a new S3 client reference with precise, non-committal language', () => {
    const findings = detector.detect(
      [addedFile('src/ReceiptService.java', 'S3Client s3 = S3Client.builder().build();')],
      context,
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ category: 'aws', subject: 'S3' });
    expect(findings[0]!.evidence).toContain('provisioning not verified');
    expect(findings[0]!.evidence).not.toMatch(/needs to be created/i);
  });

  it('ignores lines without AWS references', () => {
    expect(detector.detect([addedFile('src/Foo.java', 'int x = 1;')], context)).toHaveLength(0);
  });
});
