import { describe, expect, it } from 'vitest';
import type { DiffFile } from '../domain/repository.js';
import { MessagingDetector } from './messaging-detector.js';

const context = { application: 'receipt-worker', repositoryPath: '/workspace/services/receipt-worker' };

function addedFile(path: string, content: string): DiffFile {
  return {
    path,
    changeType: 'modified',
    hunks: [{ startLine: 5, lines: [{ type: 'added', content, newLineNumber: 5 }] }],
  };
}

describe('MessagingDetector', () => {
  const detector = new MessagingDetector();

  it('detects a new @KafkaListener', () => {
    const findings = detector.detect(
      [addedFile('src/ReceiptListener.java', '@KafkaListener(topics = "receipts")')],
      context,
    );
    expect(findings[0]).toMatchObject({ category: 'messaging', subject: 'Kafka topic' });
  });

  it('ignores unrelated lines', () => {
    expect(detector.detect([addedFile('src/Foo.java', 'int x = 1;')], context)).toHaveLength(0);
  });
});
