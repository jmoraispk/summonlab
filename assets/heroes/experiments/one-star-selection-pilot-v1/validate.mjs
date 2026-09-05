import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
if (manifest.schemaVersion !== "hero-one-star-selection-pilot-v1") throw new Error("Unexpected schema");
if (manifest.targets.length !== 12) throw new Error("Expected twelve candidates");
if (manifest.selectionFunnel.minimumTotalImagesIncludingRejectedBases !== 800) throw new Error("Funnel arithmetic drift");

const review = await readFile(join(root, manifest.reviewPage), "utf8");
for (const target of manifest.targets) {
  const bytes = await readFile(join(root, target.candidate));
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== target.sha256) throw new Error(`Hash mismatch for ${target.targetId}`);
  if (!review.includes(`../${target.candidate}`)) throw new Error(`Review omits ${target.targetId}`);
}
for (const control of ["keep", "pass", "undecided", "download", "reset"]) {
  if (!review.includes(control)) throw new Error(`Review control missing: ${control}`);
}
console.log("one-star-selection-pilot-v1 validated: 12 candidates with persistent shortlist controls");
