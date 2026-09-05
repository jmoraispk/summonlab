# Agentic Skills Wiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Publish a deterministic `/wiki/systems/agentic-skills` inventory of every
repository-discoverable Summonlab and pinned PixiJS skill, with discovery aliases and checked source
links.

**Architecture:** A repository tool discovers canonical and `.agents/skills` `SKILL.md` files,
resolves symlinks inside the repository, parses their YAML frontmatter, classifies ownership, and
renders one marked region in a hand-authored wiki page. The existing wiki validator and server tests
enforce inventory freshness, alias parity, public routing, and GitHub source-link rewriting.

**Tech Stack:** Node.js 24 ESM, `node:test`, Markdown, JSON wiki catalog, SvelteKit, marked, Vitest,
pnpm.

**Spec:** `docs/superpowers/specs/2026-09-04-agentic-skills-and-combat-polish-design.md`

## Global Constraints

- Synchronize from `origin/main`, never the locally ahead `main` checkout.
- Inventory exactly eight `summonlab-*` skills and all 26 installed `pixijs*` skills after
  synchronization.
- Exclude machine-global, system, plugin, marketplace, and personal skills outside this repository.
- Canonical Summonlab sources stay under `skills/` when present; `.agents/skills` entries are
  relative aliases, not content copies.
- Direct first-party skills already stored under `.agents/skills` remain direct directories.
- Duplicate skill names with different canonical content, escaped symlinks, missing aliases, and
  stale generated Markdown are validation failures.
- The generator owns only the region between
  `<!-- BEGIN GENERATED AGENTIC SKILL INVENTORY -->` and
  `<!-- END GENERATED AGENTIC SKILL INVENTORY -->`.
- Do not redesign the wiki shell or mix agentic skills with the in-game hero-skill taxonomy.

---

### Task 1: Synchronize the Combat Branch and Record the Wiki Baseline

**Files:**

- Modify through merge: files changed by `origin/main`
- Do not modify: files present only on the locally ahead `main` branch

**Interfaces:**

- Consumes: remote ref `origin/main` and branch `codex/realtime-combat-study`.
- Produces: a merge commit for which `git merge-base --is-ancestor origin/main HEAD` exits zero,
  plus recorded baseline results for wiki validation and wiki unit tests.

- [ ] **Step 1: Confirm branch identity and a clean worktree**

Run:

```bash
git status --short --branch
git branch --show-current
git remote get-url origin
```

Expected: branch is `codex/realtime-combat-study`, the status contains no file entries, and `origin`
is the configured Summonlab remote. Stop if unrelated local changes appear.

- [ ] **Step 2: Fetch and merge the remote main branch**

Run:

```bash
git fetch origin main
git merge --no-ff origin/main -m "chore(repo): synchronize combat study with main"
git merge-base --is-ancestor origin/main HEAD
```

Expected: the merge completes without conflicts and the ancestry check exits zero. Do not merge the
local `main` ref.

- [ ] **Step 3: Run and save the synchronized wiki baseline**

Run:

```bash
pnpm validate:wiki
pnpm --filter @summonlab/web test:unit -- src/lib/server/wiki.spec.ts
```

Expected: both commands pass. If either fails, run the same failing command against the first merge
parent in a temporary worktree and record whether it is an inherited `origin/main` failure before
editing feature files; never weaken an existing check to hide a baseline failure.

- [ ] **Step 4: Push the synchronization commit**

Run:

```bash
git push origin codex/realtime-combat-study
```

Expected: the configured remote branch advances to the merge commit.

### Task 2: Build the Repository Skill Inventory Contract

**Files:**

- Create: `tools/agentic-skill-inventory.mjs`
- Create: `tools/agentic-skill-inventory.spec.mjs`
- Modify: `package.json`

**Interfaces:**

- Consumes: `<repositoryRoot>/skills/*/SKILL.md` and
  `<repositoryRoot>/.agents/skills/*/SKILL.md`.
- Produces:
  `discoverAgenticSkills(repositoryRoot: string): Promise<ReadonlyArray<SkillInventoryEntry>>`,
  `renderAgenticSkillInventory(entries: ReadonlyArray<SkillInventoryEntry>): string`, and a CLI with
  `--write`, `--check`, and optional `--repository-root REPOSITORY_ROOT`.
- `SkillInventoryEntry` has exact fields
  `{ name: string, description: string, ownership: 'summonlab' | 'external-pixijs', canonicalPath: string, discoveryPath: string }`.

