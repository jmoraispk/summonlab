# Repository instructions

## End-of-turn delivery

- Whenever a turn changes repository files, validate the completed work, commit all in-scope changes, and push the current branch to its configured remote before handing back to the user.
- Do not wait for a separate request to commit or push. The only exception is when the user explicitly asks not to commit or not to push.
- Never include unrelated pre-existing changes in the commit. If the in-scope changes cannot be isolated safely, stop and ask for direction.
- Use concise Conventional Commit messages that describe the completed outcome.
- In the final response, report the commit hash, commit subject, push destination, and whether the working tree is clean.
