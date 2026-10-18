#!/usr/bin/env python3
"""Export wiki-only previews of approved complete armor sets and Greatswords.

Run with python3 tools/export-wiki-equipment-gallery.py [--check]. Existing
runtime item derivatives remain the authority for the 140 integrated items.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'apps/web/static/wiki-media/equipment-gallery-v1'
SOURCES = {
    'material': 'assets/equipment/approved/material-equipment-v1/manifest.json',
    'greatsword': 'assets/equipment/approved/two-handed-greatsword-v1/manifest.json',
}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def export(check=False):
    authorities = {}
    records = []
    expected = {}
    for kind, source_path in SOURCES.items():
        source_bytes = (ROOT / source_path).read_bytes()
        authorities[kind] = {'path': source_path, 'contentHash': sha256(source_bytes)}
        source = json.loads(source_bytes)
        for record in source['records']:
            if kind == 'material' and record['role'] != 'armor-set-reference':
                continue
            approved = record['approved']
            original = (ROOT / approved['path']).read_bytes()
            if sha256(original) != approved['sha256']:
                raise ValueError(f"Approved source hash mismatch: {record['assetKey']}")
            with Image.open(io.BytesIO(original)) as image:
                if image.size != (approved['width'], approved['height']):
                    raise ValueError(f"Approved dimensions mismatch: {record['assetKey']}")
                image = image.convert('RGBA')
                image.thumbnail((512, 768 if kind == 'material' else 512), Image.Resampling.LANCZOS)
                buffer = io.BytesIO()
                image.save(buffer, format='WEBP', quality=85, method=6)
                data = buffer.getvalue()
                width, height = image.size
            content_hash = sha256(data)
            filename = f"{record['assetKey']}.{content_hash[:12]}.webp"
            expected[filename] = data
            records.append({
                'assetKey': record['assetKey'],
                'sourcePath': approved['path'],
                'sourceContentHash': approved['sha256'],
                'file': filename,
                'publicPath': f'/wiki-media/equipment-gallery-v1/{filename}',
                'width': width, 'height': height,
                'bytes': len(data), 'contentHash': content_hash,
            })
    if len(records) != 28:
        raise ValueError('Expected 21 complete sets and seven Greatswords')
    manifest = {
        'schemaVersion': 'wiki-equipment-gallery-v1',
        'exporterVersion': 'wiki-equipment-gallery-exporter-v1',
        'sourceAuthorities': authorities,
        'encoder': {'format': 'webp', 'quality': 85, 'method': 6, 'metadata': 'stripped'},
        'summary': {'assetCount': len(records), 'totalBytes': sum(r['bytes'] for r in records)},
        'records': records,
    }
    expected['manifest.json'] = (json.dumps(manifest, indent='\t') + '\n').encode()
    if check:
        actual_names = {p.name for p in OUTPUT.iterdir()} if OUTPUT.exists() else set()
        if actual_names != set(expected):
            raise ValueError('Wiki gallery file inventory is stale')
        for name, data in expected.items():
            if (OUTPUT / name).read_bytes() != data:
                raise ValueError(f'Wiki gallery output is stale: {name}')
    else:
        OUTPUT.mkdir(parents=True, exist_ok=True)
        for name, data in expected.items():
            (OUTPUT / name).write_bytes(data)
        for stale in OUTPUT.iterdir():
            if stale.name not in expected:
                stale.unlink()
    print(f"{'Verified' if check else 'Exported'} 28 wiki equipment previews ({manifest['summary']['totalBytes']:,} bytes)")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    export(parser.parse_args().check)
