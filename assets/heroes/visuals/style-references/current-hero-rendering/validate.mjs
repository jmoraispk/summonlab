import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
const provenance = JSON.parse(await readFile(join(root, manifest.provenance), "utf8"));
const bytes = await readFile(join(root, manifest.reference.path));
const hash = createHash("sha256").update(bytes).digest("hex");

if (manifest.schemaVersion !== "hero-rendering-style-reference-v1") throw new Error("Unexpected schema");
if (manifest.status !== "accepted-style-reference-only") throw new Error("Reference is not accepted");
if (manifest.assetRole.includes("runtime asset") === false) throw new Error("Runtime boundary missing");
if (hash !== manifest.reference.sha256 || hash !== provenance.sourceSha256) throw new Error("Reference hash mismatch");

console.log("current-hero-rendering validated: accepted style reference, non-runtime boundary preserved");