- [ ] **Step 1: Write fixture helpers and the failing happy-path test**

Create temporary fixture roots with this layout and make the alias relative:

```text
skills/summonlab-alpha/SKILL.md
.agents/skills/summonlab-alpha -> ../../skills/summonlab-alpha
.agents/skills/pixijs/SKILL.md
```

The first test imports the planned function and asserts:

```js
assert.deepEqual(await discoverAgenticSkills(fixtureRoot), [
	{
		name: 'summonlab-alpha',
		description: 'Use when testing a first-party skill.',
		ownership: 'summonlab',
		canonicalPath: 'skills/summonlab-alpha/SKILL.md',
		discoveryPath: '.agents/skills/summonlab-alpha/SKILL.md'
	},
	{
		name: 'pixijs',
		description: 'Use when routing PixiJS work.',
		ownership: 'external-pixijs',
		canonicalPath: '.agents/skills/pixijs/SKILL.md',
		discoveryPath: '.agents/skills/pixijs/SKILL.md'
	}
]);
```

- [ ] **Step 2: Add failing boundary tests**

Add one test per invariant:

```js
await assert.rejects(() => discoverAgenticSkills(missingAliasRoot), /missing.*alias/i);
await assert.rejects(() => discoverAgenticSkills(escapedSymlinkRoot), /outside.*repository/i);
await assert.rejects(() => discoverAgenticSkills(conflictingDuplicateRoot), /duplicate.*name/i);
await assert.rejects(() => discoverAgenticSkills(unsupportedNameRoot), /unsupported.*skill/i);
```

Also assert that a canonical file plus its matching alias yields one entry, names are sorted first by
ownership and then by name, and descriptions come from YAML frontmatter rather than heading text.

- [ ] **Step 3: Run the inventory tests and verify red**

Run:

```bash
node --test tools/agentic-skill-inventory.spec.mjs
```

Expected: FAIL because `tools/agentic-skill-inventory.mjs` does not exist.

- [ ] **Step 4: Implement path-safe discovery and frontmatter parsing**

Implement these exact exports:

```js
export async function discoverAgenticSkills(repositoryRoot) {
	const canonicalCandidates = await skillFilesUnder(repositoryRoot, 'skills');
	const discoveryCandidates = await skillFilesUnder(repositoryRoot, '.agents/skills');
	const canonicalByRealPath = await indexCandidates(repositoryRoot, canonicalCandidates);
	const discoveryByRealPath = await indexCandidates(repositoryRoot, discoveryCandidates);
	const entriesByName = new Map();
	for (const [realSkillPath, canonical] of canonicalByRealPath) {
		if (!canonical.name.startsWith('summonlab-')) continue;
		const discovery = discoveryByRealPath.get(realSkillPath);
		if (!discovery) throw new Error(`Missing repository discovery alias for ${canonical.name}`);
		addUniqueName(entriesByName, entryFrom(canonical, discovery));
	}
	for (const discovery of discoveryByRealPath.values()) {
		if (canonicalByRealPath.has(discovery.realSkillPath)) continue;
		addUniqueName(entriesByName, entryFrom(discovery, discovery));
	}
	return [...entriesByName.values()].sort(compareOwnershipThenName);
}
```

Classification is exact: names beginning `summonlab-` are `summonlab`; names equal to `pixijs` or
beginning `pixijs-` are `external-pixijs`; every other discovered skill is rejected so the wiki does
not silently broaden its scope. `skillFilesUnder(root, relativeDirectory)` returns only direct-child
`SKILL.md` paths, and `compareOwnershipThenName(left, right)` orders `summonlab` before
`external-pixijs` and then uses `name.localeCompare()`. `indexCandidates()` records normalized
repository-relative paths, `realSkillPath`, and parsed frontmatter; `entryFrom()` chooses the
canonical and discovery paths; `addUniqueName()` accepts an equal real path once and throws when the
same name resolves to different content.

- [ ] **Step 5: Implement deterministic region rendering and CLI modes**

Use these markers and headings:

