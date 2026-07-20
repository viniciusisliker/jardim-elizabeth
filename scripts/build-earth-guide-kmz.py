#!/usr/bin/env python3
"""Gera KMZ de apoio: pastas T01–T19 com descrição do perímetro do cartão + pin de busca."""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPECS = ROOT / "maps" / "territory-perimeter-specs.json"
CHECKLIST = ROOT / "scripts" / "territory-map-checklist.json"
CACHE = ROOT / "scripts" / ".geocode-cache.json"
OUT_KML = ROOT / "maps" / "jardim-elizabeth-territorios.kml"
OUT_KMZ = ROOT / "maps" / "jardim-elizabeth-territorios.kmz"
UA = "JardimElizabethTerritoryMaps/1.5"


def nominatim(q, cache):
    key = q.lower().strip()
    if key in cache and cache[key]:
        return tuple(cache[key])
    params = urllib.parse.urlencode({"q": q, "format": "json", "limit": 1, "countrycodes": "br"})
    req = urllib.request.Request(
        f"https://nominatim.openstreetmap.org/search?{params}",
        headers={"User-Agent": UA},
    )
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            data = json.loads(r.read().decode())
        time.sleep(1.05)
        if not data:
            return None
        lat, lon = float(data[0]["lat"]), float(data[0]["lon"])
        if not (-23.70 < lat < -23.55 and -46.85 < lon < -46.70):
            return None
        cache[key] = [lat, lon]
        return lat, lon
    except Exception:
        time.sleep(1.05)
        return None


def main():
    specs = json.loads(SPECS.read_text(encoding="utf-8"))["territories"]
    checklist = {t["num"]: t for t in json.loads(CHECKLIST.read_text(encoding="utf-8"))["territories"]}
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}

    folders = []
    for num in [f"{i:02d}" for i in range(1, 20)]:
        spec = specs[num]
        item = checklist[num]
        hit = nominatim(item["mapsQuery"], cache) or nominatim(
            f"{item['streets'][0]}, Campo Limpo, São Paulo, SP", cache
        )
        CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
        if not hit:
            print(f"T{num}: sem pin")
            continue
        lat, lon = hit
        perimeter = " · ".join(spec.get("perimeter", []))
        internal = " · ".join(spec.get("internal", [])) if spec.get("internal") else "—"
        note = spec.get("note", "Siga a área VERDE do cartão físico. Não use convex hull.")
        desc = f"""<![CDATA[
<p><b>T{num} — {spec['name']}</b></p>
<p><b>Perímetro (cartão):</b> {perimeter}</p>
<p><b>Internas:</b> {internal}</p>
<p><b>Como traçar:</b> Projetos → Desenhar linha/forma → clique nas esquinas das ruas acima,
fechando o polígono exatamente sobre a mancha verde do cartão (maps/original-cards/t{num}.jpg).</p>
<p>{note}</p>
]]>"""
        folders.append(
            f"""
    <Folder>
      <name>T{num} — {spec['name']}</name>
      <Placemark>
        <name>Busca T{num}</name>
        <description>{desc}</description>
        <Point><coordinates>{lon},{lat},0</coordinates></Point>
      </Placemark>
    </Folder>"""
        )
        print(f"T{num}: pin ok")

    kml = f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Jardim Elizabeth — Guia de traçado (cartões)</name>
    <description>Pins + instruções de perímetro. Desenhe cada polígono no Earth seguindo a área verde do cartão — sem aproximação automática.</description>
    {''.join(folders)}
  </Document>
</kml>
"""
    OUT_KML.write_text(kml, encoding="utf-8")
    with zipfile.ZipFile(OUT_KMZ, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("doc.kml", kml)
    print(f"KMZ guia -> {OUT_KMZ}")


if __name__ == "__main__":
    main()
