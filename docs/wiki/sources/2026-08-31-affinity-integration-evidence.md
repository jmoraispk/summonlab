# Affinity wiki integration evidence

Wiki ID: `sources.affinity-integration-evidence-2026-08-31`

This page records the final review gate for the four-base, six-dual affinity wiki integration. The
integration batch is dated 2026-08-31; the complete acceptance rerun and local preview were
performed on 2026-09-01 in the required repository worktree.

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
| `pnpm validate:skill-taxonomy` | Exit `0`; 520 mapped legacy rows and 459 target rows reconciled: 254 Martial, 124 Magical, 81 Craft. |
| `pnpm --filter @summonlab/web test` | Exit `0`; 18 test files and 81 tests passed. |
| `pnpm --filter @summonlab/web typecheck` | Exit `0`; 0 errors and 0 warnings. |

Supplemental final-batch checks passed:

| Command | Recorded result |
| --- | --- |
| `pnpm vitest run tools/affinity-wiki-diagrams.spec.ts` | Exit `0`; the rendered matrix preserves distinct Earth, Water, and empty-cell fills. |
| `pnpm --filter @summonlab/web exec vitest run src/lib/server/wiki.spec.ts` | Exit `0`; 10 registry tests passed, including local bundling of both accepted affinity diagrams. |
| Project-scoped `pnpm exec prettier --check` on final-batch paths | Exit `0`; every matched source and configuration file uses project formatting. |
| `git diff --check` and `git diff --cached --check` | Exit `0`; no whitespace errors in the final batch. |

## Local preview evidence

`pnpm dev:app` started the local application at `http://127.0.0.1:5173`. A local Chromium session
visited each exact route, required HTTP `200`, evaluated the relevant rendered content, loaded and
decoded each route image, and captured a 1440 × 1000-viewport full-page screenshot. The server was
stopped after capture.

| Route | Review result | Screenshot |
| --- | --- | --- |
| `/wiki/mechanics/progression/affinities` | Passed: the only cycle reads Earth → Water → Fire → Wind → Earth; both SVGs decode locally; the matrix visibly contains four bases plus six duals with distinct cell fills. | [progression affinities](../../evidence/affinity-wiki-integration-2026-08-31/progression-affinities-82a164b.png) |
| `/wiki/mechanics/affinities` | Passed: the navigation page states four bases, six rare duals, and ten total, and lists the exact roster. | [affinity index](../../evidence/affinity-wiki-integration-2026-08-31/affinities-index-82a164b.png) |
| `/wiki/mechanics/skills/magical-elemental` | Passed: Fire, Water, and Earth ladders remain published, Wind is explicitly active and deferred to its owner rewrite, and retired element labels are not published as current affinities. | [magical elemental](../../evidence/affinity-wiki-integration-2026-08-31/magical-elemental-82a164b.png) |
| `/wiki/creatures/monsters/dire-wolf` | Passed: the current Normal/Fire/Earth/Wind/Water target is separate from the Wood and Metal `legacy-candidate` studies; Earth is visibly pending and candidate evidence is neither approved nor runtime. | [Dire Wolf](../../evidence/affinity-wiki-integration-2026-08-31/dire-wolf-82a164b.png) |

These PNGs are review evidence only. They are not approved assets, runtime assets, source candidate
images, or inputs to any source hash.

| Screenshot | SHA-256 |
| --- | --- |
| `affinities-index-82a164b.png` | `0822ce30329c54ef54563042818371de3af3ad692f9656f9751160fbcce3dfe7` |
| `dire-wolf-82a164b.png` | `bf8b23a6841880e4addb71dff370748a9ebd11ec44a829d19932dca6b94e539d` |
| `magical-elemental-82a164b.png` | `c3ef1ef1e925e02c7088413cfe14917b8d4c8272a7945a2194c3ec829fb9a8fa` |
| `progression-affinities-82a164b.png` | `e841df9ade6529b72144ebc1fa17e0a34b3bbee956b2e20695b02dac0f9870d1` |

## Prior task commits

| Task | Commit | Subject |
| --- | --- | --- |
| 1 | `f9e6eca00a78930b4a86b80b23e3af07866f794e` | `test(wiki): lock four-affinity contract` |
| 1 | `6d748ba6d81b90311da6bbcd0ba8a77cdbbe0dbd` | `fix(wiki): validate canonical affinity details` |
| 2 | `f3e0db16c5af137a4b7933ea8e917cbfd5015346` | `docs(wiki): replace canonical affinity progression` |
| 3 | `4ccafdb9d13a2c80e625101ed6f0dbf19216156b` | `docs(wiki): publish four base affinity references` |
| 3 | `2d91666f9ab7a40cc2afb5ba2483cfbf4081b046` | Material terminology correction |
| 4 | `8d871398db5f8a840ca3990e72f2cdc207a411d5` | `docs(wiki): align skills with four affinities` |
| 4 | `9b6b52d9d245fd35fa7a81c87f1a1ed0b28d7f96` | `fix(wiki): restrict deferred wind migration` |
| 5 | `f31c08fbd69f066f1cd85f0141ce4ec80607fe72` | `docs(wiki): add verified affinity diagrams` |
| 5 | `badf6269e33b2a8cbc1d19bc3d2524d31c34e568` | `fix(wiki): connect affinity cycle paths` |
| 6 | `cc051b430fd4511fca39f55b3ad02766a355c139` | `fix(wiki): separate current and legacy affinity visuals` |
| 6 | `82a164beed8f6af1e766cfba4674d46ecf937366` | `fix(wiki): validate monster visual provenance` |

## Remaining owner handoffs

- Unexpanded individual Wind skill rewrite — the skill-content owner still needs to author and
  publish the individual Wind ladder.
- Pending Earth enemy art — current-target Earth remains explicit, but no image is fabricated from
  the preserved source studies.
- Cinematic candidate generation remains separate — any future cinematic exploration must stay
  outside these code-native reference diagrams and this review-evidence batch.

The final batch also resolves the logged matrix CSS-fill minor with a Sharp render regression and
bundles both accepted diagrams through the local wiki registry. Neither correction changes affinity
mechanics or promotes review evidence into runtime content.
