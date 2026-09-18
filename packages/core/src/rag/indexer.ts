import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { RagSource } from '../domain/rag.js';
import { ENV_FILE_RE } from '../detectors/environment-detector.js';
import { redactConfigValues } from '../infrastructure/redact-config-values.js';
import { RepositoryDiscovery } from '../infrastructure/repository-discovery.js';
import { ArcticEmbedXsProvider } from './vendor/retrieval/embeddings/arctic.js';
import { sentinelCacheDir } from './vendor/retrieval/embeddings/cache-dir.js';
import { HashEmbeddingProvider } from './vendor/retrieval/embeddings/hash-provider.js';
import type { EmbeddingProvider } from './vendor/retrieval/embeddings/provider.js';
import { createDefaultChunker } from './vendor/retrieval/chunking/router.js';
import { identifiersOf } from './vendor/retrieval/lexical/identifiers.js';
import { type ChunkInput, DocumentRepository } from './vendor/persistence/documents-repository.js';
import { IndexRepository } from './vendor/persistence/index-meta-repository.js';
import { StateService } from './vendor/persistence/state-service.js';
import { scanRepository, type ScannedFile } from './vendor/retrieval/scanner/scanner.js';
import { generationFileName } from './vendor/retrieval/vector/generations.js';
import { USearchVectorIndex } from './vendor/retrieval/vector/usearch-index.js';

const EMBED_BATCH = 32;

export function resolveEmbeddingProvider(): EmbeddingProvider {
  if (process.env.SENTINEL_EMBEDDINGS === 'hash') return new HashEmbeddingProvider();
  return new ArcticEmbedXsProvider({ cacheDir: sentinelCacheDir() });
}

interface SourceRoot {
  path: string;
  repository: string;
  source: RagSource;
  applicationFor: (relPath: string) => string | null;
}

export interface IndexReport {
  filesIndexed: number;
  chunksIndexed: number;
  indexFile: string;
}

export class Indexer {
  private readonly stateFile: string;
  private readonly indexesDir: string;

  constructor(
    private readonly workspacePath: string,
    private readonly provider: EmbeddingProvider,
  ) {
    this.stateFile = join(workspacePath, '.sentinel', 'state.db');
    this.indexesDir = join(workspacePath, '.sentinel', 'indexes');
  }

  private async sourceRoots(release: string | null): Promise<SourceRoot[]> {
    const roots: SourceRoot[] = [];
    const discovery = new RepositoryDiscovery(this.workspacePath);
    for (const repo of await discovery.discover()) {
      roots.push({
        path: repo.repositoryPath,
        repository: repo.repositoryPath,
        source: 'code',
        applicationFor: () => repo.application,
      });
    }
    if (release) {
      const releaseDir = join(this.workspacePath, 'release-documents', release);
      roots.push({
        path: releaseDir,
        repository: releaseDir,
        source: 'release_document',
        applicationFor: (relPath) => /^scripts\/([^/]+)\//.exec(relPath)?.[1] ?? null,
      });
    }
    roots.push({
      path: join(this.workspacePath, 'knowledge-base'),
      repository: join(this.workspacePath, 'knowledge-base'),
      source: 'knowledge_base',
      applicationFor: () => null,
    });
    return roots;
  }

  async run(
    release: string | null = null,
    onFileIndexed?: (event: { root: string; index: number; total: number; relPath: string }) => void,
  ): Promise<IndexReport> {
    mkdirSync(dirname(this.stateFile), { recursive: true });
    mkdirSync(this.indexesDir, { recursive: true });

    const state = StateService.open(this.stateFile);
    const documents = new DocumentRepository(state);
    const indexRepo = new IndexRepository(state);
    const chunker = createDefaultChunker(this.provider);
    const indexFile = join(this.indexesDir, generationFileName('repository', 1));
    const index = new USearchVectorIndex({ dimensions: this.provider.dimensions, file: indexFile });

    let filesIndexed = 0;
    let chunksIndexed = 0;

    for (const root of await this.sourceRoots(release)) {
      let scanned: ScannedFile[];
      try {
        scanned = await scanRepository(root.path);
      } catch {
        continue;
      }
      const rootLabel = relative(this.workspacePath, root.path);
      const total = scanned.length;
      for (let fileIndex = 0; fileIndex < scanned.length; fileIndex += 1) {
        const file = scanned[fileIndex]!;
        const rawContent = readFileSync(file.absPath, 'utf8');
        const content = ENV_FILE_RE.test(file.relPath) ? redactConfigValues(rawContent) : rawContent;
        const chunks = await chunker.chunk(file.relPath, content, file.language);
        if (chunks.length > 0) {
          const headers = chunks.map((c) => `${file.relPath} ${c.symbol ?? ''}\n${c.content}`);
          const embeddings: Float32Array[] = [];
          for (let i = 0; i < headers.length; i += EMBED_BATCH) {
            embeddings.push(...(await this.provider.embedDocuments(headers.slice(i, i + EMBED_BATCH))));
          }

          const chunkInputs: ChunkInput[] = [];
          for (let i = 0; i < chunks.length; i += 1) {
            const c = chunks[i]!;
            chunkInputs.push({
              kind: c.kind,
              symbol: c.symbol,
              identifiers: identifiersOf(c.content),
              startLine: c.startLine,
              endLine: c.endLine,
              content: c.content,
              contentHash: createHash('sha256').update(c.content).digest('hex'),
              tokenCount: await this.provider.countTokens(c.content),
              embedding: embeddings[i] ?? null,
            });
          }

          const { inserted } = await documents.replaceDocument(
            {
              path: `${rootLabel}/${file.relPath}`,
              repository: root.repository,
              application: root.applicationFor(file.relPath),
              source: root.source,
              language: file.language,
              sizeBytes: file.sizeBytes,
              contentHash: file.contentHash,
              gitCommit: null,
              indexGeneration: 1,
            },
            chunkInputs,
          );
          for (let i = 0; i < inserted.length; i += 1) {
            const embedding = embeddings[i];
            if (embedding) index.add(inserted[i]!.vectorId, embedding);
          }
          filesIndexed += 1;
          chunksIndexed += chunks.length;
        }
        onFileIndexed?.({ root: rootLabel, index: fileIndex + 1, total, relPath: file.relPath });
      }
    }

    index.save();
    await indexRepo.setMeta({
      name: 'repository',
      generation: 1,
      dimensions: this.provider.dimensions,
      modelId: this.provider.modelId,
      vectorCount: index.stats().size,
      builtAt: new Date().toISOString(),
      filePath: indexFile,
    });
    state.close();
    return { filesIndexed, chunksIndexed, indexFile };
  }
}
