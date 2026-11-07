import {
  buildIndex,
  searchCollection,
  type AnnotationRecord,
  type Index,
  type SearchOptions,
  type SearchResponse
} from "@/lib/ir-engine";

// Static version (GitHub Pages): there is no server, so the annotation data is
// downloaded once and the same retrieval engine runs in the browser.
export const isStaticSite = process.env.NEXT_PUBLIC_STATIC_SITE === "true";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

let indexPromise: Promise<Index> | null = null;

function loadIndex(): Promise<Index> {
  indexPromise ??= fetch(`${basePath}/data/iaprtc12-eng.json`)
    .then((response) => {
      if (!response.ok) throw new Error("Could not load the annotation data.");
      return response.json() as Promise<AnnotationRecord[]>;
    })
    .then(buildIndex)
    .catch((error) => {
      indexPromise = null;
      throw error;
    });

  return indexPromise;
}

export async function searchInBrowser(options: SearchOptions): Promise<SearchResponse> {
  const index = await loadIndex();
  return searchCollection(options, index);
}
