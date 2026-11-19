# Moving binary assets from GitHub to Cloudflare R2 (proposal, 2026-11-18)

Owner question: can most, or all, of what GitHub serves move to the R2 storage? Answer: nearly all of the
binary art can. Code, docs, manifests and small review evidence stay in git. This note is the full plan.
It sits with the image-to-3D notes until the owner accepts it; the repo-wide steps (web app, CI, wiki)
are their own change on `main`.

## What GitHub stores and serves today (measured 2026-11-18)

| What                                         | Where                                               | Size    | Who downloads it from GitHub                                                                                                                                                                                        |
| -------------------------------------------- | --------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git LFS art (2,262 PNGs at the tip)          | `assets/**`, two `docs`/`apps` folders              | 4.82 GB | CI on every run (`ci.yml` checks out with `lfs: true`); the wiki workflow (a subset); the site's full-size monster viewer (`MonsterArtwork.svelte` loads `media.githubusercontent.com`); every clone that pulls LFS |
| Site runtime images (3,105 files)            | `apps/web/static/{runtime,wiki-media,hero-archive}` | 177 MB  | Every clone and Vercel build; players get them from Vercel                                                                                                                                                          |
| Generated 3D (Tripo masters, optimized GLBs) | this machine only (`work/`, gitignored)             | 1.3 GB  | nobody (no backup yet)                                                                                                                                                                                              |
| Git history (regular objects)                | the repository pack                                 | 642 MB  | every clone                                                                                                                                                                                                         |

LFS by folder: enemy experiment candidates 2.46 GB, hero roster sources 1.01 GB, approved enemies 0.56 GB,
skill icons 0.40 GB, approved equipment 0.23 GB, hero visuals 0.13 GB, other 0.04 GB.

**GitHub limits (Free plan, per GitHub's billing docs):** 10 GiB of LFS storage and 10 GiB of LFS download
bandwidth a month, then $0.07/GiB-month and $0.0875/GiB. LFS downloads count against the owner's
bandwidth even in a public repository. One CI run downloads all 4.8 GB, so about two CI runs fit in the
monthly allowance. The real numbers are on GitHub: Settings → Billing and licensing → Usage, filtered to
Git LFS.

## Target split

| Location                      | Holds                                                                                                                                                          | Size now |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Git                           | code, docs, JSON manifests (path → SHA-256, bytes, bucket key), batch plans, QA results, small preview and evidence images, `apps/web/static/ui`, `robots.txt` | small    |
| `summonlab-assets` (public)   | what the site, wiki and game load: runtime images, the full-size art the wiki viewer opens, optimized GLBs and clips, catalogs                                 | ~1 GB    |
| `summonlab-masters` (private) | every master worth keeping: all LFS art (hero and enemy masters, experiment candidates), Tripo raw outputs, prepared sources                                   | ~6 GB    |

- Everything fits R2's free 10 GB-month today (about 7 GB). The full 3D catalog adds about 6.5 GB, so
  about 14 GB in all: roughly $0.06 a month over the allowance at $0.015/GB-month. Reads are free of
  egress fees; the free allowance covers 1 million writes and 10 million reads a month, and Cloudflare's
  cache in front of the public bucket absorbs most reads.
- Keys are content-addressed (`<kind>/<id>.<sha12>.<ext>`, as `hero-archive` already does), so files are
  immutable and cache for a year. Uploads never overwrite or delete.

## Owner setup (I must not create accounts)

1. **Account.** Sign in to Cloudflare (Free plan) and open R2 Object Storage. Cloudflare asks for a
   payment method to turn on R2, even within the free allowance.
2. **Domain for the public bucket.** Production needs a custom domain, such as `assets.<your-domain>`,
   whose DNS is on Cloudflare in the same account. Without a domain, the bucket's `r2.dev` URL works for
   testing only: it is rate-limited and uncached. The project domain's DNS is on GoDaddy (checked
   2026-11-18), so it moves first; see "Moving the domain's DNS to Cloudflare" below.
3. **Buckets.** Create `summonlab-assets` and `summonlab-masters`: location Automatic, storage class
   Standard (the free allowance covers Standard only).
4. **Public access, `summonlab-assets` only.** Settings → Custom Domains → connect `assets.<your-domain>`.
   For a quick test, also enable the Public Development URL. Leave `summonlab-masters` with no public
   access.
5. **CORS, `summonlab-assets` only.** Settings → CORS policy:

   ```json
   [
   	{
   		"AllowedOrigins": ["*"],
   		"AllowedMethods": ["GET", "HEAD"],
   		"AllowedHeaders": ["*"],
   		"MaxAgeSeconds": 86400
   	}
   ]
   ```

   Everything in this bucket is public and read-only, so any origin may read it. That covers production,
   every Vercel preview, the GitHub Pages wiki, `localhost` and the LAN preview without upkeep.

6. **Caching.** On the domain: Caching → Cache Rules → new rule, hostname equals `assets.<your-domain>`,
   "Eligible for cache", Edge TTL "use cache-control header if present". Uploads carry
   `Cache-Control: public, max-age=31536000, immutable`. Without the rule, Cloudflare skips `.glb` and
   `.json` by default.
7. **API token.** R2 → Manage API tokens → Create API token: name `summonlab-local`, permission
   **Object Read & Write**, applied to **both buckets only**, no expiry. Copy the Access Key ID and Secret
   Access Key (shown once) and the account ID (the endpoint is
   `https://<account_id>.r2.cloudflarestorage.com`).
