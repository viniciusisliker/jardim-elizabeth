(function () {
  const { formatDisplayDate } = window.JEAnnouncementDates;
  const { SECTION_TITLES } = window.JEAnnouncementSchemas;

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const T = window.JEAnnouncementTheme || {
    header: '#002060', headerAlt: '#1F497D', headerText: '#FFFFFF',
    accent: '#984806', sectionBg: '#EEECE1', rowAlt: '#D9E2F3', cream: '#F7F6F2', border: '#1F497D', text: '#1B1C1C'
  };

  function pdfCss() {
    return `
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; }
      .pdf-doc {
        width: 186mm;
        max-width: 186mm;
        margin: 0;
        padding: 0;
        font-family: Calibri, Arial, sans-serif;
        font-size: 9pt;
        line-height: 1.35;
        color: ${T.text};
        background: ${T.cream};
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .pdf-header { margin-bottom: 10px; }
      .pdf-header h1 {
        color: ${T.header};
        font-size: 15pt;
        margin: 0 0 3px;
        font-weight: 700;
        line-height: 1.2;
      }
      .pdf-header .meta {
        color: #43474f;
        font-size: 9.5pt;
        margin: 0;
      }
      .pdf-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 12px;
        background: #fff;
        table-layout: fixed;
      }
      .pdf-table th,
      .pdf-table td {
        border: 1px solid ${T.border};
        padding: 5px 6px;
        text-align: left;
        vertical-align: top;
        word-wrap: break-word;
        overflow-wrap: anywhere;
        hyphens: auto;
      }
      .pdf-table th {
        background: ${T.header};
        color: ${T.headerText};
        font-weight: 700;
        font-size: 7pt;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        line-height: 1.25;
      }
      .pdf-table td { font-size: 8.5pt; }
      .pdf-table tbody tr:nth-child(even) td { background: ${T.rowAlt}; }
      .pdf-table--mecanicas .col-date { width: 17%; }
      .pdf-table--mecanicas .col-field { width: 11%; }
      .pdf-table--mecanicas .col-microf { width: 22%; }
      .pdf-table--mecanicas .col-limpeza { width: 28%; }
      .pdf-table--weekend .col-date { width: 14%; }
      .pdf-table--weekend .col-pres { width: 14%; }
      .pdf-table--weekend .col-tema { width: 32%; }
      .pdf-table--weekend .col-sent { width: 22%; }
      .pdf-table--weekend .col-oracao { width: 18%; }
      .pdf-table--limpeza .col-weekend { width: 45%; }
      .pdf-table--limpeza .col-grupo { width: 55%; }
      .pdf-section-title {
        background: ${T.accent};
        color: #fff;
        padding: 6px 8px;
        font-weight: 700;
        font-size: 9pt;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin: 10px 0 0;
      }
      .pdf-day-block {
        background: #fff;
        border: 1px solid ${T.border};
        border-radius: 4px;
        padding: 10px 12px;
        margin-bottom: 10px;
        page-break-inside: avoid;
      }
      .pdf-day-block h3 {
        color: ${T.header};
        font-size: 10pt;
        margin: 0 0 8px;
        padding-bottom: 6px;
        border-bottom: 2px solid ${T.sectionBg};
      }
      .pdf-day-block p {
        margin: 0 0 5px;
        font-size: 8.5pt;
      }
      .pdf-day-block p:last-child { margin-bottom: 0; }
    `;
  }

  function wrapPdfDocument(inner) {
    return `<style>${pdfCss()}</style><div class="pdf-doc">${inner}</div>`;
  }

  function pdfHeader(title, subtitle) {
    return `
      <header class="pdf-header">
        <h1>${esc(title)}</h1>
        <p class="meta">${esc(subtitle)}</p>
      </header>`;
  }

  function renderMecanicasHtml(board, entries, cleaningRows) {
    const month = board.reference_label || '';
    let body = pdfHeader(SECTION_TITLES.mecanicas, `${month} — Congregação Jardim Elizabeth`);

    body += `
      <table class="pdf-table pdf-table--mecanicas">
        <colgroup>
          <col class="col-date"/>
          <col class="col-field"/><col class="col-field"/><col class="col-field"/>
          <col class="col-microf"/>
          <col class="col-limpeza"/>
        </colgroup>
        <thead>
          <tr>
            <th>Data</th>
            <th>Portão</th>
            <th>Indicador</th>
            <th>Som</th>
            <th>Microfones</th>
            <th>Limpeza</th>
          </tr>
        </thead>
        <tbody>`;

    entries.filter((e) => e.block === 'mecanicas').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).forEach((e) => {
      const d = e.data || {};
      const microf = [d.microf_volantes_1, d.microf_volantes_2].filter((v) => String(v || '').trim()).join(' · ');
      body += `<tr>
        <td>${esc(formatDisplayDate(e.event_date))}${e.weekday_label ? ` (${esc(e.weekday_label)})` : ''}</td>
        <td>${esc(d.portao)}</td>
        <td>${esc(d.indicador)}</td>
        <td>${esc(d.som)}</td>
        <td>${esc(microf)}</td>
        <td>${esc(d.limpeza_grupo)}</td>
      </tr>`;
    });

    body += '</tbody></table>';

    if (cleaningRows.length) {
      body += `<div class="pdf-section-title">Limpeza mensal</div>
        <table class="pdf-table pdf-table--limpeza">
          <colgroup><col class="col-weekend"/><col class="col-grupo"/></colgroup>
          <thead><tr><th>Fim de semana</th><th>Grupo</th></tr></thead><tbody>`;
      cleaningRows.forEach((e) => {
        const d = e.data || {};
        body += `<tr><td>${esc(d.fim_de_semana)}</td><td>${esc(d.grupo)}</td></tr>`;
      });
      body += '</tbody></table>';
    }

    return wrapPdfDocument(body);
  }

  function renderMidweekHtml(board, entries) {
    let body = pdfHeader(SECTION_TITLES.midweek, board.reference_label || '');

    entries.filter((e) => e.block === 'midweek').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).forEach((e) => {
      const d = e.data || {};
      body += `<div class="pdf-day-block">
        <h3>${esc(formatDisplayDate(e.event_date))}${d.leitura_biblica ? ` — ${esc(d.leitura_biblica)}` : ''}</h3>
        <p><strong>Cântico:</strong> ${esc(d.cantico)} &nbsp;·&nbsp; <strong>Presidente:</strong> ${esc(d.presidente)}</p>
        <p><strong>Tesouros:</strong> ${esc(d.tesouros_titulo)} — ${esc(d.tesouros_designado)}</p>
        <p><strong>Joias:</strong> ${esc(d.joias_designado)} &nbsp;·&nbsp; <strong>Leitura:</strong> ${esc(d.leitura_biblia)} (Sala B: ${esc(d.leitura_biblia_sala_b)})</p>`;
      for (let i = 1; i <= 3; i++) {
        if (d[`ministerio_${i}_tipo`] || d[`ministerio_${i}_designados`]) {
          body += `<p><strong>${esc(d[`ministerio_${i}_tipo`])}:</strong> ${esc(d[`ministerio_${i}_designados`])} (Sala B: ${esc(d[`ministerio_${i}_sala_b`])})</p>`;
        }
      }
      body += `<p><strong>Nossa vida cristã:</strong> ${esc(d.vida_crista_titulo)} — ${esc(d.vida_crista_designado)}</p>
        <p><strong>Leitor:</strong> ${esc(d.leitor_sentinela)} &nbsp;·&nbsp; <strong>Oração final:</strong> ${esc(d.oracao_final)}</p>
      </div>`;
    });

    return wrapPdfDocument(body);
  }

  function renderWeekendHtml(board, entries) {
    let body = pdfHeader(SECTION_TITLES.weekend, board.reference_label || '');

    body += `
      <table class="pdf-table pdf-table--weekend">
        <colgroup>
          <col class="col-date"/><col class="col-pres"/><col class="col-tema"/>
          <col class="col-sent"/><col class="col-oracao"/>
        </colgroup>
        <thead>
          <tr>
            <th>Data</th>
            <th>Presidente</th>
            <th>Tema / Orador</th>
            <th>Sentinela</th>
            <th>Oração</th>
          </tr>
        </thead>
        <tbody>`;

    entries.filter((e) => e.block === 'weekend').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).forEach((e) => {
      const d = e.data || {};
      const tema = d.evento_especial || [d.tema_discurso, d.orador].filter(Boolean).join(' — ')
        + (d.congregacao_orador ? ` (${d.congregacao_orador})` : '');
      body += `<tr>
        <td>${esc(formatDisplayDate(e.event_date))}</td>
        <td>${esc(d.presidente)}</td>
        <td>${esc(tema)}</td>
        <td>${esc(d.estudo_sentinela_tema)}${d.leitor_sentinela ? ` / ${esc(d.leitor_sentinela)}` : ''}</td>
        <td>${esc(d.oracao_final)}</td>
      </tr>`;
    });

    body += '</tbody></table>';
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
        margin: [12, 12, 12, 12],
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
