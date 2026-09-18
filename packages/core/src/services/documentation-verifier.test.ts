import { describe, expect, it } from 'vitest';
import type { Finding } from '../domain/finding.js';
import type { ReleaseDocumentBundle } from '../domain/release-document.js';
import { findDeterministicCandidates } from './documentation-verifier.js';

const bundle: ReleaseDocumentBundle = {
  release: 'R2026.12',
  envVars: { path: 'release-documents/R2026.12/env-vars.md', content: '# Env vars\nNo new variables in this release.\n' },
  instructions: {
    path: 'release-documents/R2026.12/instructions.md',
    content: '1. payment-api: run scripts/payment-api/001-migrate.sql (adds receipt status column) before deploy.\n',
  },
  scripts: [
    {
      application: 'payment-api',
      relativePath: 'payment-api/001-migrate.sql',
      kind: 'sql',
      content: 'ALTER TABLE receipts ADD COLUMN status VARCHAR(20);',
      referencedByInstructions: true,
    },
  ],
};

const environmentFinding: Finding = {
  application: 'payment-api',
  category: 'environment',
  subject: 'RECEIPT_BUCKET',
  operation: 'added',
  repositoryPath: '/workspace/services/payment-api',
  filePath: 'application.yml',
  evidence: 'x',
  confidence: 'high',
};

const databaseFinding: Finding = {
  ...environmentFinding,
  category: 'database',
  subject: 'status',
};

describe('findDeterministicCandidates', () => {
  it('finds no candidates for an undocumented environment variable', () => {
    expect(findDeterministicCandidates(environmentFinding, bundle)).toEqual([]);
  });

  it('finds candidates for a database finding in both instructions.md and the application script', () => {
    const candidates = findDeterministicCandidates(databaseFinding, bundle);
    const paths = candidates.map((c) => c.path);
    expect(paths).toContain('release-documents/R2026.12/instructions.md');
    expect(paths).toContain('scripts/payment-api/001-migrate.sql');
  });
});