```js
export const INVENTORY_START = '<!-- BEGIN GENERATED AGENTIC SKILL INVENTORY -->';
export const INVENTORY_END = '<!-- END GENERATED AGENTIC SKILL INVENTORY -->';

export function renderAgenticSkillInventory(entries) {
	const summonlab = entries.filter(({ ownership }) => ownership === 'summonlab');
	const pixijs = entries.filter(({ ownership }) => ownership === 'external-pixijs');
	const renderTable = (rows) => [
		'| Skill | Description | Discovery |',
		'| --- | --- | --- |',
		...rows.map(({ name, description, canonicalPath, discoveryPath }) =>
			`| [\`${name}\`](../../../${canonicalPath}) | ${description} | [\`${discoveryPath}\`](../../../${discoveryPath}) |`
		)
	].join('\n');
	return [
		INVENTORY_START,
		`_Inventory: ${entries.length} skills (${summonlab.length} Summonlab, ${pixijs.length} pinned PixiJS)._`,
		'## Summonlab-authored skills',
		renderTable(summonlab),
		'## Pinned external PixiJS skills',
		renderTable(pixijs),
		INVENTORY_END
	].join('\n\n');
}
```

Each table row links the name to its `../../../${canonicalPath}` value and the discovery label to
its `../../../${discoveryPath}` value. `--write` replaces exactly one existing marked region;
`--check` compares the in-memory replacement byte-for-byte and exits nonzero with
`agentic-skills wiki inventory is stale` on mismatch.

- [ ] **Step 6: Add freshness and repository-inventory assertions**

Add tests that run discovery against the real repository and assert exact names:

```js
assert.deepEqual(summonlabNames, [
	'summonlab-character-action-creation',
	'summonlab-character-animations',
	'summonlab-enemy-creation',
	'summonlab-hero-creation',
	'summonlab-image-production',
	'summonlab-item-production',
	'summonlab-skill-creation',
	'summonlab-skill-icon-production'
]);
assert.equal(pixijsNames.length, 26);
assert.equal(entries.length, 34);
```

Create a temporary Markdown fixture with one marked region, verify `--write` preserves prose before
and after it, and verify `--check` rejects a removed row.

- [ ] **Step 7: Add package commands and run green checks**

Add:

```json
"export:wiki-agentic-skills": "node tools/agentic-skill-inventory.mjs --write",
"validate:wiki-agentic-skills": "node tools/agentic-skill-inventory.mjs --check"
```

Run:

```bash
node --test tools/agentic-skill-inventory.spec.mjs
```

Expected: all discovery, classification, path-safety, deduplication, and region tests pass.

- [ ] **Step 8: Commit the inventory contract**

```bash
git add package.json tools/agentic-skill-inventory.mjs tools/agentic-skill-inventory.spec.mjs
git commit -m "feat(wiki): add agentic skill inventory generator"
```

### Task 3: Complete Repository Discovery and Publish the Wiki Page

**Files:**

- Create: `.agents/skills/summonlab-character-animations` (relative symlink)
- Create: `.agents/skills/summonlab-image-production` (relative symlink)
- Create: `.agents/skills/summonlab-item-production` (relative symlink)
- Create: `.agents/skills/summonlab-skill-creation` (relative symlink)
- Create: `.agents/skills/summonlab-skill-icon-production` (relative symlink)
- Modify: `.agents/skills/README.md`
- Create: `docs/wiki/systems/agentic-skills.md`
- Modify: `docs/wiki/catalog.json`
- Modify: `docs/wiki/README.md`
- Modify: `docs/wiki/systems/README.md`
- Modify: `package.json`

**Interfaces:**

- Consumes: `discoverAgenticSkills()` and the marked-region renderer from Task 2.
- Produces: public catalog entry `systems.agentic-skills`, route
  `/wiki/systems/agentic-skills`, 34 generated rows, and `pnpm validate:wiki-agentic-skills` inside
  the aggregate `pnpm validate:wiki` command.

- [ ] **Step 1: Create every missing first-party discovery alias**

For each canonical `skills/summonlab-*` directory without a matching alias, create the relative
directory symlink:

```bash
ln -s ../../skills/summonlab-character-animations .agents/skills/summonlab-character-animations
ln -s ../../skills/summonlab-image-production .agents/skills/summonlab-image-production
ln -s ../../skills/summonlab-item-production .agents/skills/summonlab-item-production
ln -s ../../skills/summonlab-skill-creation .agents/skills/summonlab-skill-creation
ln -s ../../skills/summonlab-skill-icon-production .agents/skills/summonlab-skill-icon-production
```

Retain direct `.agents/skills/summonlab-enemy-creation` and
`.agents/skills/summonlab-hero-creation` directories. Verify all aliases with:

```bash
find .agents/skills -mindepth 1 -maxdepth 1 -name 'summonlab-*' -printf '%f %y %l\n' | sort
```

- [ ] **Step 2: Create the hand-authored wiki shell with one empty generated region**

Write `docs/wiki/systems/agentic-skills.md` with this required structure:

```markdown
# Agentic skills

