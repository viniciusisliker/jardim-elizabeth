(function () {
  const WEEKDAY_FULL_PT = [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
    'Quinta-feira', 'Sexta-feira', 'Sábado'
  ];
  const MONTHS_PT = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function parseISODate(iso) {
    if (!iso) return null;
    return new Date(`${iso}T12:00:00`);
  }

  function toISODate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function getMonday(d) {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  }

  function formatDisplayDate(iso) {
    const d = parseISODate(iso);
    if (!d) return '';
    return `${pad(d.getDate())} de ${MONTHS_PT[d.getMonth()]}`;
  }

  function formatWeekday(iso) {
    const d = parseISODate(iso);
    if (!d) return '';
    return WEEKDAY_FULL_PT[d.getDay()];
  }

  function formatWeekRange(weekStartIso) {
    const start = parseISODate(weekStartIso);
    if (!start) return '';
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${pad(start.getDate())} a ${pad(end.getDate())} de ${MONTHS_PT[start.getMonth()]}`;
    }
    return `${pad(start.getDate())} de ${MONTHS_PT[start.getMonth()]} a ${pad(end.getDate())} de ${MONTHS_PT[end.getMonth()]}`;
  }

  function formatTime(value) {
    if (!value) return '';
    const parts = String(value).slice(0, 5).split(':');
    if (parts.length < 2) return value;
    return `${parts[0]}:${parts[1]}`;
  }

  function snapToMonday(iso) {
    const d = parseISODate(iso);
    if (!d) return iso;
    return toISODate(getMonday(d));
  }

  window.JETerritoryAssignment = {
    WEEKDAY_FULL_PT,
    MONTHS_PT,
    toISODate,
    parseISODate,
    getMonday,
    snapToMonday,
    formatDisplayDate,
    formatWeekday,
    formatWeekRange,
    formatTime
  };
})();
