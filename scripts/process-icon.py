#!/usr/bin/env python3
"""Remove fundo claro/escuro externo do ícone e gera PNG com transparência."""
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = ROOT / "img" / "icone-upload.png"
DEFAULT_OUT = ROOT / "img" / "icon.png"


def resolve_source() -> Path:
    upload = ROOT / "img" / "icone-upload.png"
    icon = ROOT / "img" / "icon.png"
    if upload.exists():
        return upload
    return icon


def is_background(r: int, g: int, b: int, a: int) -> bool:
    if a < 8:
        return True
    if r > 245 and g > 245 and b > 245:
        return True
    if r < 12 and g < 12 and b < 12:
        return True
    return False


def remove_outer_background(src: Path, dest: Path) -> None:
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()

    seen = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))

    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            continue
        seen[y][x] = True
        r, g, b, a = px[x, y]
        if not is_background(r, g, b, a):
            continue
        px[x, y] = (r, g, b, 0)
        q.append((x + 1, y))
        q.append((x - 1, y))
        q.append((x, y + 1))
        q.append((x, y - 1))

    # Suaviza halo branco residual na borda do ícone.
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r > 235 and g > 235 and b > 235:
                px[x, y] = (r, g, b, max(0, a - 180))

    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, format="PNG", optimize=True)


def main() -> int:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else resolve_source()
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUT
    if not src.exists():
        print(f"Arquivo não encontrado: {src}", file=sys.stderr)
        return 1
    remove_outer_background(src, out)
    print(f"Ícone processado: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
