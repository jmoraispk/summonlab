# Skill icon production system design

**Status:** Accepted

**Date:** 2026-09-01

**Owner:** Skills visual production

## Purpose

Produce complete, consistent, independently replaceable icon artwork for every canonical skill
without sacrificing per-icon resolution. The current catalog contains 456 skills: 258 Martial, 124
Magical, and 74 Craft. The system must also make a newly authored skill visibly incomplete until it
receives a reviewed visual record.

The production model separates two jobs that one generated image cannot perform equally well:

- **calibration plates** establish consistency across related assets;
- **individual square masters** provide the pixel density and isolation required by production.

Calibration plates are never cropped into runtime assets.

## Accepted visual direction

The owner selected the **Painted Emblem** direction.

Every skill icon uses:

- one dominant subject or action silhouette;
- at most one supporting effect or material cue;
- lightly dimensional painted materials rather than flat pictograms;
- restrained semantic color based on the skill itself;
- controlled highlights and glow;
- enough simplification to remain recognizable in the intended 300–400-pixel interface range;
- no text, rarity cue, type badge, frame, or narrative scenery inside the artwork layer.

Concrete readability is the default. An action icon shows what performs the action rather than only
the residue it leaves behind. Blade cut motifs from F through A therefore retain a visible blade
making the cut; free-floating slashes, split planes, and abstract wounds are supporting effects, not
substitutes for the blade. The same rule applies by analogy to other motifs: retain the relevant
weapon, projectile, body action, element, magical operation, craft tool, ingredient, material,
creature, document, or result. An S skill may use an abstract endpoint when that is clearer than a
literal object, but the exception is explicit, owner-approved, and visibly inherits its family's
gesture or construction. Abstraction is not a generic rarity filter.

Rarity is communicated only by the canonical F–S frame. Active, Passive, Stance, and Craft type
remain external metadata. Domain and family do not force a palette onto the icon.

## Layer contract

Every rendered skill tile is assembled from four independent layers:

1. a universal charcoal backing;
2. one skill-specific painted-emblem artwork layer;
3. the skill's fixed rarity frame, including its permanent integrated crest and F–S letter;
4. interface-rendered text beneath the hexagon.

The first text row is the skill name. The second is bearer-specific mastery and level in the form
`MASTERY · LV N`. Text is never baked into the frame, backing, or icon artwork.

### Shared geometry

All canonical retained image layers use a `1024×1024` RGBA working canvas with the same center and
registration. A provider's transient raster may differ only when a versioned target explicitly
authorizes the deterministic normalization profile below. Geometry is immutable, versioned
authority: a target binds one geometry file by canonical path and raw-byte SHA-256 rather than
silently adopting the newest file. The painted subject stays within the central 64% safe zone;
restrained supporting effects may extend to 72% but never enter the frame or rarity medallion
exclusion zones.

The original `geometry.json` (`skill-icon-geometry-v1`) and its generated `geometry-guide.png`
remain the exact authority for every existing packet and result. They are never edited or
reinterpreted. The additive `geometry-v2.json` (`skill-icon-geometry-v2`) preserves v1's canvas,
center, aperture points, safe zones, medallion exclusion, runtime sizes, and recognition size. It
adds an explicit frame-only outer envelope
`[[.5,.046875],[.88671875,.28125],[.88671875,.71875],[.5,.953125],[.11328125,.71875],[.11328125,.28125]]`
and `innerApertureScale: .78`. Its deterministic `references/geometry-guide-v2.png` is a
`1254×1254` provider-space guide with no text; it depicts the allowed annulus, medallion, outer
boundary, and inner boundary without becoming image content.

The two normalized roles deliberately use different v2 geometry. A `rarity-frame` may retain only
`(outer envelope − aperture scaled about the shared center by .78) ∪ medallion`; this provides a
continuous rim while reserving its center. A `backing` continues to use the
original `aperturePoints` polygon and remains transparent outside it. Geometry v2 therefore fixes
the frame envelope without shrinking or expanding the backing.

