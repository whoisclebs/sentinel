import { describe, expect, it } from 'vitest';
import type { DocumentationJudgementInput } from '../domain/judgement.js';
import { buildJudgePrompt } from './judge-prompt.js';

const input: DocumentationJudgementInput = {
  finding: {
    application: 'payment-api',
    category: 'environment',
    subject: 'RECEIPT_BUCKET',
    operation: 'added',
    repositoryPath: '/workspace/services/payment-api',
    filePath: 'application.yml',
    line: 18,
    evidence: 'Key "RECEIPT_BUCKET" added in application.yml:18.',
    confidence: 'high',
  },
  deterministicEvidence: {
    diff: '+RECEIPT_BUCKET: receipts-bucket',
    detectorRule: 'environment-detector',
    repositoryPath: '/workspace/services/payment-api',
    filePath: 'application.yml',
    line: 18,
  },
  releaseDocumentCandidates: [],
  relatedCodeAndKnowledge: [],
};

describe('buildJudgePrompt', () => {
  it('includes the finding, the diff evidence, and the JSON output contract', () => {
    const prompt = buildJudgePrompt(input);
    expect(prompt).toContain('RECEIPT_BUCKET');
    expect(prompt).toContain('environment-detector');
    expect(prompt).toContain('"verdict"');
    expect(prompt).toContain('(none provided)');
  });
});