Wiki ID: `systems.agentic-skills`

Agentic skills are repository-scoped operating instructions that Codex loads when a task matches a
skill's trigger. This page inventories project canon, not every capability installed on one machine.

## Inventory boundary

Include Summonlab-authored skills and the repository-pinned PixiJS support collection. Exclude
global system, plugin, marketplace, and personal skills outside this repository.

<!-- BEGIN GENERATED AGENTIC SKILL INVENTORY -->
<!-- END GENERATED AGENTIC SKILL INVENTORY -->

## Character action to animation handoff

When an action already has a known motion contract, animation production consumes that authority.
When it does not, `summonlab-character-action-creation` defines and gains approval for the five-beat
action before `summonlab-character-animations` creates raster frames.

## Maintenance

Run `pnpm export:wiki-agentic-skills` after adding, removing, renaming, or re-aliasing a repository
skill. `pnpm validate:wiki-agentic-skills` rejects stale inventory and discovery drift.
```

- [ ] **Step 3: Register and link the public page**

Add this catalog object without reordering unrelated entries:

```json
{
  "wikiId": "systems.agentic-skills",
  "path": "docs/wiki/systems/agentic-skills.md",
  "pageType": "engineering-system",
  "owner": "architecture",
  "designStatus": "accepted",
  "implementationStatus": "verified",
  "visualStatus": "none",
  "spoilerScope": "public"
}
```

Add an `Agentic skills` browse link to `docs/wiki/README.md` and a detailed-brief link to
`docs/wiki/systems/README.md`.

- [ ] **Step 4: Generate the real inventory and verify counts**

Run:

```bash
pnpm export:wiki-agentic-skills
pnpm validate:wiki-agentic-skills
```

Expected: the page reports `34 skills (8 Summonlab, 26 pinned PixiJS)`, every name appears once,
and the explanatory prose outside the marked region is unchanged.

- [ ] **Step 5: Make aggregate wiki validation require inventory freshness**

Append `pnpm validate:wiki-agentic-skills` to the existing `validate:wiki` script after
`node tools/validate-wiki.mjs`:

```json
"validate:wiki": "node tools/validate-wiki.mjs && pnpm validate:wiki-agentic-skills && pnpm validate:wiki-affinities && pnpm validate:skill-taxonomy"
```

- [ ] **Step 6: Run wiki validation and formatting**

Run:

```bash
pnpm validate:wiki
pnpm exec prettier --check package.json tools/agentic-skill-inventory.mjs \
  tools/agentic-skill-inventory.spec.mjs docs/wiki/systems/agentic-skills.md \
  docs/wiki/catalog.json docs/wiki/README.md docs/wiki/systems/README.md .agents/skills/README.md
