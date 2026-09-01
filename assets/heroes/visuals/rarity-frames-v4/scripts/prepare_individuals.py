#!/usr/bin/env python3
"""Create collision-safe rank crops and exact individual-frame prompts."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parents[3]

SHEETS = {
    "neutral": ROOT / "candidates/sheets/gemless-neutral-seven-rank-v1.png",
    "fire": WORKSPACE / "assets/heroes/visuals/rarity-frames-v3/candidates/sheets/affinity-fire-v1.png",
    "water": WORKSPACE / "assets/heroes/visuals/rarity-frames-v3/candidates/sheets/affinity-water-v1.png",
    "earth": WORKSPACE / "assets/heroes/visuals/rarity-frames-v3/candidates/sheets/affinity-earth-v1.png",
    "wind": WORKSPACE / "assets/heroes/visuals/rarity-frames-v3/candidates/sheets/affinity-wind-v1.png",
}

RANK_IDENTITIES = {
    1: "relatively rectangular forged frame with straight charcoal rails, restrained corner blocks, and minimal ornament; no dragon",
    2: "clearly horned low-rank silhouette with curved upper shoulders and stronger engraved relief; no dragon",
    3: "gothic prestige silhouette with elegant arcs and a forged central crest; no dragon",
    4: "paired small heraldic dragon heads at the upper shoulders, with both mouths completely closed",
    5: "two lean guardian dragons forming narrow vertical rail ornaments, with both mouths completely closed",
    6: "compact elder dragons, denser scale relief, and tightly folded wings following the outer rails, with both mouths completely closed and no visible teeth",
    7: "awakened apex dragons and larger wings growing upward/outward inside the fixed envelope, with both mouths clearly open in a roar",
}

AFFINITY_LANGUAGE = {
    "fire": "vermilion and ember-orange channels, soot-black recesses, heat-tempered metal, and contained flame or white-hot accents only in local recesses",
    "water": "deep blue-black and cobalt enamel, cyan current highlights, restrained pearl reflection, flowing engraved channels, and contained droplets",
    "earth": "ochre-gold, umber mineral surfaces, compact stone strata, restrained amber seams, and sparse settled dust",
    "wind": "pale grey-cyan and blue-silver reflection, deep navy recesses, swept fins, thin pressure traces, and restrained directional particles",
}

AFFINITY_STRENGTH = {3: 15, 4: 35, 5: 55, 6: 75, 7: 100}


def write_new(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        raise SystemExit(f"refusing existing file: {path}")
    path.write_text(content, encoding="utf-8")


def crop_sheets() -> None:
    for family, source in SHEETS.items():
        if not source.is_file():
            raise SystemExit(f"missing authority sheet: {source}")
        destination_directory = ROOT / "references/crops" / family
        destination_directory.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as image:
            if image.size != (2172, 724):
                raise SystemExit(f"unexpected authority geometry: {source} {image.size}")
            top = round(image.height * 0.14)
            bottom = round(image.height * 0.93)
            for index in range(7):
                cell_left = round(index * image.width / 7)
                cell_right = round((index + 1) * image.width / 7)
                inset = round((cell_right - cell_left) * 0.035)
                destination = destination_directory / f"{family}-rank-{index + 1}-crop-v1.png"
                if destination.exists():
                    raise SystemExit(f"refusing existing crop: {destination}")
                image.crop((cell_left + inset, top, cell_right - inset, bottom)).save(destination)


def common_geometry(rank: int) -> str:
    mouth = (
        "Both dragon mouths must be unmistakably open, with a visible jaw gap, upper and lower teeth, and a naturally dark mouth cavity."
        if rank == 7
        else "Every dragon mouth must be completely sealed: no jaw gap, visible teeth, roar, or open mouth."
    )
    return f"""Canvas and geometry:
- Exact 1024×1536 portrait RGB canvas, orthographic front view, clean warm-white background and empty warm-white hero opening.
- Exactly one complete centered frame; every outer ornament stays inside a shared target envelope from x=48 to x=976 and y=32 to y=1504, with no crop.
- Target clear internal hero-opening width is 700–760 pixels through the central half of the card. Across the complete 1–7 family, widest opening divided by narrowest opening must be no more than 1.20.
- Keep the horizontal bottom tray in the shared y=1290–1490 zone and keep the centered star row on the same baseline used by every family member.
- Dragon anatomy, wings, horns, claws, jaws, and effects hug the outer rails or grow upward/outward; nothing substantially invades the hero opening.
- {mouth}"""


def star_spec(rank: int) -> str:
    return f"""Integrated stars:
- The built-in tray contains exactly {rank} identical warm-gold star{'s' if rank != 1 else ''}, no more and no fewer.
- Stars are part of the illustrated frame object, physically inset or seated in the tray and sharing its lighting, bevel, shadows, and occlusion; they are never independent sprites.
- Preserve the accepted cute broad softly rounded upright five-point silhouette, cream-gold center, amber bevel, restrained warm glow, tight even spacing, and symmetric center-out arrangement.
- Stars appear nowhere else and never change color."""


def neutral_prompt(rank: int) -> str:
    return f"""Use case: stylized-concept
