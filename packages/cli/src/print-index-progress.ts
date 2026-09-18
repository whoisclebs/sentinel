export function printIndexProgress(event: { root: string; index: number; total: number; relPath: string }): void {
  console.log(`[sentinel] Indexing ${event.root} — ${event.relPath} (${event.index}/${event.total})`);
}
