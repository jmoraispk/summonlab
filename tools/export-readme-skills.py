#!/usr/bin/env python3
"""Export tightly padded README skill badges without changing canonical artwork."""
import argparse
import hashlib
import io
import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'docs/readme-gallery/skills'
CANVAS = (448, 512)
ART_HEIGHT = 496


def digest(data):
    return hashlib.sha256(data).hexdigest()


def export(check=False):
    provenance_path = ROOT / 'docs/readme-gallery/provenance.json'
    provenance = json.loads(provenance_path.read_text())
    readme_path = ROOT / 'README.md'
    readme = readme_path.read_text()
    expected = {}
    records = [r for r in provenance['readmeInputs'] if r['section'] == 'skills']
    if len(records) != 28:
        raise ValueError('Expected exactly 28 README skills')
    for record in records:
        old_path = record['path']
        source_path = record.get('previewSourcePath', old_path)
        source_hash = record.get('previewSourceSha256', record['sha256'])
        source = (ROOT / source_path).read_bytes()
        if digest(source) != source_hash:
            raise ValueError(f'Skill preview source hash mismatch: {source_path}')
        for path_key, hash_key in [('originalSourcePath', 'originalSourceSha256'), ('framePath', 'frameSha256')]:
            if digest((ROOT / record[path_key]).read_bytes()) != record[hash_key]:
                raise ValueError(f'Skill artwork hash mismatch: {record[path_key]}')
        with Image.open(io.BytesIO(source)) as image:
            image = image.convert('RGBA')
            bounds = image.getchannel('A').getbbox()
            if not bounds:
                raise ValueError(f'Empty skill image: {source_path}')
            cropped = image.crop(bounds)
            size = (round(cropped.width * ART_HEIGHT / cropped.height), ART_HEIGHT)
            if size[0] > CANVAS[0] - 16:
                raise ValueError(f'Skill exceeds the common badge envelope: {source_path}')
            scaled = cropped.resize(size, Image.Resampling.LANCZOS)
            canvas = Image.new('RGBA', CANVAS)
            canvas.paste(scaled, ((CANVAS[0] - scaled.width) // 2, 8))
            buffer = io.BytesIO()
            canvas.save(buffer, format='WEBP', lossless=True, method=6, exact=True)
        data = buffer.getvalue()
        slug = record['targetId'].replace(':', '-')
        path = f'docs/readme-gallery/skills/{slug}.{digest(data)[:12]}.webp'
        expected[ROOT / path] = data
        readme = readme.replace(f'src="{old_path}"', f'src="{path}"')
        record.update({
            'path': path, 'sha256': digest(data),
            'previewSourcePath': source_path, 'previewSourceSha256': source_hash,
            'sourceAlphaBounds': list(bounds), 'normalizedArtworkSize': list(size),
        })
    skills_start = readme.index('## Skills\n')
    prefix, skills = readme[:skills_start], readme[skills_start:]
    table = re.search(r'<table[\s\S]*?</table>', skills).group()
    normalized = table.replace('width="13%"', 'width="12.8%"')
    normalized = re.sub(r'<th>([FEDCBAS])</th>', r'<th><code>\1&nbsp;·&nbsp;Skill</code></th>', normalized)
    normalized = re.sub(r'(?<!<sub>)<strong>(.*?)</strong>(?!</sub>)', r'<sub><strong>\1</strong></sub>', normalized)
    readme = prefix + skills.replace(table, normalized, 1)
    expected[readme_path] = readme.encode()
    section = next(s for s in provenance['readmePresentation']['sections'] if s['heading'] == 'Skills')
    section.update({
        'layout': 'Four image/caption row pairs with centered category labels and seven ascending F–S rank columns requesting 12.8% each. Smaller vertically centered captions leave room for artwork. Equal-length nonbreaking rank headers in monospace keep column minimum widths consistent on narrow screens. All previews use the same 448 × 512 canvas and 496-pixel visible artwork height, preserving each original frame aspect ratio. Images fill their cells proportionally; native horizontal scrolling remains available on narrow screens.',
        'previewExport': {'script': 'tools/export-readme-skills.py', 'canvas': list(CANVAS), 'artworkHeight': ART_HEIGHT, 'fit': 'trim transparent bounds, scale uniformly to common height, center', 'padding': 'transparent', 'format': 'lossless-webp'},
    })
    expected[provenance_path] = (json.dumps(provenance, indent='\t', ensure_ascii=False) + '\n').encode()
    if check:
        for path, data in expected.items():
            if not path.exists() or path.read_bytes() != data:
                raise ValueError(f'Stale README skill export: {path.relative_to(ROOT)}')
        if set(OUTPUT.glob('*.webp')) != {p for p in expected if p.suffix == '.webp'}:
            raise ValueError('Unexpected README skill preview inventory')
    else:
        OUTPUT.mkdir(parents=True, exist_ok=True)
        for path, data in expected.items():
            path.write_bytes(data)
        for stale in OUTPUT.glob('*.webp'):
            if stale not in expected:
                stale.unlink()
    print(f'{"Verified" if check else "Exported"} 28 skill badges: 448 × 512 canvases, 496-pixel artwork height, no stretching')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    export(parser.parse_args().check)
