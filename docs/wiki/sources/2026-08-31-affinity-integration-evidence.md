# Affinity wiki integration evidence

Wiki ID: `sources.affinity-integration-evidence-2026-08-31`

This page records the final review gate for the four-base, six-dual affinity wiki integration. The
integration batch is dated 2026-08-31; the complete acceptance rerun and local preview were
performed on 2026-09-01 in the required repository worktree after rebasing onto `origin/main` at
`efa974222257a570f7ef64292864f14104c35d21`.

No runtime catalog or engine contract changed

## Locked roster and cycle

The exact ten-name roster is four bases plus six rare duals:

| Kind | Name | Parents | Signature status |
| --- | --- | --- | --- |
| Base | Fire | — | Burn |
| Base | Earth | — | Weight |
| Base | Wind | — | Lacerate |
| Base | Water | — | Chill |
| Dual | Mist | Water × Fire | Shroud |
| Dual | Lightning | Fire × Wind | Shock |
| Dual | Sand | Wind × Earth | Abrade |
| Dual | Rot | Earth × Water | Decay |
| Dual | Magma | Fire × Earth | Melt |
| Dual | Ice | Water × Wind | Freeze |

The sole overcoming cycle contains these four directed edges:

1. Earth → Water
2. Water → Fire
3. Fire → Wind
4. Wind → Earth

## Acceptance commands and results

Every command below used the repository Node installation:

```bash
SUMMONLAB_NODE_BIN=/home/joao/.nvm/versions/node/v24.19.0/bin
PATH="$SUMMONLAB_NODE_BIN:$PATH"
```

The affinity contract passed:

```bash
pnpm validate:wiki-affinities
```

```text
Wiki affinity contract passed.
Exit status: 0
```

The retired exact noun gate constructs its case-insensitive whole-word pattern from separated
shell fragments so this rendered record does not republish the retired noun:

```bash
retired='reso''nance'
rg -n -i "\b${retired}\b" docs/wiki --glob '*.md'
status=$?
printf 'rg_status=%d\n' "$status"
test "$status" -eq 1
```

```text
rg_status=1
Wrapper exit status: 0
```

The retired active-rule phrase gate likewise constructs its search pattern from separated shell
fragments:

```bash
rule_terms='wood affin''ity|metal affin''ity|five base affin''ities|derived affin''ity'
rg -n -i "$rule_terms" docs/wiki --glob '*.md'
status=$?
printf 'rg_status=%d\n' "$status"
test "$status" -eq 1
```

```text
rg_status=1
Wrapper exit status: 0
```

For both searches, `rg_status=1` is the expected no-match result; the explicit wrapper exits `0`
only for that clean outcome.

The complete repository acceptance commands passed:

```bash
pnpm validate:wiki
pnpm validate:wiki-monsters
pnpm validate:skill-taxonomy
pnpm --filter @summonlab/web test
pnpm --filter @summonlab/web typecheck
```

| Command | Recorded result |
| --- | --- |
| `pnpm validate:wiki` | Exit `0`; 101 cataloged wiki pages and 24 asset references across 23 files; the chained affinity contract and skill-taxonomy reconciliation passed. |
| `pnpm validate:wiki-monsters` | Exit `0`; 40 monster pages and 240 preserved web visual studies validated. |
| `pnpm validate:skill-taxonomy` | Exit `0`; 520 mapped legacy rows and 456 target rows reconciled: 258 Martial, 124 Magical, 74 Craft. |
| `pnpm --filter @summonlab/web test` | Exit `0`; 18 test files and 82 tests passed. |
| `pnpm --filter @summonlab/web typecheck` | Exit `0`; 0 errors and 0 warnings. |

Supplemental final-batch checks passed:

| Command | Recorded result |
| --- | --- |
| `pnpm vitest run tools/affinity-wiki-diagrams.spec.ts` | Exit `0`; the rendered matrix preserves distinct Earth, Water, and empty-cell fills. |
| `pnpm --filter @summonlab/web exec vitest run src/lib/server/wiki.spec.ts` | Exit `0`; 10 registry tests passed, including local bundling of both accepted affinity diagrams. |
| Project-scoped `pnpm exec prettier --check` on final-batch paths | Exit `0`; every matched source and configuration file uses project formatting. |
| `git diff --check` and `git diff --cached --check` | Exit `0`; no whitespace errors in the final batch. |

## Local preview evidence

`pnpm dev:app` started this worktree's local application at `http://127.0.0.1:5174`; port `5173` was
already owned by an unrelated main checkout and was not used or stopped. A local Chromium session
visited each exact route, required HTTP `200`, evaluated the relevant rendered content, loaded and
decoded each route image, and captured a 1440 × 1000-viewport full-page screenshot. This worktree's
web and worker servers on `5174` and `4174` were stopped after capture.

