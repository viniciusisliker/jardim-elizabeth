(function () {
  const { formatDisplayDate } = window.JEAnnouncementDates;
  const { SECTION_TITLES } = window.JEAnnouncementSchemas;

  function escapeCsv(val) {
    const s = String(val ?? '').replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  }

  function rowToCalendarSubject(block, entry) {
    const d = entry.data || {};
    const blockLabel = SECTION_TITLES[block] || block;
    if (block === 'mecanicas') {
      const keys = [['portao', 'Portão'], ['indicador', 'Indicador'], ['som', 'Som']];
      const parts = keys.map(([k, label]) => d[k] && `${label}: ${d[k]}`).filter(Boolean);
      return `[Mecânicas] ${formatDisplayDate(entry.event_date)} — ${parts.join('; ') || 'Designações'}`;
    }
    if (block === 'midweek') {
      return `[VMC] ${formatDisplayDate(entry.event_date)} — ${d.presidente || 'Reunião'}`;
    }
    return `[Final de Semana] ${formatDisplayDate(entry.event_date)} — ${d.tema_discurso || d.orador || 'Reunião'}`;
  }

  function buildCsvRows(entries, defaultTime) {
    const header = ['Subject', 'Start Date', 'Start Time', 'End Date', 'End Time', 'Description', 'Location'];
    const rows = [header];
    entries.forEach((entry) => {
      if (!entry.export_to_calendar || !entry.event_date) return;
      if (entry.block === 'limpeza_mensal') return;
      const d = entry.data || {};
      const hasAssignee = Object.values(d).some((v) => String(v || '').trim());
      if (!hasAssignee && entry.block !== 'weekend') return;

      const iso = entry.event_date;
      const time = d.start_time || defaultTime || '19:30';
      const desc = Object.entries(d)
        .filter(([, v]) => String(v || '').trim())
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ');

      rows.push([
        rowToCalendarSubject(entry.block, entry),
        iso,
        time,
        iso,
        d.end_time || '21:00',
        desc,
        d.location || 'Salão do Reino'
      ].map(escapeCsv));
    });
    return rows.map((r) => r.join(',')).join('\r\n');
  }

  function downloadCsv(content, filename) {
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  window.JEAnnouncementExport = { buildCsvRows, downloadCsv, rowToCalendarSubject };
})();
