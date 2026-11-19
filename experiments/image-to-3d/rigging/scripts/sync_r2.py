"""Back up generated and LFS-tracked files to Cloudflare R2, then prove every copy by its hash.

  python rigging/scripts/sync_r2.py backup 3d [--dry-run] [--workers 16]
  python rigging/scripts/sync_r2.py backup lfs [--dry-run]
  python rigging/scripts/sync_r2.py verify 3d|lfs

Run with the tools env (`~/.local/opt/image-to-3d/tools-venv/bin/python`, which has boto3).

Sets:
  3d   Tripo outputs, prepared sources and the task ledger (experiments/image-to-3d/work/{hosted,sample,
       sources}, rigging/ledger.jsonl): this machine holds the only copy.
  lfs  every file Git LFS tracks at the current checkout (`git lfs ls-files`).

Both go to the private masters bucket (R2_MASTERS_BUCKET). Keys mirror the repository path with the
first 12 hex digits of the file's SHA-256 before the extension, for example
`assets/heroes/.../summon.3f2a9c1b7d4e.png`. A changed file therefore gets a new key: nothing is ever
overwritten or deleted. Objects already in the bucket are skipped, and every object in the set is
downloaded again and hashed before it enters the manifest (`rigging/storage/masters-<set>.json`,
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
RIG = Path(__file__).resolve().parents[1]
EXP = RIG.parent
REPO = Path(subprocess.check_output(["git", "rev-parse", "--show-toplevel"], cwd=RIG, text=True).strip())
STORAGE = RIG / "storage"
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


def files_3d() -> list[Path]:
    out = []
    for sub in ("hosted", "sample", "sources"):
        out += [p for p in (EXP / "work" / sub).rglob("*") if p.is_file()]
    ledger = RIG / "ledger.jsonl"
    if ledger.exists():
        out.append(ledger)
    return out


def files_lfs() -> list[Path]:
    names = subprocess.check_output(["git", "lfs", "ls-files", "-n"], cwd=REPO, text=True).splitlines()
    return [REPO / n for n in names if n]


SETS = {"3d": files_3d, "lfs": files_lfs}


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


def write_manifest(name: str, bucket: str, entries: list[dict], failed: set[str]) -> Path:
    STORAGE.mkdir(exist_ok=True)
    out = STORAGE / f"masters-{name}.json"
    doc = {
        "bucket": bucket,
        "keyRule": "repository path with the first 12 hex digits of its SHA-256 before the extension",
        "updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "files": {e["path"]: {"bytes": e["bytes"], "sha256": e["sha256"]} for e in entries if e["path"] not in failed},
    }
    out.write_text(json.dumps(doc, indent="\t") + "\n")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("action", choices=["backup", "verify"])
    ap.add_argument("set", choices=sorted(SETS))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--workers", type=int, default=16)
    a = ap.parse_args()

    vals = env()
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
