#!/usr/bin/env python3
"""
Renderiza imagens aprimoradas dos territorios com base em geografia real.

Fontes (sem inventar geometria):
  - Satelite: Esri World Imagery (tiles reais)
  - Ruas/edificios/areas verdes: OpenStreetMap (Overpass)
  - Limite do territorio: maps/territory-boundaries.json

Saida: img/territorios-enhanced/tXX.jpg

Uso:
  python scripts/render-territory-images.py
  python scripts/render-territory-images.py --num 01 07 10
  python scripts/render-territory-images.py --width 1400 --zoom 18
"""
from __future__ import annotations

import argparse
import json
import math
import ssl
import sys
import time
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.territory_boundaries_lib import (  # noqa: E402
    BOUNDARIES_FILE,
    CHECKLIST_FILE,
    load_boundaries,
    load_territory_names,
    normalize_paths,
)

OUT_DIR = ROOT / "img" / "territorios-enhanced"
CACHE_DIR = ROOT / "maps" / ".render-cache"
UA = "JardimElizabethTerritoryRender/1.0"
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

BBOX_CONG = (-23.655, -46.790, -23.620, -46.750)  # south, west, north, east

# Estilo premium (cartao S-12-T + legibilidade)
COLOR_TERRITORY_FILL = (255, 214, 0, 58)
COLOR_TERRITORY_GLOW = (255, 230, 80, 110)
COLOR_TERRITORY_LINE = (255, 196, 0, 255)
COLOR_HEADER = (0, 32, 96, 255)
COLOR_HEADER_TEXT = (255, 255, 255)
COLOR_HEADER_SUB = (190, 205, 230)


def http_get(url: str, data: bytes | None = None) -> bytes:
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120, context=SSL_CTX) as resp:
        return resp.read()


