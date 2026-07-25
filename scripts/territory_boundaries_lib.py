"""Utilitários compartilhados: KML do Google Earth ↔ territory-boundaries.json ↔ KMZ."""
from __future__ import annotations

import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BOUNDARIES_FILE = ROOT / "maps" / "territory-boundaries.json"
CHECKLIST_FILE = ROOT / "scripts" / "territory-map-checklist.json"
EARTH_KML_DIR = ROOT / "maps" / "earth-kml"
OUT_TERR_DIR = ROOT / "maps" / "territorios"
COMBINED_KML = ROOT / "maps" / "jardim-elizabeth-territorios.kml"
COMBINED_KMZ = ROOT / "maps" / "jardim-elizabeth-territorios.kmz"

KML_NS = {"kml": "http://www.opengis.net/kml/2.2"}
KML_URI = "http://www.opengis.net/kml/2.2"


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
        m = re.search(r"\bT?\s*0?(\d{1,2})\b", text, re.IGNORECASE)
        if m:
            return f"{int(m.group(1)):02d}"
        m = re.search(r"\bt(\d{2})\b", text.lower())
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


def parse_kml_file(path: Path) -> list[dict]:
    root = ET.parse(path).getroot()
    placemarks = root.findall(f".//{_tag('Placemark')}")
    if not placemarks:
        placemarks = [root]

    results: list[dict] = []
    for pm in placemarks:
        name_el = _find(pm, "name")
        name = (name_el.text or "").strip() if name_el is not None else ""
        num = infer_territory_num(name, path.stem) or infer_num_from_path(path)
        geom = _find(pm, "Polygon") or _find(pm, "MultiGeometry") or _find(pm, "LineString") or pm
        paths = rings_from_geometry(geom)
        if not paths:
            continue
        results.append({"num": num, "name": name, "paths": paths, "source_file": path.name})
    return results


def parse_kml_source(path: Path) -> list[dict]:
    if path.suffix.lower() == ".kmz":
        with zipfile.ZipFile(path) as zf:
            kml_names = [n for n in zf.namelist() if n.lower().endswith(".kml")]
            if not kml_names:
                return []
            data = zf.read(kml_names[0])
        tmp_path = path.with_suffix(".kml")
        tmp_path.write_bytes(data)
        try:
            return parse_kml_file(tmp_path)
        finally:
            tmp_path.unlink(missing_ok=True)
    return parse_kml_file(path)


def load_boundaries() -> dict:
    if not BOUNDARIES_FILE.exists():
        return {"version": 1, "source": "google-earth", "updated": None, "territories": {}}
    return json.loads(BOUNDARIES_FILE.read_text(encoding="utf-8"))


def save_boundaries(data: dict) -> None:
    data["version"] = 1
    data["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    BOUNDARIES_FILE.parent.mkdir(parents=True, exist_ok=True)
    BOUNDARIES_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def features_from_boundaries(data: dict) -> list[dict]:
    names = load_territory_names()
    features: list[dict] = []
    for num in sorted(data.get("territories", {}), key=lambda n: int(n)):
        spec = data["territories"][num]
        paths = spec.get("paths") or []
        if not paths:
            continue
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
            }
        )
    return features


def placemark_kml(f: dict) -> str:
    num = str(f["num"]).zfill(2)
    polys = f.get("polys") or [f["poly"]]
    note = f.get("note") or "Perimetro Google Earth"
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
      <Style>
        <LineStyle><color>ff00d6ff</color><width>3.5</width></LineStyle>
        <PolyStyle><color>4600d6ff</color></PolyStyle>
      </Style>
      {geom}
    </Placemark>"""


def build_kml(features: list[dict], doc_name: str, description: str = "") -> str:
    desc = description or "Poligonos importados do Google Earth (territory-boundaries.json)."
    placemarks = [placemark_kml(f) for f in features]
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>{doc_name}</name>
    <description>{desc}</description>
    {''.join(placemarks)}
  </Document>
</kml>
"""


def write_kmz(kml: str, kmz_path: Path) -> None:
    kmz_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(kmz_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("doc.kml", kml)
