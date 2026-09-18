import { join } from 'node:path';
import type { RagHit, RagSource } from '../domain/rag.js';
import { DocumentRepository } from './vendor/persistence/documents-repository.js';
import { StateService } from './vendor/persistence/state-service.js';
import type { EmbeddingProvider } from './vendor/retrieval/embeddings/provider.js';
import { DEFAULT_RETRIEVER_CONSTANTS, HybridRetriever } from './vendor/retrieval/service/hybrid-retriever.js';
import { USearchVectorIndex } from './vendor/retrieval/vector/usearch-index.js';

export interface RetrieverFilter {
  application?: string;
  source?: RagSource;
}

export class Retriever {
  private readonly state: StateService;
  private readonly documents: DocumentRepository;
  private readonly hybrid: HybridRetriever;

  constructor(workspacePath: string, provider: EmbeddingProvider) {
    this.state = StateService.open(join(workspacePath, '.sentinel', 'state.db'));
    this.documents = new DocumentRepository(this.state);
    const index = new USearchVectorIndex({
      dimensions: provider.dimensions,
      file: join(workspacePath, '.sentinel', 'indexes', 'repository-00001.usearch'),
    });
    index.load();
    this.hybrid = new HybridRetriever({
      documents: this.documents,
      provider,
      index,
      constants: { ...DEFAULT_RETRIEVER_CONSTANTS, maxResults: 100 },
    });
  }

  async search(query: string, limit: number, filter: RetrieverFilter = {}): Promise<RagHit[]> {
    const needsFilter = Boolean(filter.application || filter.source);
    const rawHits = await this.hybrid.search(query, { limit: needsFilter ? Math.max(limit * 4, 20) : limit });

    const withMetadata = rawHits
      .map((hit): RagHit | null => {
        const meta = this.documents.getDocumentMetaByPath(hit.path);
        if (!meta) return null;
        if (filter.application && meta.application !== filter.application) return null;
        if (filter.source && meta.source !== filter.source) return null;
        return {
          path: hit.path,
          startLine: hit.startLine,
          endLine: hit.endLine,
          symbol: hit.symbol,
          score: hit.score,
          content: hit.content,
          metadata: {
            repository: meta.repository,
            application: meta.application ?? undefined,
            source: meta.source,
            path: hit.path,
            startLine: hit.startLine,
            endLine: hit.endLine,
            gitCommit: meta.gitCommit ?? undefined,
            indexedAt: new Date().toISOString(),
          },
        };
      })
      .filter((h): h is RagHit => h !== null);

    return withMetadata.slice(0, limit);
  }

  close(): void {
    this.state.close();
  }
}
