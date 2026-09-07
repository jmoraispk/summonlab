# Hero legacy retirement implementation plan

1. Add repository-policy tests that reject each retired hero group and require retained hero PNGs to be LFS-managed.
2. Delete Forge v1/v2, owner-playtest, early root experiments, and these superseded motion sheets:
   - `asha/asha-motion-sheet-source-v1.png`
   - `iron-guardian/iron-guardian-motion-sheet-source-v1.png`
   - `iron-guardian/iron-guardian-motion-sheet-source-v2.png`
   - `moss-archer/moss-archer-motion-sheet-source-v1.png`
3. Retire the hero Forge/Visual Lab web surfaces, their derived runtime bundle, obsolete review APIs, validators, tests, and Pack 2 experiment documents. Preserve enemy Forge pages.
4. Repoint Village and wiki consumers at approved route-local cutouts and remove stale navigation to retired hero review pages.
5. Add the retained hero visual LFS rule, renormalize retained PNGs, and normalize the merged skill reference already covered by LFS.
6. Reconcile the merged skill validation gate, regenerate any affected evidence, run repository, web, rarity, realtime-combat, Village, LFS, formatting, and full test validation.
7. Commit and force-with-lease push the rebased branch.
