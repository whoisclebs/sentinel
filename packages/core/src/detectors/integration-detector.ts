import type { Finding } from '../domain/finding.js';
import type { DiffFile } from '../domain/repository.js';
import { addedLines, removedLines } from '../infrastructure/diff-parser.js';
import type { ChangeDetector, DetectorContext } from './types.js';

const URL_RE = /https?:\/\/[a-zA-Z0-9.\-_/:%?=&]+/g;

export class IntegrationDetector implements ChangeDetector {
  readonly category = 'integration' as const;

  detect(diffFiles: DiffFile[], context: DetectorContext): Finding[] {
    const findings: Finding[] = [];
    for (const file of diffFiles) {
      const hadRemovedUrl = removedLines(file).some((l) => URL_RE.test(l.content));
      URL_RE.lastIndex = 0;

      for (const line of addedLines(file)) {
        const urls = line.content.match(URL_RE) ?? [];
        for (const url of urls) {
          const operation = hadRemovedUrl ? 'changed' : 'added';
          findings.push({
            application: context.application,
            category: 'integration',
            subject: url,
            operation,
            repositoryPath: context.repositoryPath,
            filePath: file.path,
            line: line.newLineNumber ?? undefined,
            evidence: `Integration URL ${operation === 'added' ? 'newly added' : 'changed'} in ${file.path}${line.newLineNumber ? `:${line.newLineNumber}` : ''}: ${url}.`,
            confidence: 'high',
          });
        }
      }
    }
    return findings;
  }
}
