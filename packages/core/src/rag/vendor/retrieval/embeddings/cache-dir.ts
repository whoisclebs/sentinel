// Adapted from projects/yandecode/packages/core/src/workspace/paths.ts (userCacheDir):
// renamed to SENTINEL's own env var and cache directory name.
import { join } from 'node:path';
import { homedir } from 'node:os';

export function sentinelCacheDir(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home: string = homedir(),
): string {
  if (env.SENTINEL_CACHE_DIR) return env.SENTINEL_CACHE_DIR;
  if (platform === 'win32' && env.LOCALAPPDATA) return join(env.LOCALAPPDATA, 'sentinel');
  if (env.XDG_CACHE_HOME) return join(env.XDG_CACHE_HOME, 'sentinel');
  if (platform === 'darwin') return join(home, 'Library', 'Caches', 'sentinel');
  return join(home, '.cache', 'sentinel');
}
