#!/usr/bin/env python3
"""Baixa geometrias OSM das ruas da região (Overpass)."""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "maps" / "osm-streets.json"
USER_AGENT = "JardimElizabethTerritoryMaps/1.1"

# bbox: south,west,north,east
BBOX = "-23.655,-46.790,-23.620,-46.750"

QUERY = f"""
[out:json][timeout:120];
(
  way["highway"]["name"]({BBOX});
);
out geom;
"""


def main():
    data = urllib.parse.urlencode({"data": QUERY}).encode()
    req = urllib.request.Request(
        "https://overpass-api.de/api/interpreter",
        data=data,
        headers={"User-Agent": USER_AGENT},
    )
    print("Consultando Overpass…")
    with urllib.request.urlopen(req, timeout=180) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    ways = []
    for w in payload.get("elements", []):
        name = (w.get("tags") or {}).get("name")
        geom = w.get("geometry") or []
        if not name or len(geom) < 2:
            continue
        ways.append(
            {
                "id": w["id"],
                "name": name,
                "coords": [[p["lon"], p["lat"]] for p in geom],
            }
        )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(ways, ensure_ascii=False), encoding="utf-8")
    names = sorted({w["name"] for w in ways})
    print(f"Salvo {OUT} — {len(ways)} ways, {len(names)} nomes únicos")
    for n in names:
        if any(
            k.lower() in n.lower()
            for k in (
                "Hermes",
                "Zamitti",
                "Januário",
                "Cabral",
                "Aristides",
                "Humberto",
                "Lacerda",
                "Pirajussara",
                "Benedito",
                "Alípio",
                "Antonio Alves",
                "Piaga",
                "Atucupe",
                "Taun",
                "Cabaxi",
                "Martim",
                "Gonzaga",
                "Correia",
                "Spilman",
                "Trabulsi",
                "Milagres",
                "Brea",
                "Gauguin",
                "Mitim",
                "Guerreiro",
                "Thomaz",
                "Augusto",
                "Ramona",
                "Gebara",
                "Doré",
                "Tabim",
                "Amac",
                "Crestin",
                "Apea",
                "Ajuru",
                "Lomanto",
                "Osvaldo",
                "Arruda",
                "Henrique Moreira",
                "Miramar",
                "Hypólito",
                "Hypolito",
                "Campo Limpo",
                "Ibi",
                "Damon",
                "Ridel",
                "Nelson",
            )
        ):
            print(" ", n)


if __name__ == "__main__":
    main()
