import type { Finding } from '../domain/finding.js';

export function buildRagQuery(finding: Finding): string {
  return `${finding.subject} ${finding.application} ${finding.category} ${finding.operation}`.trim();
}
