import fs from "node:fs";
import path from "node:path";

import {
  buildIndex,
  searchCollection,
  type AnnotationRecord,
  type Index,
  type SearchOptions,
  type SearchResponse
} from "@/lib/ir-engine";

// Server-side search used by the API route (npm run dev / npm start).
const PUBLIC_ROOT = path.join(process.cwd(), "public");
const DATA_FILE = path.join(PUBLIC_ROOT, "data", "iaprtc12-eng.json");

let cachedIndex: Index | null = null;

function getIndex(): Index {
  if (cachedIndex) return cachedIndex;

  if (!fs.existsSync(DATA_FILE)) {
    throw new Error("Annotation data not found. Run `npm run build:data` first.");
  }

  const records = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as AnnotationRecord[];
  cachedIndex = buildIndex(records);
  return cachedIndex;
}

// Uses the real dataset image when it exists in public/iaprtc12/images.
function hasDatasetImage(imageUrl: string): boolean {
  return fs.existsSync(path.join(PUBLIC_ROOT, ...imageUrl.replace(/^\//, "").split("/")));
}

export function searchOnServer(options: SearchOptions): SearchResponse {
  return searchCollection(options, getIndex(), hasDatasetImage);
}
