#!/usr/bin/env python3
"""
Reconstrói polígonos T01–T19 a partir de interseções reais OSM (sem Nominatim).

Entrada: maps/osm-streets-by-name.json
Saída:   maps/precise-boundaries.json
         maps/jardim-elizabeth-territorios.kml / .kmz
         maps/territorios/tXX.kml / .kmz
         img/territorios/tXX.jpg  (prévia — NÃO substitui cartões físicos)

Uso:
  python scripts/rebuild-territory-polygons.py
  python scripts/rebuild-territory-polygons.py --no-jpg
"""
from __future__ import annotations

import argparse
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
OSM_FILE = ROOT / "maps" / "osm-streets-by-name.json"
OUT_JSON = ROOT / "maps" / "precise-boundaries.json"
OUT_MAPS = ROOT / "maps"
OUT_TERR = OUT_MAPS / "territorios"
OUT_IMG = ROOT / "img" / "territorios"
BBOX = "-23.655,-46.790,-23.620,-46.750"
UA = "JardimElizabethTerritoryMaps/2.0"
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

YELLOW_LINE = (255, 214, 0, 255)
YELLOW_FILL = (255, 214, 0, 70)
LABEL_BG = (0, 32, 96, 220)

# Centro aproximado da congregação (Campo Limpo / Jardim Elizabeth)
CONG_CENTER = (-23.6385, -46.7745)  # lat, lon

# Aliases: nome no cartão → nomes OSM possíveis (ordem de preferência)
STREET_ALIASES: dict[str, list[str]] = {
    "Estrada Pirajussara": ["Estrada Pirajussara - Valo Velho", "Estrada Pirajussara"],
    "Avenida Carlos Lacerda": ["Avenida Carlos Lacerda"],
    "Rua Américo Trabulsi": ["Rua Américo Trabulsi"],
    "Travessa Nair Rodrigues Pereira": ["Travessa Nair Rodrigues Pereira"],
    "Trav. Nair R. Perez": ["Travessa Nair Rodrigues Pereira"],
    "Rua Carlino Camperlingo": ["Rua Carlino Camperlingo"],
    "Trav. Carlino C.": ["Rua Carlino Camperlingo"],
    "Rua Hermes Ribeiro de Freitas": ["Rua Hermes Ribeiro de Freitas"],
    "Rua José Cabral": ["Rua José Cabral"],
    "Rua Januário da Cunha Barbosa": ["Rua Januário da Cunha Barbosa"],
    "Rua Nelson Spilman": ["Rua Nelson Spielman", "Rua Nelson Spilman"],
    "Rua Doutor Zamitti Mammana": ["Rua Doutor Zamitti Mammana"],
    "Rua Humberto Benemeritti": ["Rua Humberto Benemeriti", "Rua Humberto Benemeritti"],
    "Rua Aristides de Britto": ["Rua Aristides de Britto"],
    "Rua Aristides de Brito": ["Rua Aristides de Britto"],
    "Estrada do Campo Limpo": ["Estrada do Campo Limpo", "Acesso a Estrada do Campo Limpo"],
    "Rua Piaga": ["Rua Piaga"],
    "Rua Atucupe": ["Rua Atucupê", "Rua Atucupe"],
    "Rua Atucupê": ["Rua Atucupê", "Rua Atucupe"],
    "Rua Cabaxi": ["Rua Cabaxi"],
    "Rua Mitim": ["Rua Mitim"],
    "Rua Taunã": ["Rua Taunã"],
    "Rua Martim da Costa Vilela": ["Rua Martim da Costa Vilela"],
    "Rua João Correia": ["Rua João Correia"],
    "Rua Luis Gonzaga Freire": ["Rua Luis Gonzaga Freire", "Rua Luís Gonzaga Freire"],
    "Passagem 2": ["Passagem Três", "Passagem 2"],
    "Passagem 1": ["Passagem da Confraternização", "Passagem 1"],
    "Rua da Praia de Miramar": ["Rua Praia de Miramar", "Rua da Praia de Miramar"],
    "Rua Ramona Baptista Fernandes": ["Rua Ramona Barroso Fernandez", "Rua Ramona Baptista Fernandes"],
    "Rua Gustavo Doré": ["Rua Gustave Dore", "Rua Gustavo Doré"],
    "Rua Gustave Doré": ["Rua Gustave Dore", "Rua Gustavo Doré"],
    "Avenida Augusto Barreto Tavares": ["Avenida Augusto Barbosa Tavares", "Avenida Augusto Barreto Tavares"],
    "Rua Doutor Dib Gebara": ["Rua Doutor Dib Gebara"],
    "Rua Nelson Lomanto": ["Rua Nelson Lomanto", "Rua Nélson Lomanto"],
    "Rua Osvaldo de Arruda Reis": ["Rua Osvaldo de Arruda Reis"],
    "Rua Tabimã": ["Rua Tabima", "Rua Tabimã"],
    "Rua Amacás": ["Rua Amacás", "Rua Amacas"],
    "Rua Ajuruetê": ["Rua Ajurueta", "Rua Ajuruetê"],
    "Rua Crestins": ["Rua Crestins"],
    "Rua Augusto de Moraes": ["Rua Augusto de Moraes"],
    "Rua Thomaz de Araújo": ["Rua Thomaz de Araújo"],
    "Rua Guerreiro": ["Rua Guerreiro"],
    "Rua Luisa Damon": ["Rua Luisa Damon", "Rua Luiza Damon"],
    "Rua Luis Maria Ridel": ["Rua Luis Maria Ridel"],
    "Rua Ibi": ["Avenida Ibi", "Rua Ibi"],
    "Rua Benedito de Oliveira": ["Rua Benedito de Oliveira", "Estrada Benedito Cesário de Oliveira"],
    "Rua dos Milagres": ["Rua dos Milagres"],
    "Rua Paul Gauguin": ["Rua Paul Gauguin"],
    "R. Paul Gauguim": ["Rua Paul Gauguin"],
    "R. Francisco H.": ["Rua Francisco de Herrera"],
    "Rua Francisco de Herrera": ["Rua Francisco de Herrera"],
    "Rua Louis Brea": ["Rua Louis Brea"],
    "Rua Taunã": ["Rua Taunã"],
}

