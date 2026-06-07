#!/usr/bin/env python3
"""Gera SQL de publicadores habilitados (aba Carrinho e Display)."""
import re
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "Gestão de Territórios – Congregação.xlsx"
OUT = ROOT / "supabase" / "manual" / "seed_equipment_publishers.sql"
SHEET = 10

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
DAY_COLS = {
    "H": "Terça",
    "I": "Quarta",
    "J": "Quarta",
    "K": "Quinta",
    "L": "Quinta",
    "M": "Sexta",
    "N": "Sexta",
    "O": "Sexta",
}
EQUIPMENT_DAYS = ["Terça", "Quarta", "Quinta", "Sexta"]

PROFILE_ALIASES = {
    "ademilson dias": "Ademilson",
    "ademilson": "Ademilson",
    "arnaldo": "Arnaldo Isliker",
    "andre neves": "André Neves",
    "cosme silva": "Cosme Silva",
    "edvan dantas": "Edvan Dantas",
    "fabio buri": "Fábio Buri",
    "joao neves": "João Neves",
    "marcelo freire": "Marcelo Freire",
    "marcelo isliker": "Marcelo Almeida",
    "matheus": "Matheus",
    "aerton": "Aerton",
    "alexsezar tenorio": "Alexsezar Tenório",
    "denison oliveira": "Denison Oliveira",
    "lucas dias": "Lucas Dias",
    "vinicius de morais": "Vinícius Isliker",
    "vinicius isliker": "Vinícius Isliker",
}


def norm(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFD", str(s))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s.strip().lower())


def sql_str(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def sql_array(items):
    if not items:
        return "ARRAY[]::text[]"
    inner = ", ".join(sql_str(x) for x in items)
    return f"ARRAY[{inner}]::text[]"


def parse_mark(val):
    v = (val or "").strip().lower()
    if not v:
        return False, False
    if v == "c":
        return True, False
    if v == "b":
        return True, True
    if v.startswith("a"):
        return False, True
    return False, False


def profile_match_sql(name):
    if not name:
        return "NULL"
    return (
        f"(SELECT id FROM public.profiles p WHERE "
        f"lower(trim(p.full_name)) = lower(trim({sql_str(name)})) "
        f"LIMIT 1)"
    )


def read_strings(z):
    shared = ET.fromstring(z.read("xl/sharedStrings.xml"))
    return [
        "".join((t.text or "") for t in si.findall(f".//{NS}t"))
        for si in shared.findall(f".//{NS}si")
    ]


def read_sheet_rows(z, strings, sheet_num):
    root = ET.fromstring(z.read(f"xl/worksheets/sheet{sheet_num}.xml"))
    rows = []
    for row in root.findall(f".//{NS}row"):
        cells = {}
        for c in row.findall(f"{NS}c"):
            ref = c.get("r", "")
            col = "".join(ch for ch in ref if ch.isalpha())
            v = c.find(f"{NS}v")
            if v is None:
                continue
            val = strings[int(v.text)] if c.get("t") == "s" else v.text
            cells[col] = val
        if cells:
            rows.append(cells)
    return rows


def parse_publisher(row):
    name = (row.get("A") or "").strip()
    if not name:
        return None

    can_c = can_d = False
    days = set()
    for col, day in DAY_COLS.items():
        val = row.get(col)
        if not (val or "").strip():
            continue
        c, d = parse_mark(val)
        can_c = can_c or c
        can_d = can_d or d
        if day in EQUIPMENT_DAYS:
            days.add(day)

    if not can_c and not can_d:
        return None

    grupo = (row.get("D") or "").strip()
    casa = (row.get("E") or "").strip()
    notes_parts = []
    if grupo:
        notes_parts.append(f"Grupo: {grupo}")
    if casa:
        notes_parts.append(f"Casa: {casa}")
    notes = " · ".join(notes_parts) or None

    ordered_days = [d for d in EQUIPMENT_DAYS if d in days]
    profile_name = PROFILE_ALIASES.get(norm(name), name)

    return {
        "name": name,
        "profile_name": profile_name,
        "can_carrinho": can_c,
        "can_display": can_d,
        "available_days": ordered_days,
        "notes": notes,
    }


def main():
    with zipfile.ZipFile(XLSX) as z:
        strings = read_strings(z)
        rows = read_sheet_rows(z, strings, SHEET)[1:]

    publishers = []
    seen = set()
    for row in rows:
        pub = parse_publisher(row)
        if not pub:
            continue
        key = norm(pub["name"])
        if key in seen:
            continue
        seen.add(key)
        publishers.append(pub)

    publishers.sort(key=lambda p: norm(p["name"]))

    assigned_profiles = set()
    for pub in publishers:
        alias = pub["profile_name"]
        key = norm(alias)
        if key in assigned_profiles:
            pub["profile_name"] = None
        else:
            assigned_profiles.add(key)

    lines = [
        "-- Seed: publicadores habilitados (aba Carrinho e Display)",
        "-- Gerado por scripts/import-equipment-publishers.py",
        "",
        "DELETE FROM public.equipment_publishers;",
        "",
    ]

    for pub in publishers:
        profile_sql = profile_match_sql(pub["profile_name"]) if pub["profile_name"] else "NULL"
        lines.append(
            f"INSERT INTO public.equipment_publishers "
            f"(profile_id, publisher_name, can_carrinho, can_display, available_days, is_active, notes) "
            f"VALUES ("
            f"{profile_sql}, "
            f"{sql_str(pub['name'])}, "
            f"{'true' if pub['can_carrinho'] else 'false'}, "
            f"{'true' if pub['can_display'] else 'false'}, "
            f"{sql_array(pub['available_days'])}, "
            f"true, "
            f"{sql_str(pub['notes'])}"
            f");"
        )

    lines.append("")
    lines.append(f"-- Total: {len(publishers)} publicadores")
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Gerado: {OUT} ({len(publishers)} publicadores)")


if __name__ == "__main__":
    main()
