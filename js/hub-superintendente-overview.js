(function () {
  const esc = (t) => String(t ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const QUICK_LINKS = [
    { href: 'index.html', label: 'Site', icon: 'home' },
    { href: 'agenda.html', label: 'Agenda', icon: 'calendar_month' },
    { href: 'agendamentos.html', label: 'Agendamentos', icon: 'event_available' }
  ];

  const FEATURED_ACTIONS = [
    { href: 'territorios.html', label: 'Territórios', icon: 'map', mod: 'territorios' }
  ];

  function announcementCardModifier(slug) {
    if (slug === 'designacoes-mecanicas') return 'org';
    if (slug === 'meio-de-semana') return 'midweek';
    if (slug === 'final-de-semana') return 'weekend';
    return 'default';
  }

  function renderAnnouncementCard(section) {
    const mod = announcementCardModifier(section.slug);
    const href = section.document_url || 'quadrodeanuncios.html';
    return `
      <a href="${esc(href)}" target="_blank" rel="noopener" class="je-qa-card je-qa-card--${mod}">
        <div class="je-qa-card-top">
          <div class="je-qa-card-icon">
            <span class="material-symbols-outlined" aria-hidden="true">${esc(section.icon || 'description')}</span>
          </div>
          <span class="je-qa-card-tag">${esc(section.category_tag || 'Quadro')}</span>
        </div>
        <div>
          <h3 class="je-qa-card-title">${esc(section.title)}</h3>
          ${section.description ? `<p class="je-qa-card-desc">${esc(section.description)}</p>` : ''}
        </div>
        <span class="je-qa-card-cta">
          Abrir PDF
          <span class="material-symbols-outlined" aria-hidden="true">open_in_new</span>
        </span>
      </a>`;
  }

  function renderAnnouncementCards(sections) {
    if (!sections?.length) {
      return `
        <div class="hub-super-qa">
          <p class="hub-super-empty hub-super-empty--compact">Nenhum quadro publicado no momento.</p>
        </div>`;
    }
    return `
      <div class="hub-super-qa">
        <div class="je-qa-grid hub-super-qa-grid">${sections.map(renderAnnouncementCard).join('')}</div>
      </div>`;
  }

  let loadPromise = null;

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  function panel(title, icon, meta, body, extraClass = '') {
    return `
      <section class="hub-super-panel ${extraClass}">
        <header class="hub-super-panel__head">
          <h2 class="hub-super-panel__title">
            <span class="material-symbols-outlined" aria-hidden="true">${esc(icon)}</span>${esc(title)}
          </h2>
          ${meta ? `<span class="hub-super-panel__meta">${esc(meta)}</span>` : ''}
        </header>
        <div class="hub-super-panel__body">${body}</div>
      </section>`;
  }

  function agendaDateBlock(ev) {
    if (ev.event_date) {
      const d = new Date(`${ev.event_date}T12:00:00`);
      if (!Number.isNaN(d.getTime())) {
        return {
          day: d.toLocaleDateString('pt-BR', { day: '2-digit' }),
          month: d.toLocaleDateString('pt-BR', { month: 'short' }).replace(/\.$/, ''),
          label: ev.date_label || d.toLocaleDateString('pt-BR', { weekday: 'short' })
        };
      }
    }
    const display = String(ev.date_display || fmtDate(ev.event_date) || '—');
    const match = display.match(/^(\d{1,2})\s*(.*)$/);
    return {
      day: match?.[1] || display,
      month: match?.[2] || '',
      label: ev.date_label || ''
    };
  }

  function renderAgenda(items) {
    if (!items?.length) return '<p class="hub-super-empty hub-super-empty--agenda">Nenhum evento publicado no momento.</p>';
    return `<div class="hub-super-agenda-list">${items.map((ev) => {
      const date = agendaDateBlock(ev);
      const metaParts = [];
      if (ev.event_time) metaParts.push(`<span class="hub-super-agenda-chip"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>${esc(ev.event_time)}</span>`);
      if (ev.location) metaParts.push(`<span class="hub-super-agenda-chip"><span class="material-symbols-outlined" aria-hidden="true">location_on</span>${esc(ev.location)}</span>`);
      const highlight = ev.is_highlight ? ' hub-super-agenda-card--highlight' : '';
      return `
      <article class="hub-super-agenda-card${highlight}">
        <div class="hub-super-agenda-date" aria-hidden="true">
          <span class="hub-super-agenda-date__day">${esc(date.day)}</span>
          ${date.month ? `<span class="hub-super-agenda-date__month">${esc(date.month)}</span>` : ''}
          ${date.label ? `<span class="hub-super-agenda-date__label">${esc(date.label)}</span>` : ''}
        </div>
        <div class="hub-super-agenda-body">
          <p class="hub-super-agenda-title">${esc(ev.title)}</p>
          <div class="hub-super-agenda-meta">
            ${ev.category ? `<span class="hub-super-agenda-cat">${esc(ev.category)}</span>` : ''}
            ${metaParts.join('')}
          </div>
        </div>
      </article>`;
    }).join('')}</div>`;
  }

  function renderFeaturedActions(stats) {
    const terrLabel = `${stats.territories_designados ?? 0}/${stats.territories_total ?? 0} designados`;
    const meta = { territorios: terrLabel };

    return `
      <div class="hub-super-actions hub-super-actions--solo">
        ${FEATURED_ACTIONS.map((action) => `
          <a class="hub-super-action hub-super-action--${action.mod}" href="${esc(action.href)}" target="_blank" rel="noopener">
            <span class="hub-super-action__icon material-symbols-outlined" aria-hidden="true">${esc(action.icon)}</span>
            <span class="hub-super-action__body">
              <strong class="hub-super-action__label">${esc(action.label)}</strong>
              <span class="hub-super-action__meta">${esc(meta[action.mod])}</span>
            </span>
            <span class="material-symbols-outlined hub-super-action__chev" aria-hidden="true">chevron_right</span>
          </a>`).join('')}
      </div>`;
  }

  function renderQuickLinks() {
    return `<div class="hub-super-links">${QUICK_LINKS.map((link) => `
      <a class="hub-super-link" href="${esc(link.href)}" target="_blank" rel="noopener">
        <span class="material-symbols-outlined" aria-hidden="true">${esc(link.icon)}</span>${esc(link.label)}
      </a>`).join('')}
    </div>`;
  }

  function renderSuperintendentVisit(visit) {
    if (!visit?.id) {
      return '<p class="hub-super-empty hub-super-empty--compact">O Secretário ainda não publicou informações sobre a visita.</p>';
    }
    const docs = visit.documents || [];
    const notes = visit.notes
      ? `<div class="hub-super-visit__notes">${esc(visit.notes).replace(/\n/g, '<br>')}</div>`
      : '';
    const docsHtml = docs.length
      ? docs.map((doc) => `
          <article class="hub-super-doc">
            <span class="material-symbols-outlined hub-super-doc__icon" aria-hidden="true">description</span>
            <div>
              <p class="hub-super-item__main">${esc(doc.label || doc.file_name)}</p>
              <p class="hub-super-item__sub">${esc(doc.file_name)}</p>
            </div>
            <button type="button" class="hub-super-doc__btn" data-super-doc-path="${esc(doc.storage_path)}">Abrir</button>
          </article>`).join('')
      : '<p class="hub-super-empty hub-super-empty--compact">Nenhum documento anexado.</p>';

    return `
      <p class="hub-super-visit__subtitle">${esc(visit.title || 'Visita do Superintendente')}</p>
      <p class="hub-super-visit__date">${visit.visit_date ? `Data prevista: ${fmtDate(visit.visit_date)}` : 'Data a definir pelo Secretário'}</p>
      ${notes}
      <p class="hub-super-visit__docs-label">Documentos</p>
      ${docsHtml}`;
  }

  function renderVisitSection(visit) {
    const meta = visit?.updated_at
      ? `Atualizado ${fmtDate(String(visit.updated_at).slice(0, 10))}`
      : 'Publicado pelo Secretário';
    return `
      <section class="hub-super-visit">
        <header class="hub-super-visit__head">
          <h2 class="hub-super-visit__title">
            <span class="material-symbols-outlined" aria-hidden="true">event_note</span>
            Visita do Superintendente
          </h2>
          <span class="hub-super-visit__meta">${esc(meta)}</span>
        </header>
        <div class="hub-super-visit__body" id="hub-super-visit-body">${renderSuperintendentVisit(visit)}</div>
      </section>`;
  }

  function renderOverview(data) {
    const stats = data.stats || {};
    const visit = data.superintendent_visit;

    return `
      <div class="hub-super-overview__inner">
        ${renderVisitSection(visit)}
        ${renderAnnouncementCards(data.announcement_sections)}
        ${renderFeaturedActions(stats)}
        <div class="hub-super-layout">
          ${panel('Próximos eventos', 'calendar_month', `${(data.agenda || []).length} evento(s)`, renderAgenda(data.agenda), 'hub-super-panel--wide hub-super-panel--agenda')}
          <footer class="hub-super-footer hub-super-panel--wide">
            ${renderQuickLinks()}
            <p class="hub-super-footer-note">Dados de ${fmtDate(String(data.generated_at || '').slice(0, 10))} · recarregue para atualizar${stats.notifications_unread ? ` · ${stats.notifications_unread} notificação(ões)` : ''}</p>
          </footer>
        </div>
      </div>`;
  }

  async function loadAnnouncementSections(client) {
    const { data, error } = await client
      .from('announcement_sections')
      .select('slug, title, description, document_url, icon, category_tag, sort_order')
      .eq('published', true)
      .order('sort_order');
    if (error) throw error;
    return data || [];
  }

  async function loadOverview(client) {
    const [{ data, error }, sections] = await Promise.all([
      client.rpc('je_superintendente_overview'),
      loadAnnouncementSections(client)
    ]);
    if (error) throw error;
    return { ...(data || {}), announcement_sections: sections };
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
      root.querySelector('#hub-super-visit-body')?.addEventListener('click', async (e) => {
        const path = e.target.closest('[data-super-doc-path]')?.dataset.superDocPath;
        if (!path) return;
        try {
          const client = await window.JEAuth.getClient();
          const { data: signed, error } = await client.storage.from('superintendent-visits').createSignedUrl(path, 3600);
          if (error || !signed?.signedUrl) throw error || new Error('URL indisponível');
          window.open(signed.signedUrl, '_blank', 'noopener');
        } catch (err) {
          console.warn('Download visit doc:', err);
        }
      });
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
