"""Utilitários compartilhados: KML do Google Earth ↔ territory-boundaries.json ↔ KMZ."""
from __future__ import annotations

import json
import math
import re
import zipfile
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BOUNDARIES_FILE = ROOT / "maps" / "territory-boundaries.json"
SPECS_FILE = ROOT / "maps" / "territory-perimeter-specs.json"
CHECKLIST_FILE = ROOT / "scripts" / "territory-map-checklist.json"
EARTH_KML_DIR = ROOT / "maps" / "earth-kml"
OUT_TERR_DIR = ROOT / "maps" / "territorios"
COMBINED_KML = ROOT / "maps" / "jardim-elizabeth-territorios.kml"
COMBINED_KMZ = ROOT / "maps" / "jardim-elizabeth-territorios.kmz"

KML_NS = {"kml": "http://www.opengis.net/kml/2.2"}
KML_URI = "http://www.opengis.net/kml/2.2"

# Bbox aproximado da congregação (lat, lon)
CONG_BBOX = {"min_lat": -23.655, "max_lat": -23.620, "min_lon": -46.790, "max_lon": -46.750}

# Estilo cartão S-12-T / checklist Earth
EARTH_LINE_COLOR = "ffd600ff"  # amarelo ABGR
EARTH_FILL_COLOR = "46ffd600"  # ~28% opacidade

# Territórios que exigem polígono detalhado (cartão físico)
TERRITORY_EXPECTATIONS: dict[str, dict] = {
    "02": {"min_points": 6, "hint": "Laço Nelson Spilman / Zamitti Mammana"},
    "07": {"min_points": 5, "hint": "Borda leste irregular"},
    "10": {"min_polys": 3, "hint": "Três áreas verdes separadas"},
    "13": {"min_polys": 2, "hint": "Vários blocos CDHU"},
    "15": {"min_polys": 2, "hint": "Blocos CDHU + campo"},
}


def _tag(local: str) -> str:
    return f"{{{KML_URI}}}{local}"


def _findall(parent: ET.Element, tag: str) -> list[ET.Element]:
    local = _tag(tag)
    if parent.tag == local:
        return [parent]
    found = parent.findall(f".//{local}")
    if found:
        return found
    return parent.findall(f"kml:{tag}", KML_NS) or parent.findall(tag)


def _find(parent: ET.Element, tag: str) -> ET.Element | None:
    node = parent.find(_tag(tag))
    if node is not None:
        return node
    return parent.find(f"kml:{tag}", KML_NS) or parent.find(tag)


def load_territory_names() -> dict[str, str]:
    data = json.loads(CHECKLIST_FILE.read_text(encoding="utf-8"))
    return {t["num"]: t["name"] for t in data["territories"]}


def round_coord(value: float) -> float:
    return round(value, 6)


def normalize_ring(ring: list[list[float]]) -> list[list[float]]:
    return [[round_coord(lon), round_coord(lat)] for lon, lat in dedupe_ring(ring)]


def normalize_paths(paths: list[list[list[float]]]) -> list[list[list[float]]]:
    return [normalize_ring(ring) for ring in paths if len(dedupe_ring(ring)) >= 3]


def parse_coord_triplet(raw: str) -> tuple[float, float] | None:
    parts = raw.strip().split(",")
    if len(parts) < 2:
        return None
    try:
        lon = float(parts[0])
        lat = float(parts[1])
    except ValueError:
        return None
    if not (-180.0 <= lon <= 180.0 and -90.0 <= lat <= 90.0):
        return None
    return lon, lat


def parse_coordinates_text(text: str) -> list[list[float]]:
    ring: list[list[float]] = []
    for chunk in text.split():
        pt = parse_coord_triplet(chunk)
        if pt:
            ring.append([pt[0], pt[1]])
    return dedupe_ring(ring)