Final retained alpha geometry treats alpha values through 8 as transparent and rejects every pixel
above 8 outside the applicable aperture or envelope. Geometry-relative minimums reject degenerate
registration specks without prescribing an art style: skill artwork must cover at least 1% of the
64% subject-safe disk, and a rarity frame must cover at least 3% of its applicable frame-envelope
area plus 4% of each of the six edge bands derived from that envelope. Geometry v1 uses
`aperturePoints` as the frame envelope; geometry v2 uses `outerEnvelopePoints`. These thresholds
represent a minimally readable emblem and continuous frame material at the 1024-pixel working
scale; they are not absolute pixel counts.

Approved masters retain their original lossless PNG. Runtime exports derive deterministically at
`512×512`, `384×384`, and `256×256` without replacing the master. Full-size and 384-pixel composites
are the required visual evidence. Historical 96-pixel evidence remains immutable but does not govern
new skill-art approval.

## Production phases

### Phase 1 — rarity frames

The accepted Option C seven-rarity comparison is the calibration authority. Produce F through S
again as seven independent transparent `1024×1024` frame masters. Each individual generation uses
the comparison plate as a visual reference and the shared geometry manifest as a hard constraint.

The individual frame masters—not crops from the comparison—become the production assets. Review
must confirm identical registration and aperture geometry across all seven frames while preserving
the accepted material ladder:

`weathered iron → aged bronze → tempered blue steel → moonlit silver → blackened amethyst →
champagne electrum → ceremonial antique gold`.

### Phase 2 — universal backing

Produce one standalone `1024×1024` charcoal forged-stone backing, transparent outside the common
hexagonal aperture. Its design is already accepted; the remaining work is production, geometry
registration, and validation of the standalone file.

### Phase 3 — motif map

Every canonical skill receives exactly one visual classification:

- a named motif family with zero or one primary visual parent; or
- `standalone`, with no visual parent.

Mechanical prerequisites remain recorded separately and may contain several parents. They do not
force the icon to become a collage. A secondary prerequisite may influence a small pose, material,
or effect cue, but only the primary visual parent controls inherited iconography.

The proposed complete map is maintained in
[the companion motif map](2026-09-01-skill-icon-motif-map.md). Motif families are intentionally
narrower than mechanical families. For example, Blade separates precision cuts, sweeping cuts,
guards and counters, blade throwing, heavy cleaves, and paired-blade techniques.

### Phase 4 — motif-family calibration

Before producing members of a multi-skill motif family, generate one family calibration plate with
approximately three to six representative members or lineage stages. A family plate establishes:

- the recurring silhouette or construction motif;
- how the motif changes from parent to child;
- semantic palette boundaries;
- material and effect vocabulary;
- icon density and negative space;
- the distinction between adjacent members.

The family plate is an approved reference, not an asset sheet. Large or branching families receive
multiple lineage plates rather than shrinking many icons into one overcrowded image. Standalone
skills skip this phase and use the global Painted Emblem reference directly.

### Phase 5 — individual skill masters

Generate each skill independently at the provider's full supported square resolution and normalize
it to the canonical `1024×1024` RGBA canvas. Genuine source alpha is accepted when actually returned;
an additive provider profile may instead accept an exact uniform near-black source field and blend
it into the universal charcoal backing through deterministic aperture masking. Painted
checkerboards and manual background repair are never accepted. A multi-skill family member receives
these references:

1. the global Painted Emblem style authority;
2. its approved motif-family calibration plate;
3. its approved primary-parent master, when one exists;
4. the universal geometry and safe-zone guide.
5. its concrete-anchor rule and any owner-approved S-only abstraction exception.

The provider pilot chooses one retained contract for the complete rollout. Reliable source alpha
preserves separate backing and artwork masters. If source alpha is not reliable, an additive schema
may instead retain one aperture-clipped `skill-interior` master containing the standard charcoal
field and artwork, with the fixed rarity frame still composited last. The rollout cannot mix these
contracts between skills.

A standalone skill receives the global style authority and geometry guide. Every prompt repeats
the skill's dominant subject, optional supporting cue, semantic palette, exclusions, and exact
safe-zone requirements. Generations own one collision-safe candidate path and never edit a shared
catalog.

