import { execa } from 'execa';
import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

async function git(cwd: string, args: string[]): Promise<void> {
  await execa('git', args, { cwd });
}

async function initRepo(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await git(dir, ['init', '-q']);
  await git(dir, ['config', 'user.email', 'sentinel-fixtures@example.com']);
  await git(dir, ['config', 'user.name', 'SENTINEL Fixtures']);
}

async function commitFile(repoDir: string, relPath: string, content: string, message: string): Promise<void> {
  const absPath = join(repoDir, relPath);
  await mkdir(dirname(absPath), { recursive: true });
  await writeFile(absPath, content);
  await git(repoDir, ['add', relPath]);
  await git(repoDir, ['commit', '-q', '-m', message]);
}

async function buildPaymentApi(workspace: string): Promise<void> {
  const dir = join(workspace, 'services', 'payment-api');
  await initRepo(dir);
  await commitFile(dir, 'src/main/resources/application.yml', 'existing: true\n', 'initial commit');
  await git(dir, ['tag', 'v1.0.0']);
  await commitFile(
    dir,
    'src/main/resources/application.yml',
    'existing: true\nRECEIPT_BUCKET: receipts-prod-bucket\n',
    'add RECEIPT_BUCKET environment variable',
  );
  await commitFile(
    dir,
    'src/main/resources/db/migration/V245__add_receipt_status.sql',
    'ALTER TABLE receipts ADD COLUMN status VARCHAR(20);\n',
    'add receipt status migration',
  );
}

async function buildAdminWeb(workspace: string): Promise<void> {
  const dir = join(workspace, 'webapps', 'admin-web');
  await initRepo(dir);
  await commitFile(
    dir,
    'src/environments/environment.prod.ts',
    "export const environment = { apiUrl: 'https://api.old.example.com' };\n",
    'initial commit',
  );
  await git(dir, ['tag', 'v1.0.0']);
  await commitFile(
    dir,
    'src/environments/environment.prod.ts',
    "export const environment = { apiUrl: 'https://api.new.example.com' };\n",
    'point admin-web at the new API host',
  );
}

async function buildTransactionApi(workspace: string): Promise<void> {
  const dir = join(workspace, 'services', 'transaction-api');
  await initRepo(dir);
  await commitFile(dir, 'README.md', '# transaction-api\n', 'initial commit');
  await git(dir, ['tag', 'v1.0.0']);
}

async function buildLegacyBilling(workspace: string): Promise<void> {
  const dir = join(workspace, 'services', 'legacy-billing');
  await initRepo(dir);
  await commitFile(dir, 'README.md', '# legacy-billing\n', 'initial commit');
  await git(dir, ['tag', 'v1.0.0']);
  await commitFile(dir, 'README.md', '# legacy-billing\n\nv2 line.\n', 'v2 feature work');
  await git(dir, ['tag', 'v2.0.0']);
  await git(dir, ['checkout', '-q', '-b', 'patch/1.0', 'v1.0.0']);
  await commitFile(dir, 'application.yml', 'existing: true\nBACKPORT_FLAG: enabled\n', 'backport fix for the 1.0 line');
}

async function buildReleaseDocuments(workspace: string): Promise<void> {
  const releaseDir = join(workspace, 'release-documents', 'R2026.12');
  await mkdir(join(releaseDir, 'scripts', 'payment-api'), { recursive: true });

  await writeFile(
    join(releaseDir, 'env-vars.md'),
    '# Environment variables — R2026.12\n\nNo new environment variables are introduced by this release.\n',
  );

  await writeFile(
    join(releaseDir, 'instructions.md'),
    [
      '# Release instructions — R2026.12',
      '',
      '1. payment-api: run `scripts/payment-api/001-add-receipt-status.sql` (adds the receipt status column) before deploying the new version.',
      '2. admin-web: minor configuration adjustments.',
      '',
    ].join('\n'),
  );

  await writeFile(
    join(releaseDir, 'scripts', 'payment-api', '001-add-receipt-status.sql'),
    'ALTER TABLE receipts ADD COLUMN status VARCHAR(20);\n',
  );
}

export async function buildFixtureWorkspace(workspacePath: string): Promise<void> {
  await mkdir(workspacePath, { recursive: true });
  await buildPaymentApi(workspacePath);
  await buildAdminWeb(workspacePath);
  await buildTransactionApi(workspacePath);
  await buildLegacyBilling(workspacePath);
  await buildReleaseDocuments(workspacePath);
}
