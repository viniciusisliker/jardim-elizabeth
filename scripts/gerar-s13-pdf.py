#!/usr/bin/env python3
"""Gera uma única folha A4 do S-13-T definitivo."""
import importlib.util
import shutil
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]

# Reutiliza lógica de dados
spec = importlib.util.spec_from_file_location(
    "gerar", ROOT / "scripts" / "gerar-s13-definitivo.py"
)
gerar = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gerar)

FONT_DIR = Path(r"C:\Windows\Fonts")


class S13PDF(FPDF):
    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_auto_page_break(auto=False)
        self.add_font("Arial", "", str(FONT_DIR / "arial.ttf"))
        self.add_font("Arial", "B", str(FONT_DIR / "arialbd.ttf"))
        self.add_font("Arial", "I", str(FONT_DIR / "ariali.ttf"))

    def header(self):
        pass

    def footer(self):
        pass


def short_name(name, max_len=22):
    if len(name) <= max_len:
        return name
    replacements = {
        "Marcelo Almeida e João": "M. Almeida e João",
        "Marcelo Freire e Edvan": "M. Freire e Edvan",
        "Alexsezar Tenório": "Alexsezar Tenório",
        "Vinícius de Morais": "Vinícius",
        "Denison Oliveira": "Denison Oliveira",
    }
    return replacements.get(name, name[: max_len - 1] + "…")


def current_sheet(assignments, previous_date):
    """Retorna a folha corrente com até quatro designações mais recentes."""
    if not assignments:
        return previous_date, []
    last_date = gerar.fmt(assignments[-1]["conclusao"])
    if len(assignments) <= 4:
        return last_date, assignments
    return last_date, assignments[-4:]


def draw_centered(pdf, x, y, w, h, text, font_size=5.5, style=""):
    pdf.set_xy(x, y)
    pdf.set_font("Arial", style, font_size)
    pdf.cell(w, h, text, align="C")


def draw_main_table(pdf, by_territory):
    left = 10
    top = 35
    table_w = 190
    w_terr = 12
    w_last = 24
    w_block = (table_w - w_terr - w_last) / 4
    h_head_1 = 7
    h_head_2 = 8
    h_row = 10.2

    pdf.set_font("Arial", "B", 14)
    pdf.set_xy(left, 12)
    pdf.cell(table_w, 7, "REGISTRO DE DESIGNAÇÃO DE TERRITÓRIO", align="C")
    pdf.set_font("Arial", "B", 9)
    pdf.set_xy(left, 25)
    pdf.cell(30, 5, "Ano de Serviço:")
    pdf.set_font("Arial", "", 9)
    pdf.cell(18, 5, "2026", border="B", align="C")

    # Cabeçalho superior.
    pdf.set_draw_color(0)
    pdf.set_line_width(0.35)
    pdf.set_fill_color(225, 225, 225)
    pdf.rect(left, top, w_terr, h_head_1 + h_head_2, "DF")
    pdf.rect(left + w_terr, top, w_last, h_head_1 + h_head_2, "DF")
    draw_centered(pdf, left, top + 3, w_terr, 5, "Terr.", 5.5)
    draw_centered(pdf, left, top + 8, w_terr, 5, "n.º", 5.5)
    draw_centered(pdf, left + w_terr, top + 2, w_last, 5, "Última data", 5.5)
    draw_centered(pdf, left + w_terr, top + 7, w_last, 5, "concluída*", 5.5)

    x = left + w_terr + w_last
    for _ in range(4):
        pdf.rect(x, top, w_block, h_head_1, "DF")
        draw_centered(pdf, x, top + 1, w_block, 5, "Designado para", 5.4)
        half = w_block / 2
        pdf.rect(x, top + h_head_1, half, h_head_2, "DF")
        pdf.rect(x + half, top + h_head_1, half, h_head_2, "DF")
        draw_centered(pdf, x, top + 7, half, 4, "Data da", 4.5)
        draw_centered(pdf, x, top + 10.5, half, 4, "designação", 4.5)
        draw_centered(pdf, x + half, top + 7, half, 4, "Data da", 4.5)
        draw_centered(pdf, x + half, top + 10.5, half, 4, "conclusão", 4.5)
        x += w_block

    y = top + h_head_1 + h_head_2
    for tnum in range(1, 20):
        assignments = by_territory.get(tnum, [])
        last_date, form_a = current_sheet(
            assignments, gerar.ULTIMA_FOLHA_ANTERIOR[tnum]
        )
        pdf.rect(left, y, w_terr, h_row)
        pdf.rect(left + w_terr, y, w_last, h_row)
        draw_centered(pdf, left, y + 2.4, w_terr, 5, f"{tnum:02d}", 6.5)
        draw_centered(pdf, left + w_terr, y + 2.4, w_last, 5, last_date, 6)

        x = left + w_terr + w_last
        for i in range(4):
            pdf.rect(x, y, w_block, h_row)
            if i < len(form_a):
                a = form_a[i]
                designation_date = gerar.fmt(a["designacao"])
                completion_date = gerar.fmt(a["conclusao"])
                pdf.line(x, y + 5.2, x + w_block, y + 5.2)
                pdf.line(x + w_block / 2, y + 5.2, x + w_block / 2, y + h_row)
                draw_centered(
                    pdf, x, y + 0.5, w_block, 4.2, short_name(a["dirigente"], 19), 4.8
                )
                draw_centered(
                    pdf, x, y + 5.4, w_block / 2, 4, designation_date, 5
                )
                draw_centered(
                    pdf,
                    x + w_block / 2,
                    y + 5.4,
                    w_block / 2,
                    4,
                    completion_date,
                    5,
                )
            x += w_block
        y += h_row

    pdf.set_xy(left, y + 2)
    pdf.set_font("Arial", "", 6.5)
    pdf.multi_cell(
        table_w,
        3.2,
        "*Ao iniciar uma nova folha, use esta coluna para registrar a data em que "
        "cada território foi concluído pela última vez.",
    )
    pdf.set_xy(left, y + 9)
    pdf.set_font("Arial", "", 7)
    pdf.cell(table_w, 4, "S-13-T 01/22")


