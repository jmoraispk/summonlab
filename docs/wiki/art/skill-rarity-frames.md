# Skill rarity frames

Wiki ID: `art.skill-rarity-frames`

Design status: **Option C is the canonical comparison authority. The seven individually generated
frame appearances are owner-accepted. Deterministically registered geometry-v2 candidates now pass
the role-aware asset inspector and await owner visual review before promotion**.

![Canonical seven-tier skill rarity-frame comparison](../../../assets/wiki/skills/rarity-frame-v1/skill-rarity-option-c-v1.webp)

## Individual-frame review set

![Seven individually generated rarity-frame candidates](../../../assets/wiki/skills/rarity-frame-v2/review/rarity-frames-v2-contact-sheet.png)

The [review-set record](../../../assets/wiki/skills/rarity-frame-v2/README.md) contains one standalone
frame for each rarity, all at the same 1024×1024 size with genuine alpha inside and outside the
hexagon. The candidates follow Option C's material and ornament hierarchy and contain no skill
emblem, standard backing, mastery, level, or display label beyond the rank letter. Their appearance
is accepted, but their visible alpha bounds vary and must be normalized to the shared geometry-v2
envelope before they become production masters.

The image provider rendered a checkerboard into its RGB output even after one tightly scoped
background-extraction edit per frame. The review assets preserve the generated frame artwork and use
a deterministic connected-component matte removal to supply real transparency. The earlier initial,
corrective, and F-only provider attempts are preserved beside this set for direct comparison.

### Registered production candidates

![Geometry-v2 registered rarity-frame candidates](../../../assets/wiki/skills/rarity-frame-v3/review/contact-sheet.png)

The [registration record](../../../assets/wiki/skills/rarity-frame-v3/README.md) binds the accepted
source bytes and immutable geometry-v2 bytes to seven new candidate outputs. All candidates preserve
the source artwork, share the same inset aperture and center, remain inside the outer hexagon or
medallion envelope, intersect all six edge bands, and remain distinct at the 96-pixel review size.
They are review candidates, not promoted masters.

The selected plate fixes one hexagonal frame language for every skill domain. Domain, family,
equipment, and element do not recolor rarity. The interior illustration identifies the skill;
the frame identifies its fixed rarity.

## Canonical material and ornament ladder

| Tier | Name | Material | Ornament and construction |
| --- | --- | --- | --- |
| F | Common | Weathered iron | Narrow undecorated rim, hammered wear, and nearly hidden rivets |
| E | Uncommon | Aged bronze | Brown-gold patina, one inset line, and understated corner collars |
| D | Rare | Tempered blue steel | Cool cobalt heat sheen, crisp double bevel, and tiny angular vertex cuts |
| C | Epic | Moonlit silver | Brighter controlled silver, a stepped rim, and one precise geometric channel |
| B | Mythic | Blackened metal and amethyst | Faceted purple mineral inset; the supernatural material replaces outward filigree |
| A | Fabled | Champagne electrum | Gentle pearl-metal highlight, doubled inner rim, six spear-leaf accents, and a refined crest |
| S | Legendary | Ceremonial antique gold | Crowned silhouette, saturated gold, and the fullest integrated ornament; preserve this treatment |

The progression is therefore **iron → bronze → blue steel → silver → amethyst → electrum →
gold**. Material establishes the primary distinction. Ornament reinforces rank without forcing every
tier into a busier silhouette.

The D frame may attract attention because blue steel is more chromatic than silver. That is
acceptable so long as C remains brighter and more precisely finished. If later testing makes D feel
more prestigious than C, mute D's cobalt reflection before increasing C's glow or ornament.

## Rarity, mastery, and text

Rarity belongs to the skill definition and never changes. Mastery and level belong to the
hero-skill relationship and may differ between bearers of the same skill.

Every displayed skill uses two text rows beneath its hexagon:

1. the skill name;
2. the bearer state as `MASTERY · LV N`, using Novice, Intermediate, Expert, or Master and a level
   from 1 through 10.

The mastery and level shown in the comparison plate are layout examples, not canonical state for
Measured Cut, Ember, Parry, Stone Skin, Fireball, Thousand Cuts, or Worldfire.

