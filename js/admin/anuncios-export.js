(function () {
  const CSV_HEADER = [
    'Subject', 'Start Date', 'Start Time', 'End Date', 'End Time',
    'All Day Event', 'Description', 'Location', 'Private'
  ];

  const DEFAULT_START = '07:30 PM';
  const DEFAULT_END = '09:30 PM';
  const SENTINEL_DIRECTOR = 'Denison Oliveira';

  const BLOCK_EXPORT_META = {
    mecanicas: {
      title: 'Designações Mecânicas',
      filename: 'mecanicas',
      rules: [
        'Não omita nenhuma designação — se tiver dúvida, inclua',
        'Uma linha por pessoa ou limpeza',
        'Em designações duplas, crie um evento por pessoa',
        'Horário fixo: 07:30 PM – 09:30 PM'
      ]
    },
    midweek: {
      title: 'Vida e Ministério (meio de semana)',
      filename: 'vmc',
      rules: [
        'Não omita nenhuma designação — se tiver dúvida, inclua',
        'Uma linha por pessoa ou dupla',
        'Inclua os números das designações quando houver',
        'Designações da Sala B: adicione “(Sala B)” ao final do Subject',
        'Horário fixo: 07:30 PM – 09:30 PM'
      ]
    },
    weekend: {
      title: 'Final de semana',
      filename: 'final-de-semana',
      rules: [
        'Não omita nenhuma designação — se tiver dúvida, inclua',
        'Uma linha por pessoa',
        'Evento especial: uma linha só com o nome do evento',
        'Estudo de A Sentinela: sem título do estudo no Subject',
        `Estudo de A Sentinela: Dirigente ${SENTINEL_DIRECTOR} | Leitor no Subject`,
        'Horário fixo: 07:30 PM – 09:30 PM'
      ]
    }
  };

  function escapeCsv(val) {
    const s = String(val ?? '').replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  }

  function trim(val) {
    return String(val ?? '').trim();
  }

  function toUsDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${m}/${d}/${y}`;
  }

  function splitPeople(value) {
    const s = trim(value);
    if (!s) return [];
    return s.split(/\s*(?:&|,|\s+e\s+)\s*/i).map((p) => p.trim()).filter(Boolean);
  }

  function calendarRow(subject, isoDate, startTime, endTime) {
    const date = toUsDate(isoDate);
    return [
      subject,
      date,
      startTime || DEFAULT_START,
      date,
      endTime || DEFAULT_END,
      'FALSE',
      '',
      '',
      'FALSE'
    ].map(escapeCsv).join(',');
  }

  function pushRow(rows, subject, isoDate) {
    if (!subject || !isoDate) return;
    rows.push(calendarRow(subject, isoDate));
  }

  function rowsForMecanicas(entry) {
    const d = entry.data || {};
    const iso = entry.event_date;
    const out = [];

    if (trim(d.portao)) pushRow(out, `Portão: ${trim(d.portao)}`, iso);
    splitPeople(d.microf_volantes_1).forEach((name) => pushRow(out, `Microf. Volantes: ${name}`, iso));
    splitPeople(d.microf_volantes_2).forEach((name) => pushRow(out, `Microf. Volantes: ${name}`, iso));
    if (trim(d.indicador)) pushRow(out, `Indicador: ${trim(d.indicador)}`, iso);
    if (trim(d.som)) pushRow(out, `Som: ${trim(d.som)}`, iso);
    if (trim(d.limpeza_grupo)) pushRow(out, `Limpeza: ${trim(d.limpeza_grupo)}`, iso);

    return out;
  }

  function rowsForMidweek(entry) {
    const d = entry.data || {};
    const iso = entry.event_date;
    const out = [];

    if (trim(d.presidente)) pushRow(out, `Presidente - ${trim(d.presidente)}`, iso);

    if (trim(d.tesouros_titulo) || trim(d.tesouros_designado)) {
      pushRow(out, `1. ${trim(d.tesouros_titulo) || 'Tesouros da Palavra de Deus'} - ${trim(d.tesouros_designado)}`, iso);
    }

    if (trim(d.joias_designado)) {
      pushRow(out, `2. Joias espirituais - ${trim(d.joias_designado)}`, iso);
    }

    if (trim(d.dirigente_sala_b)) pushRow(out, `Dirigente Sala B - ${trim(d.dirigente_sala_b)}`, iso);

    if (trim(d.leitura_biblia) || trim(d.leitura_biblia_sala_b)) {
      const suffix = trim(d.leitura_biblica) ? ` ${trim(d.leitura_biblica)}` : '';
      const base = `Leitura da Bíblia${suffix}`;
      if (trim(d.leitura_biblia)) pushRow(out, `3. ${base} - ${trim(d.leitura_biblia)}`, iso);
      if (trim(d.leitura_biblia_sala_b)) pushRow(out, `3. ${base} - ${trim(d.leitura_biblia_sala_b)} (Sala B)`, iso);
    }

    for (let i = 1; i <= 3; i++) {
      const tipo = trim(d[`ministerio_${i}_tipo`]);
      const designados = trim(d[`ministerio_${i}_designados`]);
      const salaB = trim(d[`ministerio_${i}_sala_b`]);
      if (!tipo && !designados && !salaB) continue;
      const num = 3 + i;
      const label = tipo || `Parte ${num}`;
      if (designados) pushRow(out, `${num}. ${label} - ${designados}`, iso);
      if (salaB) pushRow(out, `${num}. ${label} - ${salaB} (Sala B)`, iso);
      if (!designados && !salaB && tipo) pushRow(out, `${num}. ${label}`, iso);
    }

    if (trim(d.vida_crista_titulo) || trim(d.vida_crista_designado)) {
      pushRow(out, `7. ${trim(d.vida_crista_titulo) || 'Nossa vida cristã'} - ${trim(d.vida_crista_designado)}`, iso);
    }

    if (trim(d.leitor_sentinela)) pushRow(out, `Leitor - ${trim(d.leitor_sentinela)}`, iso);
    if (trim(d.oracao_final)) pushRow(out, `Oração final - ${trim(d.oracao_final)}`, iso);

    return out;
  }

  function rowsForWeekend(entry) {
    const d = entry.data || {};
    const iso = entry.event_date;
    const out = [];

    const especial = trim(d.evento_especial);
    if (especial) {
      pushRow(out, especial, iso);
      return out;
    }

    if (trim(d.presidente)) pushRow(out, `Presidente: ${trim(d.presidente)}`, iso);
    if (trim(d.orador)) pushRow(out, `Orador: ${trim(d.orador)}`, iso);
    if (trim(d.leitor_sentinela) || trim(d.presidente) || trim(d.orador)) {
      const leitor = trim(d.leitor_sentinela) || '';
      pushRow(
        out,
        `Estudo de A Sentinela | Dirigente: ${SENTINEL_DIRECTOR} | Leitor: ${leitor}`,
        iso
      );
    }
    if (trim(d.oracao_final)) pushRow(out, `Oração final: ${trim(d.oracao_final)}`, iso);

    return out;
  }

  function buildCsvForBlock(entries, block) {
    const sorted = entries
      .filter((e) => e.block === block && e.event_date)
      .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''));

    const rowFn = block === 'mecanicas' ? rowsForMecanicas
      : block === 'midweek' ? rowsForMidweek
        : block === 'weekend' ? rowsForWeekend
          : null;

    if (!rowFn) return CSV_HEADER.map(escapeCsv).join(',');

    const dataRows = [];
    sorted.forEach((entry) => {
      dataRows.push(...rowFn(entry));
    });

    return [CSV_HEADER.map(escapeCsv).join(','), ...dataRows].join('\r\n');
  }

  function buildCsvRows(entries, block) {
    if (block) return buildCsvForBlock(entries, block);
    return buildCsvForBlock(entries, 'mecanicas');
  }

  function downloadCsv(content, filename) {
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  window.JEAnnouncementExport = {
    CSV_HEADER,
    BLOCK_EXPORT_META,
    buildCsvRows,
    buildCsvForBlock,
    downloadCsv,
    toUsDate,
    SENTINEL_DIRECTOR
  };
})();