Provider compatibility is explicit, additive, and versioned. Historical v1 jobs retain exact
provider bytes. The existing revision-2 frame/backing targets, assignments, results, and candidates
remain unchanged and continue to authorize only `skill-icon-green-key-role-mask-v1`. That profile
accepts one non-interlaced 8-bit 1254×1254 RGB PNG with an explicit perceptual-sRGB declaration and
the declared opaque `#00FF00` matte, then deterministically creates the role-masked canonical
1024×1024 RGBA candidate. Its clean-matte threshold remains the existing per-channel distance 12.
Conflicting color metadata, unsupported ancillary chunks, checkerboard matting, and bytes after PNG
`IEND` fail closed.

The additive `skill-icon-green-key-role-mask-v2` profile accommodates the provider's opaque `caBX`
container box without trusting it. It accepts at most 64 MiB and 1,024 chunks, with exactly this PNG
envelope: `IHDR`, one `caBX` immediately after `IHDR`, one or more consecutive `IDAT` chunks, then
`IEND`; no other chunks, color declarations, or trailing bytes are allowed. `IHDR` must declare
1254×1254, RGB, 8-bit, non-interlaced pixels. The `caBX` CRC must be valid, its data length must be
8–32,768 bytes inclusive, its first big-endian unsigned 32-bit integer must equal that data length,
and data bytes 4–7 must be ASCII `jumb`. All remaining `caBX` data is opaque, untrusted, and never
parsed, fetched, copied, or passed to the decoder.

Normalization hashes the original complete provider PNG as `providerSource.contentHash`, hashes the
raw `caBX` data as `containerBox.contentHash`, removes `caBX`, inserts one canonical intent-0 `sRGB`
chunk with a freshly computed CRC immediately after `IHDR`, and hashes those exact rewritten PNG
bytes as `decoderInputContentHash`. Only that pathless decoder input is decoded. Evidence records
`containerBox: { chunkType: 'caBX', bytes, contentHash }` and
`colorSpaceDisposition: 'assigned-srgb'`; it never records a provider pathname. After decoding, v2
alone classifies a matte pixel by the inclusive Chebyshev distance
`max(R, 255 - G, B) <= 24` from `#00FF00`. This threshold gates both the decoded 1254-pixel perimeter
and every role-required-transparent region and is the fully transparent endpoint for pre-resize
chroma alpha. Resize, role masking, forbidden-region checks, and the normalized-output SHA-256
remain deterministic and otherwise unchanged. A synthesized exact-envelope canary with shadow spill
outside the permitted asset region must still fail the clean-matte gate.

Producers never crop, resize, color-key, extract, mask, rewrite, or otherwise normalize provider
output themselves. Any source outside the packet-declared profile fails. Revision-3 frame/backing
packets bind profile v2, skill `summonlab-skill-icon-production-v3`, the immutable v1 geometry, and
the v1 guide. Those packets and results remain immutable history, including the F revision-3 canary
rejection.

The additive `skill-icon-green-key-role-mask-v3` profile advances geometry authority while retaining
profile v2's exact `caBX` envelope, pathless evidence, canonical-sRGB decoder input, matte threshold,
resize, and validation thresholds. It preserves checker protection with a v3-only semantic periodic
opacity detector that recognizes A–B–A alpha repetition in role-relevant content without classifying
the corrected real frame as a checker; the v1/v2 detector paths remain unchanged. This detector is
an implementation refinement, not a change to the matte, evidence, or geometry thresholds. Profile
v3 requires the raw-byte hash of `geometry-v2.json` and the hash-bound `geometry-guide-v2.png`
reference. Profiles v1–v3 share the existing pre-clip allowance for a resize/rasterization antialias
transition no farther than three output pixels from the role-mask boundary. Every profile then
hard-clips to its exact role mask; in the retained output alpha through 8 is transparent and any
alpha above 8 outside the mask is invalid. No other spill is permitted. Profile v3 pairs only with
`summonlab-skill-icon-production-v4`. Revision-4 frame/backing packets now bind that tuple. The F
revision-4 canary exhausted its two authorized generation calls and remains an immutable terminal
failure; no F candidate was retained. The other revision-4 reference slots remain unattempted.
The guide reference is mandatory authority, not illustrative context, and uses the canonical purpose
`Provider-space role-mask guide for rarity-frame and backing registration.`.

### Coordinator-only provider-source reprocessing

