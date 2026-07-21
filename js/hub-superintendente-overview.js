(function () {
  const esc = (t) => String(t ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const QUICK_LINKS = [
    { href: 'index.html', label: 'Site', icon: 'home' },
    { href: 'agenda.html', label: 'Agenda', icon: 'calendar_month' },
    { href: 'agendamentos.html', label: 'Agendamentos', icon: 'event_available' }
  ];

  const FEATURED_ACTIONS = [
    { href: 'quadrodeanuncios.html', label: 'Quadro de Anúncios', icon: 'campaign', mod: 'anuncios' },
    { href: 'territorios.html', label: 'Territórios', icon: 'map', mod: 'territorios' }
  ];

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

  function renderAgenda(items) {
    if (!items?.length) return '<p class="hub-super-empty">Nenhum evento publicado.</p>';
    return `<div class="hub-super-list">${items.map((ev) => `
      <article class="hub-super-item hub-super-agenda-item">
        <div class="hub-super-agenda-date">
          <em>${esc(ev.date_display || fmtDate(ev.event_date))}</em>
          ${esc(ev.date_label || '')}
        </div>
        <div>
          <p class="hub-super-item__main">${esc(ev.title)}</p>
          <p class="hub-super-item__sub">${esc(ev.category || 'Evento')}${ev.event_time ? ` · ${esc(ev.event_time)}` : ''}${ev.location ? ` · ${esc(ev.location)}` : ''}</p>
        </div>
      </article>`).join('')}</div>`;
  }

  function renderFeaturedActions(stats) {
    const annLabel = stats.announcement_published
      ? (stats.announcement_label || 'Publicado')
      : 'Sem quadro publicado';
    const terrLabel = `${stats.territories_designados ?? 0}/${stats.territories_total ?? 0} designados`;
    const meta = {
      anuncios: annLabel,
      territorios: terrLabel
    };

    return `
      <div class="hub-super-actions">
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
        ${renderFeaturedActions(stats)}
        <div class="hub-super-layout">
          ${panel('Próximos eventos', 'calendar_month', 'Agenda publicada', renderAgenda(data.agenda), 'hub-super-panel--wide')}
          <footer class="hub-super-footer hub-super-panel--wide">
            ${renderQuickLinks()}
            <p class="hub-super-footer-note">Dados de ${fmtDate(String(data.generated_at || '').slice(0, 10))} · recarregue para atualizar${stats.notifications_unread ? ` · ${stats.notifications_unread} notificação(ões)` : ''}</p>
          </footer>
        </div>
      </div>`;
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
