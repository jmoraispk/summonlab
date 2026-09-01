# Canonical Hero Rarity Frames Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace five versioned hero rarity-frame packets with one unversioned, checksum-bound library containing six complete approved families and a single review surface.

**Architecture:** Copy the 48 frozen source PNGs byte-for-byte into a stable six-family tree, bind them with a manifest, source map, and validator, then publish the canonical review/wiki authority. Only after the destination validates do we delete the versioned packet roots; Git history remains the recovery mechanism.

**Tech Stack:** Python 3, Pillow, JSON, SHA-256, static HTML/CSS/JavaScript, Markdown, Git.

**Spec:** `docs/superpowers/specs/2026-09-01-canonical-hero-rarity-frames-design.md`

## Global Constraints

- Keep all changes inside Heroes visual production, its documentation, and its asset-specific validation tooling.
- The canonical root is exactly `assets/heroes/visuals/rarity-frames/`; current consumer-facing files and directories contain no packet version suffix.
- Preserve exactly six families in this order: `legacy-neutral`, `neutral`, `fire`, `water`, `earth`, `wind`.
- Preserve exactly one 2172×724 8-bit RGB sheet and seven 1024×1536 8-bit RGB individual frames per family.
- Preserve every retained PNG byte-for-byte; do not regenerate, normalize, resize, recompress, or recolor it.
- Preserve all seven individual frames for each of Fire, Water, Earth, and Wind.
- Use corrected inward-facing Wind rank 7 with SHA-256 `84c2ff9c3308cc3566b0efba94f20b7db12fb4abc9da3a6f48743d7a2b79c41b`.
- Record `legacy-neutral` as the preferred starting family without creating a runtime binding.
- Keep status `approved-visual-source` distinct from runtime status `not-runtime-ready`.
- Do not change engine contracts, affinity contracts, application code, or shared runtime catalogs.
- Delete the five versioned packet roots only after the canonical 48-image checksum and structural validation passes.
- Bind preview servers to `0.0.0.0` and publish links with `10.110.24.218`.

## File map

**Create:**

- `assets/heroes/visuals/rarity-frames/README.md` — current authority and runtime boundary.
- `assets/heroes/visuals/rarity-frames/manifest.json` — six-family machine-readable contract and per-image metadata.
- `assets/heroes/visuals/rarity-frames/checksums.sha256` — hashes for the 48 approved canonical PNGs only.
- `assets/heroes/visuals/rarity-frames/families/{legacy-neutral,neutral,fire,water,earth,wind}/sheet.png` — six full-set sheets.
- `assets/heroes/visuals/rarity-frames/families/{legacy-neutral,neutral,fire,water,earth,wind}/frames/rank-{1..7}.png` — 42 individual frames.
- `assets/heroes/visuals/rarity-frames/provenance/source-map.json` — old path, canonical path, hashes, prompt, and transformation for every approved PNG.
- `assets/heroes/visuals/rarity-frames/provenance/generation-record.md` — consolidated v3/v4 production history.
- `assets/heroes/visuals/rarity-frames/provenance/prompts/{family}/` — final prompt text needed to audit retained generated assets.
- `assets/heroes/visuals/rarity-frames/review/index.html` — sole six-family review surface.
- `assets/heroes/visuals/rarity-frames/review-evidence.md` — final structural and visual verification record.
- `tools/validate-hero-rarity-frames.py` — reusable canonical-library validator.
- `tools/test_validate_hero_rarity_frames.py` — validator unit tests.
- `docs/decisions/0067-hero-rarity-frames-use-one-canonical-six-family-library.md` — canonical authority decision.

**Modify:**

- `docs/decisions/0066-hero-rarity-frame-v3-v4-sources-are-frozen.md` — mark superseded by ADR 0067.
- `docs/wiki/art/hero-rarity-frames.md` — describe the six current families and stable paths.

**Delete after validation:**

- `assets/heroes/visuals/rarity-frames-v1/`
- `assets/heroes/visuals/rarity-frames-v2/`
- `assets/heroes/visuals/rarity-frames-v3/`
- `assets/heroes/visuals/rarity-frames-v4/`
- `assets/heroes/visuals/rarity-frames-freeze-v1/`

---

### Task 1: Canonical library validator

