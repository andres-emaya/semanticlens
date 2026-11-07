// Builds SemanticLens as a static site (plain HTML in ./out) for GitHub Pages.
// The API route needs a server, so app/api is moved into a private folder
// (ignored by Next.js routing) during the build and restored afterwards.
// In this mode the retrieval engine runs in the browser on public/data/iaprtc12-eng.json.
import { existsSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";

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
