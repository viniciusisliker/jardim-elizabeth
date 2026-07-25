#!/usr/bin/env python3
"""Gera prompts JSON para cartoes de territorio via IA."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECKLIST = ROOT / "scripts" / "territory-map-checklist.json"
SPECS = ROOT / "maps" / "territory-perimeter-specs.json"
OUT = ROOT / "maps" / "territory-ai-prompts.json"

ORIGINALS = ROOT / "img" / "territorios"

STYLE = (
    "Transform the attached ORIGINAL physical S-12-T territory map card scan into a premium 3D isometric "
    "aerial illustration. CRITICAL: preserve the EXACT territory boundary polygon shape, street layout, "
    "street names, and geographic proportions from the reference scan — do NOT invent a different perimeter. "
    "Keep cream/beige S-12-T card frame: header 'Cartão de Mapa de Território', subtitle "
    "'JARDIM ELIZABETH — SÃO PAULO', boxes Localidade and Terr. N.º with correct values. "
    "Replace flat green schematic or pasted map with photorealistic 3D neighborhood cutout, oblique bird's-eye, "
    "Brazilian São Paulo suburb, terracotta roofs, asphalt streets, lush trees, soft daylight shadows. "
    "Bright yellow semi-transparent overlay (25-30% opacity) with thick yellow border matching the reference "
    "boundary exactly. White street labels with black outline on roads. Footer Portuguese S-12-T text. "
    "Professional cartography, no watermarks, portrait card format."
)


def main() -> None:
    checklist = json.loads(CHECKLIST.read_text(encoding="utf-8"))["territories"]
    specs = json.loads(SPECS.read_text(encoding="utf-8"))["territories"]
    prompts = []
    for t in checklist:
        num = t["num"]
        spec = specs.get(num, {})
        streets = ", ".join(t.get("streets", [])[:8])
        perimeter = "; ".join(spec.get("perimeter", [])[:4])
        note = spec.get("note") or t.get("notes") or ""
        prompt = (
            f"{STYLE} Territory T{num} '{t['name']}'. "
            f"Boundary streets: {streets}. "
            f"Perimeter description: {perimeter}. {note}"
        )
        ref = ORIGINALS / f"t{num}.jpg"
        prompts.append({
            "num": num,
            "name": t["name"],
            "file": f"t{num}.jpg",
            "reference": str(ref.relative_to(ROOT)).replace("\\", "/"),
            "prompt": prompt,
        })
    OUT.write_text(json.dumps(prompts, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(prompts)} prompts -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