8. **Keys on this machine.** Add to `~/.config/image-to-3d/keys.env` (mode 600, never in the repo or chat):

   ```text
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=summonlab-assets
   R2_MASTERS_BUCKET=summonlab-masters
   R2_PUBLIC_BASE=https://assets.<your-domain>
   ```

   `R2_PUBLIC_BASE` may be the `r2.dev` URL until the domain is connected.

9. **Later, at phase 2:** add `PUBLIC_ASSET_BASE` (the same public URL; not a secret) to the Vercel project
   (Production and Preview) and as a GitHub Actions variable for the wiki workflow. CI needs no R2
   secrets in this plan.

## Moving the domain's DNS to Cloudflare

Checked 2026-11-18: GoDaddy is both registrar and DNS host (`ns77`/`ns78.domaincontrol.com`), DNSSEC is
off, and there is no email (no MX). Only the nameservers move; the registration stays at GoDaddy. Because
Cloudflare serves the same records, the site keeps working throughout.

| Record | Name             | Value                          | On Cloudflare                        |
| ------ | ---------------- | ------------------------------ | ------------------------------------ |
| A      | `@`              | `216.198.79.1` (Vercel)        | keep, **DNS only** (gray cloud)      |
| CNAME  | `www`            | the apex                       | keep, **DNS only**                   |
| CNAME  | `pay`            | GoDaddy payment links          | keep, **DNS only**; delete if unused |
| TXT    | `_dmarc`         | GoDaddy's default DMARC policy | keep                                 |
| CNAME  | `_domainconnect` | GoDaddy's Domain Connect       | delete (GoDaddy-only)                |

1. **Cloudflare:** Account home → Add a domain → enter the domain → quick scan for DNS records → Free plan.
2. **Review the imported records** against the table. Cloudflare proxies imported A and CNAME records
   by default (orange cloud); switch them to DNS only, since Vercel and GoDaddy serve their own
   certificates. Delete `_domainconnect`. GoDaddy's NS and SOA records are not copied: Cloudflare supplies
   its own. The owner's review (2026-11-18) found the scan complete; my earlier lookup had missed `pay`.
3. **Copy the two nameservers** Cloudflare assigns (`<name>.ns.cloudflare.com`; unique per account).
4. **GoDaddy:** Domain Portfolio → the domain → DNS → Nameservers → Change nameservers → "I'll use my own
   nameservers" → enter both Cloudflare nameservers → Save and confirm. If GoDaddy refuses because of the
   domain lock, turn Domain Lock off, change the nameservers, then turn it back on.
5. **Wait for "Active".** Cloudflare emails when it sees the change, usually within an hour and at most
   a day or two; "Check nameservers now" speeds it up. Nothing changes on Vercel.
6. **Then** connect `assets.<your-domain>` to `summonlab-assets` (step 4 of the setup); Cloudflare creates
   that record and its certificate itself.
7. **Optional, later:** turn on DNSSEC in Cloudflare and add the DS record it shows at GoDaddy.

## Phases (each one reversible until the last)

1. **Back up (copy only). Done 2026-11-18:** `sync_r2.py` uploaded 829 3D files (1.18 GB) and 2,262 LFS
   files (4.82 GB) to `summonlab-masters` and read every one back to check its hash; manifests in
   `rigging/storage/`. GitHub is unchanged. Re-run `sync_r2.py backup 3d` after each batch.
2. **Serve from R2. Uploaded, merged (jmoraispk/summonlab#1, 2026-11-19) and the domain is live with
   any-origin CORS; images cache at Cloudflare (MISS then HIT). Left: set `VITE_ASSET_BASE` in Vercel and
   redeploy.**
   `sync_r2.py publish static` mirrored `apps/web/static/{runtime,wiki-media,hero-archive}` (3,086 files,
   174 MB) and `publish art` the 2,244 LFS files that repository catalogs name (4.8 GB, copied
   server-side from the masters bucket) to `summonlab-assets`, all read back and verified. Branch
   `claude/r2-asset-urls` adds `apps/web/src/lib/asset-url.ts`: built with `VITE_ASSET_BASE`, every
   image the site shows or loads (about 25 places) and the monster viewer's full-size art come from the
   bucket; unset, nothing changes. Contracts validate content paths as `/runtime/…`, so records keep
   their paths and the base is added only where a file is fetched or shown. A local stand-in for the
   bucket loaded every image on the home page and the hero, monster, skill and equipment wiki pages
   (586 requests, none to the site or GitHub, no failures). Still on GitHub: the hero archive's 736
   "original" links (files from earlier commits, not in the current tree). To switch on: connect
   `assets.<domain>`, confirm CORS, set `VITE_ASSET_BASE` in Vercel, redeploy.
3. **Stop GitHub downloads.** CI checks out without LFS; the asset validators verify manifests (presence,
   hash, size), and the few checks that need pixels fetch from R2 with an Actions cache. The wiki workflow
   fetches from R2 instead of `git lfs pull`.
4. **Stop GitHub growth.** New art goes to R2 plus a manifest entry; a validator rejects new large binaries
   in git; the tip drops the LFS files and the runtime images, and `pnpm assets:pull` fetches them for work
   that needs them locally.
5. **Optional: purge history.** Files already pushed to LFS keep counting toward GitHub's LFS storage.
   GitHub's documented way to remove them is rewriting history and deleting and recreating the repository,
   which loses issues and pull requests. Only worth it if storage goes over quota.

## Trade-offs

- A checkout is no longer self-contained: offline work on art needs `pnpm assets:pull` first, and masters
  need the read key.
- Pull requests no longer show changed art inline; art changes carry small preview sheets in git, as the
  image-to-3D batches already do.
- One more service to keep alive: the manifests in git are the index, so the buckets can be rebuilt from a
  local copy if the account changes.
