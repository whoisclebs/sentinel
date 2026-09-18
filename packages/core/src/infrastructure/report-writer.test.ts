import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { AuditReport } from '../domain/report.js';
import { writeReport } from './report-writer.js';

let artifactsRoot: string;

afterEach(async () => {
  if (artifactsRoot) await rm(artifactsRoot, { recursive: true, force: true });
});

const report: AuditReport = {
  release: 'R2026.12',
  generatedAt: '2026-09-18T00:00:00.000Z',
  repositoriesAnalyzed: [
    {
      application: 'payment-api',
      repositoryPath: '/workspace/services/payment-api',
      base: { kind: 'tag', baseRef: 'v1.0.0', baseCommit: 'v1.0.0', headCommit: 'abc123', hasNewCommits: true },
      findingCount: 1,
    },
  ],
  repositoriesWithNewCommits: ['payment-api'],
  findings: [
    {
      finding: {
        application: 'payment-api',
        category: 'environment',
        subject: 'RECEIPT_BUCKET',
        operation: 'added',
        repositoryPath: '/workspace/services/payment-api',
        filePath: 'src/main/resources/application.yml',
        line: 18,
        evidence: 'Key "RECEIPT_BUCKET" added in src/main/resources/application.yml:18.',
        confidence: 'high',
      },
      base: { kind: 'tag', baseRef: 'v1.0.0', baseCommit: 'v1.0.0', headCommit: 'abc123', hasNewCommits: true },
      judgement: {
        verdict: 'missing',
        confidence: 'high',
        rationale: 'env-vars.md does not mention RECEIPT_BUCKET.',
        citedEvidence: [],
        requiredDocumentation: ['Document the RECEIPT_BUCKET variable.'],
      },
      retrievedContext: [],
    },
  ],
  releaseDocumentIssues: [],
};

describe('writeReport', () => {
  it('writes report.json and a report.md with the pending finding', async () => {
    artifactsRoot = await mkdtemp(join(tmpdir(), 'sentinel-report-'));
    const { jsonPath, markdownPath } = await writeReport(artifactsRoot, report);

    const json = JSON.parse(await readFile(jsonPath, 'utf8'));
    expect(json.release).toBe('R2026.12');

    const markdown = await readFile(markdownPath, 'utf8');
    expect(markdown).toContain('# SENTINEL — R2026.12 Audit');
    expect(markdown).toContain('Pending: 1');
    expect(markdown).toContain('RECEIPT_BUCKET');
    expect(markdown).toContain('src/main/resources/application.yml:18');
  });
});
