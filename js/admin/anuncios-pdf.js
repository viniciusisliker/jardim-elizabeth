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
              { text: CONGREGATION, fontSize: 7, color: '#6B7280', margin: [0, 6, 0, 0] },
              { text: [month, section].filter(Boolean).join('  ·  '), alignment: 'center', fontSize: 7, color: '#6B7280', margin: [0, 6, 0, 0] },
              { text: `${currentPage} / ${pageCount}`, alignment: 'right', fontSize: 7, color: '#6B7280', margin: [0, 6, 0, 0] }
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
          [pmHead('Portão'), pmHead('Indicador'), pmHead('Som')],
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

  function pmAssigneeText(assignee) {
    if (hasValue(assignee)) return { text: val(assignee), bold: true, color: T.text };
    return { text: 'a designar', color: MUTED, italics: true };
  }

  function pmMidweekRow(num, label, assignee, sideStack, opts) {
    const required = opts?.required;
    const title = val(label);
    if (!required && !title && !hasValue(assignee) && !sideStack) return null;
    const main = {
      width: sideStack ? '*' : '100%',
      text: [
        { text: `${num}  `, bold: true, color: T.headerAlt, fontSize: 8 },
        { text: `${title || 'Parte'}  `, fontSize: 8.5 },
        pmAssigneeText(assignee)
      ],
      margin: [0, 1.5, 0, 1.5]
    };
    if (!sideStack) return { columns: [main] };
    return {
      columns: [
        main,
        {
          width: '34%',
          stack: sideStack,
          fontSize: 7,
          alignment: 'right',
          color: '#4B5563',
          margin: [4, 1, 0, 0]
        }
      ],
      columnGap: 6
    };
  }

  function pmMidweekSection(themeKey, rows) {
    const filtered = rows.filter(Boolean);
    if (!filtered.length) return null;
    const theme = MIDWEEK_THEME[themeKey];
    return {
      margin: [0, 0, 0, 4],
      table: {
        widths: ['*'],
        body: [
          [{
            text: theme.title.toUpperCase(),
            bold: true,
            fontSize: 7,
            color: theme.color,
            fillColor: theme.bg,
            characterSpacing: 0.4,
            margin: [8, 4, 8, 4]
          }],
          [{ stack: filtered, margin: [8, 3, 8, 5] }]
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
    const weekday = val(entry.weekday_label);
    const reading = val(d.leitura_biblica);
    const weekTitle = reading ? `${datePart}  ·  ${reading}` : datePart;

    const salaB3 = [];
    if (hasValue(d.dirigente_sala_b)) {
      salaB3.push({ text: [{ text: 'Dir. Sala B  ', bold: true }, val(d.dirigente_sala_b)] });
    }
    if (hasValue(d.leitura_biblia_sala_b)) {
      salaB3.push({ text: [{ text: 'Leitura B  ', bold: true }, val(d.leitura_biblia_sala_b)] });
    }

    const tesouros = [
      pmMidweekRow(1, val(d.tesouros_titulo) || 'Tesouros da Palavra de Deus', d.tesouros_designado, null, { required: true }),
      pmMidweekRow(2, 'Joias espirituais', d.joias_designado, null, { required: true }),
      pmMidweekRow(3, 'Leitura da Bíblia', d.leitura_biblia, salaB3.length ? salaB3 : null, { required: true })
    ];

    const ministerio = [1, 2, 3].map((i) => {
      const tipo = val(d[`ministerio_${i}_tipo`]);
      const people = d[`ministerio_${i}_designados`];
      const salaB = d[`ministerio_${i}_sala_b`];
      if (!tipo && !hasValue(people) && !hasValue(salaB)) return null;
      const side = hasValue(salaB)
        ? [{ text: [{ text: 'Sala B  ', bold: true }, val(salaB)] }]
        : null;
      return pmMidweekRow(i + 3, tipo || `Parte ${i}`, people, side);
    });

    const vidaRows = [
      pmMidweekRow(7, val(d.vida_crista_titulo) || 'Nossa vida cristã', d.vida_crista_designado, null, { required: true }),
      pmMidweekRow(8, 'Estudo bíblico de congregação', d.leitor_sentinela ? `Leitor: ${val(d.leitor_sentinela)}` : '', null, { required: true })
    ];

    const metaBits = [];
    if (hasValue(d.cantico)) metaBits.push({ text: [{ text: 'Cântico  ', bold: true, color: T.headerAlt }, val(d.cantico)], fontSize: 8 });
    if (hasValue(d.presidente)) metaBits.push({ text: [{ text: 'Presidente  ', bold: true, color: T.headerAlt }, val(d.presidente)], fontSize: 8 });

    const footer = hasValue(d.oracao_final)
      ? {
        margin: [0, 5, 0, 0],
        table: {
          widths: ['*'],
          body: [[{
            text: [{ text: 'Oração final  ', bold: true, color: '#8A3D3D' }, val(d.oracao_final)],
            fontSize: 8.5,
            alignment: 'right',
            fillColor: '#FAF0F0',
            margin: [8, 4, 8, 4]
          }]]
        },
        layout: 'noBorders'
      }
      : null;

    const inner = [
      {
        table: {
          widths: ['*'],
          body: [[{
            columns: [
              {
                stack: [
                  { text: weekTitle, fontSize: 11, bold: true, color: T.header },
                  weekday
                    ? { text: `Meio de semana  ·  ${weekday}`, fontSize: 7, color: T.headerAlt, margin: [0, 2, 0, 0] }
                    : null
                ].filter(Boolean)
              }
            ],
            fillColor: '#EEF3F8',
            margin: [10, 7, 10, 7]
          }]]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, metaBits.length ? 5 : 6]
      },
      metaBits.length ? { columns: metaBits, columnGap: 16, margin: [2, 0, 2, 6] } : null,
      pmMidweekSection('tesouros', tesouros),
      pmMidweekSection('ministerio', ministerio),
      pmMidweekSection('vida', vidaRows),
      footer
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
        paddingTop: () => 8,
        paddingBottom: () => 8
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

  function kvLine(label, value) {
    if (!hasValue(value)) return null;
    return {
      text: [
        { text: `${label}  `, style: 'inlineLabel' },
        { text: val(value), style: 'inlineVal', bold: true }
      ],
      margin: [0, 0, 0, 2]
    };
  }

  function pmWeekendCard(entry) {
    const d = entry.data || {};
    const dateStr = entry.event_date ? formatDisplayDate(entry.event_date) : 'Sem data';
    const title = entry.weekday_label ? `${dateStr}  ·  ${entry.weekday_label}` : dateStr;
    const special = val(d.evento_especial);

    if (special) {
      return {
        unbreakable: true,
        margin: [0, 0, 0, 8],
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: title, style: 'liteBanner', fillColor: '#F4E6D4', color: T.accent, margin: [8, 6, 8, 6] },
              {
                stack: [
                  { text: 'PROGRAMA ALTERNATIVO', fontSize: 6.5, bold: true, color: T.accent, characterSpacing: 0.6, margin: [0, 0, 0, 3] },
                  { text: special, fontSize: 11, bold: true, color: T.header }
                ],
                margin: [8, 8, 8, 10]
              }
            ]
          }]]
        },
        layout: hairlineLayout()
      };
    }

    const oradorLine = hasValue(d.orador)
      ? (hasValue(d.congregacao_orador) ? `${val(d.orador)}  ·  ${val(d.congregacao_orador)}` : val(d.orador))
      : '';

    const blocks = [
      {
        title: weekendGroups().territorio?.title || 'Trabalho de campo',
        lines: [kvLine('Dirigente', d.dirigente_sabado)]
      },
      {
        title: weekendGroups().discurso?.title || 'Discurso público',
        lines: [
          kvLine('Presidente', d.presidente),
          kvLine('Tema', d.tema_discurso),
          kvLine('Orador', oradorLine)
        ]
      },
      {
        title: weekendGroups().sentinela?.title || 'Estudo da Sentinela',
        lines: [
          kvLine('Tema', d.estudo_sentinela_tema),
          kvLine('Leitor', d.leitor_sentinela),
          kvLine('Oração final', d.oracao_final)
        ]
      },
      {
        title: weekendGroups().sala_b?.title || 'Sala B',
        lines: [kvLine('Presidente', d.presidente_sala_b)]
      }
    ].map((b) => ({ ...b, lines: b.lines.filter(Boolean) })).filter((b) => b.lines.length);

    const body = blocks.length
      ? {
        stack: blocks.map((b) => ({
          margin: [0, 0, 0, 5],
          stack: [
            { text: b.title.toUpperCase(), style: 'sectionTitle', margin: [0, 0, 0, 2] },
            ...b.lines
          ]
        }))
      }
      : { text: 'Sem designações preenchidas', color: MUTED, italics: true, fontSize: 8 };

    return {
      unbreakable: true,
      margin: [0, 0, 0, 8],
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: title, style: 'liteBanner', fillColor: T.sectionBg, margin: [8, 6, 8, 6] },
            { ...body, margin: [8, 6, 8, 8] }
          ]
        }]]
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

    const cards = list.map((e) => pmWeekendCard(e));
    if (cards.length >= 3) {
      const pairs = chunkEntries(cards, 2);
      pairs.forEach((pair) => {
        if (pair.length === 2) {
          content.push({
            columns: [
              { width: '*', stack: [pair[0]] },
              { width: 10, text: '' },
              { width: '*', stack: [pair[1]] }
            ],
            margin: [0, 0, 0, 2]
          });
        } else {
          content.push(pair[0]);
        }
      });
    } else {
      content.push(...cards);
    }
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
    return toPdfBlob(buildDocDefinition(block, board, entries));
  }

  async function boardToPdfBlob(board, entries) {
    await ensurePdfMake();
    return toPdfBlob(buildDocDefinition('full', board, entries));
  }

  window.JEAnnouncementPdf = { blockToPdfBlob, boardToPdfBlob };
})();
