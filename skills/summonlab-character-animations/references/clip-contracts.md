# Character animation clip contracts

Use the contract matching the requested clip. Adapt timing and frame count while preserving its
mechanical order. Screen directions are viewer-relative; anatomical sides remain character-relative.

## Human locomotion

For a classical human run, use the saved `classical-human-run-5` authority in
[known-actions.md](known-actions.md) and its original [support diagram](classical-human-run.svg).
The sequence is `left, left, none, right, right`: do not keep either foot planted for more than two
consecutive frames, omit the opposite-foot contact, or present duplicated/reordered poses as
progression.

For a five-frame in-place run:

1. **Contact A:** one foot reaches and accepts weight; the opposite leg trails.
2. **Compression/push A:** the planted knee loads, the center of mass reaches its low point, and the
   planted foot drives into takeoff.
3. **Airborne pass:** neither foot is planted while the free knee passes the former support leg.
4. **Contact B:** the opposite foot lands clearly ahead. This silhouette must not resemble frame 1.
5. **Recovery:** weight moves over contact B while the first leg advances toward frame 1.

The head and pelvis follow a purposeful vertical arc without horizontal drift or scale pulsing. Heavy
characters, including Toma, use shorter strides, smaller lift, and delayed equipment overlap, but
beat 3 remains airborne; the planted push belongs to beat 2. Agile characters may use a larger flight
arc. Clothing, hair, shields, bows, and weapons lag the body without changing design or handedness.

## Quadruped locomotion

Declare the gait before authoring. For an ordinary rat run, default to alternating diagonal support
pairs rather than an all-front/all-hind rabbit bound unless the brief explicitly asks for bounding.

For a five-frame alternating run:

1. **Diagonal contact A:** near forepaw and far hind paw support; other limbs reach.
2. **Compression:** shoulders and pelvis load over that pair; spine flexes.
3. **Passing/flight:** support pair pushes off; free limbs cross beneath the body.
4. **Diagonal contact B:** far forepaw and near hind paw take weight.
5. **Recovery:** body rises and limbs prepare diagonal contact A.

Track each paw through plant, load, backward travel relative to the torso, lift, swing, and next plant.
The pelvis drives the tail; the base reacts first and the tip lags. Never swap near/far limbs, duplicate
paws, freeze the hind legs, or make the torso bounce while contacts remain unchanged.

## Attack

Describe one action with one attacker, limb/weapon, target direction, and contact beat:

1. anticipation;
2. wind-up;
3. contact or maximum extension;
4. follow-through;
5. recovery into the combat stance.

The striking implement follows one continuous arc. Reserve trails, debris, projectile release, or
impact effects for their mechanically correct beat. If a projectile leaves the character, show it
departing once; do not add unrelated floating ammunition elsewhere in the clip.

### Example: Rat King claw rake

Motion sentence: “The Rat King coils, then performs one pauldron-side diagonal claw rake and recovers.”

1. Compress rearward; opposite claw supports.
2. Draw the pauldron-side claw above and across the crown.
3. Rake diagonally through the contact line; this is the only claw-trail frame.
4. Finish low and wide without striking the ground.
5. Retract the same claw into guard.

A pounce, bite, second swipe, ground slam, crater, or armor-side swap fails this clip.

## Hit

Hit reactions preserve balance unless the manifest explicitly makes the final hit the transition into
defeat. Directional impulse remains consistent with the incoming strike. For a two-frame hit clip:

1. **Impact:** the incoming force produces immediate recoil while footing still holds.
2. **Recovery or fatal transition:** return toward guard, or visibly break balance toward the first
   down frame when defeat follows.

Do not combine recovery and fatal collapse in one authored result. The active state transition decides
which ending the clip needs.

## Down

Begin from the actual preceding runtime pose. For a five-frame defeat clip:

1. **Balance break:** guard fails and the center of mass begins descending.
2. **Buckle:** first knee, paw, hand, or shoulder contacts the ground.
3. **Impact:** hips and torso arrive; limbs lose tension.
4. **Settle:** remaining momentum dissipates through limbs, cloth, equipment, or tail.
5. **Rest:** stable corpse pose with no recovery energy.

From balance break onward, the head and center of mass must not rise into a stronger stance. Persistent
equipment remains attached. Dropped equipment needs an unbroken release → fall → rest path. Do not
invent arrows, wounds, blood, or broken gear merely to communicate death.

### Combined source rows

Only use a combined row when the manifest explicitly stores distinct clips there. Keep their runtime
contracts and approval decisions separate. For a legacy two-hit/three-down layout:

1. **Hit:** readable recoil while footing holds.
2. **Fatal hit:** guard breaks and the center of mass begins descending.
3. **Buckle:** first knee, paw, hand, or shoulder contacts the ground.
4. **Impact:** hips and torso settle; limbs lose tension.
5. **Rest:** stable corpse pose with no recovery energy.

When revising only `hit` or only `down`, preserve the other clip and validate continuity across their
boundary. If both need correction, treat them as two scoped clips even if deterministic assembly writes
one source row.

## Idle

Use restrained asymmetric motion: breathing, weight shift, gaze, cloth, fur, tail, or equipment
settling. The loop returns to its start without a pose snap, synchronized full-body pulsing, or a
weapon changing grip.

## Review at runtime

Inspect at source resolution first, then at gameplay size and declared FPS. Watch at least three loops
for locomotion/idle. For attacks and defeats, replay from the preceding state through the terminal
frame and confirm the state machine presents every authored beat. A contact sheet can prove anatomy
and ordering; only playback proves cadence, reachability, loop seams, and perceived weight.

## Acceptance gates

| Gate                 | Pass condition                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| Temporal causality   | Every frame advances the declared action; no duplicate, reversal, teleport, or unrelated pose.        |
| Contact and weight   | Support limbs alternate as planned; planted feet/paws visibly bear weight without skating.            |
| Identity             | Face, anatomy, proportions, wounds, costume, palette, and silhouette remain the same character.       |
| Equipment            | The same item stays on the same side and follows a visible release-to-rest path if dropped.           |
| Registration         | Camera, scale, facing, direction, mirror safety, ground line, anchor, and cell padding remain stable. |
| Loop/terminal state  | The seam continues naturally, or the final pose is unmistakably settled.                              |
| Runtime reachability | Real state transitions present every required beat in order and hold the intended final frame.        |
| Gameplay read        | The clip remains legible at gameplay size and cadence, not only as a large contact sheet.             |
| Artifact control     | No extra limbs, detached gear, unexplained arrows, cell spill, text, scenery, or mistimed effect.     |
