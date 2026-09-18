import type { Finding } from '../domain/finding.js';
import type { DiffFile } from '../domain/repository.js';
import type { ChangeDetector, DetectorContext } from './types.js';

const INFRA_DIR_RE = /(terraform|helm|k8s|kubernetes|cloudformation)[/\\]/i;

function isInfrastructureFile(path: string): boolean {
  return (
    /\.(tf|tfvars)$/i.test(path) ||
    /Dockerfile$/i.test(path) ||
    /docker-compose[^/]*\.ya?ml$/i.test(path) ||
    INFRA_DIR_RE.test(path)
  );
}

export class InfrastructureDetector implements ChangeDetector {
  readonly category = 'infrastructure' as const;

  detect(diffFiles: DiffFile[], context: DetectorContext): Finding[] {
    const findings: Finding[] = [];
    for (const file of diffFiles) {
      if (!isInfrastructureFile(file.path)) continue;

      findings.push({
        application: context.application,
        category: 'infrastructure',
        subject: file.path.split(/[\\/]/).pop()!,
        operation: file.changeType === 'added' ? 'added' : file.changeType === 'deleted' ? 'removed' : 'changed',
        repositoryPath: context.repositoryPath,
        filePath: file.path,
        evidence: `Infrastructure file ${file.changeType} in ${file.path}.`,
        confidence: 'medium',
      });
    }
    return findings;
  }
}
