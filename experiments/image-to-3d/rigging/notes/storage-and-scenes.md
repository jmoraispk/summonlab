# Storage and scenes: recommendations (2026-11-18)

## Where the assets live today

- **Generated 3D is not on GitHub.** Every Tripo output, T-pose image and optimized GLB sits in this
  machine's `experiments/image-to-3d/work/` (gitignored), and that is the only copy. Tripo's download
  links expire. Git holds only scripts, batch plans, QA results and small previews (about 8 MB).
- **Footprint:** 1.3 GB of generated files:

  | What | Size |
  | --- | --- |
  | Tripo raw outputs (212 GLBs, 190 images) | 930 MB |
  | Prepared source images | 167 MB |
  | Optimized game-ready GLBs | 86 MB (about 0.8 MB per asset) |
  | Experiment 1 local outputs | 135 MB |

- **Reclaimable:** the dropped local models (TRELLIS and Hunyuan3D-2) still use about 48 GB: 18 GB of
  environments in `~/.local/opt/image-to-3d/` and 30 GB of weights in `~/.cache/huggingface/hub/`.
  `tools-venv` (0.8 GB) is still needed.
- **The 2D art is on GitHub:** `assets/` is 4.7 GB on disk in Git LFS (2,262 files), and
  `apps/web/static` holds 177 MB of runtime images. The website deploys to Vercel.

## Recommendation: Cloudflare R2

R2 is S3-compatible object storage with **no egress fees**. The website (or any game client) can fetch
GLBs and images directly through Cloudflare's CDN without bandwidth bills. The free tier covers 10 GB a
month, more than everything generated so far. Vercel Blob or S3 + CloudFront work too, but both bill
egress, and 3D assets are download-heavy. Check current prices before committing.

### What the owner sets up (I must not create accounts)

1. Create a Cloudflare account, if needed, and an R2 bucket, for example `summonlab-assets`.
2. Make it public:
   - for production, connect a custom domain such as `assets.<your-domain>` (CDN-cached);
   - for a quick test, enable the bucket's `r2.dev` URL (rate-limited, not for production).
3. Create an R2 API token with **Object Read & Write** scoped to that bucket. Note the Access Key ID,
   the Secret Access Key and the account ID; the endpoint is `https://<account_id>.r2.cloudflarestorage.com`.
4. Add a CORS rule on the bucket allowing `GET` and `HEAD` from the site's origins: production, Vercel
   previews, `localhost`, and the LAN preview.
5. Put the values in `~/.config/image-to-3d/keys.env` (never in the repo): `R2_ACCOUNT_ID`,
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE`.

### What I build once the keys exist

- `rigging/scripts/sync_r2.py`: uploads with content hashes, skips what is already there, never deletes.
- Bucket layout:
  - `raw/tripo/<step>/…`: every Tripo output, kept immutable (neutral images, models, rigs, clips).
  - `raw/sources/<id>.png`: prepared inputs.
  - `runtime/<kind>/<id>/<sha12>.glb`: optimized, game-ready files with hashed names, cacheable forever.
  - `catalog/<batch>.json`: id → runtime URL, triangles, bytes, clips, QA result.
- The catalog JSON is also committed, so the website and game read one small file and fetch GLBs from R2.
- Later, optional: move `apps/web/static/runtime` images and the LFS art to the same bucket.

## Scenes: suggested path

1. **Size scenes to the camera.** The realtime combat study uses a steep three-quarter top-down camera,
   so arena-sized scenes (30–60 m) are the target, not open worlds.
2. **Kit, not whole scenes.** Pick one reference (Hearth-01's environment art) and list a kit of 15–25
   pieces: ground tiles, wall and fence segments, a hut, a gate, a well, trees, rocks, barrels, crates.
   Generate each as an individual piece with the equipment route (isolated image → model, 2–5k faces,
   about 45 credits each). Add seamless PBR ground textures and a generated panorama for the sky.
   Whole-scene generators (Gaussian-splat worlds) look good but give no clean colliders and are heavy;
   use them only for distant backdrops, if at all.
3. **Layout as data.** A scene JSON lists piece id, transform and collider type. Block it out from the
   reference art, then adjust it in a small grid editor in the bench.
4. **Gameplay gates.** Colliders are built per piece (box, convex hull or trimesh by size). A character
   capsule walks scripted paths to prove walkability. Budgets for triangles, draw calls, texture
   memory and frame time; day and night lighting.
5. **First experiment:** the Hearth-01 square, about 20 pieces, about 1,000 credits, with Asha walking
   it under the same QA bench.
6. **Where it lives:** if the scenes are for Threefold, that work belongs in the Threefold repo (owner
   instruction, 2026-11-15); both can read the same R2 bucket.
