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

  const MIDWEEK_THEME = {
    tesouros: { color: '#4A7190', bg: '#EEF3F8', title: 'Tesouros da Palavra de Deus' },
    ministerio: { color: '#8F7344', bg: '#F9F5EE', title: 'Faça seu melhor no ministério' },
    vida: { color: '#9B4545', bg: '#FAF0F0', title: 'Nossa vida cristã' }
  };

  const T = window.JEAnnouncementTheme || {
    header: '#002060', headerAlt: '#1F497D', accent: '#984806',
    sectionBg: '#EEECE1', cream: '#F7F6F2', border: '#1F497D', text: '#1B1C1C'
  };

  const PDFMAKE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12';

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
      s.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
      document.head.appendChild(s);
    });
  }

  async function ensurePdfMake() {
    if (window.pdfMake?.vfs) return;
    await loadScriptOnce(`${PDFMAKE_CDN}/pdfmake.min.js`);
    await loadScriptOnce(`${PDFMAKE_CDN}/vfs_fonts.min.js`);
    if (!window.pdfMake?.vfs) throw new Error('pdfMake não inicializou.');
  }

  function cardBorderLayout() {
    const line = T.border;
    return {
      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 1.2 : 0),
      vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length ? 1.2 : 0),
      hLineColor: () => line,
      vLineColor: () => line,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0
    };
  }

  function gridLayout() {
    return {
      hLineWidth: (i) => (i === 1 || i === 3 ? 0.5 : 0),
      vLineWidth: () => 0.5,
      hLineColor: () => '#D9E2F3',
      vLineColor: () => '#D9E2F3',
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 3,
      paddingBottom: () => 3
    };
  }

  function baseDoc(content) {
    return {
      pageSize: 'A4',
      pageMargins: [40, 42, 40, 46],
      defaultStyle: { font: 'Roboto', fontSize: 9, color: T.text },
      styles: {
        coverTitle: { fontSize: 15, bold: true, color: T.header },
        coverSub: { fontSize: 9, color: '#43474f', margin: [0, 3, 0, 0] },
        bannerMeta: { fontSize: 7, color: '#ffffff', margin: [0, 0, 0, 2] },
        bannerDate: { fontSize: 12, bold: true, color: '#ffffff' },
        gridHead: { fontSize: 7, bold: true, color: '#ffffff', alignment: 'center' },
        gridVal: { fontSize: 9, bold: true, alignment: 'center' },
        gridValEmpty: { fontSize: 9, color: '#b8bcc6', italics: true, alignment: 'center' },
        liteBanner: { fontSize: 11, bold: true, color: T.header },
        sectionTitle: { fontSize: 7, bold: true, color: T.headerAlt },
        inlineLabel: { fontSize: 7, bold: true, color: T.headerAlt },
        inlineVal: { fontSize: 8 }
      },
      content
    };
  }

  function pmCover(title, subtitle) {
    return {
      margin: [0, 0, 0, 14],
      stack: [
        { text: title, style: 'coverTitle' },
        { text: subtitle, style: 'coverSub' },
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.2, lineColor: T.header }],
          margin: [0, 6, 0, 0]
        }
      ]
    };
  }

  function pmHead(label) {
    return { text: label, style: 'gridHead', fillColor: T.header };
  }

  function pmCell(value) {
    const raw = val(value);
    return {
      text: raw || '·',
      style: raw ? 'gridVal' : 'gridValEmpty',
      margin: [2, 4, 2, 4]
    };
  }

  function pmMecanicasGrid(d) {
    return {
      table: {
        widths: ['*', '*', '*'],
        body: [
          [pmHead('Portão'), pmHead('Indicador'), pmHead('Som')],
          [pmCell(d.portao), pmCell(d.indicador), pmCell(d.som)],
          [pmHead('Mic. 1'), pmHead('Mic. 2'), pmHead('Limpeza')],
          [pmCell(d.microf_volantes_1), pmCell(d.microf_volantes_2), pmCell(d.limpeza_grupo)]
        ]
      },
      layout: gridLayout()
    };
  }

  function pmMecanicasCard(entry, idx, total) {
    const d = entry.data || {};
    const dateStr = entry.event_date ? formatDisplayDate(entry.event_date) : 'Sem data';
    const dateLine = entry.weekday_label ? `${dateStr} · ${entry.weekday_label}` : dateStr;

    return {
      margin: [0, 0, 0, 12],
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            {
              table: {
                widths: ['*'],
                body: [[{
                  stack: [
                    { text: `Designações Mecânicas · ${idx + 1} de ${total}`, style: 'bannerMeta' },
                    { text: dateLine, style: 'bannerDate' }
                  ],
                  fillColor: T.header,
                  margin: [10, 8, 10, 10]
                }]]
              },
              layout: 'noBorders'
            },
            {
              ...pmMecanicasGrid(d),
              fillColor: T.cream,
              margin: [8, 8, 8, 10]
            }
          ]
        }]]
      },
      layout: cardBorderLayout()
    };
  }

  function pmLimpezaTable(cleaningRows) {
    if (!cleaningRows.length) return null;
    const rows = cleaningRows.map((e) => {
      const d = e.data || {};
      return [
        { text: val(d.fim_de_semana) || '·', style: 'gridVal' },
        { text: val(d.grupo) || '·', style: 'gridVal' }
      ];
    });
    return {
      margin: [0, 8, 0, 0],
      stack: [
        {
          text: 'Limpeza mensal',
          bold: true,
          fontSize: 9,
          color: T.accent,
          fillColor: T.sectionBg,
          margin: [8, 6, 8, 6]
        },
        {
          table: {
            widths: ['*', '*'],
            body: [
              [
                { text: 'Fim de semana', style: 'gridHead', fillColor: T.header },
                { text: 'Grupo', style: 'gridHead', fillColor: T.header }
              ],
              ...rows
            ]
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#D9E2F3',
            vLineColor: () => '#D9E2F3'
          }
        }
      ]
    };
  }

  function buildMecanicasDoc(board, entries, cleaningRows) {
    const month = board.reference_label || '';
    const list = entries.filter((e) => e.block === 'mecanicas').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const sheets = chunkEntries(list, 4);
    const content = [];
    let cardIndex = 0;

    sheets.forEach((sheetEntries, sheetIdx) => {
      if (sheetIdx > 0) content.push({ text: '', pageBreak: 'before' });
      if (sheetIdx === 0) {
        content.push(pmCover(sectionTitles().mecanicas, `${month} — Jardim Elizabeth`));
      }
      sheetEntries.forEach((e) => {
        content.push(pmMecanicasCard(e, cardIndex, list.length));
        cardIndex += 1;
      });
    });

    const limpeza = pmLimpezaTable(cleaningRows);
    if (limpeza) {
      content.push({ text: '', pageBreak: 'before' });
      content.push(limpeza);
    }

    return baseDoc(content);
  }

  function pmAssigneeText(assignee) {
    if (hasValue(assignee)) return { text: val(assignee), bold: true };
    return { text: '·', color: '#b8bcc6', italics: true };
  }

  function pmMidweekRow(num, label, assignee, sideStack) {
    const main = {
      width: sideStack ? '*' : '100%',
      text: [
        { text: `${num}. `, bold: true, color: '#666' },
        { text: `${label} – ` },
        pmAssigneeText(assignee)
      ],
      fontSize: 9,
      margin: [0, 2, 0, 2]
    };
    if (!sideStack) return { columns: [main] };
    return {
      columns: [
        main,
        {
          width: '36%',
          stack: sideStack,
          fontSize: 7.5,
          alignment: 'right',
          color: '#43474f',
          margin: [6, 0, 0, 0]
        }
      ],
      columnGap: 8
    };
  }

  function pmMidweekSection(themeKey, rows) {
    const filtered = rows.filter(Boolean);
    if (!filtered.length) return null;
    const theme = MIDWEEK_THEME[themeKey];
    return {
      margin: [0, 0, 0, 6],
      table: {
        widths: ['*'],
        body: [
          [{
            text: theme.title.toUpperCase(),
            bold: true,
            fontSize: 7.5,
            color: theme.color,
            fillColor: theme.bg,
            margin: [8, 5, 8, 5]
          }],
          [{ stack: filtered, margin: [6, 4, 6, 6] }]
        ]
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => 'rgba(0,0,0,.08)',
        vLineColor: () => 'rgba(0,0,0,.08)'
      }
    };
  }

  function pmMidweekMeeting(entry) {
    const d = entry.data || {};
    const datePart = entry.event_date ? formatDisplayDate(entry.event_date) : 'Sem data';
    const weekday = val(entry.weekday_label);
    const reading = val(d.leitura_biblica);
    const weekTitle = reading ? `${datePart} – ${reading.toUpperCase()}` : datePart;

    const salaB3 = [];
    if (hasValue(d.dirigente_sala_b)) {
      salaB3.push({ text: [{ text: 'Dirigente Sala B: ', bold: true }, val(d.dirigente_sala_b)] });
    }
    if (hasValue(d.leitura_biblia_sala_b)) {
      salaB3.push({ text: [{ text: 'Sala B: ', bold: true }, val(d.leitura_biblia_sala_b)] });
    }

    const tesouros = [
      pmMidweekRow(1, val(d.tesouros_titulo) || 'Tesouros da Palavra de Deus', d.tesouros_designado, null),
      pmMidweekRow(2, 'Joias espirituais', d.joias_designado, null),
      pmMidweekRow(3, 'Leitura da Bíblia', d.leitura_biblia, salaB3.length ? salaB3 : null)
    ];

    const ministerio = [1, 2, 3].map((i) => {
      const label = val(d[`ministerio_${i}_tipo`]) || `Parte ${i}`;
      const side = hasValue(d[`ministerio_${i}_sala_b`])
        ? [{ text: [{ text: 'Sala B: ', bold: true }, val(d[`ministerio_${i}_sala_b`])] }]
        : null;
      return pmMidweekRow(i + 3, label, d[`ministerio_${i}_designados`], side);
    });

    const vida = [
      pmMidweekRow(7, val(d.vida_crista_titulo) || 'Nossa vida cristã', d.vida_crista_designado, null),
      pmMidweekRow(8, 'Estudo bíblico de congregação', '', null),
      hasValue(d.leitor_sentinela)
        ? { text: [{ text: 'Leitor: ', bold: true, color: '#9B4545' }, val(d.leitor_sentinela)], fontSize: 8, margin: [14, 0, 0, 4] }
        : null
    ].filter(Boolean);

    const meta = [];
    if (hasValue(d.cantico)) meta.push({ text: [{ text: 'Cântico ', bold: true, color: T.header }, val(d.cantico)], fontSize: 8 });
    if (hasValue(d.presidente)) meta.push({ text: [{ text: 'Presidente ', bold: true, color: T.header }, val(d.presidente)], fontSize: 8 });

    const sections = [
      pmMidweekSection('tesouros', tesouros),
      pmMidweekSection('ministerio', ministerio),
      pmMidweekSection('vida', vida)
    ].filter(Boolean);

    const footer = hasValue(d.oracao_final)
      ? {
        margin: [0, 8, 0, 0],
        text: [{ text: 'Oração final ', bold: true, color: '#9B4545' }, `– ${val(d.oracao_final)}`],
        fontSize: 9,
        color: '#9B4545',
        fillColor: '#FAF0F0',
        alignment: 'right'
      }
      : null;

    const inner = [
      {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: weekTitle, fontSize: 11, bold: true, color: T.header },
              weekday ? { text: `Reunião de meio de semana · ${weekday}`, fontSize: 7, color: T.headerAlt, margin: [0, 2, 0, 0] } : null
            ].filter(Boolean),
            fillColor: '#EEF3F8',
            margin: [10, 8, 10, 8]
          }]]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, meta.length ? 6 : 8]
      },
      meta.length ? { columns: meta, columnGap: 12, margin: [0, 0, 0, 8] } : null,
      ...sections,
      footer
    ].filter(Boolean);

    return {
      margin: [0, 0, 0, 16],
      table: {
        widths: ['*'],
        body: [[{ stack: inner }]]
      },
      layout: {
        hLineWidth: () => 0.8,
        vLineWidth: () => 0.8,
        hLineColor: () => '#C5D4E8',
        vLineColor: () => '#C5D4E8',
        paddingLeft: () => 10,
        paddingRight: () => 10,
        paddingTop: () => 10,
        paddingBottom: () => 10
      }
    };
  }

  function buildMidweekDoc(board, entries) {
    const list = entries.filter((e) => e.block === 'midweek').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const content = [
      pmCover(sectionTitles().midweek, `${board.reference_label || ''} — Jardim Elizabeth`),
      ...list.map((e) => pmMidweekMeeting(e))
    ];
    return baseDoc(content);
  }

  function pmWeekendCard(entry) {
    const d = entry.data || {};
    const dateStr = entry.event_date ? formatDisplayDate(entry.event_date) : 'Sem data';
    const title = entry.weekday_label ? `${dateStr} · ${entry.weekday_label}` : dateStr;

    const order = ['territorio', 'discurso', 'sentinela', 'sala_b', 'especial'];
    const sections = order.map((gid) => {
      const meta = weekendGroups()[gid];
      const groupFields = weekendFields().filter((f) => f.group === gid);
      const lines = groupFields
        .filter((f) => hasValue(d[f.key]))
        .map((f) => ({
          text: [
            { text: `${f.label}: `, style: 'inlineLabel' },
            { text: val(d[f.key]), style: 'inlineVal' }
          ],
          margin: [0, 0, 0, 3]
        }));
      if (!lines.length) return null;
      return {
        margin: [0, 0, 0, 5],
        stack: [
          { text: meta.title, style: 'sectionTitle', margin: [0, 0, 0, 3] },
          ...lines
        ]
      };
    }).filter(Boolean);

    const body = sections.length
      ? { stack: sections }
      : { text: 'Sem designações preenchidas', color: '#b8bcc6', italics: true, fontSize: 8 };

    return {
      margin: [0, 0, 0, 12],
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            {
              text: title,
              style: 'liteBanner',
              fillColor: T.sectionBg,
              margin: [8, 6, 8, 6],
              border: [false, false, false, false]
            },
            { ...body, margin: [8, 6, 8, 8] }
          ]
        }]]
      },
      layout: cardBorderLayout()
    };
  }

  function buildWeekendDoc(board, entries) {
    const list = entries.filter((e) => e.block === 'weekend').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const cards = list.map((e) => pmWeekendCard(e));
    const mid = Math.ceil(cards.length / 2);
    const left = cards.slice(0, mid);
    const right = cards.slice(mid);

    const content = [
      pmCover(sectionTitles().weekend, `${board.reference_label || ''} — Jardim Elizabeth`)
    ];

    if (right.length) {
      content.push({
        columns: [
          { width: '*', stack: left },
          { width: 14, text: '' },
          { width: '*', stack: right }
        ],
        columnGap: 10
      });
    } else {
      content.push(...left);
    }

    return baseDoc(content);
  }

  function buildDocDefinition(block, board, entries) {
    const cleaning = entries.filter((e) => e.block === 'limpeza_mensal');
    if (block === 'mecanicas') return buildMecanicasDoc(board, entries, cleaning);
    if (block === 'midweek') return buildMidweekDoc(board, entries);
    return buildWeekendDoc(board, entries);
  }

  async function blockToPdfBlob(block, board, entries) {
    await ensurePdfMake();
    const docDef = buildDocDefinition(block, board, entries);
    return new Promise((resolve, reject) => {
      try {
        window.pdfMake.createPdf(docDef).getBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('PDF vazio.'));
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  window.JEAnnouncementPdf = { blockToPdfBlob };
})();
