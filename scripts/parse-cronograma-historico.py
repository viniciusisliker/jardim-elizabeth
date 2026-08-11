#!/usr/bin/env python3
"""Consolida cronogramas semanais em formato S-13-T."""
import re
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

HISTORICO = r"""
🗓 *TERRITÓRIOS - CRONOGRAMA SEMANAL*
*_Semana: 23/03 → 29/03_*
🔹*TERÇA*
*Dirigente:* _Alexsezar Tenório_
*Território:* _T5 - Jardim Elizabeth D_
🔹*QUARTA*
*Dirigente:* _Fábio Silva_
*Território:* _T18 - Jardim Helga C_
🔹*QUINTA*
*Dirigente:* _João Neves_
*Território:* _T2 - Jardim Elizabeth A_
🔹*SEXTA*
*Dirigente:* _Cosme Silva_
*Território:* _T9 - Jardim Helga E_
🔹*SÁBADO*
*Dirigente:* _Denison Oliveira_
*Território:* _T13 | T14 | T15 - CDHU [Convites]_
🔹*DOMINGO*
*Dirigente:* _Marcelo Freire e Edvan_
*Território:* _T10 - Jardim Leônidas Moreira A_
*Dirigente:* _Marcelo Almeida e João_
*Território:* _T3 - Jardim Elizabeth B_
*Dirigente:* _Denison e Arnaldo_
*Território:* _T11 - Jardim Leônidas Moreira B_

🗓 *TERRITÓRIOS - CRONOGRAMA SEMANAL*
*_Semana: 30/03 → 05/04_*
🔹*TERÇA*
*Dirigente:* _Alexsezar Tenório_
*Território:* _T6 - Jardim Pirajussara_
🔹*QUARTA*
*Dirigente:* _Fábio Silva_
*Território:* _T18 - Jardim Helga C_
🔹*QUINTA*
*Dirigente:* _João Neves_
*Território:* _T2 - Jardim Elizabeth A_
🔹*SEXTA*
*Dirigente:* _Cosme Silva_
*Território:* _T1 - Campo Limpo_
🔹*SÁBADO*
*Dirigente:* _Vinícius de Morais_
*Território:* _T4 - Jardim Elizabeth C_
🔹*DOMINGO*
*Dirigente:* _Marcelo Freire e Edvan_
*Território:* _T8 - Jardim Iracema B_
*Dirigente:* _Marcelo Almeida e João_
*Território:* _T3 - Jardim Elizabeth B_
*Dirigente:* _Denison e Arnaldo_
*Território:* _T11 - Jardim Leônidas Moreira B_

🗓 *TERRITÓRIOS - CRONOGRAMA SEMANAL*
*_Semana: 06/04 → 12/04_*
🔹*TERÇA*
*Dirigente:* _Alexsezar Tenório_
*Território:* _T6 - Jardim Pirajussara_
🔹*QUARTA*
*Dirigente:* _Fábio Silva_
*Território:* _T3 - Jardim Elizabeth B_
🔹*QUINTA*
*Dirigente:* _João Neves_
*Território:* _T2 - Jardim Elizabeth A_
🔹*SEXTA*
*Dirigente:* _Cosme Silva_
*Território:* _T5 - Jardim Elizabeth D_
🔹*SÁBADO*
*Dirigente:* _André Neves_
*Território:* _T7 e T8 - Iracema A e B [Continuação]_
🔹*DOMINGO*
*Dirigente:* _Marcelo Freire e Edvan_
*Território:* _T17 - Jardim Helga B_
*Dirigente:* _Marcelo Almeida e João_
*Território:* _T3 - Jardim Elizabeth B_
*Dirigente:* _Denison e Arnaldo_
*Território:* _T11 - Jardim Leônidas Moreira B_

🗓 *TERRITÓRIOS - CRONOGRAMA SEMANAL*
*_Semana: 13/04 → 19/04_*
🔹*TERÇA*
*Dirigente:* _Alexsezar Tenório_
*Território:* _T6 - Vila Pirajussara_
🔹*QUARTA*
*Dirigente:* _Fábio Silva_
*Território:* _T9 - Jardim Helga E_
🔹*QUINTA*
*Dirigente:* _João Neves_
*Território:* _T4 - Jardim Elizabeth C_
🔹*SEXTA*
*Dirigente:* _Cosme Silva_
*Território:* _T5 - Jardim Elizabeth D_
🔹*SÁBADO*
*Dirigente:* _Ademilson Dias_
*Território:* _T10 e T11 - Jardim Leônidas Moreira A e B_
🔹*DOMINGO*
*Dirigente:* _Marcelo Freire e Edvan_
*Território:* _[Especial] Visita dos Betelitas_
*Dirigente:* _Marcelo Almeida e João_
*Território:* _[Especial] Visita dos Betelitas_
*Dirigente:* _Denison e Arnaldo_
*Território:* _[Especial] Visita dos Betelitas_

🗓 *TERRITÓRIOS - CRONOGRAMA SEMANAL*
*_Semana: 20/04 → 26/04_*
🔹*TERÇA*
*Dirigente:* _Alexsezar Tenório_
*Território:* _T3 - Jardim Elizabeth B_
🔹*QUARTA*
*Dirigente:* _Fábio Silva_
*Território:* _T1 - Campo Limpo_
🔹*QUINTA*
*Dirigente:* _João Neves_
*Território:* _T4 - Jardim Elizabeth C_
🔹*SEXTA*
*Dirigente:* _Cosme Silva_
*Território:* _T5 - Jardim Elizabeth D_
🔹*SÁBADO*
*Dirigente:* _Cosme Silva_
*Território:* _T18 - Jardim Helga C_
🔹*DOMINGO*
*Dirigente:* _Marcelo Freire e Edvan_
*Território:* _T17 - Jardim Helga B_
*Dirigente:* _Marcelo Almeida e João_
*Território:* _T9 - Jardim Helga E_
*Dirigente:* _Denison e Arnaldo_
*Território:* _T7 - Jardim Iracema A_

🗓 *TERRITÓRIOS - CRONOGRAMA SEMANAL*
*_Semana: 27/04 → 03/05_*
🔹*TERÇA*
*Dirigente:* _Alexsezar Tenório_
*Território:* _T3 - Jardim Elizabeth B_
🔹*QUARTA*
*Dirigente:* _Fábio Silva_
*Território:* _T2 - Jardim Elizabeth A_
🔹*QUINTA*
*Dirigente:* _João Neves_
*Território:* _T11 - Jardim Leônidas Moreira B_
🔹*SEXTA*
*Dirigente:* _Cosme Silva_
*Território:* _T5 - Jardim Elizabeth D_
🔹*SÁBADO*
*Dirigente:* _A DEFINIR_
*Território:* _T19 - Jardim Helga D_
🔹*DOMINGO*
*Dirigente:* _Marcelo Freire e Edvan_
*Território:* _T12 - Jardim Leônidas Moreira C_
*Dirigente:* _Marcelo Almeida e João_
*Território:* _T8 - Jardim Iracema B_
*Dirigente:* _Marcelo Almeida e João_
*Território:* _T16 - Jardim Helga A_
*Dirigente:* _Denison e Arnaldo_
*Território:* _T7 - Jardim Iracema A_

🗓 *TERRITÓRIOS - CRONOGRAMA SEMANAL*
*_Semana: 04/05 → 10/05_*
🔹*TERÇA*
*Dirigente:* _Alexsezar Tenório_
*Território:* _T3 - Jardim Elizabeth B_
🔹*QUARTA*
*Dirigente:* _Fábio Silva_
*Território:* _T2 - Jardim Elizabeth A_
🔹*QUINTA*
*Dirigente:* _João Neves_
*Território:* _T11 - Jardim Leônidas Moreira B_
🔹*SEXTA*
*Dirigente:* _Cosme Silva_
*Território:* _T5 - Jardim Elizabeth D_
🔹*SÁBADO*
*Dirigente:* _João Neves_
*Território:* _T19 - Jardim Helga D_
🔹*DOMINGO*
*Dirigente:* _Marcelo Freire e Edvan_
*Território:* _T12 - Jardim Leônidas Moreira C_
*Dirigente:* _Marcelo Almeida e João_
*Território:* _T8 - Jardim Iracema B_
*Dirigente:* _Denison e Arnaldo_
*Território:* _T7 - Jardim Iracema A_

🗓 *TERRITÓRIOS - CRONOGRAMA SEMANAL*
*_Semana: 11/05 → 17/05_*
🔹*TERÇA*
*Dirigente:* _Alexsezar Tenório_
*Território:* _T4 - Jardim Elizabeth C_
🔹*QUARTA*
*Dirigente:* _Fábio Silva_
*Território:* _T9 - Jardim Helga E_
🔹*QUINTA*
*Dirigente:* _João Neves_
*Território:* _T11 - Jardim Leônidas Moreira B_
🔹*SEXTA*
*Dirigente:* _Cosme Silva_
*Território:* _T5 - Jardim Elizabeth D_
🔹*SÁBADO*
*Dirigente:* _Marcelo Freire_
*Território:* _T19 - Jardim Helga D_
🔹*DOMINGO*
*Dirigente:* _Marcelo Freire e Edvan_
*Território:* _T12 - Jardim Leônidas Moreira C_
*Dirigente:* _Marcelo Almeida e João_
*Território:* _T8 - Jardim Iracema B_
*Dirigente:* _Denison e Arnaldo_
*Território:* _T7 - Jardim Iracema A_

🗓 *TERRITÓRIOS - CRONOGRAMA SEMANAL*
*_Semana: 25/05 → 31/05_*
🔹*TERÇA*
*Dirigente:* _Alexsezar Tenório_
*Território:* _T4 - Jardim Elizabeth C_
🔹*QUARTA*
*Dirigente:* _Fábio Silva_
*Território:* _T1 - Campo Limpo_
🔹*QUINTA*
*Dirigente:* _João Neves_
*Território:* _T11 - Jardim Leônidas Moreira B_
🔹*SEXTA*
*Dirigente:* _Cosme Silva_
*Território:* _T5 - Jardim Elizabeth D_
🔹*SÁBADO*
*Dirigente:* _Lucas Dias_
*Território:* _T13 - CDHU A_
🔹*DOMINGO*
*Dirigente:* _Marcelo Freire e Edvan_
*Território:* _T12 - Jardim Leônidas Moreira C_
*Dirigente:* _Marcelo Almeida e João_
*Território:* _T18 - Jardim Helga C_
*Dirigente:* _Denison e Arnaldo_
*Território:* _T7 - Jardim Iracema A_

🗓 *TERRITÓRIOS - CRONOGRAMA SEMANAL*
*_Semana: 01/06 → 07/06_*
🔹*TERÇA*
*Dirigente:* _Alexsezar Tenório_
*Território:* _T2 - Jardim Elizabeth A_
🔹*QUARTA*
*Dirigente:* _Fábio Silva_
*Território:* _T3 - Jardim Elizabeth B_
🔹*QUINTA*
*Dirigente:* _João Neves_
*Território:* _T6 - Vila Pirajussara_
🔹*SEXTA - BETEL*
🔹*SÁBADO*
*Dirigente:* _Denison Oliveira_
*Território:* _T10 - Jardim Leônidas Moreira A_
🔹*DOMINGO*
*Dirigente:* _Marcelo Freire e Edvan_
*Território:* _T12 - Jardim Leônidas Moreira C_
*Dirigente:* _Marcelo Almeida e João_
*Território:* _T18 - Jardim Helga C_
*Dirigente:* _Denison e Arnaldo_
*Território:* _T19 - Jardim Helga D_

🗓 *TERRITÓRIOS - CRONOGRAMA SEMANAL*
*_Semana: 08/06 → 14/06_*
🔹*TERÇA*
*Dirigente:* _Alexsezar Tenório_
*Território:* _T02 - Jardim Elizabeth A_
🔹*QUARTA*
*Dirigente:* _Fábio Souza_
*Território:* _T03 - Jardim Elizabeth B_
🔹*QUINTA*
*Dirigente:* _João Neves_
*Território:* _T06 - Vila Pirajussara_
🔹*SEXTA*
*Dirigente:* _Cosme Silva_
*Território:* _T09 - Jardim Helga E_
🔹*SÁBADO*
*Dirigente:* _Vinícius de Morais_
*Território:* _T16 - Jardim Helga A_
🔹*DOMINGO*
*Dirigente:* _Marcelo Freire e Edvan_
*Território:* _T12 - Jd Leônidas Moreira C_
*Dirigente:* _Marcelo Almeida e João_
*Território:* _T17 - Jardim Helga B_
*Dirigente:* _Denison e Arnaldo_
*Território:* _T19 - Jardim Helga D_

🗓 *TERRITÓRIOS - CRONOGRAMA SEMANAL*
*_Semana: 15/06 → 21/06_*
🔹*TERÇA*
*Dirigente:* _Alexsezar Tenório_
*Território:* _T02 - Jardim Elizabeth A_
🔹*QUARTA*
*Dirigente:* _Fábio Souza_
*Território:* _T03 - Jardim Elizabeth B_
🔹*QUINTA*
*Dirigente:* _João Neves_
*Território:* _T06 - Vila Pirajussara_
🔹*SEXTA*
*Dirigente:* _Cosme Silva_
*Território:* _T01 - Campo Limpo_
🔹*SÁBADO*
*Dirigente:* _Marcelo Freire_
*Território:* _T14 - CDHU B_
🔹*DOMINGO*
*Dirigente:* _Denison e Arnaldo_
*Território:* _T18 - Jardim Helga C_
*Dirigente:* _Marcelo Freire e Edvan_
*Território:* _T04 - Jardim Elizabeth C_
*Dirigente:* _Marcelo Almeida e João_
*Território:* _T17 - Jardim Helga B_

🗓 *TERRITÓRIOS - CRONOGRAMA SEMANAL*
*_Semana: 22/06 → 28/06_*
🔹*TERÇA*
*Dirigente:* _Alexsezar Tenório_
*Território:* _T05 - Jardim Elizabeth D_
🔹*QUARTA*
*Dirigente:* _Fábio Souza_
*Território:* _T09 - Jardim Helga E_
🔹*QUINTA*
*Dirigente:* _João Neves_
*Território:* _T10 - Jd Leônidas Moreira A_
🔹*SEXTA*
*Dirigente:* _Cosme Silva_
*Território:* _T01 - Campo Limpo_
🔹*SÁBADO*
*Dirigente:* _André Neves_
*Território:* _T15 - CDHU C_
🔹*DOMINGO*
*Dirigente:* _Denison e Arnaldo_
*Território:* _T18 - Jardim Helga C_
*Dirigente:* _Marcelo Freire e Edvan_
*Território:* _T04 - Jardim Elizabeth C_
*Dirigente:* _Marcelo Almeida e João_
*Território:* _T17 - Jardim Helga B_

🗓 *TERRITÓRIOS - CRONOGRAMA SEMANAL*
*_Semana: 29/06 → 05/07_*
🔹*TERÇA*
*Dirigente:* _Alexsezar Tenório_
*Território:* _T05 - Jardim Elizabeth D_
🔹*QUARTA*
*Dirigente:* _Fábio Souza_
*Território:* _T02 - Jardim Elizabeth A_
🔹*QUINTA*
*Dirigente:* _João Neves_
*Território:* _T01 - Campo Limpo_
🔹*SEXTA*
*Dirigente:* _Cosme Silva_
*Território:* _T04 - Jardim Elizabeth C_
🔹*SÁBADO*
*Dirigente:* _A DEFINIR_
*Território:* _T18 - Jardim Helga C_
🔹*DOMINGO*
*Dirigente:* _Marcelo Freire e Edvan_
*Território:* _T10 - Jd Leônidas Moreira A_
*Dirigente:* _Marcelo Almeida e João_
*Território:* _T03 - Jardim Elizabeth B_
*Dirigente:* _Denison e Arnaldo_
*Território:* _T06 - Vila Pirajussara_

🗓 *TERRITÓRIOS - CRONOGRAMA SEMANAL*
*_Semana: 13/07 → 19/07_*
🔹*TERÇA*
*Dirigente:* _Alexsezar Tenório_
*Território:* _T11 - Jd Leônidas Moreira B_
🔹*QUARTA*
*Dirigente:* _Fábio Souza_
*Território:* _T12 - Jd Leônidas Moreira C_
🔹*QUINTA*
*Dirigente:* _João Neves_
*Território:* _T10 - Jd Leônidas Moreira A_
🔹*SEXTA | CONGRESSO*
🔹*SÁBADO | CONGRESSO*
🔹*DOMINGO | CONGRESSO*

🗓 *TERRITÓRIOS - CRONOGRAMA SEMANAL*
*_Semana: 27/07 → 02/08_*
🔹*TERÇA*
*Dirigente:* _Alexsezar Tenório_
*Território:* _T09 - Jardim Helga E_
🔹*QUARTA*
*Dirigente:* _Fábio Souza_
*Território:* _T04 - Jardim Elizabeth C_
🔹*QUINTA*
*Dirigente:* _João Neves_
*Território:* _T11 - Jd Leônidas Moreira B_
🔹*SEXTA*
*Dirigente:* _João Neves_
*Território:* _T11 - Jd Leônidas Moreira B_
🔹*SÁBADO*
*Dirigente:* _Rikael_
*Território:* _T12 - Jd Leônidas Moreira C_
"""

