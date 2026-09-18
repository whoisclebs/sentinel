import type { FindingCategory, Finding } from '../domain/finding.js';
import type { DiffFile } from '../domain/repository.js';

export interface DetectorContext {
  application: string;
  repositoryPath: string;
}

export interface ChangeDetector {
  readonly category: FindingCategory;
  detect(diffFiles: DiffFile[], context: DetectorContext): Finding[];
}
