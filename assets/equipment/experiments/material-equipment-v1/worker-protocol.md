# Equipment material image worker protocol v1

This protocol applies to one assigned Equipment target and its matching assignment. Use the general
image-generation capability. Do not use the enemy-specific `summonlab-image-production` skill or
any enemy production helper, contract, scheduler, asset, or catalog.

The worker must perform these steps in order:

1. Validate the exact target and assignment with the Equipment `validate-packet` command.
2. Inspect every ordered reference for its declared purpose only. Do not transfer subjects, people,
   clothing, props, or any characteristic outside that purpose.
3. Render the canonical prompt with the Equipment `render-prompt` command and submit those
   byte-exact prompt bytes once through the general image-generation capability.
4. Inspect the one returned image against every target acceptance criterion and record one explicit
   finding per criterion.
5. Persist only the exact source returned by that generation call through the Equipment persistence
   helper. Do not substitute, re-export, redraw, or otherwise source another image.
6. Pipe exactly one structured result JSON value to the Equipment `persist-result` command.
7. Verify the persisted result with the Equipment `verify-result` command.
8. Return the verified terminal status and the exact assignment-owned paths to the orchestrator.

The synchronous retry ceiling is zero. Do not make a corrective or replacement generation call.
Candidates are production evidence and are not approved. The worker must not approve, promote, or
export a candidate to an approved-source or runtime location.

The worker may write only the candidate and result paths listed in its assignment. Every non-owned
file is forbidden, including the target, assignment, profile, references, manifest, allocation,
review evidence, run journal, aggregates, runtime catalogs, another job's outputs, all enemy files,
shared image-production contracts, installed skills, and generic or enemy persistence helpers.

For the Copper Sword packet, verify the result with:

```bash
corepack pnpm tsx tools/equipment-image-production.ts verify-result \
  --target assets/equipment/experiments/material-equipment-v1/targets/f/copper/sword-v1.json \
  --assignment assets/equipment/experiments/material-equipment-v1/assignments/f/copper/sword-v1.json \
  --result assets/equipment/experiments/material-equipment-v1/results/f/copper/sword-v1.json
```
