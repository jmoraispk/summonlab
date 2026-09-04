# Enemy family design contract

Use the live schema and neighboring packets as structural authority. This reference defines the
design decisions that must be present; it does not freeze catalog totals.

## Family packet

Record:

- stable `familyId`, display name, source/order identifier, classification, habitat, encounter
  thesis, and source references;
- anatomy invariants shared by all tiers and explicit exclusions that keep the family distinct from
  adjacent families;
- exactly five forms with stable IDs and exactly one occurrence of each tier;
- affinity themes for `normal`, `fire`, `earth`, `wind`, and `water` in repository schema order.

Each T1–T5 form needs a display name, primary archetype, battlefield duty, teaching goal, signature
mechanic, telegraph, counterplay, visual delta, lower-form interaction where applicable, and source
references.

## Five-tier progression

| Tier            | Function          | Required design result                                                                          |
| --------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| T1 — Initiate   | First lesson      | Ordinary or lightly exaggerated form with one readable commitment and punish window             |
| T2 — Soldier    | Reliable pressure | Mature baseline that repeats the lesson under positioning pressure                              |
| T3 — Specialist | Qualitative pivot | New anatomy or behavior changes targeting, terrain, spacing, cadence, or resource use           |
| T4 — Champion   | Elite combination | Combines earlier lessons with a distinct body plan, adaptation, or command function             |
| T5 — Sovereign  | Family boss       | Changes the encounter and actively routes, empowers, summons, protects, or consumes lower forms |

Tiers encode encounter complexity and visual function, not merely level or body size. Combat
archetypes may change between tiers. Each silhouette must remain identifiable without its nameplate.

## Affinity construction

Every form has five separate visual targets: one Normal target plus the four base affinities Fire,
Earth, Wind, and Water. Normal is a production variant but is not a fifth affinity. Dual affinities
are outside this matrix unless separately authorized.

Preserve species anatomy, tier identity, combat telegraph, counterplay landmark, camera language,
and cinematic realism. Change at least two material/construction dimensions per affinity—not only
color:

- **Normal:** species-native surface, motion, debris, and habitat response; no unexplained elemental
  anatomy.
- **Fire:** active localized combustion, heat deformation, ember shedding, directional smoke, and a
  readable cooling or exposed counterplay region.
- **Earth:** load-bearing mineral accretion, compressed soil, dust, roots where biologically
  plausible, and detached orbiting or impact stone. Do not replace the whole animal with a rock
  statue.
- **Wind:** pressure-shaped fur, feathers, membranes, or scale edges; directional particulate flow;
  partial edge dissipation while core anatomy stays readable.
- **Water:** coherent fluid motion, wet or translucent detail, pressure paths, wakes, droplets, and a
  stable anatomical core. Do not make a blue recolor.

For each theme state: body transformation, ambient effect, telegraph signal, counterplay signal,
palette/material, and negative constraints.

## Legacy reconciliation

Classify a related legacy identity as one of:

- retained reference;
- promoted family/form identity;
- secondary archetype within an existing family;
- retired bridge;
- unrelated and untouched.

Legacy imagery remains reference-only unless a current manifest binds it to a new target and owner
review accepts it. A mapping does not authorize copying, approval, or runtime promotion.