A failed ordinary rarity-frame producer result may have observed exact provider bytes that fail its
historical processing authority but pass a later authority without another image-generation call.
Reusing those bytes is neither a producer retry nor evidence that a later prompt generated them. It
therefore uses the distinct `skill-icon-reprocess-target-v1`,
`skill-icon-reprocess-assignment-v1`, and `skill-icon-reprocess-result-v1` schemas and coordinator
tool version `summonlab-skill-icon-reprocess-v1`. Reprocess v1 is restricted to
`role: 'rarity-frame'`; backing and every other role are ineligible. The dedicated production skill
rejects all three schemas.

The reprocess target has no prompt or generation references. With
`sourceMode: 'reuse-prior-provider-source'`, its `originAuthority` binds the canonical paths and raw
SHA-256 hashes of one live ordinary target-v2, assignment-v2, and failed result-v2, plus the exact
observed provider-source hash. The origin must be the same logical identity, role, and rarity; its
ordinary rarity-frame execution must be valid, `status: 'failed'`, `output: null`, and its pathless
normalization evidence must record that same source hash. A backing origin, superseded result,
successful result, earlier reprocess result, or semantic-equivalent rewrite is not valid origin
authority. The source stays transient and machine-local: it is stable-read through a no-follow
descriptor and must match the bound hash, but its path and bytes are never copied into repository
evidence.

`processingAuthority` independently binds profile v3, raw geometry-v2 bytes, and the exact guide-v2
path, hash, and canonical purpose. The assignment binds its own target path and raw hash, names
`summonlab-skill-icon-reprocess-v1`, sets `generationAttemptLimit: 0` and
`normalizationTransactionLimit: 1`, and grants only the new versioned candidate and result paths.
The result repeats both authorities, records `generationAttemptCount: 0` and
`normalizationTransactionCount: 1`, and never contains prompt or generation-reference claims. A
candidate result carries completed profile-v3 normalization provenance, exact output metadata, and
passing full-size plus 96-pixel inspections. A failed result carries no output and honest
normalization/failure evidence. Publication uses the coordinator's dedicated reprocess command and
the repository's crash-safe, no-replace transaction; the generation producer, producer failure
writer, and producer verifier cannot perform or launder this route.

The command requires informed coordinator `pass|fail` outcomes and observations for the full-size
output and its 96-pixel recognition view. These records may reject an otherwise technically valid
output, but cannot override the automated full-size role inspector or the technical validation that
the recognition derivative is a decodable 96×96 RGBA PNG. The 96-pixel evidence is a recognition
review, not the strict 1024-pixel role inspector applied to resized geometry.

The coordinator durably and exclusively reserves the sole normalization transaction before calling
the normalizer. Once reserved, a crash is not permission to normalize again. Exact safe recovery
terminalizes the reserved attempt; stale, malformed, changed, or foreign reservation state blocks
for coordinator inspection without a rerun. If normalization and both visual inspections pass but
candidate/result publication fails, the terminal result may truthfully remain `status: 'failed'`
with `failureReason.kind: 'persistence'`, completed normalization evidence, and two passing
inspections—no visual failure is invented. If even that result cannot be published safely, retain
the reservation fail-closed so the one-transaction limit cannot be bypassed.

Exactly one zero-call reprocess transaction is permitted for an origin source. If deterministic
normalization fails, stop. If it succeeds, the candidate goes directly to ordinary owner review; an
owner rejection also stops the route. Neither outcome authorizes a changed tolerance, a new
reprocess packet sourced from the reprocess result, or another green-key generation loop. Continue
instead with a deterministic vector/native-frame pipeline or an alpha-capable production route.
The only immediate route contemplated by reprocess v1 is an F revision-5 packet using the passing F
revision-3 provider source. It remains future work: this protocol foundation creates no F-v5 packet,
result, candidate, or provider call.

### Phase 6 — deterministic assembly and review

The review compositor combines the backing, individual artwork, fixed rarity frame, and external
text without generative editing. Every candidate is inspected in three views:

1. full-resolution isolated artwork;
2. the canonical composite at normal interface size;
3. a `384×384` normal-interface composite without external text.