git diff --check
```

Expected: all commands pass with 34 unique inventory entries and no broken local links.

- [ ] **Step 7: Commit the discoverable wiki inventory**

```bash
git add .agents/skills docs/wiki package.json
git commit -m "docs(wiki): publish repository agentic skills"
```

### Task 4: Render Repository Skill Links Correctly

**Files:**

- Modify: `apps/web/src/lib/server/wiki.ts`
- Modify: `apps/web/src/lib/server/wiki.spec.ts`

**Interfaces:**

- Consumes: Markdown links resolving to repository-root `skills/` and `.agents/` paths.
- Produces: GitHub `blob/main` URLs from `resolveTarget()` and a public page returned by
  `getWikiPage('systems/agentic-skills')`.

- [ ] **Step 1: Write failing page and source-link tests**

Add a focused test:

```ts
it('publishes the complete repository agentic-skill inventory', () => {
	const page = getWikiPage('systems/agentic-skills');
	expect(page?.wikiId).toBe('systems.agentic-skills');
	expect(page?.html).toContain('34 skills (8 Summonlab, 26 pinned PixiJS)');
	expect(page?.html.match(/<tr>/gu)).toHaveLength(36);
	expect(page?.html).toContain(
		'https://github.com/jmoraispk/summonlab/blob/main/skills/summonlab-character-animations/SKILL.md'
	);
	expect(page?.html).toContain(
		'https://github.com/jmoraispk/summonlab/blob/main/.agents/skills/pixijs/SKILL.md'
	);
	expect(getWikiNavigation()).toContainEqual(
		expect.objectContaining({ href: '/wiki/systems/agentic-skills', section: 'Systems' })
	);
});
```

The two header rows plus 34 body rows make the exact `<tr>` count 36.

- [ ] **Step 2: Run the focused test and verify the link failure**

Run:

```bash
pnpm --filter @summonlab/web test:unit -- src/lib/server/wiki.spec.ts
```

Expected: FAIL because repository-source rewriting does not yet recognize `skills/` and `.agents/`.

- [ ] **Step 3: Extend only the repository-source path allowlist**

Change the existing expression in `resolveTarget()` to:

```ts
if (/^(?:\.agents|apps|assets|docs|packages|skills|tools)\//.test(repositoryPath)) {
	return `https://github.com/jmoraispk/summonlab/blob/main/${repositoryPath}${suffix}`;
}
```

Keep URI rejection, wiki-route rewriting, bundled asset handling, suffix handling, and HTML escaping
unchanged.

- [ ] **Step 4: Run the focused server and wiki checks**

Run:

```bash
pnpm --filter @summonlab/web test:unit -- src/lib/server/wiki.spec.ts
pnpm --filter @summonlab/web typecheck
pnpm validate:wiki
```

Expected: the route, row-count, navigation, and source-link assertions pass.

- [ ] **Step 5: Commit server integration**

```bash
git add apps/web/src/lib/server/wiki.ts apps/web/src/lib/server/wiki.spec.ts
git commit -m "feat(wiki): render agentic skill source links"
```

### Task 5: Verify and Deliver the Agentic Skills Wiki

**Files:**

- Modify only files already listed in this plan if verification exposes an in-scope defect.

**Interfaces:**

- Consumes: Tasks 1–4.
- Produces: a pushed, clean branch and an owner-reviewable public wiki route.

- [ ] **Step 1: Run the complete focused suite**

```bash
node --test tools/agentic-skill-inventory.spec.mjs
pnpm validate:wiki-agentic-skills
pnpm validate:wiki
pnpm --filter @summonlab/web test:unit -- src/lib/server/wiki.spec.ts
pnpm --filter @summonlab/web typecheck
pnpm exec prettier --check package.json tools/agentic-skill-inventory.mjs \
  tools/agentic-skill-inventory.spec.mjs docs/wiki/systems/agentic-skills.md \
  docs/wiki/catalog.json docs/wiki/README.md docs/wiki/systems/README.md \
  apps/web/src/lib/server/wiki.ts apps/web/src/lib/server/wiki.spec.ts
git diff --check
```

Expected: every command passes.

- [ ] **Step 2: Run broad tests and classify only inherited failures**

Run:

```bash
pnpm test
pnpm lint
```

Expected: both pass. If a failure is unrelated, reproduce it at the synchronized merge commit,
report its exact command and error, and leave unrelated code unchanged.

- [ ] **Step 3: Inspect scope and commit any verification-only correction**

Run:

```bash
git status --short
git diff --check
git log --oneline --decorate -6
```

If verification required an in-scope edit, commit only that edit with:

```bash
git add package.json tools/agentic-skill-inventory.mjs tools/agentic-skill-inventory.spec.mjs \
  docs/wiki/systems/agentic-skills.md docs/wiki/catalog.json \
  docs/wiki/README.md docs/wiki/systems/README.md apps/web/src/lib/server/wiki.ts \
  apps/web/src/lib/server/wiki.spec.ts .agents/skills/README.md
git commit -m "fix(wiki): close agentic inventory validation gap"
```

Expected: no scratch fixtures, absolute machine paths, copied skill directories, or unrelated edits.

- [ ] **Step 4: Push and start the review server**

Run:

```bash
git push origin codex/realtime-combat-study
pnpm --filter @summonlab/web dev --host 0.0.0.0 --port 5173
```

Expected: push succeeds and the server listens on `0.0.0.0:5173`.

- [ ] **Step 5: Deliver the wiki checkpoint**

Share `http://10.110.24.218:5173/wiki/systems/agentic-skills`. Ask the owner to verify that the
first-party/external split is understandable, the action-to-animation handoff is useful, and the
source/discovery links communicate where skills are maintained versus discovered.