**Files:**

- Create: `tools/test_validate_hero_rarity_frames.py`
- Create: `tools/validate-hero-rarity-frames.py`

**Interfaces:**

- Consumes: a `Path` pointing to the canonical asset root.
- Produces: `validate_manifest_shape(manifest: dict) -> list[str]`, `validate_library(root: Path) -> list[str]`, and a CLI that exits 0 with `PASS hero rarity frames: 6 families, 6 sheets, 42 frames, 48 hashes` or exits 1 after printing each violation.

- [ ] **Step 1: Write manifest-shape tests first**

Create `tools/test_validate_hero_rarity_frames.py` with a minimal valid manifest fixture and these assertions:

```python
import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("validate-hero-rarity-frames.py")
SPEC = importlib.util.spec_from_file_location("hero_rarity_validator", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


def family(family_id: str) -> dict:
    return {
        "id": family_id,
        "sheet": {"path": f"families/{family_id}/sheet.png"},
        "frames": [
            {"rank": rank, "path": f"families/{family_id}/frames/rank-{rank}.png"}
            for rank in range(1, 8)
        ],
    }


class ManifestShapeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.manifest = {
            "schema": "summonlab-hero-rarity-frames",
            "status": "approved-visual-source",
            "runtimeStatus": "not-runtime-ready",
            "preferredStartingFamily": "legacy-neutral",
            "familyOrder": list(MODULE.FAMILY_ORDER),
            "families": [family(value) for value in MODULE.FAMILY_ORDER],
        }

    def test_valid_six_family_shape(self) -> None:
        self.assertEqual(MODULE.validate_manifest_shape(self.manifest), [])

    def test_missing_affinity_rank_fails(self) -> None:
        self.manifest["families"][2]["frames"].pop()
        errors = MODULE.validate_manifest_shape(self.manifest)
        self.assertIn("fire must contain ranks 1 through 7 exactly once", errors)

    def test_wrong_preferred_family_fails(self) -> None:
        self.manifest["preferredStartingFamily"] = "neutral"
        errors = MODULE.validate_manifest_shape(self.manifest)
        self.assertIn("preferredStartingFamily must be legacy-neutral", errors)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the unit test and verify the expected failure**

Run:

```bash
python3 -m unittest tools/test_validate_hero_rarity_frames.py -v
```

Expected: import or attribute failure because `tools/validate-hero-rarity-frames.py` does not exist yet.

- [ ] **Step 3: Implement manifest-shape validation**

Create `tools/validate-hero-rarity-frames.py` with these constants and behavior:

```python
FAMILY_ORDER = ("legacy-neutral", "neutral", "fire", "water", "earth", "wind")
EXPECTED_RANKS = tuple(range(1, 8))
EXPECTED_SHEET = (2172, 724, "RGB")
EXPECTED_FRAME = (1024, 1536, "RGB")
WIND_RANK_7_SHA256 = "84c2ff9c3308cc3566b0efba94f20b7db12fb4abc9da3a6f48743d7a2b79c41b"
```

`validate_manifest_shape()` must check schema, approval/runtime statuses, exact family order, preferred
family, one unique family record per ID, and ranks 1–7 exactly once. It returns deterministic error
strings rather than raising on malformed user data.

- [ ] **Step 4: Run the unit tests and verify they pass**

Run:

```bash
python3 -m unittest tools/test_validate_hero_rarity_frames.py -v
```

Expected: three tests pass.

- [ ] **Step 5: Add filesystem, PNG, hash, checksum, and provenance validation**

Implement `validate_library(root)` so it:

1. parses `manifest.json` and `provenance/source-map.json`;
2. checks exactly 48 manifest image paths and 48 unique source-map records;
3. opens every PNG with Pillow and checks sheet/frame dimensions and RGB mode;
4. verifies each manifest SHA-256 against file bytes;
5. parses `checksums.sha256`, requires 48 unique canonical paths, and verifies all entries;
6. requires the Wind rank 7 hash constant;
7. rejects any approved path containing `/candidates/` or `-v1`, `-v2`, `-v3`, or `-v4`;
8. prints the required PASS line only when the error list is empty.

- [ ] **Step 6: Exercise the CLI against the absent canonical library**

Run:

```bash
python3 tools/validate-hero-rarity-frames.py assets/heroes/visuals/rarity-frames
```

Expected: exit 1 with `missing manifest.json`. This proves the validator fails before migration.

- [ ] **Step 7: Commit and push the validator batch**

```bash
git add tools/test_validate_hero_rarity_frames.py tools/validate-hero-rarity-frames.py
git commit -m "test(heroes): add canonical rarity frame validator"
git push origin codex/heroes-current-frames
```

---

### Task 2: Byte-identical six-family canonical library

**Files:**

- Create: `assets/heroes/visuals/rarity-frames/README.md`
- Create: `assets/heroes/visuals/rarity-frames/manifest.json`
- Create: `assets/heroes/visuals/rarity-frames/checksums.sha256`
- Create: `assets/heroes/visuals/rarity-frames/families/*/sheet.png`
- Create: `assets/heroes/visuals/rarity-frames/families/*/frames/rank-*.png`
- Create: `assets/heroes/visuals/rarity-frames/provenance/source-map.json`
- Create: `assets/heroes/visuals/rarity-frames/provenance/generation-record.md`
- Create: `assets/heroes/visuals/rarity-frames/provenance/prompts/*/*.txt`

**Interfaces:**

- Consumes: the 48 paths bound by `assets/heroes/visuals/rarity-frames-freeze-v1/checksums.sha256`, v3/v4 generation records, and final prompt files.
- Produces: six stable families with one sheet and seven ranked frames each, plus a complete byte-level source map.

- [ ] **Step 1: Verify the old frozen source boundary before copying**

Run:

```bash
sha256sum -c assets/heroes/visuals/rarity-frames-freeze-v1/checksums.sha256
```

Expected: all 48 lines report `OK`. Stop without copying if any source differs.

- [ ] **Step 2: Create the six family directories and copy sheets byte-for-byte**

Create the destination directories, then copy these exact mappings without image tooling:

```text
v3/candidates/sheets/neutral-progression-v4.png -> families/legacy-neutral/sheet.png
v4/candidates/sheets/gemless-neutral-seven-rank-v1.png -> families/neutral/sheet.png
v3/candidates/sheets/affinity-fire-v1.png -> families/fire/sheet.png
v3/candidates/sheets/affinity-water-v1.png -> families/water/sheet.png
v3/candidates/sheets/affinity-earth-v1.png -> families/earth/sheet.png
v3/candidates/sheets/affinity-wind-v1.png -> families/wind/sheet.png
```

The `v3/` and `v4/` prefixes above abbreviate only these explicit roots:

```text
assets/heroes/visuals/rarity-frames-v3/
assets/heroes/visuals/rarity-frames-v4/
```

- [ ] **Step 3: Copy all 42 individual frames byte-for-byte**

Use these exact rules:

```text
legacy-neutral rank N <- rarity-frames-v3/candidates/highres/neutral-rank-N-v1.png
neutral rank N        <- rarity-frames-v4/candidates/individuals/neutral/neutral-rank-N-v1.png
fire rank N           <- rarity-frames-v4/candidates/individuals/fire/fire-rank-N-v1.png
water rank N          <- rarity-frames-v4/candidates/individuals/water/water-rank-N-v1.png
earth rank N          <- rarity-frames-v4/candidates/individuals/earth/earth-rank-N-v1.png
wind rank N           <- rarity-frames-v4/candidates/individuals/wind/wind-rank-N-v1.png for N=1..6
wind rank 7           <- rarity-frames-v4/candidates/individuals/wind/wind-rank-7-v2.png
```

Every destination is `families/<family>/frames/rank-N.png`.

- [ ] **Step 4: Copy only final source-bound prompt text into stable family paths**

Use `sheet.txt` for each sheet prompt and `rank-N.txt` for final individual prompts. For corrected
outputs, retain the correction prompt as the canonical prompt: Legacy Neutral ranks 4–7; Neutral
ranks 4 and 7; Fire rank 4; Water ranks 4 and 5; Wind rank 7. Fire, Water, Earth, and Wind ranks 1–2
record `inheritedFrom: neutral` in the source map and do not duplicate a false affinity prompt.

Use these exact prompt-source mappings:

```text
legacy-neutral/sheet.txt <- v3/prompts/neutral-progression-v4-exact.txt
legacy-neutral/rank-1.txt .. rank-3.txt <- v3/prompts/highres/neutral-rank-N-exact.txt
legacy-neutral/rank-4.txt .. rank-7.txt <- v3/prompts/highres/neutral-rank-N-correction1-exact.txt
neutral/sheet.txt <- v4/prompts/sheets/gemless-neutral-seven-rank-correction1-exact.txt
neutral/rank-1.txt .. rank-3.txt <- v4/prompts/individuals/neutral/neutral-rank-N-exact.txt
neutral/rank-4.txt <- v4/prompts/individuals/neutral/neutral-rank-4-correction1-exact.txt
neutral/rank-5.txt .. rank-6.txt <- v4/prompts/individuals/neutral/neutral-rank-N-exact.txt
neutral/rank-7.txt <- v4/prompts/individuals/neutral/neutral-rank-7-correction1-exact.txt
fire/sheet.txt <- v3/prompts/affinities/fire-seven-rank-exact.txt
fire/rank-3.txt <- v4/prompts/individuals/fire/fire-rank-3-exact.txt
fire/rank-4.txt <- v4/prompts/individuals/fire/fire-rank-4-correction1-exact.txt
fire/rank-5.txt .. rank-7.txt <- v4/prompts/individuals/fire/fire-rank-N-exact.txt
water/sheet.txt <- v3/prompts/affinities/water-seven-rank-exact.txt
water/rank-3.txt <- v4/prompts/individuals/water/water-rank-3-exact.txt
water/rank-4.txt .. rank-5.txt <- v4/prompts/individuals/water/water-rank-N-correction1-exact.txt
water/rank-6.txt .. rank-7.txt <- v4/prompts/individuals/water/water-rank-N-exact.txt
earth/sheet.txt <- v3/prompts/affinities/earth-seven-rank-exact.txt
earth/rank-3.txt .. rank-7.txt <- v4/prompts/individuals/earth/earth-rank-N-exact.txt
wind/sheet.txt <- v3/prompts/affinities/wind-seven-rank-exact.txt
wind/rank-3.txt .. rank-6.txt <- v4/prompts/individuals/wind/wind-rank-N-exact.txt
wind/rank-7.txt <- v4/prompts/individuals/wind/wind-rank-7-inward-heads-v2-exact.txt
```

Here `v3/` and `v4/` expand to the same explicit packet roots defined in Step 2, and `N` expands
only across the rank range written on that line.

- [ ] **Step 5: Write the manifest and source map from the copied bytes**

Write `manifest.json` with this top-level contract:

```json
{
  "schema": "summonlab-hero-rarity-frames",
  "status": "approved-visual-source",
  "runtimeStatus": "not-runtime-ready",
  "preferredStartingFamily": "legacy-neutral",
  "familyOrder": ["legacy-neutral", "neutral", "fire", "water", "earth", "wind"],
  "assetCount": 48,
  "families": []
}
```

Populate each family with one `sheet` object and seven `frames` objects. Every object includes
`path`, `width`, `height`, `mode`, and `sha256`. Each `source-map.json` record includes
`canonicalPath`, `sourcePath`, `sourcePacket`, `sourceSha256`, `canonicalSha256`, `promptPath` or
`inheritedFrom`, and `transformation: "byte-identical-copy"`.

- [ ] **Step 6: Write canonical checksums and consolidated production records**

Generate `checksums.sha256` in manifest family/rank order using repository-relative canonical paths.
Write `README.md` and `provenance/generation-record.md` with the approval/runtime distinction,
preferred Legacy Neutral rollout, six-family inventory, v3/v4 source history, geometry rules,
closed-mouth-through-6/open-at-7 rule, and inward-facing Wind apex correction.

- [ ] **Step 7: Run the canonical validator**

Run:

```bash
python3 tools/validate-hero-rarity-frames.py assets/heroes/visuals/rarity-frames
```

Expected:

```text
PASS hero rarity frames: 6 families, 6 sheets, 42 frames, 48 hashes
```

- [ ] **Step 8: Prove canonical bytes equal their mapped source bytes**

Run a Python assertion over `provenance/source-map.json` requiring
`sourceSha256 == canonicalSha256 == sha256(canonicalPath)` for all 48 records and requiring 48 unique
source and canonical paths.

- [ ] **Step 9: Commit and push the canonical asset batch**

```bash
git add assets/heroes/visuals/rarity-frames
git commit -m "feat(heroes): establish canonical rarity frame library"
git push origin codex/heroes-current-frames
```

---

### Task 3: Current review surface and decision authority

**Files:**

- Create: `assets/heroes/visuals/rarity-frames/review/index.html`
- Create: `assets/heroes/visuals/rarity-frames/review-evidence.md`
- Create: `docs/decisions/0067-hero-rarity-frames-use-one-canonical-six-family-library.md`
- Modify: `docs/decisions/0066-hero-rarity-frame-v3-v4-sources-are-frozen.md`
- Modify: `docs/wiki/art/hero-rarity-frames.md`

**Interfaces:**

- Consumes: canonical `manifest.json` and the six family directories.
- Produces: one unversioned visual review page and one current decision/wiki authority.

- [ ] **Step 1: Build one manifest-driven six-family review page**

Adapt the approved v4 review language and layout into the canonical page. Display families in exact
manifest order with Legacy Neutral first. For each family, render `sheet.png` followed by rank 1
through rank 7 from the canonical paths. Include visible badges for `Approved visual source`,
`Runtime export pending`, and `Preferred start · Legacy Neutral`.

The JavaScript path contract is:

```javascript
const familyOrder = ['legacy-neutral', 'neutral', 'fire', 'water', 'earth', 'wind'];
const sheetPath = (family) => `../families/${family}/sheet.png`;
const framePath = (family, rank) => `../families/${family}/frames/rank-${rank}.png`;
```

Do not draw or alter frame artwork with CSS, canvas, SVG, or star overlays.

- [ ] **Step 2: Add review evidence for the six complete sets**

Record 6/6 sheets, 42/42 individuals, 48/48 hashes, exact dimensions/modes, Legacy Neutral rollout
preference, seven frames per affinity, Wind rank 7 hash, and the runtime-integration boundary in
`review-evidence.md`.

- [ ] **Step 3: Supersede the old freeze decision**

Change ADR 0066 status to `Superseded by ADR 0067` without rewriting its historical decision. Add
ADR 0067 accepting the canonical root, six families, Legacy Neutral preference, stable filenames,
Git-history recovery, and removal of the five versioned roots. State explicitly that this decision
does not authorize runtime catalog or contract changes.

- [ ] **Step 4: Rewrite the active wiki page around current paths**

Update `docs/wiki/art/hero-rarity-frames.md` to name all six families, explain Legacy Neutral versus
gemless Neutral, preserve the seven-rank progression and mouth gate, link the canonical manifest and
checksums, and remove active references to v1–v4 packet paths.

- [ ] **Step 5: Validate review references and wiki identity**

Parse the review HTML with Python's `html.parser`, enumerate the six dynamic sheets and 42 dynamic
frames, and assert every local path exists. Parse all production wiki IDs, excluding template
placeholders containing `replace-me`, and assert they match `docs/wiki/catalog.json` one-to-one.

- [ ] **Step 6: Serve and inspect the canonical page**

Run:

```bash
python3 -m http.server 4177 --bind 0.0.0.0
```

Verify HTTP 200 for:

```text
http://10.110.24.218:4177/assets/heroes/visuals/rarity-frames/review/
```

Inspect Legacy Neutral first, six full sheets, all seven individuals per family, legible badges,
and no broken images at desktop and narrow viewport widths.

- [ ] **Step 7: Commit and push the review/authority batch**

```bash
git add assets/heroes/visuals/rarity-frames/review assets/heroes/visuals/rarity-frames/review-evidence.md docs/decisions/0066-hero-rarity-frame-v3-v4-sources-are-frozen.md docs/decisions/0067-hero-rarity-frames-use-one-canonical-six-family-library.md docs/wiki/art/hero-rarity-frames.md
git commit -m "docs(heroes): publish canonical rarity frame authority"
git push origin codex/heroes-current-frames
```

---

### Task 4: Retire versioned packet roots

**Files:**

- Delete: `assets/heroes/visuals/rarity-frames-v1/`
- Delete: `assets/heroes/visuals/rarity-frames-v2/`
- Delete: `assets/heroes/visuals/rarity-frames-v3/`
- Delete: `assets/heroes/visuals/rarity-frames-v4/`
- Delete: `assets/heroes/visuals/rarity-frames-freeze-v1/`
- Modify only if found by the active-reference scan: current Heroes documentation outside the historical specs/ADRs above.

**Interfaces:**

- Consumes: a passing canonical validator and byte-equivalence proof.
- Produces: one current unversioned asset root with versioned sources recoverable only from Git history.

- [ ] **Step 1: Re-run both source and destination checksum gates immediately before deletion**

Run:

```bash
sha256sum -c assets/heroes/visuals/rarity-frames-freeze-v1/checksums.sha256
python3 tools/validate-hero-rarity-frames.py assets/heroes/visuals/rarity-frames
```

Expected: 48 old hashes `OK` and the canonical PASS line. Do not delete if either command fails.

- [ ] **Step 2: Remove exactly the five approved versioned roots**

Run `git rm -r` with all five explicit paths in one command. Do not use a glob, environment
variable, workspace root, or broader Heroes directory.

- [ ] **Step 3: Scan for stale active references**

Run `rg` for `rarity-frames-v1`, `rarity-frames-v2`, `rarity-frames-v3`,
`rarity-frames-v4`, and `rarity-frames-freeze-v1`. References are allowed only inside superseded ADR
0066, the prior historical rarity-frame spec/plan, the canonical source map, and the canonical
generation record. Active wiki, current review, README, manifest, and review evidence must contain
none.

- [ ] **Step 4: Re-run canonical validation after deletion**

Run:

```bash
python3 -m unittest tools/test_validate_hero_rarity_frames.py -v
python3 tools/validate-hero-rarity-frames.py assets/heroes/visuals/rarity-frames
git diff --check
```

Expected: all unit tests pass, the canonical 48-image PASS line appears, and `git diff --check`
prints nothing.

- [ ] **Step 5: Commit and push the retirement batch**

```bash
git add -u assets/heroes/visuals docs
git commit -m "chore(heroes): retire versioned rarity frame packets"
git push origin codex/heroes-current-frames
```

---

### Task 5: Final branch verification and integration handoff

**Files:**

- Verify only; modify no files unless a validation failure identifies an in-scope defect.

**Interfaces:**

- Consumes: the completed canonical branch.
- Produces: evidence that the branch is ready for integration without runtime changes.

- [ ] **Step 1: Run the final asset test suite**

```bash
python3 -m unittest tools/test_validate_hero_rarity_frames.py -v
python3 tools/validate-hero-rarity-frames.py assets/heroes/visuals/rarity-frames
sha256sum -c assets/heroes/visuals/rarity-frames/checksums.sha256
```

Expected: validator unit tests pass, the canonical PASS line appears, and 48 checksum lines report
`OK`.

- [ ] **Step 2: Run repository documentation checks available in the environment**

If Node and pnpm are installed, run `pnpm validate:wiki` and `pnpm format:check` on the changed text
files. If they are unavailable, run the Python wiki ID/catalog parity check from Task 3 and report
the unavailable canonical commands explicitly rather than claiming they passed.

- [ ] **Step 3: Prove scope isolation**

Run:

```bash
git diff --name-only origin/main...HEAD -- apps packages
git diff --check origin/main...HEAD
```

Expected: the first command prints nothing and the second reports no whitespace errors. Inspect the
complete changed-file list and confirm it contains only Heroes visuals, Heroes/wiki decisions,
the approved design/plan, and the asset-specific validator/tests.

- [ ] **Step 4: Verify the remote review URL**

Confirm HTTP 200 for the canonical review page and all 48 canonical PNG URLs through
`10.110.24.218:4177`. Keep the server bound to `0.0.0.0` for owner inspection.

- [ ] **Step 5: Push and report integration readiness**

Push `codex/heroes-current-frames`, verify local HEAD equals the remote branch, and verify the
working tree is clean. Report the branch, all implementation commit hashes and subjects, validation
results, canonical preview URL, deletion summary and Git recoverability, and request integration
into `main`. Do not merge without explicit integration authorization.
