import { describe, expect, it } from 'vitest';
import { FindingSchema } from './finding.js';
import { DocumentationJudgementSchema } from './judgement.js';

describe('domain contracts', () => {
  it('parses a valid Finding', () => {
    const finding = FindingSchema.parse({
      application: 'payment-api',
      category: 'environment',
      subject: 'RECEIPT_BUCKET',
      operation: 'added',
      repositoryPath: '/workspace/services/payment-api',
      filePath: 'src/main/resources/application.yml',
      line: 18,
      evidence: 'Key "RECEIPT_BUCKET" added in src/main/resources/application.yml:18.',
      confidence: 'high',
    });
    expect(finding.category).toBe('environment');
  });

  it('rejects a Finding with an invalid category', () => {
    expect(() =>
      FindingSchema.parse({
        application: 'payment-api',
        category: 'unknown-category',
        subject: 'X',
        operation: 'added',
        repositoryPath: '/x',
        filePath: 'x.yml',
        evidence: 'x',
        confidence: 'high',
      }),
    ).toThrow();
  });

  it('parses a valid DocumentationJudgement', () => {
    const judgement = DocumentationJudgementSchema.parse({
      verdict: 'missing',
      confidence: 'high',
      rationale: 'No mention of RECEIPT_BUCKET anywhere in the release document.',
      citedEvidence: [],
      requiredDocumentation: ['Document the RECEIPT_BUCKET variable and its purpose.'],
    });
    expect(judgement.verdict).toBe('missing');
  });
});
