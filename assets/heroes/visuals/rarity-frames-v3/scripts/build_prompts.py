#!/usr/bin/env python3
"""Build exact, collision-safe prompts for the v3 review packet."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

RANK_DESCRIPTIONS = {
    1: "RECTANGULAR charcoal forged-iron frame with straight rails, nearly straight top and bottom, disciplined corner blocks, thin muted-bronze edge, and minimal engraved scale texture. No dragon, wing, large gemstone, blue emission, or open mouth.",
    2: "Horned low-rank frame, clearly different from rank 1: curved upper shoulders, stronger central peak, gently bowed lower corners, broader engraved texture, slightly richer bronze-gold edging, and at most a trace of dark navy. No dragon, wing, large gemstone, blue emission, or open mouth.",
    3: "First subtle prestige frame with elegant gothic arcs, narrow deep-navy enamel recesses, restrained antique-gold structure, and one tiny sapphire crest. No dragon and no open mouth; do not become predominantly bright gold.",
    4: "Heraldic mid-rank frame with paired SMALL dragon heads built into the upper shoulders, BOTH MOUTHS COMPLETELY CLOSED, balanced charcoal/navy/antique-warm-gold filigree, and a moderate sapphire crest. Heads stay outside the opening.",
    5: "Guardian frame with two LEAN warm-gold dragon bodies acting as narrow vertical rail ornaments, small folded wings or no visible wings, contained claws, modest sapphire accents, and BOTH MOUTHS COMPLETELY CLOSED. Preserve a broad hero opening.",
    6: "Elder frame, decisively stronger than rank 5 without becoming wider: broader scale relief, denser crown, larger tightly FOLDED wings following the outer rails, stronger ivory-warm-gold mass, contained sapphire energy, and BOTH MOUTHS COMPLETELY CLOSED. No teeth or jaw gap. Preserve a broad hero opening.",
    7: "Awakened apex frame with majestic dragons hugging the outer rails, wings growing upward/outward inside the fixed box, strongest crown and sapphire energy, and BOTH MOUTHS CLEARLY OPEN IN A ROAR with jaw gap, upper and lower teeth, dark mouth cavity, and blue breath light. Preserve the broad hero opening.",
}

COLOR_DESCRIPTIONS = {
    1: "90% charcoal iron, 10% muted bronze edge; no blue emission",
    2: "80% charcoal iron, 18% bronze-gold edge, at most 2% dark navy; no bright sapphire emission",
    3: "65% dark iron, 20% antique gold, 13% deep navy enamel, 2% tiny sapphire crest",
    4: "45% dark iron/navy, 45% antique warm gold, 10% sapphire accents; never dominant silver",
    5: "30% navy/dark iron, 55% warm gold, 15% restrained sapphire",
    6: "20% navy/dark iron, 60% ivory-warm gold, 20% contained sapphire energy",
    7: "10% deep navy, 60% luminous warm gold, 30% vivid sapphire energy",
}

AFFINITIES = {
    "fire": {
        "palette": "vermilion, ember-orange, soot-black, and localized white-hot metal",
        "material": "fine ember channels, heat-tempered metal, localized heat distortion, tiny cooling ash, and contained flame only in recesses",
        "avoid": "full-frame red wash, constant wall of fire, lava everywhere, smoke obscuring the opening",
    },
    "water": {
        "palette": "deep blue-black, cobalt, cyan highlights, and restrained pearl-white reflection",
        "material": "flowing engraved channels, condensation beads, rippling enamel, suspended droplets, and contained current light in recesses",
        "avoid": "uniform cyan wash, giant waves, opaque ice covering the frame, water obscuring the opening",
    },
    "earth": {
        "palette": "ochre-gold, umber stone, dark mineral brown, and restrained amber crystal",
        "material": "layered stone grain, compact geometric strata, weight-bearing blocks, small amber crystal seams, and sparse settled dust",
        "avoid": "green nature motifs, moss takeover, muddy wash, giant boulders, dust obscuring the opening",
    },
    "wind": {
        "palette": "pale gray-cyan, blue-silver reflection, deep navy, and restrained white pressure light",
        "material": "swept metal fins, pressure-ripple engraving, directional particles, thin curved airflow traces, and feather-light edges",
        "avoid": "solid neon ribbons, tornadoes, clouds covering the frame, opaque white wash, particles obscuring the opening",
    },
}


def write_new(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        raise SystemExit(f"refusing existing prompt: {path}")
    path.write_text(content, encoding="utf-8")


def highres_prompt(rank: int) -> str:
    mouth_rule = (
        "Only this rank may have open mouths, and both mouths must be unmistakably open."
        if rank == 7
        else "Every dragon mouth in this image must be fully closed; no teeth, jaw gap, roar, or open mouth."
    )
    return f"""Use case: stylized-concept
Asset type: high-resolution single-frame candidate for neutral hero rarity rank {rank} of 7

Primary request:
Generate ONE new high-resolution portrait image containing exactly ONE complete empty rank-{rank} hero-card frame. Re-render the rank-{rank} design from the supplied corrected seven-frame authority sheet and rank crop at 1024×1536 detail. The result must be a newly generated single-frame image, not an enlarged crop. Preserve the authority sheet's exact silhouette identity, gradual neutral color stage, integrated star tray, cute gold-star design, and coherent premium 3D metalwork family.

Input images:
- Reference image 1 is the complete corrected seven-rank authority sheet. Use it to preserve cross-rank family, fixed footprint, opening width, tray baseline, star style, and color progression.
- Reference image 2 is the isolated rank-{rank} crop. Use it only for this rank's silhouette, ornaments, materials, mouth state, and exact star count. Ignore any label, dark comparison backdrop, or neighboring sliver in the crop.

