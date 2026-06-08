(function () {
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

  function mondayFromWeekInput(value) {
    const m = /^(\d{4})-W(\d{2})$/i.exec(String(value || '').trim());
    if (!m) return '';
    const year = Number(m[1]);
    const week = Number(m[2]);
    if (!week || week > 53) return '';
    const jan4 = new Date(year, 0, 4, 12, 0, 0);
    const jan4Day = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - jan4Day + 1 + (week - 1) * 7);
    return toISODate(monday);
  }

  function weekInputFromMonday(isoMonday) {
    const date = parseISODate(isoMonday);
    if (!date) return '';
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    const day = d.getDay() || 7;
    const thursday = new Date(d);
    thursday.setDate(d.getDate() - day + 4);
    const isoYear = thursday.getFullYear();
    const jan4 = new Date(isoYear, 0, 4, 12, 0, 0);
    const jan4Day = jan4.getDay() || 7;
    const week1Monday = new Date(jan4);
    week1Monday.setDate(jan4.getDate() - jan4Day + 1);
    const diffDays = Math.round((d - week1Monday) / 86400000);
    const week = Math.floor(diffDays / 7) + 1;
    if (week < 1 || week > 53) return '';
    return `${isoYear}-W${pad(week)}`;
  }

  function sundayFromWeekInput(value) {
    const mon = mondayFromWeekInput(value);
    if (!mon) return '';
    const d = parseISODate(mon);
    d.setDate(d.getDate() - 1);
    return toISODate(d);
  }

  function weekInputFromSunday(isoSunday) {
    const d = parseISODate(isoSunday);
    if (!d) return '';
    const mon = new Date(d);
    mon.setDate(d.getDate() + 1);
    return weekInputFromMonday(toISODate(mon));
  }

  window.JEWeekInput = {
    mondayFromWeekInput,
    weekInputFromMonday,
    sundayFromWeekInput,
    weekInputFromSunday
  };
})();
