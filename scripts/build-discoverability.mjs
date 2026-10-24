/** Write crawlable Siteline files from assets/site-catalog.mjs. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { STATIC_FILES, renderIndexJsonLdScript, renderIndexSummary, replaceMarked } from "../assets/discoverability-pages.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

for (const [rel, render] of Object.entries(STATIC_FILES)) {
  const dest = join(root, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, render());
}

const indexPath = join(root, "index.html");
let index = readFileSync(indexPath, "utf8");
index = replaceMarked(index, "siteline:jsonld", renderIndexJsonLdScript());
index = replaceMarked(index, "siteline:summary", renderIndexSummary());
writeFileSync(indexPath, index);
