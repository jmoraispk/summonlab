#!/usr/bin/env python3
"""Export proportion-preserving square previews for the README monster selection."""
import argparse
import hashlib
import html
import io
import json
import re
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'docs/readme-gallery/monsters'
AUTHORITY = 'assets/enemies/runtime/monster-wiki-v1/catalog.json'
FAMILIES = ['giants', 'orcs', 'trolls', 'harpies', 'minotaurs', 'golems', 'treants', 'dragons']


def digest(data):
    return hashlib.sha256(data).hexdigest()


def export(check=False):
    catalog = json.loads((ROOT / AUTHORITY).read_text())
    index = json.loads((ROOT / 'docs/wiki/creatures/monsters/visual-index.json').read_text())
    families = {f['familyId']: f for f in index['families']}
    forms = {f['id']: f for f in index['monsters']}
    coordinates = {r['coordinateId']: r for r in catalog['records']}
    records, expected, rows = [], {}, []
    for family_id in FAMILIES:
        family = families[family_id]
        images = []
        for form_id in family['formIds']:
            form = forms[form_id]
            record = coordinates[f'{family_id}/{form_id}/normal']
            source = (ROOT / record['sourcePath']).read_bytes()
            if digest(source) != record['sourceSha256']:
                raise ValueError(f'Source hash mismatch: {form_id}')
            with Image.open(io.BytesIO(source)) as original:
                contained = ImageOps.contain(original.convert('RGBA'), (512, 512), Image.Resampling.LANCZOS)
                canvas = Image.new('RGBA', (512, 512))
                canvas.paste(contained, ((512 - contained.width) // 2, (512 - contained.height) // 2))
                buffer = io.BytesIO()
                canvas.save(buffer, format='WEBP', quality=88, method=6)
                data = buffer.getvalue()
            path = f'docs/readme-gallery/monsters/{form_id}.{digest(data)[:12]}.webp'
            expected[ROOT / path] = data
            records.append({
                'section': 'enemies', 'caption': form['name'], 'familyId': family_id,
                'familyName': family['displayName'], 'formId': form_id, 'tier': form['tier'],
                'path': path, 'sha256': digest(data), 'authority': AUTHORITY,
                'approvalStatus': record['presentationStatus'],
                'originalSourcePath': record['sourcePath'],
                'originalSourceSha256': record['sourceSha256'],
            })
            # GitHub strips CSS word-break rules; these optional breaks keep names from widening phone columns.
            caption = re.sub(r'([A-Za-z]{2})(?=[A-Za-z])', r'\1&#8203;', html.escape(form['name']))
            images.append(f'      <td align="center" valign="top" width="20%"><a href="{record["sourcePath"]}"><img src="{path}" alt="{html.escape(form["name"], quote=True)}" width="100%"></a><br><sup><strong>{caption}</strong></sup></td>')
        rows.append(f'    <tr><th colspan="5" align="center">{family["displayName"]}</th></tr>\n    <tr>\n' + '\n'.join(images) + '\n    </tr>')
    table = '<table width="100%">\n  <tbody>\n' + '\n'.join(rows) + '\n    <tr><td colspan="5" align="center"><strong>+30 more families</strong></td></tr>\n  </tbody>\n</table>'
    readme_path = ROOT / 'README.md'
    readme = re.sub(r'(## Enemies\n\n)<table[\s\S]*?</table>', lambda m: m[1] + table, readme_path.read_text(), count=1)
    expected[readme_path] = readme.encode()
    provenance_path = ROOT / 'docs/readme-gallery/provenance.json'
    provenance = json.loads(provenance_path.read_text())
    provenance['readmeInputs'] = records + [r for r in provenance['readmeInputs'] if r['section'] != 'enemies']
    presentation = provenance['readmePresentation']
    presentation['description'] = 'Native HTML tables link individual raster previews to unchanged full-size sources. Monster previews use proportion-preserving square padding; earlier JPEG contact sheets are historical capture artifacts.'
    section = next(s for s in presentation['sections'] if s['heading'] == 'Enemies')
    section.update({
        'families': FAMILIES, 'imageWidth': '100%', 'imageHeight': 'auto',
        'layout': 'Eight family heading rows each span five columns above their T1–T5 forms. There is no separate family column or tier header. Optional caption line breaks keep names from forcing horizontal overflow on narrow screens. Each top-aligned image and compact raised caption share a cell. Proportional square images fill five equally requested 20% columns across the full README width; +30 more families footer.',
        'previewExport': {'script': 'tools/export-readme-monsters.py', 'canvas': [512, 512], 'fit': 'contain', 'padding': 'transparent', 'format': 'webp', 'quality': 88, 'method': 6},
    })
    expected[provenance_path] = (json.dumps(provenance, indent='\t', ensure_ascii=False) + '\n').encode()
    if check:
        for path, data in expected.items():
            if not path.exists() or path.read_bytes() != data:
                raise ValueError(f'Stale README export: {path.relative_to(ROOT)}')
        if set(OUTPUT.glob('*.webp')) != {p for p in expected if p.suffix == '.webp'}:
            raise ValueError('Unexpected README monster preview inventory')
    else:
        OUTPUT.mkdir(parents=True, exist_ok=True)
        for path, data in expected.items():
            path.write_bytes(data)
        for stale in OUTPUT.glob('*.webp'):
            if stale not in expected:
                stale.unlink()
    print(f'{"Verified" if check else "Exported"} {len(records)} square monster previews; no cropping or stretching')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    export(parser.parse_args().check)
