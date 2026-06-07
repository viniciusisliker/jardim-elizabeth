"""Generate targeted migration for remaining corrupted equipment_publishers rows."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# corrupted publisher_name in DB -> correct (name, notes) from seed
FIXES = [
    ("Ala??de", "Alaíde", "Grupo: Iracema · Casa: Helena"),
    ("Alexsezar Ten??rio", "Alexsezar Tenório", "Grupo: Iracema · Casa: Helena"),
    ("Andr?? Neves", "André Neves", "Grupo: Leonidas · Casa: Natividade"),
    ("Cl??udia Aguiar", "Cláudia Aguiar", "Grupo: Leonidas · Casa: Natividade"),
    ("Cl??udia Vieira", "Cláudia Vieira", "Grupo: Elizabeth · Casa: Natividade"),
    ("F??bio Buri", "Fábio Buri", "Grupo: Pirajussara · Casa: Lúcia"),
    ("F??bio Silva", "Fábio Silva", "Grupo: Elizabeth · Casa: Natividade"),
    ("In??s", "Inês", "Grupo: Elizabeth · Casa: Natividade"),
    ("Jo??o Neves", "João Neves", "Grupo: Leonidas · Casa: Natividade"),
    ("Jos??", "José", "Grupo: Pirajussara · Casa: Lúcia"),
    ("L??cia Duarte", "Lúcia Duarte", "Grupo: Campo Limpo · Casa: Lúcia"),
    ("Lucin??ia", "Lucinéia", "Grupo: Iracema · Casa: Helena"),
    ("Mar??lia", "Marília", "Grupo: Pirajussara · Casa: Lúcia"),
    ("Marcelo Isliker", "Marcelo Isliker", "Grupo: Pirajussara · Casa: Lúcia"),
    ("Ros??ngela", "Rosângela", "Grupo: Helga · Casa: Helena"),
    ("S??nia", "Sônia", "Grupo: Pirajussara · Casa: Lúcia"),
    ("Vin??cius de Morais", "Vinícius de Morais", "Grupo: Iracema · Casa: Helena"),
    ("Ygor In??cio", "Ygor Inácio", "Grupo: Helga · Casa: Helena"),
]

out = ROOT / "supabase/migrations/20260609420000_fix_equipment_publishers_utf8_remainder.sql"
lines = ["-- Corrige os publicadores que ainda tinham ?? após fix parcial.", ""]

for bad_name, good_name, notes in FIXES:
    bad_sql = bad_name.replace("'", "''")
    name_hex = good_name.encode("utf-8").hex()
    notes_hex = notes.encode("utf-8").hex()
    if bad_name == good_name:
        lines.append(
            "UPDATE public.equipment_publishers SET "
            f"notes = convert_from(decode('{notes_hex}', 'hex'), 'UTF8') "
            f"WHERE publisher_name = '{bad_sql}';"
        )
    else:
        lines.append(
            "UPDATE public.equipment_publishers SET "
            f"publisher_name = convert_from(decode('{name_hex}', 'hex'), 'UTF8'), "
            f"notes = convert_from(decode('{notes_hex}', 'hex'), 'UTF8') "
            f"WHERE publisher_name = '{bad_sql}';"
        )

out.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"Wrote {len(FIXES)} fixes")
