(function () {
  const WEEKDAY_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const MONTHS_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function toISODate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function formatDisplayDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    return `${pad(d.getDate())} de ${MONTHS_PT[d.getMonth()]}`;
  }

  function monthLabel(year, monthIndex) {
    return `${MONTHS_PT[monthIndex]} / ${year}`;
  }

  function getWeekdaysInMonth(year, monthIndex, weekdayNums) {
    const set = new Set(weekdayNums);
    const out = [];
    const cursor = new Date(year, monthIndex, 1);
    while (cursor.getMonth() === monthIndex) {
      if (set.has(cursor.getDay())) {
        out.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  function datesForBlock(block, year, monthIndex) {
    if (block === 'midweek') return getWeekdaysInMonth(year, monthIndex, [3]);
    if (block === 'weekend') return getWeekdaysInMonth(year, monthIndex, [6]);
    if (block === 'mecanicas') return getWeekdaysInMonth(year, monthIndex, [3, 6]);
    return [];
  }

  function entryFromDate(block, date, sortOrder) {
    return {
      block,
      event_date: toISODate(date),
      weekday_label: WEEKDAY_PT[date.getDay()],
      sort_order: sortOrder,
      data: {},
      export_to_calendar: true
    };
  }

  function generateEntriesForBoard(block, referenceMonth) {
    const d = new Date(referenceMonth + 'T12:00:00');
    const dates = datesForBlock(block, d.getFullYear(), d.getMonth());
    return dates.map((date, i) => entryFromDate(block, date, i + 1));
  }

  function monthKeyFromReference(referenceMonth) {
    return String(referenceMonth || '').slice(0, 7);
  }

  function entryInReferenceMonth(entry, referenceMonth) {
    if (!entry?.event_date) return true;
    return entry.event_date.slice(0, 7) === monthKeyFromReference(referenceMonth);
  }

  function sanitizeEntriesForMonth(rawEntries, referenceMonth) {
    const ym = monthKeyFromReference(referenceMonth);
    return (rawEntries || [])
      .filter((e) => e.block === 'limpeza_mensal' || !e.event_date || e.event_date.slice(0, 7) === ym)
      .map((e) => {
        if (!e.event_date) return e;
        const d = new Date(e.event_date + 'T12:00:00');
        return { ...e, weekday_label: WEEKDAY_PT[d.getDay()] };
      });
  }

  window.JEAnnouncementDates = {
    WEEKDAY_PT,
    MONTHS_PT,
    toISODate,
    formatDisplayDate,
    monthLabel,
    getWeekdaysInMonth,
    datesForBlock,
    generateEntriesForBoard,
    entryFromDate,
    monthKeyFromReference,
    entryInReferenceMonth,
    sanitizeEntriesForMonth
  };
})();
