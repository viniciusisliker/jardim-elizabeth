#!/usr/bin/env python3
"""Baixa ways OSM por nome (uma rua por vez) para montar perímetros reais."""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "maps" / "osm-streets-by-name.json"
UA = "JardimElizabethTerritoryMaps/1.3"
BBOX = "-23.655,-46.790,-23.620,-46.750"

STREETS = [
    "Avenida Carlos Lacerda",
    "Estrada Pirajussara",
    "Rua Américo Trabulsi",
    "Rua dos Milagres",
    "Rua Louis Brea",
    "Rua Paul Gauguin",
    "Rua Hermes Ribeiro de Freitas",
    "Rua Doutor Zamitti Mammana",
    "Rua Nelson Spilman",
    "Rua Januário da Cunha Barbosa",
    "Rua José Cabral",
    "Rua Aristides de Britto",
    "Rua Aristides de Brito",
    "Rua Humberto Benemeritti",
    "Estrada do Campo Limpo",
    "Rua Benedito de Oliveira",
    "Rua Alípio Benedito",
    "Rua Antônio Alves Júnior",
    "Rua Antonio Alves Junior",
    "Rua Piaga",
    "Rua Atucupe",
    "Rua Atucupê",
    "Rua Taunã",
    "Rua Cabaxi",
    "Rua Martim da Costa Vilela",
    "Rua Luis Gonzaga Freire",
    "Rua Luís Gonzaga Freire",
    "Rua João Correia",
    "Rua da Praia de Miramar",
    "Rua Ramona Baptista Fernandes",
    "Rua Ramona B Fernandes",
    "Rua Coronel José Hypólito Trigueirinho",
    "Rua Henrique Moreira",
    "Rua Gustavo Doré",
    "Avenida Augusto Barreto Tavares",
    "Rua Doutor Dib Gebara",
    "Rua Nelson Lomanto",
    "Rua Nélson Lomanto",
    "Rua Osvaldo de Arruda Reis",
    "Rua Mitim",
    "Rua Tabimã",
    "Rua Amacás",
    "Rua Apeaçú",
    "Rua Crestins",
    "Rua Ajuruetê",
    "Rua Augusto de Moraes",
    "Rua Thomaz de Araújo",
    "Rua Guerreiro",
    "Rua Luisa Damon",
    "Rua Luis Maria Ridel",
    "Rua Ibi",
]


def fetch(name: str):
    # Prefer exact name match in bbox
    q = f"""
[out:json][timeout:45];
way["highway"]["name"="{name}"]({BBOX});
out geom;
"""
    data = urllib.parse.urlencode({"data": q}).encode()
    req = urllib.request.Request(
        "https://overpass-api.de/api/interpreter",
        data=data,
        headers={"User-Agent": UA},
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    ways = []
    for w in payload.get("elements", []):
        geom = w.get("geometry") or []
        if len(geom) < 2:
            continue
        ways.append([[p["lon"], p["lat"]] for p in geom])
    return ways


def main():
    result = {}
    for name in STREETS:
        try:
            ways = fetch(name)
            print(f"{name}: {len(ways)} ways")
            if ways:
                result[name] = ways
        except Exception as exc:  # noqa: BLE001
            print(f"{name}: FAIL {exc}")
        time.sleep(2.0)
    OUT.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    print(f"Saved {OUT} ({len(result)} streets)")


if __name__ == "__main__":
    main()
