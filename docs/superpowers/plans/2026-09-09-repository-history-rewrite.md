# Repository History Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the canonical skill cleanup into `main` and remove superseded media from reachable
repository history without discarding unique work on other remote branches.

**Architecture:** Perform the rewrite in an isolated shared mirror, never in a working checkout.
Derive the purge list from media paths that occurred in merged `main` history but are absent from its
cleaned tip, apply that same deletion across every remote branch, then migrate the approved source
path classes to Git LFS across all rewritten branches. Publish the verified ref set atomically with
explicit force-with-lease expectations.

**Tech Stack:** Git, git-filter-repo, Git LFS, shell verification, pnpm

**Spec:** `docs/superpowers/specs/2026-09-09-skill-icon-canonical-cleanup-design.md`

## Global Constraints

- Preserve every remote branch and its unique non-superseded files and commits.
- Purge only historical media paths that are absent from the merged `main` tip.
- Keep the 457 frameless skill interiors, seven frames, backing, geometry, and generated runtime.
- Convert only the approved `.gitattributes` source path classes to Git LFS.
- Use an atomic, force-with-lease-protected remote update.
- Keep a local pre-rewrite ref map until remote verification succeeds.

---

### Task 1: Capture and merge refs in an isolated mirror

**Files:**

- Create outside repository: temporary shared mirror and pre-rewrite ref map
- Modify: `refs/heads/main` in the temporary mirror

**Interfaces:**

- Consumes: fetched remote heads and `codex/skill-assets-lfs`
- Produces: an isolated merged `main` ref plus old-ref lease map

- [ ] Verify the feature tip is a descendant of current `origin/main` or rebase it safely first.
- [ ] Record every remote branch name and exact object ID outside the rewrite target.
- [ ] Create a shared temporary mirror and fast-forward its `main` to the cleanup feature tip.
- [ ] Record every branch-tip path/mode inventory for post-rewrite comparison.

### Task 2: Purge superseded media and migrate retained sources

**Files:**

- Create outside repository: exact purge-path list
- Modify: all temporary-mirror branch refs and affected historical commits

**Interfaces:**

- Consumes: merged `main`, old-ref map, and root `.gitattributes`
- Produces: rewritten branches with obsolete media absent and retained approved sources as LFS

- [ ] Enumerate image/video paths that occur in merged `main` history but do not exist at its tip.
- [ ] Run `git filter-repo --invert-paths` against that exact list across all branch refs.
- [ ] Run `git lfs migrate import --everything` only for the approved source path patterns.
- [ ] Remove the now-merged feature ref from the publication set.

### Task 3: Verify and publish rewritten history

**Files:**

- Inspect: rewritten refs, purged paths, LFS objects, and checked-out `main`
- Modify: remote branch refs through one atomic push

**Interfaces:**

- Consumes: rewritten mirror and old-ref lease map
- Produces: rewritten remote branches and merged `main`

- [ ] Confirm each surviving branch retains the same path/mode inventory except for the exact purge
      list and that `main` contains the canonical cleanup.
- [ ] Confirm no purged path is reachable and every approved source path is an LFS pointer.
- [ ] Push all rewritten branches plus feature-branch deletion atomically, with one explicit
      force-with-lease per old remote ref.
- [ ] Fetch the published refs, verify remote object IDs, and run the focused skill/wiki checks from
      rewritten `main`.
- [ ] Keep the local ref map as the recovery record and report its location.
