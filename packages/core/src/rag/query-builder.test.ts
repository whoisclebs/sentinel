import { describe, expect, it } from 'vitest';
import { buildRagQuery } from './query-builder.js';

describe('buildRagQuery', () => {
  it('builds a query combining subject, application, and category', () => {
    const query = buildRagQuery({
      application: 'payment-api',
      category: 'environment',
      subject: 'RECEIPT_BUCKET',
      operation: 'added',
      repositoryPath: '/x',
      filePath: 'application.yml',
      evidence: 'x',
      confidence: 'high',
    });
    expect(query).toBe('RECEIPT_BUCKET payment-api environment added');
  });
});
