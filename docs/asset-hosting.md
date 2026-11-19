# Asset hosting

The website can load its images from a public Cloudflare R2 bucket instead of its own deployment and
GitHub. The switch is one build-time variable; without it, the site behaves exactly as before.

## How it works

- `apps/web/src/lib/asset-url.ts` reads `VITE_ASSET_BASE` (for example `https://assets.summonlab.ai`)
  at build time.
  - `assetUrl('/runtime/…')` returns `<base>/runtime/…`; unset, the local path (or the caller's
    base-prefixed path on the GitHub Pages wiki).
  - `repositoryArtUrl('assets/…')` returns `<base>/assets/…`; unset, GitHub's Git LFS media URL.
  - `repositoryArtLink('assets/…')` is the wiki's "original file" link: the bucket's copy, or the
    file's page on GitHub.
- Content records keep root-relative paths: contracts validate them as `/runtime/…`, and combat
  bindings hash them. Apply the helpers only where a file is fetched or shown (`src`, `srcset`, CSS
  backgrounds, Pixi manifests, `fetch`).
- The bucket mirrors two trees: `apps/web/static/{runtime,wiki-media,hero-archive}` at its root, and
  repository art at its repository path (`assets/…`).

## Turning it on

1. Connect the custom domain to the `summonlab-assets` bucket in Cloudflare and confirm its CORS policy
   allows `GET` and `HEAD` from any origin (the combat stage fetches and hashes its art).
2. Publish the files: `sync_r2.py publish static` and `sync_r2.py publish art`
   (`experiments/image-to-3d/rigging/scripts/`, on the image-to-3D experiment branch until it merges).
   Each run uploads only changed files and reads every object back to check its hash.
3. Set `VITE_ASSET_BASE` in the Vercel project (Production and Preview) and redeploy.

The GitHub Pages wiki build does not set the variable, so it keeps serving its own copies.

## Known gaps

- The hero archive's "original portrait" links point to files from earlier commits that are not in the
  current tree; they still open from GitHub.
- New or changed images must be published before a deploy that uses them, or they will be missing
  from the bucket. A deploy check for this is future work, along with the later phases in the storage
  plan (CI without Git LFS, then no new binaries in git).
