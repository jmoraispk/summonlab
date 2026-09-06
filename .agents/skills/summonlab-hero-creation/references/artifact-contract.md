# Hero visual-trio artifact contract

## Batch location

Store a creation batch beneath:

`assets/heroes/experiments/hero-creation-YYYYMMDD-<descriptive-slug>-NNN/`

Choose the lowest unused three-digit suffix. Never reuse an existing directory, derive a path from
“the newest” generated file, or write outside the Heroes experiment domain.

```text
batch-root/
├── manifest.json
└── trios/
    └── <hero-id>/
        ├── brief.json
        ├── summon/
        │   ├── provider-source-v1.png
        │   ├── candidate-v1.png
        │   └── result-v1.json
        ├── chibi/
        │   ├── provider-source-v1.png
        │   ├── candidate-v1.png
        │   └── result-v1.json
        └── village-cutout/
            ├── provider-source-v1.png
            ├── candidate-v1.png
            └── result-v1.json
```

Version numbers are additive. A correction uses `v2`; it never replaces `v1`.

## Batch manifest

New `manifest.json` files use `summonlab-hero-visual-trio-batch-v2`:

```json
{
	"schemaVersion": "summonlab-hero-visual-trio-batch-v2",
	"batchId": "hero-creation-YYYYMMDD-descriptive-slug-NNN",
	"status": "candidate",
	"count": 1,
	"heroes": [
		{
			"heroId": "lowercase-hero-id",
			"displayName": "Display Name",
			"briefPath": "assets/heroes/experiments/.../trios/lowercase-hero-id/brief.json",
			"summonResultPath": "assets/heroes/experiments/.../trios/lowercase-hero-id/summon/result-v1.json",
			"chibiResultPath": "assets/heroes/experiments/.../trios/lowercase-hero-id/chibi/result-v1.json",
			"villageCutoutResultPath": "assets/heroes/experiments/.../trios/lowercase-hero-id/village-cutout/result-v1.json"
		}
	]
}
```

`count` is 1–10 and equals the number of unique hero records. `status` remains `candidate`.

## Brief record

`brief.json` uses `summonlab-hero-visual-brief-v1` with these exact top-level fields:

```json
{
	"schemaVersion": "summonlab-hero-visual-brief-v1",
	"heroId": "lowercase-hero-id",
	"displayName": "Display Name",
	"nativeStars": 1,
	"currentStars": 1,
	"affinity": "neutral",
	"identity": {},
	"physique": {},
	"hair": {},
	"wardrobe": {},
	"personalDetails": {},
	"characterKernel": {},
	"summonPrompt": "exact rendered summon prompt",
	"summonPromptSha256": "lowercase SHA-256",
	"lifecycle": "candidate",
	"exclusions": []
}
```

The six design objects contain the concrete facts required by the visual contract. `nativeStars` and
`currentStars` are equal integers from 1 through 5 for a newly summoned hero. `affinity` is neutral,
fire, water, earth, or wind. `exclusions` is a list of explicit visual exclusions.

The brief is authored before image generation. Generated pixels do not silently rewrite it.

## Image result

Each `result-vN.json` uses `summonlab-hero-image-result-v1`:

```json
{
	"schemaVersion": "summonlab-hero-image-result-v1",
	"batchId": "hero-creation-YYYYMMDD-descriptive-slug-NNN",
	"heroId": "lowercase-hero-id",
	"imageKind": "summon",
	"version": 1,
	"status": "candidate",
	"width": 1024,
	"height": 1536,
	"prompt": "exact submitted prompt",
	"promptSha256": "lowercase SHA-256",
	"references": [],
	"providerSourcePath": "assets/heroes/experiments/.../provider-source-v1.png",
	"providerSourceSha256": "lowercase SHA-256",
	"candidatePath": "assets/heroes/experiments/.../candidate-v1.png",
	"candidateSha256": "same lowercase SHA-256"
}
```

For `imageKind: "chibi"`, `references` contains exactly one object:

```json
{
	"role": "identity-anatomy-authority",
	"path": "the matching summon provider-source-v1.png path",
	"sha256": "its exact lowercase SHA-256"
}
```

For `imageKind: "village-cutout"`, `references` contains exactly one object with the same summon
provider path and hash:

```json
{
	"role": "identity-pixel-authority",
	"path": "the matching summon provider-source-v1.png path",
	"sha256": "its exact lowercase SHA-256"
}
```

The cutout is a normal-proportion transparent derivative of the summon portrait, not a chibi and not
a newly posed rendering. Its background and grounding shadow are removed. It must retain true alpha,
leave every canvas edge transparent, and contain a visible figure comfortably inside the canvas.

The summon result has zero generation references unless the user supplied a declared style or
identity reference. Any supplied reference records `role`, `path`, `sha256`, and a narrow `purpose`.
The summon result's prompt and prompt hash must exactly equal the corresponding brief fields.

## Persistence commands

Resolve scripts relative to this skill directory:

```bash
python3 scripts/persist_image.py \
  --workspace-root /absolute/path/to/summonlab \
  --source /absolute/path/to/provider-output.png \
  --provider-destination assets/heroes/experiments/<batch>/trios/<hero>/summon/provider-source-v1.png \
  --candidate-destination assets/heroes/experiments/<batch>/trios/<hero>/summon/candidate-v1.png
```

The command verifies PNG dimensions, exclusively creates both destinations, preserves identical
bytes, and prints their SHA-256. Use the printed digest in the result record.

Validate each cutout before completing the batch:

```bash
python3 scripts/validate_village_cutout.py \
  --source assets/heroes/experiments/<batch>/trios/<hero>/village-cutout/candidate-v1.png
```

After every visual trio has results:

```bash
python3 scripts/validate_batch.py \
  --workspace-root /absolute/path/to/summonlab \
  --batch-root assets/heroes/experiments/<batch>
```

Validation proves structure and provenance, not visual approval.

Historical `summonlab-hero-pair-batch-v1` manifests remain validator-compatible, but all newly
created batches use the v2 visual-trio contract.