## Runtime boundary

The canonical asset root is `assets/wiki/skills/rarity-frame-v1/`. Its provenance catalog binds the
retained reference, selected Option C source PNG, and bundled WebP. The WebP is the approved comparison
plate rendered by this wiki page.

The plate is not a sprite sheet and must not be cropped into seven runtime frames. A later asset
production pass must create individually framed, transparent, text-safe exports that preserve this
material and ornament grammar. That pass may adjust registration and small-size legibility, but it
must not silently change tier materials, letters, or the S treatment.

## Production normalization boundary

The Option C plate remains the visual authority and is never cropped. The existing revision-2 frame
and backing packets accept only their declared `skill-icon-green-key-role-mask-v1` provider
envelope: one 1254×1254 RGB PNG over opaque `#00FF00`, without a baked checkerboard. The
collision-safe repository helper alone converts it to the canonical 1024-pixel RGBA layer, using
the role's fixed geometry. The producing agent may not resize, crop, key, mask, or rewrite the
provider raster. Historical v1 jobs, all revision-2 packets, and their results remain unchanged.

The additive `skill-icon-green-key-role-mask-v2` profile permits the provider's opaque `caBX`
container box without trusting its contents. It accepts at most 64 MiB and 1,024 chunks in exactly
this order: `IHDR`, one `caBX` immediately after it, one or more consecutive `IDAT` chunks, and
`IEND`. No other chunk, declared color space, or trailing byte is allowed. The source remains
non-interlaced 1254×1254 RGB8. The `caBX` data must be 8–32,768 bytes with a valid CRC; its first
big-endian uint32 equals its data length and bytes 4–7 are ASCII `jumb`. The remainder is pathless,
opaque, and untrusted: it is never parsed, fetched, copied, or sent to the image decoder.

The helper hashes the complete original PNG, the raw `caBX` data, the exact decoder input, and the
normalized output with SHA-256. Decoder input is created in memory by stripping `caBX` and inserting
one canonical intent-0 `sRGB` chunk immediately after `IHDR`. Provenance records
`decoderInputContentHash`, `containerBox: { chunkType: 'caBX', bytes, contentHash }`, and
`colorSpaceDisposition: 'assigned-srgb'`, but never the provider pathname. On decoded 1254-pixel
RGB, profile v2 alone defines clean matte by the inclusive Chebyshev distance
`max(R, 255 - G, B) <= 24` from `#00FF00`; profile v1 remains distance 12. The profile-v2 threshold
governs the perimeter, all role-required-transparent regions, and the fully transparent endpoint of
pre-resize chroma alpha. The existing resize, role mask, and normalized 1024 RGBA geometry checks do
not change. A synthesized compatible canary with a shadow spilling into required matte space still
fails.

Profiles v1 and v2 are scoped to `rarity-frame` and `backing` retries. They do not apply to
individual `skill-art` or `calibration-plate` production, which remains exact-source work under its
applicable contract unless a future contract revision explicitly adds those roles. Revision-3
frame/backing packets pair profile v2 with `summonlab-skill-icon-production-v3` and remain bound to
the original geometry and guide. Those packets and results are immutable, including the F
revision-3 canary rejection.

### Additive geometry-v2 authority

The original `assets/wiki/skills/icon-production-v1/geometry.json`, its
`references/geometry-guide.png`, profiles v1 and v2, and every packet/result that binds them are
immutable. Geometry v2 is a new authority, not a correction applied to historical evidence.

`assets/wiki/skills/icon-production-v1/geometry-v2.json` uses schema version
`skill-icon-geometry-v2`. It preserves the v1 canvas, center, aperture points, 64% subject-safe zone,
72% effect-safe zone, medallion exclusion, runtime sizes, and recognition size exactly. It adds the
frame outer envelope
`[[.5,.046875],[.88671875,.28125],[.88671875,.71875],[.5,.953125],[.11328125,.71875],[.11328125,.28125]]`
and an inner-aperture scale of `.78`.

The roles remain geometrically distinct. A rarity frame may occupy
`(outer envelope − aperture scaled by .78 about the common center) ∪ medallion`. This is the permitted
frame annulus, not a backing boundary. The charcoal backing still occupies the original
`aperturePoints` polygon and must remain transparent outside it. Expanding the frame authority does
not expand the backing.

