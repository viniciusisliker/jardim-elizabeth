(function () {
  const { formatDisplayDate } = window.JEAnnouncementDates;
  const {
    SECTION_TITLES,
    MIDWEEK_FIELDS,
    WEEKEND_FIELDS,
    WEEKEND_GROUPS
  } = window.JEAnnouncementSchemas;

  const MIDWEEK_SECTIONS = {
    header: 'Semana',
    tesouros: 'Tesouros da Palavra de Deus',
    ministerio: 'Faça seu melhor no ministério',
    vida: 'Nossa vida cristã'
  };

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const T = window.JEAnnouncementTheme || {
    header: '#002060', headerAlt: '#1F497D', accent: '#984806',
    sectionBg: '#EEECE1', cream: '#F7F6F2', border: '#1F497D', text: '#1B1C1C'
  };

  function hasValue(v) {
    return String(v ?? '').trim().length > 0;
  }

  function pdfCss() {
    return `
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; }
      .pdf-doc {
        width: 186mm;
        max-width: 186mm;
        font-family: Inter, Calibri, Arial, sans-serif;
        font-size: 8pt;
        line-height: 1.3;
        color: ${T.text};
        background: #fff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .pdf-cover {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: 4px 12px;
        margin-bottom: 8px;
        padding-bottom: 6px;
        border-bottom: 1.5px solid ${T.header};
      }
      .pdf-cover h1 {
        color: ${T.header};
        font-size: 12pt;
        font-weight: 800;
        margin: 0;
      }
      .pdf-cover p {
        margin: 0;
        color: #43474f;
        font-size: 8pt;
        font-weight: 600;
      }
      .pdf-cards-flow {
        column-count: 2;
        column-gap: 8px;
      }
      .pdf-card {
        break-inside: avoid;
        margin-bottom: 8px;
      }
      .pdf-full-width { column-span: all; }
      .qa-doc-panel {
        border: 1px solid rgba(31,73,125,.28);
        border-radius: 6px;
        overflow: hidden;
        background: #fff;
      }
      .qa-doc-banner--lite {
        background: ${T.sectionBg};
        border-left: 3px solid ${T.header};
        padding: 4px 8px;
      }
      .qa-doc-banner--lite h3 {
        font-size: 8.5pt;
        font-weight: 800;
        color: ${T.header};
        margin: 0;
        line-height: 1.25;
      }
      .qa-doc-banner--lite .weekday {
        color: ${T.headerAlt};
        font-weight: 600;
      }
      .qa-doc-body--flush { padding: 0; background: #fff; }
      .qa-table-block { border: none; border-radius: 0; }
      .qa-table-head {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        background: ${T.header};
        color: #fff;
        font-size: 5.5pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .qa-table-head span {
        padding: 3px 5px;
        border-right: 1px solid rgba(255,255,255,.12);
      }
      .qa-table-head span:last-child { border-right: none; }
      .qa-table-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        border-top: 1px solid #D9E2F3;
      }
      .qa-table-row .qa-cell {
        padding: 3px 5px;
        border-right: 1px solid #D9E2F3;
        min-height: 1.35rem;
      }
      .qa-table-row .qa-cell:last-child { border-right: none; }
      .qa-value-txt {
        font-size: 7.5pt;
        font-weight: 500;
        color: ${T.text};
        word-wrap: break-word;
        line-height: 1.25;
      }
      .qa-value-txt.is-empty { color: #b8bcc6; }
      .qa-section-compact { margin-bottom: 5px; }
      .qa-section-compact:last-child { margin-bottom: 0; }
      .qa-section-compact-title {
        font-size: 5.5pt;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: ${T.headerAlt};
        margin: 0 0 3px;
        padding-bottom: 2px;
        border-bottom: 1px solid #D9E2F3;
      }
      .qa-inline-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 2px 8px;
      }
      .qa-inline-grid.cols-1 { grid-template-columns: 1fr; }
      .qa-inline-item {
        font-size: 7pt;
        line-height: 1.3;
        margin: 0;
      }
      .qa-inline-item strong {
        color: ${T.headerAlt};
        font-weight: 700;
        font-size: 6pt;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .qa-doc-panel--stacked .qa-doc-body { padding: 6px 8px; background: #fff; }
      .qa-limpeza-compact {
        border: 1px solid rgba(152,72,6,.35);
        border-radius: 6px;
        overflow: hidden;
        margin-top: 6px;
        break-inside: avoid;
      }
      .qa-limpeza-compact-head {
        background: ${T.sectionBg};
        border-left: 3px solid ${T.accent};
        padding: 4px 8px;
        font-size: 7pt;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: ${T.accent};
      }
      .qa-limpeza-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 7.5pt;
      }
      .qa-limpeza-table th,
      .qa-limpeza-table td {
        border: 1px solid #D9E2F3;
        padding: 3px 6px;
        text-align: left;
      }
      .qa-limpeza-table th {
        background: ${T.header};
        color: #fff;
        font-size: 5.5pt;
        text-transform: uppercase;
        font-weight: 700;
      }
    `;
  }

  function wrapPdfDocument(inner) {
    return `<style>${pdfCss()}</style><div class="pdf-doc">${inner}</div>`;
  }

  function pdfCover(title, subtitle) {
    return `
      <header class="pdf-cover">
        <h1>${esc(title)}</h1>
        <p>${esc(subtitle)}</p>
      </header>`;
  }

  function pdfCellValue(value) {
    const raw = String(value ?? '').trim();
    return `<div class="qa-cell"><div class="qa-value-txt${raw ? '' : ' is-empty'}">${raw ? esc(raw) : '·'}</div></div>`;
  }

  function pdfMecanicasGrid(d) {
    return `
      <div class="qa-table-block">
        <div class="qa-table-head"><span>Portão</span><span>Indicador</span><span>Som</span></div>
        <div class="qa-table-row">${pdfCellValue(d.portao)}${pdfCellValue(d.indicador)}${pdfCellValue(d.som)}</div>
        <div class="qa-table-head"><span>Mic. 1</span><span>Mic. 2</span><span>Limpeza</span></div>
        <div class="qa-table-row">${pdfCellValue(d.microf_volantes_1)}${pdfCellValue(d.microf_volantes_2)}${pdfCellValue(d.limpeza_grupo)}</div>
      </div>`;
  }

  function pdfDateTitle(iso, weekday) {
    const date = iso ? formatDisplayDate(iso) : 'Sem data';
    return weekday
      ? `${esc(date)} <span class="weekday">· ${esc(weekday)}</span>`
      : esc(date);
  }

  function pdfMecanicasCard(entry) {
    const d = entry.data || {};
    return `
      <article class="qa-doc-panel pdf-card">
        <div class="qa-doc-banner qa-doc-banner--lite">
          <h3>${pdfDateTitle(entry.event_date, entry.weekday_label)}</h3>
        </div>
        <div class="qa-doc-body qa-doc-body--flush">${pdfMecanicasGrid(d)}</div>
      </article>`;
  }

  function pdfInlineField(label, value) {
    if (!hasValue(value)) return '';
    return `<p class="qa-inline-item"><strong>${esc(label)}:</strong> ${esc(value)}</p>`;
  }

  function pdfMidweekBody(d) {
    const sections = ['header', 'tesouros', 'ministerio', 'vida'];
    return sections.map((sec) => {
      const secFields = MIDWEEK_FIELDS.filter((f) => f.section === sec);
      const items = secFields.map((f) => pdfInlineField(f.label, d[f.key])).filter(Boolean).join('');
      if (!items) return '';
      return `
        <div class="qa-section-compact">
          <p class="qa-section-compact-title">${esc(MIDWEEK_SECTIONS[sec])}</p>
          <div class="qa-inline-grid">${items}</div>
        </div>`;
    }).join('');
  }

  function pdfWeekendBody(d) {
    const order = ['discurso', 'sentinela', 'sala_b', 'especial'];
    return order.map((gid) => {
      const meta = WEEKEND_GROUPS[gid];
      const groupFields = WEEKEND_FIELDS.filter((f) => f.group === gid);
      if (!groupFields.length || !meta) return '';
      const items = groupFields.map((f) => pdfInlineField(f.label, d[f.key])).filter(Boolean).join('');
      if (!items) return '';
      const gridClass = gid === 'especial' ? ' cols-1' : '';
      return `
        <div class="qa-section-compact">
          <p class="qa-section-compact-title">${esc(meta.title)}</p>
          <div class="qa-inline-grid${gridClass}">${items}</div>
        </div>`;
    }).join('');
  }

  function pdfStackedCard(entry, bodyHtml, extraTitle) {
    const title = extraTitle || pdfDateTitle(entry.event_date, entry.weekday_label);
    return `
      <article class="qa-doc-panel qa-doc-panel--stacked pdf-card">
        <div class="qa-doc-banner qa-doc-banner--lite">
          <h3>${title}</h3>
        </div>
        <div class="qa-doc-body">${bodyHtml || '<p class="qa-inline-item" style="color:#b8bcc6">Sem designações preenchidas</p>'}</div>
      </article>`;
  }

  function pdfLimpezaBlock(cleaningRows) {
    if (!cleaningRows.length) return '';
    const rows = cleaningRows.map((e) => {
      const d = e.data || {};
      return `<tr><td>${esc(d.fim_de_semana) || '·'}</td><td>${esc(d.grupo) || '·'}</td></tr>`;
    }).join('');
    return `
      <div class="qa-limpeza-compact pdf-full-width">
        <div class="qa-limpeza-compact-head">Limpeza mensal</div>
        <table class="qa-limpeza-table">
          <thead><tr><th>Fim de semana</th><th>Grupo</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderMecanicasHtml(board, entries, cleaningRows) {
    const month = board.reference_label || '';
    const list = entries.filter((e) => e.block === 'mecanicas').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    let body = pdfCover(SECTION_TITLES.mecanicas, `${month} — Jardim Elizabeth`);
    body += '<div class="pdf-cards-flow">';
    list.forEach((e) => { body += pdfMecanicasCard(e); });
    body += pdfLimpezaBlock(cleaningRows);
    body += '</div>';

    return wrapPdfDocument(body);
  }

  function renderMidweekHtml(board, entries) {
    const list = entries.filter((e) => e.block === 'midweek').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    let body = pdfCover(SECTION_TITLES.midweek, `${board.reference_label || ''} — Jardim Elizabeth`);
    body += '<div class="pdf-cards-flow">';
    list.forEach((e) => {
      const d = e.data || {};
      const reading = hasValue(d.leitura_biblica) ? ` — ${esc(d.leitura_biblica)}` : '';
      const title = `${pdfDateTitle(e.event_date, e.weekday_label)}${reading}`;
      const inner = pdfMidweekBody(d);
      body += pdfStackedCard(e, inner, title);
    });
    body += '</div>';
    return wrapPdfDocument(body);
  }

  function renderWeekendHtml(board, entries) {
    const list = entries.filter((e) => e.block === 'weekend').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    let body = pdfCover(SECTION_TITLES.weekend, `${board.reference_label || ''} — Jardim Elizabeth`);
    body += '<div class="pdf-cards-flow">';
    list.forEach((e) => {
      body += pdfStackedCard(e, pdfWeekendBody(e.data || {}));
    });
    body += '</div>';
    return wrapPdfDocument(body);
  }

  async function ensureHtml2Pdf() {
    if (window.html2pdf) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function htmlToPdfBlob(html) {
    await ensureHtml2Pdf();

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;left:0;top:0;width:210mm;height:297mm;border:0;visibility:hidden;pointer-events:none';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"></head><body>${html}</body></html>`);
    doc.close();

    await new Promise((resolve) => {
      const ready = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
      if (iframe.contentWindow?.document?.readyState === 'complete') ready();
      else iframe.addEventListener('load', ready, { once: true });
    });

    const target = doc.querySelector('.pdf-doc') || doc.body;

    try {
      return await window.html2pdf().set({
        margin: [8, 8, 8, 8],
        filename: 'quadro.pdf',
        image: { type: 'jpeg', quality: 0.94 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0
        },
        pagebreak: { mode: ['css', 'legacy'] },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(target).output('blob');
    } finally {
      iframe.remove();
    }
  }

  function renderHtml(block, board, entries) {
    const cleaning = entries.filter((e) => e.block === 'limpeza_mensal');
    if (block === 'mecanicas') return renderMecanicasHtml(board, entries, cleaning);
    if (block === 'midweek') return renderMidweekHtml(board, entries);
    return renderWeekendHtml(board, entries);
  }

  window.JEAnnouncementPdf = { renderHtml, htmlToPdfBlob, esc };
})();