def dedupe_ring(ring: list[list[float]]) -> list[list[float]]:
    out: list[list[float]] = []
    for pt in ring:
        if not out or abs(out[-1][0] - pt[0]) > 1e-7 or abs(out[-1][1] - pt[1]) > 1e-7:
            out.append(pt)
    if len(out) >= 2 and abs(out[0][0] - out[-1][0]) < 1e-6 and abs(out[0][1] - out[-1][1]) < 1e-6:
        out.pop()
    return out


def ring_bbox(ring: list[list[float]]) -> dict[str, float]:
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    return {"min_lon": min(lons), "max_lon": max(lons), "min_lat": min(lats), "max_lat": max(lats)}


def ring_in_cong_bbox(ring: list[list[float]]) -> bool:
    bb = ring_bbox(ring)
    return (
        bb["min_lat"] >= CONG_BBOX["min_lat"] - 0.01
        and bb["max_lat"] <= CONG_BBOX["max_lat"] + 0.01
        and bb["min_lon"] >= CONG_BBOX["min_lon"] - 0.01
        and bb["max_lon"] <= CONG_BBOX["max_lon"] + 0.01
    )


def _orient(a, b, c) -> float:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _on_segment(a, b, c) -> bool:
    return (
        min(a[0], b[0]) - 1e-12 <= c[0] <= max(a[0], b[0]) + 1e-12
        and min(a[1], b[1]) - 1e-12 <= c[1] <= max(a[1], b[1]) + 1e-12
    )


def segments_cross(a1, a2, b1, b2) -> bool:
    o1 = _orient(a1, a2, b1)
    o2 = _orient(a1, a2, b2)
    o3 = _orient(b1, b2, a1)
    o4 = _orient(b1, b2, a2)
    if o1 == 0 and _on_segment(a1, a2, b1):
        return True
    if o2 == 0 and _on_segment(a1, a2, b2):
        return True
    if o3 == 0 and _on_segment(b1, b2, a1):
        return True
    if o4 == 0 and _on_segment(b1, b2, a2):
        return True
    return (o1 > 0) != (o2 > 0) and (o3 > 0) != (o4 > 0)


def ring_self_intersects(ring: list[list[float]]) -> bool:
    n = len(ring)
    if n < 4:
        return False
    for i in range(n):
        a1, a2 = ring[i], ring[(i + 1) % n]
        for j in range(i + 2, n):
            if i == 0 and j == n - 1:
                continue
            b1, b2 = ring[j], ring[(j + 1) % n]
            if segments_cross(a1, a2, b1, b2):
                return True
    return False


def ring_from_linear_ring(node: ET.Element | None) -> list[list[float]] | None:
    if node is None:
        return None
    coords = _find(node, "coordinates")
    if coords is None or not (coords.text or "").strip():
        return None
    ring = dedupe_ring(parse_coordinates_text(coords.text or ""))
    return ring if len(ring) >= 3 else None


def rings_from_geometry(node: ET.Element | None) -> list[list[list[float]]]:
    if node is None:
        return []

    rings: list[list[list[float]]] = []
    for poly in _findall(node, "Polygon"):
        outer = _find(poly, "outerBoundaryIs") or poly
        ring = ring_from_linear_ring(_find(outer, "LinearRing") or _find(poly, "LinearRing"))
        if ring:
            rings.append(ring)

    multi = _find(node, "MultiGeometry")
    if multi is not None:
        for child in list(multi):
            rings.extend(rings_from_geometry(child))

    for line in _findall(node, "LineString"):
        ring = ring_from_linear_ring(line)
        if ring and len(ring) >= 3:
            rings.append(ring)

    return rings


def infer_territory_num(*labels: str | None) -> str | None:
    for label in labels:
        if not label:
            continue
        text = label.strip()
        m = re.match(r"^T\s*(\d{1,2})\b", text, re.IGNORECASE)
        if m:
            return f"{int(m.group(1)):02d}"
        m = re.search(r"\bT(\d{2})\b", text, re.IGNORECASE)
        if m:
            return m.group(1)
    return None


def infer_num_from_path(path: Path) -> str | None:
    m = re.search(r"t(\d{2})", path.stem.lower())
    if m:
        return m.group(1)
    m = re.search(r"^(\d{2})$", path.stem)
    if m:
        return m.group(1)
    return None


