"""Generate migration to fix equipment_publishers UTF-8 via hex decode."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
seed = (ROOT / "supabase/manual/seed_equipment_publishers.sql").read_text(encoding="utf-8")

rows = []
for line in seed.splitlines():
    if not line.startswith("INSERT INTO public.equipment_publishers"):
        continue
    quoted = re.findall(r"'([^']*)'", line)
    if len(quoted) < 3:
        continue
    publisher_name = quoted[1]
    notes = quoted[-1]
    grupo = notes.split(" · ")[0].replace("Grupo:", "").strip()
    bools = re.search(r"',\s*(true|false),\s*(true|false)", line)
    can_carrinho = bools.group(1) if bools else "true"
    can_display = bools.group(2) if bools else "false"
    parts = publisher_name.split()
    prefix = publisher_name[:3]
    suffix = parts[-1] if len(parts) > 1 else ""
    rows.append((prefix, suffix, grupo, publisher_name, notes, can_carrinho, can_display))

out = ROOT / "supabase/migrations/20260609410000_fix_equipment_publishers_utf8_v2.sql"
lines = [
    "-- Corrige publisher_name e notes corrompidos (??) ao aplicar seed no Windows.",
    "",
]

for prefix, suffix, grupo, publisher_name, notes, can_carrinho, can_display in rows:
    name_hex = publisher_name.encode("utf-8").hex()
    notes_hex = notes.encode("utf-8").hex()
    prefix_sql = prefix.replace("'", "''")
    suffix_sql = suffix.replace("'", "''")
    grupo_sql = grupo.replace("'", "''")
    where = (
        f"notes ILIKE '%Grupo: {grupo_sql}%' "
        f"AND publisher_name ILIKE '{prefix_sql}%' "
        f"AND can_carrinho = {can_carrinho} "
        f"AND can_display = {can_display}"
    )
    if suffix:
        where += f" AND publisher_name ILIKE '%{suffix_sql}%'"
    lines.append(
        "UPDATE public.equipment_publishers SET "
        f"publisher_name = convert_from(decode('{name_hex}', 'hex'), 'UTF8'), "
        f"notes = convert_from(decode('{notes_hex}', 'hex'), 'UTF8') "
        f"WHERE {where};"
    )

out.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"Wrote {len(rows)} fixes to {out}")