DAY_OFFSET = {
    "DOMINGO": 0,
    "TERÇA": 2,
    "TERCA": 2,
    "QUARTA": 3,
    "QUINTA": 4,
    "SEXTA": 5,
    "SÁBADO": 6,
    "SABADO": 6,
}

SKIP_PATTERNS = [
    r"\[especial\]",
    r"betel",
    r"congresso",
    r"a definir",
]


def parse_date(s):
    d, m = s.strip().split("/")
    return datetime(2026 if int(m) >= 3 else 2025, int(m), int(d))


def fmt(d):
    return d.strftime("%d/%m/%y")


def extract_territories(text):
    nums = []
    for m in re.finditer(r"T\s*0*(\d{1,2})", text, re.I):
        n = int(m.group(1))
        if 1 <= n <= 19:
            nums.append(n)
    return nums


def normalize_dirigente(name):
    name = name.strip()
    if name.lower() in ("a definir",):
        return None
    # Padronizar nomes comuns
    replacements = {
        "Fábio Souza": "Fábio Souza",
        "Fábio Silva": "Fábio Silva",
        "Denison e Arnaldo": "Denison e Arnaldo",
    }
    return replacements.get(name, name)


def should_skip_territory(text):
    t = text.lower()
    return any(re.search(p, t) for p in SKIP_PATTERNS)


