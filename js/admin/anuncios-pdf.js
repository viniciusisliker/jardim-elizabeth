(function () {
  function formatDisplayDate(iso) {
    return window.JEAnnouncementDates?.formatDisplayDate(iso) || String(iso || '').slice(0, 10);
  }

  function sectionTitles() {
    return window.JEAnnouncementSchemas?.SECTION_TITLES || {};
  }

  function weekendFields() {
    return window.JEAnnouncementSchemas?.WEEKEND_FIELDS || [];
  }

  function weekendGroups() {
    return window.JEAnnouncementSchemas?.WEEKEND_GROUPS || {};
  }

  const CONGREGATION = 'Congregação Jardim Elizabeth';

  const MIDWEEK_THEME = {
    tesouros: { color: '#3D5A73', bg: '#EEF3F8', title: 'Tesouros da Palavra de Deus' },
    ministerio: { color: '#7A6238', bg: '#F9F5EE', title: 'Faça seu melhor no ministério' },
    vida: { color: '#8A3D3D', bg: '#FAF0F0', title: 'Nossa vida cristã' }
  };

  const T = window.JEAnnouncementTheme || {
    header: '#002060', headerAlt: '#1F497D', accent: '#984806',
    accentGold: '#C8A96E', sectionBg: '#EEECE1', cream: '#F7F6F2',
    border: '#1F497D', text: '#1B1C1C'
  };

  const PDFMAKE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12';
  const MUTED = '#8A8F99';
  const LINE = '#D4DCE8';
  const PAGE_WIDTH = 539;

  function val(v) {
    return String(v ?? '').trim();
  }

  function hasValue(v) {
    return val(v).length > 0;
  }

  function chunkEntries(list, size) {
    const chunks = [];
    for (let i = 0; i < list.length; i += size) chunks.push(list.slice(i, i + size));
    return chunks;
  }

  function loadScriptOnce(src) {
    if (document.querySelector(`script[src="${src}"]`)) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Não foi possível carregar o gerador de PDF. Recarregue a página e tente de novo.'));
      document.head.appendChild(s);
    });
  }

  async function ensurePdfMake() {
    if (window.pdfMake?.vfs) return;
    await loadScriptOnce(`${PDFMAKE_CDN}/pdfmake.min.js`);
    await loadScriptOnce(`${PDFMAKE_CDN}/vfs_fonts.min.js`);
    if (!window.pdfMake?.vfs) {
      throw new Error('Não foi possível gerar o PDF. Recarregue a página (Ctrl+F5) e tente de novo.');
    }
  }

  function hairlineLayout() {
    return {
      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0.8 : 0.4),
      vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length ? 0.8 : 0.4),
      hLineColor: () => T.border,
      vLineColor: () => T.border,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0
    };
  }

  function innerGridLayout() {
    return {
      hLineWidth: (i) => (i === 0 ? 0 : 0.4),
      vLineWidth: () => 0.4,
      hLineColor: () => LINE,
      vLineColor: () => LINE,
      paddingLeft: () => 5,
      paddingRight: () => 5,
      paddingTop: () => 4,
      paddingBottom: () => 4
    };
  }

  function monthOf(board) {
    return board.reference_label || '';
  }

  const FILE_TITLES = {
    mecanicas: 'Designações Mecânicas',
    midweek: 'Nossa Vida e Ministério Cristão',
    weekend: 'Discurso Público e Estudo de A Sentinela',
    full: 'Quadro de Anúncios'
  };

  function monthName(board) {
    const months = window.JEAnnouncementDates?.MONTHS_PT;
    const ref = board?.reference_month;
    if (months && ref) {
      const idx = Number(String(ref).slice(5, 7)) - 1;
      if (months[idx]) return months[idx];
    }
    return String(board?.reference_label || '').split('/')[0].trim();
  }

  /** Nome do arquivo (sem extensão), ex.: "Nossa Vida e Ministério Cristão - Outubro". */
  function fileTitle(block, board) {
    const base = FILE_TITLES[block] || FILE_TITLES.full;
    const month = monthName(board);
    return month ? `${base} - ${month}` : base;
  }

  function baseDoc(content, meta) {
    const section = meta?.section || 'Quadro de Anúncios';
    const month = meta?.month || '';
    return {
      pageSize: 'A4',
      pageMargins: [28, 30, 28, 40],
      defaultStyle: { font: 'Roboto', fontSize: 9, color: T.text, lineHeight: 1.2 },
      styles: {
        kicker: { fontSize: 7, bold: true, color: T.accent, characterSpacing: 1.2 },
        coverTitle: { fontSize: 16, bold: true, color: T.header },
        coverSub: { fontSize: 9, color: '#4B5563', margin: [0, 2, 0, 0] },
        bannerMeta: { fontSize: 6.5, bold: true, color: '#D6E4F5', characterSpacing: 0.6 },
        bannerDate: { fontSize: 11, bold: true, color: '#ffffff' },
        gridHead: { fontSize: 6.5, bold: true, color: '#ffffff', alignment: 'center', characterSpacing: 0.3 },
        gridVal: { fontSize: 8.5, bold: true, alignment: 'center' },
        gridValEmpty: { fontSize: 8.5, color: MUTED, italics: true, alignment: 'center' },
        liteBanner: { fontSize: 10, bold: true, color: T.header },
        sectionTitle: { fontSize: 7, bold: true, color: T.headerAlt, characterSpacing: 0.4 },
        inlineLabel: { fontSize: 7, bold: true, color: T.headerAlt },
        inlineVal: { fontSize: 8.5 }
      },
      footer: (currentPage, pageCount) => ({
        margin: [28, 8, 28, 0],
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: PAGE_WIDTH, y2: 0, lineWidth: 0.6, lineColor: T.accentGold }] },
          {
            columns: [
              { width: 'auto', text: CONGREGATION, fontSize: 7, color: '#6B7280', margin: [0, 6, 0, 0] },
              { width: '*', text: [month, section].filter(Boolean).join('  ·  '), alignment: 'center', fontSize: 7, color: '#6B7280', margin: [0, 6, 0, 0] },
              { width: 'auto', text: `${currentPage} / ${pageCount}`, alignment: 'right', fontSize: 7, color: '#6B7280', margin: [0, 6, 0, 0] }
            ]
          }
        ]
      }),
      content
    };
  }

  function pmCover(title, subtitle) {
    return {
      margin: [0, 0, 0, 12],
      stack: [
        { text: 'QUADRO DE ANÚNCIOS', style: 'kicker' },
        { text: title, style: 'coverTitle', margin: [0, 2, 0, 0] },
        { text: subtitle, style: 'coverSub' },
        {
          canvas: [
            { type: 'line', x1: 0, y1: 8, x2: PAGE_WIDTH, y2: 8, lineWidth: 2.2, lineColor: T.header },
            { type: 'line', x1: 0, y1: 12, x2: 92, y2: 12, lineWidth: 2.2, lineColor: T.accentGold }
          ],
          margin: [0, 0, 0, 2]
        }
      ]
    };
  }

  function pmHead(label) {
    return { text: label, style: 'gridHead', fillColor: T.headerAlt };
  }

  function pmCell(value) {
    const raw = val(value);
    return {
      text: raw || '—',
      style: raw ? 'gridVal' : 'gridValEmpty',
      margin: [1, 3, 1, 3]
    };
  }

  function pmMecanicasGrid(d) {
    return {
      table: {
        widths: ['*', '*', '*'],
        body: [
          [pmHead('Indicador (Portão)'), pmHead('Indicador (Auditório)'), pmHead('Som')],
          [pmCell(d.portao), pmCell(d.indicador), pmCell(d.som)],
          [pmHead('Mic. 1'), pmHead('Mic. 2'), pmHead('Limpeza')],
          [pmCell(d.microf_volantes_1), pmCell(d.microf_volantes_2), pmCell(d.limpeza_grupo)]
        ]
      },
      layout: innerGridLayout()
    };
  }

  function pmMecanicasCard(entry, idx, total) {
    const d = entry.data || {};
    const dateStr = entry.event_date ? formatDisplayDate(entry.event_date) : 'Sem data';
    const weekday = val(entry.weekday_label);
    const dateLine = weekday ? `${dateStr}  ·  ${weekday}` : dateStr;

    return {
      unbreakable: true,
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            {
              table: {
                widths: ['*'],
                body: [[{
                  stack: [
                    { text: `${idx + 1} / ${total}`, style: 'bannerMeta' },
                    { text: dateLine, style: 'bannerDate', margin: [0, 1, 0, 0] }
                  ],
                  fillColor: T.header,
                  margin: [8, 6, 8, 7]
                }]]
              },
              layout: 'noBorders'
            },
            {
              ...pmMecanicasGrid(d),
              fillColor: T.cream
            }
          ]
        }]]
      },
      layout: hairlineLayout()
    };
  }

  function pmLimpezaTable(cleaningRows) {
    if (!cleaningRows.length) return null;
    const rows = cleaningRows.map((e) => {
      const d = e.data || {};
      return [
        { text: val(d.fim_de_semana) || '—', fontSize: 8.5, bold: true },
        { text: val(d.grupo) || '—', fontSize: 8.5, bold: true }
      ];
    });
    return {
      unbreakable: true,
      margin: [0, 6, 0, 0],
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            {
              columns: [
                { text: 'LIMPEZA MENSAL', fontSize: 8, bold: true, color: T.accent, characterSpacing: 0.6 },
                { text: `${cleaningRows.length} fim(ns) de semana`, alignment: 'right', fontSize: 7.5, color: '#6B7280' }
              ],
              fillColor: T.sectionBg,
              margin: [8, 6, 8, 6]
            },
            {
              table: {
                widths: ['*', '*'],
                body: [
                  [
                    { text: 'Fim de semana', style: 'gridHead', fillColor: T.headerAlt },
                    { text: 'Grupo', style: 'gridHead', fillColor: T.headerAlt }
                  ],
                  ...rows
                ]
              },
              layout: {
                hLineWidth: () => 0.4,
                vLineWidth: () => 0.4,
                hLineColor: () => LINE,
                vLineColor: () => LINE,
                paddingLeft: () => 8,
                paddingRight: () => 8,
                paddingTop: () => 5,
                paddingBottom: () => 5
              }
            }
          ]
        }]]
      },
      layout: hairlineLayout()
    };
  }

  function buildMecanicasContent(board, entries, cleaningRows) {
    const month = monthOf(board);
    const list = entries.filter((e) => e.block === 'mecanicas').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const content = [pmCover(sectionTitles().mecanicas, `${month} — ${CONGREGATION}`)];

    if (!list.length) {
      content.push({ text: 'Nenhuma designação mecânica neste mês.', color: MUTED, italics: true, fontSize: 9 });
    } else {
      const pairs = chunkEntries(list, 2);
      let cardIndex = 0;
      pairs.forEach((pair) => {
        const cards = pair.map((e) => {
          const card = pmMecanicasCard(e, cardIndex, list.length);
          cardIndex += 1;
          return card;
        });
        if (cards.length === 2) {
          content.push({
            columns: [
              { width: '*', stack: [cards[0]] },
              { width: 10, text: '' },
              { width: '*', stack: [cards[1]] }
            ],
            columnGap: 0,
            margin: [0, 0, 0, 8]
          });
        } else {
          content.push({ ...cards[0], margin: [0, 0, 0, 8], width: 264 });
        }
      });
    }

    const limpeza = pmLimpezaTable(cleaningRows);
    if (limpeza) content.push(limpeza);
    return content;
  }

  const MIDWEEK_ICONS = {
    tesouros: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="{c}"/><path d="M7.5 6.5h9l3 3.6L12 19 4.5 10.1z" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><path d="M4.5 10.1h15M9.6 6.5 8.3 10.1 12 19l3.7-8.9-1.3-3.6" fill="none" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>',
    ministerio: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="{c}"/><path d="M12 20V5" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><g fill="#fff"><ellipse cx="12" cy="5" rx="1.3" ry="2"/><ellipse cx="9.6" cy="8.6" rx="1.2" ry="2" transform="rotate(-35 9.6 8.6)"/><ellipse cx="14.4" cy="8.6" rx="1.2" ry="2" transform="rotate(35 14.4 8.6)"/><ellipse cx="9.6" cy="12.2" rx="1.2" ry="2" transform="rotate(-35 9.6 12.2)"/><ellipse cx="14.4" cy="12.2" rx="1.2" ry="2" transform="rotate(35 14.4 12.2)"/><ellipse cx="9.6" cy="15.8" rx="1.2" ry="2" transform="rotate(-35 9.6 15.8)"/><ellipse cx="14.4" cy="15.8" rx="1.2" ry="2" transform="rotate(35 14.4 15.8)"/></g></svg>',
    vida: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="{c}"/><g fill="#fff"><circle cx="8" cy="11" r="2.6"/><circle cx="11" cy="9.6" r="2.8"/><circle cx="14.2" cy="10.2" r="2.6"/><circle cx="9.4" cy="13.4" r="2.6"/><circle cx="13" cy="13.6" r="2.7"/><circle cx="15.6" cy="12.8" r="2.2"/><rect x="8.6" y="15" width="1.4" height="4" rx="0.6"/><rect x="13.4" y="15" width="1.4" height="4" rx="0.6"/></g><ellipse cx="18" cy="10.6" rx="1.9" ry="1.5" fill="#fff" stroke="{c}" stroke-width="0.8"/><circle cx="18.5" cy="10.3" r="0.35" fill="{c}"/></svg>'
  };

  const WEEKEND_THEME = {
    territorio: { color: '#8A5A2B', bg: '#FAF3EA', fallback: 'Trabalho de campo' },
    discurso: { color: '#2F5D8A', bg: '#EDF3FA', fallback: 'Discurso público' },
    sentinela: { color: '#3E7650', bg: '#EEF6F0', fallback: 'Estudo da Sentinela' },
    enviados: { color: '#6B4C8A', bg: '#F4F0F9', fallback: 'Oradores enviados' }
  };

  const WEEKEND_ICONS = {
    // Mapa dobrado (saída de campo).
    territorio: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="{c}"/><path d="M4.5 7.2 9.3 5.5l5.4 1.9 4.8-1.7v11.1l-4.8 1.7-5.4-1.9-4.8 1.7z" fill="none" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/><path d="M9.3 5.5v11.1M14.7 7.4v11.1" stroke="#fff" stroke-width="1.2"/></svg>',
    // Microfone (discurso).
    discurso: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="{c}"/><rect x="9.5" y="4.5" width="5" height="9" rx="2.5" fill="#fff"/><path d="M7 11.5a5 5 0 0 0 10 0M12 16.5v3M9.2 19.5h5.6" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></svg>',
    // Livro aberto (estudo).
    sentinela: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="{c}"/><path d="M12 7.3C10.3 6 7.8 5.6 5 5.9v11.2c2.8-.3 5.3.1 7 1.4 1.7-1.3 4.2-1.7 7-1.4V5.9c-2.8-.3-5.3.1-7 1.4zM12 7.3v11.2" fill="none" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    // Seta saindo da caixa (orador enviado a outra congregação).
    enviados: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="{c}"/><path d="M11 6.5H7.5a1.5 1.5 0 0 0-1.5 1.5v8.5A1.5 1.5 0 0 0 7.5 18H16a1.5 1.5 0 0 0 1.5-1.5V13M13 5.5h5.5V11M18.5 5.5 11 13" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  const CALENDAR_ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#5B6573"/><rect x="6" y="7.5" width="12" height="10.5" rx="1.4" fill="#fff"/><rect x="6" y="7.5" width="12" height="3" rx="1" fill="#C9D3DF"/><rect x="8.6" y="5.6" width="1.3" height="3.4" rx="0.6" fill="#fff"/><rect x="14.1" y="5.6" width="1.3" height="3.4" rx="0.6" fill="#fff"/><g fill="#5B6573"><rect x="8" y="12.3" width="1.8" height="1.5"/><rect x="11.1" y="12.3" width="1.8" height="1.5"/><rect x="14.2" y="12.3" width="1.8" height="1.5"/><rect x="8" y="15" width="1.8" height="1.5"/><rect x="11.1" y="15" width="1.8" height="1.5"/></g></svg>';

  function pmAssigneeText(assignee) {
    if (hasValue(assignee)) return { text: val(assignee), bold: true, color: T.text };
    return { text: '' };
  }

  // Designação extra: Sala B (coluna da direita) ou Leitor (colado no nome).
  function pmExtra(label, value, color) {
    return hasValue(value) ? { label, value: val(value), color } : null;
  }

  // Medição de texto com a mesma Roboto que o pdfmake embute, para calcular as colunas
  // de cada quadro: nomes e Sala B com a largura exata, e o título da parte com o resto.
  const MEASURE_FONT = 'JEPdfRoboto';
  let measureCtx = null;

  function base64ToBuffer(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }

  async function ensureMeasure() {
    if (measureCtx) return;
    try {
      const vfs = window.pdfMake.vfs;
      const faces = [
        new FontFace(MEASURE_FONT, base64ToBuffer(vfs['Roboto-Regular.ttf']), { weight: '400' }),
        new FontFace(MEASURE_FONT, base64ToBuffer(vfs['Roboto-Medium.ttf']), { weight: '700' })
      ];
      await Promise.all(faces.map((f) => f.load()));
      faces.forEach((f) => document.fonts.add(f));
      measureCtx = document.createElement('canvas').getContext('2d');
    } catch (_) {
      measureCtx = null; // cai na estimativa por caractere
    }
  }

  function textWidth(text, bold, size) {
    const str = String(text || '');
    if (measureCtx) {
      measureCtx.font = `${bold ? 700 : 400} ${size}px ${MEASURE_FONT}`;
      return measureCtx.measureText(str).width;
    }
    return str.length * size * (bold ? 0.58 : 0.54);
  }

  const PM_FONT_SIZE = 8.5;

  function runsWidth(runs) {
    return runs.reduce((sum, r) => sum + textWidth(r.text, r.bold, r.fontSize || PM_FONT_SIZE), 0);
  }

  // Cada linha vira uma linha de tabela: nº | parte | designados | rótulo Sala B | nome Sala B.
  // `inline` (ex.: Leitor) vai colado no nome; `side` (Sala B) vai nas colunas da direita.
  function pmMidweekRow(num, label, assignee, side, opts) {
    const required = opts?.required;
    const color = opts?.color || T.headerAlt;
    const title = val(label);
    const inline = opts?.inline || null;
    if (!required && !title && !hasValue(assignee) && !side) return null;
    const titleRuns = [{ text: title || 'Parte', bold: true, color }];
    if (opts?.duration) titleRuns.push({ text: ` (${opts.duration})`, bold: false, color, fontSize: 7.5 });
    const nameRuns = [pmAssigneeText(assignee)];
    if (inline) {
      if (hasValue(assignee)) nameRuns.push({ text: '  ·  ', color: MUTED });
      nameRuns.push(
        { text: `${inline.label}  `, bold: true, color: inline.color },
        { text: inline.value, color: T.text }
      );
    }
    const sideLabel = side ? { text: side.label, bold: true, color: side.color } : { text: '' };
    const sideValue = side ? { text: side.value, color: T.text } : { text: '' };
    // Rótulo longo (Dirigente Sala B) invade a coluna de nomes em vez de alargar a coluna
    // de rótulos, que apertaria o título de todas as partes.
    const spanLabel = Boolean(opts?.spanLabel && side);
    const nameCell = spanLabel
      ? {
        colSpan: 2,
        columns: [
          { width: '*', text: nameRuns, noWrap: true },
          { width: 'auto', ...sideLabel, alignment: 'right', noWrap: true }
        ],
        columnGap: 8
      }
      : { text: nameRuns, noWrap: true };
    // Título longo (ex.: tema de Tesouros): a linha pode abrir mão das colunas do
    // meio para o título, com o designado logo em seguida (ver pmRowsTable).
    const wideCells = opts?.wideTitle && !side && !inline
      ? [
        { text: num ? `${num}.` : '', bold: true, color, alignment: 'right' },
        {
          colSpan: 4,
          columns: [
            { width: 'auto', text: titleRuns },
            { width: '*', text: nameRuns, noWrap: true }
          ],
          columnGap: 16
        },
        {}, {}, {}
      ]
      : null;
    return {
      wideCells,
      titleWidth: runsWidth(titleRuns),
      cells: [
        { text: num ? `${num}.` : '', bold: true, color, alignment: 'right' },
        { text: titleRuns },
        nameCell,
        spanLabel ? {} : { ...sideLabel, alignment: 'right', noWrap: true },
        { ...sideValue, noWrap: true }
      ],
      nameWidth: runsWidth(nameRuns),
      sideLabelWidth: side && !spanLabel ? runsWidth([sideLabel]) : 0,
      sideValueWidth: side ? runsWidth([sideValue]) : 0
    };
  }

  // Larguras comuns às três seções do quadro, para os nomes alinharem entre elas.
  function pmMeetingWidths(rows) {
    const list = rows.filter(Boolean);
    const max = (key) => Math.ceil(Math.max(0, ...list.map((r) => r[key])) + 2);
    const hasSide = list.some((r) => r.sideValueWidth > 0);
    return hasSide
      ? [12, '*', max('nameWidth'), max('sideLabelWidth'), max('sideValueWidth')]
      : [12, '*', max('nameWidth')];
  }

  // Largura útil das linhas dentro do quadro (A4 menos margens, bordas e recuos).
  const PM_ROWS_WIDTH = 492;
  const pmPadLeft = (i) => (i === 0 ? 0 : i === 3 ? 14 : 4);
  const pmPadRight = (i, count) => (i === count - 1 ? 0 : 4);

  // Largura que sobra para a coluna '*' (título da parte).
  function pmTitleColumnWidth(widths) {
    return widths.reduce((rest, w, i) => rest - pmPadLeft(i) - pmPadRight(i, widths.length)
      - (typeof w === 'number' ? w : 0), PM_ROWS_WIDTH);
  }

  function pmRowsTable(rows, widths) {
    const titleCol = pmTitleColumnWidth(widths);
    const cellsOf = (r) => {
      if (r.wideCells && r.titleWidth > titleCol) {
        const cells = r.wideCells.slice(0, widths.length);
        cells[1] = { ...cells[1], colSpan: widths.length - 1 };
        return cells;
      }
      return r.cells.slice(0, widths.length);
    };
    return {
      table: {
        widths,
        body: rows.map(cellsOf)
      },
      fontSize: PM_FONT_SIZE,
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: pmPadLeft,
        paddingRight: (i, node) => pmPadRight(i, node.table.widths.length),
        paddingTop: () => 2,
        paddingBottom: () => 2
      }
    };
  }

  function pmMidweekSection(themeKey, rows, widths) {
    const filtered = rows.filter(Boolean);
    if (!filtered.length) return null;
    const theme = MIDWEEK_THEME[themeKey];
    return {
      margin: [0, 0, 0, 4],
      table: {
        widths: ['*'],
        body: [
          [{
            columns: [
              { svg: MIDWEEK_ICONS[themeKey].replace(/\{c\}/g, theme.color), width: 11, height: 11 },
              {
                width: '*',
                text: theme.title.toUpperCase(),
                bold: true,
                fontSize: 7.5,
                color: theme.color,
                characterSpacing: 0.4,
                margin: [0, 1.5, 0, 0]
              }
            ],
            columnGap: 6,
            fillColor: theme.bg,
            margin: [8, 3.5, 8, 3.5]
          }],
          [{ stack: [pmRowsTable(filtered, widths)], margin: [8, 1, 8, 3] }]
        ]
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => LINE,
        vLineColor: () => LINE
      }
    };
  }

  function pmMidweekMeeting(entry) {
    const d = entry.data || {};
    const datePart = entry.event_date ? formatDisplayDate(entry.event_date) : 'Sem data';
    const reading = val(d.leitura_biblica);
    const weekTitle = reading ? `${datePart}  ·  ${reading}` : datePart;
    const cT = MIDWEEK_THEME.tesouros.color;
    const cM = MIDWEEK_THEME.ministerio.color;
    const cV = MIDWEEK_THEME.vida.color;

    const leituraSalaB = pmExtra('Sala B', d.leitura_biblia_sala_b, cT);


    const tesouros = [
      pmMidweekRow(1, val(d.tesouros_titulo) || 'Tesouros da Palavra de Deus', d.tesouros_designado, null, { required: true, color: cT, wideTitle: true }),
      // Dirigente Sala B na linha 2, logo acima da leitura da Sala B (linha 3).
      pmMidweekRow(2, 'Joias espirituais', d.joias_designado, pmExtra('Dirigente Sala B', d.dirigente_sala_b, cT), { required: true, color: cT, spanLabel: true }),
      pmMidweekRow(3, 'Leitura da Bíblia', d.leitura_biblia, leituraSalaB, { required: true, color: cT })
    ];

    const ministerio = [1, 2, 3, 4].map((i) => {
      const tipo = val(d[`ministerio_${i}_tipo`]);
      const people = d[`ministerio_${i}_designados`];
      const salaB = d[`ministerio_${i}_sala_b`];
      if (!tipo && !hasValue(people) && !hasValue(salaB)) return null;
      return pmMidweekRow(i + 3, tipo || `Parte ${i}`, people, pmExtra('Sala B', salaB, cM), { color: cM });
    });

    const vidaNum = 4 + Math.max(3, ministerio.reduce((last, row, idx) => (row ? idx + 1 : last), 0));
    const vidaRows = [
      pmMidweekRow(vidaNum, val(d.vida_crista_titulo) || 'Nossa vida cristã', d.vida_crista_designado, null, { required: true, color: cV }),
      pmMidweekRow(vidaNum + 1, 'Estudo bíblico de congregação', d.estudo_dirigente,
        null, { required: true, color: cV, inline: pmExtra('Leitor', d.leitor_sentinela, cV) }),
      // Linha sem número fechando o quadro (sem faixa, para caberem dois por página).
      hasValue(d.oracao_final) ? pmMidweekRow(null, 'Oração final', d.oracao_final, null, { color: cV }) : null
    ];

    const widths = pmMeetingWidths([...tesouros, ...ministerio, ...vidaRows]);

    // Cântico e presidente vão na própria barra da data (economiza uma linha por quadro).
    const metaRuns = [];
    if (hasValue(d.cantico)) metaRuns.push({ text: 'Cântico  ', bold: true, color: T.headerAlt }, { text: val(d.cantico) });
    if (hasValue(d.presidente)) {
      if (metaRuns.length) metaRuns.push({ text: '     ' });
      metaRuns.push({ text: 'Presidente  ', bold: true, color: T.headerAlt }, { text: val(d.presidente) });
    }

    const inner = [
      {
        table: {
          widths: ['*'],
          body: [[{
            columns: [
              { svg: CALENDAR_ICON, width: 22, height: 22, margin: [0, -2, 0, 0] },
              {
                width: '*',
                text: weekTitle,
                fontSize: 11,
                bold: true,
                color: T.header,
                margin: [0, 3, 0, 0]
              },
              metaRuns.length ? { width: 'auto', text: metaRuns, fontSize: 8.5, color: T.text, margin: [0, 5, 0, 0] } : null
            ].filter(Boolean),
            columnGap: 8,
            fillColor: '#EEF3F8',
            margin: [8, 5, 10, 5]
          }]]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 5]
      },
      pmMidweekSection('tesouros', tesouros, widths),
      pmMidweekSection('ministerio', ministerio, widths),
      pmMidweekSection('vida', vidaRows, widths)
    ].filter(Boolean);

    return {
      unbreakable: true,
      margin: [0, 0, 0, 10],
      table: {
        widths: ['*'],
        body: [[{ stack: inner, margin: [2, 2, 2, 2] }]]
      },
      layout: {
        hLineWidth: () => 0.7,
        vLineWidth: () => 0.7,
        hLineColor: () => '#B7C9DE',
        vLineColor: () => '#B7C9DE',
        paddingLeft: () => 8,
        paddingRight: () => 8,
        paddingTop: () => 6,
        paddingBottom: () => 6
      }
    };
  }

  function buildMidweekContent(board, entries) {
    const list = entries.filter((e) => e.block === 'midweek').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const content = [pmCover(sectionTitles().midweek, `${monthOf(board)} — ${CONGREGATION}`)];
    if (!list.length) {
      content.push({ text: 'Nenhuma reunião de meio de semana neste mês.', color: MUTED, italics: true, fontSize: 9 });
      return content;
    }
    list.forEach((e) => content.push(pmMidweekMeeting(e)));
    return content;
  }

  // Linha do quadro do final de semana: rótulo | valor | complemento à direita.
  function pmWeekendRow(label, value, opts = {}) {
    if (!hasValue(value)) return null;
    const extra = opts.extra && hasValue(opts.extra.value)
      ? {
        text: [
          { text: `${opts.extra.label}  `, bold: true, color: '#5B6B80', fontSize: 8 },
          { text: val(opts.extra.value) }
        ],
        alignment: 'right',
        noWrap: true
      }
      : { text: '' };
    return [
      { text: label, fontSize: 8, color: '#5B6B80', margin: [0, 1, 0, 0] },
      { text: val(value), bold: !!opts.strong },
      extra
    ];
  }

  // Seção do quadro: faixa colorida com ícone + linhas rótulo | valor | complemento.
  function pmWeekendSection(key, rows, opts = {}) {
    const filtered = rows.filter(Boolean);
    if (!filtered.length) return null;
    const theme = WEEKEND_THEME[key];
    const title = opts.title || weekendGroups()[key]?.title || theme.fallback;
    return {
      margin: [0, 0, 0, 3],
      table: {
        widths: [2.5, '*'],
        body: [
          [
            { text: '', fillColor: theme.color, rowSpan: 2 },
            {
              columns: [
                { svg: WEEKEND_ICONS[key].replace(/\{c\}/g, theme.color), width: 11, height: 11 },
                {
                  width: '*',
                  text: title.toUpperCase(),
                  bold: true,
                  fontSize: 7.5,
                  color: theme.color,
                  characterSpacing: 0.4,
                  margin: [0, 1.5, 0, 0]
                }
              ],
              columnGap: 6,
              fillColor: theme.bg,
              margin: [7, 2.5, 8, 2.5]
            }
          ],
          [
            {},
            {
              table: { widths: [opts.labelWidth || 62, '*', 'auto'], body: filtered },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: (i) => (i === 0 ? 0 : 6),
                paddingRight: (i, node) => (i === node.table.widths.length - 1 ? 0 : 6),
                paddingTop: () => 0.4,
                paddingBottom: () => 0.4
              },
              margin: [7, 2, 8, 2]
            }
          ]
        ]
      },
      layout: {
        hLineWidth: (i) => (i === 0 || i === 2 ? 0.5 : 0),
        vLineWidth: (i) => (i === 2 ? 0.5 : 0),
        hLineColor: () => LINE,
        vLineColor: () => LINE,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0
      }
    };
  }

  // "Nome — Congregação" (uma linha por irmão) → linhas do quadro.
  function pmSentSpeakerRows(text) {
    return String(text || '').split(/\r?\n/).map((line) => {
      const [name, ...rest] = line.split(/\s+[—–-]\s+/);
      return pmWeekendRow('Orador', name, { strong: true, extra: { label: 'Congregação:', value: rest.join(' — ') } });
    });
  }

  function pmWeekendCard(entry) {
    const d = entry.data || {};
    const title = entry.event_date ? formatDisplayDate(entry.event_date) : 'Sem data';
    const special = val(d.evento_especial);

    if (special) {
      return {
        unbreakable: true,
        margin: [0, 0, 0, 8],
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: title, style: 'liteBanner', fillColor: '#F4E6D4', color: T.accent, margin: [10, 5, 10, 5] },
              {
                stack: [
                  { text: 'PROGRAMA ALTERNATIVO', fontSize: 6.5, bold: true, color: T.accent, characterSpacing: 0.6, margin: [0, 0, 0, 3] },
                  { text: special, fontSize: 11, bold: true, color: T.header }
                ],
                margin: [10, 6, 10, 8]
              }
            ]
          }]]
        },
        layout: hairlineLayout()
      };
    }

    // Leitor e oração final dividem a linha; sem leitor, a oração ganha linha própria.
    const hasLeitor = hasValue(d.leitor_sentinela);
    const sections = [
      pmWeekendSection('discurso', [
        pmWeekendRow('Presidente', d.presidente),
        pmWeekendRow('Tema', d.tema_discurso, { strong: true }),
        pmWeekendRow('Orador', d.orador, { extra: { label: 'Congregação:', value: d.congregacao_orador } })
      ]),
      pmWeekendSection('sentinela', [
        pmWeekendRow('Tema', d.estudo_sentinela_tema, { strong: true }),
        pmWeekendRow('Cântico', d.cantico_sentinela),
        pmWeekendRow('Leitor', d.leitor_sentinela, hasLeitor ? { extra: { label: 'Oração final:', value: d.oracao_final } } : {}),
        pmWeekendRow('Cântico final', d.cantico_final),
        hasLeitor ? null : pmWeekendRow('Oração final', d.oracao_final)
      ]),
      pmWeekendSection('enviados', pmSentSpeakerRows(d.oradores_enviados))
    ].filter(Boolean);

    const body = sections.length
      ? { stack: sections }
      : { text: 'Sem designações preenchidas', color: MUTED, italics: true, fontSize: 8 };

    return {
      unbreakable: true,
      margin: [0, 0, 0, 6],
      table: {
        widths: ['*'],
        body: [
          [{
            columns: [
              { svg: CALENDAR_ICON, width: 15, height: 15 },
              { width: '*', text: title, style: 'liteBanner', margin: [0, 1.5, 0, 0] }
            ],
            columnGap: 7,
            fillColor: '#F3F5F8',
            margin: [8, 3, 10, 3]
          }],
          [{ ...body, margin: [8, 5, 8, 2] }]
        ]
      },
      layout: hairlineLayout()
    };
  }

  function buildWeekendContent(board, entries) {
    const list = entries.filter((e) => e.block === 'weekend').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const content = [pmCover(sectionTitles().weekend, `${monthOf(board)} — ${CONGREGATION}`)];
    if (!list.length) {
      content.push({ text: 'Nenhuma reunião de final de semana neste mês.', color: MUTED, italics: true, fontSize: 9 });
      return content;
    }

    // Um quadro por linha (largura total), como no modelo impresso da congregação.
    list.forEach((e) => content.push(pmWeekendCard(e)));

    // Dirigentes do trabalho de campo ficam num bloco único no fim, uma linha por data.
    const campoRows = list.map((e) => pmWeekendRow(
      e.event_date ? formatDisplayDate(e.event_date) : 'Sem data',
      e.data?.dirigente_sabado,
      { strong: true }
    ));
    const campo = pmWeekendSection('territorio', campoRows, { labelWidth: 78, title: 'Dirigentes de Campo' });
    if (campo) content.push({ ...campo, unbreakable: true, margin: [0, 4, 0, 0] });
    return content;
  }

  function buildDocDefinition(block, board, entries) {
    const cleaning = entries.filter((e) => e.block === 'limpeza_mensal');
    const month = monthOf(board);
    if (block === 'mecanicas') {
      return baseDoc(buildMecanicasContent(board, entries, cleaning), { section: sectionTitles().mecanicas, month });
    }
    if (block === 'midweek') {
      return baseDoc(buildMidweekContent(board, entries), { section: sectionTitles().midweek, month });
    }
    if (block === 'weekend') {
      return baseDoc(buildWeekendContent(board, entries), { section: sectionTitles().weekend, month });
    }
    const content = [
      ...buildMecanicasContent(board, entries, cleaning),
      { text: '', pageBreak: 'before' },
      ...buildMidweekContent(board, entries),
      { text: '', pageBreak: 'before' },
      ...buildWeekendContent(board, entries)
    ];
    return baseDoc(content, { section: 'Quadro completo', month });
  }

  function toPdfBlob(docDef) {
    return new Promise((resolve, reject) => {
      try {
        window.pdfMake.createPdf(docDef).getBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Não foi possível gerar o PDF. Tente de novo.'));
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async function blockToPdfBlob(block, board, entries) {
    await ensurePdfMake();
    await ensureMeasure();
    const docDef = buildDocDefinition(block, board, entries);
    docDef.info = { title: fileTitle(block, board) };
    return toPdfBlob(docDef);
  }

  async function boardToPdfBlob(board, entries) {
    await ensurePdfMake();
    await ensureMeasure();
    const docDef = buildDocDefinition('full', board, entries);
    docDef.info = { title: fileTitle('full', board) };
    return toPdfBlob(docDef);
  }

  window.JEAnnouncementPdf = { blockToPdfBlob, boardToPdfBlob, fileTitle };
})();
