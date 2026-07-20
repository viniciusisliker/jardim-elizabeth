#!/usr/bin/env python3
"""
Gera polígonos aproximados T01–T19 (Nominatim) → KMZ + JPGs para o Hub.

Uso:
  python scripts/generate-territory-maps.py
  python scripts/generate-territory-maps.py --force   # ignora cache

Saídas:
  maps/jardim-elizabeth-territorios.kmz
  img/territorios/tXX.jpg
"""
from __future__ import annotations

import argparse
import json
import math
import re
import time
import urllib.parse
import urllib.request
import zipfile
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CHECKLIST = ROOT / "scripts" / "territory-map-checklist.json"
OUT_IMG = ROOT / "img" / "territorios"
OUT_MAPS = ROOT / "maps"
CACHE = ROOT / "scripts" / ".geocode-cache.json"
USER_AGENT = "JardimElizabethTerritoryMaps/1.0 (congregacao; mapas locais)"

# Âncora Campo Limpo / Jardim Elizabeth (SP capital)
VIEWBOX = "-46.80,-23.66,-46.75,-23.62"  # lon_min,lat_min,lon_max,lat_max
YELLOW_LINE = (255, 214, 0, 255)
YELLOW_FILL = (255, 214, 0, 70)
LABEL_BG = (0, 32, 96, 220)

