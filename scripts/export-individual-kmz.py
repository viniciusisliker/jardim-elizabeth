#!/usr/bin/env python3
"""Exporta um KMZ/KML por território a partir de maps/precise-boundaries.json."""
from __future__ import annotations

import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOUNDARIES_FILE = ROOT / "maps" / "precise-boundaries.json"
OUT_DIR = ROOT / "maps" / "territorios"
COMBINED_KML = ROOT / "maps" / "jardim-elizabeth-territorios.kml"
COMBINED_KMZ = ROOT / "maps" / "jardim-elizabeth-territorios.kmz"


def placemark_kml(f: dict) -> str:
    num = str(f["num"]).zfill(2)
    polys = f.get("polys") or [f["poly"]]
    note = f.get("note") or "Perimetro por intersecoes"
    if len(polys) == 1:
        poly = polys[0]
        coords = " ".join(f"{lon},{lat},0" for lon, lat in poly)
        coords += f" {poly[0][0]},{poly[0][1]},0"
        geom = f"<Polygon><outerBoundaryIs><LinearRing><coordinates>{coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>"
    else:
        parts = []
        for poly in polys:
            coords = " ".join(f"{lon},{lat},0" for lon, lat in poly)
            coords += f" {poly[0][0]},{poly[0][1]},0"
            parts.append(
                f"<Polygon><outerBoundaryIs><LinearRing><coordinates>{coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>"
            )
        geom = f"<MultiGeometry>{''.join(parts)}</MultiGeometry>"

    return f"""
    <Placemark>
      <name>T{num} - {f['name']}</name>
      <description><![CDATA[{note}]]></description>
      <Style>
        <LineStyle><color>ff00d6ff</color><width>3.5</width></LineStyle>
        <PolyStyle><color>4600d6ff</color></PolyStyle>
      </Style>
      {geom}
    </Placemark>"""


def build_kml(features: list[dict], doc_name: str) -> str:
    placemarks = [placemark_kml(f) for f in features]
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>{doc_name}</name>
    {''.join(placemarks)}
  </Document>
</kml>
"""


def write_kmz(kml: str, kmz_path: Path) -> None:
    kmz_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(kmz_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("doc.kml", kml)


def main() -> None:
    if not BOUNDARIES_FILE.exists():
        raise SystemExit(f"Arquivo nao encontrado: {BOUNDARIES_FILE.relative_to(ROOT)}")

    features = json.loads(BOUNDARIES_FILE.read_text(encoding="utf-8"))
    if not features:
        raise SystemExit("precise-boundaries.json esta vazio.")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for feat in sorted(features, key=lambda f: int(f["num"])):
        num = str(feat["num"]).zfill(2)
        label = f"T{num} · {feat['name']}"
        kml = build_kml([feat], label)
        kml_path = OUT_DIR / f"t{num}.kml"
        kmz_path = OUT_DIR / f"t{num}.kmz"
        kml_path.write_text(kml, encoding="utf-8")
        write_kmz(kml, kmz_path)
        print(f"  {kmz_path.relative_to(ROOT)}")

    combined = build_kml(features, "Jardim Elizabeth — Territorios precisos")
    COMBINED_KML.write_text(combined, encoding="utf-8")
    write_kmz(combined, COMBINED_KMZ)
    print(f"\n{len(features)} individuais + combinado -> {COMBINED_KMZ.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
