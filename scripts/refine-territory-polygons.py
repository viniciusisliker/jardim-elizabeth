#!/usr/bin/env python3
"""Resolve cantos por interseção de ruas (cartões originais) → precise-boundaries.json + KMZ + JPG."""
from __future__ import annotations

import json
import math
import time
import urllib.parse
import urllib.request
import zipfile
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "scripts" / ".geocode-cache-intersections.json"
OUT_BOUNDARIES = ROOT / "maps" / "precise-boundaries.json"
OUT_IMG = ROOT / "img" / "territorios"
OUT_MAPS = ROOT / "maps"
UA = "JardimElizabethTerritoryMaps/1.2"

YELLOW_LINE = (255, 214, 0, 255)
YELLOW_FILL = (255, 214, 0, 70)
LABEL_BG = (0, 32, 96, 220)

# Cantos ordenados (sentido horário) conforme cartões físicos.
# Cada canto = interseção (rua A, rua B).
BOUNDARIES = {
    "01": {
        "name": "Campo Limpo",
        "corners": [
            ("Avenida Carlos Lacerda", "Estrada Pirajussara"),
            ("Estrada Pirajussara", "Rua dos Milagres"),
            ("Rua dos Milagres", "Rua Paul Gauguin"),
            ("Rua Paul Gauguin", "Rua Américo Trabulsi"),
            ("Rua Américo Trabulsi", "Avenida Carlos Lacerda"),
        ],
    },
    "02": {
        "name": "Jardim Elizabeth A",
        "corners": [
            ("Rua José Cabral", "Rua Hermes Ribeiro de Freitas"),
            ("Rua Hermes Ribeiro de Freitas", "Rua Nelson Spilman"),
            ("Rua Nelson Spilman", "Rua Januário da Cunha Barbosa"),
            ("Rua Januário da Cunha Barbosa", "Rua José Cabral"),
            ("Rua José Cabral", "Rua Doutor Zamitti Mammana"),
        ],
    },
    "03": {
        "name": "Jardim Elizabeth B",
        "corners": [
            ("Rua Hermes Ribeiro de Freitas", "Rua Aristides de Britto"),
            ("Rua Aristides de Britto", "Rua Humberto Benemeritti"),
            ("Rua Humberto Benemeritti", "Rua Hermes Ribeiro de Freitas"),
            ("Rua José Cabral", "Rua Hermes Ribeiro de Freitas"),
        ],
    },
    "04": {
        "name": "Jardim Elizabeth C",
        "corners": [
            ("Rua Hermes Ribeiro de Freitas", "Estrada do Campo Limpo"),
            ("Rua Hermes Ribeiro de Freitas", "Rua Aristides de Britto"),
            ("Rua Humberto Benemeritti", "Rua Aristides de Britto"),
            ("Rua Humberto Benemeritti", "Estrada do Campo Limpo"),
        ],
    },
    "05": {
        "name": "Jardim Elizabeth D",
        "corners": [
            ("Rua Januário da Cunha Barbosa", "Rua Piaga"),
            ("Rua Januário da Cunha Barbosa", "Rua Atucupe"),
            ("Rua Atucupe", "Rua Cabaxi"),
            ("Rua Piaga", "Rua Cabaxi"),
        ],
    },
    "06": {
        "name": "Vila Pirajussara",
        "corners": [
            ("Rua Martim da Costa Vilela", "Rua João Correia"),
            ("Rua Martim da Costa Vilela", "Rua Luis Gonzaga Freire"),
            ("Rua Hermes Ribeiro de Freitas", "Rua Luis Gonzaga Freire"),
            ("Rua Hermes Ribeiro de Freitas", "Rua João Correia"),
        ],
    },
    "07": {
        "name": "Jardim Iracema A",
        "corners": [
            ("Rua da Praia de Miramar", "Rua Ramona Baptista Fernandes"),
            ("Rua da Praia de Miramar", "Rua Henrique Moreira"),
            ("Rua Gustavo Doré", "Rua Henrique Moreira"),
            ("Rua Gustavo Doré", "Rua Ramona Baptista Fernandes"),
        ],
    },
    "08": {
        "name": "Jardim Iracema B",
        "corners": [
            ("Avenida Augusto Barreto Tavares", "Rua Ramona Baptista Fernandes"),
            ("Avenida Augusto Barreto Tavares", "Rua Doutor Dib Gebara"),
            ("Rua Gustavo Doré", "Rua Doutor Dib Gebara"),
            ("Rua Gustavo Doré", "Rua Ramona Baptista Fernandes"),
        ],
    },
    "09": {
        "name": "Jardim Helga E",
        "corners": [
            ("Rua Luis Gonzaga Freire", "Rua Nelson Lomanto"),
            ("Rua Nelson Lomanto", "Rua Osvaldo de Arruda Reis"),
            ("Rua Luis Gonzaga Freire", "Rua Osvaldo de Arruda Reis"),
        ],
    },
    "10": {
        "name": "Jd Leônidas Moreira A",
        "corners": [
            ("Rua Atucupe", "Rua Cabaxi"),
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
    "12": {
        "name": "Jd Leônidas Moreira C",
        "corners": [
            ("Avenida Carlos Lacerda", "Rua Tabimã"),
            ("Avenida Carlos Lacerda", "Rua Crestins"),
            ("Rua Ajuruetê", "Rua Crestins"),
            ("Rua Ajuruetê", "Rua Tabimã"),
        ],
    },
    "13": {
        "name": "CDHU A",
        "corners": [("Rua Martim da Costa Vilela", "Conjunto Habitacional CDHU")],
        "box_pad": 0.0014,
        "note": "Blocos 01–29 — subdivisão A; refine no Earth com o cartão satélite",
    },
    "14": {
        "name": "CDHU B",
        "corners": [("Rua Martim da Costa Vilela", "Conjunto Habitacional CDHU")],
        "box_pad": 0.0014,
        "shift": (0.00045, -0.00025),
        "note": "Subdivisão B do CDHU",
    },
    "15": {
        "name": "CDHU C",
        "corners": [("Rua Martim da Costa Vilela", "Conjunto Habitacional CDHU")],
        "box_pad": 0.0014,
        "shift": (0.0009, -0.0005),
        "note": "Subdivisão C do CDHU",
    },
    "16": {
        "name": "Jardim Helga A",
        "corners": [
            ("Rua Luis Gonzaga Freire", "Rua Augusto de Moraes"),
            ("Rua Augusto de Moraes", "Rua Thomaz de Araújo"),
            ("Rua Luis Gonzaga Freire", "Rua Thomaz de Araújo"),
        ],
    },
    "17": {
        "name": "Jardim Helga B",
        "corners": [
            ("Rua Augusto de Moraes", "Rua Thomaz de Araújo"),
            ("Rua Thomaz de Araújo", "Rua Luis Gonzaga Freire"),
            ("Rua Luis Gonzaga Freire", "Rua Augusto de Moraes"),
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


def load_cache():
    if CACHE.exists():
        return json.loads(CACHE.read_text(encoding="utf-8"))
    return {}


def save_cache(cache):
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def http_get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def nominatim(q: str, cache: dict):
    key = q.lower().strip()
    if key in cache:
        return tuple(cache[key]) if cache[key] else None
    params = urllib.parse.urlencode({"q": q, "format": "json", "limit": 1, "countrycodes": "br"})
    try:
        data = json.loads(http_get(f"https://nominatim.openstreetmap.org/search?{params}").decode())
        time.sleep(1.05)
        if not data:
            cache[key] = None
            return None
        lat, lon = float(data[0]["lat"]), float(data[0]["lon"])
        if not (-23.70 < lat < -23.55 and -46.85 < lon < -46.70):
            cache[key] = None
            return None
        cache[key] = [lat, lon]
        return lat, lon
    except Exception as exc:  # noqa: BLE001
        print(f"  geocode fail: {q} ({exc})")
        cache[key] = None
        time.sleep(1.05)
        return None


def resolve_corner(a: str, b: str, cache: dict):
    queries = [
        f"{a} & {b}, São Paulo, SP, Brasil",
        f"{a} e {b}, Campo Limpo, São Paulo, SP",
        f"{a}, {b}, São Paulo, SP",
        f"{a}, Campo Limpo, São Paulo, SP, Brasil",
        f"{b}, Campo Limpo, São Paulo, SP, Brasil",
        f"{a}, São Paulo, SP, Brasil",
        f"{b}, São Paulo, SP, Brasil",
    ]
    for q in queries:
        hit = nominatim(q, cache)
        if hit:
            return hit
    return None


def box_around(points, pad=0.0009):
    lons = [p[0] for p in points]
    lats = [p[1] for p in points]
    return [
        (min(lons) - pad, min(lats) - pad),
        (max(lons) + pad, min(lats) - pad),
        (max(lons) + pad, max(lats) + pad),
        (min(lons) - pad, max(lats) + pad),
    ]


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
                tile = Image.open(BytesIO(http_get(url))).convert("RGB")
                canvas.paste(tile, ((tx - tx0) * 256, (ty - ty0) * 256))
                time.sleep(0.1)
            except Exception as exc:  # noqa: BLE001
                print(f"  tile fail {tx},{ty}: {exc}")
    return canvas, float(tx0), float(ty0), zoom


def project_poly(poly, tx0, ty0, zoom):
    return [((latlon_to_pixel(lat, lon, zoom)[0] - tx0) * 256, (latlon_to_pixel(lat, lon, zoom)[1] - ty0) * 256) for lon, lat in poly]


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
    bar.text((16, 32), note or "Perimetro por intersecoes das ruas do cartao", fill=(200, 210, 230), font=font_s)
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
        desc = f.get("note") or "Cantos = intersecoes das ruas do cartao original"
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
    <name>Jardim Elizabeth — Territorios precisos (intersecoes)</name>
    <description>Poligonos pelos cantos das ruas dos cartoes. CDHU A/B/C ainda exigem ajuste fino no Earth.</description>
    {''.join(placemarks)}
  </Document>
</kml>
"""


def main():
    cache = load_cache()
    features = []
    print("Resolvendo intersecoes das ruas dos cartoes...")
    for num, spec in BOUNDARIES.items():
        print(f"\nT{num} · {spec['name']}")
        pts = []
        for a, b in spec["corners"]:
            hit = resolve_corner(a, b, cache)
            if hit:
                lat, lon = hit
                pts.append((lon, lat))
                print(f"  + {a[:32]} x {b[:32]} ({lat:.5f},{lon:.5f})")
            else:
                print(f"  · miss {a} x {b}")
        save_cache(cache)

        if len(pts) < 3:
            singles = []
            for a, b in spec["corners"]:
                for s in (a, b):
                    hit = nominatim(f"{s}, Campo Limpo, São Paulo, SP, Brasil", cache) or nominatim(
                        f"{s}, São Paulo, SP, Brasil", cache
                    )
                    if hit:
                        singles.append((hit[1], hit[0]))
            save_cache(cache)
            uniq = list(dict.fromkeys(singles))
            if not uniq:
                print("  SKIP")
                continue
            pts = box_around(uniq, pad=spec.get("box_pad", 0.0009))
            print(f"  fallback envelope ({len(uniq)} pontos)")

        ring = []
        for p in pts:
            if not ring or abs(p[0] - ring[-1][0]) > 1e-7 or abs(p[1] - ring[-1][1]) > 1e-7:
                ring.append(p)
        if len(ring) < 3:
            print("  SKIP curto")
            continue
        shift = spec.get("shift")
        if shift:
            ring = [(lon + shift[0], lat + shift[1]) for lon, lat in ring]

        note = spec.get("note") or "Cantos = intersecoes das ruas do cartao"
        feat = {"num": num, "name": spec["name"], "poly": ring, "corners": spec["corners"], "note": note}
        features.append(feat)
        render_jpg(num, spec["name"], ring, note, OUT_IMG / f"t{num}.jpg")

    OUT_BOUNDARIES.write_text(json.dumps(features, ensure_ascii=False, indent=2), encoding="utf-8")
    kml = build_kml(features)
    OUT_MAPS.mkdir(parents=True, exist_ok=True)
    (OUT_MAPS / "jardim-elizabeth-territorios.kml").write_text(kml, encoding="utf-8")
    with zipfile.ZipFile(OUT_MAPS / "jardim-elizabeth-territorios.kmz", "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("doc.kml", kml)
    print(f"\n{len(features)}/19 territorios")
    print(f"KMZ -> {OUT_MAPS / 'jardim-elizabeth-territorios.kmz'}")
    print(f"JSON -> {OUT_BOUNDARIES}")


if __name__ == "__main__":
    main()
