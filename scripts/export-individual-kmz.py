#!/usr/bin/env python3
"""Exporta KMZ/KML por territorio a partir de maps/territory-boundaries.json."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.territory_boundaries import main  # noqa: F401

if __name__ == "__main__":
    sys.argv = ["territory-boundaries.py", "export", *sys.argv[1:]]
    main()
