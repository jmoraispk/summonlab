# Publishing the wiki

The public wiki is a static GitHub Pages site at
<https://jmoraispk.github.io/summonlab/wiki/>. It reuses the existing wiki routes,
components, source documents, and optimized galleries. It does not publish game routes,
server endpoints, or a database connection.

## Build and verify

```sh
pnpm install --frozen-lockfile
pnpm --dir apps/wiki install --frozen-lockfile
pnpm --dir apps/wiki build
pnpm --dir apps/wiki verify
pnpm --dir apps/wiki test:e2e
```

The wiki is an independent pnpm workspace with its own lockfile. This keeps static-site
dependencies outside the game’s approved art-production dependency seal. Root workspace commands
continue to cover the game; use the commands above for the wiki.

The build prepares ignored route and asset copies in `apps/wiki/src/routes` and
`apps/wiki/static`. Edit the originals in `apps/web`, not those generated copies.
The isolated static app uses the `/summonlab` project base and generates directory
indexes for direct links and browser reloads. The shared game app keeps its existing
server deployment.

The hero archive ships a searchable metadata index so all 736 identities, collection
filters, pagination, shared query URLs, and browser history work without a server.
Equipment, skills, monster galleries, and the flat navigation remain interactive.
Full-resolution monster artwork loads from GitHub's Git LFS media endpoint when a
viewer opens. Its arrows follow the displayed gallery: all normal forms in the
bestiary, the selected affinity's five forms in a family, or a form's five affinities.
Arrow keys navigate images except when the focused enlarged image needs them for
panning. Clicking the backdrop or empty image margins closes the viewer; image/control clicks and
dragging remain interactive. Closing the viewer returns focus to its original thumbnail.

Verification rejects missing local page/image links, URLs outside the project base,
symbolic links, game endpoint directories, and artifacts at or above GitHub Pages'
1 GB limit. Browser checks exercise desktop/phone galleries, image navigation,
filtered hero URLs, history/reloads, and legacy redirects.

## Publication

The `Publish wiki` workflow builds, verifies, and deploys `apps/wiki/build` to GitHub
Pages using its Actions deployment source. It fetches only the Git LFS masters that
the wiki imports; optimized gallery previews are already tracked normally.

The proposal branch `codex/public-archive-readme` can publish the initial archive
without merging the README work into `main`. The workflow also publishes from
`main` after integration. Both triggers use one deployment concurrency group.
The game remains paused; the wiki is the public browsing destination linked in
the README.

The wiki’s standalone lockfile avoids changing `pnpm-lock.yaml`, which is hash-bound by the game’s
approved art-production launcher. Adding or updating wiki-only dependencies must use
`pnpm --dir apps/wiki add --save-dev <package>`. Do not update the game’s approval receipts for a
static-site dependency change. The Pages workflow installs both projects with frozen lockfiles
because the wiki reuses source modules from the game workspace.
