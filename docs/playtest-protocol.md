# FIN-007 moderated playtest protocol

**Protocol:** `moderated-playtest-v1`

**Cohort:** `fin007-local-private-v1`

**Gate:** five adult participants; two phone sessions and three desktop sessions

This protocol collects the minimum human evidence required to decide whether the first Summonlab
vertical slice is understandable, usable, and emotionally legible. Automated browser tests remain
preflight evidence. They do not count as participants and must never be entered into the moderated
report.

## Evidence boundary

Before a session, tell the participant:

> This is a private development playtest for adults. Playing is voluntary. I would like to retain
> paraphrased observations about where the interface is clear or confusing. I will not record your
> name, contact details, direct quotations, audio, or video. This note consent is separate from the
> optional in-game analytics choice, and you can play with analytics off. You can stop or ask me to
> delete the retained note at any time. Are you 18 or older, and do you agree to this note process?

Do not begin retaining notes unless both answers are affirmative. A participant who declines notes
may still play, but that session does not count toward FIN-007. If consent is withdrawn later, remove
the session and its sole-participant findings from the sanitized cohort source and regenerate the
report. Do not keep a recording or a copy elsewhere.

The in-game FIN-006 analytics choice remains independent. Never pressure a participant to enable it.
Record only `shared`, `declined`, or `undecided` in the sanitized session record; never copy a consent
capability, run ID, seed, question, reply, or event payload into moderator notes.

Raw working notes stay outside Git. The checked cohort source may contain only:

- anonymous codes `P01` through `P05`;
- the assigned device and track;
- build commit, timestamp, and duration;
- bounded task outcomes and prompt counts;
- a paraphrased, redacted finding summary; and
- severity, disposition, status, and optional resolution commit.

## Moderator behavior

Use think-aloud prompts that do not reveal the answer: “What are you looking for?”, “What do you
expect that to do?”, and “What changed?” Wait at least ten seconds before offering help. Count every
direction that tells the participant where to click or what the system means as a moderator prompt.
Do not explain autonomy, replay, or permanent consequences before asking the participant to explain
them in their own words.

For a deep track, first observe the common new-player introduction. The moderator may then supply the
prepared player-facing checkpoint named by the track. Development dashboards may prepare state, but
the participant interacts only with player-facing routes during the measured task.

## Five-session cohort

Every participant attempts the common path: start a seeded run, complete the summoning introduction,
read all three dossiers, converse and give a direction, and explain which choices belong to heroes.
The remaining definition-of-done behaviors are distributed across the cohort.

| Code | Device | Track | Additional observed behavior |
| --- | --- | --- | --- |
| `P01` | Phone | New-player onboarding | Mobile comprehension, touch targets, consent placement |
| `P02` | Desktop | Settlement return | Facilities, First Ember, leave/return recap |
| `P03` | Phone | Iron Moon autonomy | Mission preparation, constrained direction, autonomous resolution |
| `P04` | Desktop | Tower discovery | Floors 1–5 and discovering or validly missing the maintenance route |
| `P05` | Desktop | Consequence and replay | Retreat/death/synthesis/Master death outcome plus causal replay |

The checked dashboard at `/playtest-moderation` is the authoritative coverage map. A task counts as
observed when it was attempted, even if the participant could not complete it. Prompted and failed
tasks require a linked triaged finding; an unrecorded failure makes the cohort source invalid.

## Outcome codes

- `completed-unassisted`: completed without any answer-revealing moderator direction;
- `completed-prompted`: completed after one or more answer-revealing directions;
- `not-completed`: attempted but the participant or product could not finish;
- `not-attempted`: unavailable or skipped; does not satisfy cohort coverage.

Session disposition is `completed`, `stopped-by-participant`, or `stopped-by-blocker`. A stopped
session can remain valid evidence when note consent remains active and every attempted friction point
is triaged.

## Release severity

| Severity | Meaning | Required disposition |
| --- | --- | --- |
| `P0` | Privacy/consent violation, data loss, crash, unsafe irreversible action, or inability to start | Stop the cohort and fix before another session |
| `P1` | A core journey cannot be completed or understood without moderator rescue | Hold the release and fix before packaging |
| `P2` | Material friction with a discoverable workaround | Schedule correction; may continue testing |
| `P3` | Polish, preference, or future opportunity | Record for backlog or explicitly accept |

FIN-007 is complete only when all five assigned sessions exist, all twelve task families have been
attempted, every prompted/failed task has a severity, and the generated report says
`moderationStatus: complete`. FIN-008 may begin triage fixes earlier, but packaging remains on hold
while any P0 or P1 finding is not `verified`.

## Recording sanitized evidence

1. Copy `packages/evaluation/fixtures/moderated-playtest-cohort-v1.json` outside the repository while
   taking raw working notes. Do not add identity, contact details, recordings, direct quotations,
   seeds, run IDs, or consent capabilities.
2. After the session, add only the sanitized structured session and redacted findings to the tracked
   cohort source. Set every moderator attestation field to `true` only after checking it.
3. Run:

   ```bash
   pnpm export:moderated-playtest
   pnpm validate:moderated-playtest
   ```

4. Open `/playtest-moderation`. Confirm the session count, assigned device/track, task coverage,
   severity counts, and release recommendation match the session.
5. Commit the sanitized source and generated report together. Keep raw working notes outside the
   repository and delete them after the participant has had a reasonable withdrawal window.

The generated report is
`docs/evidence/phase-7-fin007-moderated-playtest.json`. Its hash binds the sanitized cohort summary,
but does not prove a human participated; the moderator remains responsible for honest collection.