The compositor also produces revision-aware contact sheets for review, but those sheets remain
derived evidence. It selects the highest complete target packet for every required slot and fails
on an incomplete or colliding latest packet. Sheet revisions are independent: unchanged rendered
bytes reuse the latest `*-vN.png`, while changed bytes allocate `N + 1` after the highest historical
sheet without replacing older review evidence. Contact sheets never become an image source.
Each write is serialized by a crash-recoverable, process-epoch-bound coordinator lock and guarded
by a planner-bound read set: opened file and directory identities, exact bytes, and membership are
revalidated before rendering and before and after descriptor-bound publication. The first
observation of each path is pinned; a different repeated observation forces a replan instead of
mixing revisions. A changed read set is replanned with bounded retries and is never reported
current. Held lock descriptors and both hard links are identity-checked at publication boundaries;
normal owner-release and dead-owner-recovery handoffs retry when the observed lock identity moves.
The supported concurrency model trusts repository tools that cooperate through these locks. It
fences accidental and concurrent pathname, inode, byte, and membership changes, including
same-UID processes using the production commands. A malicious same-UID process that deliberately
bypasses the coordinator and mutates files between the final identity check and atomic syscall is
an operating-system trust boundary, not an application-level compare-and-swap guarantee.

Candidate persistence treats the candidate PNG and its initial result JSON as one recoverable
publication unit. Both complete files are fsynced under private names before an authenticated
transaction journal is published. Their no-replace final hard links are committed only after both
files and every bound authority revalidate; a dead coordinator's journal authorizes rollback solely
of the recorded hash-and-inode-owned names. An unjournaled private stage is ignored and preserved,
then bypassed by a new transaction ID, because no durable inode authority exists to delete it.
Result-only terminal failures use the same ownership principle with a Linux `O_TMPFILE` result and
owner record published before the stage link. The owner record binds the result inode, hash,
authorities, and process epoch; its held exclusive inode lock serializes both new writers and
dead-owner recovery. Neither a partial JSON file nor a foreign pathname can be mistaken for
recoverable output.
Producers never remove recovery state manually.

An unattempted packet may be closed only by coordinator-authored superseded evidence at that packet's
canonical result path. Its reason is exactly
`unattempted-packet-superseded-by-higher-revision`. The result identity remains bound to the retired
packet, while `supersedingAuthority` binds the higher target and assignment's canonical paths and raw
SHA-256 hashes plus its job, logical identity, revision, and role. Both packets must have the same
logical identity and role, and the authority revision must be strictly higher. The retired candidate
and result paths must both be absent before publication; therefore no valid review or promotion can
exist for that unattempted packet. The closure has `attemptCount: 0`, empty findings, null output,
exact `not-run` normalization, equal start/end timestamps, zero wall time, a result-only write set,
`noSharedFilesEdited: true`, and `selfPromoted: false`. It is published through the same crash-safe
result-only transaction. A producer cannot self-supersede. Superseded evidence completes only the
historical audit tuple: it never satisfies the logical slot, never becomes the latest usable result,
and is never a fallback when the newest revision is failed, revised, missing, or incomplete.

## Manifest model

The production manifest has one record for each canonical `targetId` and contains:

- canonical skill ID, name, domain, family, labels, rarity, and type;
- motif family or `standalone`;
- nullable primary visual parent;
- mechanical prerequisites as authored source text;
- dominant subject;
- nullable supporting cue;
- semantic palette;
- composition direction and exclusions;
- calibration-plate reference, when applicable;
- candidate, approved-master, and derived-export paths;
- protocol version, generation prompt, input references, dimensions, alpha mode, and SHA-256;
- for normalized jobs, the literal normalization profile, pathless provider-source
  media/dimensions/alpha/bytes and full-source hash, raw geometry-file hash, decoder-input hash,
  source hash, normalized output hash, and profile-specific container/color-space disposition;
- for coordinator-authored superseded results, the exact reason and raw-hash-bound target/assignment
  authority;
- for coordinator-authored reprocess jobs, distinct raw-hash-bound origin and processing
  authorities, zero generation attempts, exactly one normalization transaction, and no prompt or
  generation-reference claim;
- review state and recognition results.

Canonical skill metadata is imported from the authored Markdown tables rather than duplicated by
hand. Visual fields are owned by the icon manifest.

## Validation and completion gates

Automated validation rejects:

