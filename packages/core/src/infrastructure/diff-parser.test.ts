import { describe, expect, it } from 'vitest';
import { addedLines, parseUnifiedDiff, removedLines } from './diff-parser.js';

const SAMPLE_DIFF = `diff --git a/src/app.yml b/src/app.yml
index 1111111..2222222 100644
--- a/src/app.yml
+++ b/src/app.yml
@@ -1,3 +1,4 @@
 existing: true
-OLD_KEY: value
 OLD_KEY: value
+NEW_KEY: value
 trailing: true
diff --git a/src/new-file.sql b/src/new-file.sql
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/new-file.sql
@@ -0,0 +1,1 @@
+CREATE TABLE receipts (id INT);
`;

describe('parseUnifiedDiff', () => {
  it('parses a modified file with added and removed lines and correct new-file line numbers', () => {
    const files = parseUnifiedDiff(SAMPLE_DIFF);
    const appYml = files.find((f) => f.path === 'src/app.yml')!;

    expect(appYml.changeType).toBe('modified');
    expect(addedLines(appYml).map((l) => l.content)).toEqual(['NEW_KEY: value']);
    expect(addedLines(appYml)[0]!.newLineNumber).toBe(3);
    expect(removedLines(appYml).map((l) => l.content)).toEqual(['OLD_KEY: value']);
  });

  it('parses a newly added file', () => {
    const files = parseUnifiedDiff(SAMPLE_DIFF);
    const newFile = files.find((f) => f.path === 'src/new-file.sql')!;

    expect(newFile.changeType).toBe('added');
    expect(addedLines(newFile)).toHaveLength(1);
    expect(addedLines(newFile)[0]!.content).toBe('CREATE TABLE receipts (id INT);');
  });
});
