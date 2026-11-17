"""Minimal Tripo API v3 client with a credit ledger and a hard budget guard.

Keys are read from ~/.config/image-to-3d/keys.env (TRIPO_API_KEY=...) and never printed.
Every task is appended to rigging/ledger.jsonl (no secrets) and its outputs are downloaded to
work/hosted/tripo/<step>/. Steps that already succeeded in the ledger are reused, not re-run.
"""
from __future__ import annotations

import json
import mimetypes
import os
import threading
import time
from pathlib import Path

import requests

EXP = Path(__file__).resolve().parents[2]
LEDGER = EXP / "rigging" / "ledger.jsonl"
OUT = EXP / "work" / "hosted" / "tripo"
BASE = "https://openapi.tripo3d.ai/v3"
KEYS = Path.home() / ".config" / "image-to-3d" / "keys.env"
PENDING = {"queued", "running"}  # any other status is terminal
_LEDGER_LOCK = threading.Lock()
# The API rejects extra concurrent tasks with HTTP 429; keep at most this many in flight per process.
_SLOTS = threading.BoundedSemaphore(int(os.environ.get("TRIPO_CONCURRENCY", "4")))


def _key(name: str = "TRIPO_API_KEY") -> str:
    if os.environ.get(name):
        return os.environ[name]
    if KEYS.exists():
        for line in KEYS.read_text().splitlines():
            if line.strip().startswith(name + "="):
                return line.split("=", 1)[1].strip()
    raise SystemExit(f"{name} not found in the environment or {KEYS}")


def _headers() -> dict:
    return {"Authorization": f"Bearer {_key()}"}


def _check(r: requests.Response) -> dict:
    try:
        body = r.json()
    except ValueError:
        r.raise_for_status()
        raise
    if r.status_code >= 400 or body.get("code", 0) != 0:
        raise RuntimeError(f"Tripo error {r.status_code}: {json.dumps(body)[:600]}")
    return body["data"]


def balance() -> dict:
    return _check(requests.get(f"{BASE}/account/balance", headers=_headers(), timeout=30))


def upload(path: Path) -> str:
    with open(path, "rb") as f:
        data = _check(requests.post(f"{BASE}/files", headers=_headers(),
                                    files={"file": (path.name, f, mimetypes.guess_type(path.name)[0] or "application/octet-stream")}, timeout=120))
    return data["file_token"]


def ledger() -> list[dict]:
    if not LEDGER.exists():
        return []
    return [json.loads(line) for line in LEDGER.read_text().splitlines() if line.strip()]


def spent() -> float:
    return sum(float(e.get("credits_consumed") or 0) for e in ledger())


class Budget:
    """Refuses to start a task whose estimate would push this batch past the approved credits.

    Thread-safe: running tasks hold their estimate as a reservation until their real cost is known.
    """

    def __init__(self, approved_credits: float):
        self.approved = approved_credits
        self.used = 0.0
        self.pending = 0.0
        self._lock = threading.Lock()

    def reserve(self, step: str, estimate: float) -> None:
        with self._lock:
            if self.used + self.pending + estimate > self.approved:
                raise RuntimeError(f"BUDGET STOP before {step}: {self.used:.0f} used + {self.pending:.0f} reserved + "
                                   f"{estimate:.0f} estimated > {self.approved:.0f} approved credits")
            self.pending += estimate

    def settle(self, estimate: float, credits: float) -> None:
        with self._lock:
            self.pending -= estimate
            self.used += credits

    def charge(self, credits: float) -> None:
        self.settle(0.0, credits)


def done(step: str) -> dict | None:
    for e in reversed(ledger()):
        if e["step"] == step and e["status"] == "success":
            return e
    return None


def _create(endpoint: str, payload: dict, step: str, max_wait_s: float = 1800) -> str:
    """POST a task. The API caps concurrent generations with HTTP 429 (nothing is charged); wait and retry."""
    t0 = time.time()
    while True:
        r = requests.post(f"{BASE}{endpoint}", headers=_headers(), json=payload, timeout=60)
        if r.status_code != 429 or time.time() - t0 > max_wait_s:
            return _check(r)["task_id"]
        wait = float(r.headers.get("Retry-After") or 20)
        print(f"[429] {step}: concurrency limit, retrying in {wait:g}s", flush=True)
        time.sleep(wait)


def run(step: str, endpoint: str, payload: dict, budget: Budget, estimate: float,
        poll_s: float = 5.0, timeout_s: float = 1800) -> dict:
    """Create a task, wait for it, download its outputs, and record it in the ledger."""
    prior = done(step)
    if prior:
        print(f"[reuse] {step} -> {prior['task_id']}")
        return prior
    budget.reserve(step, estimate)
    _SLOTS.acquire()
    try:
        return _run_slot(step, endpoint, payload, budget, estimate, poll_s, timeout_s)
    finally:
        _SLOTS.release()


def _run_slot(step: str, endpoint: str, payload: dict, budget: Budget, estimate: float, poll_s: float, timeout_s: float) -> dict:
    t0 = time.time()
    try:
        task_id = _create(endpoint, payload, step)
    except Exception:
        budget.settle(estimate, 0.0)
        raise
    print(f"[start] {step} task {task_id}", flush=True)
    while True:
        data = _check(requests.get(f"{BASE}/tasks/{task_id}", headers=_headers(), timeout=30))
        if data.get("status") not in PENDING or time.time() - t0 > timeout_s:
            break
        time.sleep(poll_s)
    credits = float(data.get("credits_consumed") or 0)
    budget.settle(estimate, credits)
    out_dir = OUT / step
    out_dir.mkdir(parents=True, exist_ok=True)
    files = {}
    for k, v in (data.get("output") or {}).items():
        if isinstance(v, str) and v.startswith("http"):
            name = k + Path(v.split("?")[0]).suffix
            (out_dir / name).write_bytes(requests.get(v, timeout=300).content)
            files[k] = str((out_dir / name).relative_to(EXP))
    (out_dir / "task.json").write_text(json.dumps(data, indent=2))
    entry = {"step": step, "endpoint": endpoint, "payload": payload, "task_id": task_id, "status": data.get("status"), "credits_consumed": credits,
             "estimate": estimate, "seconds": round(time.time() - t0, 1), "files": files,
             "at": time.strftime("%Y-%m-%dT%H:%M:%S")}
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with _LEDGER_LOCK, LEDGER.open("a") as f:
        f.write(json.dumps(entry) + "\n")
    print(f"[{data.get('status')}] {step} {credits:g} credits {entry['seconds']}s files={list(files)}", flush=True)
    if data.get("status") != "success":
        raise RuntimeError(f"{step} ended {data.get('status')}: {json.dumps(data)[:600]}")
    return entry


if __name__ == "__main__":
    print(json.dumps(balance()))