def latlon_to_pixel(lat: float, lon: float, z: float) -> tuple[float, float]:
    n = 2.0**z
    x = (lon + 180.0) / 360.0 * n
    lat_r = math.radians(lat)
    y = (1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n
    return x, y


def pixel_to_latlon(px: float, py: float, tx0: float, ty0: float, zoom: float) -> tuple[float, float]:
    x = px / 256.0 + tx0
    y = py / 256.0 + ty0
    n = 2.0**zoom
    lon = x / n * 360.0 - 180.0
    lat_r = math.atan(math.sinh(math.pi * (1.0 - 2.0 * y / n)))
    return math.degrees(lat_r), lon


def bbox_from_paths(paths: list[list[list[float]]], pad: float = 0.0008) -> tuple[float, float, float, float]:
    lats = [p[1] for poly in paths for p in poly]
    lons = [p[0] for poly in paths for p in poly]
    return min(lats) - pad, min(lons) - pad, max(lats) + pad, max(lons) + pad


MAX_ZOOM = 18
MIN_ZOOM = 16
ESRI_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"


def tile_is_placeholder(tile: Image.Image) -> bool:
    gray = tile.convert("L")
    hist = gray.histogram()
    total = sum(hist) or 1
    # Placeholder Esri: fundo cinza claro quase uniforme
    mid = sum(hist[200:240]) / total
    dark = sum(hist[:40]) / total
    return mid > 0.82 and dark < 0.02


def fetch_tile(url: str, cache: Path) -> Image.Image:
    if cache.exists():
        return Image.open(cache).convert("RGB")
    tile = Image.open(BytesIO(http_get(url))).convert("RGB")
    cache.parent.mkdir(parents=True, exist_ok=True)
    tile.save(cache, "JPEG", quality=92)
    time.sleep(0.04)
    return tile


def fetch_satellite_tiles(min_lat, min_lon, max_lat, max_lon, zoom: int) -> tuple[Image.Image, float, float, int]:
    for attempt in range(3):
        z = max(MIN_ZOOM, min(MAX_ZOOM, zoom - attempt))
        x0, y1 = latlon_to_pixel(min_lat, min_lon, z)
        x1, y0 = latlon_to_pixel(max_lat, max_lon, z)
        tx0, ty0 = int(math.floor(x0)) - 1, int(math.floor(y0)) - 1
        tx1, ty1 = int(math.ceil(x1)) + 1, int(math.ceil(y1)) + 1
        w = (tx1 - tx0 + 1) * 256
        h = (ty1 - ty0 + 1) * 256
        canvas = Image.new("RGB", (w, h), (28, 32, 38))
        bad = 0
        total = 0

        for ty in range(ty0, ty1 + 1):
            for tx in range(tx0, tx1 + 1):
                total += 1
                esri_cache = CACHE_DIR / "esri" / str(z) / f"{tx}_{ty}.jpg"
                osm_cache = CACHE_DIR / "osm-tiles" / str(z) / f"{tx}_{ty}.png"
                try:
                    tile = fetch_tile(ESRI_URL.format(z=z, y=ty, x=tx), esri_cache)
                    if tile_is_placeholder(tile):
                        tile = fetch_tile(OSM_URL.format(z=z, x=tx, y=ty), osm_cache)
                        bad += 1
                except Exception:
                    try:
                        tile = fetch_tile(OSM_URL.format(z=z, x=tx, y=ty), osm_cache)
                        bad += 1
                    except Exception:
                        tile = Image.new("RGB", (256, 256), (40, 44, 50))
                        bad += 1
                canvas.paste(tile, ((tx - tx0) * 256, (ty - ty0) * 256))

        if bad < total * 0.6 or attempt == 2:
            return canvas, float(tx0), float(ty0), z

    return canvas, float(tx0), float(ty0), z


def project_ring(ring: list[list[float]], tx0: float, ty0: float, zoom: float) -> list[tuple[float, float]]:
    return [
        ((latlon_to_pixel(lat, lon, zoom)[0] - tx0) * 256, (latlon_to_pixel(lat, lon, zoom)[1] - ty0) * 256)
        for lon, lat in ring
    ]


def choose_zoom(min_lat, min_lon, max_lat, max_lon, target_width: int) -> int:
    for z in range(MAX_ZOOM, MIN_ZOOM - 1, -1):
        x0, y1 = latlon_to_pixel(min_lat, min_lon, z)
        x1, y0 = latlon_to_pixel(max_lat, max_lon, z)
        w = (math.ceil(x1) - math.floor(x0) + 2) * 256
        if w >= target_width * 0.85:
            return z
    return MIN_ZOOM


OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def fetch_cong_osm() -> dict:
    cache = CACHE_DIR / "osm" / "congregation.json"
    if cache.exists() and cache.stat().st_size > 1000:
        return json.loads(cache.read_text(encoding="utf-8"))

    south, west, north, east = BBOX_CONG
    q = f"""
[out:json][timeout:120];
(
  way["building"]({south},{west},{north},{east});
  way["highway"]["highway"~"^(primary|secondary|tertiary|residential|unclassified|living_street|service)$"]({south},{west},{north},{east});
  way["leisure"="park"]({south},{west},{north},{east});
  way["landuse"~"^(grass|forest|meadow|village_green)$"]({south},{west},{north},{east});
);
out geom;
"""
    data = urllib.parse.urlencode({"data": q}).encode()
    payload = None
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            print(f"Baixando OSM ({endpoint.split('/')[2]})...")
            payload = json.loads(http_get(endpoint, data).decode())
            break
        except Exception as exc:  # noqa: BLE001
            print(f"  falhou: {exc}")
            time.sleep(1.0)

    if payload is None:
        print("  OSM indisponivel — render segue so com satelite.")
        return {"buildings": [], "streets": [], "greens": []}
    features = {"buildings": [], "streets": [], "greens": []}
    for el in payload.get("elements", []):
        geom = el.get("geometry") or []
        if len(geom) < 2:
            continue
        coords = [[p["lon"], p["lat"]] for p in geom]
        tags = el.get("tags") or {}
        if tags.get("building"):
            height = 8.0
            if tags.get("height"):
                try:
                    height = float(str(tags["height"]).split()[0].replace(",", "."))
                except ValueError:
                    height = 8.0
            elif tags.get("building:levels"):
                try:
                    height = float(tags["building:levels"]) * 3.0
                except ValueError:
                    height = 8.0
            features["buildings"].append({"coords": coords, "height": min(height, 40.0)})
        elif tags.get("highway"):
            features["streets"].append(coords)
        elif len(coords) >= 3:
            features["greens"].append(coords)

    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(features, ensure_ascii=False), encoding="utf-8")
    print(f"  OSM cache: {len(features['buildings'])} edificios, {len(features['streets'])} ruas")
    return features


