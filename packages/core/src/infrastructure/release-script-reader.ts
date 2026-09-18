import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ReleaseScript, ReleaseScriptKind } from '../domain/release-document.js';

const MONGO_RE = /\bdb\.[A-Za-z0-9_]+\.(insertMany|updateMany|find|aggregate|deleteMany)\b|^\s*use\s+\w+;?/m;
const SQL_RE = /\b(CREATE|ALTER|INSERT INTO|UPDATE|DELETE FROM)\b/i;

function classifyKind(relativePath: string, content: string): ReleaseScriptKind {
  if (MONGO_RE.test(content)) return 'mongo';
  if (relativePath.endsWith('.sql') || SQL_RE.test(content)) return 'sql';
  if (content.startsWith('#!')) return 'shell';
  return 'unknown';
}

export async function readReleaseScripts(
  scriptsDir: string,
  instructionsContent: string | null,
): Promise<ReleaseScript[]> {
  const scripts: ReleaseScript[] = [];
  let applications: string[];
  try {
    applications = (await readdir(scriptsDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return scripts;
  }

  for (const application of applications) {
    const appDir = join(scriptsDir, application);
    const files = await readdir(appDir, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile()) continue;
      const relativePath = `${application}/${file.name}`;
      const content = await readFile(join(appDir, file.name), 'utf8');
      scripts.push({
        application,
        relativePath,
        kind: classifyKind(relativePath, content),
        content,
        referencedByInstructions: instructionsContent
          ? instructionsContent.includes(`scripts/${relativePath}`)
          : false,
      });
    }
  }
  return scripts;
}