# Perímetros: cantos = interseção (rua A, rua B) em sentido horário.
# anchor = (lat, lon) para desambiguar quando há várias interseções.
TERRITORIES: dict[str, dict] = {
    "01": {
        "name": "Campo Limpo",
        "anchor": (-23.6378, -46.7785),
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
        "anchor": (-23.6390, -46.7765),
        "corners": [
            ("Rua José Cabral", "Rua Hermes Ribeiro de Freitas"),
            ("Rua Hermes Ribeiro de Freitas", "Rua Januário da Cunha Barbosa"),
            ("Rua Januário da Cunha Barbosa", "Rua José Cabral"),
            ("Rua José Cabral", "Rua Humberto Benemeritti"),
        ],
    },
    "03": {
        "name": "Jardim Elizabeth B",
        "anchor": (-23.6388, -46.7755),
        "corners": [
            ("Rua Hermes Ribeiro de Freitas", "Rua Aristides de Britto"),
            ("Rua Aristides de Britto", "Rua Humberto Benemeritti"),
            ("Rua Humberto Benemeritti", "Rua Januário da Cunha Barbosa"),
            ("Rua Januário da Cunha Barbosa", "Rua Hermes Ribeiro de Freitas"),
        ],
    },
    "04": {
        "name": "Jardim Elizabeth C",
        "anchor": (-23.6395, -46.7740),
        "corners": [
            ("Rua Hermes Ribeiro de Freitas", "Estrada do Campo Limpo"),
            ("Rua Hermes Ribeiro de Freitas", "Rua Aristides de Britto"),
            ("Rua Humberto Benemeritti", "Rua Aristides de Britto"),
            ("Rua Humberto Benemeritti", "Estrada do Campo Limpo"),
        ],
    },
    "05": {
        "name": "Jardim Elizabeth D",
        "anchor": (-23.6405, -46.7760),
        "corners": [
            ("Rua Januário da Cunha Barbosa", "Rua Piaga"),
            ("Rua Piaga", "Rua Taunã"),
            ("Rua Taunã", "Rua Cabaxi"),
            ("Rua Cabaxi", "Rua Atucupe"),
            ("Rua Atucupe", "Rua Januário da Cunha Barbosa"),
        ],
    },
    "06": {
        "name": "Vila Pirajussara",
        "anchor": (-23.6395, -46.7738),
        "corners": [
            ("Rua Martim da Costa Vilela", "Rua João Correia"),
            ("Rua Martim da Costa Vilela", "Passagem 2"),
            ("Rua Hermes Ribeiro de Freitas", "Passagem 2"),
            ("Rua Hermes Ribeiro de Freitas", "Rua João Correia"),
        ],
    },
    "07": {
        "name": "Jardim Iracema A",
        "anchor": (-23.6410, -46.7720),
        "corners": [
            ("Rua da Praia de Miramar", "Rua Ramona Baptista Fernandes"),
            ("Rua da Praia de Miramar", "Rua Gustavo Doré"),
            ("Rua Gustavo Doré", "Rua Ramona Baptista Fernandes"),
        ],
    },
    "08": {
        "name": "Jardim Iracema B",
        "anchor": (-23.6415, -46.7705),
        "corners": [
            ("Avenida Augusto Barreto Tavares", "Rua Ramona Baptista Fernandes"),
            ("Avenida Augusto Barreto Tavares", "Rua Doutor Dib Gebara"),
            ("Rua Gustavo Doré", "Rua Doutor Dib Gebara"),
            ("Rua Gustavo Doré", "Rua Ramona Baptista Fernandes"),
        ],
    },
    "09": {
        "name": "Jardim Helga E",
        "anchor": (-23.6400, -46.7735),
        "corners": [
            ("Rua Luis Gonzaga Freire", "Rua Nelson Lomanto"),
            ("Rua Nelson Lomanto", "Rua Osvaldo de Arruda Reis"),
            ("Rua Luis Gonzaga Freire", "Rua Osvaldo de Arruda Reis"),
        ],
    },
    "10": {
        "name": "Jd Leônidas Moreira A",
        "anchor": (-23.6418, -46.7768),
        "corners": [
            ("Rua Atucupe", "Rua Piaga"),
            ("Rua Atucupe", "Rua Mitim"),
            ("Rua Cabaxi", "Rua Piaga"),
            ("Rua Cabaxi", "Rua Mitim"),
        ],
    },
    "11": {
        "name": "Jd Leônidas Moreira B",
        "anchor": (-23.6430, -46.7775),
        "corners": [
            ("Avenida Carlos Lacerda", "Rua Cabaxi"),
            ("Avenida Carlos Lacerda", "Rua Amacás"),
            ("Rua Tabimã", "Rua Amacás"),
            ("Rua Tabimã", "Rua Cabaxi"),
        ],
    },
    "12": {
        "name": "Jd Leônidas Moreira C",
        "anchor": (-23.6440, -46.7760),
        "corners": [
            ("Avenida Carlos Lacerda", "Rua Tabimã"),
            ("Avenida Carlos Lacerda", "Rua Crestins"),
            ("Rua Ajuruetê", "Rua Crestins"),
            ("Rua Ajuruetê", "Rua Tabimã"),
        ],
    },
    "16": {
        "name": "Jardim Helga A",
        "anchor": (-23.6425, -46.7745),
        "corners": [
            ("Rua Luis Gonzaga Freire", "Rua Augusto de Moraes"),
            ("Rua Augusto de Moraes", "Rua Thomaz de Araújo"),
            ("Rua Luis Gonzaga Freire", "Rua Thomaz de Araújo"),
        ],
    },
    "17": {
        "name": "Jardim Helga B",
        "anchor": (-23.6435, -46.7740),
        "corners": [
            ("Rua Augusto de Moraes", "Rua Thomaz de Araújo"),
            ("Rua Thomaz de Araújo", "Rua Luis Gonzaga Freire"),
            ("Rua Luis Gonzaga Freire", "Rua Augusto de Moraes"),
        ],
    },
    "18": {
        "name": "Jardim Helga C",
        "anchor": (-23.6455, -46.7735),
        "manual": [
            [-46.77349, -23.64614],
            [-46.77343, -23.64438],
            [-46.77396, -23.64573],
            [-46.77260, -23.64644],
        ],
        "note": "OSM: Guerreiro/Ridel x Thomaz (Rua Luisa Damon ausente no OSM)",
    },
    "19": {
        "name": "Jardim Helga D",
        "anchor": (-23.6440, -46.7755),
        "manual": [
            [-46.77537, -23.64344],
            [-46.77596, -23.64276],
            [-46.77575, -23.64429],
            [-46.77448, -23.64482],
        ],
        "note": "OSM: Mitim/Guerreiro x Avenida Ibi (Luisa Damon ausente no OSM)",
    },
}

