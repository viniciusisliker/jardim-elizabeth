(function () {
  const { formatDisplayDate } = window.JEAnnouncementDates;
  const {
    SECTION_TITLES,
    WEEKEND_FIELDS,
    WEEKEND_GROUPS
  } = window.JEAnnouncementSchemas;

  const MIDWEEK_THEME = {
    tesouros: {
      color: '#4A7190',
      bg: '#EEF3F8',
      border: 'rgba(74,113,144,.25)',
      title: 'Tesouros da Palavra de Deus',
      icon: '<svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><path d="M6 2h12a2 2 0 0 1 2 2v16l-7-3.5L6 20V4a2 2 0 0 1 2-2z"/></svg>'
    },
    ministerio: {
      color: '#8F7344',
      bg: '#F9F5EE',
      border: 'rgba(143,115,68,.28)',
      title: 'Faça seu melhor no ministério',
      icon: '<svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>'
    },
    vida: {
      color: '#9B4545',
      bg: '#FAF0F0',
      border: 'rgba(155,69,69,.25)',
      title: 'Nossa vida cristã',
      icon: '<svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'
    }
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
      .pdf-mecanicas-pages { display: block; }
      .pdf-mecanicas-sheet {
        display: flex;
        flex-direction: column;
        gap: 0;
        padding-bottom: 4mm;
      }
      .pdf-mecanicas-cards {
        display: flex;
        flex-direction: column;
        gap: 0;
      }
      .pdf-card {
        break-inside: avoid;
        page-break-inside: avoid;
        margin: 0;
        flex-shrink: 0;
      }
      .pdf-card-gap {
        display: block;
        height: 18px;
        min-height: 18px;
        width: 100%;
        background: #ffffff;
        flex-shrink: 0;
      }
      .html2pdf__page-break {
        display: block;
        height: 0;
        margin: 0;
        padding: 0;
        border: none;
        page-break-before: always;
        break-before: page;
      }
      .pdf-full-width { column-span: all; }
      .qa-doc-panel {
        border: 1px solid rgba(31,73,125,.28);
        border-radius: 6px;
        overflow: hidden;
        background: #fff;
      }
      .qa-doc-panel--editor {
        border: 2px solid ${T.header};
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,32,96,.1);
      }
      .qa-doc-banner {
        background: ${T.header};
        color: #fff;
        padding: 5px 8px;
      }
      .qa-doc-banner-meta {
        font-size: 5.5pt;
        opacity: 0.88;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin: 0 0 2px;
      }
      .qa-doc-banner h3 {
        font-size: 8.5pt;
        font-weight: 800;
        margin: 0;
        line-height: 1.2;
        color: #fff;
      }
      .qa-doc-banner h3 .weekday { opacity: 0.92; font-weight: 600; }
      .qa-doc-body {
        padding: 6px;
        background: ${T.cream};
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
      .qa-table-block {
        border: 1px solid ${T.border};
        border-radius: 6px;
        overflow: hidden;
        background: #fff;
      }
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
        font-weight: 600;
        color: ${T.text};
        word-wrap: break-word;
        line-height: 1.25;
        border: 1px solid #c3c6d0;
        border-radius: 4px;
        padding: 3px 5px;
        background: #fff;
        min-height: 1.2rem;
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
      .pdf-midweek-list { display: flex; flex-direction: column; gap: 14px; }
      .mw-week-card {
        break-inside: avoid;
        page-break-inside: avoid;
        background: #fff;
        border: 1px solid #C5D4E8;
        border-radius: 10px;
        padding: 10px 12px 12px;
        box-shadow: 0 2px 12px rgba(0,32,96,.07);
      }
      .mw-week-bar {
        display: flex;
        align-items: center;
        gap: 10px;
        background: linear-gradient(180deg, #EEF3F8 0%, #E8EEF5 100%);
        border: 1px solid #C5D4E8;
        border-radius: 10px;
        padding: 8px 12px;
        margin-bottom: 8px;
      }
      .mw-week-bar-icon {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #fff;
        border: 1px solid #C5D4E8;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 1px 4px rgba(0,32,96,.08);
      }
      .mw-week-bar-title {
        font-size: 10.5pt;
        font-weight: 800;
        color: ${T.header};
        margin: 0;
        line-height: 1.25;
        letter-spacing: -0.01em;
      }
      .mw-week-bar-sub {
        font-size: 6.5pt;
        font-weight: 600;
        color: ${T.headerAlt};
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin: 2px 0 0;
        opacity: 0.85;
      }
      .mw-week-meta {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px 10px;
        margin: 0 0 10px;
      }
      .mw-meta-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #fff;
        border: 1px solid #D9E2F3;
        border-radius: 999px;
        padding: 4px 11px;
        font-size: 7.5pt;
        color: #43474f;
        line-height: 1.2;
      }
      .mw-meta-chip strong {
        color: ${T.header};
        font-weight: 800;
        font-size: 6.5pt;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .mw-section {
        margin-bottom: 8px;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid rgba(0,0,0,.05);
      }
      .mw-section:last-of-type { margin-bottom: 0; }
      .mw-section--tesouros { background: #EEF3F8; border-color: rgba(74,113,144,.22); }
      .mw-section--ministerio { background: #F9F5EE; border-color: rgba(143,115,68,.22); }
      .mw-section--vida { background: #FAF0F0; border-color: rgba(155,69,69,.22); }
      .mw-section-head {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 5px 9px;
        border-bottom: 1px solid rgba(0,0,0,.06);
      }
      .mw-section--tesouros .mw-section-head { background: rgba(74,113,144,.1); }
      .mw-section--ministerio .mw-section-head { background: rgba(143,115,68,.1); }
      .mw-section--vida .mw-section-head { background: rgba(155,69,69,.1); }
      .mw-section-icon {
        width: 18px;
        height: 18px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .mw-section-title {
        font-size: 7pt;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        margin: 0;
        line-height: 1.2;
      }
      .mw-section-body { padding: 5px 8px 6px; }
      .mw-rows { display: flex; flex-direction: column; gap: 0; }
      .mw-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
        align-items: start;
        font-size: 7.5pt;
        line-height: 1.4;
        padding: 4px 0;
        border-bottom: 1px solid rgba(0,0,0,.05);
      }
      .mw-row:last-child { border-bottom: none; padding-bottom: 0; }
      .mw-row--solo { grid-template-columns: 1fr; }
      .mw-row-main .mw-num {
        font-weight: 800;
        margin-right: 3px;
        opacity: 0.75;
      }
      .mw-row-main strong { font-weight: 800; }
      .mw-section--tesouros .mw-row-main { color: #3A5F7A; }
      .mw-section--ministerio .mw-row-main { color: #7A6238; }
      .mw-section--vida .mw-row-main { color: #8A3A3A; }
      .mw-row-side {
        text-align: right;
        font-size: 6.5pt;
        color: #43474f;
        min-width: 36%;
        max-width: 44%;
        line-height: 1.35;
        background: rgba(255,255,255,.75);
        border: 1px solid rgba(31,73,125,.1);
        border-radius: 5px;
        padding: 3px 7px;
      }
      .mw-row-side strong {
        color: ${T.headerAlt};
        font-weight: 800;
        font-size: 6pt;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .mw-item-group { padding: 0; }
      .mw-row-sub {
        font-size: 6.5pt;
        color: #43474f;
        margin: -2px 0 4px 1.15em;
        padding-left: 0;
      }
      .mw-row-sub strong { color: #8A3A3A; font-weight: 800; }
      .mw-footer {
        margin-top: 10px;
        text-align: right;
        font-size: 7.5pt;
        color: #9B4545;
        background: #FAF0F0;
        border-radius: 6px;
        padding: 6px 10px;
        border-left: 3px solid #9B4545;
      }
      .mw-footer strong { font-weight: 800; }
      .mw-empty { color: #b8bcc6; font-style: italic; }
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

  function pdfMecanicasCard(entry, idx, total) {
    const d = entry.data || {};
    return `
      <article class="qa-doc-panel qa-doc-panel--editor pdf-card">
        <div class="qa-doc-banner">
          <div>
            <p class="qa-doc-banner-meta">Designações Mecânicas · ${idx + 1} de ${total}</p>
            <h3>${pdfDateTitle(entry.event_date, entry.weekday_label)}</h3>
          </div>
        </div>
        <div class="qa-doc-body">${pdfMecanicasGrid(d)}</div>
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

  function pdfMidweekAssign(num, label, assignee, sideHtml) {
    const assigneeHtml = val(assignee)
      ? `<strong>${esc(assignee)}</strong>`
      : valOrDot(assignee);
    const main = `${esc(label)} – ${assigneeHtml}`;
    return pdfMidweekRow(num, main, sideHtml, !sideHtml);
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
        <div class="mw-section-body">
          <div class="mw-rows">${rowsHtml}</div>
        </div>
      </section>`;
  }

  function pdfMidweekMeeting(entry) {
    const d = entry.data || {};
    const datePart = entry.event_date ? formatDisplayDate(entry.event_date) : 'Sem data';
    const weekday = val(entry.weekday_label);
    const reading = val(d.leitura_biblica);
    const weekTitle = reading
      ? `${esc(datePart)} – ${esc(reading.toUpperCase())}`
      : esc(datePart);

    const tesourosRows = [
      pdfMidweekAssign(1, val(d.tesouros_titulo) || 'Tesouros da Palavra de Deus', d.tesouros_designado, ''),
      pdfMidweekAssign(2, 'Joias espirituais', d.joias_designado, ''),
      pdfMidweekRow(
        3,
        `Leitura da Bíblia – ${valOrDot(d.leitura_biblia)}`,
        [
          val(d.dirigente_sala_b) ? `<div><strong>Dirigente Sala B:</strong> ${esc(d.dirigente_sala_b)}</div>` : '',
          val(d.leitura_biblia_sala_b) ? `<div><strong>Sala B:</strong> ${esc(d.leitura_biblia_sala_b)}</div>` : ''
        ].filter(Boolean).join('')
      )
    ].join('');

    const ministerioRows = [1, 2, 3].map((i) => {
      const tipo = d[`ministerio_${i}_tipo`];
      const designados = d[`ministerio_${i}_designados`];
      const salaB = d[`ministerio_${i}_sala_b`];
      const label = val(tipo) || `Parte ${i}`;
      const side = val(salaB) ? `<div><strong>Sala B:</strong> ${esc(salaB)}</div>` : '';
      return pdfMidweekAssign(i + 3, label, designados, side);
    }).join('');

    const item8 = `
      <div class="mw-item-group">
        ${pdfMidweekRow(8, 'Estudo bíblico de congregação', '', true)}
        ${val(d.leitor_sentinela) ? `<div class="mw-row-sub"><strong>Leitor:</strong> ${esc(d.leitor_sentinela)}</div>` : ''}
      </div>`;

    const vidaRows = [
      pdfMidweekAssign(7, val(d.vida_crista_titulo) || 'Nossa vida cristã', d.vida_crista_designado, ''),
      item8
    ].join('');

    const metaHtml = [
      val(d.cantico) ? `<span class="mw-meta-chip"><strong>Cântico</strong> ${esc(d.cantico)}</span>` : '',
      val(d.presidente) ? `<span class="mw-meta-chip"><strong>Presidente</strong> ${esc(d.presidente)}</span>` : ''
    ].filter(Boolean).join('');

    const metaBlock = metaHtml ? `<div class="mw-week-meta">${metaHtml}</div>` : '';

    const oracaoHtml = val(d.oracao_final)
      ? `<div class="mw-footer"><strong>Oração final</strong> – ${esc(d.oracao_final)}</div>`
      : '';

    return `
      <article class="mw-week-card pdf-card">
        <div class="mw-week-bar">
          <span class="mw-week-bar-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4A7190" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </span>
          <div>
            <h3 class="mw-week-bar-title">${weekTitle}</h3>
            ${weekday ? `<p class="mw-week-bar-sub">Reunião de meio de semana · ${esc(weekday)}</p>` : ''}
          </div>
        </div>
        ${metaBlock}
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

  function chunkEntries(list, size) {
    const chunks = [];
    for (let i = 0; i < list.length; i += size) chunks.push(list.slice(i, i + size));
    return chunks;
  }

  function renderMecanicasHtml(board, entries, cleaningRows) {
    const month = board.reference_label || '';
    const list = entries.filter((e) => e.block === 'mecanicas').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const sheets = chunkEntries(list, 3);

    let body = '<div class="pdf-mecanicas-pages">';
    let cardIndex = 0;

    sheets.forEach((sheetEntries, sheetIdx) => {
      if (sheetIdx > 0) body += '<div class="html2pdf__page-break"></div>';
      body += '<div class="pdf-mecanicas-sheet">';
      if (sheetIdx === 0) {
        body += pdfCover(SECTION_TITLES.mecanicas, `${month} — Jardim Elizabeth`);
      }
      body += '<div class="pdf-mecanicas-cards">';
      sheetEntries.forEach((e, i) => {
        if (i > 0) body += '<div class="pdf-card-gap" aria-hidden="true"></div>';
        body += pdfMecanicasCard(e, cardIndex, list.length);
        cardIndex += 1;
      });
      body += '</div>';
      body += '</div>';
    });

    if (cleaningRows.length) {
      body += '<div class="html2pdf__page-break"></div>';
      body += `<div class="pdf-mecanicas-sheet">${pdfLimpezaBlock(cleaningRows)}</div>`;
    }

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
        pagebreak: {
          mode: ['avoid-all', 'css', 'legacy'],
          before: '.html2pdf__page-break',
          avoid: ['.pdf-card', '.qa-doc-panel--editor', '.pdf-mecanicas-sheet']
        },
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
