import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AuditReport, AuditedFinding } from '../domain/report.js';

export async function writeReport(
  artifactsRoot: string,
  report: AuditReport,
): Promise<{ jsonPath: string; markdownPath: string }> {
  const dir = join(artifactsRoot, report.release);
  await mkdir(dir, { recursive: true });
  const jsonPath = join(dir, 'report.json');
  const markdownPath = join(dir, 'report.md');
  await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  await writeFile(markdownPath, renderMarkdown(report), 'utf8');
  return { jsonPath, markdownPath };
}

function groupByApplication(items: AuditedFinding[]): Array<{ application: string; items: AuditedFinding[] }> {
  const byApp = new Map<string, AuditedFinding[]>();
  for (const item of items) {
    const list = byApp.get(item.finding.application) ?? [];
    list.push(item);
    byApp.set(item.finding.application, list);
  }
  return [...byApp.entries()].map(([application, entries]) => ({ application, items: entries }));
}

function renderFinding(item: AuditedFinding): string[] {
  const { finding, judgement, retrievedContext } = item;
  const location = `${finding.filePath}${finding.line ? `:${finding.line}` : ''}`;
  const lines = [
    `- [${finding.category}] \`${finding.subject}\` ${finding.operation} in \`${location}\`.`,
    `  Verdict: **${judgement.verdict}** (confidence: ${judgement.confidence}).`,
    `  Rationale: ${judgement.rationale}`,
  ];
  if (judgement.citedEvidence.length > 0) {
    lines.push('  Cited evidence:');
    for (const cite of judgement.citedEvidence) {
      lines.push(`  - [${cite.source}] ${cite.path}:${cite.startLine}-${cite.endLine} — ${cite.explanation}`);
    }
  }
  if (retrievedContext.length > 0) {
    lines.push('  Retrieved context:');
    for (const hit of retrievedContext.slice(0, 3)) {
      lines.push(`  - ${hit.path}:${hit.startLine}-${hit.endLine} (${hit.source})`);
    }
  }
  if (judgement.suggestedReleaseDocumentText) {
    lines.push(`  Suggested text for review: ${judgement.suggestedReleaseDocumentText}`);
  }
  return lines;
}

function renderSection(title: string, items: AuditedFinding[]): string[] {
  if (items.length === 0) return [];
  const lines = [`## ${title}`, ''];
  for (const group of groupByApplication(items)) {
    lines.push(`### ${group.application}`);
    for (const item of group.items) lines.push(...renderFinding(item));
    lines.push('');
  }
  return lines;
}

function renderMarkdown(report: AuditReport): string {
  const documented = report.findings.filter((f) => f.judgement.verdict === 'documented');
  const missing = report.findings.filter((f) => f.judgement.verdict === 'missing');
  const inconclusive = report.findings.filter((f) => f.judgement.verdict === 'inconclusive');

  const lines: string[] = [
    `# SENTINEL — ${report.release} Audit`,
    '',
    `Repositories analyzed: ${report.repositoriesAnalyzed.length}`,
    `Repositories with new commits: ${report.repositoriesWithNewCommits.length}`,
    `Operational changes detected: ${report.findings.length}`,
    `Documented: ${documented.length}`,
    `Pending: ${missing.length}`,
    `Inconclusive: ${inconclusive.length}`,
    '',
  ];

  if (report.releaseDocumentIssues.length > 0) {
    lines.push('## Release document issues', '');
    for (const issue of report.releaseDocumentIssues) lines.push(`- ${issue}`);
    lines.push('');
  }

  lines.push(...renderSection('Pending', missing));
  lines.push(...renderSection('Inconclusive', inconclusive));
  lines.push(...renderSection('Documented', documented));

  return lines.join('\n');
}