def day_offset_from_label(day_label):
    normalized = day_label.upper().split("|")[0].split("-")[0].strip()
    normalized = normalized.replace("Á", "A").replace("Ç", "C")
    for key, off in DAY_OFFSET.items():
        if key in normalized:
            return off
    return None


def parse_historico(text):
    entries = []
    week_start = None
    current_day = None
    pending_dirigente = None

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        week_m = re.search(r"Semana:\s*(\d{2}/\d{2})", line)
        if week_m:
            week_start = parse_date(week_m.group(1))
            pending_dirigente = None
            continue

        day_m = re.search(r"🔹\*(.+?)\*", line)
        if day_m:
            current_day = day_m.group(1)
            pending_dirigente = None
            continue

        dir_m = re.search(r"\*Dirigente:\*\s*_(.+?)_", line)
        if dir_m:
            pending_dirigente = normalize_dirigente(dir_m.group(1))
            continue

        terr_m = re.search(r"\*Território:\*\s*_(.+?)_", line)
        if terr_m and pending_dirigente and week_start and current_day:
            territorio_txt = terr_m.group(1)
            if should_skip_territory(territorio_txt):
                pending_dirigente = None
                continue
            offset = day_offset_from_label(current_day)
            if offset is None:
                pending_dirigente = None
                continue
            work_date = week_start + timedelta(days=offset)
            for tnum in extract_territories(territorio_txt):
                entries.append(
                    {
                        "territory": tnum,
                        "dirigente": pending_dirigente,
                        "date": work_date,
                    }
                )
            pending_dirigente = None
    return entries


