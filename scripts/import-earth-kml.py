#!/usr/bin/env python3
"""
Importa polígonos traçados no Google Earth para maps/territory-boundaries.json.

Entrada (padrão): maps/earth-kml/*.kml e *.kmz
Fallback:        maps/territorios/*.kml (KML individuais t01–t19)

Uso:
  python scripts/import-earth-kml.py
  python scripts/import-earth-kml.py --input maps/earth-kml
  python scripts/import-earth-kml.py --input maps/territorios --merge
  python scripts/import-earth-kml.py --file maps/earth-kml/jardim-elizabeth.kml
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.territory_boundaries_lib import (  # noqa: E402
    EARTH_KML_DIR,
    OUT_TERR_DIR,
    load_boundaries,
    load_territory_names,
    parse_kml_source,
    save_boundaries,
)


def collect_files(input_dir: Path, kml_only: bool = False) -> list[Path]:
    seen: set[str] = set()
    files: list[Path] = []
    patterns = ("*.kml",) if kml_only else ("*.kml", "*.kmz")
    for pattern in patterns:
        for path in sorted(input_dir.glob(pattern)):
            key = str(path.resolve()).lower()
            if key in seen:
                continue
            seen.add(key)
            files.append(path)
    return files


def resolve_path(path: Path) -> Path:
    return path if path.is_absolute() else ROOT / path


def resolve_input_dirs(explicit: Path | None) -> list[Path]:
    if explicit:
        return [resolve_path(explicit)]
    dirs: list[Path] = []
    if EARTH_KML_DIR.exists() and collect_files(EARTH_KML_DIR):
        dirs.append(EARTH_KML_DIR)
    if OUT_TERR_DIR.exists() and collect_files(OUT_TERR_DIR):
        dirs.append(OUT_TERR_DIR)
    return dirs


def import_file(path: Path, names: dict[str, str]) -> dict[str, dict]:
    imported: dict[str, dict] = {}
    for item in parse_kml_source(path):
        num = item.get("num")
        if not num:
            print(f"  SKIP {path.name}: numero do territorio nao identificado ({item.get('name')!r})")
            continue
        num = str(num).zfill(2)
        paths = item.get("paths") or []
        if not paths:
            print(f"  SKIP {path.name}: sem poligono")
            continue
        point_count = sum(len(p) for p in paths)
        imported[num] = {
            "name": names.get(num, item.get("name") or f"T{num}"),
            "source_file": path.name,
            "paths": paths,
            "note": f"Importado de {path.name} ({len(paths)} poligono(s), {point_count} pontos)",
        }
        print(f"  T{num} · {imported[num]['name']}: {len(paths)} poligono(s), {point_count} pts <- {path.name}")
    return imported


def main() -> None:
    parser = argparse.ArgumentParser(description="Importa KML/KMZ do Google Earth para territory-boundaries.json")
    parser.add_argument("--input", type=Path, help="Pasta com arquivos KML/KMZ (padrao: earth-kml, depois territorios)")
    parser.add_argument("--file", type=Path, help="Arquivo unico KML/KMZ com um ou mais territorios")
    parser.add_argument("--merge", action="store_true", help="Mescla com territory-boundaries.json existente")
    args = parser.parse_args()

    names = load_territory_names()
    data = load_boundaries() if args.merge else {"source": "google-earth", "territories": {}}
    territories: dict = data.setdefault("territories", {})

    files: list[Path] = []
    if args.file:
        file_path = resolve_path(args.file)
        if not file_path.exists():
            raise SystemExit(f"Arquivo nao encontrado: {file_path}")
        files = [file_path]
    else:
        for directory in resolve_input_dirs(args.input):
            kml_only = directory.resolve() == OUT_TERR_DIR.resolve()
            found = collect_files(directory, kml_only=kml_only)
            if found:
                print(f"Pasta: {directory.relative_to(ROOT)} ({len(found)} arquivo(s))")
                files.extend(found)

    if not files:
        raise SystemExit(
            "Nenhum KML/KMZ encontrado.\n"
            f"  Coloque os arquivos do Earth em {EARTH_KML_DIR.relative_to(ROOT)}/\n"
            f"  ou use --input maps/territorios"
        )

    seen_nums: set[str] = set()
    for path in files:
        if path.name.startswith("jardim-elizabeth-territorios"):
            continue
        for num, spec in import_file(path, names).items():
            if num in seen_nums and not args.merge:
                print(f"  AVISO: T{num} sobrescrito por {path.name}")
            territories[num] = spec
            seen_nums.add(num)

    if not territories:
        raise SystemExit("Nenhum territorio importado.")

    data["source"] = "google-earth"
    save_boundaries(data)
    missing = sorted(set(f"{i:02d}" for i in range(1, 20)) - set(territories))
    print(f"\nSalvo -> maps/territory-boundaries.json ({len(territories)} territorios)")
    if missing:
        print(f"Faltando: {', '.join('T' + n for n in missing)}")
    print("Proximo passo: python scripts/export-individual-kmz.py")


if __name__ == "__main__":
    main()