Single-frame geometry:
- Exact 1024×1536 portrait canvas, orthographic front view.
- One centered complete frame, fully inside the canvas with about 48 pixels of clear margin at every outer edge; no cropping.
- Large clean warm-white empty hero opening at least 68% of frame width.
- Dragon anatomy, wings, horns, claws, and energy hug the outer rails or grow upward/outward; nothing invades the hero opening.
- Built-in horizontal bottom tray in the same family position and proportion used by the authority sheet.
- No numeral, title, caption, UI, or comparison-sheet backdrop.

Rank-{rank} identity:
{RANK_DESCRIPTIONS[rank]}
Color stage: {COLOR_DESCRIPTIONS[rank]}.
Mouth gate: {mouth_rule}

Integrated stars:
- The tray contains exactly {rank} identical warm-gold star{'s' if rank != 1 else ''}, no more and no fewer.
- Stars are physically inset or seated in the tray and share its lighting, bevel, shadows, and occlusion.
- Use the same cute broad softly rounded upright five-point silhouette, cream-gold center, amber bevel, restrained warm glow, tight even spacing, and symmetric center-out arrangement seen in the authority sheet.
- Stars appear nowhere else.

Style:
Premium cinematic fantasy-game frame concept art, symmetrical polished 3D ornamental metalwork, crisp silhouette, realistic iron/gold/enamel/gem separation, clean studio lighting, controlled emission, high detail, coherent with all seven neutral ranks.

Avoid:
multiple frames, independent or floating star sprites, incorrect star count, different star shapes, labels or text, hero character, scenery, dark hero opening, affinity-specific fire/water/earth/wind cues, horizontal sprawl, narrow opening, open mouths before rank 7, closed mouths at rank 7, perspective, crop, logo, watermark, browser chrome, or the word \"master\".
"""


def affinity_prompt(name: str, values: dict[str, str]) -> str:
    return f"""Use case: stylized-concept
Asset type: seven-rank {name} affinity hero-card frame comparison sheet

Primary request:
Generate ONE single ultra-wide landscape image containing exactly seven complete empty portrait hero-card frames in one horizontal row, ordered 1★ through 7★. Preserve the corrected neutral authority sheet's exact seven silhouettes, fixed card footprint, broad hero openings, integrated trays, exact gold-star counts, ornament progression, and mouth states. Apply the {name.upper()} affinity only from ranks 3 through 7, beginning subtly and increasing gradually. Ranks 1 and 2 remain neutral.

Input images:
- Reference image 1 is the corrected neutral seven-rank authority. Preserve its composition, silhouettes, widths, opening sizes, tray positions, star style/counts, and rarity ornament progression.
- Reference image 2 is the prior accepted neutral family and establishes premium polished 3D material rendering.

Fixed geometry and rarity invariants:
- Exactly seven equal portrait card boxes, equal narrow gutters, same outer width/height, aligned top and bottom, orthographic front view, no crop or overlap.
- Every warm-white empty hero opening remains at least 68% of card width, including ranks 6 and 7.
- Ornament and affinity effects hug outer rails or grow upward/outward inside the fixed box; nothing invades or obscures the hero opening.
- Card N contains exactly N identical integrated warm-gold stars in its built-in lower tray, for exact counts 1, 2, 3, 4, 5, 6, 7.
- Rank 1 is rectangular; rank 2 is clearly horned/curved; rank 3 has gothic arcs; rank 4 introduces small heraldic dragon heads; rank 5 has lean guardian dragons; rank 6 has compact elder dragons and tightly folded wings; rank 7 is the awakened apex.
- ALL DRAGON MOUTHS AT RANKS 1 THROUGH 6 ARE COMPLETELY CLOSED. No teeth, jaw gaps, or roars before rank 7.
- ONLY RANK 7 has both mouths clearly open, with visible jaw gaps, teeth, dark mouth cavities, and affinity-lit breath.

{name.title()} affinity language:
- Palette: {values['palette']}.
- Material behavior: {values['material']}.
- Ranks 1–2: 0% affinity, unchanged neutral charcoal/bronze low-rank frames.
- Rank 3: 15% affinity, only a small material hint in narrow recesses and the tiny crest.
- Rank 4: 35% affinity, visible but subordinate to the neutral iron/gold structure.
- Rank 5: 55% affinity, clear rail and dragon-body material behavior with restrained local emission.
- Rank 6: 75% affinity, stronger material transformation and energy while the closed-mouth elder silhouette remains readable.
- Rank 7: 100% affinity expression, strongest localized energy and breath light while retaining warm-gold stars and a broad clean opening.
- Affinity is a material and motion language, not a uniform color overlay.

Comparison labels:
Small black numerals 1, 2, 3, 4, 5, 6, 7 above the corresponding cards; no other text.

Style:
Premium cinematic fantasy-game card-frame concept art, symmetrical polished 3D ornamental metalwork, crisp silhouettes, clean studio lighting, high detail, restrained local emission, coherent rarity family.

Avoid:
{values['avoid']}, affinity color at ranks 1 or 2, immediate full affinity at rank 3, floating stars, incorrect star counts, non-gold stars, open mouths at ranks 1–6, closed mouths at rank 7, horizontal sprawl, narrow or obscured hero openings, inconsistent card sizes, heroes, scenery, perspective, crop, UI controls, browser chrome, logo, watermark, captions, or the word \"master\".
"""


def main() -> int:
    for rank in range(1, 8):
        write_new(ROOT / "prompts" / "highres" / f"neutral-rank-{rank}-exact.txt", highres_prompt(rank))
    for name, values in AFFINITIES.items():
        write_new(ROOT / "prompts" / "affinities" / f"{name}-seven-rank-exact.txt", affinity_prompt(name, values))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
