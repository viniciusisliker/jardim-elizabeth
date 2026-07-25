#!/usr/bin/env python3
"""
CLI unificada para poligonos de territorio (Google Earth -> JSON -> KMZ).

Uso:
  python scripts/territory-boundaries.py import [--merge] [--fallback]
  python scripts/territory-boundaries.py export
  python scripts/territory-boundaries.py validate [--strict]
  python scripts/territory-boundaries.py sync [--merge] [--render]
  python scripts/territory-boundaries.py render [--num 01 02]
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.territory_boundaries_lib import (  # noqa: E402
    BOUNDARIES_FILE,
    COMBINED_KML,
    COMBINED_KMZ,
    EARTH_KML_DIR,
    OUT_TERR_DIR,
    build_kml,
    build_territory_entry,
    features_from_boundaries,
    load_boundaries,
    load_territory_names,
    normalize_paths,
    parse_kml_source,
    save_boundaries,
    validate_boundaries,
    write_kmz,
)


def resolve_path(path: Path) -> Path:
    return path if path.is_absolute() else ROOT / path


def collect_files(input_dir: Path, kml_only: bool = False) -> list[Path]:
    seen: set[str] = set()
    files: list[Path] = []
    patterns = ("*.kml",) if kml_only else ("*.kml", "*.kmz")
    for pattern in patterns:
        for path in sorted(input_dir.glob(pattern)):
            key = str(path.resolve()).lower()
            if key in seen or path.name.startswith("jardim-elizabeth-territorios"):
                continue
            seen.add(key)
            files.append(path)
    return files


def cmd_import(args: argparse.Namespace) -> int:
    names = load_territory_names()
    data = load_boundaries() if args.merge else {"source": "google-earth", "territories": {}}
    territories: dict = data.setdefault("territories", {})

    files: list[Path] = []
    if args.file:
        file_path = resolve_path(args.file)
        if not file_path.exists():
            print(f"Arquivo nao encontrado: {file_path}", file=sys.stderr)
            return 1
        files = [file_path]
    else:
        input_dir = resolve_path(args.input) if args.input else EARTH_KML_DIR
        if input_dir.exists():
            found = collect_files(input_dir, kml_only=input_dir.resolve() == OUT_TERR_DIR.resolve())
            if found:
                print(f"Pasta: {input_dir.relative_to(ROOT)} ({len(found)} arquivo(s))")
                files.extend(found)
        if not files and args.fallback and OUT_TERR_DIR.exists():
            found = collect_files(OUT_TERR_DIR, kml_only=True)
            if found:
                print(f"Fallback: {OUT_TERR_DIR.relative_to(ROOT)} ({len(found)} KML)")
                files.extend(found)

    if not files:
        print(
            "Nenhum KML/KMZ encontrado.\n"
            f"  Exporte do Earth para {EARTH_KML_DIR.relative_to(ROOT)}/\n"
            "  Depois: python scripts/territory-boundaries.py sync --merge",
            file=sys.stderr,
        )
        return 1

    imported = 0
    for path in files:
        for item in parse_kml_source(path):
            num = item.get("num")
            if not num:
                print(f"  SKIP {path.name}: territorio nao identificado ({item.get('name')!r})")
                continue
            num = str(num).zfill(2)
            paths = item.get("paths") or []
            if not paths:
                print(f"  SKIP {path.name}: sem poligono")
                continue
            rel = path.relative_to(ROOT) if path.is_relative_to(ROOT) else path.name
            entry = build_territory_entry(num, paths, names, str(rel), item.get("name", ""))
            territories[num] = entry
            imported += 1
            warn = f" ({len(entry['warnings'])} aviso(s))" if entry.get("warnings") else ""
            print(
                f"  T{num} - {entry['name']}: {len(paths)} poligono(s), "
                f"{sum(len(p) for p in paths)} pts [{entry['quality']}]{warn} <- {path.name}"
            )

    if not imported:
        print("Nenhum territorio importado.", file=sys.stderr)
        return 1

    data["source"] = "google-earth"
    save_boundaries(data)
    missing = sorted(set(f"{i:02d}" for i in range(1, 20)) - set(territories))
    print(f"\nSalvo -> {BOUNDARIES_FILE.relative_to(ROOT)} ({len(territories)} territorios)")
    if missing:
        print(f"Faltando: {', '.join('T' + n for n in missing)}")
    return 0


def cmd_export(_: argparse.Namespace) -> int:
    if not BOUNDARIES_FILE.exists():
        print(f"Arquivo nao encontrado: {BOUNDARIES_FILE.relative_to(ROOT)}", file=sys.stderr)
        return 1

    data = load_boundaries()
    features = features_from_boundaries(data)
    if not features:
        print("territory-boundaries.json nao contem poligonos.", file=sys.stderr)
        return 1

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
        print(f"  T{num} - {feat['name']}: {pts} pts [{feat.get('quality')}] -> {kmz_path.relative_to(ROOT)}")

    combined = build_kml(features, "Jardim Elizabeth — Territorios")
    COMBINED_KML.write_text(combined, encoding="utf-8")
    write_kmz(combined, COMBINED_KMZ)
    print(f"\n{len(features)} individuais + combinado -> {COMBINED_KMZ.relative_to(ROOT)}")
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    if not BOUNDARIES_FILE.exists():
        print(f"Arquivo nao encontrado: {BOUNDARIES_FILE.relative_to(ROOT)}", file=sys.stderr)
        return 1

    issues = validate_boundaries()
    errors = [i for i in issues if i["level"] == "error"]
    warns = [i for i in issues if i["level"] == "warn"]

    for issue in issues:
        if issue["level"] == "info" and not args.verbose:
            continue
        icon = {"error": "X", "warn": "!", "info": "-"}.get(issue["level"], "?")
        print(f"  {icon} T{issue['num']}: {issue['message']}")

    data = load_boundaries()
    by_quality: dict[str, int] = {}
    for spec in data.get("territories", {}).values():
        q = spec.get("quality", "unknown")
        by_quality[q] = by_quality.get(q, 0) + 1

    print(f"\nResumo: {len(errors)} erro(s), {len(warns)} aviso(s)")
    if by_quality:
        print("Qualidade:", ", ".join(f"{k}={v}" for k, v in sorted(by_quality.items())))

    if errors:
        return 1
    if args.strict and warns:
        return 1
    return 0


def cmd_annotate(_: argparse.Namespace) -> int:
    if not BOUNDARIES_FILE.exists():
        print(f"Arquivo nao encontrado: {BOUNDARIES_FILE.relative_to(ROOT)}", file=sys.stderr)
        return 1

    data = load_boundaries()
    names = load_territory_names()
    territories = data.setdefault("territories", {})
    for num in list(territories):
        spec = territories[num]
        paths = normalize_paths(spec.get("paths") or [])
        if not paths:
            continue
        entry = build_territory_entry(
            num, paths, names, spec.get("source_file", ""), spec.get("name", "")
        )
        territories[num] = entry
        print(f"  T{num} - {entry['name']}: [{entry['quality']}]")
    save_boundaries(data)
    print(f"\nAtualizado -> {BOUNDARIES_FILE.relative_to(ROOT)}")
    return 0


def cmd_render(args: argparse.Namespace) -> int:
    script = ROOT / "scripts" / "render-territory-images.py"
    cmd = [sys.executable, str(script)]
    if args.num:
        cmd.append("--num")
        cmd.extend(args.num)
    if args.width:
        cmd.extend(["--width", str(args.width)])
    if args.skip_osm:
        cmd.append("--skip-osm")
    return subprocess.call(cmd)


def cmd_sync(args: argparse.Namespace) -> int:
    code = cmd_import(args)
    if code:
        return code
    code = cmd_export(args)
    if code:
        return code
    code = cmd_validate(args)
    if code:
        return code
    if getattr(args, "render", False):
        return cmd_render(args)
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Poligonos de territorio — Google Earth -> JSON -> KMZ")
    sub = parser.add_subparsers(dest="command", required=True)

    p_import = sub.add_parser("import", help="Importa KML/KMZ do Google Earth")
    p_import.add_argument("--input", type=Path, help=f"Pasta de entrada (padrao: {EARTH_KML_DIR.name})")
    p_import.add_argument("--file", type=Path, help="Arquivo unico KML/KMZ")
    p_import.add_argument("--merge", action="store_true", help="Mescla com JSON existente")
    p_import.add_argument("--fallback", action="store_true", help="Usa maps/territorios se earth-kml vazio")

    sub.add_parser("export", help="Gera KMZ/KML a partir do JSON")

    sub.add_parser("annotate", help="Recalcula quality/warnings no JSON existente")

    p_validate = sub.add_parser("validate", help="Valida territory-boundaries.json")
    p_validate.add_argument("--strict", action="store_true", help="Falha se houver avisos")
    p_validate.add_argument("--verbose", action="store_true", help="Mostra infos")

    p_render = sub.add_parser("render", help="Gera imagens em img/territorios-enhanced/")
    p_render.add_argument("--num", nargs="*", help="Territorios (ex: 01 07)")
    p_render.add_argument("--width", type=int, default=1400)
    p_render.add_argument("--skip-osm", action="store_true")

    p_sync = sub.add_parser("sync", help="import + export + validate (+ render opcional)")
    p_sync.add_argument("--input", type=Path)
    p_sync.add_argument("--file", type=Path)
    p_sync.add_argument("--merge", action="store_true")
    p_sync.add_argument("--fallback", action="store_true")
    p_sync.add_argument("--strict", action="store_true")
    p_sync.add_argument("--render", action="store_true", help="Gera img/territorios-enhanced/ apos validar")
    p_sync.add_argument("--num", nargs="*", help="Com --render: territorios especificos")
    p_sync.add_argument("--width", type=int, default=1400)
    p_sync.add_argument("--skip-osm", action="store_true")

    args = parser.parse_args()
    if args.command == "sync":
        args.verbose = False
        raise SystemExit(cmd_sync(args))
    handlers = {
        "import": cmd_import,
        "export": cmd_export,
        "validate": cmd_validate,
        "annotate": cmd_annotate,
        "render": cmd_render,
    }
    raise SystemExit(handlers[args.command](args))


if __name__ == "__main__":
    main()