| Route | Review result | Screenshot |
| --- | --- | --- |
| `/wiki/mechanics/progression/affinities` | Passed: the only cycle reads Earth → Water → Fire → Wind → Earth; both SVGs decode locally; the matrix visibly contains four bases plus six duals with distinct cell fills. | [progression affinities](../../evidence/affinity-wiki-integration-2026-08-31/progression-affinities-main-efa9742.png) |
| `/wiki/mechanics/affinities` | Passed: the navigation page states four bases, six rare duals, and ten total, and lists the exact roster. | [affinity index](../../evidence/affinity-wiki-integration-2026-08-31/affinities-index-main-efa9742.png) |
| `/wiki/mechanics/skills/magical-elemental` | Passed: Fire, Water, and Earth ladders remain published; Wind is explicitly active and deferred to its owner rewrite; Sunfall remains Fire while its alignment-specific bonus/rider is deferred to the skill-content owner. | [magical elemental](../../evidence/affinity-wiki-integration-2026-08-31/magical-elemental-main-efa9742.png) |
| `/wiki/creatures/monsters/dire-wolf` | Passed: the current Normal/Fire/Earth/Wind/Water target is separate from the Wood and Metal `legacy-candidate` studies; Earth is visibly pending and candidate evidence is neither approved nor runtime. | [Dire Wolf](../../evidence/affinity-wiki-integration-2026-08-31/dire-wolf-main-efa9742.png) |

These PNGs are review evidence only. They are not approved assets, runtime assets, source candidate
images, or inputs to any source hash.

| Screenshot | SHA-256 |
| --- | --- |
| `affinities-index-main-efa9742.png` | `ccd1e875602d911c7b1f7c414828f58b78e1b16a84bab2cda5a8230920dd919d` |
| `dire-wolf-main-efa9742.png` | `bcb729d1ca9c6b691e91ebee736c82d88100ebb9dd71c7bf0be5f595debb0d66` |
| `magical-elemental-main-efa9742.png` | `d152cc68643702cb768dc5d958d6782ebb2bd1e22f98f1bcea86ea39525e05bf` |
| `progression-affinities-main-efa9742.png` | `d5029b1dda695b18bb154b6f17b0e1db8ae32fe6ceec3442ca4e12c2913c7b2f` |

## Prior task commits

The final column contains sanitized scope notes rather than guaranteed verbatim commit subjects, so
this active evidence page can describe each batch without republishing retired terminology. Every
commit hash remains exact.

| Task | Commit | Sanitized scope note |
| --- | --- | --- |
| 1 | `e487d110aad11c09e007628ff8409d2d1816c012` | `test(wiki): lock four-affinity contract` |
| 1 | `40a90980a89dac51809ba2b0166615fc9fac4080` | `fix(wiki): validate canonical affinity details` |
| 2 | `72508231f442c2ba4e7d2e06f14c38cc7e1f40c6` | `docs(wiki): replace canonical affinity progression` |
| 3 | `6ef2f9e88be3c952ba2528649888fe9098c1cfcc` | `docs(wiki): publish four base affinity references` |
| 3 | `b219d33dfdadde4e23eeefb7f5bf1e5f6a97532d` | Material terminology correction |
| 4 | `a48379c51e840edf4ad4514c9c9b47640e2746ce` | `docs(wiki): align skills with four affinities` |
| 4 | `eadc439a1af7cd28a22cc25d5ce8ce5fc6dfdba4` | `fix(wiki): restrict deferred wind migration` |
| 5 | `59f78041d4c806a941e77dff778539ba5348435c` | `docs(wiki): add verified affinity diagrams` |
| 5 | `fef39d1778599e1ccc716458409bf8366891678a` | `fix(wiki): connect affinity cycle paths` |
| 6 | `eca80bde4d4cb9afe09c0e8551269974e7751830` | `fix(wiki): separate current and legacy affinity visuals` |
| 6 | `99199533d4ad4cc38b54ee3bd641b3335c7b10d3` | `fix(wiki): validate monster visual provenance` |

## Remaining owner handoffs

- Unexpanded individual Wind skill rewrite — the skill-content owner still needs to author and
  publish the individual Wind ladder.
- Sunfall alignment-specific bonus/rider — the published Fire skill keeps its core field identity,
  while the unresolved rider remains deferred to the skill-content owner; its immutable source row
  is retained only as non-rendered provenance.
- Pending Earth enemy art — current-target Earth remains explicit, but no image is fabricated from
  the preserved source studies.
- Cinematic candidate generation remains separate — any future cinematic exploration must stay
  outside these code-native reference diagrams and this review-evidence batch.

The final batch also resolves the logged matrix CSS-fill minor with a Sharp render regression and
bundles both accepted diagrams through the local wiki registry. Neither correction changes affinity
mechanics or promotes review evidence into runtime content.
