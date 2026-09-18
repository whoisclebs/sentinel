import type { Finding } from '../domain/finding.js';
import type { DiffFile } from '../domain/repository.js';
import { addedLines } from '../infrastructure/diff-parser.js';
import type { ChangeDetector, DetectorContext } from './types.js';

const MIGRATION_PATH_RE = /(db[\\/]migration|migrations?)[\\/].*\.(sql|js)$/i;
const SQL_FILE_RE = /\.sql$/i;
const SQL_STATEMENT_RE = /^(create|alter|drop|insert|update|delete)\b/i;

export class MigrationDetector implements ChangeDetector {
  readonly category = 'database' as const;

  detect(diffFiles: DiffFile[], context: DetectorContext): Finding[] {
    const findings: Finding[] = [];
    for (const file of diffFiles) {
      if (file.changeType === 'deleted') continue;
      const isMigrationPath = MIGRATION_PATH_RE.test(file.path);
      const isSqlScript = SQL_FILE_RE.test(file.path) && !isMigrationPath;
      if (!isMigrationPath && !isSqlScript) continue;

      const added = addedLines(file);
      if (added.length === 0) continue;
      const statementLine = added.find((l) => SQL_STATEMENT_RE.test(l.content.trim())) ?? added[0]!;

      findings.push({
        application: context.application,
        category: 'database',
        subject: file.path.split(/[\\/]/).pop()!,
        operation: file.changeType === 'added' ? 'added' : 'changed',
        repositoryPath: context.repositoryPath,
        filePath: file.path,
        line: statementLine.newLineNumber ?? undefined,
        evidence: `${file.changeType === 'added' ? 'New' : 'Changed'} migration/SQL script in ${file.path}: "${statementLine.content.trim()}".`,
        confidence: 'high',
      });
    }
    return findings;
  }
}
