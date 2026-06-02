(function () {
  const { formatDisplayDate } = window.JEAnnouncementDates;
  const {
    SECTION_TITLES,
    WEEKEND_FIELDS,
    WEEKEND_GROUPS
  } = window.JEAnnouncementSchemas;

  const MIDWEEK_THEME = {
    tesouros: { color: '#4A7190', icon: '◆', title: 'Tesouros da Palavra de Deus' },
    ministerio: { color: '#8F7344', icon: '❋', title: 'Faça seu melhor no ministério' },
    vida: { color: '#9B4545', icon: '●', title: 'Nossa vida cristã' }
  };

  function val(v) {
    return String(v ?? '').trim();
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function valOrDot(v) {
    const s = val(v);
    return s ? esc(s) : '<span class="mw-empty">·</span>';
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
      .pdf-midweek-list { display: flex; flex-direction: column; gap: 12px; }
      .mw-week-card {
        break-inside: avoid;
        page-break-inside: avoid;
        background: #fff;
      }
      .mw-week-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #E8EEF5;
        border: 1px solid #C5D4E8;
        border-radius: 8px;
        padding: 6px 10px;
        margin-bottom: 6px;
      }
      .mw-week-bar-icon {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #fff;
        border: 1px solid #C5D4E8;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        flex-shrink: 0;
      }
      .mw-week-bar-title {
        font-size: 9.5pt;
        font-weight: 800;
        color: ${T.header};
        margin: 0;
        line-height: 1.2;
      }
      .mw-week-meta {
        text-align: center;
        font-size: 7.5pt;
        color: #43474f;
        margin: 0 0 10px;
        line-height: 1.4;
      }
      .mw-week-meta strong { color: ${T.header}; font-weight: 700; }
      .mw-section { margin-bottom: 10px; }
      .mw-section:last-child { margin-bottom: 0; }
      .mw-section-head {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
      }
      .mw-section-icon {
        width: 16px;
        height: 16px;
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 8px;
        color: #fff;
        flex-shrink: 0;
      }
      .mw-section-title {
        font-size: 6.5pt;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin: 0;
        line-height: 1.2;
      }
      .mw-rows { display: flex; flex-direction: column; gap: 3px; }
      .mw-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: start;
        font-size: 7.5pt;
        line-height: 1.35;
      }
      .mw-row--solo { grid-template-columns: 1fr; }
      .mw-row-main { color: ${T.text}; }
      .mw-row-main .mw-num { font-weight: 800; margin-right: 2px; }
      .mw-row-main strong { font-weight: 700; }
      .mw-row-side {
        text-align: right;
        font-size: 6.5pt;
        color: #43474f;
        min-width: 38%;
        max-width: 42%;
        line-height: 1.35;
      }
      .mw-row-side strong { color: ${T.headerAlt}; font-weight: 700; }
      .mw-row-sub {
        font-size: 6.5pt;
        color: #43474f;
        margin-top: 1px;
        padding-left: 1.1em;
      }
      .mw-footer {
        margin-top: 8px;
        text-align: right;
        font-size: 7.5pt;
        color: #9B4545;
      }
      .mw-footer strong { font-weight: 800; }
      .mw-section--tesouros .mw-row-main { color: #4A7190; }
      .mw-section--ministerio .mw-row-main { color: #8F7344; }
      .mw-section--vida .mw-row-main { color: #9B4545; }
      .mw-empty { color: #b8bcc6; }
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

  function pdfMidweekRow(num, mainHtml, sideHtml, solo) {
    const side = sideHtml
      ? `<div class="mw-row-side">${sideHtml}</div>`
      : '';
    return `
      <div class="mw-row${solo || !sideHtml ? ' mw-row--solo' : ''}">
        <div class="mw-row-main"><span class="mw-num">${num}.</span> ${mainHtml}</div>
        ${side}
      </div>`;
  }

  function pdfMidweekSection(themeKey, rowsHtml) {
    if (!rowsHtml) return '';
    const theme = MIDWEEK_THEME[themeKey];
    return `
      <section class="mw-section mw-section--${themeKey}">
        <div class="mw-section-head">
          <span class="mw-section-icon" style="background:${theme.color}">${theme.icon}</span>
          <h4 class="mw-section-title" style="color:${theme.color}">${esc(theme.title)}</h4>
        </div>
        <div class="mw-rows">${rowsHtml}</div>
      </section>`;
  }

  function pdfMidweekMeeting(entry) {
    const d = entry.data || {};
    const datePart = entry.event_date ? formatDisplayDate(entry.event_date) : 'Sem data';
    const reading = val(d.leitura_biblica);
    const weekTitle = reading
      ? `${esc(datePart)} – ${esc(reading.toUpperCase())}`
      : esc(datePart);

    const tesourosRows = [
      pdfMidweekRow(1, `<strong>${valOrDot(d.tesouros_titulo)}</strong> – ${valOrDot(d.tesouros_designado)}`, '', true),
      pdfMidweekRow(2, `Joias espirituais – ${valOrDot(d.joias_designado)}`, '', true),
      pdfMidweekRow(
        3,
        `Leitura da Bíblia – ${valOrDot(d.leitura_biblia)}`,
        [
          val(d.dirigente_sala_b) ? `<div><strong>Dirigente Sala B:</strong> ${esc(d.dirigente_sala_b)}</div>` : '',
          val(d.leitura_biblia_sala_b) ? `<div><strong>Sala B:</strong> ${esc(d.leitura_biblia_sala_b)}</div>` : ''
        ].filter(Boolean).join('') || ''
      )
    ].join('');

    const ministerioRows = [1, 2, 3].map((i) => {
      const tipo = d[`ministerio_${i}_tipo`];
      const designados = d[`ministerio_${i}_designados`];
      const salaB = d[`ministerio_${i}_sala_b`];
      const label = val(tipo) || 'Designação';
      const side = val(salaB) ? `<div><strong>Sala B:</strong> ${esc(salaB)}</div>` : '';
      return pdfMidweekRow(i + 3, `<strong>${esc(label)}</strong> – ${valOrDot(designados)}`, side);
    }).join('');

    const item8 = `
      <div class="mw-item-group">
        ${pdfMidweekRow(8, 'Estudo bíblico de congregação', '', true)}
        ${val(d.leitor_sentinela) ? `<div class="mw-row-sub"><strong>Leitor:</strong> ${esc(d.leitor_sentinela)}</div>` : ''}
      </div>`;

    const vidaRows = [
      pdfMidweekRow(7, `<strong>${valOrDot(d.vida_crista_titulo)}</strong> – ${valOrDot(d.vida_crista_designado)}`, '', true),
      item8
    ].join('');

    const metaParts = [];
    if (val(d.cantico)) metaParts.push(`<strong>Cântico:</strong> ${esc(d.cantico)}`);
    if (val(d.presidente)) metaParts.push(`<strong>Presidente</strong> – ${esc(d.presidente)}`);
    const metaHtml = metaParts.length
      ? `<p class="mw-week-meta">${metaParts.join(' &nbsp;|&nbsp; ')}</p>`
      : '';

    const oracaoHtml = val(d.oracao_final)
      ? `<div class="mw-footer"><strong>Oração final</strong> – ${esc(d.oracao_final)}</div>`
      : '';

    return `
      <article class="mw-week-card pdf-card">
        <div class="mw-week-bar">
          <span class="mw-week-bar-icon" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4A7190" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </span>
          <h3 class="mw-week-bar-title">${weekTitle}</h3>
        </div>
        ${metaHtml}
        ${pdfMidweekSection('tesouros', tesourosRows)}
        ${pdfMidweekSection('ministerio', ministerioRows)}
        ${pdfMidweekSection('vida', vidaRows)}
        ${oracaoHtml}
      </article>`;
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
    body += '<div class="pdf-midweek-list">';
    list.forEach((e) => { body += pdfMidweekMeeting(e); });
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