- a canonical skill without exactly one icon-manifest record;
- an icon record whose skill no longer exists;
- duplicate skill IDs, candidate paths, or approved paths;
- a non-standalone record without an existing calibration plate;
- more than one primary visual parent;
- a parent outside the same motif family unless explicitly reviewed as a cross-family bridge;
- a parent cycle;
- a missing or invalid rarity frame;
- non-`1024×1024` retained masters, absent retained alpha, unsafe visible pixels, or incorrect
  registration;
- missing provenance, hashes, recognition review, or required runtime derivations.
- mixed packet tuples, normalization-profile drift, a provider source outside the exact declared
  envelope, manual/out-of-transaction normalization, provider-path leakage, or a
  geometry/source/decoder/container/output hash mismatch;
- producer-authored or weakly bound superseded evidence, attempted evidence mislabeled as
  superseded, a superseded packet without a valid higher revision, or use of superseded evidence as
  the latest result or fallback;
- a reprocess packet routed through the dedicated producer, an origin other than an ordinary failed
  output-free result with matching observed-source evidence, source or repository-authority drift,
  nonzero generation calls, more or fewer than one normalization transaction, a reprocess chain, or
  prompt/reference provenance invented for reused bytes;

Human approval requires:

- immediate recognition of the dominant subject and action at `384×384`;
- meaningful distinction from adjacent members of the same motif family;
- visible lineage with its primary parent where one exists;
- a concrete acting subject for F–A, with any S abstraction recorded as an explicit exception;
- no frame, text, type, rarity, or domain information baked into the artwork;
- no confusing collision between semantic color and the rarity frame;
- no cropped subject, illegible micro-detail, or uncontrolled particles.

“100% complete” means the current canonical skill set and manifest are in exact one-to-one
correspondence and every record has an approved individual master plus required derivatives. The
current target is therefore 456 of 456, not the former 520-row legacy inventory.

## New-skill procedure

When a new skill is authored:

1. taxonomy validation creates a missing-icon failure;
2. the visual owner assigns an existing motif family or marks the skill standalone;
3. the owner chooses at most one primary visual parent and authors its subject, cue, palette, and
   exclusions;
4. a new motif family receives and approves a calibration plate before individual generation;
5. the skill receives one isolated exact-source job under its applicable production contract and a
   fresh versioned job ID; normalized profiles v1–v3 remain restricted to green-key frame/backing
   retries and do not authorize skill-art packets;
6. the producer passes the exact provider output directly to the repository helper, which retains
   exact-source bytes unchanged; automated geometry, alpha, provenance, and coverage checks then
   run against the target's hash-bound geometry and guide authorities;
7. the full-size and `384×384` normal-interface composites receive human review;
8. approval promotes the master and deterministic derivatives together.

Historical packets and results remain immutable. Producers never normalize manually. Normalized
frame/backing provenance never retains a machine-local provider pathname. A compatible retry
receives a higher explicit revision, new candidate/result paths, an exact packet-declared profile,
and the matching assignment skill version. The coordinator may close an older, demonstrably
unattempted packet with exact authority-bound superseded evidence; it may not reinterpret any
attempted packet. The unique latest revision must complete, while older failures, revisions, and
superseded closures remain audit history and never provide fallback. Profile v1 and all existing
revision-2 packets/results remain unchanged. Profile v2, assignment skill v3, revision-3 packets,
and their results also remain immutable. Revision-4 packets now use profile v3 with geometry v2,
guide v2, and assignment skill v4, and the F revision-4 terminal failure remains immutable. When an
ordinary failed result preserves a matching observed-source hash, the coordinator may instead issue
one distinct zero-call reprocess packet; the producer may not execute it, and failure or owner
rejection permanently routes that asset away from another green-key attempt.

Changing a skill's rarity swaps the frame during composition; it does not regenerate the artwork.
Changing a skill's mechanics does not invalidate its image unless the dominant visual meaning has
changed.

## Rollout and review boundaries

Production should proceed in reviewable gates:

1. approve the geometry manifest, seven individual rarity frames, and universal backing;
2. review and revise the complete 456-skill motif map;
3. pilot three motif families spanning Martial, Magical, and Craft;
4. approve their family plates and individual masters before scaling;
5. produce remaining families in bounded waves with independent ownership;
6. enable the 456-of-456 completion gate only after the production queue is intentionally active.

No skill artwork generation begins merely because this design is approved. The written motif map,
geometry contract, and production plan must receive their own review first.
