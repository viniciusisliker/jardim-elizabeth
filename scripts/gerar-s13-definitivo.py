#!/usr/bin/env python3
"""Gera o S-13-T definitivo a partir dos cronogramas semanais."""
import re
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Importa o histórico bruto do script existente
import importlib.util

spec = importlib.util.spec_from_file_location(
    "parse_mod", ROOT / "scripts" / "parse-cronograma-historico.py"
)
parse_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parse_mod)

HISTORICO = parse_mod.HISTORICO
parse_date = parse_mod.parse_date
extract_territories = parse_mod.extract_territories
should_skip_territory = parse_mod.should_skip_territory
normalize_dirigente = parse_mod.normalize_dirigente

# Última data concluída na folha ANTERIOR (nov/dez 2025 – jan 2026), conforme S-13-T
ULTIMA_FOLHA_ANTERIOR = {
    1: "17/12/25",
    2: "28/12/25",
    3: "18/12/25",
    4: "30/12/25",
    5: "02/01/26",
    6: "21/12/25",
    7: "13/12/25",
    8: "30/11/25",
    9: "12/12/25",
    10: "07/12/25",
    11: "09/12/25",
    12: "21/12/25",
    13: "04/01/26",
    14: "16/11/25",
    15: "27/12/25",
    16: "07/12/25",
    17: "31/12/25",
    18: "21/12/25",
    19: "03/01/26",
}

# Semana começa na SEGUNDA (1º dia do intervalo = segunda-feira)
DAY_OFFSET_MONDAY = {
    "DOMINGO": 6,
    "TERÇA": 1,
    "TERCA": 1,
    "QUARTA": 2,
    "QUINTA": 3,
    "SEXTA": 4,
    "SÁBADO": 5,
    "SABADO": 5,
}

SKIP_PATTERNS = [
    r"\[especial\]",
    r"betel",
    r"congresso",
    r"a definir",
]


def fmt(d):
    return d.strftime("%d/%m/%y")


def day_offset(day_label):
    normalized = (
        day_label.upper()
        .split("|")[0]
        .split("-")[0]
        .strip()
        .replace("Á", "A")
        .replace("Ç", "C")
    )
    for key, off in DAY_OFFSET_MONDAY.items():
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
            if any(re.search(p, territorio_txt.lower()) for p in SKIP_PATTERNS):
                pending_dirigente = None
                continue
            offset = day_offset(current_day)
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


def build_assignments(entries):
    """Agrupa semanas consecutivas do mesmo território e dirigente."""
    raw_by_territory = defaultdict(list)
    for e in entries:
        raw_by_territory[e["territory"]].append(e)

    by_territory = defaultdict(list)
    for tnum, territory_entries in raw_by_territory.items():
        ordered = sorted(
            territory_entries, key=lambda item: (item["date"], item["dirigente"])
        )
        for entry in ordered:
            assignments = by_territory[tnum]
            previous = assignments[-1] if assignments else None
            continues_previous = (
                previous
                and previous["dirigente"] == entry["dirigente"]
                and 0 < (entry["date"] - previous["conclusao"]).days <= 7
            )
            if continues_previous:
                previous["conclusao"] = entry["date"]
            elif not (
                previous
                and previous["dirigente"] == entry["dirigente"]
                and previous["conclusao"] == entry["date"]
            ):
                assignments.append(
                    {
                        "dirigente": entry["dirigente"],
                        "designacao": entry["date"],
                        "conclusao": entry["date"],
                    }
                )
    return by_territory


def ultima_data_concluida(all_a, tnum):
    """Último dia em que o território foi trabalhado no período consolidado."""
    if all_a:
        return fmt(all_a[-1]["conclusao"])
    return ULTIMA_FOLHA_ANTERIOR.get(tnum, "—")


def pick_form_assignments(assignments, limit=4):
    """Monta a folha corrente com até quatro designações mais recentes."""
    if len(assignments) <= limit:
        return assignments, []
    return assignments[-limit:], assignments[:-limit]


