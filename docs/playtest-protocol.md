# FIN-007 owner playtest

**Protocol:** `owner-playtest-v1`

**Gate:** one owner playthrough on desktop or phone

The playtest should feel like playing a game, not administering a study. The owner does not copy,
edit, or export evidence files. Codex maintains the checked evidence after the owner describes the
experience in ordinary language.

## What the player does

1. Start the app and open the player title.
2. Optionally choose **I’m 18+ · share playtest data**. If chosen, allowlisted journey statistics
   collect automatically in the background. Declining does not change the game or block release.
3. Begin a new chronicle and play naturally through:
   - the summoning introduction;
   - all three hero dossiers;
   - one conversation and direction;
   - the first arrival in Hearth 01;
   - the prototype Floor 01 return and First Ember choice; and
   - the objectives and settings in the pause menu.
4. Stop early if the game blocks progress or if continuing stops being useful.
5. Send Codex ordinary comments: what was enjoyable, confusing, slow, broken, or missing.

No task spreadsheet, moderator script, recording, screenshot set, JSON editing, manual statistics,
device report, timestamp, or session timer is required from the owner.

## Background statistics

FIN-006 already owns the statistics boundary. Before opt-in, the browser sends no analytics request.
After one explicit opt-in, the application records only seven strict first-party journey event types
and produces an aggregate development report at `/playtest-report`. It rejects arbitrary text,
names, seeds, dialogue, IP addresses, user agents, and unknown properties. Sharing can be withdrawn
and deleted from Pause → Settings.

Statistics are supporting signal, not a condition for FIN-007. A completed playthrough with sharing
off is valid human feedback.

## What Codex does afterward

Codex translates the owner's comments into the single checked `OWNER-01` session and concise,
paraphrased findings. Each checkpoint is recorded as `completed`, `completed-with-friction`,
`blocked`, or `not-reached`. Friction and blockers receive P0–P3 triage:

| Severity | Meaning | Required response |
| --- | --- | --- |
| `P0` | Privacy issue, data loss, crash, unsafe irreversible action, or inability to start | Fix before retest |
| `P1` | The core journey cannot be completed or understood | Fix before release |
| `P2` | Material friction with a discoverable workaround | Schedule correction |
| `P3` | Polish, preference, or future opportunity | Record or accept |

Codex regenerates and validates the FIN-007 and FIN-008 evidence. Packaging stays held until the
owner journey is reviewed and every P0/P1 finding is verified. Automated tests remain preflight
evidence and cannot create `OWNER-01`.

## Later friends round

Friends can be invited after the owner loop is useful and stable. Their feedback is a separate,
optional expansion round; it is not part of the current FIN-007 release gate. If that round begins,
the privacy disclosure and consented background-statistics boundary still apply. Deeper missions
remain covered by automated tests until they are connected to this player journey; the owner is not
asked to navigate development-only routes.
