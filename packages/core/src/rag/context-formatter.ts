import type { RagHit } from '../domain/rag.js';
import type { RagHitLike } from '../domain/judgement.js';

export function toRagHitLike(hits: RagHit[]): RagHitLike[] {
  return hits.map((h) => ({
    path: h.path,
    startLine: h.startLine,
    endLine: h.endLine,
    content: h.content,
    score: h.score,
    source: h.metadata.source,
  }));
}

export function formatContextSnippet(hit: RagHitLike): string {
  const oneLine = hit.content.trim().replace(/\s+/g, ' ').slice(0, 200);
  return `${hit.path}:${hit.startLine}-${hit.endLine} — ${oneLine}`;
}
