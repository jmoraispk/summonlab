"""Back up the LFS art and publish the website's images to Cloudflare R2, then prove every copy by its hash.

  python tools/r2/sync_r2.py backup lfs [--dry-run] [--workers 16]
  python tools/r2/sync_r2.py verify lfs
  python tools/r2/sync_r2.py publish static|art [--dry-run]

Run with the tools env (`~/.local/opt/image-to-3d/tools-venv/bin/python`, which has boto3). The plan
behind it is r2-migration.md in this folder. The image-to-3D sets (the 3D backup and the hosted rig
bench) moved to Systemlog with that experiment on 2026-11-21.

Backup set:
  lfs  every file Git LFS tracks at the current checkout (`git lfs ls-files`).

Publish sets (public bucket R2_BUCKET, the files the website loads when built with VITE_ASSET_BASE):
  static  apps/web/static/{runtime,wiki-media,hero-archive}, keyed by their URL path (`runtime/…`).
  art     every LFS file that a JSON catalog or manifest in the repository names (wiki originals),
          keyed by repository path (`assets/…`). Copied server-side from the masters bucket.
The public bucket mirrors the current tree: a changed file replaces its key, and nothing is deleted.

The backup set goes to the private masters bucket (R2_MASTERS_BUCKET). Keys mirror the repository path with the
first 12 hex digits of the file's SHA-256 before the extension, for example
`assets/heroes/.../summon.3f2a9c1b7d4e.png`. A changed file therefore gets a new key: nothing is ever
overwritten or deleted. Objects already in the bucket are skipped, and every object in the set is
downloaded again and hashed before it enters the manifest (`tools/r2/storage/masters-<set>.json`,
committed to git as the index).

Keys come from ~/.config/image-to-3d/keys.env (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
R2_MASTERS_BUCKET) and are never printed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import boto3
from boto3.s3.transfer import TransferConfig
from botocore.config import Config

KEYS = Path.home() / ".config" / "image-to-3d" / "keys.env"
HERE = Path(__file__).resolve().parent
REPO = Path(subprocess.check_output(["git", "rev-parse", "--show-toplevel"], cwd=HERE, text=True).strip())
STORAGE = HERE / "storage"
LFS_POINTER = b"version https://git-lfs.github.com/spec/v1"
TYPES = {".glb": "model/gltf-binary", ".webp": "image/webp", ".jsonl": "application/jsonl"}
CHUNK = 1 << 20


def env() -> dict:
    vals = {}
    for line in KEYS.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip().strip('"').strip("'")
    missing = [k for k in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_MASTERS_BUCKET") if not vals.get(k)]
    if missing:
        raise SystemExit(f"missing in {KEYS}: {', '.join(missing)}")
    return vals


def client(vals: dict, workers: int):
    return boto3.client(
        "s3", endpoint_url=f"https://{vals['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=vals["R2_ACCESS_KEY_ID"], aws_secret_access_key=vals["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=Config(max_pool_connections=workers + 4, connect_timeout=20, read_timeout=120,
                      retries={"max_attempts": 6, "mode": "adaptive"}))


def files_lfs() -> list[Path]:
    names = subprocess.check_output(["git", "lfs", "ls-files", "-n"], cwd=REPO, text=True).splitlines()
    return [REPO / n for n in names if n]


SETS = {"lfs": files_lfs}
STATIC = REPO / "apps" / "web" / "static"
STATIC_DIRS = ("runtime", "wiki-media", "hero-archive")
HASHED = __import__("re").compile(r"\.[0-9a-f]{12}\.[A-Za-z0-9]+$")


def files_static() -> list[Path]:
    return [p for d in STATIC_DIRS for p in (STATIC / d).rglob("*") if p.is_file()]


def files_art() -> list[Path]:
    """LFS files named by any JSON catalog or manifest in the repository (what wiki links open)."""
    lfs = set(subprocess.check_output(["git", "lfs", "ls-files", "-n"], cwd=REPO, text=True).splitlines())
    tracked = subprocess.check_output(["git", "ls-files", "*.json"], cwd=REPO, text=True).splitlines()
    named: set[str] = set()

    def walk(o):
        if isinstance(o, dict):
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
        elif isinstance(o, str) and o in lfs:
            named.add(o)

    for rel in tracked:
        if rel.startswith(("experiments/", "node_modules/")) or rel.endswith("pnpm-lock.json"):
            continue
        try:
            walk(json.loads((REPO / rel).read_text()))
        except (ValueError, UnicodeDecodeError, OSError):
            continue
    return [REPO / n for n in sorted(named)]


PUBLISH = {"static": files_static, "art": files_art}


def public_key(name: str, path: Path) -> str:
    return path.relative_to(STATIC).as_posix() if name == "static" else path.relative_to(REPO).as_posix()


def cache_control(key: str) -> str:
    return "public, max-age=31536000, immutable" if HASHED.search(key) else "public, max-age=3600"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while block := f.read(CHUNK):
            h.update(block)
    return h.hexdigest()


def key_for(rel: str, digest: str) -> str:
    p = Path(rel)
    suffix = "".join(p.suffixes[-1:])
    stem = rel[: len(rel) - len(suffix)] if suffix else rel
    return f"{stem}.{digest[:12]}{suffix}"


def human(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1000 or unit == "GB":
            return f"{n:.1f} {unit}" if unit != "B" else f"{int(n)} B"
        n /= 1000
    return f"{n:.1f} GB"


class Progress:
    def __init__(self, label: str, total_files: int, total_bytes: int):
        self.label, self.total_files, self.total_bytes = label, total_files, total_bytes
        self.files = self.bytes = 0
        self.start = time.time()
        self.lock = threading.Lock()
        self.last = 0.0

    def add(self, nbytes: int) -> None:
        with self.lock:
            self.files += 1
            self.bytes += nbytes
            now = time.time()
            if now - self.last > 15 or self.files == self.total_files:
                self.last = now
                rate = self.bytes / max(now - self.start, 1e-6)
                print(f"  {self.label}: {self.files}/{self.total_files} files, {human(self.bytes)}/"
                      f"{human(self.total_bytes)} ({human(rate)}/s)", flush=True)


def inventory(name: str, workers: int) -> list[dict]:
    paths = SETS[name]()
    entries, skipped = [], []

    def one(path: Path):
        with path.open("rb") as f:
            head = f.read(len(LFS_POINTER))
        if head == LFS_POINTER:
            return None, path
        return {"path": path.relative_to(REPO).as_posix(), "bytes": path.stat().st_size, "sha256": sha256(path)}, None

    with ThreadPoolExecutor(workers) as pool:
        for entry, pointer in pool.map(one, paths):
            (entries.append(entry) if entry else skipped.append(pointer))
    for e in entries:
        e["key"] = key_for(e["path"], e["sha256"])
    if skipped:
        print(f"  {len(skipped)} LFS pointer(s) not downloaded locally, skipped (run `git lfs pull` first):")
        for p in skipped[:10]:
            print(f"    {p.relative_to(REPO)}")
    return sorted(entries, key=lambda e: e["path"])


def existing(s3, bucket: str) -> dict[str, int]:
    out, token = {}, None
    while True:
        kw = {"Bucket": bucket, "MaxKeys": 1000}
        if token:
            kw["ContinuationToken"] = token
        page = s3.list_objects_v2(**kw)
        for o in page.get("Contents", []):
            out[o["Key"]] = o["Size"]
        if not page.get("IsTruncated"):
            return out
        token = page["NextContinuationToken"]


def upload(s3, bucket: str, entries: list[dict], workers: int) -> list[str]:
    cfg = TransferConfig(multipart_threshold=64 * 2**20, multipart_chunksize=16 * 2**20, max_concurrency=4)
    prog = Progress("upload", len(entries), sum(e["bytes"] for e in entries))
    errors = []

    def one(e: dict):
        ctype = TYPES.get(Path(e["path"]).suffix.lower()) or mimetypes.guess_type(e["path"])[0] or "application/octet-stream"
        s3.upload_file(str(REPO / e["path"]), bucket, e["key"], Config=cfg,
                       ExtraArgs={"ContentType": ctype, "Metadata": {"sha256": e["sha256"]}})
        prog.add(e["bytes"])

    with ThreadPoolExecutor(workers) as pool:
        futs = {pool.submit(one, e): e for e in entries}
        for f in as_completed(futs):
            if f.exception():
                errors.append(f"{futs[f]['path']}: {type(f.exception()).__name__}: {str(f.exception())[:160]}")
    return errors


def verify(s3, bucket: str, entries: list[dict], workers: int) -> list[str]:
    prog = Progress("verify", len(entries), sum(e["bytes"] for e in entries))
    errors = []

    def one(e: dict):
        body = s3.get_object(Bucket=bucket, Key=e["key"])["Body"]
        h, n = hashlib.sha256(), 0
        for block in body.iter_chunks(CHUNK):
            h.update(block)
            n += len(block)
        prog.add(n)
        if h.hexdigest() != e["sha256"] or n != e["bytes"]:
            return f"{e['path']}: hash or size mismatch in the bucket"
        return None

    with ThreadPoolExecutor(workers) as pool:
        futs = {pool.submit(one, e): e for e in entries}
        for f in as_completed(futs):
            if f.exception():
                errors.append(f"{futs[f]['path']}: {type(f.exception()).__name__}: {str(f.exception())[:160]}")
            elif f.result():
                errors.append(f.result())
    return errors


def write_manifest(name: str, bucket: str, entries: list[dict], failed: set[str], prefix: str = "masters",
                   rule: str = "repository path with the first 12 hex digits of its SHA-256 before the extension") -> Path:
    STORAGE.mkdir(exist_ok=True)
    out = STORAGE / f"{prefix}-{name}.json"
    doc = {
        "bucket": bucket,
        "keyRule": rule,
        "updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "files": {e["path"]: {"bytes": e["bytes"], "sha256": e["sha256"]} for e in entries if e["path"] not in failed},
    }
    out.write_text(json.dumps(doc, indent="\t") + "\n")
    return out


def publish(a, vals: dict) -> None:
    bucket = vals.get("R2_BUCKET")
    if not bucket:
        raise SystemExit(f"R2_BUCKET missing in {KEYS}")
    t0 = time.time()
    pairs = [(item, public_key(a.set, item)) for item in PUBLISH[a.set]()]

    def one(pair: tuple[Path, str]) -> dict:
        path, key = pair
        md5, sha = hashlib.md5(), hashlib.sha256()
        with path.open("rb") as f:
            while block := f.read(CHUNK):
                md5.update(block)
                sha.update(block)
        return {"path": path.relative_to(REPO).as_posix(), "key": key,
                "bytes": path.stat().st_size, "sha256": sha.hexdigest(), "md5": md5.hexdigest()}

    with ThreadPoolExecutor(a.workers) as pool:
        entries = sorted(pool.map(one, pairs), key=lambda e: e["key"])
    pointers = [e["path"] for e in entries if e["bytes"] < 200 and (REPO / e["path"]).read_bytes().startswith(LFS_POINTER)]
    if pointers:
        raise SystemExit(f"{len(pointers)} LFS pointer(s) not downloaded locally, e.g. {pointers[0]}; run `git lfs pull`")
    print(f"publish {a.set}: {len(entries)} files, {human(sum(e['bytes'] for e in entries))} "
          f"(hashed in {time.time() - t0:.0f}s)", flush=True)

    s3 = client(vals, a.workers)
    etags: dict[str, str] = {}
    token = None
    while True:
        kw = {"Bucket": bucket, "MaxKeys": 1000, **({"ContinuationToken": token} if token else {})}
        page = s3.list_objects_v2(**kw)
        for o in page.get("Contents", []):
            etags[o["Key"]] = o["ETag"].strip('"')
        if not page.get("IsTruncated"):
            break
        token = page["NextContinuationToken"]
    todo = [e for e in entries if etags.get(e["key"]) != e["md5"]]
    print(f"bucket {bucket}: {len(etags)} objects; {len(todo)} to publish "
          f"({human(sum(e['bytes'] for e in todo))}), {len(entries) - len(todo)} unchanged", flush=True)
    if a.dry_run:
        for e in todo[:5]:
            print(f"  would publish {e['key']} ({human(e['bytes'])}, {cache_control(e['key'])})")
        return

    masters = vals.get("R2_MASTERS_BUCKET")
    backed = {}
    if masters and (STORAGE / "masters-lfs.json").exists():
        backed = json.loads((STORAGE / "masters-lfs.json").read_text())["files"]
    cfg = TransferConfig(multipart_threshold=64 * 2**20, multipart_chunksize=16 * 2**20, max_concurrency=4)
    prog = Progress("publish", len(todo), sum(e["bytes"] for e in todo))
    errors = []

    def put(e: dict):
        ctype = TYPES.get(Path(e["key"]).suffix.lower()) or mimetypes.guess_type(e["key"])[0] or "application/octet-stream"
        extra = {"ContentType": ctype, "CacheControl": cache_control(e["key"]), "Metadata": {"sha256": e["sha256"]}}
        b = backed.get(e["path"])
        if b and b["sha256"] == e["sha256"]:
            s3.copy_object(Bucket=bucket, Key=e["key"], CopySource={"Bucket": masters, "Key": key_for(e["path"], e["sha256"])},
                           MetadataDirective="REPLACE", **extra)
        else:
            s3.upload_file(str(REPO / e["path"]), bucket, e["key"], Config=cfg, ExtraArgs=extra)
        prog.add(e["bytes"])

    with ThreadPoolExecutor(a.workers) as pool:
        futs = {pool.submit(put, e): e for e in todo}
        for f in as_completed(futs):
            if f.exception():
                errors.append(f"{futs[f]['path']}: {type(f.exception()).__name__}: {str(f.exception())[:160]}")
    failed = {err.split(":", 1)[0] for err in errors}
    errors += verify(s3, bucket, [e for e in entries if e["path"] not in failed], a.workers)
    failed = {err.split(":", 1)[0] for err in errors}
    out = write_manifest(a.set, bucket, [{**e, "path": e["key"]} for e in entries],
                         {next(x["key"] for x in entries if x["path"] == p) for p in failed}, prefix="public",
                         rule="static files at their URL path; repository art at its repository path")
    print(f"verified {len(entries) - len(failed)}/{len(entries)} files in {time.time() - t0:.0f}s; "
          f"manifest {out.relative_to(REPO)}", flush=True)
    if errors:
        print(f"{len(errors)} problem(s):")
        for err in errors[:20]:
            print(f"  {err}")
        sys.exit(1)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("action", choices=["backup", "verify", "publish"])
    ap.add_argument("set", choices=sorted(SETS) + sorted(PUBLISH))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--workers", type=int, default=16)
    a = ap.parse_args()

    vals = env()
    if a.action == "publish":
        if a.set not in PUBLISH:
            raise SystemExit(f"publish takes one of {sorted(PUBLISH)}")
        publish(a, vals)
        return
    if a.set not in SETS:
        raise SystemExit(f"{a.action} takes one of {sorted(SETS)}")
    bucket = vals["R2_MASTERS_BUCKET"]
    t0 = time.time()
    entries = inventory(a.set, a.workers)
    total = sum(e["bytes"] for e in entries)
    print(f"{a.set}: {len(entries)} files, {human(total)} (hashed in {time.time() - t0:.0f}s)", flush=True)

    s3 = client(vals, a.workers)
    have = existing(s3, bucket)
    todo = [e for e in entries if e["key"] not in have]
    clash = [e["path"] for e in entries if e["key"] in have and have[e["key"]] != e["bytes"]]
    print(f"bucket {bucket}: {len(have)} objects; {len(todo)} to upload ({human(sum(e['bytes'] for e in todo))}), "
          f"{len(entries) - len(todo)} already there", flush=True)
    if clash:
        raise SystemExit(f"{len(clash)} existing object(s) differ in size from the local file, e.g. {clash[0]}; stopping")
    if a.dry_run:
        for e in todo[:5]:
            print(f"  would upload {e['key']} ({human(e['bytes'])})")
        return

    errors = upload(s3, bucket, todo, a.workers) if a.action == "backup" and todo else []
    failed = {err.split(":", 1)[0] for err in errors}
    errors += verify(s3, bucket, [e for e in entries if e["path"] not in failed], a.workers)
    failed = {err.split(":", 1)[0] for err in errors}
    out = write_manifest(a.set, bucket, entries, failed)
    print(f"verified {len(entries) - len(failed)}/{len(entries)} files in {time.time() - t0:.0f}s; "
          f"manifest {out.relative_to(REPO)}", flush=True)
    if errors:
        print(f"{len(errors)} problem(s):")
        for err in errors[:20]:
            print(f"  {err}")
        sys.exit(1)


if __name__ == "__main__":
    main()