# CDHU: MultiGeometry traçada sobre blocos do cartão satélite (S-12-T).
# Coordenadas (lon, lat) — clusters separados; ajuste fino no Google Earth se necessário.
CDHU_POLYGONS = {
    "13": {
        "name": "CDHU A",
        "note": "Blocos 01-02, 09-16, 19-24, 27-29 (contornos azuis do cartão T13).",
        "polys": [
            # Grade leste (01, 02, 09–16)
            [
                [-46.77618, -23.63905],
                [-46.77502, -23.63905],
                [-46.77502, -23.64058],
                [-46.77618, -23.64058],
            ],
            # Blocos oeste (19–21, 27–29)
            [
                [-46.77458, -23.63948],
                [-46.77372, -23.63948],
                [-46.77372, -23.64048],
                [-46.77458, -23.64048],
            ],
            # Blocos 22–24 (canto inferior esquerdo)
            [
                [-46.77478, -23.64058],
                [-46.77402, -23.64058],
                [-46.77402, -23.64108],
                [-46.77478, -23.64108],
            ],
        ],
    },
    "14": {
        "name": "CDHU B",
        "note": "Blocos 03–08 (fileira inferior direita no cartão T14).",
        "polys": [
            [
                [-46.77618, -23.64058],
                [-46.77502, -23.64058],
                [-46.77502, -23.64108],
                [-46.77618, -23.64108],
            ],
        ],
    },
    "15": {
        "name": "CDHU C",
        "note": "Blocos 17–18, 25–26 + área Campo (cartão T15).",
        "polys": [
            # Blocos centro-esquerda (17, 18, 25, 26)
            [
                [-46.77502, -23.63948],
                [-46.77418, -23.63948],
                [-46.77418, -23.64058],
                [-46.77502, -23.64058],
            ],
            # Campo (referência esportiva entre blocos)
            [
                [-46.77502, -23.63982],
                [-46.77432, -23.63982],
                [-46.77432, -23.64028],
                [-46.77502, -23.64028],
            ],
        ],
    },
}


