#!/usr/bin/env python3
"""Export exact-source hero thumbnails and paginated GitHub galleries.

Requires Python 3 + Pillow. No network access or image generation. Recover originals
from their immutable Git tree; LFS pointers resolve in the local Git LFS cache.
Run: python3 tools/export-hero-archive.py --write (or --check).
"""
import argparse
import hashlib
import html
import io
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'docs/readme-gallery/hero-archive.json'
PAGE_SIZE = 24


def digest(data):
    return hashlib.sha256(data).hexdigest()


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args])


def source_bytes(source):
    data = git('show', f"{source['sourceCommit']}:{source['path']}")
    if data.startswith(b'version https://git-lfs.github.com/spec/v1\n'):
        oid = next(line.split(':', 1)[1] for line in data.decode().splitlines() if line.startswith('oid sha256:'))
        common = Path(git('rev-parse', '--git-common-dir').decode().strip())
        if not common.is_absolute():
            common = ROOT / common
        path = common / 'lfs/objects' / oid[:2] / oid[2:4] / oid
        if not path.is_file():
            raise ValueError(f'Missing local LFS object {oid}. Fetch this source commit with Git LFS before export.')
        data = path.read_bytes()
        if digest(data) != oid:
            raise ValueError(f'LFS object hash mismatch: {oid}')
    if digest(data) != source['sha256']:
        raise ValueError(f"Original source hash mismatch: {source['path']}")
    return data


def gallery_pages(heroes):
    count = (len(heroes) + PAGE_SIZE - 1) // PAGE_SIZE
    for page in range(1, count + 1):
        subset = heroes[(page - 1) * PAGE_SIZE:page * PAGE_SIZE]
        navigation = ' · '.join(f'[{number:02d}](hero-archive-{number:02d}.md)' if number != page else f'**{number:02d}**' for number in range(1, count + 1))
        lines = [f'# Hero archive · page {page} of {count}', '', '[Collection guide and audit](hero-archive.md) · [Approved roster](heroes.md) · [Older status and alternate portraits](legacy-heroes.md)', '', f'Heroes {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + len(subset)} of 736, in name order. Select any thumbnail for the immutable original.', '', navigation, '', '<table>']
        for offset in range(0, len(subset), 4):
            lines.append('  <tr>')
            for row in subset[offset:offset + 4]:
                name = html.escape(row['displayName'])
                status = html.escape(row['status'])
                src = '../../apps/web/static' + row['thumbnail']['path']
                lines.append(f'    <td align="center" width="25%"><a href="{row["source"]["imageUrl"]}"><img src="{src}" alt="{name} portrait" width="160" loading="lazy"></a><br><strong>{name}</strong><br>{status}</td>')
            lines.append('  </tr>')
        lines.extend(['</table>', '', navigation, ''])
        yield ROOT / f'docs/readme-gallery/hero-archive-{page:02d}.md', '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    archive = json.loads(MANIFEST.read_text())
    heroes = archive['heroes']
    assert len(heroes) == len({r['heroId'] for r in heroes}) == 736
    assert len({r['identity']['identitySignature'] for r in heroes if 'identity' in r}) == 671
    assert sum('historicalPortrait' in r for r in heroes) == 200
    assert all('/runtime/summonable-heroes-v1/' in r['source']['path'] for r in heroes if r['collection'] == 'approved')
    assert len({r['thumbnail']['path'] for r in heroes}) == 736
    for collection, count in archive['counts'].items():
        assert (len(heroes) if collection == 'all' else sum(r['collection'] == collection for r in heroes)) == count
    for row in heroes:
        original = source_bytes(row['source'])
        with Image.open(io.BytesIO(original)) as image:
            image = ImageOps.exif_transpose(image).convert('RGBA')
            original_size = list(image.size)
            image.thumbnail((240, 360), Image.Resampling.LANCZOS)
            size = list(image.size)
            path = ROOT / 'apps/web/static' / row['thumbnail']['path'].lstrip('/')
            if args.write:
                path.parent.mkdir(parents=True, exist_ok=True)
                image.save(path, 'WEBP', quality=78, method=6)
                row['thumbnail'].update({'sha256': digest(path.read_bytes()), 'width': size[0], 'height': size[1], 'sourceWidth': original_size[0], 'sourceHeight': original_size[1], 'sizeBytes': path.stat().st_size})
            assert digest(path.read_bytes()) == row['thumbnail']['sha256'], path
            assert [row['thumbnail']['width'], row['thumbnail']['height']] == size, path
            assert [row['thumbnail']['sourceWidth'], row['thumbnail']['sourceHeight']] == original_size, path
            assert row['thumbnail']['sizeBytes'] == path.stat().st_size, path
            with Image.open(path) as thumb:
                assert list(thumb.size) == size, path
                assert thumb.format == 'WEBP', path
            assert row['source']['sha256'][:12] in path.name
            assert path.stat().st_size < 100_000, path
    for path, content in gallery_pages(heroes):
        if args.write:
            path.write_text(content)
        else:
            assert path.read_text() == content, f'Stale gallery: {path}'
    if args.write:
        MANIFEST.write_text(json.dumps(archive, ensure_ascii=False, indent=2) + '\n')
    total = sum(r['thumbnail']['sizeBytes'] for r in heroes)
    print(f'Verified {len(heroes)} original SHA-256 bindings and aspect-preserving WebP thumbnails; {total:,} bytes across 31 GitHub pages.')


if __name__ == '__main__':
    main()