def merge_entries(entries):
    """Agrupa sessões consecutivas (mesmo território + dirigente, datas adjacentes ou <=7 dias)."""
    by_key = defaultdict(list)
    for e in entries:
        by_key[(e["territory"], e["dirigente"])].append(e["date"])

    merged = []
    for (tnum, dirigente), dates in by_key.items():
        dates = sorted(set(dates))
        start = dates[0]
        end = dates[0]
        for d in dates[1:]:
            if (d - end).days <= 7:
                end = d
            else:
                merged.append(
                    {"territory": tnum, "dirigente": dirigente, "start": start, "end": end}
                )
                start = end = d
        merged.append({"territory": tnum, "dirigente": dirigente, "start": start, "end": end})
    return merged


def build_s13_table(merged):
    by_territory = defaultdict(list)
    for m in merged:
        by_territory[m["territory"]].append(m)

    rows = []
    for tnum in range(1, 20):
        assignments = sorted(by_territory.get(tnum, []), key=lambda x: x["start"])
        ultima = fmt(assignments[-1]["end"]) if assignments else "—"
        rows.append({"num": f"{tnum:02d}", "ultima": ultima, "assignments": assignments})
    return rows


def print_markdown(rows):
    print("# Registro de Designação de Território — Ano de Serviço 2026")
    print()
    print("Período consolidado: **23/03/2026 a 02/08/2026** (cronogramas semanais)")
    print()
    print("| Terr. | Última concluída | Designação 1 | Designação 2 | Designação 3 | Designação 4+ |")
    print("|------:|------------------|--------------|--------------|--------------|---------------|")

    for row in rows:
        cells = []
        for a in row["assignments"][:4]:
            d_ini = fmt(a["start"])
            d_fim = fmt(a["end"])
            if d_ini == d_fim:
                cells.append(f"**{a['dirigente']}** · {d_ini}")
            else:
                cells.append(f"**{a['dirigente']}** · {d_ini} a {d_fim}")
        while len(cells) < 4:
            cells.append("")
        extra = ""
        if len(row["assignments"]) > 4:
            extra = f"+{len(row['assignments']) - 4} mais (ver detalhe)"
        print(
            f"| {row['num']} | {row['ultima']} | {cells[0]} | {cells[1]} | {cells[2]} | {cells[3] or extra} |"
        )

    print()
    print("## Detalhe completo por território")
    print()
    for row in rows:
        if not row["assignments"]:
            continue
        print(f"### Território {row['num']}")
        print(f"- **Última data concluída:** {row['ultima']}")
        for i, a in enumerate(row["assignments"], 1):
            d_ini = fmt(a["start"])
            d_fim = fmt(a["end"])
            print(f"- **Designação {i}:** {a['dirigente']} — designação {d_ini}, conclusão {d_fim}")
        print()


