import type { DiffFile, DiffHunk, DiffLine } from '../domain/repository.js';

const FILE_HEADER_RE = /^diff --git a\/(.+) b\/(.+)$/;
const HUNK_HEADER_RE = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parseUnifiedDiff(diffText: string): DiffFile[] {
  const lines = diffText.split('\n');
  const files: DiffFile[] = [];
  let current: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let cursor = 0;

  const closeHunk = (): void => {
    if (current && currentHunk) current.hunks.push(currentHunk);
    currentHunk = null;
  };
  const closeFile = (): void => {
    closeHunk();
    if (current) files.push(current);
  };

  for (const line of lines) {
    const fileMatch = FILE_HEADER_RE.exec(line);
    if (fileMatch) {
      closeFile();
      current = { path: fileMatch[2]!, changeType: 'modified', hunks: [] };
      continue;
    }
    if (!current) continue;
    if (line.startsWith('new file mode')) current.changeType = 'added';
    else if (line.startsWith('deleted file mode')) current.changeType = 'deleted';
    else if (line.startsWith('rename to ')) current.changeType = 'renamed';
    if (line.startsWith('+++') || line.startsWith('---')) continue;

    const hunkMatch = HUNK_HEADER_RE.exec(line);
    if (hunkMatch) {
      closeHunk();
      cursor = Number(hunkMatch[1]);
      currentHunk = { startLine: cursor, lines: [] };
      continue;
    }
    if (!currentHunk) continue;

    const { line: diffLine, nextCursor } = toDiffLine(line, cursor);
    currentHunk.lines.push(diffLine);
    cursor = nextCursor;
  }
  closeFile();
  return files;
}

function toDiffLine(rawLine: string, cursor: number): { line: DiffLine; nextCursor: number } {
  if (rawLine.startsWith('+')) {
    return {
      line: { type: 'added', content: rawLine.slice(1), newLineNumber: cursor },
      nextCursor: cursor + 1,
    };
  }
  if (rawLine.startsWith('-')) {
    return {
      line: { type: 'removed', content: rawLine.slice(1), newLineNumber: null },
      nextCursor: cursor,
    };
  }
  return {
    line: { type: 'context', content: rawLine.slice(1), newLineNumber: cursor },
    nextCursor: cursor + 1,
  };
}

export function addedLines(file: DiffFile): DiffLine[] {
  return file.hunks.flatMap((h) => h.lines.filter((l) => l.type === 'added'));
}

export function removedLines(file: DiffFile): DiffLine[] {
  return file.hunks.flatMap((h) => h.lines.filter((l) => l.type === 'removed'));
}
