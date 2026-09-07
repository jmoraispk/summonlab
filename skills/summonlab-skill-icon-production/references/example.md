# Complete packet example

This example uses the ordinary existing skill Measured Cut. Hashes are abbreviated for readability;
real packets use full lowercase SHA-256 values. None of these temporary files are retained after
promotion.

## Target

`.skill-icon-work/martial-blade-measured-cut-v2/target.json`:

```json
{
	"schemaVersion": "summonlab-skill-art-target-v1",
	"jobId": "martial-blade-measured-cut-v2",
	"targetId": "martial:blade:measured-cut",
	"name": "Measured Cut",
	"rarity": "F",
	"exactPrompt": "Paint one controlled diagonal sword cut with a restrained pressure wake, centered with generous breathing room, in tempered steel and charcoal. Artwork layer only: transparent background; no rarity frame, rank crest, rank letter, border rails, backing, UI, label, logo, watermark, or text.",
	"references": [
		{
			"path": "assets/wiki/skills/icon-production-v2/geometry-guide.png",
			"purpose": "Safe-zone geometry only.",
			"contentHash": "<sha256>"
		},
		{
			"path": ".skill-icon-work/martial-blade-measured-cut-v2/family-reference.png",
			"purpose": "Temporary accepted lineage context only; excludes target; never crop.",
			"contentHash": "<sha256>"
		}
	],
	"outputPath": ".skill-icon-work/martial-blade-measured-cut-v2/candidate.png"
}
```

## Assignment

`.skill-icon-work/martial-blade-measured-cut-v2/assignment.json`:

```json
{
	"schemaVersion": "summonlab-skill-art-assignment-v1",
	"jobId": "martial-blade-measured-cut-v2",
	"targetId": "martial:blade:measured-cut",
	"targetPath": ".skill-icon-work/martial-blade-measured-cut-v2/target.json",
	"assignmentPath": ".skill-icon-work/martial-blade-measured-cut-v2/assignment.json",
	"candidatePath": ".skill-icon-work/martial-blade-measured-cut-v2/candidate.png",
	"resultPath": ".skill-icon-work/martial-blade-measured-cut-v2/result.json",
	"retryCeiling": 1,
	"selfPromotionForbidden": true
}
```

## Candidate result

`.skill-icon-work/martial-blade-measured-cut-v2/result.json` after one successful call:

```json
{
	"schemaVersion": "summonlab-skill-art-result-v1",
	"jobId": "martial-blade-measured-cut-v2",
	"targetId": "martial:blade:measured-cut",
	"status": "candidate",
	"promptHash": "<sha256>",
	"referenceInputs": [
		{
			"path": "assets/wiki/skills/icon-production-v2/geometry-guide.png",
			"contentHash": "<sha256>"
		},
		{
			"path": ".skill-icon-work/martial-blade-measured-cut-v2/family-reference.png",
			"contentHash": "<sha256>"
		}
	],
	"candidate": {
		"path": ".skill-icon-work/martial-blade-measured-cut-v2/candidate.png",
		"contentHash": "<sha256>",
		"bytes": 812345,
		"width": 1024,
		"height": 1024,
		"alphaMode": "rgba"
	},
	"findings": {
		"fullSize": {
			"outcome": "pass",
			"observation": "The isolated diagonal cut is clean, centered, and has no frame traces."
		},
		"recognition96": {
			"outcome": "pass",
			"observation": "The blade direction and pressure wake remain distinct at 96px."
		}
	},
	"attemptCount": 1,
	"noSharedFilesEdited": true,
	"selfPromoted": false
}
```

## Owner review and coordinator promotion

The coordinator composes temporary `review-composite.png` as
`backing -> candidate -> rarity-frame-f` with the identity interior transform. The owner separately
accepts the isolated artwork and framed composite. The coordinator then:

1. verifies that `candidate.png` and the promoted
   `interiors/martial-blade-measured-cut.png` are byte-identical;
2. runs `pnpm export:skill-icon-assets` and `pnpm export:wiki-skill-visual-catalog`;
3. runs the skill, asset, runtime, wiki, type, and test validations;
4. deletes the complete `.skill-icon-work/martial-blade-measured-cut-v2/` directory, including the
   provider duplicate, both family sheets, cell map, prompt packet, target, assignment, result,
   96px check, and review composite.

Only the exact frameless canonical interior, its catalog records and manifest hash, the shared
composition assets, and the generated runtime WebP remain.