Asset type: high-resolution single-frame candidate for gemless neutral hero rarity rank {rank} of 7

Primary request:
Generate ONE new high-resolution portrait image containing exactly ONE complete empty rank-{rank} Summonlab hero-card frame. Re-render the rank-{rank} panel from the supplied gemless neutral authority sheet at true 1024×1536 detail. This must be a newly generated single-frame image, not an enlarged crop. Preserve the panel's silhouette, gemless dormant-metal identity, integrated star tray, exact star count, and coherent cinematic 3D metalwork family.

Input images:
- Reference image 1 is the complete gemless neutral seven-rank authority sheet. It owns cross-rank family, stable footprint, internal-width tolerance, tray baseline, material progression, star style, and mouth gate.
- Reference image 2 is the isolated rank-{rank} crop. It owns this rank's silhouette, ornaments, metal balance, mouth state, and exact star count. Ignore its label and dark comparison backdrop.

Rank identity:
{RANK_IDENTITIES[rank]}.

No-affinity material language:
- Dormant charcoal iron, neutral grey steel, and restrained antique-gold edge work only.
- No gemstone, crystal, sapphire, blue or colored enamel, colored eye, magical emission, breath light, or elemental cue.
- Dragon eyes, when present, are dark charcoal with only tiny ivory-white or pale-steel reflections and no emission.
- Rarity grows through silhouette, relief depth, scale density, wing mass, crown structure, and metal polish—not affinity color.

{common_geometry(rank)}

{star_spec(rank)}

Style:
Premium cinematic fantasy-game frame concept art, symmetrical polished 3D forged metalwork, crisp silhouette, realistic charcoal iron / grey steel / antique gold separation, matte low-emission response, clean studio lighting, high detail, and a broad empty opening.

Avoid:
multiple frames, enlarged crop, gems, crystals, blue, cyan, sapphire, colored eye glow, colored enamel, affinity effects, independent or floating stars, incorrect star count, different star shapes, label, text, hero, scenery, dark hero opening, horizontal sprawl, more than 20% family opening-width variation, open mouths before rank 7, closed mouths at rank 7, perspective, crop, logo, watermark, browser chrome, or the word "master".
"""


def affinity_prompt(family: str, rank: int) -> str:
    strength = AFFINITY_STRENGTH[rank]
    return f"""Use case: stylized-concept
Asset type: high-resolution single-frame candidate for {family} affinity hero rarity rank {rank} of 7

Primary request:
Generate ONE new high-resolution portrait image containing exactly ONE complete empty rank-{rank} Summonlab hero-card frame. Re-render the rank-{rank} panel from the supplied accepted {family} affinity sheet at true 1024×1536 detail. This must be a newly generated single-frame image, not an enlarged crop. Preserve the accepted affinity panel's silhouette, material language, integrated star tray, exact star count, mouth state, and cinematic 3D metalwork family while matching the supplied gemless neutral single's common canvas envelope and hero-opening width.

Input images:
- Reference image 1 is the complete accepted {family} affinity seven-rank sheet. It owns affinity material language, progression strength, silhouette, ornaments, mouth gate, tray, and star design.
- Reference image 2 is the isolated {family} rank-{rank} crop. It owns this panel's detailed affinity cues, exact star count, and composition. Ignore its label and dark comparison backdrop.
- Reference image 3 is the high-resolution gemless neutral rank-{rank} single. It owns the 1024×1536 outer envelope, internal opening width, tray position, and star baseline; do not copy its neutral materials over the affinity.

Rank identity:
{RANK_IDENTITIES[rank]}.

Affinity material language:
- Express {family.upper()} at approximately {strength}% strength using {AFFINITY_LANGUAGE[family]}.
- Affinity is localized material and motion behavior, never a uniform color wash.
- Preserve warm-gold stars exactly; affinity never changes their color or shape.

{common_geometry(rank)}

{star_spec(rank)}

Style:
Premium cinematic fantasy-game frame concept art, symmetrical polished 3D ornamental metalwork, crisp silhouette, clean studio lighting, controlled local emission, high detail, and a broad empty opening coherent with the accepted {family} sheet.

Avoid:
multiple frames, enlarged crop, affinity takeover, uniform color wash, effects obscuring the hero opening, independent or floating stars, incorrect star count, non-gold stars, label, text, hero, scenery, horizontal sprawl, more than 20% family opening-width variation, open mouths before rank 7, closed mouths at rank 7, perspective, crop, logo, watermark, browser chrome, or the word "master".
"""


def build_prompts() -> None:
    for rank in range(1, 8):
        write_new(
            ROOT / "prompts/individuals/neutral" / f"neutral-rank-{rank}-exact.txt",
            neutral_prompt(rank),
        )
    for family in AFFINITY_LANGUAGE:
        for rank in range(3, 8):
            write_new(
                ROOT / "prompts/individuals" / family / f"{family}-rank-{rank}-exact.txt",
                affinity_prompt(family, rank),
            )


def main() -> int:
    crop_sheets()
    build_prompts()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
