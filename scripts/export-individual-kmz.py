#!/usr/bin/env python3
"""
Exporta KMZ/KML por territorio a partir de maps/territory-boundaries.json.

Uso:
  python scripts/export-individual-kmz.py
  python scripts/import-earth-kml.py && python scripts/export-individual-kmz.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.territory_boundaries_lib import (  # noqa: E402
    BOUNDARIES_FILE,
    COMBINED_KML,
    COMBINED_KMZ,
    OUT_TERR_DIR,
    build_kml,
    features_from_boundaries,
    load_boundaries,
    write_kmz,
)


def main() -> None:
    if not BOUNDARIES_FILE.exists():
        raise SystemExit(
            f"Arquivo nao encontrado: {BOUNDARIES_FILE.relative_to(ROOT)}\n"
            "Execute primeiro: python scripts/import-earth-kml.py"
        )

    data = load_boundaries()
    features = features_from_boundaries(data)
    if not features:
        raise SystemExit("territory-boundaries.json nao contem poligonos.")

    OUT_TERR_DIR.mkdir(parents=True, exist_ok=True)

    for feat in features:
        num = str(feat["num"]).zfill(2)
        label = f"T{num} · {feat['name']}"
        kml = build_kml([feat], label)
        kml_path = OUT_TERR_DIR / f"t{num}.kml"
        kmz_path = OUT_TERR_DIR / f"t{num}.kmz"
        kml_path.write_text(kml, encoding="utf-8")
        write_kmz(kml, kmz_path)
        pts = sum(len(p) for p in (feat.get("polys") or [feat["poly"]]))
        print(f"  T{num} · {feat['name']}: {pts} pts -> {kmz_path.relative_to(ROOT)}")

    combined = build_kml(features, "Jardim Elizabeth — Territorios")
    COMBINED_KML.write_text(combined, encoding="utf-8")
    write_kmz(combined, COMBINED_KMZ)
    print(f"\n{len(features)} individuais + combinado -> {COMBINED_KMZ.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