def normalize_name(name: str) -> str:
    s = name.lower()
    for a, b in [("á", "a"), ("ã", "a"), ("â", "a"), ("é", "e"), ("ê", "e"), ("í", "i"), ("ó", "o"), ("ô", "o"), ("ú", "u"), ("ç", "c")]:
        s = s.replace(a, b)
    return s.strip()


def http_get(url: str, data: bytes | None = None) -> bytes:
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120, context=SSL_CTX) as resp:
        return resp.read()


def fetch_osm_bbox() -> dict:
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


def load_osm_db() -> dict:
    if OSM_FILE.exists():
        cached = json.loads(OSM_FILE.read_text(encoding="utf-8"))
        if len(cached) >= 50:
            return cached
    print("Baixando ruas OSM (Overpass)…")
    db = fetch_osm_bbox()
    OSM_FILE.parent.mkdir(parents=True, exist_ok=True)
    OSM_FILE.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  {len(db)} nomes salvos em {OSM_FILE.relative_to(ROOT)}")
    return db


def lookup_ways(db: dict, street: str) -> list[list[list[float]]]:
    names = STREET_ALIASES.get(street, [street])
    for name in names:
        if name in db:
            return db[name]
    target = normalize_name(street)
    for key, ways in db.items():
        if normalize_name(key) == target:
            return ways
    for key, ways in db.items():
        nk = normalize_name(key)
        if target in nk or nk in target:
            return ways
    return []