def print_s13_form(rows):
    print("\n" + "=" * 72)
    print("FORMATO PARA PREENCHER S-13-T (copiar manualmente)")
    print("=" * 72 + "\n")
    for row in rows:
        print(f"--- Terr. {row['num']} ---")
        print(f"  Última data concluída: {row['ultima']}")
        for i, a in enumerate(row["assignments"][:4], 1):
            print(f"  Coluna Designação {i}:")
            print(f"    Designado para: {a['dirigente']}")
            print(f"    Data designação: {fmt(a['start'])}")
            print(f"    Data conclusão:  {fmt(a['end'])}")
        if len(row["assignments"]) > 4:
            print(f"  ⚠ Mais {len(row['assignments']) - 4} designação(ões) — ver detalhe acima")
        print()


if __name__ == "__main__":
    import sys
    from io import StringIO

    entries = parse_historico(HISTORICO)
    merged = merge_entries(entries)
    rows = build_s13_table(merged)

    buf = StringIO()
    old_stdout = sys.stdout
    sys.stdout = buf
    print_markdown(rows)
    print_s13_form(rows)
    print(f"\nTotal de entradas brutas: {len(entries)}")
    print(f"Total de designações consolidadas: {sum(len(r['assignments']) for r in rows)}")
    sys.stdout = old_stdout
    output = buf.getvalue()

    out_path = ROOT / "registro-territorios-2026.md"
    out_path.write_text(output, encoding="utf-8")
    print(f"Gerado: {out_path}")
