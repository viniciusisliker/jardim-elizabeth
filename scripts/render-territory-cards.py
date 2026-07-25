#!/usr/bin/env python3
"""
Renderiza cartoes de territorio estilo S-12-T (3D/isometrico + moldura).

Saida: img/territorios-cards/tXX.jpg

Uso:
  python scripts/render-territory-cards.py --num 01 02
  python scripts/render-territory-cards.py
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

_spec = importlib.util.spec_from_file_location(
    "render_territory_images", ROOT / "scripts" / "render-territory-images.py"
)
_rti = importlib.util.module_from_spec(_spec)
assert _spec.loader
_spec.loader.exec_module(_rti)

bbox_from_paths = _rti.bbox_from_paths
choose_zoom = _rti.choose_zoom
enhance_satellite = _rti.enhance_satellite
fetch_cong_osm = _rti.fetch_cong_osm
fetch_satellite_tiles = _rti.fetch_satellite_tiles
filter_osm_for_bbox = _rti.filter_osm_for_bbox
project_ring = _rti.project_ring

from scripts.territory_boundaries_lib import (  # noqa: E402
    BOUNDARIES_FILE,
    CHECKLIST_FILE,
    load_boundaries,
    load_territory_names,
    normalize_paths,
)

OUT_DIR = ROOT / "img" / "territorios-cards"

# Paleta cartao S-12-T
CREAM = (248, 244, 232)
CREAM_DARK = (235, 228, 210)
INK = (28, 28, 28)
INK_MUTED = (80, 75, 68)
TERRITORY_FILL = (255, 220, 60, 72)
TERRITORY_LINE = (255, 170, 0, 255)
TERRITORY_GLOW = (255, 210, 80, 140)
ROOF = (186, 98, 62)
ROOF_LIGHT = (210, 125, 82)
WALL = (228, 222, 210)
STREET = (72, 72, 78)
STREET_LINE = (120, 120, 128)
TREE = (56, 128, 64)


def load_font(size: int, serif: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = (
        ["times.ttf", "Times New Roman.ttf", "georgia.ttf"]
        if serif
        else ["arial.ttf", "Arial.ttf", "segoeui.ttf"]
    )
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def oblique_transform(img: Image.Image, tilt: float = 0.18, bg: tuple[int, int, int] = CREAM) -> Image.Image:
    """Perspectiva leve (vista obliqua estilo cartao 3D)."""
    w, h = img.size
    dx = int(w * tilt)
    dy = int(h * tilt * 0.28)
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    dst = [(dx, dy), (w - dx, 0), (w, h - dy // 2), (0, h - dy)]
    coeffs = _find_perspective_coeffs(dst, src)
    out_h = h + dy
    warped = img.transform((w, out_h), Image.PERSPECTIVE, coeffs, Image.Resampling.BICUBIC)
    canvas = Image.new("RGB", (w, out_h), bg)
    if warped.mode == "RGBA":
        canvas.paste(warped, (0, 0), warped.split()[3])
    else:
        canvas.paste(warped, (0, 0))
    return canvas


def _find_perspective_coeffs(dst: list, src: list) -> tuple:
    """Coeficientes para Image.PERSPECTIVE (8 pontos)."""
    matrix = []
    for (x, y), (u, v) in zip(dst, src):
        matrix.append([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
        matrix.append([0, 0, 0, x, y, 1, -v * x, -v * y, v])
    # Eliminacao Gaussiana 8x9
    rows = [r[:] for r in matrix]
    for col in range(8):
        pivot = max(range(col, 8), key=lambda r: abs(rows[r][col]))
        rows[col], rows[pivot] = rows[pivot], rows[col]
        base = rows[col][col] or 1e-12
        rows[col] = [v / base for v in rows[col]]
        for r in range(8):
            if r == col:
                continue
            factor = rows[r][col]
            rows[r] = [rows[r][c] - factor * rows[col][c] for c in range(9)]
    return tuple(rows[i][8] for i in range(8))


def draw_building_iso(
    draw: ImageDraw.ImageDraw,
    pix: list[tuple[float, float]],
    height_px: float,
    light: tuple[int, int, int] = (1, -1),
) -> None:
    if len(pix) < 3:
        return
    lx, ly = light
    off = (
        max(2, min(8, int(height_px * 0.35))) * (1 if lx > 0 else -1),
        max(2, min(8, int(height_px * 0.35))) * (1 if ly > 0 else -1),
    )
    shadow = [(x + off[0], y + off[1]) for x, y in pix]
    draw.polygon(shadow, fill=(0, 0, 0, 45))
    draw.polygon(pix, fill=ROOF + (255,))
    # Paredes simuladas: desloca base
    base = [(x - off[0] * 0.3, y - off[1] * 0.3) for x, y in pix]
    draw.polygon(base, fill=WALL + (255,))
    draw.polygon(pix, fill=ROOF_LIGHT + (200,), outline=(120, 70, 45))


def draw_street_line(draw: ImageDraw.ImageDraw, pix: list[tuple[float, float]], width: int = 4) -> None:
    if len(pix) < 2:
        return
    draw.line(pix, fill=STREET + (255,), width=width + 2, joint="curve")
    draw.line(pix, fill=STREET_LINE + (255,), width=max(1, width - 1), joint="curve")


def street_label_positions(
    features: dict,
    streets_names: list[str],
    tx0: float,
    ty0: float,
    zoom: float,
) -> list[tuple[str, tuple[float, float]]]:
    labels: list[tuple[str, tuple[float, float]]] = []
    used: set[tuple[int, int]] = set()
    for name in streets_names[:8]:
        short = name.replace("Rua ", "R. ").replace("Avenida ", "Av. ").replace("Estrada ", "Estr. ")
        short = short.replace("Travessa ", "Trav. ")
        # posiciona no centroide do territorio com pequeno offset por indice
        labels.append((short, (0.0, 0.0)))  # placeholder
    # Posicionar ao longo das ruas OSM mais longas
    ranked = sorted(features.get("streets", []), key=len, reverse=True)
    for i, name in enumerate(streets_names[:6]):
        short = name
        if i < len(ranked) and len(ranked[i]) >= 2:
            coords = ranked[i]
            mid = coords[len(coords) // 2]
            ring = project_ring([coords[0], coords[-1]], tx0, ty0, zoom) if False else []
            pts = project_ring(coords, tx0, ty0, zoom)
            if pts:
                mx = sum(p[0] for p in pts) / len(pts)
                my = sum(p[1] for p in pts) / len(pts)
                key = (int(mx // 20), int(my // 20))
                if key not in used:
                    used.add(key)
                    labels[i] = (short, (mx, my))
    return [(n, p) for n, p in labels if p != (0.0, 0.0)]


def draw_label(draw: ImageDraw.ImageDraw, text: str, pos: tuple[float, float], font) -> None:
    x, y = pos
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx, ty = x - tw / 2, y - th / 2
    for ox, oy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        draw.text((tx + ox, ty + oy), text, fill=(0, 0, 0, 200), font=font)
    draw.text((tx, ty), text, fill=(255, 255, 255, 255), font=font)


def render_map_canvas(
    paths: list[list[list[float]]],
    streets: list[str],
    cong_osm: dict,
    map_w: int,
    map_h: int,
) -> Image.Image:
    min_lat, min_lon, max_lat, max_lon = bbox_from_paths(paths, pad=0.0012)
    zoom = choose_zoom(min_lat, min_lon, max_lat, max_lon, map_w)
    sat, tx0, ty0, zoom = fetch_satellite_tiles(min_lat, min_lon, max_lat, max_lon, zoom)
    sat = enhance_satellite(sat)
    sat = ImageEnhance.Color(sat).enhance(1.18)
    sat = ImageEnhance.Contrast(sat).enhance(1.06)
    sat = sat.filter(ImageFilter.UnsharpMask(radius=1.2, percent=110, threshold=3))

    features = filter_osm_for_bbox(cong_osm, min_lat, min_lon, max_lat, max_lon)

    # Canvas mapa
    layer = Image.new("RGBA", sat.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")

    for coords in features.get("streets", []):
        if len(coords) < 2:
            continue
        pix = project_ring(coords, tx0, ty0, zoom)
        draw_street_line(draw, pix, 3)

    for b in features.get("buildings", []):
        ring = b.get("coords") or []
        if len(ring) < 3:
            continue
        pix = project_ring(ring, tx0, ty0, zoom)
        h = b.get("height", 8.0)
        draw_building_iso(draw, pix, max(3, min(10, h / 2)))

    # Recorte ao territorio
    xs, ys = [], []
    for ring in paths:
        for x, y in project_ring(ring, tx0, ty0, zoom):
            xs.append(x)
            ys.append(y)
    if xs:
        pad = 36
        x0, y0 = max(0, int(min(xs)) - pad), max(0, int(min(ys)) - pad)
        x1, y1 = min(sat.width, int(max(xs)) + pad), min(sat.height, int(max(ys)) + pad)
        sat = sat.crop((x0, y0, x1, y1))
        layer = layer.crop((x0, y0, x1, y1))
        ox, oy = -x0, -y0
    else:
        ox = oy = 0

    composed = Image.alpha_composite(sat.convert("RGBA"), layer)

    # Limite territorio
    tdraw = ImageDraw.Draw(composed, "RGBA")
    for ring in paths:
        pix = [(x + ox, y + oy) for x, y in project_ring(ring, tx0, ty0, zoom)]
        if len(pix) < 3:
            continue
        closed = pix + [pix[0]]
        tdraw.line(closed, fill=TERRITORY_GLOW, width=8, joint="curve")
        tdraw.polygon(pix, fill=TERRITORY_FILL)
        tdraw.line(closed, fill=TERRITORY_LINE, width=3, joint="curve")

    # Labels: ruas do checklist + OSM
    label_font = load_font(13)
    labels = street_label_positions(features, streets, tx0, ty0, zoom)
    labels = [(n, (lx + ox, ly + oy)) for n, (lx, ly) in labels if (lx, ly) != (0.0, 0.0)]
    placed = {p for _, p in labels}
    for i, name in enumerate(streets[:6]):
        short = name.replace("Rua ", "R. ").replace("Avenida ", "Av. ").replace("Estrada ", "Estr. ")
        short = short.replace("Travessa ", "Trav. ")
        if any(short in n for n, _ in labels):
            continue
        if xs:
            cx = (min(xs) + max(xs)) / 2 + ox
            cy = (min(ys) + max(ys)) / 2 + oy
            off = (i - 2.5) * 28
            pos = (cx + off, cy + off * 0.4)
            if pos not in placed:
                labels.append((short, pos))
    for name, (lx, ly) in labels:
        draw_label(tdraw, name[:28], (lx, ly), label_font)

    # Obliqua + fit
    composed = oblique_transform(composed.convert("RGB"))
    composed = composed.resize((map_w, map_h), Image.Resampling.LANCZOS)
    return composed.convert("RGBA")


def render_card(num: str, name: str, paths: list, streets: list[str], cong_osm: dict) -> Path:
    card_w, card_h = 1200, 1550
    card = Image.new("RGB", (card_w, card_h), CREAM)
    draw = ImageDraw.Draw(card)

    title_f = load_font(22, serif=True)
    label_f = load_font(14, serif=True)
    value_f = load_font(34, serif=True)
    num_f = load_font(42, serif=True)
    foot_f = load_font(13, serif=True)

    # Moldura superior
    draw.rectangle([48, 40, card_w - 48, 200], outline=INK, width=2)
    draw.text((card_w // 2, 58), "Cartão de Mapa de Território", fill=INK, font=title_f, anchor="mt")
    draw.text((card_w // 2, 88), "JARDIM ELIZABETH — SÃO PAULO", fill=INK_MUTED, font=label_f, anchor="mt")

    draw.text((90, 118), "Localidade", fill=INK_MUTED, font=label_f)
    draw.text((90, 138), name.upper(), fill=INK, font=value_f)

    draw.rectangle([card_w - 220, 112, card_w - 70, 188], outline=INK, width=2)
    draw.text((card_w - 145, 122), "Terr. N.º", fill=INK_MUTED, font=label_f, anchor="mt")
    draw.text((card_w - 145, 148), num.lstrip("0") or num, fill=INK, font=num_f, anchor="mt")

    # Area do mapa
    map_x, map_y, map_w, map_h = 70, 220, card_w - 140, 980
    draw.rectangle([map_x - 4, map_y - 4, map_x + map_w + 4, map_y + map_h + 4], fill=CREAM_DARK)
    map_img = render_map_canvas(paths, streets, cong_osm, map_w, map_h)
    card.paste(map_img, (map_x, map_y), map_img if map_img.mode == "RGBA" else None)

    # Rodape S-12-T
    footer = (
        "Guarde este cartão no envelope. Tome cuidado para não o manchar, marcar ou dobrar. "
        "Cada vez que o território for coberto, queira informar disso o irmão que cuida do arquivo de territórios."
    )
    draw.multiline_text((70, 1240), footer, fill=INK_MUTED, font=foot_f, spacing=6)
    draw.text((card_w - 180, card_h - 50), "Impresso no Brasil", fill=INK_MUTED, font=label_f)

    out = OUT_DIR / f"t{num}.jpg"
    out.parent.mkdir(parents=True, exist_ok=True)
    card.save(out, "JPEG", quality=93, optimize=True, progressive=True)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Cartoes S-12-T estilo 3D")
    parser.add_argument("--num", nargs="*", help="Territorios (ex: 01 02)")
    args = parser.parse_args()

    if not BOUNDARIES_FILE.exists():
        print("territory-boundaries.json nao encontrado", file=sys.stderr)
        return 1

    checklist = {t["num"]: t for t in json.loads(CHECKLIST_FILE.read_text(encoding="utf-8"))["territories"]}
    data = load_boundaries()
    names = load_territory_names()
    targets = args.num or [f"{i:02d}" for i in range(1, 20)]

    print("Baixando OSM...")
    try:
        cong_osm = fetch_cong_osm()
    except Exception as exc:  # noqa: BLE001
        print(f"OSM indisponivel ({exc}), mapa so com satelite.")
        cong_osm = {"buildings": [], "streets": [], "greens": []}

    print(f"Saida -> {OUT_DIR.relative_to(ROOT)}/")
    n = 0
    for num in targets:
        num = str(num).zfill(2)
        spec = data.get("territories", {}).get(num)
        if not spec:
            continue
        paths = normalize_paths(spec.get("paths") or [])
        if not paths:
            continue
        entry = checklist.get(num, {})
        streets = entry.get("streets") or []
        name = spec.get("name") or names.get(num, f"T{num}")
        print(f"  T{num} - {name}...")
        out = render_card(num, name, paths, streets, cong_osm)
        print(f"    -> {out.relative_to(ROOT)}")
        n += 1
    print(f"\n{n} cartao(oes) gerado(s).")
    return 0 if n else 1


if __name__ == "__main__":
    raise SystemExit(main())