def parse_kml_root(root: ET.Element, source_name: str) -> list[dict]:
    placemarks = root.findall(f".//{_tag('Placemark')}")
    if not placemarks:
        placemarks = [root]

    results: list[dict] = []
    for pm in placemarks:
        name_el = _find(pm, "name")
        name = (name_el.text or "").strip() if name_el is not None else ""
        num = infer_territory_num(name) or infer_num_from_path(Path(source_name))
        geom = _find(pm, "Polygon") or _find(pm, "MultiGeometry") or _find(pm, "LineString") or pm
        paths = normalize_paths(rings_from_geometry(geom))
        if not paths:
            continue
        results.append({"num": num, "name": name, "paths": paths, "source_file": source_name})
    return results


def parse_kml_file(path: Path) -> list[dict]:
    root = ET.parse(path).getroot()
    return parse_kml_root(root, path.name)


def parse_kml_bytes(data: bytes, source_name: str) -> list[dict]:
    root = ET.fromstring(data)
    return parse_kml_root(root, source_name)


def parse_kml_source(path: Path) -> list[dict]:
    if path.suffix.lower() == ".kmz":
        with zipfile.ZipFile(path) as zf:
            kml_names = [n for n in zf.namelist() if n.lower().endswith(".kml")]
            if not kml_names:
                return []
            data = zf.read(kml_names[0])
        return parse_kml_bytes(data, path.name)
    return parse_kml_file(path)


def assess_territory(num: str, paths: list[list[list[float]]], source_file: str) -> tuple[str, list[str]]:
    warnings: list[str] = []
    point_count = sum(len(p) for p in paths)
    poly_count = len(paths)

    if point_count <= 5:
        warnings.append(f"apenas {point_count} pontos - provavel rascunho OSM; refazer no Earth")

    for idx, ring in enumerate(paths, start=1):
        if not ring_in_cong_bbox(ring):
            warnings.append(f"poligono {idx} fora da area da congregacao")
        if ring_self_intersects(ring):
            warnings.append(f"poligono {idx} auto-intersecta (formato invalido)")

    exp = TERRITORY_EXPECTATIONS.get(num, {})
    if exp.get("min_points") and point_count < exp["min_points"]:
        warnings.append(f"esperado >= {exp['min_points']} pontos ({exp.get('hint', 'cartao')})")
    if exp.get("min_polys") and poly_count < exp["min_polys"]:
        warnings.append(f"esperado >= {exp['min_polys']} poligonos ({exp.get('hint', 'cartao')})")

    source = source_file.replace("\\", "/")
    from_earth = "earth-kml" in source.split("/")
    if warnings:
        quality = "needs_review"
    elif from_earth and point_count >= 8:
        quality = "earth"
    elif from_earth:
        quality = "earth"
    else:
        quality = "draft"

    return quality, warnings


def load_boundaries() -> dict:
    if not BOUNDARIES_FILE.exists():
        return {"version": 1, "source": "google-earth", "updated": None, "territories": {}}
    return json.loads(BOUNDARIES_FILE.read_text(encoding="utf-8"))


