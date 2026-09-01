# Hero Rarity Frames Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and publish a reviewable candidate packet of seven coherent hero rarity frames with one deterministic gold-star component.

**Architecture:** Image generation creates seven frame layers with a shared empty bottom tray and one transparent canonical star layer. A candidate-only manifest defines identical star dimensions and centered 1–7 layouts; the review surface assembles those layers without changing runtime contracts or shared catalogs.

**Tech Stack:** Built-in image generation, PNG/SVG candidate assets, JSON provenance, Markdown wiki documentation, Brainstorm Visual Companion.

**Spec:** `docs/superpowers/specs/2026-08-31-hero-rarity-frames-design.md`

## Global Constraints

- Keep work inside the Heroes visual domain.
- Write only collision-safe versioned files under `assets/heroes/visuals/rarity-frames-v1/`.
- Mark every produced asset as `candidate`, never approved or runtime.
- Do not edit shared hero or runtime catalogs.
- Use only charcoal iron, warm antique/ivory gold, navy/cobalt, sapphire blue, and warm-gold stars.
- Keep all frame layers and composed review cards at 1024 by 1536.
- Reserve x=132..892 and y=1322..1450 as the star-safe tray.
- Render the canonical star once and reuse it at 88 by 88 with a 12-pixel gap and y=1348.
- Publish review links through `10.110.24.218`, never localhost.

---

### Task 1: Durable design and candidate layout contract

**Files:**
- Create: `docs/superpowers/specs/2026-08-31-hero-rarity-frames-design.md`
- Create: `docs/superpowers/plans/2026-08-31-hero-rarity-frames.md`
- Create: `assets/heroes/visuals/rarity-frames-v1/layout.json`

**Interfaces:**
- Consumes: owner-approved visual description and seven selected source PNG paths.
- Produces: a candidate-only layout with canvas, tray, star, and rank-count invariants.

- [ ] **Step 1: Write `layout.json` with exact geometry**

```json
{
  "status": "candidate",
  "canvas": { "width": 1024, "height": 1536 },
  "tray": { "left": 132, "top": 1322, "width": 760, "height": 128 },
  "star": { "width": 88, "height": 88, "gap": 12, "top": 1348 },
  "ranks": [1, 2, 3, 4, 5, 6, 7]
}
```

- [ ] **Step 2: Validate JSON parsing and geometry bounds**

Run a JSON parser and verify `7 * 88 + 6 * 12 = 688`, which fits inside the 760-pixel tray.

### Task 2: Image-generated source layers

**Files:**
- Create: `assets/heroes/visuals/rarity-frames-v1/sources/frame-{1..7}star-tray-v1.png`
- Create: `assets/heroes/visuals/rarity-frames-v1/components/gold-star-v1.png`
- Create: `assets/heroes/visuals/rarity-frames-v1/generation-record.md`

**Interfaces:**
- Consumes: seven exact owner-selected source images and the design spec.
- Produces: seven 1024 by 1536 starless frame layers and one transparent canonical star layer.

- [ ] **Step 1: Inspect every selected source at useful detail**

Confirm rank identity, palette, frame silhouette, dragon-mouth state, and source dimensions.

- [ ] **Step 2: Generate one tray-normalized edit per frame**

For each rank, preserve the complete selected frame outside the tray and replace only the bottom
star band with an uninterrupted dark plaque. Do not include any stars in these source layers.

- [ ] **Step 3: Generate the canonical transparent star**

Use the second and fifth selected frames as style references. Request one centered warm-gold,
broad-pointed, beveled five-point star on a genuinely transparent canvas.

- [ ] **Step 4: Inspect all eight outputs**

Reject wrong palettes, changed rank silhouettes, cropped frames, remaining stars, nontransparent
star backgrounds, or tray intrusions. Record retained source paths and exact prompts.

### Task 3: Deterministic candidate assembly

**Files:**
- Create: `assets/heroes/visuals/rarity-frames-v1/candidates/hero-frame-{1..7}star-v1.svg`
- Create: `assets/heroes/visuals/rarity-frames-v1/review-evidence.md`

**Interfaces:**
- Consumes: `layout.json`, seven frame PNG layers, and `components/gold-star-v1.png`.
- Produces: seven self-contained review compositions that reuse the same star bytes.

- [ ] **Step 1: Calculate centered row geometry**

For rank `n`, calculate `rowWidth = n * 88 + (n - 1) * 12` and
`startX = (1024 - rowWidth) / 2`.

- [ ] **Step 2: Create one SVG wrapper per rank**

Each SVG displays its rank PNG at 1024 by 1536 and repeats the same star component `n` times at
`x = startX + index * 100`, `y = 1348`, width 88, and height 88.

- [ ] **Step 3: Verify the compositions**

Parse all SVGs, assert counts 1 through 7, assert identical star href and dimensions, and assert
every star stays within x=132..892 and y=1322..1450.

### Task 4: Wiki and remote review surface

**Files:**
- Create: `docs/wiki/art/hero-rarity-frames.md`
- Modify: `docs/wiki/art/living-village-heroes.md`
- Create: `.superpowers/brainstorm/.../content/hero-rarity-frames-locked-v1.html` (ignored review file)

**Interfaces:**
- Consumes: the seven composed candidate SVGs and review evidence.
- Produces: durable candidate documentation and a user-facing side-by-side comparison.

- [ ] **Step 1: Document the candidate-only status and review criteria**

Link the new wiki page from the Heroes visual packet without registering assets in shared catalogs.

- [ ] **Step 2: Publish all seven ranks in one bright comparison row**

Show the same-size cards, enlarged tray detail, and explicit candidate badge. Use only the produced
image layers; do not simulate or redesign the frames in CSS.

- [ ] **Step 3: Validate and hand off**

Run wiki validation, asset metadata/hash checks, SVG count/geometry checks, HTTP checks for the page
and all assets, then commit and push the Heroes-only batch.
