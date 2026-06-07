(function () {
  const EQUIPMENT_DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const PERIOD_LABELS = ['Manhã', 'Tarde'];
  const EQUIPMENT_TYPES = {
    carrinho: 'Carrinho',
    display: 'Display'
  };

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

  function getSunday(d) {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    date.setDate(date.getDate() - date.getDay());
    return date;
  }

  function snapToWeekStart(iso) {
    const d = parseISODate(iso);
    if (!d) return iso;
    return toISODate(getSunday(d));
  }

  function formatShortDate(iso) {
    const d = parseISODate(iso);
    if (!d) return '';
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  }

  function weekdayMatches(dayLabel, value) {
    if (!value) return false;
    const norm = String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const target = String(dayLabel).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return norm.startsWith(target);
  }

  function dayIndex(dayLabel) {
    const idx = EQUIPMENT_DAYS.findIndex((d) => weekdayMatches(d, dayLabel));
    return idx < 0 ? 999 : idx;
  }

  function periodIndex(period) {
    const idx = PERIOD_LABELS.indexOf(period);
    return idx < 0 ? 999 : idx;
  }

  function compareSlots(a, b) {
    const dayDiff = dayIndex(a.weekday_label) - dayIndex(b.weekday_label);
    if (dayDiff) return dayDiff;
    const periodDiff = periodIndex(a.period_label) - periodIndex(b.period_label);
    if (periodDiff) return periodDiff;
    const kindDiff = (a.slot_kind === 'fixed' ? 0 : 1) - (b.slot_kind === 'fixed' ? 0 : 1);
    if (kindDiff) return kindDiff;
    return (a.sort_order || 0) - (b.sort_order || 0);
  }

  function periodEmoji(period) {
    return period === 'Tarde' ? '🌤️' : '☀️';
  }

  function equipmentTypeLabel(type) {
    return EQUIPMENT_TYPES[type] || 'Equipamento';
  }

  function slotsForWeek(allSlots, weekStartIso) {
    const week = snapToWeekStart(weekStartIso);
    return (allSlots || [])
      .filter((slot) => slot.is_active !== false)
      .filter((slot) =>
        slot.slot_kind === 'fixed'
          ? !slot.week_start
          : slot.week_start === week
      )
      .sort(compareSlots);
  }

  function generateWhatsAppEquipmentSchedule(weekStartIso, slots) {
    const week = snapToWeekStart(weekStartIso);
    const start = parseISODate(week);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const rows = slotsForWeek(slots, week);

    let msg = '🌎 *CARRINHOS E DISPLAYS*\n';
    msg += `🗓 _*Semana de ${formatShortDate(week)} → ${formatShortDate(toISODate(end))}_*\n\n`;

    EQUIPMENT_DAYS.forEach((day) => {
      const dayRows = rows.filter((row) => weekdayMatches(day, row.weekday_label));
      if (!dayRows.length) return;

      dayRows.forEach((row) => {
        const fixedTag = row.slot_kind === 'fixed' ? ' (FIXO)' : '';
        msg += `${periodEmoji(row.period_label)} *${day.toUpperCase()} - ${row.period_label.toUpperCase()}${fixedTag}*\n`;
        const names = String(row.publisher_names || '').trim();
        if (names) msg += `▫️ *${names}*\n`;
        msg += ` ${equipmentTypeLabel(row.equipment_type)}: *${row.equipment_name || '—'}*\n`;
        msg += ` Local: *${row.location_name || '—'}*\n\n`;
      });
    });

    return msg.trim();
  }

  function formatPublisherDays(days) {
    if (!days?.length) return '—';
    if (days.length >= EQUIPMENT_DAYS.length) return 'Seg–Dom';
    return days.map((d) => d.slice(0, 3)).join(', ');
  }

  window.JEEquipmentSchedule = {
    EQUIPMENT_DAYS,
    PERIOD_LABELS,
    EQUIPMENT_TYPES,
    toISODate,
    parseISODate,
    getMonday,
    getSunday,
    snapToWeekStart,
    formatShortDate,
    weekdayMatches,
    compareSlots,
    slotsForWeek,
    generateWhatsAppEquipmentSchedule,
    formatPublisherDays
  };
})();
