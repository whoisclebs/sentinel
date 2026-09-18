import type { Finding } from '../domain/finding.js';
import type { DiffFile } from '../domain/repository.js';
import { addedLines, removedLines } from '../infrastructure/diff-parser.js';
import type { ChangeDetector, DetectorContext } from './types.js';

const ENV_FILE_RE =
  /(application[^/]*\.(ya?ml|properties)|\.env\.example|values[^/]*\.ya?ml|docker-compose[^/]*\.ya?ml)$/i;
const YAML_KEY_RE = /^\s*([A-Za-z0-9_.-]+)\s*:/;
const ENV_KEY_RE = /^\s*([A-Z0-9_]+)\s*=/;
const PROPERTIES_KEY_RE = /^\s*([A-Za-z0-9_.-]+)\s*=/;

function extractKey(line: string): string | null {
  return YAML_KEY_RE.exec(line)?.[1] ?? ENV_KEY_RE.exec(line)?.[1] ?? PROPERTIES_KEY_RE.exec(line)?.[1] ?? null;
}

export class EnvironmentDetector implements ChangeDetector {
  readonly category = 'environment' as const;

  detect(diffFiles: DiffFile[], context: DetectorContext): Finding[] {
    const findings: Finding[] = [];
    for (const file of diffFiles) {
      if (!ENV_FILE_RE.test(file.path)) continue;

      for (const line of addedLines(file)) {
        const key = extractKey(line.content);
        if (!key) continue;
        findings.push({
          application: context.application,
          category: 'environment',
          subject: key,
          operation: 'added',
          repositoryPath: context.repositoryPath,
          filePath: file.path,
          line: line.newLineNumber ?? undefined,
          evidence: `Key "${key}" added in ${file.path}${line.newLineNumber ? `:${line.newLineNumber}` : ''}.`,
          confidence: 'high',
        });
      }
      for (const line of removedLines(file)) {
        const key = extractKey(line.content);
        if (!key) continue;
        findings.push({
          application: context.application,
          category: 'environment',
          subject: key,
          operation: 'removed',
          repositoryPath: context.repositoryPath,
          filePath: file.path,
          evidence: `Key "${key}" removed from ${file.path}.`,
          confidence: 'high',
        });
      }
    }
    return findings;
  }
}
