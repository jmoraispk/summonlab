#!/usr/bin/env python3
"""Materialize the frozen 200-active/20-reserve one-star hero roster.

The output is deliberately plain JSON.  It does not depend on the experiment's
schema implementation so the schema and preflight work can evolve independently.
Pixels are intentionally non-deterministic; this module only freezes design
coordinates, prompts, hashes, paths, and logical producer ownership.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import re
import stat
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence


EXPERIMENT_ID = "one-star-overnight-200-001"
PLAN_SCHEMA_VERSION = "hero-one-star-roster-plan-v1"
TARGET_SCHEMA_VERSION = "hero-one-star-image-target-v1"
ASSIGNMENT_SCHEMA_VERSION = "hero-one-star-image-assignment-v1"
PLANNING_SEED = "summonlab-heroes-200-2026-09-02-v1"
ACTIVE_COUNT = 200
RESERVE_COUNT = 20
PRODUCER_LANES = 12

SCRIPT_PATH = Path(__file__).resolve()
EXPERIMENT_ROOT = SCRIPT_PATH.parents[1]
HERO_EXPERIMENTS_ROOT = EXPERIMENT_ROOT.parent
WORKSPACE_ROOT = SCRIPT_PATH.parents[5]
CREATIVE_AUTHORITY = Path("assets/heroes/planning/one-star-overnight-200-plan.md")
STYLE_REFERENCE = Path(
    "assets/heroes/visuals/style-references/current-hero-rendering/ochre-braid-progression-reference.png"
)

ID_KEYS = frozenset(
    {
        "id",
        "targetId",
        "heroId",
        "candidateId",
        "assetId",
        "experimentId",
        "manifestId",
    }
)
NAME_KEYS = frozenset({"name", "displayName", "heroName"})

BODY_PER_GENDER = {
    "healthy-slight-lanky": 10,
    "ordinary-average": 10,
    "soft-round": 15,
    "sturdy-stocky": 15,
    "plus-size-heavy": 10,
    "athletic-conditioned": 20,
    "clearly-muscular": 17,
    "extreme-bodybuilder": 3,
}
HEIGHT_PER_GENDER = {
    "very-short": 5,
    "short": 15,
    "medium": 55,
    "tall": 20,
    "very-tall": 5,
}
AGE_PER_GENDER = {
    "18-22": 15,
    "23-29": 35,
    "30-36": 30,
    "37-42": 20,
}
ACTIVE_QUOTAS = {
    "gender": {"man": 100, "woman": 100},
    "hairColor": {
        "black": 36,
        "dark-brown": 30,
        "brown-chestnut": 24,
        "blonde-gold": 24,
        "red-copper-auburn": 20,
        "gray-white-silver": 14,
        "blue-teal": 18,
        "violet-plum-pink": 16,
        "multicolor-split-streak": 18,
    },
    "hairSilhouette": {
        "shaved-close-cropped": 24,
        "short-textured-crop": 28,
        "bob-pageboy": 16,
        "medium-loose": 18,
        "long-loose": 18,
        "braids-twists-locs": 30,
        "curls-coils-halo": 22,
        "bun-topknot-wrapped": 20,
        "asymmetric-extreme": 24,
    },
    "skinValue": {
        "band-1-lightest": 24,
        "band-2-light": 30,
        "band-3-light-medium": 34,
        "band-4-medium": 38,
        "band-5-medium-deep": 38,
        "band-6-deepest": 36,
    },
    "wardrobe": {
        "layered-wrap": 20,
        "short-jacket-trousers": 20,
        "tailored-longcoat": 20,
        "tunic-tabard": 20,
        "apron-workwear-layers": 20,
        "quilted-outerwear": 20,
        "draped-robe": 20,
        "mantle-short-cape": 20,
        "fitted-vest-system": 20,
        "asymmetric-patchwork": 20,
    },
    "palette": {
        "ochre-cream": 20,
        "rust-charcoal": 20,
        "teal-brown": 20,
        "indigo-sand": 20,
        "plum-gray": 20,
        "moss-ivory": 20,
        "marigold-green": 20,
        "oxblood-navy": 20,
        "lilac-smoke": 20,
        "terracotta-black": 20,
    },
    "detailDensity": {"none": 50, "one": 70, "two": 55, "three": 25},
    "tattoo": {"none": 150, "bounded": 40, "extensive": 10},
    "coolnessAnchor": {
        "hairstyle-construction": 25,
        "garment-silhouette": 25,
        "color-blocking": 25,
        "textile-detail": 25,
        "body-or-posture": 25,
        "repairs-patina-keepsake": 25,
        "jewelry-hardware": 25,
        "durable-body-marking": 25,
    },
}

BODY_DESCRIPTIONS = {
    "healthy-slight-lanky": "healthy slight, narrow, long-limbed construction with low mass",
    "ordinary-average": "ordinary lean-to-average construction without visible definition",
    "soft-round": "unmistakably soft rounded construction with a clearly evident, naturally wider middle, short-to-average limbs, no cinched or flat waist, and gentle limb contours",
    "sturdy-stocky": "sturdy stocky construction with a broad frame and compact proportions",
    "plus-size-heavy": "plus-size heavy construction with substantial natural mass",
    "athletic-conditioned": "conditioned athletic construction with functional tone but no ripped definition",
    "clearly-muscular": "clearly muscular construction with readable shoulders, back, legs, and forearms",
    "extreme-bodybuilder": "exceptional bodybuilder construction with enormous but coherent human muscle mass",
}
HEIGHT_RANGES_CM = {
    "very-short": (148, 154),
    "short": (155, 163),
    "medium": (164, 177),
    "tall": (178, 188),
    "very-tall": (189, 199),
}
AGE_RANGES = {"18-22": (18, 22), "23-29": (23, 29), "30-36": (30, 36), "37-42": (37, 42)}

FACE_SHAPES = (
    "broad oval face",
    "long narrow face",
    "square compact face",
    "heart-shaped face",
    "round full face",
    "angular diamond face",
    "soft rectangular face",
    "wide triangular face",
)
FACE_DETAILS = (
    "wide-set eyes and a low straight brow",
    "close-set eyes and a high arched brow",
    "deep-set eyes and a heavy level brow",
    "large hooded eyes and a broken brow line",
    "small bright eyes and fine straight brows",
    "asymmetric brows and broad cheek planes",
    "high cheekbones and softly lidded eyes",
    "full cheeks and sharply defined brows",
)
NOSE_LIP_DETAILS = (
    "broad low bridge, full lips",
    "long straight nose, narrow upper lip",
    "short rounded nose, wide mouth",
    "aquiline nose, softly full mouth",
    "flat broad nose, defined cupid's bow",
    "small upturned nose, heavy lower lip",
    "crooked healed nose, balanced mouth",
    "prominent bridge, compact mouth",
)

HAIR_ACCENTS = {
    "shaved-close-cropped": ("shaved temple geometry", "one offset razor line", "sculpted edge pattern"),
    "short-textured-crop": ("contrasting side length", "sculptural fringe", "one clipped color panel"),
    "bob-pageboy": ("hidden undercut", "sharply stepped fringe", "one longer face-framing section"),
    "medium-loose": ("offset braid", "wrapped side section", "contrasting clipped section"),
    "long-loose": ("one bound side fall", "beaded narrow braid", "strong split-length construction"),
    "braids-twists-locs": ("offset braid mass", "rings on three strands", "wrapped central section"),
    "curls-coils-halo": ("asymmetric curl shelf", "one shaved side", "high gathered coil mass"),
    "bun-topknot-wrapped": ("architectural high knot", "wrapped contrasting band", "offset gathered mass"),
    "asymmetric-extreme": ("dramatic contrasting side length", "sculptural diagonal fringe", "segmented wrapped crest"),
}

WARDROBE_DETAILS = {
    "layered-wrap": "overlapping wrap panels, an off-center waist tie, divided trousers, and soft boots",
    "short-jacket-trousers": "a shaped short jacket, practical closures, generous trousers, and low boots",
    "tailored-longcoat": "a cloth longcoat with a readable waist, split hem, plain underlayer, and fitted shoes",
    "tunic-tabard": "a long tunic and split tabard over loose trousers with wrapped ankles",
    "apron-workwear-layers": "a work shirt, asymmetrical apron layers, reinforced trousers, and sturdy shoes",
    "quilted-outerwear": "lightly quilted cloth outerwear over a simple fitted layer and tapered trousers",
    "draped-robe": "a draped robe whose belting and openings keep the body construction legible",
    "mantle-short-cape": "a small mantle or short cape over an unarmored tunic and divided lower layers",
    "fitted-vest-system": "a fitted cloth vest system over a soft shirt, high-waist trousers, and flexible boots",
    "asymmetric-patchwork": "intentional patchwork layers with an uneven hem, visible repairs, and practical trousers",
}

DOMINANT_TRAITS = (
    "incisively curious", "ceremoniously hospitable", "unyieldingly exact", "mischievously competitive",
    "protectively vigilant", "restlessly inventive", "bluntly candid", "patiently skeptical",
    "quietly audacious", "fiercely attentive", "wryly theatrical", "methodically adventurous",
    "proudly self-reliant", "intensely convivial", "deliberately enigmatic", "warmly argumentative",
    "disciplined but playful", "fearlessly inquisitive", "earnestly irreverent", "tenderly stubborn",
    "fastidiously expressive", "serenely contrarian", "boisterously meticulous", "guardedly generous",
    "dryly perceptive", "impatiently practical", "boldly gracious", "solemnly humorous",
)
COUNTER_TRAITS = (
    "privately doubts first impressions", "softens around nervous strangers", "abandons plans for a worthy surprise",
    "hates being the center of a room", "is sentimental about damaged objects", "becomes tongue-tied when praised",
    "keeps one ridiculous superstition", "is careless only with personal comfort", "avoids conflict until a boundary breaks",
    "is secretly delighted by ceremony", "forgives mistakes faster than excuses", "needs long silences after crowds",
    "collects tiny impractical luxuries", "finds formal authority faintly funny", "is patient with novices, never experts",
    "cannot resist correcting a crooked seam", "turns gentle when work becomes difficult", "conceals a strong competitive streak",
    "prefers improvisation despite careful grooming", "is disorganized behind a polished exterior",
)
SOCIAL_PRESENTATIONS = (
    "guarded and formal", "open and attentive", "blunt and economical", "playful but watchful",
    "calm and appraising", "restless and magnetic", "reserved with dry humor", "warm but imposing",
    "precise and courteous", "candid and unhurried", "soft-spoken and immovable", "lively and skeptical",
    "aloof until engaged", "earnest and intense", "relaxed but exacting", "ceremonial with a teasing edge",
)
GROOMING_ATTITUDES = (
    "meticulous daily maintenance", "practical grooming with one carefully perfected detail",
    "deliberately tousled but clean", "immaculate clothes over weathered hands",
    "visible mending treated as prideful craft", "severe grooming softened by one unruly feature",
    "low-maintenance grooming with highly polished footwear", "ornate hair maintenance with plain clothing care",
)
COLOR_CONFIDENCE = (
    "uses the palette boldly in large blocks", "keeps color restrained to layered edges",
    "balances one confident color field against quiet neutrals", "uses small rhythmic repeats of the palette",
    "lets faded and repaired areas vary the palette", "uses high-contrast lining visible only in motion",
)
ORNAMENT_TOLERANCE = (
    "avoids ornament unless it serves a fastening purpose", "accepts one cherished personal detail",
    "enjoys two mismatched personal details", "wears several deliberate anchors without looking elite",
)
CULTURAL_MATERIALS = (
    "prefers handloom cloth with visible slubs", "recognizes waxed cord as a sign of care",
    "values carved wood closures over metal", "treats patched quilting as honorable craft",
    "favors narrow geometric woven borders", "uses folded cloth as a formal greeting token",
    "keeps tiny bells muted with thread", "likes burnished clay beads and matte surfaces",
    "reads knot patterns as personal signatures", "prefers basket-woven panels for durable pockets",
)
CULTURAL_CUSTOMS = (
    "touches two fingers to the collar before greeting", "offers the warmest drink to the quietest guest",
    "turns repaired seams outward during celebrations", "leaves one closure deliberately unmatched for luck",
    "folds shared cloth inward to signal trust", "never crosses a threshold with footwear unlaced",
    "uses food spice order to mark seasons", "taps a cup once before serious conversation",
    "gives bright thread as a promise of return", "wears travel dust until the first shared meal",
)
LIFE_ECHOES = (
    "textile work", "field labor", "study", "medicine", "trade", "travel", "performance",
    "administration", "ritual practice", "construction", "domestic care", "food preparation",
    "book repair", "dye making", "animal care", "cartography", "pottery", "public correspondence",
)
POSE_CUES = (
    "one thumb hooks lightly beneath the waist wrap while the other hand rests open",
    "weight settles into one heel, shoulders square, hands relaxed and completely visible",
    "chin remains level while one hand lightly checks a cuff seam",
    "stance is broad and still, with one palm turned slightly upward",
    "torso angles three-quarter while both arms hang in deliberate asymmetric ease",
    "one shoulder leads subtly and the gaze meets the viewer without a smile",
    "feet plant evenly while fingertips touch a small personal keepsake",
    "posture is upright but not military, with wrists loose and hands readable",
)
PERSONAL_OBJECTS = (
    "a tiny cloth-wrapped notebook", "a wooden thread gauge", "a folded handkerchief",
    "a clay tea token", "a blunt carpenter's chalk", "a string-bound recipe leaf",
    "a small empty medicine pouch", "a polished seed case", "a travel tally cord",
    "a bone-free wooden comb", "a worn spool of colored thread", "a palm-sized map roll",
)
ANCHOR_DETAILS = (
    "one mismatched earring", "a narrow bracelet stack", "a small throat necklace", "two plain rings",
    "a shaped cloth clasp", "one wide engraved hair cuff on one side, with no other hair or ear jewelry", "a repaired cuff with bright thread", "a shallow cheek scar",
    "a dense freckle field", "a carved belt buckle", "a wrapped keepsake cord", "one asymmetric ear cuff",
    "a patterned collar insert", "contrasting boot laces", "a hand-painted hem mark", "a tiny nose stud",
)
TATTOO_DETAILS = {
    "bounded": (
        "one bounded geometric forearm tattoo", "one small nape tattoo", "a narrow tattoo cuff",
        "one hand-sized botanical shoulder tattoo", "a compact finger-line tattoo family",
    ),
    "extensive": (
        "an extensive but nonmagical geometric tattoo language across both arms",
        "an extensive matte botanical tattoo language over one shoulder, torso edge, and forearm",
        "an extensive patchwork of ordinary ink marks across the arms and upper back",
    ),
}

COOLNESS_VISUALS = {
    "hairstyle-construction": "Make the hair construction the primary recognition silhouette.",
    "garment-silhouette": "Make the garment hem and outer silhouette the primary recognition device.",
    "color-blocking": "Make unusual but bounded color blocking the primary recognition device.",
    "textile-detail": "Make stitching, quilting, embroidery, or woven pattern the primary recognition device.",
    "body-or-posture": "Make body construction and habitual posture the primary recognition device.",
    "repairs-patina-keepsake": "Make repair, patina, customization, or a keepsake the primary recognition device.",
    "jewelry-hardware": "Make one clasp, buckle, piercing, or piece of hair hardware the primary recognition device.",
    "durable-body-marking": "Make a tattoo, scar, freckle field, or birthmark the primary recognition device.",
}

GIVEN_ONSETS = (
    "ad", "ae", "bel", "brin", "cal", "cor", "dai", "del", "eir", "el", "fen", "gal",
    "hal", "ian", "is", "jor", "ka", "kel", "lan", "lor", "mei", "nel", "or", "per",
    "quin", "ra", "sen", "tal", "ul", "val", "wen", "yas", "zel",
)
GIVEN_ENDINGS = ("a", "an", "ar", "el", "en", "i", "ia", "in", "is", "o", "on", "or", "u", "yn")
FAMILY_ONSETS = (
    "amar", "bel", "cor", "dren", "esh", "fal", "grel", "hal", "iver", "jor", "kesh", "lor",
    "mor", "neth", "or", "pell", "quor", "resh", "sor", "tav", "ulen", "vesh", "wyr", "zhar",
)
FAMILY_ENDINGS = ("a", "ai", "an", "ar", "ek", "el", "en", "eth", "i", "in", "o", "or", "un")

ACCEPTANCE_CRITERIA = (
    ("one-adult", "Exactly one adult hero; no duplicated body or anatomy."),
    ("complete-full-body", "Full head, both hands, and both feet are visible with safe margin."),
    ("painted-register", "Cinematic semi-realistic painted drawing, visibly painterly and not photographic or cel-anime."),
    ("manifest-fidelity", "Body, height, age, skin, hair, clothing, palette, and detail manifest remain legible."),
    ("neutral-expression", "Calm neutral expression without smile, grin, or theatrical acting."),
    ("one-star-ceiling", "Ordinary mortal presentation with no weapon, magic, affinity cue, elite armor, frame, star, UI, or text."),
    ("original-identity", "Does not reproduce a declared style reference's face, body, hair, or outfit."),
)


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def canonical_sha256(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_rng(label: str, seed: str = PLANNING_SEED) -> random.Random:
    material = hashlib.sha256(f"{seed}:{label}".encode("utf-8")).digest()
    return random.Random(int.from_bytes(material, "big"))


def normalize_name(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value).casefold()
    return "".join(character for character in folded if character.isalnum())


def slugify(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", folded).strip("-")
    if not slug:
        raise ValueError(f"cannot create ID from name: {value!r}")
    return slug


def _walk_identity_fields(value: Any, ids: set[str], names: set[str]) -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            if isinstance(item, str) and key in ID_KEYS:
                ids.add(item.casefold())
            if isinstance(item, str) and key in NAME_KEYS:
                names.add(normalize_name(item))
            _walk_identity_fields(item, ids, names)
    elif isinstance(value, list):
        for item in value:
            _walk_identity_fields(item, ids, names)


def collect_existing_identity_keys(experiments_root: Path = HERO_EXPERIMENTS_ROOT) -> tuple[set[str], set[str]]:
    """Collect IDs and normalized names from every other Heroes experiment JSON."""

    ids: set[str] = set()
    names: set[str] = set()
    for path in sorted(experiments_root.rglob("*.json")):
        if EXPERIMENT_ID in path.parts:
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ValueError(f"cannot scan Heroes identity source {path}: {error}") from error
        _walk_identity_fields(data, ids, names)
    return ids, names


def expand_counts(counts: Mapping[str, int], label: str) -> list[str]:
    values = [value for value, count in counts.items() for _ in range(count)]
    stable_rng(label).shuffle(values)
    return values


def assign_per_gender(
    genders: Sequence[str], counts: Mapping[str, int], label: str
) -> list[str]:
    assignments = [""] * len(genders)
    for gender in ("man", "woman"):
        indices = [index for index, value in enumerate(genders) if value == gender]
        values = expand_counts(counts, f"{label}:{gender}")
        if len(indices) != len(values):
            raise ValueError(f"{label} quota does not fill {gender} indices")
        for index, value in zip(indices, values, strict=True):
            assignments[index] = value
    return assignments


def generate_names(count: int, existing_ids: set[str], existing_names: set[str]) -> list[tuple[str, str]]:
    first_names = sorted(
        {f"{onset}{ending}".title() for onset in GIVEN_ONSETS for ending in GIVEN_ENDINGS if len(onset + ending) >= 3}
    )
    family_names = sorted({f"{onset}{ending}".title() for onset in FAMILY_ONSETS for ending in FAMILY_ENDINGS})
    combinations = [(first, family) for first in first_names for family in family_names if first != family]
    stable_rng("names").shuffle(combinations)

    chosen: list[tuple[str, str]] = []
    used_ids = set(existing_ids)
    used_names = set(existing_names)
    for first, family in combinations:
        display_name = f"{first} {family}"
        hero_id = slugify(display_name)
        normalized = normalize_name(display_name)
        if hero_id.casefold() in used_ids or normalized in used_names:
            continue
        chosen.append((hero_id, display_name))
        used_ids.add(hero_id.casefold())
        used_names.add(normalized)
        if len(chosen) == count:
            return chosen
    raise ValueError(f"name deck could not supply {count} collision-free identities")


def constrained_coolness(detail_density: Sequence[str], tattoos: Sequence[str]) -> list[str]:
    assignments = [""] * ACTIVE_COUNT
    marking_eligible = [index for index, density in enumerate(detail_density) if density != "none"]
    stable_rng("coolness:body-marking-eligible").shuffle(marking_eligible)
    marking_eligible.sort(key=lambda index: tattoos[index] == "none")
    for index in marking_eligible[:25]:
        assignments[index] = "durable-body-marking"
    hardware_eligible = [
        index
        for index, density in enumerate(detail_density)
        if density != "none"
        and not assignments[index]
        and not (density == "one" and tattoos[index] != "none")
    ]
    stable_rng("coolness:hardware-eligible").shuffle(hardware_eligible)
    for index in hardware_eligible[:25]:
        assignments[index] = "jewelry-hardware"
    remaining_indices = [index for index, value in enumerate(assignments) if not value]
    remaining_counts = dict(ACTIVE_QUOTAS["coolnessAnchor"])
    del remaining_counts["durable-body-marking"]
    del remaining_counts["jewelry-hardware"]
    remaining_values = expand_counts(remaining_counts, "coolness:remaining")
    for index, value in zip(remaining_indices, remaining_values, strict=True):
        assignments[index] = value
    return assignments


def constrained_tattoos(detail_density: Sequence[str]) -> list[str]:
    assignments = ["none"] * ACTIVE_COUNT
    eligible = [index for index, density in enumerate(detail_density) if density != "none"]
    stable_rng("tattoo:eligible").shuffle(eligible)
    for index in eligible[:10]:
        assignments[index] = "extensive"
    for index in eligible[10:50]:
        assignments[index] = "bounded"
    return assignments


def build_active_allocations() -> dict[str, list[str]]:
    genders = ["man"] * 100 + ["woman"] * 100
    stable_rng("gender").shuffle(genders)
    detail_density = expand_counts(ACTIVE_QUOTAS["detailDensity"], "detail-density")
    tattoos = constrained_tattoos(detail_density)
    hair_accent = ["present"] * 120 + ["none"] * 80
    stable_rng("hair-accent").shuffle(hair_accent)
    return {
        "gender": genders,
        "body": assign_per_gender(genders, BODY_PER_GENDER, "body"),
        "height": assign_per_gender(genders, HEIGHT_PER_GENDER, "height"),
        "ageBand": assign_per_gender(genders, AGE_PER_GENDER, "age"),
        "hairColor": expand_counts(ACTIVE_QUOTAS["hairColor"], "hair-color"),
        "hairSilhouette": expand_counts(ACTIVE_QUOTAS["hairSilhouette"], "hair-silhouette"),
        "hairAccent": hair_accent,
        "skinValue": expand_counts(ACTIVE_QUOTAS["skinValue"], "skin-value"),
        "wardrobe": expand_counts(ACTIVE_QUOTAS["wardrobe"], "wardrobe"),
        "palette": expand_counts(ACTIVE_QUOTAS["palette"], "palette"),
        "detailDensity": detail_density,
        "tattoo": tattoos,
        "coolnessAnchor": constrained_coolness(detail_density, tattoos),
    }


def build_reserve_allocations() -> dict[str, list[str]]:
    genders = ["man"] * 10 + ["woman"] * 10
    stable_rng("reserve:gender").shuffle(genders)
    categories = {
        "gender": genders,
        "body": list(BODY_PER_GENDER),
        "height": list(HEIGHT_PER_GENDER),
        "ageBand": list(AGE_PER_GENDER),
        "hairColor": list(ACTIVE_QUOTAS["hairColor"]),
        "hairSilhouette": list(ACTIVE_QUOTAS["hairSilhouette"]),
        "skinValue": list(ACTIVE_QUOTAS["skinValue"]),
        "wardrobe": list(ACTIVE_QUOTAS["wardrobe"]),
        "palette": list(ACTIVE_QUOTAS["palette"]),
        "detailDensity": list(ACTIVE_QUOTAS["detailDensity"]),
        "tattoo": list(ACTIVE_QUOTAS["tattoo"]),
        "coolnessAnchor": list(ACTIVE_QUOTAS["coolnessAnchor"]),
    }
    output: dict[str, list[str]] = {"gender": genders}
    for key, values in categories.items():
        if key == "gender":
            continue
        deck = [values[index % len(values)] for index in range(RESERVE_COUNT)]
        stable_rng(f"reserve:{key}").shuffle(deck)
        output[key] = deck
    hair_accent = ["present"] * 12 + ["none"] * 8
    stable_rng("reserve:hair-accent").shuffle(hair_accent)
    output["hairAccent"] = hair_accent

    # Repair impossible reserve combinations without claiming quota semantics.
    for index, density in enumerate(output["detailDensity"]):
        if density == "none":
            output["tattoo"][index] = "none"
            if output["coolnessAnchor"][index] == "durable-body-marking":
                output["coolnessAnchor"][index] = "body-or-posture"
    return output


def pick(label: str, values: Sequence[str]) -> str:
    return stable_rng(label).choice(values)


def visible_anchors(hero_id: str, density: str, tattoo: str, coolness_anchor: str) -> list[str]:
    counts = {"none": 0, "one": 1, "two": 2, "three": 3}
    required = counts[density]
    if required == 0:
        return []
    anchors: list[str] = []
    if tattoo != "none":
        anchors.append(pick(f"{hero_id}:tattoo", TATTOO_DETAILS[tattoo]))
    if coolness_anchor == "durable-body-marking" and tattoo == "none":
        anchors.append(
            pick(
                f"{hero_id}:body-marking",
                ("a shallow cheek scar", "a dense freckle field", "one clear birthmark", "a healed brow scar"),
            )
        )
    if coolness_anchor == "jewelry-hardware":
        anchors.append(
            pick(
                f"{hero_id}:hardware",
                ("one mismatched earring", "a carved belt buckle", "one wide engraved hair cuff on one side, with no other hair or ear jewelry", "one shaped cloth clasp"),
            )
        )
    anchors = list(dict.fromkeys(anchors))
    if len(anchors) > required:
        raise ValueError(f"{hero_id} has more required recognition anchors than its detail density")
    deck = list(ANCHOR_DETAILS)
    stable_rng(f"{hero_id}:anchors").shuffle(deck)
    for anchor in deck:
        if len(anchors) == required:
            break
        if anchor not in anchors:
            anchors.append(anchor)
    return anchors


def build_kernel(hero_id: str, ordinal: int) -> dict[str, Any]:
    # Unique four-part combinations make the strength gate explicit and auditable.
    dominant = DOMINANT_TRAITS[ordinal % len(DOMINANT_TRAITS)]
    counter = COUNTER_TRAITS[(ordinal * 7 + 3) % len(COUNTER_TRAITS)]
    social = SOCIAL_PRESENTATIONS[(ordinal * 11 + 5) % len(SOCIAL_PRESENTATIONS)]
    pose = POSE_CUES[(ordinal * 5 + 1) % len(POSE_CUES)]
    return {
        "dominantTrait": dominant,
        "counterTrait": counter,
        "tension": f"Appears {social}, yet {counter}.",
        "socialPresentation": social,
        "groomingMaintenance": pick(f"{hero_id}:grooming", GROOMING_ATTITUDES),
        "colorConfidence": pick(f"{hero_id}:color-confidence", COLOR_CONFIDENCE),
        "ornamentTolerance": pick(f"{hero_id}:ornament", ORNAMENT_TOLERANCE),
        "culturalFragments": [
            pick(f"{hero_id}:culture:material", CULTURAL_MATERIALS),
            pick(f"{hero_id}:culture:custom", CULTURAL_CUSTOMS),
        ],
        "lifeEchoNoncanonical": pick(f"{hero_id}:life-echo", LIFE_ECHOES),
        "drawablePoseCue": pose,
        "personalObject": pick(f"{hero_id}:object", PERSONAL_OBJECTS),
        "mustNotInfer": (
            "Do not infer aptitude, intelligence, spirit, morality, combat role, rarity, or biography "
            "from body, face, gender, skin, age, or phenotype."
        ),
        "strengthSignature": canonical_sha256([dominant, counter, social, pose])[:16],
    }


def build_physical_manifest(
    hero_id: str, allocation: Mapping[str, str], active: bool, ordinal: int
) -> dict[str, Any]:
    age_range = AGE_RANGES[allocation["ageBand"]]
    height_range = HEIGHT_RANGES_CM[allocation["height"]]
    age = stable_rng(f"{hero_id}:age").randint(*age_range)
    height_cm = stable_rng(f"{hero_id}:height").randint(*height_range)
    hair_accent = "none"
    if allocation["hairAccent"] == "present":
        hair_accent = pick(
            f"{hero_id}:hair-accent", HAIR_ACCENTS[allocation["hairSilhouette"]]
        )
    anchors = visible_anchors(
        hero_id,
        allocation["detailDensity"],
        allocation["tattoo"],
        allocation["coolnessAnchor"],
    )
    return {
        "genderPresentation": allocation["gender"],
        "adultAge": age,
        "ageBand": allocation["ageBand"],
        "heightBand": allocation["height"],
        "heightCm": height_cm,
        "bodyConstruction": allocation["body"],
        "bodyDescription": BODY_DESCRIPTIONS[allocation["body"]],
        "skinValueBand": allocation["skinValue"],
        "face": {
            "shape": pick(f"{hero_id}:face-shape", FACE_SHAPES),
            "eyesAndBrow": pick(f"{hero_id}:eyes-brow", FACE_DETAILS),
            "noseAndMouth": pick(f"{hero_id}:nose-mouth", NOSE_LIP_DETAILS),
            "durableDetail": pick(
                f"{hero_id}:face-detail",
                ("one cheek mole", "subtle age lines", "faint freckles", "one brow notch", "no added facial mark"),
            ),
        },
        "hair": {
            "dominantColor": allocation["hairColor"],
            "primarySilhouette": allocation["hairSilhouette"],
            "deliberateAccent": hair_accent,
            "chibiReadability": (
                f"Preserve the front and side silhouette of {allocation['hairSilhouette']}, the parting, "
                f"gathered mass, shaved areas, and {hair_accent}; color remains {allocation['hairColor']}."
            ),
        },
        "wardrobe": {
            "constructionFamily": allocation["wardrobe"],
            "construction": WARDROBE_DETAILS[allocation["wardrobe"]],
            "paletteFamily": allocation["palette"],
            "detailVariation": pick(
                f"{hero_id}:wardrobe-detail",
                (
                    "offset closures and narrow reinforced cuffs",
                    "a divided hem and broad folded collar",
                    "rolled sleeves and one architectural lapel",
                    "visible hand repairs and contrasting inner edges",
                    "a high soft collar and uneven layered hems",
                    "low-profile toggles and articulated knee folds",
                ),
            ),
        },
        "personalDetails": {
            "density": allocation["detailDensity"],
            "tattooLanguage": allocation["tattoo"],
            "visibleAnchors": anchors,
        },
        "primaryCoolnessAnchor": allocation["coolnessAnchor"],
        "coolnessDirection": COOLNESS_VISUALS[allocation["coolnessAnchor"]],
        "nativeStars": 1,
        "currentStars": 1,
        "rosterRole": "active" if active else "reserve",
        "designOrdinal": ordinal + 1,
    }


def render_summon_prompt(display_name: str, manifest: Mapping[str, Any], kernel: Mapping[str, Any]) -> str:
    face = manifest["face"]
    hair = manifest["hair"]
    wardrobe = manifest["wardrobe"]
    details = manifest["personalDetails"]
    anchors = "; ".join(details["visibleAnchors"]) if details["visibleAnchors"] else "no accessory and no tattoo"
    return (
        "Create one original Summonlab candidate summon portrait as a cinematic semi-realistic painted drawing. "
        "Use visible brush planes and controlled illustrative detail: not a photograph, not photoreal skin, not plastic 3D, "
        "and not cel anime. Portrait canvas 1024 x 1536. Exactly one weaponless adult, full body, three-quarter standing pose, "
        "with the entire head, both hands, both feet, hair, clothing, and all accessories fully inside a generous safe margin. "
        "Warm pale parchment studio wash, restrained warm color response, soft grounding shadow, no environmental story.\n\n"
        f"New identity {display_name}: {manifest['adultAge']}-year-old {manifest['genderPresentation']}, "
        f"{manifest['heightCm']} cm ({manifest['heightBand']}), {manifest['bodyDescription']}, "
        f"skin value {manifest['skinValueBand']}. Face: {face['shape']}; {face['eyesAndBrow']}; "
        f"{face['noseAndMouth']}; {face['durableDetail']}. Calm closed-mouth neutral expression with no smile, grin, or theatrical acting.\n\n"
        f"Hair: {hair['dominantColor']}, {hair['primarySilhouette']}, deliberate accent: {hair['deliberateAccent']}. "
        f"Wardrobe: {wardrobe['constructionFamily']}, specifically {wardrobe['construction']}; "
        f"{wardrobe['detailVariation']}; bounded palette {wardrobe['paletteFamily']}. "
        f"Visible personal details: {anchors}. {manifest['coolnessDirection']} "
        f"Maintenance cue: {kernel['groomingMaintenance']}. Color treatment: {kernel['colorConfidence']}. "
        f"Pose cue: {kernel['drawablePoseCue']}. Include {kernel['personalObject']} only as a quiet personal object, never as a weapon.\n\n"
        "This is ordinary but intentionally designed 1-star mortal clothing. No weapon, armor, crown, magic, aura, or glow. "
        "No affinity cue, elemental gem, floating, frame, printed star, number, UI, logo, watermark, text, extra person, "
        "duplicated anatomy, cropped extremity, or published-character resemblance. Fantasy hair colors are matte dye or pigment, "
        "never supernatural emission. Preserve plausible anatomy while allowing the declared body construction to be extreme. "
        "Do not copy the reference's person, braid, clothes, pose, palette, progression, identity, body, hair, "
        "garments, ornaments, or markings."
    )


def wave_paths(hero_id: str, wave_id: str) -> dict[str, str]:
    root = f"assets/heroes/experiments/{EXPERIMENT_ID}/waves/{wave_id}"
    return {
        "target": f"{root}/targets/{hero_id}/summon-v1.json",
        "assignment": f"{root}/assignments/{hero_id}/summon-v1.json",
        "candidate": f"{root}/candidates/{hero_id}/summon-v1.png",
        "result": f"{root}/results/{hero_id}/summon-v1.json",
        "preview": f"{root}/review/{hero_id}/summon-v1.webp",
        "futureChibiCandidate": f"{root}/candidates/{hero_id}/combat-chibi-v1.png",
        "futureChibiResult": f"{root}/results/{hero_id}/combat-chibi-v1.json",
        "futureChibiPreview": f"{root}/review/{hero_id}/combat-chibi-v1.webp",
    }


def make_packet(
    hero_id: str,
    display_name: str,
    allocation: Mapping[str, str],
    active: bool,
    ordinal: int,
    reference_sha256: str,
) -> dict[str, Any]:
    wave_id = f"wave-{ordinal // 20 + 1:02d}" if active else "wave-11"
    manifest = build_physical_manifest(hero_id, allocation, active, ordinal)
    kernel = build_kernel(hero_id, ordinal)
    prompt_text = render_summon_prompt(display_name, manifest, kernel)
    paths = wave_paths(hero_id, wave_id)
    identity_signature = canonical_sha256(
        [display_name, manifest, kernel, allocation["coolnessAnchor"]]
    )
    target_id = f"{hero_id}-summon-v1"
    detail_density = {"none": 0, "one": 1, "two": 2, "three": 3}[
        allocation["detailDensity"]
    ]
    face = manifest["face"]
    hero_spec = {
        "identity": {
            "displayName": display_name,
            "gender": manifest["genderPresentation"],
            "age": manifest["adultAge"],
            "skinValueBand": int(manifest["skinValueBand"].split("-")[1]),
            "faceDescription": "; ".join(
                [face["shape"], face["eyesAndBrow"], face["noseAndMouth"], face["durableDetail"]]
            ),
            "identitySignature": identity_signature,
        },
        "physique": {
            "bodyType": manifest["bodyConstruction"],
            "heightBand": manifest["heightBand"],
            "description": f"{manifest['heightCm']} cm; {manifest['bodyDescription']}.",
        },
        "hair": {
            "colorFamily": manifest["hair"]["dominantColor"],
            "silhouetteFamily": manifest["hair"]["primarySilhouette"],
            "accent": (
                None
                if manifest["hair"]["deliberateAccent"] == "none"
                else manifest["hair"]["deliberateAccent"]
            ),
            "chibiReadability": manifest["hair"]["chibiReadability"],
        },
        "wardrobe": {
            "family": manifest["wardrobe"]["constructionFamily"],
            "paletteFamily": manifest["wardrobe"]["paletteFamily"],
            "description": (
                f"{manifest['wardrobe']['construction']}; "
                f"{manifest['wardrobe']['detailVariation']}."
            ),
            "condition": kernel["groomingMaintenance"],
        },
        "details": {
            "density": detail_density,
            "tattooScope": manifest["personalDetails"]["tattooLanguage"],
            "anchors": manifest["personalDetails"]["visibleAnchors"],
            "coolnessAnchor": manifest["primaryCoolnessAnchor"],
        },
        "kernel": {
            "dominantTrait": kernel["dominantTrait"],
            "counterTrait": kernel["counterTrait"],
            "tension": kernel["tension"],
            "socialPresentation": kernel["socialPresentation"],
            "groomingAttitude": kernel["groomingMaintenance"],
            "colorOrnamentTaste": (
                f"{kernel['colorConfidence']}; {kernel['ornamentTolerance']}."
            ),
            "culturalFragments": kernel["culturalFragments"],
            "lifeEcho": kernel["lifeEchoNoncanonical"],
            "poseCue": kernel["drawablePoseCue"],
            "nonInference": kernel["mustNotInfer"],
        },
    }
    target = {
        "schemaVersion": TARGET_SCHEMA_VERSION,
        "targetId": target_id,
        "targetVersion": 1,
        "experimentId": EXPERIMENT_ID,
        "waveId": wave_id,
        "heroId": hero_id,
        "imageKind": "summon",
        "starLevel": 1,
        "productionState": "candidate-only",
        "heroSpec": hero_spec,
        "references": [
            {
                "path": STYLE_REFERENCE.as_posix(),
                "sha256": reference_sha256,
                "purpose": (
                    "Rendering-register reference only: painterly realism ceiling, full-body parchment composition, "
                    "and warm color handling. Do not transfer its person, braid, clothes, pose, palette, progression, "
                    "identity, phenotype, anatomy, hair, wardrobe, or accessories."
                ),
                "role": "rendering-style",
            }
        ],
        "canonicalPrompt": {
            "text": prompt_text,
            "sha256": hashlib.sha256(prompt_text.encode("utf-8")).hexdigest(),
        },
        "presentation": {
            "width": 1024,
            "height": 1536,
            "mediaType": "image/png",
            "composition": (
                "Exactly one weaponless adult, full body in a grounded three-quarter standing pose; "
                "all extremities inside a generous safe margin on a warm parchment studio wash."
            ),
            "negativeConstraints": [
                "no weapon, armor, crown, magic, aura, affinity cue, elemental gem, or floating",
                "no frame, printed star, number, UI, logo, watermark, or text",
                "no extra person, duplicate anatomy, crop, smile, grin, or theatrical expression",
                "no photographic pores, lens treatment, plastic 3D, cel-anime finish, or published-character resemblance",
            ],
        },
        "acceptanceCriteria": [
            {"criterionId": criterion_id, "description": description, "required": True}
            for criterion_id, description in ACCEPTANCE_CRITERIA
        ],
        "sourceSummon": None,
        "correctionSource": None,
        "output": {"candidatePath": paths["candidate"], "resultPath": paths["result"]},
    }
    target_sha256 = canonical_sha256(target)
    assignment = {
        "schemaVersion": ASSIGNMENT_SCHEMA_VERSION,
        "assignmentId": f"{hero_id}-summon-v1-assignment",
        "experimentId": EXPERIMENT_ID,
        "targetId": target_id,
        "targetPath": paths["target"],
        "targetSha256": target_sha256,
        "producerId": f"image-producer-lane-{ordinal % PRODUCER_LANES + 1:02d}",
        "assignedAt": "2026-09-02T00:00:00Z",
        "permittedOutputs": target["output"],
        "forbiddenSharedPaths": [
            f"assets/heroes/experiments/{EXPERIMENT_ID}/roster-plan.json",
            f"assets/heroes/experiments/{EXPERIMENT_ID}/production-report.json",
            f"assets/heroes/experiments/{EXPERIMENT_ID}/provenance/production-journal.jsonl",
            f"assets/heroes/experiments/{EXPERIMENT_ID}/review/index.html",
            f"assets/heroes/experiments/{EXPERIMENT_ID}/review/quarantine.html",
        ],
        "retryCeiling": 1,
        "dryRun": False,
        "completionContract": {
            "oneTargetOneImage": True,
            "candidateOnly": True,
            "structuredResultRequired": True,
            "sharedFilesMustRemainUntouched": True,
            "selfPromotionForbidden": True,
        },
    }
    return {
        "heroId": hero_id,
        "displayName": display_name,
        "rosterStatus": "active" if active else "reserve",
        "waveId": wave_id,
        "identitySignature": identity_signature,
        "quotaCoordinates": dict(allocation),
        "physicalManifest": manifest,
        "characterKernel": kernel,
        "pathPlan": paths,
        "summonTargetPath": paths["target"],
        "summonAssignmentPath": paths["assignment"],
        "summonTarget": target,
        "summonAssignment": assignment,
        "futureChibi": {
            "state": "not-materialized",
            "reason": "Requires the verified exact summon candidate path and SHA-256.",
            "reservedCandidatePath": paths["futureChibiCandidate"],
            "reservedResultPath": paths["futureChibiResult"],
            "reservedPreviewPath": paths["futureChibiPreview"],
        },
    }


def _allocation_at(allocations: Mapping[str, Sequence[str]], index: int) -> dict[str, str]:
    return {key: values[index] for key, values in allocations.items()}


def quota_summary(packets: Iterable[Mapping[str, Any]]) -> dict[str, Any]:
    packets = list(packets)
    summary: dict[str, Any] = {}
    coordinate_keys = (
        "gender", "body", "height", "ageBand", "hairColor", "hairSilhouette", "skinValue",
        "wardrobe", "palette", "detailDensity", "tattoo", "coolnessAnchor",
    )
    for key in coordinate_keys:
        summary[key] = dict(sorted(Counter(packet["quotaCoordinates"][key] for packet in packets).items()))
    summary["bodyByGender"] = {
        gender: dict(
            sorted(
                Counter(
                    packet["quotaCoordinates"]["body"]
                    for packet in packets
                    if packet["quotaCoordinates"]["gender"] == gender
                ).items()
            )
        )
        for gender in ("man", "woman")
    }
    summary["heightByGender"] = {
        gender: dict(
            sorted(
                Counter(
                    packet["quotaCoordinates"]["height"]
                    for packet in packets
                    if packet["quotaCoordinates"]["gender"] == gender
                ).items()
            )
        )
        for gender in ("man", "woman")
    }
    summary["ageBandByGender"] = {
        gender: dict(
            sorted(
                Counter(
                    packet["quotaCoordinates"]["ageBand"]
                    for packet in packets
                    if packet["quotaCoordinates"]["gender"] == gender
                ).items()
            )
        )
        for gender in ("man", "woman")
    }
    summary["haircutAccentPresent"] = sum(
        packet["quotaCoordinates"]["hairAccent"] == "present" for packet in packets
    )
    return summary


def build_roster_plan(
    experiments_root: Path = HERO_EXPERIMENTS_ROOT,
    workspace_root: Path = WORKSPACE_ROOT,
) -> dict[str, Any]:
    authority_path = workspace_root / CREATIVE_AUTHORITY
    reference_path = workspace_root / STYLE_REFERENCE
    if not authority_path.is_file():
        raise FileNotFoundError(f"missing creative authority: {authority_path}")
    if not reference_path.is_file():
        raise FileNotFoundError(f"missing style reference: {reference_path}")

    existing_ids, existing_names = collect_existing_identity_keys(experiments_root)
    names = generate_names(ACTIVE_COUNT + RESERVE_COUNT, existing_ids, existing_names)
    active_allocations = build_active_allocations()
    reserve_allocations = build_reserve_allocations()
    reference_sha256 = file_sha256(reference_path)

    active = [
        make_packet(
            *names[index],
            _allocation_at(active_allocations, index),
            True,
            index,
            reference_sha256,
        )
        for index in range(ACTIVE_COUNT)
    ]
    reserves = [
        make_packet(
            *names[ACTIVE_COUNT + index],
            _allocation_at(reserve_allocations, index),
            False,
            ACTIVE_COUNT + index,
            reference_sha256,
        )
        for index in range(RESERVE_COUNT)
    ]
    plan = {
        "schemaVersion": PLAN_SCHEMA_VERSION,
        "planId": "heroes.one-star-overnight-200-roster-v1",
        "experimentId": EXPERIMENT_ID,
        "planningSeed": PLANNING_SEED,
        "state": "frozen-preproduction",
        "candidateBoundary": "candidate-only; no runtime promotion or human approval implied",
        "creativeAuthority": {
            "path": CREATIVE_AUTHORITY.as_posix(),
            "sha256": file_sha256(authority_path),
        },
        "styleReference": {"path": STYLE_REFERENCE.as_posix(), "sha256": reference_sha256},
        "exclusionEvidence": {
            "scope": "every JSON record in every other Heroes experiment",
            "existingIdCount": len(existing_ids),
            "existingNormalizedDisplayNameCount": len(existing_names),
            "generatedIdCollisionCount": 0,
            "generatedNormalizedDisplayNameCollisionCount": 0,
        },
        "quotaContract": {
            "activeCount": ACTIVE_COUNT,
            "reserveCount": RESERVE_COUNT,
            "bodyPerGender": BODY_PER_GENDER,
            "heightPerGender": HEIGHT_PER_GENDER,
            "agePerGender": AGE_PER_GENDER,
            "activeQuotas": ACTIVE_QUOTAS,
            "minimumHaircutAccents": 100,
        },
        "activeQuotaSummary": quota_summary(active),
        "active": active,
        "reserves": reserves,
        "chibiMaterialization": {
            "state": "deferred",
            "materializedTargetCount": 0,
            "materializedAssignmentCount": 0,
            "requiredBinding": "exact verified summon candidate path and raw SHA-256",
        },
    }
    plan["planContentSha256"] = canonical_sha256(plan)
    return plan


def _validate_materialization_path(relative_path: str) -> Path:
    path = Path(relative_path)
    expected_prefix = Path("assets/heroes/experiments") / EXPERIMENT_ID
    if path.is_absolute() or ".." in path.parts or path.parts[:4] != expected_prefix.parts:
        raise ValueError(f"materialization path escapes experiment root: {relative_path}")
    return path


def _preflight_absent(workspace_root: Path, relative_path: str) -> None:
    relative = _validate_materialization_path(relative_path)
    current = workspace_root
    for part in relative.parts[:-1]:
        current = current / part
        try:
            metadata = current.lstat()
        except FileNotFoundError:
            return
        if stat.S_ISLNK(metadata.st_mode):
            raise FileExistsError(f"materialization path traverses a symlink: {relative_path}")
        if not stat.S_ISDIR(metadata.st_mode):
            raise FileExistsError(f"materialization parent is not a directory: {relative_path}")
    leaf = current / relative.name
    try:
        leaf.lstat()
    except FileNotFoundError:
        return
    raise FileExistsError(f"materialization path already exists: {relative_path}")


def _open_parent_anchored(workspace_root: Path, relative_path: str) -> tuple[int, str]:
    relative = _validate_materialization_path(relative_path)
    nofollow = getattr(os, "O_NOFOLLOW", 0)
    directory_flags = os.O_RDONLY | os.O_DIRECTORY | nofollow
    current_fd = os.open(workspace_root, directory_flags)
    try:
        for part in relative.parts[:-1]:
            try:
                next_fd = os.open(part, directory_flags, dir_fd=current_fd)
            except FileNotFoundError:
                try:
                    os.mkdir(part, mode=0o775, dir_fd=current_fd)
                except FileExistsError:
                    # Another process won the mkdir race. The anchored no-follow
                    # open below decides whether the winner is a safe directory.
                    pass
                next_fd = os.open(part, directory_flags, dir_fd=current_fd)
            os.close(current_fd)
            current_fd = next_fd
        return current_fd, relative.name
    except Exception:
        os.close(current_fd)
        raise


def _exclusive_write(
    workspace_root: Path, relative_path: str, payload: bytes
) -> tuple[int, int]:
    parent_fd, leaf = _open_parent_anchored(workspace_root, relative_path)
    nofollow = getattr(os, "O_NOFOLLOW", 0)
    descriptor: int | None = None
    created_identity: tuple[int, int] | None = None
    try:
        descriptor = os.open(
            leaf,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL | nofollow,
            0o664,
            dir_fd=parent_fd,
        )
        metadata = os.fstat(descriptor)
        created_identity = (metadata.st_dev, metadata.st_ino)
        view = memoryview(payload)
        while view:
            written = os.write(descriptor, view)
            if written <= 0:
                raise OSError(f"short write while materializing {relative_path}")
            view = view[written:]
        os.fsync(descriptor)
        return created_identity
    except Exception:
        if created_identity is not None:
            try:
                visible = os.stat(leaf, dir_fd=parent_fd, follow_symlinks=False)
                if (visible.st_dev, visible.st_ino) == created_identity:
                    os.unlink(leaf, dir_fd=parent_fd)
            except FileNotFoundError:
                pass
        raise
    finally:
        if descriptor is not None:
            os.close(descriptor)
        os.close(parent_fd)


def _unlink_if_same_inode(
    workspace_root: Path, relative_path: str, expected_device: int, expected_inode: int
) -> None:
    parent_fd, leaf = _open_parent_anchored(workspace_root, relative_path)
    try:
        try:
            metadata = os.stat(leaf, dir_fd=parent_fd, follow_symlinks=False)
        except FileNotFoundError:
            return
        if metadata.st_dev == expected_device and metadata.st_ino == expected_inode:
            os.unlink(leaf, dir_fd=parent_fd)
    finally:
        os.close(parent_fd)


def _pretty_json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def materialize_roster_plan(plan: Mapping[str, Any], workspace_root: Path) -> dict[str, Any]:
    """Exclusively create the roster plus every frozen summon target/assignment.

    All declared materialization and future image paths are checked before the
    first write. If a race or I/O failure occurs after writing begins, only the
    exact inodes created by this call are removed.
    """

    if workspace_root.is_symlink():
        raise ValueError(f"workspace root must not be a symlink: {workspace_root}")
    workspace_root = workspace_root.resolve(strict=True)
    if not workspace_root.is_dir():
        raise ValueError(f"workspace root must be a real directory: {workspace_root}")
    if plan.get("experimentId") != EXPERIMENT_ID:
        raise ValueError("roster plan belongs to a different experiment")
    packets = list(plan.get("active", [])) + list(plan.get("reserves", []))
    if len(packets) != ACTIVE_COUNT + RESERVE_COUNT:
        raise ValueError("roster plan must contain exactly 200 active and 20 reserve packets")

    roster_path = f"assets/heroes/experiments/{EXPERIMENT_ID}/roster-plan.json"
    materialized: list[tuple[str, Any]] = []
    reserved_paths: list[str] = [roster_path]
    for packet in packets:
        target = packet["summonTarget"]
        assignment = packet["summonAssignment"]
        if assignment["targetSha256"] != canonical_sha256(target):
            raise ValueError(f"stale target hash for {packet['heroId']}")
        if assignment["targetPath"] != packet["summonTargetPath"]:
            raise ValueError(f"target path binding mismatch for {packet['heroId']}")
        if assignment["permittedOutputs"] != target["output"]:
            raise ValueError(f"output ownership mismatch for {packet['heroId']}")
        materialized.extend(
            [
                (packet["summonTargetPath"], target),
                (packet["summonAssignmentPath"], assignment),
            ]
        )
        reserved_paths.extend(packet["pathPlan"].values())

    if len(reserved_paths) != len(set(reserved_paths)):
        duplicates = sorted(path for path, count in Counter(reserved_paths).items() if count > 1)
        raise ValueError(f"roster plan contains duplicate paths: {duplicates}")
    for relative_path in sorted(reserved_paths):
        _preflight_absent(workspace_root, relative_path)

    # Roster is last and acts as the materialization commit marker.
    materialized.append((roster_path, plan))
    created: list[tuple[str, int, int]] = []
    try:
        for relative_path, value in materialized:
            device, inode = _exclusive_write(
                workspace_root, relative_path, _pretty_json_bytes(value)
            )
            created.append((relative_path, device, inode))
    except Exception:
        for relative_path, device, inode in reversed(created):
            try:
                _unlink_if_same_inode(workspace_root, relative_path, device, inode)
            except OSError:
                # Never unlink an unverified replacement. A cleanup failure is
                # safer than widening ownership during an already failing run.
                pass
        raise
    return {
        "materialized": True,
        "experimentId": EXPERIMENT_ID,
        "rosterPath": roster_path,
        "activeCount": len(plan["active"]),
        "reserveCount": len(plan["reserves"]),
        "targetCount": len(packets),
        "assignmentCount": len(packets),
        "createdFileCount": len(created),
    }


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--output",
        type=Path,
        help="Write pretty-printed JSON to this path; default is stdout.",
    )
    mode.add_argument(
        "--materialize",
        action="store_true",
        help="Exclusive-create roster-plan.json and all summon targets/assignments.",
    )
    parser.add_argument(
        "--workspace-root",
        type=Path,
        default=WORKSPACE_ROOT,
        help="Workspace root used by --materialize; defaults to the current repository.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    plan = build_roster_plan()
    rendered = _pretty_json_bytes(plan).decode("utf-8")
    if args.materialize:
        summary = materialize_roster_plan(plan, args.workspace_root)
        print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))
    elif args.output is None:
        print(rendered, end="")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open("x", encoding="utf-8") as handle:
            handle.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
