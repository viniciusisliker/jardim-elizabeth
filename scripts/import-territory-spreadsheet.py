#!/usr/bin/env python3
"""Gera SQL de importacao a partir da Planilha Gestao Territorios."""
import json
import re
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "Gestão de Territórios – Congregação.xlsx"
OUT = ROOT / "supabase" / "manual" / "seed_from_spreadsheet.sql"

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

# Mapeamento manual: nome na planilha -> nome no Supabase profiles
PROFILE_ALIASES = {
    "ademilson dias": "Ademilson",
    "fabio silva": "Fábio Buri",
    "joao neves": "João Neves",
    "vinicius de morais": "Vinicius",
}

TERRITORY_NAME_ALIASES = {
    "campo limpo": "Jardim Campo Limpo",
    "jd leonidas moreira a": "Jd Leônidas Moreira A",
    "jd leonidas moreira b": "Jd Leônidas Moreira B",
    "jd leonidas moreira c": "Jd Leônidas Moreira C",
    "jardim leonidas moreira a": "Jd Leônidas Moreira A",
    "jardim leonidas moreira b": "Jd Leônidas Moreira B",
    "jardim leonidas moreira c": "Jd Leônidas Moreira C",
}


def db_territory_name(sheet_name):
    key = norm(sheet_name)
    return TERRITORY_NAME_ALIASES.get(key, sheet_name)


