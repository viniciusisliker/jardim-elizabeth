(function () {
  const esc = (t) => String(t ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const QUICK_LINKS = [
    { href: 'index.html', label: 'Site', icon: 'home' },
    { href: 'agenda.html', label: 'Agenda', icon: 'calendar_month' },
    { href: 'quadrodeanuncios.html', label: 'Quadro', icon: 'campaign' },
    { href: 'territorios.html', label: 'Territórios', icon: 'map' },
    { href: 'agendamentos.html', label: 'Agendamentos', icon: 'event_available' }
  ];

  let loadPromise = null;

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  function fmtTime(value) {
    if (!value) return '';
    return String(value).slice(0, 5);
  }

  function speechDirectionLabel(direction) {
    return direction === 'send' ? 'Enviamos' : 'Recebemos';
  }

  function speechDirectionClass(direction) {
    return direction === 'send' ? 'hub-super-badge--send' : 'hub-super-badge--receive';
  }

  function statusBadge(status) {
    if (status === 'pendente') return '<span class="hub-super-badge hub-super-badge--pending">Pendente</span>';
    if (status === 'confirmado') return '<span class="hub-super-badge hub-super-badge--ok">Confirmado</span>';
    return '';
  }

  function renderStats(stats) {
    const annLabel = stats.announcement_published
      ? (stats.announcement_label || 'Publicado')
      : 'Rascunho';
    return `
      <div class="hub-super-stats">
        <article class="hub-super-stat"><strong>${stats.members ?? '—'}</strong><span>Membros</span></article>
        <article class="hub-super-stat"><strong>${stats.territories_designados ?? 0}/${stats.territories_total ?? 0}</strong><span>Territórios designados</span></article>
        <article class="hub-super-stat hub-super-stat--accent"><strong>${stats.territories_alta ?? 0}</strong><span>Alta prioridade</span></article>
        <article class="hub-super-stat"><strong>${stats.speeches_receive_30d ?? 0}</strong><span>Discursos recebidos (30d)</span></article>
        <article class="hub-super-stat"><strong>${stats.speeches_send_30d ?? 0}</strong><span>Discursos enviados (30d)</span></article>
        <article class="hub-super-stat ${stats.speeches_pending ? 'hub-super-stat--alert' : ''}"><strong>${stats.speeches_pending ?? 0}</strong><span>Discursos pendentes</span></article>
        <article class="hub-super-stat"><strong>${stats.equipment_publishers ?? 0}</strong><span>Publicadores carrinho/display</span></article>
        <article class="hub-super-stat"><strong>${stats.equipment_slots_week ?? 0}</strong><span>Horários esta semana</span></article>
        <article class="hub-super-stat ${stats.notifications_unread ? 'hub-super-stat--alert' : ''}"><strong>${stats.notifications_unread ?? 0}</strong><span>Notificações não lidas</span></article>
        <article class="hub-super-stat"><strong>${esc(annLabel)}</strong><span>Quadro de anúncios</span></article>
      </div>`;
  }

  function renderAgenda(items) {
    if (!items?.length) return '<p class="hub-super-empty">Nenhum evento publicado no momento.</p>';
    return `<div class="hub-super-list">${items.map((ev) => `
      <article class="hub-super-row hub-super-agenda-row">
        <div class="hub-super-agenda-date">
          <em>${esc(ev.date_display || fmtDate(ev.event_date))}</em>
          ${esc(ev.date_label || '')}
        </div>
        <div>
          <p class="hub-super-row__main">${esc(ev.title)}</p>
          <p class="hub-super-row__sub">${esc(ev.category || '')}${ev.event_time ? ` · ${esc(ev.event_time)}` : ''}${ev.location ? ` · ${esc(ev.location)}` : ''}</p>
        </div>
      </article>`).join('')}</div>`;
  }

  function renderTerritorySchedule(items) {
    if (!items?.length) return '<p class="hub-super-empty">Cronograma semanal não cadastrado.</p>';
    return `<div class="hub-super-list">${items.map((row) => `
      <article class="hub-super-row hub-super-schedule-row">
        <span class="hub-super-row__main">${esc(row.weekday_label)}</span>
        <span class="hub-super-row__sub">${esc(row.territory_code || '—')}</span>
        <span>
          <span class="hub-super-row__main">${esc(row.dirigente_name || '—')}</span>
          <span class="hub-super-row__sub">${esc(row.schedule_times || '')}${row.location_name ? ` · ${esc(row.location_name)}` : ''}</span>
        </span>
      </article>`).join('')}</div>`;
  }

  function renderAssignments(items) {
    if (!items?.length) return '<p class="hub-super-empty">Nenhum território designado no momento.</p>';
    return `<div class="hub-super-list">${items.map((row) => `
      <article class="hub-super-row">
        <p class="hub-super-row__main">T${esc(row.territory_num)} · ${esc(row.territory_name || 'Território')}</p>
        <p class="hub-super-row__sub">${esc(row.publisher_name || '—')} · desde ${fmtDate(row.assigned_at)}</p>
      </article>`).join('')}</div>`;
  }

  function renderSpeeches(items) {
    if (!items?.length) return '<p class="hub-super-empty">Nenhum discurso nos próximos 30 dias.</p>';
    return `<div class="hub-super-list">${items.map((row) => `
      <article class="hub-super-row">
        <p class="hub-super-row__main">${esc(row.speaker_name || 'Orador')} — ${esc(row.theme_title || 'Tema')}</p>
        <p class="hub-super-row__sub">${fmtDate(row.event_date)}${fmtTime(row.event_time) ? ` · ${fmtTime(row.event_time)}` : ''} · ${esc(row.congregation_name || '—')}</p>
        <div class="hub-super-row__meta">
          <span class="hub-super-badge ${speechDirectionClass(row.direction)}">${speechDirectionLabel(row.direction)}</span>
          ${statusBadge(row.confirmation_status)}
        </div>
      </article>`).join('')}</div>`;
  }

  function renderEquipment(items) {
    if (!items?.length) return '<p class="hub-super-empty">Nenhum horário de carrinho ou display cadastrado.</p>';
    return `<div class="hub-super-list">${items.map((row) => `
      <article class="hub-super-row hub-super-equip-row">
        <span class="hub-super-row__main">${esc(row.weekday_label)}</span>
        <span class="hub-super-row__sub">${esc(row.period_label || '')}</span>
        <span>
          <span class="hub-super-row__main">${esc(row.equipment_name || row.equipment_type || 'Equipamento')}</span>
          <span class="hub-super-row__sub">${esc(row.publisher_names || '—')}${row.location_name ? ` · ${esc(row.location_name)}` : ''}</span>
        </span>
      </article>`).join('')}</div>`;
  }

  function renderQuickLinks() {
    return `<div class="hub-super-links">${QUICK_LINKS.map((link) => `
      <a class="hub-super-link" href="${esc(link.href)}" target="_blank" rel="noopener">
        <span class="material-symbols-outlined" aria-hidden="true">${esc(link.icon)}</span>${esc(link.label)}
      </a>`).join('')}</div>`;
  }

  function renderOverview(data) {
    const stats = data.stats || {};
    return `
      <p class="hub-super-overview__lead">
        <span class="material-symbols-outlined" aria-hidden="true">visibility</span>
        Panorama da congregação em tempo real — territórios, publicações, discursos e campo. Visão somente leitura.
      </p>
      ${renderStats(stats)}
      <div class="hub-super-grid">
        <section class="hub-super-card">
          <header class="hub-super-card__head">
            <h2 class="hub-super-card__title"><span class="material-symbols-outlined" aria-hidden="true">calendar_month</span>Próximos eventos</h2>
            <span class="hub-super-card__meta">Agenda publicada</span>
          </header>
          <div class="hub-super-card__body">${renderAgenda(data.agenda)}</div>
        </section>
        <section class="hub-super-card">
          <header class="hub-super-card__head">
            <h2 class="hub-super-card__title"><span class="material-symbols-outlined" aria-hidden="true">record_voice_over</span>Discursos (30 dias)</h2>
            <span class="hub-super-card__meta">${stats.speeches_pending || 0} pendente(s)</span>
          </header>
          <div class="hub-super-card__body">${renderSpeeches(data.speeches_upcoming)}</div>
        </section>
        <section class="hub-super-card hub-super-card--wide">
          <header class="hub-super-card__head">
            <h2 class="hub-super-card__title"><span class="material-symbols-outlined" aria-hidden="true">map</span>Cronograma de territórios</h2>
            <span class="hub-super-card__meta">Semana tipo</span>
          </header>
          <div class="hub-super-card__body">${renderTerritorySchedule(data.territory_schedule)}</div>
        </section>
        <section class="hub-super-card">
          <header class="hub-super-card__head">
            <h2 class="hub-super-card__title"><span class="material-symbols-outlined" aria-hidden="true">assignment_ind</span>Designações ativas</h2>
            <span class="hub-super-card__meta">${stats.territories_designados || 0} ativa(s)</span>
          </header>
          <div class="hub-super-card__body">${renderAssignments(data.territory_assignments)}</div>
        </section>
        <section class="hub-super-card">
          <header class="hub-super-card__head">
            <h2 class="hub-super-card__title"><span class="material-symbols-outlined" aria-hidden="true">shopping_cart</span>Carrinhos e displays</h2>
            <span class="hub-super-card__meta">Esta semana</span>
          </header>
          <div class="hub-super-card__body">${renderEquipment(data.equipment_this_week)}</div>
        </section>
        <section class="hub-super-card hub-super-card--wide">
          <header class="hub-super-card__head">
            <h2 class="hub-super-card__title"><span class="material-symbols-outlined" aria-hidden="true">open_in_new</span>Site público</h2>
            <span class="hub-super-card__meta">Atalhos</span>
          </header>
          <div class="hub-super-card__body">${renderQuickLinks()}</div>
        </section>
      </div>
      <p class="hub-super-footer-note">Atualizado ${fmtDate(String(data.generated_at || '').slice(0, 10))} — recarregue a página para dados mais recentes.</p>`;
  }

  async function loadOverview(client) {
    const { data, error } = await client.rpc('je_superintendente_overview');
    if (error) throw error;
    return data;
  }

  async function init(profile) {
    if (!profile || profile.role !== 'superintendente') return false;

    const root = document.getElementById('hub-super-overview-root');
    if (!root) return false;

    root.innerHTML = '<p class="hub-super-loading">Carregando visão geral…</p>';

    try {
      const client = await window.JEAuth.getClient();
      if (!loadPromise) loadPromise = loadOverview(client);
      const data = await loadPromise;
      root.innerHTML = renderOverview(data || {});
      return true;
    } catch (err) {
      console.warn('Superintendente overview:', err);
      root.innerHTML = `<p class="hub-super-error">${esc(err?.message || 'Não foi possível carregar a visão geral.')}</p>`;
      return false;
    }
  }

  function refresh() {
    loadPromise = null;
    const profile = window.JEHubRouter?.getProfile?.();
    if (profile?.role === 'superintendente') return init(profile);
    return Promise.resolve(false);
  }

  window.JEHubSuperOverview = { init, refresh };
})();
