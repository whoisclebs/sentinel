import { describe, expect, it } from 'vitest';
import type { DiffFile } from '../domain/repository.js';
import { IntegrationDetector } from './integration-detector.js';

const context = { application: 'admin-web', repositoryPath: '/workspace/webapps/admin-web' };

describe('IntegrationDetector', () => {
  const detector = new IntegrationDetector();

  it('reports a changed URL when an old URL was removed and a new one added in the same file', () => {
    const file: DiffFile = {
      path: 'src/environments/environment.prod.ts',
      changeType: 'modified',
      hunks: [
        {
          startLine: 9,
          lines: [
            { type: 'removed', content: "apiUrl: 'https://api.old.example.com'", newLineNumber: null },
            { type: 'added', content: "apiUrl: 'https://api.new.example.com'", newLineNumber: 9 },
          ],
        },
      ],
    };

    const findings = detector.detect([file], context);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      category: 'integration',
      operation: 'changed',
      subject: 'https://api.new.example.com',
    });
  });

  it('reports "added" when there is no prior URL removed in the file', () => {
    const file: DiffFile = {
      path: 'src/config.ts',
      changeType: 'modified',
      hunks: [{ startLine: 1, lines: [{ type: 'added', content: "url: 'https://new.example.com'", newLineNumber: 1 }] }],
    };
    expect(detector.detect([file], context)[0]!.operation).toBe('added');
  });
});