def street_segments(db: dict, street: str) -> list[tuple[tuple[float, float], tuple[float, float]]]:
    segs = []
    for way in lookup_ways(db, street):
        for i in range(len(way) - 1):
            segs.append((tuple(way[i]), tuple(way[i + 1])))
    return segs


def seg_intersect(a1, a2, b1, b2):
    x1, y1 = a1
    x2, y2 = a2
    x3, y3 = b1
    x4, y4 = b2
    denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(denom) < 1e-14:
        return None
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
    u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom
    if -1e-9 <= t <= 1 + 1e-9 and -1e-9 <= u <= 1 + 1e-9:
        return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))
    return None


def dist_ll(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def corner_point(db: dict, street_a: str, street_b: str, anchor: tuple[float, float] | None):
    segs_a = street_segments(db, street_a)
    segs_b = street_segments(db, street_b)
    if not segs_a or not segs_b:
        return None, f"rua ausente: {street_a if not segs_a else street_b}"

    hits = []
    for a1, a2 in segs_a:
        for b1, b2 in segs_b:
            pt = seg_intersect(a1, a2, b1, b2)
            if pt:
                hits.append(pt)

    if not hits:
        # fallback: ponto médio do par mais próximo entre polylines
        best = None
        best_d = 1e9
        for a1, a2 in segs_a:
            for b1, b2 in segs_b:
                for x in (a1, a2):
                    for y in (b1, b2):
                        d = dist_ll(x, y)
                        if d < best_d:
                            best_d = d
                            best = ((x[0] + y[0]) / 2, (x[1] + y[1]) / 2)
        if best and best_d < 0.004:
            return best, "proximidade OSM"
        return None, f"sem intersecao: {street_a} x {street_b}"

    if anchor is None:
        return hits[0], "intersecao OSM"

    alat, alon = anchor
    hits.sort(key=lambda p: dist_ll(p, (alon, alat)))
    return hits[0], "intersecao OSM"


def dedupe_ring(ring: list[tuple[float, float]]) -> list[tuple[float, float]] | None:
    out = []
    for p in ring:
        if not out or dist_ll(p, out[-1]) > 1e-7:
            out.append(p)
    if len(out) >= 2 and dist_ll(out[0], out[-1]) < 1e-6:
        out.pop()
    return out if len(out) >= 3 else None


def ring_from_corners(db: dict, corners: list[tuple[str, str]], anchor: tuple[float, float] | None):
    ring = []
    notes = []
    for a, b in corners:
        pt, note = corner_point(db, a, b, anchor)
        if not pt:
            return None, note
        ring.append(pt)
        notes.append(f"{a[:24]} x {b[:24]}")
    ring = dedupe_ring(ring)
    if not ring:
        return None, "anel invalido"
    return ring, "; ".join(notes[:3])


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
                time.sleep(0.08)
            except Exception as exc:  # noqa: BLE001
                print(f"  tile fail: {exc}")
    return canvas, float(tx0), float(ty0), zoom


def project_poly(poly, tx0, ty0, zoom):
    return [
        ((latlon_to_pixel(lat, lon, zoom)[0] - tx0) * 256, (latlon_to_pixel(lat, lon, zoom)[1] - ty0) * 256)
        for lon, lat in poly
    ]


def render_jpg(num, name, polygons: list[list], note, out_path: Path):
    all_pts = [p for poly in polygons for p in poly]
    lons = [p[0] for p in all_pts]
    lats = [p[1] for p in all_pts]
    pad = 0.0010
    img, tx0, ty0, zoom = fetch_tiles(min(lats) - pad, min(lons) - pad, max(lats) + pad, max(lons) + pad)
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    for poly in polygons:
        pix = project_poly(poly, tx0, ty0, zoom)
        if len(pix) >= 3:
            draw.polygon(pix, fill=YELLOW_FILL, outline=YELLOW_LINE)
            draw.line(pix + [pix[0]], fill=YELLOW_LINE, width=4)
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
    bar.text((16, 32), note[:90], fill=(200, 210, 230), font=font_s)
    if out.width > 1200:
        ratio = 1200 / out.width
        out = out.resize((1200, int(out.height * ratio)), Image.Resampling.LANCZOS)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.convert("RGB").save(out_path, "JPEG", quality=88, optimize=True)
    print(f"  JPG -> {out_path.relative_to(ROOT)}")


def placemark_kml(num: str, name: str, polygons: list[list], note: str, style_id: str = "") -> str:
    style = f"<styleUrl>{style_id}</styleUrl>" if style_id else ""
    if len(polygons) == 1:
        poly = polygons[0]
        coords = " ".join(f"{lon},{lat},0" for lon, lat in poly)
        coords += f" {poly[0][0]},{poly[0][1]},0"
        geom = f"<Polygon><outerBoundaryIs><LinearRing><coordinates>{coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>"
    else:
        parts = []
        for poly in polygons:
            coords = " ".join(f"{lon},{lat},0" for lon, lat in poly)
            coords += f" {poly[0][0]},{poly[0][1]},0"
            parts.append(
                f"<Polygon><outerBoundaryIs><LinearRing><coordinates>{coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>"
            )
        geom = f"<MultiGeometry>{''.join(parts)}</MultiGeometry>"

    return f"""
    <Placemark>
      <name>T{num} - {name}</name>
      <description><![CDATA[{note}]]></description>
      {style}
      <Style>
        <LineStyle><color>ff00d6ff</color><width>3.5</width></LineStyle>
        <PolyStyle><color>4600d6ff</color></PolyStyle>
      </Style>
      {geom}
    </Placemark>"""


def build_document(features: list[dict], title: str) -> str:
    marks = []
    for f in features:
        polys = f.get("polys") or [f["poly"]]
        marks.append(placemark_kml(str(f["num"]).zfill(2), f["name"], polys, f.get("note", "")))
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>{title}</name>
    <description>Poligonos reconstruidos via intersecoes OSM (Jul 2026). CDHU requer ajuste fino no Earth.</description>
    {''.join(marks)}
  </Document>
</kml>
"""


def write_kmz(kml: str, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("doc.kml", kml)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-jpg", action="store_true", help="Nao gera JPGs (mais rapido)")
    args = parser.parse_args()

    db = load_osm_db()
    features = []

    for num in [f"{i:02d}" for i in range(1, 20)]:
        if num in CDHU_POLYGONS:
            spec = CDHU_POLYGONS[num]
            polys = spec.get("polys") or [spec["poly"]]
            main = max(
                polys,
                key=lambda p: (max(x[0] for x in p) - min(x[0] for x in p))
                * (max(x[1] for x in p) - min(x[1] for x in p)),
            )
            feat = {
                "num": num,
                "name": spec["name"],
                "poly": main,
                "polys": polys,
                "corners": [],
                "note": spec["note"],
            }
            features.append(feat)
            print(f"T{num} · {spec['name']} (CDHU manual, {len(polys)} polígono(s))")
            if not args.no_jpg:
                render_jpg(num, spec["name"], polys, spec["note"], OUT_IMG / f"t{num}.jpg")
            continue

        spec = TERRITORIES.get(num)
        if not spec:
            print(f"T{num}: spec ausente — SKIP")
            continue

        anchor = spec.get("anchor")
        polys = []
        note_parts = []

        if "manual" in spec:
            ring = dedupe_ring(list(spec["manual"]))
            if ring:
                polys.append(ring)
                note_parts.append(spec.get("note") or "manual")
                print(f"T{num} · {spec['name']}: manual {len(ring)} pts")
            else:
                print(f"T{num} · {spec['name']}: FALHA — anel manual inválido")
                continue
        elif "multi" in spec:
            for part in spec["multi"]:
                if "manual" in part:
                    ring = dedupe_ring(list(part["manual"]))
                    if ring:
                        polys.append(ring)
                        note_parts.append(part["label"] + " (manual)")
                        print(f"T{num} · {spec['name']} / {part['label']}: manual {len(ring)} pts")
                    continue
                ring, note = ring_from_corners(db, part["corners"], anchor)
                if ring:
                    polys.append(ring)
                    note_parts.append(part["label"])
                    print(f"T{num} · {spec['name']} / {part['label']}: {len(ring)} pts")
                else:
                    print(f"T{num} / {part['label']}: FALHA — {note}")
        else:
            ring, note = ring_from_corners(db, spec["corners"], anchor)
            if ring:
                polys.append(ring)
                note_parts.append(note)
                print(f"T{num} · {spec['name']}: {len(ring)} pts — {note}")
            else:
                print(f"T{num} · {spec['name']}: FALHA — {note}")

        if not polys:
            continue

        # Polígono principal = maior área (bbox) para JSON compatível
        main = max(polys, key=lambda p: (max(x[0] for x in p) - min(x[0] for x in p)) * (max(x[1] for x in p) - min(x[1] for x in p)))
        feat = {
            "num": num,
            "name": spec["name"],
            "poly": main,
            "polys": polys,
            "corners": spec.get("corners") or [c for part in spec.get("multi", []) for c in part.get("corners", [])],
            "note": " | ".join(note_parts) if note_parts else "OSM",
        }
        features.append(feat)

        if not args.no_jpg:
            render_jpg(num, spec["name"], polys, feat["note"], OUT_IMG / f"t{num}.jpg")

    OUT_JSON.write_text(json.dumps(features, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nJSON -> {OUT_JSON.relative_to(ROOT)} ({len(features)} territorios)")

    OUT_TERR.mkdir(parents=True, exist_ok=True)
    for feat in features:
        num = str(feat["num"]).zfill(2)
        polys = feat.get("polys") or [feat["poly"]]
        kml = build_document([feat], f"T{num} · {feat['name']}")
        (OUT_TERR / f"t{num}.kml").write_text(kml, encoding="utf-8")
        write_kmz(kml, OUT_TERR / f"t{num}.kmz")

    combined = build_document(features, "Jardim Elizabeth — Territorios (OSM Jul 2026)")
    (OUT_MAPS / "jardim-elizabeth-territorios.kml").write_text(combined, encoding="utf-8")
    write_kmz(combined, OUT_MAPS / "jardim-elizabeth-territorios.kmz")
    print(f"KMZ combinado -> {OUT_MAPS / 'jardim-elizabeth-territorios.kmz'}")
    print(f"KMZ individuais -> {OUT_TERR.relative_to(ROOT)}/t01.kmz … t19.kmz")


if __name__ == "__main__":
    main()
