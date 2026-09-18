// Ported from projects/yandecode/packages/core/src/ids.ts
import { monotonicFactory } from 'ulid';

const ulid = monotonicFactory();

export function newId(): string {
  return ulid();
}

export function nowIso(): string {
  return new Date().toISOString();
}
