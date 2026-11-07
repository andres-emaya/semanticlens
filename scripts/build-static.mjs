// Builds SemanticLens as a static site (plain HTML in ./out) for GitHub Pages.
// The API route needs a server, so app/api is moved into a private folder
// (ignored by Next.js routing) during the build and restored afterwards.
// In this mode the retrieval engine runs in the browser on public/data/iaprtc12-eng.json.
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

// List the dataset images that exist in public/iaprtc12/images, so the browser
// knows when to show the real image instead of the labeled fallback.
const imagesRoot = path.join("public", "iaprtc12");
const imageListFile = path.join("public", "data", "images.json");

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const images = walk(path.join(imagesRoot, "images"))
  .filter((file) => /\.jpe?g$/i.test(file))
  .map((file) => path.relative(imagesRoot, file).split(path.sep).join("/"));

mkdirSync(path.dirname(imageListFile), { recursive: true });
writeFileSync(imageListFile, JSON.stringify(images));
console.log(`Found ${images.length} dataset images`);

const apiDir = "app/api";
const hiddenDir = "app/_api";

if (existsSync(apiDir)) {
  renameSync(apiDir, hiddenDir);
}

let status = 1;

try {
  const result = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, NEXT_PUBLIC_STATIC_SITE: "true" }
  });
  status = result.status ?? 1;
} finally {
  if (existsSync(hiddenDir)) {
    renameSync(hiddenDir, apiDir);
  }
}

process.exit(status);
