#!/usr/bin/env python3
"""Importa KML/KMZ do Google Earth para maps/territory-boundaries.json."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.territory_boundaries import cmd_import, main  # noqa: F401

if __name__ == "__main__":
    sys.argv = ["territory-boundaries.py", "import", *sys.argv[1:]]
    main()
