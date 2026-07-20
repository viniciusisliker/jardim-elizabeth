#!/usr/bin/env python3
"""
Monta polígonos a partir de geometrias OSM (interseção real de ways).
Usa maps/osm-streets-by-name.json + perímetros definidos aqui.
"""
from __future__ import annotations

import json
import math
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STREETS = ROOT / "maps" / "osm-streets-by-name.json"
OUT_KML = ROOT / "maps" / "jardim-elizabeth-territorios.kml"
OUT_KMZ = ROOT / "maps" / "jardim-elizabeth-territorios.kmz"
OUT_JSON = ROOT / "maps" / "precise-boundaries.json"

# Pares de ruas do perímetro (sentido horário). Só territórios com geometria OSM suficiente.
# Lista de nomes possíveis (aliases) para cada lado.
PERIMETERS = {
    "02": {
        "name": "Jardim Elizabeth A",
        "sides": [
            ["Rua José Cabral"],
            ["Rua Hermes Ribeiro de Freitas"],
            ["Rua Nelson Spilman", "Rua Januário da Cunha Barbosa"],
            ["Rua Doutor Zamitti Mammana"],
        ],
    },
    "04": {
        "name": "Jardim Elizabeth C",
        "sides": [
            ["Rua Hermes Ribeiro de Freitas"],
            ["Rua Aristides de Britto", "Rua Aristides de Brito"],
            ["Rua Humberto Benemeritti"],
            ["Estrada do Campo Limpo", "Rua Benedito de Oliveira"],
        ],
    },
    "05": {
        "name": "Jardim Elizabeth D",
        "sides": [
            ["Rua Januário da Cunha Barbosa"],
            ["Rua Atucupe", "Rua Atucupê"],
            ["Rua Cabaxi"],
            ["Rua Piaga"],
        ],
    },
    "09": {
        "name": "Jardim Helga E",
        "sides": [
            ["Rua Luis Gonzaga Freire", "Rua Luís Gonzaga Freire"],
            ["Rua Nelson Lomanto", "Rua Nélson Lomanto"],
            ["Rua Osvaldo de Arruda Reis"],
            ["Rua Hermes Ribeiro de Freitas"],
        ],
    },
}


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def flatten_ways(street_db, names):
    pts = []
    for name in names:
        for way in street_db.get(name, []):
            pts.extend(way)
    return pts


def nearest_pair(pts_a, pts_b):
    best = None
    best_d = 1e9
    for a in pts_a:
        for b in pts_b:
            d = dist(a, b)
            if d < best_d:
                best_d = d
                best = (a, b, d)
    return best


def ring_from_sides(street_db, sides):
    """Cantos ≈ ponto médio do par mais próximo entre lados consecutivos."""
    side_pts = []
    for names in sides:
        pts = flatten_ways(street_db, names)
        if not pts:
            return None
        side_pts.append(pts)
    corners = []
    n = len(side_pts)
    for i in range(n):
        pair = nearest_pair(side_pts[i], side_pts[(i + 1) % n])
        if not pair or pair[2] > 0.004:  # ~400m
            return None
        # midpoint between nearest points on consecutive sides
        a, b, _ = pair
        corners.append(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2))
    # dedupe
    ring = []
    for p in corners:
        if not ring or dist(p, ring[-1]) > 1e-6:
            ring.append(p)
    return ring if len(ring) >= 3 else None


def build_kml(features):
    marks = []
    for f in features:
        coords = " ".join(f"{lon},{lat},0" for lon, lat in f["poly"])
        lon0, lat0 = f["poly"][0]
        coords += f" {lon0},{lat0},0"
        marks.append(
            f"""
    <Placemark>
      <name>T{f['num']} - {f['name']}</name>
      <description>Perimetro por intersecao de geometrias OSM das ruas do cartao</description>
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
    <name>Jardim Elizabeth — poligonos OSM (parcial)</name>
    {''.join(marks)}
  </Document>
</kml>
"""


def main():
    if not STREETS.exists():
        raise SystemExit(f"Falta {STREETS}. Rode fetch-osm-streets-by-name.py")
    db = json.loads(STREETS.read_text(encoding="utf-8"))
    features = []
    for num, spec in PERIMETERS.items():
        ring = ring_from_sides(db, spec["sides"])
        if not ring:
            print(f"T{num}: geometria insuficiente")
            continue
        features.append({"num": num, "name": spec["name"], "poly": ring})
        print(f"T{num}: {len(ring)} cantos")
    OUT_JSON.write_text(json.dumps(features, ensure_ascii=False, indent=2), encoding="utf-8")
    kml = build_kml(features)
    OUT_KML.write_text(kml, encoding="utf-8")
    with zipfile.ZipFile(OUT_KMZ, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("doc.kml", kml)
    print(f"{len(features)} poligonos OSM -> {OUT_KMZ}")


if __name__ == "__main__":
    main()
