# Registered rarity frames — geometry-v2 review set

Status: **owner-rejected visual approach; retained only as historical evidence**.

This set preserves the owner-accepted materials and ornament from the individually generated v2
frames while registering every rank to the immutable `skill-icon-geometry-v2` authority. It does
not repaint or regenerate any frame.

The deterministic registration:

1. detects the closed transparent aperture in each accepted source;
2. maps that aperture to the shared geometry-v2 inset aperture;
3. extends only the outer rail beneath the original pixels so every edge reaches the common outer
   envelope without changing the central aperture;
4. applies the exact outer-envelope, aperture, and medallion role mask using pixel-center rules;
5. retains the common 1024×1024 RGBA canvas.

## Review assets

- `review/contact-sheet.png` — all seven registered candidates at equal scale
- `review/alpha-overlay.png` — tinted alpha overlay proving common aperture and center
- `review/recognition-96.png` — all seven frames at the 96-pixel recognition size
- `manifest.json` — source, geometry, output paths, and SHA-256 provenance

The owner rejected the combined overlay and outward rail-extension result on 2026-09-03. The
individual candidates under `candidates/individuals/` are not canonical masters and must not be
used for runtime composition or as references for later generation. The replacement direction is a
single high-resolution seven-frame horizontal strip, followed by owner-reviewed crops.

## Reproduce and validate

```bash
python3 tools/register-skill-rarity-frames.py --write
python3 tools/register-skill-rarity-frames.py --check
```

The repository role-aware inspector must also report zero violations for all seven candidates
against `assets/wiki/skills/icon-production-v1/geometry-v2.json` before promotion.