Frame coverage remains at least 3% of the applicable frame-envelope area and at least 4% in each of
its six derived edge bands. Geometry v1 derives those measures from `aperturePoints`; geometry v2
derives them from `outerEnvelopePoints`. The percentages do not change.

The deterministic `assets/wiki/skills/icon-production-v1/references/geometry-guide-v2.png` is a
`1254×1254` provider-space authority showing the allowed annulus, medallion, outer boundary, and
inner boundary without text. It is never cropped or composited into an asset.

Profile `skill-icon-green-key-role-mask-v3` retains profile v2's PNG and `caBX` envelope,
pathless evidence, assigned-sRGB decoder input, distance-24 matte rule, resize, and validation
thresholds. Checker rejection remains active through a v3-only semantic detector for periodic A–B–A
alpha repetition in role-relevant content. That refinement avoids treating the corrected real frame
as a checker while leaving v1/v2 behavior and all matte/evidence thresholds untouched. Profile v3
additionally binds the raw SHA-256 of geometry v2 and the exact guide-v2 reference hash and pairs
only with `summonlab-skill-icon-production-v4`. Profiles v1–v3 share the existing pre-clip allowance:
the resize/rasterization antialias transition may extend at most three output pixels from the
role-mask boundary. Normalization for every profile then hard-clips to the exact mask. In the
retained image alpha through 8 is transparent, every alpha value above 8 outside the mask is invalid,
and no other spill is accepted. Revision-4 frame/backing packets now bind this tuple. Every
revision-four job used its two allowed generation calls. A, B, C, D, E, S, and the backing ended as
verified terminal failures with no candidate; F revision 4 also remains immutable failed evidence,
while its distinct zero-generation revision-5 reprocess produced a technically valid candidate
awaiting owner review.
The mandatory guide reference has the canonical purpose
`Provider-space role-mask guide for rarity-frame and backing registration.` and is production
authority, not optional illustration.

Result provenance records pathless provider media properties and hashes, the raw geometry-file
hash, and the normalized output hash; it never retains a machine-local provider pathname. The eight
v1 Task 7 failures, F revision-2 caBX rejection, F revision-3 geometry rejection, and F revision-4
matte/registration rejection remain immutable evidence. Each retry receives a new explicit revision,
and the unique latest revision must complete rather than falling back to an older candidate.

For every new frame or backing revision, the coordinator authors the visual target, binds the raw
geometry authority, exact normalization profile, and matching assignment skill version, and
dispatches one isolated generation. The producer passes the returned provider path/hash directly to
the helper. Automated normalization and geometry validation run before owner review; only an
accepted review may promote the master and derive runtime assets. A failed or revised attempt
remains immutable history.

Only the coordinator may close a demonstrably unattempted lower packet by writing a result at that
packet's canonical result path with the exact reason
`unattempted-packet-superseded-by-higher-revision`. Its authority binds the target and assignment
canonical paths and raw hashes plus the job, logical identity, revision, and role of the strictly
higher packet. That packet must match the retired logical identity and role. Both retired output
paths must be absent; the closure then records zero attempts/time, no findings or output, exact
`not-run` normalization, and a result-only write set. The producer cannot self-supersede. This record
closes only the historical audit tuple: it never satisfies the latest slot and never provides
fallback if the higher revision fails, requires revision, or remains incomplete.

The helper publishes the candidate and result as one crash-recoverable unit. If the worker stops
between their no-replace publications, the next production invocation validates the signed journal
and removes only the exact staged/final hashes and inodes owned by that dead transaction before
retrying. A private stage created before the journal is preserved and ignored because it has no
durable inode authorization; a new transaction ID prevents collision. A foreign or changed path
blocks authoritative recovery for coordinator inspection. For a provider or normalization failure,
the result-only verifier publishes an exclusive process-epoch owner record before its complete
fsynced JSON stage, holds the owner inode lock across recovery and commit, and reasserts the target,
assignment, catalog, geometry, references, and observed provider source before committing. Producers
should rerun the assigned command after an interruption and must never clean hidden transaction
files by hand.

