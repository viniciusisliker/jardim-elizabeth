#!/usr/bin/env python3
"""Completa polígonos faltantes (T06,T10,T11,T18,T19) via OSM + re-render."""
from __future__ import annotations

import json
import math
import ssl
import time
import urllib.parse
import urllib.request
import zipfile
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BOUNDARIES_FILE = ROOT / "maps" / "precise-boundaries.json"
KML_FILE = ROOT / "maps" / "jardim-elizabeth-territorios.kml"
KMZ_FILE = ROOT / "maps" / "jardim-elizabeth-territorios.kmz"
OUT_IMG = ROOT / "img" / "territorios"
OSM_CACHE = ROOT / "maps" / "osm-streets-by-name.json"
BBOX = "-23.655,-46.790,-23.620,-46.750"
UA = "JardimElizabethTerritoryMaps/1.4"
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

YELLOW_LINE = (255, 214, 0, 255)
YELLOW_FILL = (255, 214, 0, 70)
LABEL_BG = (0, 32, 96, 220)

MISSING = {
    "06": {
        "name": "Vila Pirajussara",
        "corners": [
            ("Rua Martim da Costa Vilela", "Rua João Correia"),
            ("Rua Martim da Costa Vilela", "Passagem 2"),
            ("Rua Hermes Ribeiro de Freitas", "Passagem 2"),
            ("Rua Hermes Ribeiro de Freitas", "Rua João Correia"),
        ],
    },
    "10": {
        "name": "Jd Leônidas Moreira A",
        "corners": [
            ("Rua Atucupe", "Rua Piaga"),
            ("Rua Atucupe", "Rua Mitim"),
            ("Rua Cabaxi", "Rua Piaga"),
            ("Rua Cabaxi", "Rua Mitim"),
        ],
    },
    "11": {
        "name": "Jd Leônidas Moreira B",
        "corners": [
            ("Avenida Carlos Lacerda", "Rua Cabaxi"),
            ("Avenida Carlos Lacerda", "Rua Amacás"),
            ("Rua Tabimã", "Rua Amacás"),
            ("Rua Tabimã", "Rua Cabaxi"),
        ],
    },
    "18": {
        "name": "Jardim Helga C",
        "corners": [
            ("Rua Guerreiro", "Rua Thomaz de Araújo"),
            ("Rua Guerreiro", "Rua Luisa Damon"),
            ("Rua Luis Maria Ridel", "Rua Thomaz de Araújo"),
            ("Rua Luis Maria Ridel", "Rua Luisa Damon"),
        ],
    },
    "19": {
        "name": "Jardim Helga D",
        "corners": [
            ("Rua Mitim", "Rua Guerreiro"),
            ("Rua Mitim", "Rua Ibi"),
            ("Rua Luisa Damon", "Rua Guerreiro"),
            ("Rua Luisa Damon", "Rua Ibi"),
        ],
    },
}

STREET_ALIASES = {
    "Rua Atucupe": ["Rua Atucupe", "Rua Atucupê"],
    "Rua Luis Gonzaga Freire": ["Rua Luis Gonzaga Freire", "Rua Luís Gonzaga Freire"],
    "Passagem 2": ["Passagem 2", "Passagem Dois", "Passagem Três"],
    "Rua Ibi": ["Rua Ibi", "Avenida Ibi"],
    "Rua Luisa Damon": ["Rua Luisa Damon", "Rua Luiza Damon"],
}

# Polígonos calculados via OSM quando ruas não cruzam no geocoder (lon, lat).
MANUAL_FALLBACK = {
    "06": {
        "name": "Vila Pirajussara",
        "poly": [
            [-46.77393, -23.63850],
            [-46.77313, -23.64035],
            [-46.77342, -23.64043],
            [-46.77414, -23.63877],
        ],
        "note": "Perimetro OSM: Martim/Hermes x Joao Correia/Passagem Tres",
    },
    "18": {
        "name": "Jardim Helga C",
        "poly": [
            [-46.77349, -23.64614],
            [-46.77343, -23.64438],
            [-46.77396, -23.64573],
            [-46.77260, -23.64644],
        ],
        "note": "Perimetro OSM: Guerreiro/Ridel x Thomaz (Luisa Damon ausente no OSM)",
    },
    "19": {
        "name": "Jardim Helga D",
        "poly": [
            [-46.77537, -23.64344],
            [-46.77596, -23.64276],
            [-46.77575, -23.64429],
            [-46.77448, -23.64482],
        ],
        "note": "Perimetro OSM: Mitim/Guerreiro x Avenida Ibi",
    },
}


