import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));

if (manifest.schemaVersion !== "hero-star-progression-study-v1") {
  throw new Error("Unexpected manifest schema");
}
if (manifest.targets.length !== 4 || manifest.rankOrder.join(",") !== "1,3,5,7") {
  throw new Error("Expected four identities and the 1/3/5/7 rank sequence");
}

for (const target of manifest.targets) {
  const bytes = await readFile(join(root, target.candidate));
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== target.sha256) throw new Error(`Hash mismatch for ${target.targetId}`);
}

const review = await readFile(join(root, manifest.reviewPage), "utf8");
for (const target of manifest.targets) {
  const relative = `../${target.candidate}`;
  if (!review.includes(relative)) throw new Error(`Review page omits ${target.targetId}`);
}

console.log("ultra-realistic-star-progression-v1 validated: 4 candidate sheets, 16 rank depictions");