def render_s13_document(by_territory):
    lines = []
    lines.append("# REGISTRO DE DESIGNAÇÃO DE TERRITÓRIO")
    lines.append("## Ano de Serviço 2026 · Congregação Jardim Elizabeth")
    lines.append("")
    lines.append("Documento gerado a partir dos cronogramas semanais (**23/03/2026 – 19/07/2026**).")
    lines.append("")
    lines.append("### Critérios aplicados")
    lines.append("")
    lines.append("- Semana começa na **segunda-feira** (1º dia do intervalo informado)")
    lines.append(
        "- Semanas consecutivas com o mesmo território e dirigente = **1 designação**; "
        "a primeira data é a designação e a última é a conclusão"
    )
    lines.append("- Ignorados: Betel, Congresso, Visita dos Betelitas, \"A DEFINIR\"")
    lines.append("- Coluna **Última data concluída** = **último dia trabalhado** no período (data de conclusão da designação mais recente)")
    lines.append("- Colunas de designação = **4 ocorrências mais recentes** em ordem cronológica")
    lines.append("- Semanas ausentes no histórico: **18/05–24/05** e **06/07–12/07**")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Formulário S-13-T — Preenchimento")
    lines.append("")

    # Tabela principal estilo formulário
    lines.append(
        "| Terr. | Última data concluída | "
        "Designado 1 | Desig. | Concl. | "
        "Designado 2 | Desig. | Concl. | "
        "Designado 3 | Desig. | Concl. | "
        "Designado 4 | Desig. | Concl. |"
    )
    lines.append("|------:|:---------------------:|---|:---:|:---:|---|:---:|:---:|---|:---:|:---:|---|:---:|:---:|")

    overflow = []

    for tnum in range(1, 20):
        all_a = by_territory.get(tnum, [])
        form_a, omitted = pick_form_assignments(all_a)
        ultima = ultima_data_concluida(all_a, tnum)

        cells = [f"**{tnum:02d}**", f"**{ultima}**"]
        for i in range(4):
            if i < len(form_a):
                a = form_a[i]
                cells.extend(
                    [
                        a["dirigente"],
                        fmt(a["designacao"]),
                        fmt(a["conclusao"]),
                    ]
                )
            else:
                cells.extend(["—", "—", "—"])

        lines.append("| " + " | ".join(cells) + " |")

        if omitted:
            overflow.append((tnum, omitted))

    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Copiar célula a célula (formato simplificado)")
    lines.append("")

    for tnum in range(1, 20):
        all_a = by_territory.get(tnum, [])
        form_a, omitted = pick_form_assignments(all_a)
        lines.append(f"### Território {tnum:02d}")
        ultima = ultima_data_concluida(all_a, tnum)
        lines.append(f"- **Última data concluída:** {ultima}")
        for i, a in enumerate(form_a, 1):
            designation = fmt(a["designacao"])
            completion = fmt(a["conclusao"])
            lines.append(
                f"- **Designação {i}:** {a['dirigente']} — "
                f"designação {designation}, conclusão {completion}"
            )
        if omitted:
            lines.append(
                f"- ⚠ *{len(omitted)} designação(ões) posterior(es) registrada(s) no apêndice*"
            )
        elif not all_a:
            lines.append("- *(sem designações no período)*")
        lines.append("")

    if overflow:
        lines.append("---")
        lines.append("")
        lines.append("## Apêndice — Designações anteriores à folha corrente")
        lines.append("")
        lines.append(
            "Registros anteriores às quatro designações exibidas na folha corrente."
        )
        lines.append("")
        for tnum, omitted in overflow:
            lines.append(f"### Território {tnum:02d}")
            for a in omitted:
                designation = fmt(a["designacao"])
                completion = fmt(a["conclusao"])
                lines.append(
                    f"- {a['dirigente']} — {designation} a {completion}"
                )
            lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## Histórico consolidado por território")
    lines.append("")
    for tnum in range(1, 20):
        all_a = by_territory.get(tnum, [])
        if not all_a:
            continue
        lines.append(f"### Território {tnum:02d} — {len(all_a)} designação(ões)")
        for a in all_a:
            designation = fmt(a["designacao"])
            completion = fmt(a["conclusao"])
            lines.append(
                f"- {designation} a {completion} · {a['dirigente']}"
            )
        lines.append("")

    lines.append("---")
    lines.append("")
    total = sum(len(v) for v in by_territory.values())
    lines.append(
        f"*Total: {total} designações consolidadas em "
        f"{sum(1 for v in by_territory.values() if v)} territórios.*"
    )
    lines.append("")
    lines.append("*Formulário S-13-T 01/22*")

    return "\n".join(lines)


if __name__ == "__main__":
    entries = parse_historico(HISTORICO)
    by_territory = build_assignments(entries)
    doc = render_s13_document(by_territory)

    out = ROOT / "registro-territorios-2026-S13-DEFINITIVO.md"
    out.write_text(doc, encoding="utf-8")
    print(f"Gerado: {out}")
    print(f"Entradas: {len(entries)} | Territórios com saídas: {sum(1 for v in by_territory.values() if v)}")
