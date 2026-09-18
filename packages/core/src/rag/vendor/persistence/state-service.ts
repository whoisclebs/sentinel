// Adapted from projects/yandecode/packages/core/src/persistence/state-service.ts:
// no separate runMigrations step — see open.ts.
import { openDatabase, type Database } from './open.js';

export class StateService {
  private queue: Promise<unknown> = Promise.resolve();

  private constructor(
    readonly db: Database,
    readonly file: string,
  ) {}

  static open(file: string): StateService {
    return new StateService(openDatabase(file), file);
  }

  read<T>(fn: (db: Database) => T): T {
    return fn(this.db);
  }

  write<T>(fn: (db: Database) => T): Promise<T> {
    const run = (): T => this.db.transaction(() => fn(this.db))();
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  close(): void {
    this.db.close();
  }
}
