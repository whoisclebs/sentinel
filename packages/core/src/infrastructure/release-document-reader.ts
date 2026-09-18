import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ReleaseDocument, ReleaseDocumentBundle } from '../domain/release-document.js';
import { readReleaseScripts } from './release-script-reader.js';

async function readDocument(path: string): Promise<ReleaseDocument | null> {
  try {
    return { path, content: await readFile(path, 'utf8') };
  } catch {
    return null;
  }
}

export interface ReleaseDocumentIssue {
  severity: 'blocking' | 'inconclusive';
  message: string;
}

export interface ReleaseDocumentReadResult {
  bundle: ReleaseDocumentBundle;
  issues: ReleaseDocumentIssue[];
}

export async function readReleaseDocuments(
  releaseDocumentsRoot: string,
  release: string,
): Promise<ReleaseDocumentReadResult> {
  const releaseDir = join(releaseDocumentsRoot, release);
  const envVars = await readDocument(join(releaseDir, 'env-vars.md'));
  const instructions = await readDocument(join(releaseDir, 'instructions.md'));
  const scripts = await readReleaseScripts(join(releaseDir, 'scripts'), instructions?.content ?? null);

  const issues: ReleaseDocumentIssue[] = [];
  if (!envVars) issues.push({ severity: 'blocking', message: `env-vars.md is missing under ${releaseDir}` });
  if (!instructions) issues.push({ severity: 'blocking', message: `instructions.md is missing under ${releaseDir}` });

  for (const script of scripts) {
    if (!script.referencedByInstructions) {
      issues.push({
        severity: 'inconclusive',
        message: `Script ${script.relativePath} is not cited in instructions.md; it may not be scheduled for execution.`,
      });
    }
  }

  return { bundle: { release, envVars, instructions, scripts }, issues };
}
