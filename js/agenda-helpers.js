(function () {
  const MONTHS_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const WEEKDAY_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const CATEGORIES = ['Especial', 'Reuniões', 'Assembleia', 'Celebração', 'Escola'];

  const DEFAULTS = {
    location: 'Salão do Reino',
    badge_variant: 'default',
    event_time: '19:30 hs'
  };

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function deriveFieldsFromDate(isoDate, options = {}) {
    if (!isoDate) return null;
    const d = new Date(isoDate + 'T12:00:00');
    const day = d.getDate();
    const month = d.getMonth();
    const year = d.getFullYear();

    if (options.futureGroup) {
      return {
        event_date: isoDate,
        date_display: pad(day),
        date_label: `${MONTHS_SHORT[month]}/${String(year).slice(-2)}`,
        month_key: 'futuros',
        month_label: 'Eventos Futuros'
      };
    }

    return {
      event_date: isoDate,
      date_display: pad(day),
      date_label: WEEKDAY_PT[d.getDay()],
      month_key: `${year}-${pad(month + 1)}`,
      month_label: `${MONTHS_PT[month]} / ${year}`
    };
  }

  function badgeLabel(variant) {
    if (variant === 'primary') return 'Azul';
    if (variant === 'gold') return 'Dourado';
    return 'Padrão';
  }

  function categoryBadgeClass(category) {
    if (category === 'Reuniões' || category === 'Escola') return 'text-secondary bg-secondary/10';
    return 'text-[#7a5200] bg-[#c8a96e]/20';
  }

  function templateFromEvent(ev) {
    if (!ev) return null;
    return {
      title: '',
      description: '',
      category: ev.category || 'Especial',
      event_time: ev.event_time || DEFAULTS.event_time,
      location: ev.location || DEFAULTS.location,
      badge_variant: ev.badge_variant || 'default',
      is_highlight: false,
      sort_order: (ev.sort_order || 0) + 1,
      futureGroup: ev.month_key === 'futuros'
    };
  }

  window.JEAgendaHelpers = {
    MONTHS_PT,
    MONTHS_SHORT,
    WEEKDAY_PT,
    CATEGORIES,
    DEFAULTS,
    deriveFieldsFromDate,
    badgeLabel,
    categoryBadgeClass,
    templateFromEvent
  };
})();