def filter_osm_for_bbox(features: dict, min_lat, min_lon, max_lat, max_lon) -> dict:
    def in_bbox(lon: float, lat: float) -> bool:
        return min_lat <= lat <= max_lat and min_lon <= lon <= max_lon

    def coords_in(coords: list) -> bool:
        return any(in_bbox(lon, lat) for lon, lat in coords)

    return {
        "buildings": [b for b in features["buildings"] if coords_in(b["coords"])],
        "streets": [s for s in features["streets"] if coords_in(s)],
        "greens": [g for g in features["greens"] if coords_in(g)],
    }


def enhance_satellite(img: Image.Image) -> Image.Image:
    base = ImageEnhance.Contrast(img).enhance(1.10)
    base = ImageEnhance.Color(base).enhance(1.14)
    base = ImageEnhance.Brightness(base).enhance(1.03)
    gray = base.convert("L").filter(ImageFilter.EMBOSS)
    relief = Image.merge("RGB", (gray, gray, gray))
    base = Image.blend(base, relief, 0.12)
    base = base.filter(ImageFilter.UnsharpMask(radius=1.6, percent=130, threshold=2))
    return base


def apply_vignette(img: Image.Image, strength: float = 0.22) -> Image.Image:
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse([-w * 0.08, -h * 0.08, w * 1.08, h * 1.08], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=min(w, h) // 8))
    dark = Image.new("RGB", (w, h), (0, 0, 0))
    out = Image.composite(img, dark, mask)
    return Image.blend(img, out, strength)


def draw_osm_layers(
    size: tuple[int, int],
    tx0: float,
    ty0: float,
    zoom: float,
    features: dict,
) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")

    for ring in features.get("greens", []):
        if len(ring) < 3:
            continue
        pix = project_ring(ring, tx0, ty0, zoom)
        draw.polygon(pix, fill=(72, 160, 72, 38))

    for coords in features.get("streets", []):
        pix = project_ring(coords, tx0, ty0, zoom)
        if len(pix) >= 2:
            draw.line(pix, fill=(255, 255, 240, 70), width=3, joint="curve")
            draw.line(pix, fill=(255, 255, 255, 45), width=1, joint="curve")

    for b in features.get("buildings", []):
        ring = b["coords"]
        if len(ring) < 3:
            continue
        pix = project_ring(ring, tx0, ty0, zoom)
        h = b.get("height", 8.0)
        offset = max(1, min(6, int(h / 4)))
        shadow = [(x + offset, y + offset) for x, y in pix]
        draw.polygon(shadow, fill=(0, 0, 0, 55))
        roof = (245, 245, 240, 35)
        draw.polygon(pix, fill=roof, outline=(255, 255, 255, 40))

    return layer


def draw_territory_overlay(
    size: tuple[int, int],
    paths: list[list[list[float]]],
    tx0: float,
    ty0: float,
    zoom: float,
) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")
    for ring in paths:
        pix = project_ring(ring, tx0, ty0, zoom)
        if len(pix) < 3:
            continue
        closed = pix + [pix[0]]
        draw.line(closed, fill=COLOR_TERRITORY_GLOW, width=9, joint="curve")
        draw.polygon(pix, fill=COLOR_TERRITORY_FILL)
        draw.line(closed, fill=COLOR_TERRITORY_LINE, width=3, joint="curve")
    return layer


def crop_to_content(
    img: Image.Image,
    paths: list[list[list[float]]],
    tx0: float,
    ty0: float,
    zoom: float,
    margin: int = 48,
) -> Image.Image:
    xs, ys = [], []
    for ring in paths:
        for x, y in project_ring(ring, tx0, ty0, zoom):
            xs.append(x)
            ys.append(y)
    if not xs:
        return img
    x0 = max(0, int(min(xs)) - margin)
    y0 = max(0, int(min(ys)) - margin)
    x1 = min(img.width, int(max(xs)) + margin)
    y1 = min(img.height, int(max(ys)) + margin)
    return img.crop((x0, y0, x1, y1))


def add_header(img: Image.Image, num: str, name: str, subtitle: str) -> Image.Image:
    bar_h = 56
    out = Image.new("RGBA", (img.width, img.height + bar_h), (255, 255, 255, 255))
    out.paste(img, (0, bar_h))
    bar = ImageDraw.Draw(out)
    bar.rectangle([0, 0, out.width, bar_h], fill=COLOR_HEADER)
    try:
        font = ImageFont.truetype("arial.ttf", 22)
        font_s = ImageFont.truetype("arial.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
        font_s = font
    bar.text((16, 10), f"T{num} · {name}", fill=COLOR_HEADER_TEXT, font=font)
    bar.text((16, 34), subtitle[:100], fill=COLOR_HEADER_SUB, font=font_s)
    return out


def render_territory(
    num: str,
    name: str,
    paths: list[list[list[float]]],
    target_width: int,
    zoom_override: int | None,
    skip_osm: bool,
    cong_osm: dict | None,
) -> Path:
    min_lat, min_lon, max_lat, max_lon = bbox_from_paths(paths)
    zoom = zoom_override or choose_zoom(min_lat, min_lon, max_lat, max_lon, target_width)
    print(f"  T{num} - {name}: zoom {zoom}")

    satellite, tx0, ty0, zoom = fetch_satellite_tiles(min_lat, min_lon, max_lat, max_lon, zoom)
    satellite = enhance_satellite(satellite)

    if not skip_osm and cong_osm:
        features = filter_osm_for_bbox(cong_osm, min_lat, min_lon, max_lat, max_lon)
        osm_layer = draw_osm_layers(satellite.size, tx0, ty0, zoom, features)
        satellite = Image.alpha_composite(satellite.convert("RGBA"), osm_layer).convert("RGB")

    territory = draw_territory_overlay(satellite.size, paths, tx0, ty0, zoom)
    composed = Image.alpha_composite(satellite.convert("RGBA"), territory)
    composed = apply_vignette(composed.convert("RGB"))

    cropped = crop_to_content(composed, paths, tx0, ty0, zoom)
    if cropped.width > target_width:
        ratio = target_width / cropped.width
        cropped = cropped.resize((target_width, int(cropped.height * ratio)), Image.Resampling.LANCZOS)

    final = add_header(
        cropped.convert("RGBA"),
        num,
        name,
        "Satelite Esri + OSM | limite do territorio | render premium",
    )

    out_path = OUT_DIR / f"t{num}.jpg"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    final.convert("RGB").save(out_path, "JPEG", quality=92, optimize=True, progressive=True)
    return out_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Renderiza imagens aprimoradas dos territorios")
    parser.add_argument("--num", nargs="*", help="Numeros dos territorios (ex: 01 07 10)")
    parser.add_argument("--width", type=int, default=1400, help="Largura alvo em pixels")
    parser.add_argument("--zoom", type=int, help="Forcar nivel de zoom")
    parser.add_argument("--skip-osm", action="store_true", help="Somente satelite + limite")
    args = parser.parse_args()

    if not BOUNDARIES_FILE.exists():
        print(f"Arquivo nao encontrado: {BOUNDARIES_FILE.relative_to(ROOT)}", file=sys.stderr)
        return 1

    data = load_boundaries()
    names = load_territory_names()
    targets = args.num or [f"{i:02d}" for i in range(1, 20)]

    print(f"Saida -> {OUT_DIR.relative_to(ROOT)}/")
    cong_osm = None if args.skip_osm else fetch_cong_osm()
    rendered = 0
    for num in targets:
        num = str(num).zfill(2)
        spec = data.get("territories", {}).get(num)
        if not spec:
            print(f"  T{num}: ausente no JSON")
            continue
        paths = normalize_paths(spec.get("paths") or [])
        if not paths:
            print(f"  T{num}: sem poligono")
            continue
        name = spec.get("name") or names.get(num, f"T{num}")
        out = render_territory(num, name, paths, args.width, args.zoom, args.skip_osm, cong_osm)
        print(f"    -> {out.relative_to(ROOT)}")
        rendered += 1

    print(f"\n{rendered} imagem(ns) gerada(s).")
    return 0 if rendered else 1


if __name__ == "__main__":
    raise SystemExit(main())