def http_get(url: str, data: bytes | None = None) -> bytes:
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120, context=SSL_CTX) as resp:
        return resp.read()


def fetch_all_streets_bbox() -> dict:
    q = f"""
[out:json][timeout:120];
(
  way["highway"]["name"]({BBOX});
);
out geom;
"""
    data = urllib.parse.urlencode({"data": q}).encode()
    payload = json.loads(http_get("https://overpass-api.de/api/interpreter", data).decode())
    db: dict[str, list] = {}
    for w in payload.get("elements", []):
        name = (w.get("tags") or {}).get("name")
        geom = w.get("geometry") or []
        if not name or len(geom) < 2:
            continue
        coords = [[p["lon"], p["lat"]] for p in geom]
        db.setdefault(name, []).append(coords)
    return db


def normalize_name(name: str) -> str:
    return name.lower().replace("á", "a").replace("ã", "a").replace("â", "a").replace("é", "e").replace("ê", "e").replace("í", "i").replace("ó", "o").replace("ô", "o").replace("ú", "u").replace("ç", "c")


def lookup_street(db: dict, name: str) -> list[list[list[float]]]:
    aliases = STREET_ALIASES.get(name, [name])
    for alias in aliases:
        if alias in db:
            return db[alias]
    target = normalize_name(name)
    for key, ways in db.items():
        if normalize_name(key) == target:
            return ways
    for key, ways in db.items():
        nk = normalize_name(key)
        if target in nk or nk in target:
            return ways
    return []


def load_osm_db() -> dict:
    if OSM_CACHE.exists():
        cached = json.loads(OSM_CACHE.read_text(encoding="utf-8"))
        if len(cached) >= 10:
            return cached
    print("  Overpass bbox (1 request)…")
    db = fetch_all_streets_bbox()
    print(f"  {len(db)} nomes OSM")
    OSM_CACHE.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")
    return db


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def street_points(db: dict, name: str) -> list[tuple[float, float]]:
    pts = []
    for way in lookup_street(db, name):
        pts.extend((lon, lat) for lon, lat in way)
    return pts


def corner_from_osm(db: dict, a: str, b: str):
    pa, pb = street_points(db, a), street_points(db, b)
    if not pa or not pb:
        return None
    best = None
    best_d = 1e9
    for x in pa:
        for y in pb:
            d = dist(x, y)
            if d < best_d:
                best_d = d
                best = ((x[0] + y[0]) / 2, (x[1] + y[1]) / 2)
    if best and best_d < 0.006:
        return best
    return None


def dedupe_ring(ring: list[tuple[float, float]]):
    out = []
    for p in ring:
        if not out or dist(p, out[-1]) > 1e-6:
            out.append(p)
    return out if len(out) >= 3 else None


