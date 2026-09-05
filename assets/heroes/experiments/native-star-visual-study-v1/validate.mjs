import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(experimentRoot, "../../../..");
const manifest = JSON.parse(await readFile(resolve(experimentRoot, "manifest.json"), "utf8"));
const prompts = JSON.parse(
  await readFile(resolve(experimentRoot, "provenance/prompts.json"), "utf8")
);
const generation = JSON.parse(
  await readFile(resolve(experimentRoot, "provenance/generation-record.json"), "utf8")
);

const fail = (message) => {
  throw new Error(message);
};
const hash = (value) => createHash("sha256").update(value).digest("hex");
const targetById = new Map(manifest.targets.map((target) => [target.targetId, target]));
const promptById = new Map(prompts.records.map((record) => [record.targetId, record]));
const candidateById = new Map(
  generation.candidates.map((candidate) => [candidate.targetId, candidate])
);

if (manifest.schemaVersion !== "hero-native-star-visual-study-v1") fail("manifest schema drift");
if (manifest.status !== "candidate-production") fail("manifest status drift");
if (generation.productionStatus !== "candidate-only") fail("candidate status drift");
if (generation.runtimeCatalogMutation !== false) fail("runtime catalog mutation must remain false");
if (manifest.targets.length !== 12) fail("expected exactly twelve targets");
if (targetById.size !== 12 || promptById.size !== 12 || candidateById.size !== 12) {
  fail("target, prompt, or candidate IDs are duplicated or incomplete");
}

const tierBands = new Map([
  [1, [5, 15]],
  [3, [25, 35]],
  [5, [45, 55]]
]);
const aptitudeCategories = new Set([
  "attribute",
  "family",
  "learning-mode",
  "variety",
  "affinity"
]);

for (const stars of [1, 3, 5]) {
  const cohort = manifest.targets.filter((target) => target.nativeStars === stars);
  if (cohort.length !== 4) fail(`expected four native ${stars}-star targets`);
}

for (const target of manifest.targets) {
  if (target.currentStars !== target.nativeStars) fail(`${target.targetId}: current/native drift`);
  if (target.affinityState !== "unaligned") fail(`${target.targetId}: affinity confounds study`);
  const band = tierBands.get(target.nativeStars);
  if (!band) fail(`${target.targetId}: unsupported tier`);
  const total = Object.values(target.attributes).reduce((sum, value) => sum + value, 0);
  if (total < band[0] || total > band[1]) fail(`${target.targetId}: attribute total ${total}`);
  if (target.aptitudes.length !== target.nativeStars) {
    fail(`${target.targetId}: expected ${target.nativeStars} aptitudes`);
  }
  for (const aptitude of target.aptitudes) {
    if (!aptitudeCategories.has(aptitude.category)) {
      fail(`${target.targetId}: obsolete or unknown aptitude category ${aptitude.category}`);
    }
  }

  const prompt = promptById.get(target.targetId);
  const candidate = candidateById.get(target.targetId);
  if (!prompt || !candidate) fail(`${target.targetId}: missing prompt or candidate record`);
  if (hash(prompt.exactPrompt) !== prompt.promptSha256) {
    fail(`${target.targetId}: prompt hash mismatch`);
  }
  if (prompt.retainedCandidatePath !== candidate.path) {
    fail(`${target.targetId}: retained path mismatch`);
  }

  const bytes = await readFile(resolve(workspaceRoot, candidate.path));
  const metadata = await stat(resolve(workspaceRoot, candidate.path));
  if (hash(bytes) !== candidate.sha256) fail(`${target.targetId}: candidate hash mismatch`);
  if (metadata.size !== candidate.bytes) fail(`${target.targetId}: candidate byte mismatch`);
  if (bytes.toString("ascii", 1, 4) !== "PNG") fail(`${target.targetId}: candidate is not PNG`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== candidate.width || height !== candidate.height) {
    fail(`${target.targetId}: candidate dimensions mismatch`);
  }
  if (candidate.status !== "candidate") fail(`${target.targetId}: unexpected promotion state`);
}

await stat(resolve(experimentRoot, "review/index.html"));
console.log(
  "Validated native-star-visual-study-v1: 12 manifest-bound candidate images, exact prompts, hashes, dimensions, tier budgets, typed aptitudes, and review page."
);
