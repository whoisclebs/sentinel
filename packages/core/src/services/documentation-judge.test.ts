import { FakeListChatModel } from '@langchain/core/utils/testing';
import { describe, expect, it } from 'vitest';
import type { DocumentationJudgementInput } from '../domain/judgement.js';
import { DocumentationJudge } from './documentation-judge.js';

const baseInput: DocumentationJudgementInput = {
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
  releaseDocumentCandidates: [
    {
      path: 'release-documents/R2026.12/env-vars.md',
      startLine: 1,
      endLine: 3,
      content: 'No new variables in this release.',
      score: 1,
      source: 'release_document',
    },
  ],
  relatedCodeAndKnowledge: [],
};

describe('DocumentationJudge', () => {
  it('parses a valid verdict from the model', async () => {
    const model = new FakeListChatModel({
      responses: [
        JSON.stringify({
          verdict: 'missing',
          confidence: 'high',
          rationale: 'env-vars.md explicitly says there are no new variables, contradicting the diff.',
          citedEvidence: [
            {
              source: 'release_document',
              path: 'release-documents/R2026.12/env-vars.md',
              startLine: 1,
              endLine: 3,
              explanation: 'States there are no new variables.',
            },
          ],
          requiredDocumentation: ['Document RECEIPT_BUCKET: purpose, target environment, and provisioning owner.'],
        }),
      ],
    });

    const judgement = await new DocumentationJudge(model).judge(baseInput);
    expect(judgement.verdict).toBe('missing');
    expect(judgement.citedEvidence).toHaveLength(1);
  });

  it('falls back to inconclusive when the model returns invalid JSON on every attempt', async () => {
    const model = new FakeListChatModel({ responses: ['not json', 'still not json', 'nope'] });
    const judgement = await new DocumentationJudge(model).judge(baseInput);
    expect(judgement.verdict).toBe('inconclusive');
  });

  it('falls back to inconclusive when no context was retrieved, without calling the model', async () => {
    const model = new FakeListChatModel({ responses: [] });
    const judgement = await new DocumentationJudge(model).judge({
      ...baseInput,
      releaseDocumentCandidates: [],
      relatedCodeAndKnowledge: [],
    });
    expect(judgement.verdict).toBe('inconclusive');
    expect(judgement.rationale).toContain('No release document or code/knowledge-base context');
  });

  it('never returns documented when the provider throws', async () => {
    class ThrowingModel extends FakeListChatModel {
      override invoke(): Promise<never> {
        return Promise.reject(new Error('network error'));
      }
    }
    const model = new ThrowingModel({ responses: [] });
    const judgement = await new DocumentationJudge(model).judge(baseInput);
    expect(judgement.verdict).toBe('inconclusive');
  });

  it('sanitizes provider error text before it lands in the persisted rationale', async () => {
    const rawError =
      `request to https://api.internal-provider.example/v1/workspaces/ws_9f8e7d6c5b4a/completions failed: ` +
      'x'.repeat(400);
    class ThrowingModel extends FakeListChatModel {
      override invoke(): Promise<never> {
        return Promise.reject(new Error(rawError));
      }
    }
    const model = new ThrowingModel({ responses: [] });
    const judgement = await new DocumentationJudge(model).judge(baseInput);

    expect(judgement.verdict).toBe('inconclusive');
    expect(judgement.rationale).toContain('Judge provider failed after 3 attempts');
    expect(judgement.rationale).not.toContain('https://api.internal-provider.example');
    expect(judgement.rationale).not.toContain('ws_9f8e7d6c5b4a');
    expect(judgement.rationale.length).toBeLessThan(rawError.length);
  });
});
