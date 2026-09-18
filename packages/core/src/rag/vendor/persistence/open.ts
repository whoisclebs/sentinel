// Adapted from projects/yandecode/packages/core/src/persistence/open.ts:
// applies SCHEMA_SQL directly instead of a migrations table (SENTINEL always
// reindexes fully, so there is no need to version the schema across runs).
import BetterSqlite3 from 'better-sqlite3';
import { SCHEMA_SQL } from './schema.js';

export type Database = BetterSqlite3.Database;

export class PersistenceError extends Error {}

export function openDatabase(file: string): Database {
  const db = new BetterSqlite3(file);
  if (file !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  try {
    db.exec("CREATE VIRTUAL TABLE temp.__fts5_probe USING fts5(x); DROP TABLE temp.__fts5_probe;");
  } catch (cause) {
    db.close();
    throw new PersistenceError('SQLite build lacks FTS5 support', { cause: cause as Error });
  }
  db.exec(SCHEMA_SQL);
  return db;
}
