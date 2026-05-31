(function () {
  const { formatDisplayDate, MONTHS_PT } = window.JEAnnouncementDates;
  const { SECTION_TITLES, fieldsForBlock, CLEANING_GROUPS } = window.JEAnnouncementSchemas;

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function pdfStyles() {
    return `
      <style>
        body { font-family: Arial, sans-serif; font-size: 11pt; color: #1b1c1c; margin: 24px; }
        h1 { color: #0f3462; font-size: 18pt; margin-bottom: 4px; }
        h2 { color: #3b5e97; font-size: 13pt; margin: 20px 0 8px; border-bottom: 1px solid #c3c6d0; padding-bottom: 4px; }
        h3 { color: #0f3462; font-size: 11pt; margin: 14px 0 6px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th, td { border: 1px solid #c3c6d0; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #f5f3f3; font-weight: 700; color: #0f3462; }
        .meta { color: #43474f; font-size: 10pt; margin-bottom: 16px; }
        .date-row { background: #f5f3f3; font-weight: 700; }
      </style>`;
  }

  function renderMecanicasHtml(board, entries, cleaningRows) {
    const month = board.reference_label || '';
    let body = `${pdfStyles()}<h1>${esc(SECTION_TITLES.mecanicas)}</h1><p class="meta">${esc(month)} — Congregação Jardim Elizabeth</p>`;

    body += '<table><thead><tr><th>Data</th><th>Portão</th><th>Indicador</th><th>Som</th><th>Microf. volantes</th><th>Limpeza</th></tr></thead><tbody>';
    entries.filter((e) => e.block === 'mecanicas').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).forEach((e) => {
      const d = e.data || {};
      body += `<tr><td>${esc(formatDisplayDate(e.event_date))} (${esc(e.weekday_label)})</td>
        <td>${esc(d.portao)}</td><td>${esc(d.indicador)}</td><td>${esc(d.som)}</td>
        <td>${esc(d.microf_volantes_1)}${d.microf_volantes_2 ? ' & ' + esc(d.microf_volantes_2) : ''}</td>
        <td>${esc(d.limpeza_grupo)}</td></tr>`;
    });
    body += '</tbody></table>';

    if (cleaningRows.length) {
      body += '<h2>Limpeza mensal</h2><table><thead><tr><th>Fim de semana</th><th>Grupo</th></tr></thead><tbody>';
      cleaningRows.forEach((e) => {
        const d = e.data || {};
        body += `<tr><td>${esc(d.fim_de_semana)}</td><td>${esc(d.grupo)}</td></tr>`;
      });
      body += '</tbody></table>';
    }
    return body;
  }

  function renderMidweekHtml(board, entries) {
    let body = `${pdfStyles()}<h1>${esc(SECTION_TITLES.midweek)}</h1><p class="meta">${esc(board.reference_label)}</p>`;
    entries.filter((e) => e.block === 'midweek').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).forEach((e) => {
      const d = e.data || {};
      body += `<h3>${esc(formatDisplayDate(e.event_date))} — ${esc(d.leitura_biblica || '')}</h3>`;
      body += `<p><strong>Cântico:</strong> ${esc(d.cantico)} &nbsp; <strong>Presidente:</strong> ${esc(d.presidente)}</p>`;
      body += `<p><strong>Tesouros:</strong> ${esc(d.tesouros_titulo)} — ${esc(d.tesouros_designado)}</p>`;
      body += `<p><strong>Joias:</strong> ${esc(d.joias_designado)} &nbsp; <strong>Leitura:</strong> ${esc(d.leitura_biblia)} (Sala B: ${esc(d.leitura_biblia_sala_b)})</p>`;
      for (let i = 1; i <= 3; i++) {
        if (d[`ministerio_${i}_tipo`] || d[`ministerio_${i}_designados`]) {
          body += `<p><strong>${esc(d[`ministerio_${i}_tipo`])}:</strong> ${esc(d[`ministerio_${i}_designados`])} (Sala B: ${esc(d[`ministerio_${i}_sala_b`])})</p>`;
        }
      }
      body += `<p><strong>Nossa vida cristã:</strong> ${esc(d.vida_crista_titulo)} — ${esc(d.vida_crista_designado)}</p>`;
      body += `<p><strong>Leitor:</strong> ${esc(d.leitor_sentinela)} &nbsp; <strong>Oração final:</strong> ${esc(d.oracao_final)}</p><hr/>`;
    });
    return body;
  }

  function renderWeekendHtml(board, entries) {
    let body = `${pdfStyles()}<h1>${esc(SECTION_TITLES.weekend)}</h1><p class="meta">${esc(board.reference_label)}</p>`;
    body += '<table><thead><tr><th>Data</th><th>Presidente</th><th>Tema / Orador</th><th>Sentinela</th><th>Oração</th></tr></thead><tbody>';
    entries.filter((e) => e.block === 'weekend').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).forEach((e) => {
      const d = e.data || {};
      const tema = d.evento_especial || `${d.tema_discurso || ''} — ${d.orador || ''}${d.congregacao_orador ? ' (' + d.congregacao_orador + ')' : ''}`;
      body += `<tr><td>${esc(formatDisplayDate(e.event_date))}</td><td>${esc(d.presidente)}</td>
        <td>${esc(tema)}</td><td>${esc(d.estudo_sentinela_tema)} / ${esc(d.leitor_sentinela)}</td>
        <td>${esc(d.oracao_final)}</td></tr>`;
    });
    body += '</tbody></table>';
    return body;
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
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    wrap.style.position = 'fixed';
    wrap.style.left = '-9999px';
    wrap.style.width = '210mm';
    document.body.appendChild(wrap);
    try {
      const blob = await window.html2pdf().set({
        margin: 10,
        filename: 'quadro.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(wrap).output('blob');
      return blob;
    } finally {
      wrap.remove();
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