def norm(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFD", str(s))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s.strip().lower())


def excel_date(val):
    if val is None or val == "":
        return None
    try:
        n = float(val)
        if n > 40000:
            base = datetime(1899, 12, 30)
            return (base + timedelta(days=n)).date().isoformat()
    except (TypeError, ValueError):
        pass
    return None


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


def pref_key(label):
    n = norm(label)
    if "final" in n:
        return "final_de_semana"
    if "meio" in n:
        return "meio_de_semana"
    return "ambos"


def status_key(label):
    return "designado" if norm(label) == "designado" else "disponivel"


def sql_str(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def sql_json(obj):
    return "'" + json.dumps(obj, ensure_ascii=False).replace("'", "''") + "'::jsonb"


def parse_territory_ref(row):
    tid = (row.get("D") or "").strip()
    name = (row.get("E") or "").strip()
    num = None
    display = None
    m = re.match(r"^(T\s*\d+)", tid, re.I)
    if m:
        num = re.sub(r"\D", "", m.group(1)).lstrip("0") or "0"
    if " - " in tid:
        parts = tid.split(" - ", 1)
        if not num:
            num = re.sub(r"\D", "", parts[0]).lstrip("0") or "0"
        display = parts[1].strip()
    elif name and not re.match(r"^T\s*\d", name, re.I):
        display = name.strip()
    label = tid
    if name and not re.match(r"^T\s*\d", name, re.I):
        label = f"{tid} {name}".strip() if tid else name
    return num, display, label


def history_profile_name(raw):
    if not raw:
        return None
    n = norm(raw)
    if not n or n.startswith("a definir") or "assembleia" in n:
        return None
    return PROFILE_ALIASES.get(n, raw.strip())


def history_event_type(dirigente):
    if dirigente and "assembleia" in norm(dirigente):
        return "status"
    return "trabalho"


def territory_match_sql(num, display):
    clauses = []
    if display:
        db_name = db_territory_name(display)
        clauses.append(f"lower(trim(t.display_name)) = lower(trim({sql_str(db_name)}))")
    if num:
        clauses.append(f"t.num = lpad({sql_str(num)}, 2, '0')")
        clauses.append(f"t.num = {sql_str(num)}")
    if not clauses:
        return "NULL"
    return f"(SELECT id FROM public.territories t WHERE {' OR '.join(clauses)} LIMIT 1)"


def excel_time(val):
    if val is None or val == "":
        return None
    try:
        frac = float(val)
        if 0 <= frac < 1:
            total_min = int(round(frac * 24 * 60))
            return f"{total_min // 60:02d}:{total_min % 60:02d}"
    except (TypeError, ValueError):
        pass
    s = str(val).strip()
    return s or None


def is_schedule_row(row):
    day = (row.get("A") or "").strip()
    if not day:
        return False
    n = norm(day)
    return any(n.startswith(w) for w in ("terca", "quarta", "quinta", "sexta", "sabado", "domingo"))


def schedule_profile_fields(dirigente_raw):
    name = (dirigente_raw or "").strip()
    if not name:
        return "NULL", "NULL"
    if " e " in norm(name):
        return "NULL", sql_str(name)
    profile_name = PROFILE_ALIASES.get(norm(name), name)
    return profile_match_sql(profile_name), sql_str(name)


def territory_num_from_code(code):
    if not code:
        return None
    m = re.match(r"^(T\s*\d+)", str(code).strip(), re.I)
    if not m:
        return None
    return re.sub(r"\D", "", m.group(1)).lstrip("0") or "0"


def profile_match_sql(name):
    if not name:
        return "NULL"
    first = name.split()[0]
    return (
        f"(SELECT id FROM public.profiles p WHERE "
        f"lower(trim(p.full_name)) = lower(trim({sql_str(name)})) "
        f"OR lower(trim(p.full_name)) LIKE lower(trim({sql_str(first)})) || '%' "
        f"LIMIT 1)"
    )


def main():
    with zipfile.ZipFile(XLSX) as z:
        strings = read_strings(z)
        terr_rows = read_sheet_rows(z, strings, 3)[3:]  # skip header
        dirig_rows = read_sheet_rows(z, strings, 9)[3:]
        locais_rows = read_sheet_rows(z, strings, 7)[3:]
        semana_rows = read_sheet_rows(z, strings, 4)[1:]
        hist_rows = read_sheet_rows(z, strings, 5)[1:]

    lines = [
        "-- Seed importado da Planilha Gestao Territorios",
        "-- Idempotente: pode rodar novamente",
        "",
        "-- RLS: servos de territorios podem listar profiles para designacao",
        "DROP POLICY IF EXISTS profiles_territory_managers_select ON public.profiles;",
        "CREATE POLICY profiles_territory_managers_select ON public.profiles",
        "  FOR SELECT TO authenticated",
        "  USING (",
        "    id = auth.uid()",
        "    OR public.can_manage_territories()",
        "    OR public.get_my_role() IN ('anciao', 'servo_ministerial', 'superuser')",
        "  );",
        "",
        "-- Limpa designacoes ativas anteriores (reimportacao)",
        "UPDATE public.territory_active_assignments SET status = 'returned', returned_at = now() WHERE status = 'active';",
        "DELETE FROM public.territory_overseers;",
        "DELETE FROM public.territory_meeting_spots;",
        "DELETE FROM public.territory_week_schedule;",
        "DELETE FROM public.territory_assignments;",
        "DELETE FROM public.territory_history WHERE metadata->>'source' = 'spreadsheet';",
        "DELETE FROM public.territory_history WHERE event_type = 'designacao' AND territory_id IS NULL AND profile_id IS NULL AND metadata = '{}'::jsonb;",
        "",
    ]

    # Territorios
    for row in terr_rows:
        tid = row.get("A", "")
        if not tid or not str(tid).startswith("T"):
            continue
        name = row.get("B", "")
        tipo = row.get("C", "Meio de semana")
        last_work = excel_date(row.get("D"))
        occasion = row.get("G") or None
        status = status_key(row.get("H", "Disponível"))
        assignee = (row.get("I") or "").strip()
        assigned_at = excel_date(row.get("J"))
        log = row.get("N") or None

        db_name = db_territory_name(name)

        lines.append(
            f"UPDATE public.territories SET "
            f"display_name = {sql_str(db_name)}, "
            f"territory_type = {sql_str('final_de_semana' if 'final' in norm(tipo) else 'meio_de_semana')}, "
            f"best_occasion = {sql_str(occasion)}, "
            f"last_worked_at = {sql_str(last_work)}, "
            f"status = {sql_str(status)}, "
            f"observations = {sql_str(log)} "
            f"WHERE lower(trim(display_name)) = lower(trim({sql_str(db_name)}));"
        )

        if status == "designado" and assignee and " e " not in norm(assignee):
            profile_name = PROFILE_ALIASES.get(norm(assignee), assignee)
            lines.append(f"""
INSERT INTO public.territory_active_assignments (territory_id, profile_id, assigned_at, status)
SELECT t.id, p.id, {sql_str(assigned_at or last_work or datetime.now().date().isoformat())}, 'active'
FROM public.territories t
JOIN public.profiles p ON (
  lower(trim(p.full_name)) = lower(trim({sql_str(profile_name)}))
  OR lower(trim(p.full_name)) LIKE lower(trim({sql_str(profile_name.split()[0])})) || '%'
)
WHERE lower(trim(t.display_name)) = lower(trim({sql_str(db_name)}))
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.profile_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.territory_active_assignments a WHERE a.status = 'active' AND a.territory_id = t.id)
LIMIT 1;""")

    # Dirigentes
    for row in dirig_rows:
        name = (row.get("A") or "").strip()
        if not name or name.upper() == "EQUIPAMENTO":
            break
        pref = pref_key(row.get("B", "Meio de semana"))
        profile_name = PROFILE_ALIASES.get(norm(name), name)
        lines.append(f"""
INSERT INTO public.territory_overseers (profile_id, preference, is_active)
SELECT p.id, {sql_str(pref)}, true FROM public.profiles p
WHERE lower(trim(p.full_name)) = lower(trim({sql_str(profile_name)}))
   OR lower(trim(p.full_name)) LIKE lower(trim({sql_str(profile_name.split()[0])})) || '%'
ON CONFLICT (profile_id) DO UPDATE SET preference = EXCLUDED.preference, is_active = true;""")

    # Locais de encontro (para na linha EQUIPAMENTO)
    sort = 0
    for row in locais_rows:
        day = (row.get("A") or "").strip()
        loc = (row.get("B") or "").strip()
        if not day or not loc:
            continue
        if day.upper() == "EQUIPAMENTO" or norm(day) in ("nome", "display"):
            break
        addr = row.get("C") or None
        times = excel_time(row.get("D"))
        sort += 1
        lines.append(
            f"INSERT INTO public.territory_meeting_spots (weekday_label, location_name, address, schedule_times, sort_order) "
            f"VALUES ({sql_str(day)}, {sql_str(loc)}, {sql_str(addr)}, {sql_str(times)}, {sort});"
        )

    # Cronograma semanal (aba Cronograma — sheet 4)
    sort = 0
    for row in semana_rows:
        if not is_schedule_row(row):
            continue
        sort += 1
        day = (row.get("A") or "").strip()
        dirigente = row.get("B") or ""
        terr_code = (row.get("C") or "").strip()
        loc = row.get("D") or None
        times = excel_time(row.get("E"))
        sugg = row.get("F") or None
        sugg_note = row.get("G") or None
        obs = row.get("H") or None
        num = territory_num_from_code(terr_code)
        prof_sql, dir_name_sql = schedule_profile_fields(dirigente)
        terr_id_sql = territory_match_sql(num, None) if num else "NULL"
        lines.append(
            f"INSERT INTO public.territory_week_schedule (weekday_label, sort_order, profile_id, dirigente_name, "
            f"territory_id, territory_code, location_name, schedule_times, suggestion, suggestion_note, observations) "
            f"VALUES ({sql_str(day)}, {sort}, {prof_sql}, {dir_name_sql}, {terr_id_sql}, "
            f"{sql_str(terr_code) if terr_code else 'NULL'}, {sql_str(loc)}, {sql_str(times)}, "
            f"{sql_str(sugg)}, {sql_str(sugg_note)}, {sql_str(obs)});"
        )

    # Historico completo da planilha
    for row in hist_rows:
        if not row.get("A"):
            continue
        dt = excel_date(row.get("A"))
        if not dt:
            continue
        weekday = (row.get("B") or "").strip() or None
        dirigente_raw = (row.get("C") or "").strip()
        obs = (row.get("F") or "").strip() or None
        num, display, terr_label = parse_territory_ref(row)
        profile_name = history_profile_name(dirigente_raw)
        event_type = history_event_type(dirigente_raw)

        detail_parts = [weekday, dirigente_raw, terr_label]
        details = " · ".join(p for p in detail_parts if p)
        metadata = {
            "source": "spreadsheet",
            "weekday": weekday,
            "dirigente_name": dirigente_raw or None,
            "territory_label": terr_label or None,
            "territory_num": num,
            "observations": obs,
        }

        lines.append(
            f"INSERT INTO public.territory_history (event_type, event_date, territory_id, profile_id, details, metadata) "
            f"VALUES ({sql_str(event_type)}, {sql_str(dt)}, {territory_match_sql(num, display)}, "
            f"{profile_match_sql(profile_name)}, {sql_str(details)}, {sql_json(metadata)});"
        )

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Gerado: {OUT} ({len(lines)} linhas)")


if __name__ == "__main__":
    main()
