// Compiles the CLEF IAPR TC-12 English annotations (*.eng) into one JSON file
// that both the server API and the static (GitHub Pages) version load.
//
// Usage: npm run build:data
// Input:  data/iaprtc12/annotations/**/*.eng  (from the official IAPR TC-12 archive)
// Output: public/data/iaprtc12-eng.json
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const inputDir = path.join("data", "iaprtc12", "annotations");
const outputFile = path.join("public", "data", "iaprtc12-eng.json");

if (!existsSync(inputDir)) {
  console.error(`Annotations not found in ${inputDir}. Download the IAPR TC-12 benchmark first.`);
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

// Most files are ASCII/UTF-8, but some are ISO-8859-1 (accented place names).
function decode(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("latin1").decode(buffer);
  }
}

function sortKey(file) {
  const [folder, name] = file.split(path.sep).slice(-2);
  return Number(folder) * 1e6 + Number.parseInt(name, 10);
}

const files = walk(inputDir)
  .filter((file) => file.endsWith(".eng"))
  .sort((a, b) => sortKey(a) - sortKey(b));

const records = files.map((file) => {
  const source = decode(readFileSync(file));
  const read = (tag) =>
    source.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"))?.[1].replace(/\s+/g, " ").trim() ?? "";

  return {
    id: read("DOCNO") || path.relative(inputDir, file).split(path.sep).join("/"),
    title: read("TITLE"),
    description: read("DESCRIPTION"),
    notes: read("NOTES"),
    location: read("LOCATION"),
    date: read("DATE"),
    image: read("IMAGE")
  };
});

mkdirSync(path.dirname(outputFile), { recursive: true });
writeFileSync(outputFile, JSON.stringify(records));
console.log(`Wrote ${records.length} annotations to ${outputFile}`);
