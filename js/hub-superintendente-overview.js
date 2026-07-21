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

  function renderTerritorySchedule(items) {
    if (!items?.length) return '<p class="hub-super-empty">Cronograma semanal não cadastrado.</p>';
    return `
      <div class="hub-super-table-wrap">
        <table class="hub-super-table">
          <thead>
            <tr>
              <th scope="col">Dia</th>
              <th scope="col">Terr.</th>
              <th scope="col">Dirigente</th>
              <th scope="col">Horário / local</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((row) => `
              <tr>
                <td>${esc(row.weekday_label)}</td>
                <td>${esc(row.territory_code || '—')}</td>
                <td><strong>${esc(row.dirigente_name || '—')}</strong></td>
                <td>${esc(row.schedule_times || '—')}${row.location_name ? ` · ${esc(row.location_name)}` : ''}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function renderAssignments(items) {
    if (!items?.length) return '<p class="hub-super-empty">Nenhuma designação ativa.</p>';
    return `<div class="hub-super-list">${items.map((row) => `
      <article class="hub-super-item">
        <div>
          <p class="hub-super-item__main">T${esc(row.territory_num)} · ${esc(row.territory_name || 'Território')}</p>
          <p class="hub-super-item__sub">${esc(row.publisher_name || '—')}</p>
        </div>
        <div class="hub-super-item__aside">
          <span class="hub-super-item__sub">${fmtDate(row.assigned_at)}</span>
        </div>
      </article>`).join('')}</div>`;
  }

  function renderSpeeches(items) {
    if (!items?.length) return '<p class="hub-super-empty">Nenhum discurso nos próximos 30 dias.</p>';
    return `<div class="hub-super-list">${items.map((row) => `
      <article class="hub-super-item">
        <div>
          <p class="hub-super-item__main">${esc(row.speaker_name || 'Orador')}</p>
          <p class="hub-super-item__sub">${esc(row.theme_title || 'Tema')} · ${esc(row.congregation_name || '—')}</p>
          <div class="hub-super-badges">
            <span class="hub-super-badge ${speechDirectionClass(row.direction)}">${speechDirectionLabel(row.direction)}</span>
            ${statusBadge(row.confirmation_status)}
          </div>
        </div>
        <div class="hub-super-item__aside">
          <span class="hub-super-item__sub">${fmtDate(row.event_date)}</span>
          ${fmtTime(row.event_time) ? `<span class="hub-super-item__sub">${fmtTime(row.event_time)}</span>` : ''}
        </div>
      </article>`).join('')}</div>`;
  }

  function shortDay(label) {
    const s = String(label || '').trim();
    if (s.length <= 4) return s;
    return s.slice(0, 3);
  }

  function periodBadgeClass(label) {
    return /manh/i.test(String(label || '')) ? 'hub-super-equip-period--manha' : '';
  }

  function groupEquipmentByDay(items) {
    const order = [];
    const map = new Map();
    items.forEach((row) => {
      const day = row.weekday_label || '—';
      if (!map.has(day)) {
        map.set(day, []);
        order.push(day);
      }
      map.get(day).push(row);
    });
    return order.map((day) => ({ day, slots: map.get(day) }));
  }

  function renderEquipment(items) {
    if (!items?.length) return '<p class="hub-super-empty">Nenhum horário cadastrado.</p>';
    const groups = groupEquipmentByDay(items);
    return `<div class="hub-super-equip">${groups.map(({ day, slots }) => `
      <div class="hub-super-equip-day">
        <span class="hub-super-equip-day__label">${esc(shortDay(day))}</span>
        <div class="hub-super-equip-slots">
          ${slots.map((row) => {
            const name = esc(row.equipment_name || row.equipment_type || '—');
            const loc = row.location_name
              ? `<span class="hub-super-equip-loc">${esc(row.location_name)}</span>`
              : '';
            return `
            <article class="hub-super-equip-slot">
              <span class="hub-super-equip-period ${periodBadgeClass(row.period_label)}">${esc(row.period_label || '—')}</span>
              <span class="hub-super-equip-place"><strong>${name}</strong>${loc}</span>
              <span class="hub-super-equip-pubs">${esc(row.publisher_names || '—')}</span>
            </article>`;
          }).join('')}
        </div>
      </div>`).join('')}</div>`;
  }

  function renderQuickLinks(stats) {
    const ann = stats.announcement_published
      ? (stats.announcement_label || 'Publicado')
      : 'Rascunho';
    return `<div class="hub-super-links">${QUICK_LINKS.map((link) => `
      <a class="hub-super-link" href="${esc(link.href)}" target="_blank" rel="noopener">
        <span class="material-symbols-outlined" aria-hidden="true">${esc(link.icon)}</span>${esc(link.label)}
      </a>`).join('')}
      <span class="hub-super-link" style="cursor:default;opacity:.85">
        <span class="material-symbols-outlined" aria-hidden="true">campaign</span>Quadro: ${esc(ann)}
      </span>
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
    const speechMeta = `${stats.speeches_receive_30d ?? 0} rec. · ${stats.speeches_send_30d ?? 0} env.`;
    const equipMeta = `${stats.equipment_slots_week ?? 0} horários · ${stats.equipment_publishers ?? 0} pub.`;

    return `
      <div class="hub-super-overview__inner">
        ${renderVisitSection(visit)}
        <div class="hub-super-layout">
          ${panel('Próximos eventos', 'calendar_month', 'Agenda publicada', renderAgenda(data.agenda))}
          ${panel('Discursos', 'record_voice_over', speechMeta, renderSpeeches(data.speeches_upcoming))}
          ${panel('Designações ativas', 'assignment_ind', `${stats.territories_designados ?? 0} território(s)`, renderAssignments(data.territory_assignments))}
          ${panel('Carrinhos e displays', 'shopping_cart', equipMeta, renderEquipment(data.equipment_this_week), 'hub-super-panel--equip')}
          ${panel('Cronograma de territórios', 'map', 'Semana tipo', renderTerritorySchedule(data.territory_schedule), 'hub-super-panel--wide')}
          <footer class="hub-super-footer">
            ${renderQuickLinks(stats)}
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
