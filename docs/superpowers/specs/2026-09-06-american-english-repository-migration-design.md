# American English Repository Migration Design

## Context

The repository contains about 23,700 non-US spelling occurrences across more than 5,200 tracked
text files and 1,139 affected tracked paths. These occurrences are not limited to prose. They appear
in UI copy, TypeScript symbols, schema literals, content IDs, filenames, generated manifests,
runtime URLs, production records, and hash-bound evidence.

The migration starts from commit `0125f1348`. Work may continue on `main` while the migration branch
is active, so the branch must refresh its baseline before implementation and again immediately
before integration.

## Goals

- Use conventional American English throughout repository-owned content at the new `HEAD`.
- Cover prose, UI copy, code symbols, schema literals, IDs, filenames, directory names, generated
  artifacts, and runtime manifests.
- Preserve character names and other proper names exactly.
- Preserve required third-party package and API identifiers exactly, including `@img/colour` and
  Sharp's `.toColourspace()` method.
- Prevent new non-US spellings from entering the repository.
- Keep the migration reviewable, reproducible, and safe to merge alongside concurrent work.

## Non-goals

- Preserve old repository URLs, content IDs, or saved payloads that use the retired spellings.
- Add runtime compatibility aliases for retired spellings.
- Modify image pixels solely because an image path changes.
- Rewrite Git history. The pre-migration tree remains available through its commits.
- Apply a general-purpose grammar or writing-style checker beyond the explicit spelling policy.

## Compatibility Decision

This is a clean-break migration. Old saved runs, bookmarked paths, and external payloads may stop
resolving after the migration. The new tree will not retain retired spellings as compatibility
literals because doing so would contradict the repository-wide policy.

The migration must still preserve internal consistency. Every renamed ID, path, schema literal, and
runtime URL must update all producers, consumers, tests, and generated outputs in the same branch.
The migration is not deployable in a partially completed state.

## Enforcement

Add a repository-owned checker with a finite, reviewed rule set rather than relying on a general
dictionary. The checker must inspect:

- every Git-tracked text file;
- every Git-tracked path component;
- lowercase prose and case-preserving code identifiers;
- singular, plural, and inflected forms represented by the approved rule set.

The checker must report the matched form, recommended American form, path, and line when applicable.
It must fail when any disallowed occurrence or path remains.

Exceptions must be scoped and explicit. The initial exception set contains character and proper
names plus required external identifiers. Each exception records the exact token, exact path or path
pattern, and reason. A broad directory exclusion is not allowed.

The checker will have focused tests for prose, snake case, kebab case, camel case, Pascal case,
filenames, allowed proper names, allowed external identifiers, and near-match false positives. Add
`check:american-english` to the root package scripts and the main `check` pipeline only after the
repository passes it.

## Migration Mechanics

### 1. Refresh and freeze the inventory

Fetch `origin/main`, fast-forward or rebase the migration branch, and regenerate the inventory from
the resulting commit. Record counts by rule, repository area, and path. Abort if the working tree is
dirty or if two proposed destination paths collide.

### 2. Establish the guard before bulk changes

Implement and test the checker, but do not add it to the required root pipeline while known
violations remain. Use its machine-readable output as the source of truth for the migration rather
than an ad hoc editor search.

### 3. Update canonical source owners

Update handwritten contracts, content definitions, application code, tools, tests, skills, and
documentation first. Rename TypeScript symbols and schema literals consistently. Use `git mv` for
tracked path changes so review preserves file lineage.

Work in domain-sized commits:

1. low-risk prose and UI copy;
2. equipment contracts, IDs, tools, and assets;
3. creature names, palette terms, content IDs, and assets;
4. remaining spelling families;
5. generated and runtime outputs;
6. final enforcement activation.

### 4. Rebuild derived artifacts

Use each domain's existing exporter or materializer to rebuild derived JSON, HTML, runtime manifests,
and static bundles. Do not hand-edit generated hashes. Binary image bytes may move without pixel
changes; content hashes remain valid when they hash bytes only. Any hash that covers a path, ID,
prompt, canonical JSON object, or manifest must be recomputed by its owning tool.

Historical production records in the new tree become US-spelled successor records rather than
silently claiming their metadata bytes never changed. Git retains the original records at the
pre-migration commit. Where a schema or validator requires a new version for changed canonical
metadata, introduce that version and update all active consumers together.

### 5. Validate closure

Run targeted domain checks after each domain-sized commit. Before integration, require:

- the American English checker passes for both text and paths;
- every generated-artifact check passes;
- runtime visual and content binding checks pass;
- formatting, linting, type checks, unit tests, integration tests, builds, and budget checks pass;
- `git status` is clean;
- a fresh inventory contains no unapproved occurrence.

The final validation command is `pnpm check`, followed by `pnpm test:integration` and the spelling
checker again to catch files created by validation.

## Concurrent Change and Merge Strategy

The migration branch must not merge stale generated output over newer work.

1. Fetch `origin/main` immediately before the final review.
2. Rebase the migration branch onto the fetched `origin/main`.
3. Resolve handwritten source conflicts semantically, preserving the incoming feature behavior while
   applying the American spelling policy.
4. Do not manually merge generated artifacts. Delete or regenerate conflicted derived outputs from
   the resolved source owners with their documented exporters.
5. Regenerate the full spelling inventory because line numbers, paths, IDs, and counts may have
   changed during the rebase.
6. Run the complete validation sequence on the rebased result.
7. Integrate the migration atomically. Do not cherry-pick only part of the commit series into a
   deployable branch.

If `main` changes a hash-bound production lineage during the migration, the incoming lineage wins as
the semantic base. Reapply the spelling migration to that lineage and regenerate all of its dependent
records.

## Failure Handling and Rollback

- A collision, missing producer, stale hash, unrecognized schema version, or unexplained generated
  diff stops the migration for that domain.
- Never make a failing validator pass by weakening provenance, hash, or ownership checks.
- Keep commits domain-sized so a failed domain can be repaired or reverted without discarding
  independently validated work.
- Because compatibility aliases are intentionally absent, deployment and rollback operate on the
  complete migration, not a partial subset.
- Rolling back means reverting the complete migration series to the pre-migration commit and
  redeploying its matching artifacts together.

## Acceptance Criteria

- The repository policy in `AGENTS.md` requires American English for new and modified work.
- The automated checker passes on every tracked text file and path.
- Only scoped character, proper-name, package-name, and API-name exceptions remain.
- No retired spelling remains in active IDs, schemas, filenames, directories, UI copy, or prose.
- All source-to-derived checks and the complete repository validation suite pass after rebasing onto
  the latest `origin/main`.
- The migration branch is clean, pushed, and reviewed as one atomic integration unit.
