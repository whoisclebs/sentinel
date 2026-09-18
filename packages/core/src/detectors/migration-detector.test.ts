import { describe, expect, it } from 'vitest';
import type { DiffFile } from '../domain/repository.js';
import { MigrationDetector } from './migration-detector.js';

const context = { application: 'payment-api', repositoryPath: '/workspace/services/payment-api' };

function addedFile(path: string, content: string): DiffFile {
  return {
    path,
    changeType: 'added',
    hunks: [{ startLine: 1, lines: [{ type: 'added', content, newLineNumber: 1 }] }],
  };
}

describe('MigrationDetector', () => {
  const detector = new MigrationDetector();

  it('detects a new Flyway-style migration file', () => {
    const findings = detector.detect(
      [
        addedFile(
          'src/main/resources/db/migration/V245__add_receipt_status.sql',
          'ALTER TABLE receipts ADD COLUMN status VARCHAR(20);',
        ),
      ],
      context,
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      category: 'database',
      subject: 'V245__add_receipt_status.sql',
      operation: 'added',
    });
    expect(findings[0]!.evidence).toContain('ALTER TABLE receipts');
  });

  it('ignores non-SQL, non-migration files', () => {
    expect(detector.detect([addedFile('src/App.java', 'class App {}')], context)).toHaveLength(0);
  });
});
