// Access to the store wiki that the AI concierge is grounded on.
//
// The content is baked into wiki.generated.ts at build time by scripts/generate-wiki.ts.
// This module only wraps it, so nothing else has to know whether the wiki came from disk,
// a database or a build artefact.
//
// The import is deliberately dynamic: the generated file is gitignored, so on a fresh clone
// before `npm run prebuild` it simply does not exist. A static import would break the whole
// bundle; this way the concierge degrades to WIKI_NOT_LOADED and everything else still runs.

export interface Wiki {
  content: string;
  version: string;
  fileCount: number;
  files: readonly string[];
  builtAt: string;
}

let cached: Wiki | null | undefined;

export async function loadWiki(): Promise<Wiki | null> {
  if (cached !== undefined) return cached;
  try {
    const mod = await import('./wiki.generated.js');
    cached = {
      content: mod.WIKI_CONTENT,
      version: mod.WIKI_VERSION,
      fileCount: mod.WIKI_FILE_COUNT,
      files: mod.WIKI_FILES,
      builtAt: mod.WIKI_BUILT_AT,
    };
  } catch (err) {
    console.error('[kyros] wiki.generated.ts missing -- run `npm run prebuild`', err);
    cached = null;
  }
  return cached;
}
