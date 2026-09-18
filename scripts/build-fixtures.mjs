import { buildFixtureWorkspace } from '../packages/core/dist/test-support/build-fixture-workspace.js';
import { fileURLToPath } from 'node:url';
import { rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const target = join(root, '..', 'fixtures', 'workspace');

await rm(target, { recursive: true, force: true });
await buildFixtureWorkspace(target);
console.log(`Fixture workspace built at ${target}`);