SKIP_STREETS = {
    "viela",
    "viela 2",
    "viela 3",
    "viela 4",
    "viela quatro",
    "passarela 1",
    "passagem 1",
    "passagem 2",
    "cdhu",
    "conjunto habitacional cdhu",
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def http_get(url: str, timeout=30) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def expand_street(name: str) -> str:
    s = name.strip()
    s = re.sub(r"^R\.\s*", "Rua ", s, flags=re.I)
    s = re.sub(r"^Av\.\s*", "Avenida ", s, flags=re.I)
    s = re.sub(r"^Estr\.\s*", "Estrada ", s, flags=re.I)
    s = re.sub(r"^Trav\.\s*", "Travessa ", s, flags=re.I)
    s = re.sub(r"^Cel\.\s*", "Coronel ", s, flags=re.I)
    s = re.sub(r"^Dr\.\s*", "Doutor ", s, flags=re.I)
    # aliases conhecidos
    aliases = {
        "Rua Zamitti Mammana": "Rua Doutor Zamitti Mammana",
        "Rua Gustave Doré": "Rua Gustavo Doré",
        "Rua Gustavo Doré": "Rua Gustavo Doré",
        "Rua Coronel José Hypolito": "Rua Coronel José Hypólito Trigueirinho",
        "Coronel José Hipólito Trigueirinho": "Rua Coronel José Hypólito Trigueirinho",
        "Rua Atucupê": "Rua Atucupe",
        "Rua Paul Gauguim": "Rua Paul Gauguin",
    }
    return aliases.get(s, s)


def geocode(query: str, cache: dict) -> tuple[float, float] | None:
    key = query.strip().lower()
    if key in cache:
        return tuple(cache[key]) if cache[key] else None
    params = urllib.parse.urlencode(
        {
            "q": query,
            "format": "json",
            "limit": 1,
            "countrycodes": "br",
            "viewbox": VIEWBOX,
            "bounded": 0,
        }
    )
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    try:
        raw = http_get(url)
        data = json.loads(raw.decode("utf-8"))
        if not data:
            cache[key] = None
            time.sleep(1.05)
            return None
        lat, lon = float(data[0]["lat"]), float(data[0]["lon"])
        # discard far hits (outside SP capital-ish)
        if not (-23.70 < lat < -23.55 and -46.85 < lon < -46.70):
            cache[key] = None
            time.sleep(1.05)
            return None
        cache[key] = [lat, lon]
        time.sleep(1.05)
        return lat, lon
    except Exception as exc:  # noqa: BLE001
        print(f"  geocode fail: {query} ({exc})")
        cache[key] = None
        time.sleep(1.05)
        return None


def geocode_street(street: str, cache: dict) -> tuple[float, float] | None:
    if street.strip().lower() in SKIP_STREETS:
        return None
    expanded = expand_street(street)
    # drop trailing initials like "Francisco H." → try without
    candidates = [
        f"{expanded}, Campo Limpo, São Paulo, SP, Brasil",
        f"{expanded}, São Paulo, SP, Brasil",
        f"{expanded}, Vila Pirajussara, São Paulo, SP, Brasil",
        f"{expanded}, Jardim Helga, São Paulo, SP, Brasil",
        f"{expanded}, Jardim Iracema, São Paulo, SP, Brasil",
    ]
    # shorten abbreviated last names: "Rua Francisco H." → skip if still has single letter
    if re.search(r"\b[A-Z]\.?$", expanded):
        short = re.sub(r"\s+[A-Z]\.?$", "", expanded)
        candidates.insert(0, f"{short}, Campo Limpo, São Paulo, SP, Brasil")
    for q in candidates:
        hit = geocode(q, cache)
        if hit:
            return hit
    return None


def convex_hull(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    pts = sorted(set(points))
    if len(pts) <= 2:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def expand_hull(hull: list[tuple[float, float]], meters: float = 80) -> list[tuple[float, float]]:
    if len(hull) < 3:
        return hull
    cx = sum(p[0] for p in hull) / len(hull)
    cy = sum(p[1] for p in hull) / len(hull)
    dlon = meters / (111320 * math.cos(math.radians(cy)))
    dlat = meters / 110540
    out = []
    for lon, lat in hull:
        vx, vy = lon - cx, lat - cy
        n = math.hypot(vx, vy) or 1e-9
        out.append((lon + vx / n * dlon, lat + vy / n * dlat))
    return out


def box_around(points: list[tuple[float, float]], pad=0.0009):
    lons = [p[0] for p in points]
    lats = [p[1] for p in points]
    min_lon, max_lon = min(lons) - pad, max(lons) + pad
    min_lat, max_lat = min(lats) - pad, max(lats) + pad
    return [
        (min_lon, min_lat),
        (max_lon, min_lat),
        (max_lon, max_lat),
        (min_lon, max_lat),
    ]


def latlon_to_pixel(lat, lon, z):
    n = 2.0**z
    x = (lon + 180.0) / 360.0 * n
    lat_r = math.radians(lat)
    y = (1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n
    return x, y


def fetch_tiles(min_lat, min_lon, max_lat, max_lon, zoom=17) -> tuple[Image.Image, float, float, int]:
    x0, y1 = latlon_to_pixel(min_lat, min_lon, zoom)
    x1, y0 = latlon_to_pixel(max_lat, max_lon, zoom)
    tx0, ty0 = int(math.floor(x0)) - 1, int(math.floor(y0)) - 1
    tx1, ty1 = int(math.floor(x1)) + 1, int(math.floor(y1)) + 1
    w = (tx1 - tx0 + 1) * 256
    h = (ty1 - ty0 + 1) * 256
    canvas = Image.new("RGB", (w, h), (230, 230, 230))
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            url = f"https://tile.openstreetmap.org/{zoom}/{tx}/{ty}.png"
            try:
                tile = Image.open(BytesIO(http_get(url))).convert("RGB")
                canvas.paste(tile, ((tx - tx0) * 256, (ty - ty0) * 256))
                time.sleep(0.12)
            except Exception as exc:  # noqa: BLE001
                print(f"  tile fail {tx},{ty}: {exc}")
    return canvas, float(tx0), float(ty0), zoom


def project_poly(poly, tx0, ty0, zoom):
    pts = []
    for lon, lat in poly:
        x, y = latlon_to_pixel(lat, lon, zoom)
        pts.append(((x - tx0) * 256, (y - ty0) * 256))
    return pts


def render_jpg(num: str, name: str, poly: list[tuple[float, float]], out_path: Path):
    lons = [p[0] for p in poly]
    lats = [p[1] for p in poly]
    pad = 0.0012
    min_lon, max_lon = min(lons) - pad, max(lons) + pad
    min_lat, max_lat = min(lats) - pad, max(lats) + pad
    img, tx0, ty0, zoom = fetch_tiles(min_lat, min_lon, max_lat, max_lon, zoom=17)
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    pix = project_poly(poly, tx0, ty0, zoom)
    if len(pix) >= 3:
        draw.polygon(pix, fill=YELLOW_FILL, outline=YELLOW_LINE)
        draw.line(pix + [pix[0]], fill=YELLOW_LINE, width=4)
    base = img.convert("RGBA")
    composed = Image.alpha_composite(base, overlay)

    bar_h = 48
    out = Image.new("RGBA", (composed.width, composed.height + bar_h), (255, 255, 255, 255))
    out.paste(composed, (0, bar_h))
    bar = ImageDraw.Draw(out)
    bar.rectangle([0, 0, out.width, bar_h], fill=LABEL_BG)
    try:
        font = ImageFont.truetype("arial.ttf", 22)
        font_s = ImageFont.truetype("arial.ttf", 14)
    except OSError:
        font = ImageFont.load_default()
        font_s = font
    bar.text((16, 8), f"T{num} · {name}", fill=(255, 255, 255), font=font)
    bar.text((16, 32), "Jardim Elizabeth · perimetro aproximado (revise no Earth)", fill=(200, 210, 230), font=font_s)

    target_w = 1200
    if out.width > target_w:
        ratio = target_w / out.width
        out = out.resize((target_w, int(out.height * ratio)), Image.Resampling.LANCZOS)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.convert("RGB").save(out_path, "JPEG", quality=85, optimize=True)
    print(f"  JPG -> {out_path.relative_to(ROOT)}")


def kml_color_abgr(a, b, g, r):
    return f"{a:02x}{b:02x}{g:02x}{r:02x}"


def build_kml(features: list[dict]) -> str:
    placemarks = []
    for f in features:
        coords = " ".join(f"{lon},{lat},0" for lon, lat in f["poly"])
        lon0, lat0 = f["poly"][0]
        coords = coords + f" {lon0},{lat0},0"
        placemarks.append(
            f"""
    <Placemark>
      <name>T{f['num']} - {f['name']}</name>
      <description><![CDATA[Ruas: {', '.join(f['streets'])}]]></description>
      <Style>
        <LineStyle><color>{kml_color_abgr(255, 0, 214, 255)}</color><width>3.5</width></LineStyle>
        <PolyStyle><color>{kml_color_abgr(70, 0, 214, 255)}</color></PolyStyle>
      </Style>
      <Polygon>
        <outerBoundaryIs><LinearRing><coordinates>{coords}</coordinates></LinearRing></outerBoundaryIs>
      </Polygon>
    </Placemark>"""
        )
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Jardim Elizabeth — Territorios T01–T19</name>
    <description>Poligonos aproximados. Importe no Google Earth e ajuste com o cartao fisico.</description>
    {''.join(placemarks)}
  </Document>
</kml>
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Ignora cache de geocode")
    args = parser.parse_args()

    data = load_json(CHECKLIST)
    cache = {} if args.force or not CACHE.exists() else load_json(CACHE)
    features = []

    print("Geocodificando ruas (Nominatim)...")
    for t in data["territories"]:
        num, name = t["num"], t["name"]
        print(f"\nT{num} · {name}")
        pts: list[tuple[float, float]] = []

        # mapsQuery: expand abbreviations inside
        mq = expand_street(t["mapsQuery"].split(",")[0]) if " e " not in t["mapsQuery"] else t["mapsQuery"]
        # try each side of "e"
        parts = re.split(r"\s+e\s+", t["mapsQuery"].split(",")[0], flags=re.I)
        for part in parts:
            hit = geocode_street(part.strip(), cache)
            if hit:
                pts.append((hit[1], hit[0]))
                print(f"  + maps:{part.strip()}")

        for street in t["streets"]:
            # CDHU: usar a rua de entrada
            clean = re.sub(r"\s*\([^)]*\)\s*", " ", street).strip()
            hit = geocode_street(clean, cache)
            if hit:
                pts.append((hit[1], hit[0]))
                print(f"  + {street}")
            else:
                print(f"  · miss {street}")
        # fallback CDHU
        if num in ("13", "14", "15") and not pts:
            hit = geocode_street("Rua Martim da Costa Vilela", cache) or geocode(
                "CDHU Campo Limpo, São Paulo, SP, Brasil", cache
            )
            if hit:
                pts.append((hit[1], hit[0]))
                print("  + fallback CDHU / Martim da Costa Vilela")
        save_json(CACHE, cache)

        # unique points
        uniq = list(dict.fromkeys(pts))
        if len(uniq) < 1:
            print("  SKIP — sem pontos")
            continue
        if len(uniq) == 1:
            hull = box_around(uniq, pad=0.001)
        elif len(uniq) == 2:
            hull = box_around(uniq, pad=0.0007)
        else:
            hull = convex_hull(uniq)
            if len(hull) < 3:
                hull = box_around(uniq, pad=0.0007)
            else:
                hull = expand_hull(hull, meters=70)

        if num in ("14", "15") and len(hull) >= 3:
            shift = 0.00035 if num == "14" else 0.0007
            hull = [(lon + shift, lat - shift * 0.5) for lon, lat in hull]

        features.append({"num": num, "name": name, "streets": t["streets"], "poly": hull})
        render_jpg(num, name, hull, OUT_IMG / f"t{num}.jpg")

    OUT_MAPS.mkdir(parents=True, exist_ok=True)
    kml = build_kml(features)
    kml_path = OUT_MAPS / "jardim-elizabeth-territorios.kml"
    kmz_path = OUT_MAPS / "jardim-elizabeth-territorios.kmz"
    kml_path.write_text(kml, encoding="utf-8")
    with zipfile.ZipFile(kmz_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("doc.kml", kml)
    print(f"\nKMZ -> {kmz_path.relative_to(ROOT)}")
    print(f"KML -> {kml_path.relative_to(ROOT)}")
    print(f"Territorios gerados: {len(features)}/{len(data['territories'])}")
    print("Google Earth Chrome: File > Open > maps/jardim-elizabeth-territorios.kmz")


if __name__ == "__main__":
    main()
