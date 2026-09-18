import type { Finding } from '../domain/finding.js';
import type { RagHitLike } from '../domain/judgement.js';
import type { ReleaseDocumentBundle } from '../domain/release-document.js';

function normalize(text: string): string {
  return text.toLowerCase().replace(/[_\-.]/g, ' ');
}

function findCandidateLines(content: string, path: string, needle: string): RagHitLike[] {
  const normalizedNeedle = normalize(needle);
  if (normalizedNeedle.trim().length === 0) return [];
  return content
    .split('\n')
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => normalize(line).includes(normalizedNeedle))
    .map(({ line, lineNumber }) => ({
      path,
      startLine: lineNumber,
      endLine: lineNumber,
      content: line.trim(),
      score: 1,
      source: 'release_document' as const,
    }));
}

export function findDeterministicCandidates(finding: Finding, bundle: ReleaseDocumentBundle): RagHitLike[] {
  const candidates: RagHitLike[] = [];

  const searchDocument = (doc: { path: string; content: string } | null): void => {
    if (doc) candidates.push(...findCandidateLines(doc.content, doc.path, finding.subject));
  };
  const searchScriptsForApplication = (application: string): void => {
    for (const script of bundle.scripts) {
      if (script.application !== application) continue;
      candidates.push(...findCandidateLines(script.content, `scripts/${script.relativePath}`, finding.subject));
    }
  };

  if (finding.category === 'environment') {
    searchDocument(bundle.envVars);
  } else if (finding.category === 'database') {
    searchDocument(bundle.instructions);
    searchScriptsForApplication(finding.application);
  } else {
    searchDocument(bundle.instructions);
    searchScriptsForApplication(finding.application);
    searchDocument(bundle.envVars);
  }

  return candidates;
}