def save_boundaries(data: dict) -> None:
    data["version"] = 1
    data["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    BOUNDARIES_FILE.parent.mkdir(parents=True, exist_ok=True)
    BOUNDARIES_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def build_territory_entry(
    num: str,
    paths: list[list[list[float]]],
    names: dict[str, str],
    source_file: str,
    placemark_name: str = "",
) -> dict:
    quality, warnings = assess_territory(num, paths, source_file)
    point_count = sum(len(p) for p in paths)
    entry = {
        "name": names.get(num, placemark_name or f"T{num}"),
        "source_file": source_file,
        "paths": paths,
        "quality": quality,
        "note": f"Importado de {source_file} ({len(paths)} poligono(s), {point_count} pontos)",
    }
    if warnings:
        entry["warnings"] = warnings
    return entry


def features_from_boundaries(data: dict) -> list[dict]:
    names = load_territory_names()
    features: list[dict] = []
    for num in sorted(data.get("territories", {}), key=lambda n: int(n)):
        spec = data["territories"][num]
        paths = normalize_paths(spec.get("paths") or [])
        if not paths:
            continue
        quality = spec.get("quality")
        if not quality:
            quality, _ = assess_territory(num, paths, spec.get("source_file", ""))
        main = max(
            paths,
            key=lambda p: (max(x[0] for x in p) - min(x[0] for x in p))
            * (max(x[1] for x in p) - min(x[1] for x in p)),
        )
        features.append(
            {
                "num": num,
                "name": spec.get("name") or names.get(num, f"T{num}"),
                "poly": main,
                "polys": paths,
                "note": spec.get("note") or data.get("source") or "google-earth",
                "quality": quality,
            }
        )
    return features


def validate_boundaries(data: dict | None = None) -> list[dict]:
    data = data or load_boundaries()
    names = load_territory_names()
    issues: list[dict] = []

    territories = data.get("territories", {})
    for num in [f"{i:02d}" for i in range(1, 20)]:
        if num not in territories:
            issues.append({"num": num, "level": "error", "message": "territorio ausente"})
            continue
        spec = territories[num]
        paths = normalize_paths(spec.get("paths") or [])
        if not paths:
            issues.append({"num": num, "level": "error", "message": "sem poligono"})
            continue

        _, warnings = assess_territory(num, paths, spec.get("source_file", ""))
        for w in warnings:
            issues.append({"num": num, "level": "warn", "message": w})

        if spec.get("name") != names.get(num):
            issues.append(
                {
                    "num": num,
                    "level": "info",
                    "message": f"nome diverge do checklist: {spec.get('name')!r}",
                }
            )

    return issues


def placemark_kml(f: dict, style_url: str = "#terrStyle") -> str:
    num = str(f["num"]).zfill(2)
    polys = f.get("polys") or [f["poly"]]
    note = f.get("note") or "Perimetro Google Earth"
    quality = f.get("quality")
    if quality:
        note = f"[{quality}] {note}"

    if len(polys) == 1:
        poly = polys[0]
        coords = " ".join(f"{lon},{lat},0" for lon, lat in poly)
        coords += f" {poly[0][0]},{poly[0][1]},0"
        geom = (
            f"<Polygon><outerBoundaryIs><LinearRing><coordinates>{coords}</coordinates>"
            f"</LinearRing></outerBoundaryIs></Polygon>"
        )
    else:
        parts = []
        for poly in polys:
            coords = " ".join(f"{lon},{lat},0" for lon, lat in poly)
            coords += f" {poly[0][0]},{poly[0][1]},0"
            parts.append(
                f"<Polygon><outerBoundaryIs><LinearRing><coordinates>{coords}</coordinates>"
                f"</LinearRing></outerBoundaryIs></Polygon>"
            )
        geom = f"<MultiGeometry>{''.join(parts)}</MultiGeometry>"

    return f"""
    <Placemark>
      <name>T{num} - {f['name']}</name>
      <description><![CDATA[{note}]]></description>
      <styleUrl>{style_url}</styleUrl>
      {geom}
    </Placemark>"""


def build_kml(features: list[dict], doc_name: str, description: str = "") -> str:
    desc = description or "Poligonos importados do Google Earth (territory-boundaries.json)."
    style = f"""
    <Style id="terrStyle">
      <LineStyle><color>{EARTH_LINE_COLOR}</color><width>3.5</width></LineStyle>
      <PolyStyle><color>{EARTH_FILL_COLOR}</color></PolyStyle>
    </Style>"""
    placemarks = [placemark_kml(f) for f in features]
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>{doc_name}</name>
    <description>{desc}</description>
    {style}
    {''.join(placemarks)}
  </Document>
</kml>
"""


def write_kmz(kml: str, kmz_path: Path) -> None:
    kmz_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(kmz_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("doc.kml", kml)
