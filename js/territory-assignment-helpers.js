(function () {
  const WEEKDAY_FULL_PT = [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
    'Quinta-feira', 'Sexta-feira', 'Sábado'
  ];
  const WEEKDAY_SHORT_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const CRONOGRAMA_DAYS = ['Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const MONTHS_PT = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const PREFERENCE_LABELS = {
    meio_de_semana: 'Meio de semana',
    final_de_semana: 'Final de semana',
    ambos: 'Ambos'
  };
  const MIDWEEK_DAYS = ['Terça', 'Quarta', 'Quinta', 'Sexta'];
  const WEEKEND_DAYS = ['Sábado', 'Domingo'];
  const SITE_TERRITORIES_URL = 'https://jardimelizabeth.vercel.app/territorios.html';

  function daysFromPreference(preference) {
    if (preference === 'final_de_semana') return [...WEEKEND_DAYS];
    if (preference === 'ambos') return [...CRONOGRAMA_DAYS];
    return [...MIDWEEK_DAYS];
  }

  function preferenceFromDays(days) {
    const set = new Set(days || []);
    const hasMid = MIDWEEK_DAYS.some((d) => set.has(d));
    const hasWeekend = WEEKEND_DAYS.some((d) => set.has(d));
    if (hasMid && hasWeekend) return 'ambos';
    if (hasWeekend) return 'final_de_semana';
    return 'meio_de_semana';
  }

  function overseerDays(overseer) {
    if (overseer?.available_days?.length) return overseer.available_days;
    return daysFromPreference(overseer?.preference);
  }

  function formatOverseerDays(overseer) {
    const days = overseerDays(overseer);
    if (days.length >= CRONOGRAMA_DAYS.length) return 'Todos os dias';
    return days.map((d) => d.slice(0, 3)).join(', ');
  }

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

  function formatShortDate(iso) {
    const d = parseISODate(iso);
    if (!d) return '';
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  }

  function formatWeekday(iso) {
    const d = parseISODate(iso);
    if (!d) return '';
    return WEEKDAY_FULL_PT[d.getDay()];
  }

  function weekdayLabelFromDate(iso) {
    const d = parseISODate(iso);
    if (!d) return '';
    return WEEKDAY_FULL_PT[d.getDay()];
  }

  function weekdayMatchesCronograma(cronogramaDay, isoOrLabel) {
    const label = isoOrLabel?.includes('-') ? weekdayLabelFromDate(isoOrLabel) : isoOrLabel;
    if (!label) return false;
    const norm = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const target = cronogramaDay.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return norm.startsWith(target);
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

  function daysSince(iso) {
    if (!iso) return null;
    const start = parseISODate(iso);
    const today = parseISODate(toISODate(new Date()));
    return Math.floor((today - start) / 86400000);
  }

  function computePriority(territory) {
    if (territory.status === 'designado') return { label: 'Trabalhando', tone: 'working' };
    const days = daysSince(territory.last_worked_at);
    if (days === null) return { label: 'Alta', tone: 'high' };
    if (days >= 28) return { label: 'Alta', tone: 'high' };
    if (days >= 14) return { label: 'Média', tone: 'medium' };
    return { label: 'Normal', tone: 'normal' };
  }

  function territoryLabel(t) {
    if (!t) return '—';
    return `T${t.num} · ${t.display_name || 'Território'}`;
  }

  function sortByPriority(territories) {
    const toneOrder = { high: 0, medium: 1, normal: 2, working: 3 };
    return [...territories].sort((a, b) => {
      const pa = computePriority(a);
      const pb = computePriority(b);
      const diff = (toneOrder[pa.tone] ?? 9) - (toneOrder[pb.tone] ?? 9);
      if (diff !== 0) return diff;
      const da = daysSince(a.last_worked_at) ?? 9999;
      const db = daysSince(b.last_worked_at) ?? 9999;
      return db - da;
    });
  }

  function dateForWeekdayInWeek(weekStartIso, weekdayLabel) {
    if (!weekStartIso || !weekdayLabel) return null;
    const start = parseISODate(weekStartIso);
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = toISODate(d);
      if (weekdayMatchesCronograma(weekdayLabel, iso)) return iso;
    }
    return null;
  }

  function generateWhatsAppSchedule(weekStartIso, scheduleRows, territoriesById) {
    const start = parseISODate(weekStartIso);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    let msg = '🗓 *TERRITÓRIOS - CRONOGRAMA SEMANAL*\n';
    msg += `*_Semana: ${formatShortDate(weekStartIso)} → ${formatShortDate(toISODate(end))}_*\n\n`;

    CRONOGRAMA_DAYS.forEach((day) => {
      const rows = (scheduleRows || []).filter((r) =>
        weekdayMatchesCronograma(day, r.work_date) ||
        weekdayMatchesCronograma(day, r.weekday_label)
      );
      if (!rows.length) return;

      msg += `🔹*${day.toUpperCase()}*\n`;
      rows.forEach((r) => {
        const name = r.profiles?.full_name || r.dirigente_name || '—';
        msg += `*Dirigente:* _${name}_\n`;

        const obs = (r.observation_override || '').trim();
        if (obs) {
          msg += `*Território:* _${obs}_\n\n`;
          return;
        }

        const t = r.territories || territoriesById?.[r.territory_id];
        let text = r.territory_code || '—';
        if (t) {
          text = `T${t.num}`;
          if (t.display_name) text += ` - ${t.display_name}`;
        }
        msg += `*Território:* _${text}_\n\n`;
      });
    });

    msg += `📸 *Imagens dos Territórios*: ${SITE_TERRITORIES_URL}`;
    return msg;
  }

  window.JETerritoryAssignment = {
    WEEKDAY_FULL_PT,
    WEEKDAY_SHORT_PT,
    CRONOGRAMA_DAYS,
    MONTHS_PT,
    PREFERENCE_LABELS,
    MIDWEEK_DAYS,
    WEEKEND_DAYS,
    SITE_TERRITORIES_URL,
    daysFromPreference,
    preferenceFromDays,
    overseerDays,
    formatOverseerDays,
    toISODate,
    parseISODate,
    getMonday,
    snapToMonday,
    formatDisplayDate,
    formatShortDate,
    formatWeekday,
    formatWeekRange,
    formatTime,
    weekdayLabelFromDate,
    weekdayMatchesCronograma,
    dateForWeekdayInWeek,
    daysSince,
    computePriority,
    territoryLabel,
    sortByPriority,
    generateWhatsAppSchedule
  };
})();
