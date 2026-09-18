export type ReleaseScriptKind = 'sql' | 'mongo' | 'shell' | 'unknown';

export interface ReleaseDocument {
  path: string;
  content: string;
}

export interface ReleaseScript {
  application: string;
  relativePath: string;
  kind: ReleaseScriptKind;
  content: string;
  referencedByInstructions: boolean;
}

export interface ReleaseDocumentBundle {
  release: string;
  envVars: ReleaseDocument | null;
  instructions: ReleaseDocument | null;
  scripts: ReleaseScript[];
}