The ongoing reference-asset procedure is therefore: preserve every existing geometry, guide,
profile, packet, and result; have the coordinator issue a higher revision with exact
profile/geometry/guide/skill authority; close only proven unattempted lower packets with
coordinator-owned superseded evidence; dispatch one isolated generation per new target; pass the
provider source directly to persistence; validate normalization and role-specific geometry; obtain
hash-bound owner review; then promote and derive runtime assets. Never edit old evidence, normalize
manually, retain the provider path, or use a superseded/older result as fallback.

### One-shot coordinator reprocessing

Reusing an exact provider source already observed by an ordinary failed result is not a new
generation. It uses separate `skill-icon-reprocess-target-v1`,
`skill-icon-reprocess-assignment-v1`, and `skill-icon-reprocess-result-v1` packets under coordinator
tool `summonlab-skill-icon-reprocess-v1`; the dedicated generation skill and its Python preflight and
verifier reject all three schemas. Reprocess v1 accepts only `role: 'rarity-frame'`; the charcoal
backing and every other role are not eligible.

The reprocess target has no prompt and no generation-reference list. Its
`sourceMode: 'reuse-prior-provider-source'` authority binds the raw hashes and canonical paths of one
live rarity-frame target-v2, assignment-v2, and ordinary failed output-free result-v2, plus the exact
observed provider-source hash. Processing authority separately binds profile v3, geometry v2, and
the exact guide-v2 path, purpose, and hash. This preserves the truth: the historical prompt produced
the source, while the new packet authorizes only deterministic processing. A backing, superseded
result, successful result, or prior reprocess result cannot become the source of another reprocess.

The assignment permits zero generation attempts and exactly one normalization transaction. The
coordinator stable-reads the machine-local source, verifies its bound hash, and never commits its
path or raw bytes. A result repeats both authority blocks, records
`generationAttemptCount: 0` and `normalizationTransactionCount: 1`, and contains no invented prompt
or generation references. Success requires completed profile-v3 provenance, exact candidate bytes,
and passing full-size and 96-pixel inspections. Failure retains no candidate and reports honest
normalization evidence.

The coordinator supplies required `pass|fail` outcomes and observations for the deterministic
full-size output and its 96-pixel recognition view. They may reject a technically valid image, but
cannot override automated full-size role validation or the technical requirement that the
recognition derivative be a decodable 96×96 RGBA PNG. The 96-pixel record evaluates recognition; it
does not apply the strict 1024-pixel role geometry inspector to resized boundaries.

The coordinator reserves that sole transaction durably before normalization begins. A crash after
reservation never permits a rerun: safe exact recovery terminalizes it, while stale, malformed,
changed, or foreign reservation state remains blocked for coordinator inspection. If normalization
and both inspections pass but publication fails, a failed result may honestly record
`failureReason.kind: 'persistence'` with completed normalization and both inspections still passing;
it does not fabricate a visual defect. When even the failure result cannot be published safely, the
reservation remains fail-closed.

This route has one stopping rule: attempt the exact source once, without an image call. F revision 5
used that route and its technically valid candidate now goes directly to owner review. Normalization
failure or owner rejection permanently ends reprocessing for that source; do not loosen the profile,
create a reprocess chain, or begin another green-key prompt cycle.

The completed revision-four wave exposed a systemic boundary, matte, and coverage mismatch across
the seven remaining jobs despite their bounded corrections. The green-key generation route is
therefore stopped for reference frames and backing. Continue those assets only through deterministic
vector/native construction or a provider that can return genuine alpha.

For a newly authored skill, taxonomy first exposes the missing icon. The visual owner then maps its
motif family or marks it standalone, chooses at most one primary visual parent, authors the visual
specification, and approves a family calibration plate when needed. The coordinator issues one
isolated exact-source skill-art job under its applicable contract; profiles v1–v3 do not authorize
skill art. The producer retains exact source bytes, validation applies the target's hash-bound
geometry and guide authorities, and the full-size, composite, and 96-pixel views receive owner
review before atomic promotion and deterministic export. Changing rarity later recomposes this
frame layer without regenerating the skill artwork.