def latlon_to_pixel(lat, lon, z):
    n = 2.0**z
    x = (lon + 180.0) / 360.0 * n
    lat_r = math.radians(lat)
    y = (1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n
    return x, y


def fetch_tiles(min_lat, min_lon, max_lat, max_lon, zoom=17):
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
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                tile = Image.open(BytesIO(urllib.request.urlopen(req, timeout=60).read())).convert("RGB")
                canvas.paste(tile, ((tx - tx0) * 256, (ty - ty0) * 256))
                time.sleep(0.08)
            except Exception as exc:  # noqa: BLE001
                print(f"  tile fail: {exc}")
    return canvas, float(tx0), float(ty0), zoom


def project_poly(poly, tx0, ty0, zoom):
    return [
        ((latlon_to_pixel(lat, lon, zoom)[0] - tx0) * 256, (latlon_to_pixel(lat, lon, zoom)[1] - ty0) * 256)
        for lon, lat in poly
    ]


def render_jpg(num, name, poly, note, out_path: Path):
    lons = [p[0] for p in poly]
    lats = [p[1] for p in poly]
    pad = 0.0009
    img, tx0, ty0, zoom = fetch_tiles(min(lats) - pad, min(lons) - pad, max(lats) + pad, max(lons) + pad)
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    pix = project_poly(poly, tx0, ty0, zoom)
    if len(pix) >= 3:
        draw.polygon(pix, fill=YELLOW_FILL, outline=YELLOW_LINE)
        draw.line(pix + [pix[0]], fill=YELLOW_LINE, width=5)
    composed = Image.alpha_composite(img.convert("RGBA"), overlay)
    bar_h = 52
    out = Image.new("RGBA", (composed.width, composed.height + bar_h), (255, 255, 255, 255))
    out.paste(composed, (0, bar_h))
    bar = ImageDraw.Draw(out)
    bar.rectangle([0, 0, out.width, bar_h], fill=LABEL_BG)
    try:
        font = ImageFont.truetype("arial.ttf", 22)
        font_s = ImageFont.truetype("arial.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
        font_s = font
    bar.text((16, 8), f"T{num} · {name}", fill=(255, 255, 255), font=font)
    bar.text((16, 32), note, fill=(200, 210, 230), font=font_s)
    if out.width > 1200:
        ratio = 1200 / out.width
        out = out.resize((1200, int(out.height * ratio)), Image.Resampling.LANCZOS)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.convert("RGB").save(out_path, "JPEG", quality=88, optimize=True)
    print(f"  JPG -> {out_path.relative_to(ROOT)}")


def build_kml(features):
    placemarks = []
    for f in features:
        coords = " ".join(f"{lon},{lat},0" for lon, lat in f["poly"])
        lon0, lat0 = f["poly"][0]
        coords += f" {lon0},{lat0},0"
        desc = f.get("note") or "Perimetro por intersecoes"
        placemarks.append(
            f"""
    <Placemark>
      <name>T{f['num']} - {f['name']}</name>
      <description><![CDATA[{desc}]]></description>
      <Style>
        <LineStyle><color>ff00d6ff</color><width>3.5</width></LineStyle>
        <PolyStyle><color>4600d6ff</color></PolyStyle>
      </Style>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>{coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>
    </Placemark>"""
        )
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Jardim Elizabeth — Territorios precisos</name>
    {''.join(placemarks)}
  </Document>
</kml>
"""


def main():
    existing = json.loads(BOUNDARIES_FILE.read_text(encoding="utf-8"))
    by_num = {f["num"]: f for f in existing}
    print("Baixando geometrias OSM…")
    db = load_osm_db()

    for num, spec in MISSING.items():
        print(f"\nT{num} · {spec['name']}")
        ring = []
        for a, b in spec["corners"]:
            hit = corner_from_osm(db, a, b)
            if hit:
                ring.append(hit)
                print(f"  + {a[:28]} x {b[:28]} ({hit[1]:.5f},{hit[0]:.5f})")
            else:
                print(f"  · miss {a} x {b}")
        ring = dedupe_ring(ring)
        if not ring and num in MANUAL_FALLBACK:
            fb = MANUAL_FALLBACK[num]
            ring = [tuple(p) for p in fb["poly"]]
            note = fb["note"]
            print(f"  fallback manual ({len(ring)} cantos)")
        elif not ring:
            print("  SKIP")
            continue
        else:
            note = "Perimetro por intersecoes OSM das ruas do cartao"
        feat = {"num": num, "name": spec["name"], "poly": ring, "corners": spec["corners"], "note": note}
        by_num[num] = feat
        render_jpg(num, spec["name"], ring, note, OUT_IMG / f"t{num}.jpg")

    features = [by_num[n] for n in sorted(by_num.keys(), key=lambda x: int(x))]
    BOUNDARIES_FILE.write_text(json.dumps(features, ensure_ascii=False, indent=2), encoding="utf-8")
    kml = build_kml(features)
    KML_FILE.write_text(kml, encoding="utf-8")
    with zipfile.ZipFile(KMZ_FILE, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("doc.kml", kml)
    print(f"\n{len(features)}/19 territorios em precise-boundaries.json")


if __name__ == "__main__":
    main()
