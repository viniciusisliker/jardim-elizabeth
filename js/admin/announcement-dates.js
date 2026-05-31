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

  window.JEAnnouncementDates = {
    WEEKDAY_PT,
    MONTHS_PT,
    toISODate,
    formatDisplayDate,
    monthLabel,
    getWeekdaysInMonth,
    datesForBlock,
    generateEntriesForBoard,
    entryFromDate
  };
})();
