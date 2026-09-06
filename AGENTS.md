# Repository instructions

## Language

- Use conventional American English for all new or modified repository-owned prose, UI copy, code
  symbols, schema literals, IDs, filenames, and directory names—for example, `armor`, `color`,
  `gray`, and `behavior`.
- Do not introduce British or Commonwealth spelling variants as precedent for new work.
- Preserve character names, other proper names, and required third-party package or API identifiers
  verbatim.
- Do not casually rename legacy identifiers. Normalize them only in an explicitly scoped migration
  that updates every reference, generated artifact, compatibility boundary, and hash or checksum
  binding together.

## End-of-turn delivery

- Whenever a turn changes repository files, validate the completed work, commit all in-scope changes, and push the current branch to its configured remote before handing back to the user.
- Do not wait for a separate request to commit or push. The only exception is when the user explicitly asks not to commit or not to push.
- Never include unrelated pre-existing changes in the commit. If the in-scope changes cannot be isolated safely, stop and ask for direction.
- Use concise Conventional Commit messages that describe the completed outcome.
- In the final response, report the commit hash, commit subject, push destination, and whether the working tree is clean.

## Feedback cadence

- End every turn with at least one focused request for product, visual, technical, or playtest feedback.
- When a runnable slice changes, provide the exact path or command, two or three useful test actions, and the specific decisions the test should inform.
- Do not block safe implementation work on unanswered preferences. State the current assumption, proceed on reversible work, and record durable answers in the relevant project document.
- Treat feedback as accepted, revise, experiment, or deferred. Preserve accepted decisions in the repository so later turns do not have to rediscover them.
- Prefer small reviewable slices with visible evidence over long periods without a user checkpoint.

## Remote preview links

- The collaborator connects to this remote server through `10.110.24.218`; Cursor does not
  automatically forward ports.
- Bind every user-facing local preview or development server to `0.0.0.0` and publish its URL with
  `10.110.24.218` instead of `localhost` or `127.0.0.1`.
- Preserve the full port, path, query string, and session key when rewriting a preview URL for the
  collaborator. Verify the listening interface before sharing the link.

## Character artwork

- Player-facing characters must always use approved raster image assets. Never draw or approximate
  characters with CSS geometry, inline SVG, canvas vectors, emoji, typography, or other procedural
  stand-ins.
- Use the approved transparent `village-cutout`, derived from the normal-proportion summon portrait,
  for heroes standing in the Village. Use the approved combat chibi for combat scale. Prefer the
  approved realistic summon, dialogue, or roster image for portraits and detail views. Never place
  an opaque rectangular portrait into a world scene.
- When no approved character image exists, show a clearly labeled non-character missing-art state;
  do not invent a character depiction.
