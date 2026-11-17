"""Minimal Tripo API v3 client with a credit ledger and a hard budget guard.

Keys are read from ~/.config/image-to-3d/keys.env (TRIPO_API_KEY=...) and never printed.
Every task is appended to rigging/ledger.jsonl (no secrets) and its outputs are downloaded to
work/hosted/tripo/<step>/. Steps that already succeeded in the ledger are reused, not re-run.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

import requests

EXP = Path(__file__).resolve().parents[2]
LEDGER = EXP / "rigging" / "ledger.jsonl"
OUT = EXP / "work" / "hosted" / "tripo"
BASE = "https://openapi.tripo3d.ai/v3"
KEYS = Path.home() / ".config" / "image-to-3d" / "keys.env"
PENDING = {"queued", "running"}  # any other status is terminal


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
                                    files={"file": (path.name, f, "image/png")}, timeout=120))
    return data["file_token"]


def ledger() -> list[dict]:
    if not LEDGER.exists():
        return []
    return [json.loads(line) for line in LEDGER.read_text().splitlines() if line.strip()]


def spent() -> float:
    return sum(float(e.get("credits_consumed") or 0) for e in ledger())


class Budget:
    """Refuses to start a task whose estimate would push this batch past the approved credits."""

    def __init__(self, approved_credits: float):
        self.approved = approved_credits
        self.used = 0.0

    def reserve(self, step: str, estimate: float) -> None:
        if self.used + estimate > self.approved:
            raise SystemExit(f"BUDGET STOP before {step}: {self.used:.0f} used + {estimate:.0f} estimated "
                             f"> {self.approved:.0f} approved credits")

    def charge(self, credits: float) -> None:
        self.used += credits


def done(step: str) -> dict | None:
    for e in reversed(ledger()):
        if e["step"] == step and e["status"] == "success":
            return e
    return None


def run(step: str, endpoint: str, payload: dict, budget: Budget, estimate: float,
        poll_s: float = 5.0, timeout_s: float = 1800) -> dict:
    """Create a task, wait for it, download its outputs, and record it in the ledger."""
    prior = done(step)
    if prior:
        print(f"[reuse] {step} -> {prior['task_id']}")
        return prior
    budget.reserve(step, estimate)
    t0 = time.time()
    task_id = _check(requests.post(f"{BASE}{endpoint}", headers=_headers(), json=payload, timeout=60))["task_id"]
    print(f"[start] {step} task {task_id}", flush=True)
    while True:
        data = _check(requests.get(f"{BASE}/tasks/{task_id}", headers=_headers(), timeout=30))
        if data.get("status") not in PENDING or time.time() - t0 > timeout_s:
            break
        time.sleep(poll_s)
    credits = float(data.get("credits_consumed") or 0)
    budget.charge(credits)
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
    with LEDGER.open("a") as f:
        f.write(json.dumps(entry) + "\n")
    print(f"[{data.get('status')}] {step} {credits:g} credits {entry['seconds']}s files={list(files)}", flush=True)
    if data.get("status") != "success":
        raise RuntimeError(f"{step} ended {data.get('status')}: {json.dumps(data)[:600]}")
    return entry


if __name__ == "__main__":
    print(json.dumps(balance()))
