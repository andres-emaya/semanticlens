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

type SearchData = { index: Index; images: Set<string> };

let dataPromise: Promise<SearchData> | null = null;

async function fetchJson<T>(file: string, fallback?: T): Promise<T> {
  const response = await fetch(`${basePath}/data/${file}`);
  if (!response.ok) {
    if (fallback !== undefined) return fallback;
    throw new Error("Could not load the annotation data.");
  }
  return response.json() as Promise<T>;
}

function loadData(): Promise<SearchData> {
  dataPromise ??= Promise.all([
    fetchJson<AnnotationRecord[]>("iaprtc12-eng.json"),
    // List of dataset images published with the site (built by scripts/build-static.mjs).
    fetchJson<string[]>("images.json", [])
  ])
    .then(([records, images]) => ({ index: buildIndex(records), images: new Set(images) }))
    .catch((error) => {
      dataPromise = null;
      throw error;
    });

  return dataPromise;
}

export async function searchInBrowser(options: SearchOptions): Promise<SearchResponse> {
  const { index, images } = await loadData();
  const hasDatasetImage = (imageUrl: string) => images.has(imageUrl.replace(/^\/iaprtc12\//, ""));
  const result = searchCollection(options, index, hasDatasetImage);

  return {
    ...result,
    hits: result.hits.map((hit) =>
      hit.imageSource === "dataset" ? { ...hit, image: `${basePath}${hit.image}` } : hit
    )
  };
}