def draw_appendix(pdf, by_territory):
    overflow = []
    for tnum in range(1, 20):
        all_a = by_territory.get(tnum, [])
        _, omitted = gerar.pick_form_assignments(all_a)
        if omitted:
            overflow.append((tnum, omitted))

    if not overflow:
        return

    pdf.add_page()
    pdf.set_font("Arial", "B", 12)
    pdf.cell(0, 8, "Apêndice — Designações excedentes (5ª em diante)", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Arial", "", 9)
    pdf.multi_cell(
        0,
        5,
        "Territórios com mais de 4 saídas no período. Utilize folha complementar ou novo S-13-T "
        "para registrar estas designações.",
    )
    pdf.ln(3)

    col_w = [15, 55, 25, 25, 157]
    pdf.set_font("Arial", "B", 8)
    pdf.cell(col_w[0], 7, "Terr.", border=1, align="C")
    pdf.cell(col_w[1], 7, "Designado para", border=1, align="C")
    pdf.cell(col_w[2], 7, "Designação", border=1, align="C")
    pdf.cell(col_w[3], 7, "Conclusão", border=1, align="C")
    pdf.cell(col_w[4], 7, "", border=0)
    pdf.ln()

    pdf.set_font("Arial", "", 8)
    for tnum, omitted in overflow:
        for j, a in enumerate(omitted):
            d = gerar.fmt(a["designacao"])
            pdf.cell(col_w[0], 6, f"{tnum:02d}" if j == 0 else "", border=1, align="C")
            pdf.cell(col_w[1], 6, a["dirigente"], border=1)
            pdf.cell(col_w[2], 6, d, border=1, align="C")
            pdf.cell(col_w[3], 6, d, border=1, align="C")
            pdf.ln()


def draw_full_history(pdf, by_territory):
    pdf.add_page()
    pdf.set_font("Arial", "B", 12)
    pdf.cell(0, 8, "Histórico completo — todas as saídas (ordem cronológica)", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    pdf.set_font("Arial", "B", 8)
    pdf.cell(12, 7, "Terr.", border=1, align="C")
    pdf.cell(22, 7, "Data", border=1, align="C")
    pdf.cell(80, 7, "Dirigente", border=1)
    pdf.cell(0, 7, "Território / observação", border=1)
    pdf.ln()

    pdf.set_font("Arial", "", 7.5)
    for tnum in range(1, 20):
        all_a = by_territory.get(tnum, [])
        if not all_a:
            continue
        for j, a in enumerate(all_a):
            pdf.cell(12, 5.5, f"{tnum:02d}" if j == 0 else "", border=1, align="C")
            pdf.cell(22, 5.5, gerar.fmt(a["designacao"]), border=1, align="C")
            pdf.cell(80, 5.5, a["dirigente"], border=1)
            pdf.cell(0, 5.5, f"{len(all_a)} saída(s) no período" if j == 0 else "", border=1)
            pdf.ln()


def generate_pdf(out_path: Path):
    entries = gerar.parse_historico(gerar.HISTORICO)
    by_territory = gerar.build_assignments(entries)

    pdf = S13PDF()
    pdf.add_page()
    draw_main_table(pdf, by_territory)
    pdf.output(str(out_path))
    return out_path, len(entries)


if __name__ == "__main__":
    out = ROOT / "registro-territorios-2026-S13-DEFINITIVO.pdf"
    alias = ROOT / "S-13.pdf"
    path, total = generate_pdf(out)
    shutil.copy2(out, alias)
    print(f"Gerado: {path}")
    print(f"Gerado: {alias}")
    print(f"Total de saídas: {total}")
