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

- **Reclaimed 2026-11-18 (owner-approved):** the dropped local models (TRELLIS and Hunyuan3D-2) are
  deleted: their environments in `~/.local/opt/image-to-3d/`, their weights in
  `~/.cache/huggingface/hub/`, and their packages in uv's shared cache (`uv cache clean` for packages
  the tools env does not use, then `uv cache prune`). 45 GB freed; home went from 210 GB to 165 GB used.
  `tools-venv` (0.8 GB, the Tripo client and image tools) is kept and still works.
- **The 2D art is on GitHub:** `assets/` is 4.7 GB on disk in Git LFS (2,262 files), and
  `apps/web/static` holds 177 MB of runtime images. The website deploys to Vercel.

## Recommendation: Cloudflare R2

R2 is S3-compatible object storage with **no egress fees**. The website (or any game client) can fetch
GLBs and images directly through Cloudflare's CDN without bandwidth bills. The free tier covers 10 GB a
month, more than everything generated so far. Vercel Blob or S3 + CloudFront work too, but both bill
egress, and 3D assets are download-heavy. Check current prices before committing.

### Two buckets: public runtime, private masters

| Bucket | Access | Contents | Size now | Full catalog (est.) |
| --- | --- | --- | --- | --- |
| `summonlab-assets` | public (custom domain, CORS) | `runtime/`: optimized GLBs (rigged character 0.54 MB avg, prop 0.15 MB), each character's clips as animation-only files (mesh stripped, ~75 KB per clip), thumbnails; `catalog/<batch>.json` | ~90 MB | ~0.75 GB |
| `summonlab-masters` | private (no public URL) | `raw/tripo/<step>/`: every Tripo output (models 404 MB, rigs 189 MB, clip files 301 MB, neutral images 34 MB); `raw/sources/`: prepared inputs (167 MB); task metadata and ledger | ~1.1 GB | ~7 GB |

- **Masters are what the credits bought:** keep them, never overwrite, and store them privately. Ownership
  terms are unconfirmed, and the raw files are large and unoptimized. Re-optimizing or re-cutting from
  masters costs nothing; regenerating costs credits.
- **Runtime is what players download:** content-hashed, immutable names cache forever. Today each Tripo
  clip file repeats the whole mesh; the runtime stores each character's clips without it (about 0.8 MB
  for an 11-clip set, measured 2026-11-18). Clips stay per character: playing one clip on many bodies is
  a shortcut (combat clips do it today), and clips per skeleton are the target (owner, 2026-11-18;
  deferred).
- **Neither bucket:** Experiment 1 local outputs (dropped route), logs, the derived bench manifest,
  caches. Bench previews, QA results and the catalog JSON stay in git (small evidence and the index).
- Estimates assume the whole catalog: 200 heroes, about 190 monster species and 140 equipment items, at
  ~17 MB of masters per animated creature and ~4 MB per prop; per-character clips add about 0.25 GB of
  runtime. Both fit around R2's free 10 GB.

### What the owner sets up (I must not create accounts)

1. Create a Cloudflare account, if needed, and two R2 buckets: `summonlab-assets` (public runtime) and
   `summonlab-masters` (private; skip steps 2 and 4 for it).
2. Make it public:
   - for production, connect a custom domain such as `assets.<your-domain>` (CDN-cached);
   - for a quick test, enable the bucket's `r2.dev` URL (rate-limited, not for production).
3. Create an R2 API token with **Object Read & Write** scoped to both buckets. Note the Access Key ID,
   the Secret Access Key and the account ID; the endpoint is `https://<account_id>.r2.cloudflarestorage.com`.
4. Add a CORS rule on the bucket allowing `GET` and `HEAD` from the site's origins: production, Vercel
   previews, `localhost`, and the LAN preview.
5. Put the values in `~/.config/image-to-3d/keys.env` (never in the repo): `R2_ACCOUNT_ID`,
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (public), `R2_MASTERS_BUCKET` (private),
   `R2_PUBLIC_BASE`.

### What I build once the keys exist

- `rigging/scripts/sync_r2.py`: uploads with content hashes, skips what is already there, never deletes.
- Layout:
  - masters bucket: `raw/tripo/<step>/…` (every Tripo output, immutable) and `raw/sources/<id>.png`.
  - public bucket: `runtime/<kind>/<id>/<sha12>.glb` (optimized, hashed names, cacheable forever) and
    `catalog/<batch>.json` (id → runtime URL, triangles, bytes, clips, QA result).
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
