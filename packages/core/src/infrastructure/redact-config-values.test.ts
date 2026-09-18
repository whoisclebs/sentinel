import { describe, expect, it } from 'vitest';
import { redactConfigValues } from './redact-config-values.js';

describe('redactConfigValues', () => {
  it('redacts the value of a YAML key/value line', () => {
    expect(redactConfigValues('RECEIPT_BUCKET: receipts-prod-bucket')).toBe('RECEIPT_BUCKET: ***REDACTED***');
  });

  it('redacts the value of an env-style KEY=value line', () => {
    expect(redactConfigValues('API_KEY=abc123')).toBe('API_KEY=***REDACTED***');
  });

  it('redacts the value of a .properties style key=value line', () => {
    expect(redactConfigValues('db.password=hunter2')).toBe('db.password=***REDACTED***');
  });

  it('preserves a leading unified-diff marker around the redaction', () => {
    expect(redactConfigValues('+RECEIPT_BUCKET: receipts-prod-bucket')).toBe('+RECEIPT_BUCKET: ***REDACTED***');
    expect(redactConfigValues('-RECEIPT_BUCKET: receipts-prod-bucket')).toBe('-RECEIPT_BUCKET: ***REDACTED***');
  });

  it('leaves non key/value lines (SQL, markdown, code) unchanged', () => {
    const sql = 'ALTER TABLE receipts ADD status TEXT;';
    const markdown = '# Receipts\nThe receipts worker uses an S3 bucket.';
    expect(redactConfigValues(sql)).toBe(sql);
    expect(redactConfigValues(markdown)).toBe(markdown);
  });

  it('leaves a key with no value (e.g. a YAML mapping header) unchanged', () => {
    expect(redactConfigValues('database:')).toBe('database:');
  });

  it('redacts multi-line blocks line by line', () => {
    const input = ['services:', '  payment-api:', 'RECEIPT_BUCKET: receipts-prod-bucket', 'DB_PASSWORD=s3cr3t'].join(
      '\n',
    );
    const output = redactConfigValues(input);
    expect(output).not.toContain('receipts-prod-bucket');
    expect(output).not.toContain('s3cr3t');
    expect(output).toContain('RECEIPT_BUCKET: ***REDACTED***');
    expect(output).toContain('DB_PASSWORD=***REDACTED***');
  });
});
