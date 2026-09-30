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

  const MIDWEEK_ICONS = {
    tesouros: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="{c}"/><path d="M7.5 6.5h9l3 3.6L12 19 4.5 10.1z" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><path d="M4.5 10.1h15M9.6 6.5 8.3 10.1 12 19l3.7-8.9-1.3-3.6" fill="none" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>',
    ministerio: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="{c}"/><path d="M12 20V5" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><g fill="#fff"><ellipse cx="12" cy="5" rx="1.3" ry="2"/><ellipse cx="9.6" cy="8.6" rx="1.2" ry="2" transform="rotate(-35 9.6 8.6)"/><ellipse cx="14.4" cy="8.6" rx="1.2" ry="2" transform="rotate(35 14.4 8.6)"/><ellipse cx="9.6" cy="12.2" rx="1.2" ry="2" transform="rotate(-35 9.6 12.2)"/><ellipse cx="14.4" cy="12.2" rx="1.2" ry="2" transform="rotate(35 14.4 12.2)"/><ellipse cx="9.6" cy="15.8" rx="1.2" ry="2" transform="rotate(-35 9.6 15.8)"/><ellipse cx="14.4" cy="15.8" rx="1.2" ry="2" transform="rotate(35 14.4 15.8)"/></g></svg>',
    vida: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="{c}"/><g fill="#fff"><circle cx="8" cy="11" r="2.6"/><circle cx="11" cy="9.6" r="2.8"/><circle cx="14.2" cy="10.2" r="2.6"/><circle cx="9.4" cy="13.4" r="2.6"/><circle cx="13" cy="13.6" r="2.7"/><circle cx="15.6" cy="12.8" r="2.2"/><rect x="8.6" y="15" width="1.4" height="4" rx="0.6"/><rect x="13.4" y="15" width="1.4" height="4" rx="0.6"/></g><ellipse cx="18" cy="10.6" rx="1.9" ry="1.5" fill="#fff" stroke="{c}" stroke-width="0.8"/><circle cx="18.5" cy="10.3" r="0.35" fill="{c}"/></svg>'
  };

  const CALENDAR_ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#5B6573"/><rect x="6" y="7.5" width="12" height="10.5" rx="1.4" fill="#fff"/><rect x="6" y="7.5" width="12" height="3" rx="1" fill="#C9D3DF"/><rect x="8.6" y="5.6" width="1.3" height="3.4" rx="0.6" fill="#fff"/><rect x="14.1" y="5.6" width="1.3" height="3.4" rx="0.6" fill="#fff"/><g fill="#5B6573"><rect x="8" y="12.3" width="1.8" height="1.5"/><rect x="11.1" y="12.3" width="1.8" height="1.5"/><rect x="14.2" y="12.3" width="1.8" height="1.5"/><rect x="8" y="15" width="1.8" height="1.5"/><rect x="11.1" y="15" width="1.8" height="1.5"/></g></svg>';

  function pmAssigneeText(assignee) {
    if (hasValue(assignee)) return { text: val(assignee), bold: true, color: T.text };
    return { text: 'a designar', color: MUTED, italics: true };
  }

  function pmSideLine(label, value, color) {
    return { label, value: val(value), color };
  }

  // Largura fixa do título: os nomes alinham também entre seções (título longo quebra linha).
  const PM_TITLE_WIDTH = 132;

  // Cada linha vira uma linha de tabela: nº | parte | designados | rótulo Sala B | nome Sala B.
  // Assim os nomes ficam alinhados em coluna dentro da seção.
  function pmMidweekRow(num, label, assignee, sideStack, opts) {
    const required = opts?.required;
    const color = opts?.color || T.headerAlt;
    const title = val(label);
    if (!required && !title && !hasValue(assignee) && !sideStack) return null;
    const titleRuns = [{ text: title || 'Parte', bold: true, color }];
    if (opts?.duration) titleRuns.push({ text: ` (${opts.duration})`, bold: false, color, fontSize: 7.5 });
    const side = sideStack || [];
    return {
      hasSide: side.length > 0,
      cells: [
        { text: `${num}.`, bold: true, color, alignment: 'right' },
        { text: titleRuns },
        { text: [pmAssigneeText(assignee)] },
        { stack: side.map((s) => ({ text: s.label, bold: true, color: s.color })), alignment: 'right', fontSize: 8 },
        { stack: side.map((s) => ({ text: s.value, color: T.text })), fontSize: 8 }
      ]
    };
  }

  function pmRowsTable(rows) {
    const withSide = rows.some((r) => r.hasSide);
    return {
      table: {
        widths: withSide ? [12, PM_TITLE_WIDTH, '*', 'auto', 'auto'] : [12, PM_TITLE_WIDTH, '*'],
        body: rows.map((r) => (withSide ? r.cells : r.cells.slice(0, 3)))
      },
      fontSize: 8.5,
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: (i) => (i === 0 ? 0 : i === 3 ? 6 : 4),
        paddingRight: (i, node) => (i === node.table.widths.length - 1 ? 0 : 4),
        paddingTop: () => 2,
        paddingBottom: () => 2
      }
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
          [{ stack: [pmRowsTable(filtered)], margin: [8, 1, 8, 3] }]
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

    const salaB3 = [];
    if (hasValue(d.dirigente_sala_b)) salaB3.push(pmSideLine('Dirigente Sala B', d.dirigente_sala_b, cT));
    if (hasValue(d.leitura_biblia_sala_b)) salaB3.push(pmSideLine('Sala B', d.leitura_biblia_sala_b, cT));
    const hasSalaB = salaB3.length > 0;

    const tesouros = [
      pmMidweekRow(1, val(d.tesouros_titulo) || 'Tesouros da Palavra de Deus', d.tesouros_designado, null, { required: true, color: cT }),
      pmMidweekRow(2, 'Joias espirituais', d.joias_designado, null, { required: true, color: cT, duration: '10 min' }),
      pmMidweekRow(3, hasValue(d.leitura_biblia_sala_b) ? 'Leitura da Bíblia (Sala A)' : 'Leitura da Bíblia', d.leitura_biblia, hasSalaB ? salaB3 : null, { required: true, color: cT })
    ];

    const ministerio = [1, 2, 3, 4].map((i) => {
      const tipo = val(d[`ministerio_${i}_tipo`]);
      const people = d[`ministerio_${i}_designados`];
      const salaB = d[`ministerio_${i}_sala_b`];
      if (!tipo && !hasValue(people) && !hasValue(salaB)) return null;
      const side = hasValue(salaB) ? [pmSideLine('Sala B', salaB, cM)] : null;
      return pmMidweekRow(i + 3, tipo || `Parte ${i}`, people, side, { color: cM });
    });

    const vidaNum = 4 + Math.max(3, ministerio.reduce((last, row, idx) => (row ? idx + 1 : last), 0));
    const vidaRows = [
      pmMidweekRow(vidaNum, val(d.vida_crista_titulo) || 'Nossa vida cristã', d.vida_crista_designado, null, { required: true, color: cV }),
      pmMidweekRow(vidaNum + 1, 'Estudo bíblico de congregação', d.estudo_dirigente, null, { required: true, color: cV })
    ];

    const metaBits = [];
    if (hasValue(d.cantico)) metaBits.push({ text: [{ text: 'Cântico  ', bold: true, color: T.headerAlt }, val(d.cantico)], fontSize: 8.5 });
    if (hasValue(d.presidente)) metaBits.push({ text: [{ text: 'Presidente  ', bold: true, color: T.headerAlt }, val(d.presidente)], fontSize: 8.5 });

    const closing = [];
    if (hasValue(d.leitor_sentinela)) {
      closing.push({ width: '*', text: [{ text: 'Leitor  ', bold: true, color: cV }, val(d.leitor_sentinela)] });
    }
    if (hasValue(d.oracao_final)) {
      closing.push({ width: '*', text: [{ text: 'Oração final  ', bold: true, color: cV }, val(d.oracao_final)], alignment: closing.length ? 'right' : 'center' });
    }
    if (closing.length === 1 && closing[0].alignment !== 'center') closing[0].alignment = 'center';

    const footer = closing.length
      ? {
        margin: [0, 5, 0, 0],
        table: {
          widths: ['*'],
          body: [[{
            columns: closing,
            columnGap: 16,
            fontSize: 8.5,
            fillColor: MIDWEEK_THEME.vida.bg,
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
              { svg: CALENDAR_ICON, width: 22, height: 22, margin: [0, -2, 0, 0] },
              {
                width: '*',
                text: weekTitle,
                fontSize: 11,
                bold: true,
                color: T.header,
                margin: [0, 3, 0, 0]
              }
            ],
            columnGap: 8,
            fillColor: '#EEF3F8',
            margin: [8, 6, 10, 6]
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
