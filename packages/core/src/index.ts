export const SENTINEL_CORE_VERSION = '0.1.0';

export * from './domain/finding.js';
export * from './domain/repository.js';
export * from './domain/release-document.js';
export * from './domain/rag.js';
export * from './domain/judgement.js';
export * from './domain/report.js';
export * from './infrastructure/git-client.js';
export * from './infrastructure/diff-parser.js';
export * from './infrastructure/repository-discovery.js';
export * from './infrastructure/release-script-reader.js';
export * from './infrastructure/release-document-reader.js';
export * from './services/semver-tag-matcher.js';
export * from './services/release-base-resolver.js';
export * from './services/repository-analyzer.js';
export * from './detectors/types.js';
