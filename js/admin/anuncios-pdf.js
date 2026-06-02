(function () {
  const { formatDisplayDate } = window.JEAnnouncementDates;
  const {
    SECTION_TITLES,
    MECANICAS_FIELDS,
    MIDWEEK_FIELDS,
    WEEKEND_FIELDS,
    WEEKEND_GROUPS
  } = window.JEAnnouncementSchemas;

  const MIDWEEK_SECTIONS = {
    header: { title: 'Semana', icon: 'calendar_today' },
    tesouros: { title: 'Tesouros da Palavra de Deus', icon: 'auto_stories' },
    ministerio: { title: 'Faça seu melhor no ministério', icon: 'diversity_3' },
    vida: { title: 'Nossa vida cristã', icon: 'favorite' }
  };

  const BLOCK_TITLES = {
    mecanicas: 'Designações Mecânicas',
    midweek: 'Nossa Vida e Ministério Cristão',
    weekend: 'Discurso Público e Sentinela'
  };

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const T = window.JEAnnouncementTheme || {
    header: '#002060', headerAlt: '#1F497D', headerText: '#FFFFFF',
    accent: '#984806', sectionBg: '#EEECE1', rowAlt: '#D9E2F3', cream: '#F7F6F2', border: '#1F497D', text: '#1B1C1C'
  };

  function editorMirrorCss() {
    return `
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; }
      .pdf-doc {
        width: 186mm;
        max-width: 186mm;
        margin: 0;
        padding: 0;
        font-family: Inter, Calibri, Arial, sans-serif;
        color: ${T.text};
        background: ${T.cream};
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .pdf-cover {
        margin-bottom: 14px;
        padding-bottom: 10px;
        border-bottom: 2px solid ${T.header};
      }
      .pdf-cover h1 {
        color: ${T.header};
        font-size: 17pt;
        font-weight: 800;
        margin: 0 0 4px;
        line-height: 1.2;
      }
      .pdf-cover p {
        margin: 0;
        color: #43474f;
        font-size: 10pt;
        font-weight: 600;
      }
      .pdf-card {
        margin-bottom: 14px;
        page-break-inside: avoid;
      }
      .qa-doc-panel {
        border: 2px solid ${T.header};
        border-radius: 0.75rem;
        overflow: hidden;
        background: #fff;
        box-shadow: 0 4px 14px rgba(0,32,96,.08);
      }
      .qa-doc-banner {
        background: ${T.header};
        color: #fff;
        padding: 0.875rem 1.25rem;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }
      .qa-doc-banner h3 {
        font-size: 13pt;
        font-weight: 800;
        margin: 0;
        line-height: 1.2;
      }
      .qa-doc-banner h3 .weekday { opacity: 0.9; font-weight: 600; }
      .qa-doc-banner-meta {
        font-size: 7.5pt;
        opacity: 0.85;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin: 0 0 3px;
      }
      .qa-doc-body { padding: 1rem 1.125rem; background: ${T.cream}; }
      .qa-table-block {
        border: 1px solid ${T.border};
        border-radius: 0.5rem;
        overflow: hidden;
        background: #fff;
      }
      .qa-table-head {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        background: ${T.header};
        color: #fff;
        font-size: 7pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .qa-table-head span {
        padding: 0.45rem 0.65rem;
        border-right: 1px solid rgba(255,255,255,.15);
      }
      .qa-table-head span:last-child { border-right: none; }
      .qa-table-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        border-top: 1px solid #D9E2F3;
      }
      .qa-table-row .qa-cell {
        padding: 0.55rem 0.65rem;
        border-right: 1px solid #D9E2F3;
      }
      .qa-table-row .qa-cell:last-child { border-right: none; }
      .qa-table-row .qa-cell label {
        font-size: 6.5pt;
        font-weight: 800;
        color: ${T.headerAlt};
        text-transform: uppercase;
        letter-spacing: 0.08em;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        margin-bottom: 0.3rem;
      }
      .qa-table-row .qa-cell label::before {
        content: '';
        width: 2px;
        height: 0.55rem;
        border-radius: 1px;
        background: ${T.accent};
      }
      .qa-value {
        border: 1px solid #c3c6d0;
        border-radius: 0.375rem;
        padding: 0.45rem 0.55rem;
        font-size: 9pt;
        font-weight: 500;
        background: #fff;
        color: ${T.text};
        min-height: 1.75rem;
        line-height: 1.35;
        word-wrap: break-word;
      }
      .qa-value.is-empty { color: #9aa0ab; font-style: italic; }
      .qa-section {
        background: #fff;
        border: 1px solid rgba(31,73,125,.35);
        border-radius: 0.625rem;
        margin-bottom: 0.75rem;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0,32,96,.06);
      }
      .qa-section:last-child { margin-bottom: 0; }
      .qa-section-title {
        font-size: 7pt;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: ${T.header};
        background: linear-gradient(180deg, ${T.sectionBg} 0%, #e8e6df 100%);
        padding: 0.55rem 0.875rem;
        border-bottom: 1px solid #D9E2F3;
      }
      .qa-section-body { padding: 0.75rem 0.875rem; background: #fff; }
      .qa-fields-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.65rem;
      }
      .qa-fields-grid.cols-1 { grid-template-columns: 1fr; }
      .qa-field { display: flex; flex-direction: column; gap: 0.25rem; }
      .qa-field.span-2 { grid-column: 1 / -1; }
      .qa-field-tag {
        font-size: 6.5pt;
        font-weight: 800;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: ${T.headerAlt};
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
      }
      .qa-field-tag::before {
        content: '';
        width: 2px;
        height: 0.7rem;
        border-radius: 1px;
        background: linear-gradient(180deg, ${T.header} 0%, ${T.accent} 100%);
      }
      .qa-subsection {
        border: 1px dashed rgba(31,73,125,.25);
        border-radius: 0.5rem;
        padding: 0.75rem;
        background: ${T.cream};
        margin-bottom: 0.65rem;
      }
      .qa-subsection:last-child { margin-bottom: 0; }
      .qa-subsection-head {
        font-size: 6.5pt;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: ${T.header};
        margin-bottom: 0.55rem;
        padding-bottom: 0.35rem;
        border-bottom: 1px solid rgba(31,73,125,.12);
      }
      .qa-limpeza-wrap {
        border: 2px solid ${T.accent};
        border-radius: 0.75rem;
        overflow: hidden;
        background: #fff;
        margin-top: 14px;
        page-break-inside: avoid;
      }
      .qa-limpeza-head {
        background: linear-gradient(135deg, ${T.accent}, #C8A96E);
        color: #fff;
        padding: 0.65rem 0.875rem;
        font-weight: 800;
        font-size: 8.5pt;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .qa-limpeza-body { padding: 0.75rem; background: ${T.cream}; }
      .qa-limpeza-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.65rem;
      }
    `;
  }

  function wrapPdfDocument(inner) {
    return `<style>${editorMirrorCss()}</style><div class="pdf-doc">${inner}</div>`;
  }

  function pdfCover(title, subtitle) {
    return `
      <header class="pdf-cover">
        <h1>${esc(title)}</h1>
        <p>${esc(subtitle)}</p>
      </header>`;
  }

  function pdfValue(label, value, span2) {
    const raw = String(value ?? '').trim();
    const emptyClass = raw ? '' : ' is-empty';
    const display = raw || '—';
    return `
      <div class="qa-field${span2 ? ' span-2' : ''}">
        <span class="qa-field-tag">${esc(label)}</span>
        <div class="qa-value${emptyClass}">${esc(display)}</div>
      </div>`;
  }

  function pdfCell(label, value) {
    const raw = String(value ?? '').trim();
    const emptyClass = raw ? '' : ' is-empty';
    const display = raw || '—';
    return `
      <div class="qa-cell">
        <label>${esc(label)}</label>
        <div class="qa-value${emptyClass}">${esc(display)}</div>
      </div>`;
  }

  function pdfDocPanel(meta, title, weekday, bodyHtml) {
    return `
      <article class="qa-doc-panel pdf-card">
        <div class="qa-doc-banner">
          <div>
            <p class="qa-doc-banner-meta">${esc(meta)}</p>
            <h3>${esc(title)}${weekday ? ` <span class="weekday">(${esc(weekday)})</span>` : ''}</h3>
          </div>
        </div>
        <div class="qa-doc-body">${bodyHtml}</div>
      </article>`;
  }

  function pdfMecanicasGrid(d) {
    const cell = (key) => {
      const field = MECANICAS_FIELDS.find((f) => f.key === key);
      return pdfCell(field?.label || key, d[key]);
    };
    return `
      <div class="qa-table-block">
        <div class="qa-table-head"><span>Portão</span><span>Indicador</span><span>Som</span></div>
        <div class="qa-table-row">${cell('portao')}${cell('indicador')}${cell('som')}</div>
        <div class="qa-table-head"><span>Microf. volante 1</span><span>Microf. volante 2</span><span>Limpeza (grupo)</span></div>
        <div class="qa-table-row">${cell('microf_volantes_1')}${cell('microf_volantes_2')}${cell('limpeza_grupo')}</div>
      </div>`;
  }

  function pdfMidweekBody(d) {
    const sections = ['header', 'tesouros', 'ministerio', 'vida'];
    return sections.map((sec) => {
      const secFields = MIDWEEK_FIELDS.filter((f) => f.section === sec);
      if (!secFields.length) return '';
      const meta = MIDWEEK_SECTIONS[sec];
      const fieldsHtml = secFields.map((f) => pdfValue(f.label, d[f.key])).join('');
      return `
        <div class="qa-section">
          <div class="qa-section-title">${esc(meta.title)}</div>
          <div class="qa-section-body">
            <div class="qa-fields-grid">${fieldsHtml}</div>
          </div>
        </div>`;
    }).join('');
  }

  function pdfWeekendBody(d) {
    const order = ['discurso', 'sentinela', 'sala_b', 'especial'];
    return order.map((gid) => {
      const meta = WEEKEND_GROUPS[gid];
      const groupFields = WEEKEND_FIELDS.filter((f) => f.group === gid);
      if (!groupFields.length || !meta) return '';
      const isSpecial = gid === 'especial';
      const fieldsHtml = groupFields.map((f) => pdfValue(f.label, d[f.key], isSpecial)).join('');
      return `
        <div class="qa-subsection">
          <div class="qa-subsection-head">${esc(meta.title)}</div>
          <div class="qa-fields-grid${isSpecial ? ' cols-1' : ''}">${fieldsHtml}</div>
        </div>`;
    }).join('');
  }

  function renderMecanicasHtml(board, entries, cleaningRows) {
    const month = board.reference_label || '';
    const list = entries.filter((e) => e.block === 'mecanicas').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    let body = pdfCover(SECTION_TITLES.mecanicas, `${month} — Congregação Jardim Elizabeth`);

    list.forEach((e, idx) => {
      const d = e.data || {};
      const dateTitle = e.event_date ? formatDisplayDate(e.event_date) : 'Sem data';
      const meta = `${BLOCK_TITLES.mecanicas} · ${idx + 1} de ${list.length}`;
      body += pdfDocPanel(meta, dateTitle, e.weekday_label || '', pdfMecanicasGrid(d));
    });

    if (cleaningRows.length) {
      body += `<div class="qa-limpeza-wrap">
        <div class="qa-limpeza-head">Limpeza mensal</div>
        <div class="qa-limpeza-body">`;
      cleaningRows.forEach((e, idx) => {
        const d = e.data || {};
        body += `
          <div class="qa-limpeza-row" style="margin-bottom:${idx < cleaningRows.length - 1 ? '0.65rem' : '0'}">
            ${pdfValue('Fim de semana', d.fim_de_semana)}
            ${pdfValue('Grupo', d.grupo)}
          </div>`;
      });
      body += '</div></div>';
    }

    return wrapPdfDocument(body);
  }

  function renderMidweekHtml(board, entries) {
    const list = entries.filter((e) => e.block === 'midweek').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    let body = pdfCover(SECTION_TITLES.midweek, `${board.reference_label || ''} — Congregação Jardim Elizabeth`);

    list.forEach((e, idx) => {
      const d = e.data || {};
      const dateTitle = e.event_date ? formatDisplayDate(e.event_date) : 'Sem data';
      const subtitle = d.leitura_biblica ? `${dateTitle} — ${d.leitura_biblica}` : dateTitle;
      const meta = `${BLOCK_TITLES.midweek} · ${idx + 1} de ${list.length}`;
      body += pdfDocPanel(meta, subtitle, e.weekday_label || '', pdfMidweekBody(d));
    });

    return wrapPdfDocument(body);
  }

  function renderWeekendHtml(board, entries) {
    const list = entries.filter((e) => e.block === 'weekend').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    let body = pdfCover(SECTION_TITLES.weekend, `${board.reference_label || ''} — Congregação Jardim Elizabeth`);

    list.forEach((e, idx) => {
      const d = e.data || {};
      const dateTitle = e.event_date ? formatDisplayDate(e.event_date) : 'Sem data';
      const meta = `${BLOCK_TITLES.weekend} · ${idx + 1} de ${list.length}`;
      body += pdfDocPanel(meta, dateTitle, e.weekday_label || '', pdfWeekendBody(d));
    });

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
        margin: [10, 10, 10, 10],
        filename: 'quadro.pdf',
        image: { type: 'jpeg', quality: 0.96 },
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
