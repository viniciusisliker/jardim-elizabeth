(function () {
  const { guardPermission, getClient, showToast, escapeHtml, STATUS_LABELS } = window.JEAdmin;
  const H = window.JETerritoryAssignment;

  const EVENT_LABELS = {
    designacao: 'Designação',
    devolucao: 'Devolução',
    edicao: 'Edição',
    cronograma: 'Cronograma',
    status: 'Status',
    trabalho: 'Trabalho de campo'
  };

  let client;
  let toast;
  let territories = [];
  let profiles = [];
  let overseers = [];
  let activeAssignments = [];
  let weekTemplate = [];
  let history = [];
  let meetingSpots = [];
  let currentWeek = H.toISODate(H.getMonday(new Date()));

  function priorityBadge(t) {
    const p = H.computePriority(t);
    return `<span class="terr-priority terr-priority--${p.tone}">${escapeHtml(p.label)}</span>`;
  }

  function profileName(p) {
    if (!p) return '—';
    return p.full_name || p.profiles?.full_name || '—';
  }

  function overseerOptions(selectedId) {
    const ids = new Set(overseers.filter((o) => o.is_active !== false).map((o) => o.profile_id));
    const list = profiles.filter((p) => ids.has(p.id));
    return list.map((p) =>
      `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${escapeHtml(profileName(p))}</option>`
    ).join('');
  }

  function availableTerritories() {
    return H.sortByPriority(territories.filter((t) => t.status !== 'designado'));
  }

  async function loadTerritories() {
    const { data, error } = await client.from('territories').select('*').order('sort_order');
    if (error) throw error;
    territories = data || [];
  }

  async function loadProfiles() {
    const { data, error } = await client.from('profiles').select('id, full_name, username, role').order('full_name');
    if (error) {
      const { data: overseerProfiles } = await client
        .from('territory_overseers')
        .select('profile_id, profiles(id, full_name, username, role)');
      profiles = (overseerProfiles || []).map((o) => o.profiles).filter(Boolean);
      if (!profiles.length) throw error;
      return;
    }
    profiles = data || [];
  }

  async function loadOverseers() {
    const { data, error } = await client
      .from('territory_overseers')
      .select('profile_id, preference, available_days, is_active, notes, profiles(full_name, username)');
    if (error) throw error;
    overseers = (data || []).sort((a, b) => profileName(a.profiles).localeCompare(profileName(b.profiles)));
  }

  async function loadActiveAssignments() {
    const { data, error } = await client
      .from('territory_active_assignments')
      .select(`
        id, assigned_at, territory_id, profile_id,
        territories ( num, display_name, map_image_url ),
        profiles!profile_id ( full_name, username )
      `)
      .eq('status', 'active')
      .order('assigned_at', { ascending: false });
    if (error) throw error;
    activeAssignments = data || [];
  }

  async function loadWeekTemplate() {
    const { data, error } = await client
      .from('territory_week_schedule')
      .select(`
        id, weekday_label, sort_order, dirigente_name, territory_code,
        location_name, schedule_times, suggestion, suggestion_note, observations,
        profile_id, territory_id,
        profiles ( full_name ),
        territories ( num, display_name )
      `)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    weekTemplate = data || [];
  }

  async function loadHistory() {
    const { data, error } = await client
      .from('territory_history')
      .select(`
        id, event_type, event_date, details, metadata, created_at,
        territories ( num, display_name ),
        profiles!profile_id ( full_name )
      `)
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(250);
    if (error) throw error;
    history = data || [];
  }

  async function loadMeetingSpots() {
    const { data, error } = await client.from('territory_meeting_spots').select('*');
    if (error) throw error;
    meetingSpots = (data || []).sort((a, b) =>
      H.CRONOGRAMA_DAYS.indexOf(a.weekday_label) - H.CRONOGRAMA_DAYS.indexOf(b.weekday_label) ||
      (a.sort_order || 0) - (b.sort_order || 0)
    );
  }

  async function reloadAll() {
    const results = await Promise.allSettled([
      loadTerritories(),
      loadProfiles(),
      loadOverseers(),
      loadActiveAssignments(),
      loadWeekTemplate(),
      loadHistory(),
      loadMeetingSpots()
    ]);
    const labels = ['territories', 'profiles', 'overseers', 'active', 'schedule', 'history', 'spots'];
    const errors = results
      .map((r, i) => (r.status === 'rejected' ? `${labels[i]}: ${r.reason?.message || r.reason}` : null))
      .filter(Boolean);
    if (errors.length && toast) {
      showToast(toast, `Alguns dados não carregaram: ${errors[0]}`, true);
    }
    return errors;
  }

  function setupTabs() {
    document.querySelectorAll('[data-terr-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.terrTab;
        document.querySelectorAll('[data-terr-tab]').forEach((b) => b.classList.toggle('active', b.dataset.terrTab === tab));
        document.querySelectorAll('.terr-panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${tab}`));
        if (tab === 'semana') renderSemana();
      });
    });
  }

  function renderDashboard() {
    const disponiveis = territories.filter((t) => t.status === 'disponivel').length;
    const designados = activeAssignments.length;
    const alta = territories.filter((t) => t.status === 'disponivel' && H.computePriority(t).tone === 'high').length;

    document.getElementById('dash-stats').innerHTML = `
      <div class="terr-stat"><p class="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Disponíveis</p><p class="terr-stat-val">${disponiveis}</p></div>
      <div class="terr-stat"><p class="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Designados</p><p class="terr-stat-val">${designados}</p></div>
      <div class="terr-stat"><p class="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Prioridade alta</p><p class="terr-stat-val">${alta}</p></div>
      <div class="terr-stat"><p class="text-[10px] font-bold uppercase text-on-surface-variant mb-1">Dirigentes</p><p class="terr-stat-val">${overseers.filter((o) => o.is_active !== false).length}</p></div>`;

    const activeEl = document.getElementById('dash-active-list');
    if (!activeAssignments.length) {
      activeEl.innerHTML = '<p class="text-sm text-on-surface-variant">Nenhum território designado no momento.</p>';
    } else {
      activeEl.innerHTML = activeAssignments.slice(0, 8).map((a) => `
        <div class="flex justify-between gap-2 py-2 border-b border-outline-variant/40 last:border-0 text-sm">
          <span class="font-semibold text-primary">${escapeHtml(profileName(a.profiles))}</span>
          <span class="text-on-surface-variant">${escapeHtml(H.territoryLabel(a.territories))}</span>
        </div>`).join('');
    }

    const priEl = document.getElementById('dash-priority-list');
    const top = H.sortByPriority(territories.filter((t) => t.status === 'disponivel')).slice(0, 6);
    priEl.innerHTML = top.length ? top.map((t) => `
      <div class="flex items-center justify-between gap-2 py-2 border-b border-outline-variant/40 last:border-0 text-sm">
        <span class="text-primary font-medium">${escapeHtml(H.territoryLabel(t))}</span>
        ${priorityBadge(t)}
      </div>`).join('') : '<p class="text-sm text-on-surface-variant">Nenhum disponível.</p>';
  }

  function fillDesignarSelects() {
    const profSel = document.getElementById('designar-profile');
    const terrSel = document.getElementById('designar-territory');
    const activeProfileIds = new Set(activeAssignments.map((a) => a.profile_id));

    profSel.innerHTML = `<option value="">Selecione o dirigente</option>${overseers
      .filter((o) => o.is_active !== false)
      .map((o) => {
        const p = profiles.find((pr) => pr.id === o.profile_id) || o.profiles;
        const disabled = activeProfileIds.has(o.profile_id) ? ' disabled' : '';
        return `<option value="${o.profile_id}"${disabled}>${escapeHtml(profileName(p))}${disabled ? ' (já designado)' : ''}</option>`;
      }).join('')}`;

    const avail = availableTerritories();
    terrSel.innerHTML = `<option value="">Selecione (por prioridade)</option>${avail.map((t) => {
      const p = H.computePriority(t);
      const days = H.daysSince(t.last_worked_at);
      const extra = days !== null ? ` · ${days}d sem cobertura` : '';
      return `<option value="${t.id}">T${escapeHtml(t.num)} — ${escapeHtml(t.display_name)} (${escapeHtml(p.label)}${escapeHtml(extra)})</option>`;
    }).join('')}`;

    document.getElementById('designar-date').value = H.toISODate(new Date());

    const overseerProfileSel = document.getElementById('overseer-profile');
    const existing = new Set(overseers.map((o) => o.profile_id));
    overseerProfileSel.innerHTML = `<option value="">Selecione o irmão</option>${profiles
      .filter((p) => !existing.has(p.id))
      .map((p) => `<option value="${p.id}">${escapeHtml(profileName(p))}</option>`).join('')}`;
  }

  function renderDevolver() {
    const el = document.getElementById('devolver-list');
    if (!activeAssignments.length) {
      el.innerHTML = '<p class="text-sm text-on-surface-variant">Nenhuma designação ativa para devolver.</p>';
      return;
    }
    el.innerHTML = activeAssignments.map((a) => `
      <div class="border border-outline-variant rounded-xl p-4 mb-3 last:mb-0">
        <div class="flex flex-wrap justify-between gap-2 mb-3">
          <div>
            <p class="font-bold text-primary">${escapeHtml(H.territoryLabel(a.territories))}</p>
            <p class="text-xs text-on-surface-variant">Dirigente: ${escapeHtml(profileName(a.profiles))} · Designado em ${escapeHtml(H.formatDisplayDate(a.assigned_at))}</p>
          </div>
        </div>
        <form data-return-form="${a.id}" class="grid sm:grid-cols-3 gap-3 items-end">
          <label class="block text-xs font-semibold text-primary sm:col-span-1">Último dia trabalhado
            <input type="date" name="work_date" required value="${H.toISODate(new Date())}" class="mt-1 w-full rounded-lg border-outline-variant text-sm"/>
          </label>
          <label class="block text-xs font-semibold text-primary sm:col-span-1">Observações
            <input type="text" name="notes" class="mt-1 w-full rounded-lg border-outline-variant text-sm" placeholder="Opcional"/>
          </label>
          <button type="submit" class="bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg h-[38px]">Registrar devolução</button>
        </form>
      </div>`).join('');

    el.querySelectorAll('[data-return-form]').forEach((form) => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const { error } = await client.rpc('return_territory_field', {
          p_assignment_id: form.dataset.returnForm,
          p_work_date: fd.get('work_date'),
          p_notes: fd.get('notes') || null
        });
        if (error) showToast(toast, error.message, true);
        else {
          showToast(toast, 'Território devolvido.');
          await refresh();
        }
      });
    });
  }

  function scheduleDirigente(row) {
    return profileName(row.profiles) || row.dirigente_name || '—';
  }

  function scheduleTerritory(row) {
    if (row.territories) return H.territoryLabel(row.territories);
    return row.territory_code || '—';
  }

  function scheduleSuggestion(row) {
    if (!row.suggestion) return '—';
    return row.suggestion_note ? `${row.suggestion} · ${row.suggestion_note}` : row.suggestion;
  }

  function scheduleDayTone(label) {
    const n = (label || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return n.startsWith('sab') || n.startsWith('dom') ? 'weekend' : 'weekday';
  }

  function scheduleDayIcon(label) {
    return scheduleDayTone(label) === 'weekend' ? 'weekend' : 'today';
  }

  function renderSemana() {
    document.getElementById('semana-week').value = currentWeek;
    const el = document.getElementById('semana-list');
    if (!weekTemplate.length) {
      el.innerHTML = `
        <div class="terr-empty">
          <span class="material-symbols-outlined" aria-hidden="true">calendar_month</span>
          <p class="text-sm font-semibold text-primary">Nenhuma linha no cronograma</p>
        </div>`;
    } else {
      el.innerHTML = `
        <div class="terr-sched-scroll">
          <div class="terr-sched-panel">
            <div class="terr-sched-row terr-sched-row--head">
              <span>Dia</span><span>Dirigente</span><span>Território</span><span>Local</span><span>Hora</span><span>Sugestão</span><span></span>
            </div>
            ${weekTemplate.map((r) => {
              const tone = scheduleDayTone(r.weekday_label);
              const dirigente = scheduleDirigente(r);
              const territorio = scheduleTerritory(r);
              const sugg = scheduleSuggestion(r);
              const hasSugg = r.suggestion || r.suggestion_note;
              return `
            <div class="terr-sched-row terr-sched-row--${tone}" title="${escapeHtml(r.observations || '')}">
              <span class="terr-sched-day-pill">
                <span class="material-symbols-outlined" aria-hidden="true">${scheduleDayIcon(r.weekday_label)}</span>
                ${escapeHtml(r.weekday_label)}
              </span>
              <span class="terr-sched-cell terr-sched-cell--dirigente${dirigente === '—' ? ' terr-sched-cell--muted' : ''}">${escapeHtml(dirigente)}</span>
              <span class="terr-sched-cell" title="${escapeHtml(r.observations || '')}">${escapeHtml(territorio)}</span>
              <span class="terr-sched-cell${r.location_name ? '' : ' terr-sched-cell--muted'}">${escapeHtml(r.location_name || '—')}</span>
              <span class="terr-sched-time">${escapeHtml(r.schedule_times || '—')}</span>
              <span class="terr-sched-sugg" title="${escapeHtml(sugg)}">${hasSugg ? escapeHtml(sugg) : '—'}</span>
              <div class="terr-sched-row-actions">
                <button type="button" data-edit-schedule="${r.id}" class="terr-sched-icon-btn" title="Editar">
                  <span class="material-symbols-outlined" aria-hidden="true">edit</span>
                </button>
                <button type="button" data-del-schedule="${r.id}" class="terr-sched-icon-btn terr-sched-icon-btn--del" title="Excluir">
                  <span class="material-symbols-outlined" aria-hidden="true">delete</span>
                </button>
              </div>
            </div>`;
            }).join('')}
          </div>
        </div>`;
      el.querySelectorAll('[data-edit-schedule]').forEach((btn) =>
        btn.addEventListener('click', () =>
          openScheduleFormModal(weekTemplate.find((r) => r.id === btn.dataset.editSchedule))
        )
      );
      el.querySelectorAll('[data-del-schedule]').forEach((btn) =>
        btn.addEventListener('click', () => deleteScheduleRow(btn.dataset.delSchedule))
      );
    }

    const spotsEl = document.getElementById('spots-list');
    if (!meetingSpots.length) {
      spotsEl.innerHTML = '<p class="text-xs text-on-surface-variant text-center py-3">Nenhum local cadastrado.</p>';
    } else {
      spotsEl.innerHTML = `<div class="terr-spots-list">${meetingSpots.map((s) => `
        <div class="terr-spot-row">
          <span class="terr-spot-day">${escapeHtml(s.weekday_label)}</span>
          <div class="min-w-0">
            <span class="font-semibold text-primary">${escapeHtml(s.location_name)}</span>
            <span class="terr-spot-meta">${escapeHtml(s.address || s.schedule_times || '')}</span>
          </div>
          <button type="button" data-del-spot="${s.id}" class="terr-sched-icon-btn terr-sched-icon-btn--del" title="Excluir">
            <span class="material-symbols-outlined" aria-hidden="true">delete</span>
          </button>
        </div>`).join('')}</div>`;
      spotsEl.querySelectorAll('[data-del-spot]').forEach((btn) =>
        btn.addEventListener('click', () => deleteSpot(btn.dataset.delSpot))
      );
    }
  }

  function renderCatalogo() {
    const grid = document.getElementById('catalogo-grid');
    grid.innerHTML = territories.map((t) => {
      const active = activeAssignments.find((a) => a.territory_id === t.id);
      const assignee = active ? profileName(active.profiles) : '—';
      const days = H.daysSince(t.last_worked_at);
      return `
        <div class="bg-white border border-outline-variant rounded-xl p-4">
          <div class="flex items-start justify-between gap-2 mb-2">
            <div>
              <p class="text-[10px] font-bold text-secondary uppercase">T${escapeHtml(t.num)}</p>
              <p class="font-bold text-primary text-sm">${escapeHtml(t.display_name)}</p>
            </div>
            ${priorityBadge(t)}
          </div>
          <p class="text-[11px] text-on-surface-variant mb-1">Status: <strong>${escapeHtml(STATUS_LABELS[t.status] || t.status)}</strong></p>
          <p class="text-[11px] text-on-surface-variant mb-1">Designado: ${escapeHtml(assignee)}</p>
          <p class="text-[11px] text-on-surface-variant mb-3">${days !== null ? `${days} dias sem cobertura` : 'Sem registro de trabalho'}</p>
          <button type="button" data-edit-terr="${t.id}" class="text-xs font-semibold text-secondary">Editar</button>
        </div>`;
    }).join('');

    grid.querySelectorAll('[data-edit-terr]').forEach((btn) =>
      btn.addEventListener('click', () => openTerrForm(territories.find((t) => t.id === btn.dataset.editTerr)))
    );
  }

  function historyWeekday(entry) {
    return entry.metadata?.weekday || H.formatWeekday(String(entry.event_date).slice(0, 10));
  }

  function historyDirigente(entry) {
    return profileName(entry.profiles) || entry.metadata?.dirigente_name || '—';
  }

  function historyTerritory(entry) {
    if (entry.territories) return H.territoryLabel(entry.territories);
    return entry.metadata?.territory_label || '—';
  }

  function historyObservations(entry) {
    const obs = entry.metadata?.observations;
    if (obs) return obs;
    if (entry.metadata?.source === 'spreadsheet') return '—';
    return entry.details || EVENT_LABELS[entry.event_type] || entry.event_type || '—';
  }

  function renderHistorico() {
    const el = document.getElementById('historico-list');
    if (!history.length) {
      el.innerHTML = '<p class="text-sm text-on-surface-variant">Nenhum registro ainda.</p>';
      return;
    }
    el.innerHTML = `
      <div class="terr-table-row terr-table-row--hist text-[10px] font-bold uppercase text-on-surface-variant pb-1 border-b hidden md:grid">
        <span>Data</span><span>Dia</span><span>Dirigente</span><span>Território</span><span>Observações</span>
      </div>
      ${history.map((h) => `
      <div class="terr-table-row terr-table-row--hist text-sm py-3 border-b border-outline-variant/40">
        <span class="text-xs text-on-surface-variant whitespace-nowrap">${escapeHtml(H.formatDisplayDate(String(h.event_date).slice(0, 10)))}</span>
        <span class="text-on-surface-variant">${escapeHtml(historyWeekday(h))}</span>
        <span class="font-semibold text-primary">${escapeHtml(historyDirigente(h))}</span>
        <span class="text-on-surface-variant">${escapeHtml(historyTerritory(h))}</span>
        <span class="text-xs text-on-surface-variant">${escapeHtml(historyObservations(h))}</span>
      </div>`).join('')}`;
  }

  function renderDirigentes() {
    const el = document.getElementById('dirigentes-list');
    if (!overseers.length) {
      el.innerHTML = '<p class="text-sm text-on-surface-variant">Nenhum dirigente cadastrado. Adicione acima.</p>';
      return;
    }
    el.innerHTML = `
      <div class="terr-table-row terr-table-row--5 text-[10px] font-bold uppercase text-on-surface-variant pb-1 border-b hidden sm:grid">
        <span>Dirigente</span><span>Dias</span><span>Status</span><span class="col-span-2"></span>
      </div>
      ${overseers.map((o) => `
      <div class="terr-table-row terr-table-row--5 text-sm py-3 border-b border-outline-variant/40">
        <span class="font-semibold text-primary">${escapeHtml(profileName(o.profiles))}</span>
        <span class="text-on-surface-variant" title="${escapeHtml(H.overseerDays(o).join(', '))}">${escapeHtml(H.formatOverseerDays(o))}</span>
        <span class="text-xs ${o.is_active !== false ? 'text-green-700' : 'text-on-surface-variant'}">${o.is_active !== false ? 'Ativo' : 'Inativo'}</span>
        <div class="flex flex-wrap gap-3 justify-self-start sm:col-span-2">
          <button type="button" data-edit-overseer="${o.profile_id}" class="text-xs font-semibold text-secondary">Editar</button>
          <button type="button" data-del-overseer="${o.profile_id}" class="text-xs font-semibold text-error">Remover</button>
        </div>
      </div>`).join('')}`;
    el.querySelectorAll('[data-edit-overseer]').forEach((btn) =>
      btn.addEventListener('click', () =>
        openOverseerEditModal(overseers.find((o) => o.profile_id === btn.dataset.editOverseer))
      )
    );
    el.querySelectorAll('[data-del-overseer]').forEach((btn) =>
      btn.addEventListener('click', () => removeOverseer(btn.dataset.delOverseer))
    );
  }

  function openTerrForm(t) {
    document.getElementById('terr-form').classList.remove('hidden');
    document.getElementById('terr-id').value = t.id;
    document.getElementById('terr-num').value = t.num;
    document.getElementById('terr-name').value = t.display_name;
    document.getElementById('terr-image').value = t.map_image_url || '';
    document.getElementById('terr-type').value = t.territory_type || 'meio_de_semana';
    document.getElementById('terr-occasion').value = t.best_occasion || '';
    document.getElementById('terr-obs').value = t.observations || '';
    document.getElementById('panel-catalogo').appendChild(document.getElementById('terr-form'));
    document.getElementById('terr-form').scrollIntoView({ behavior: 'smooth' });
  }

  async function refresh() {
    try {
      await reloadAll();
      renderDashboard();
      fillDesignarSelects();
      renderDevolver();
      renderSemana();
      renderCatalogo();
      renderHistorico();
      renderDirigentes();
    } catch (err) {
      console.error('Territory refresh:', err);
      if (toast) showToast(toast, err.message || 'Erro ao carregar territórios.', true);
      document.getElementById('dash-active-list').innerHTML =
        `<p class="text-sm text-error">${escapeHtml(err.message || 'Erro ao carregar.')}</p>`;
      document.getElementById('dash-priority-list').innerHTML =
        `<p class="text-sm text-error">Verifique a conexão ou permissões no Supabase.</p>`;
    }
  }

  async function deleteScheduleRow(id) {
    if (!window.confirm('Excluir esta linha do cronograma?')) return;
    const { error } = await client.from('territory_week_schedule').delete().eq('id', id);
    if (error) showToast(toast, error.message, true);
    else { showToast(toast, 'Linha removida.'); await refresh(); }
  }

  async function deleteSpot(id) {
    if (!window.confirm('Excluir este local?')) return;
    const { error } = await client.from('territory_meeting_spots').delete().eq('id', id);
    if (error) showToast(toast, error.message, true);
    else { showToast(toast, 'Local removido.'); await refresh(); }
  }

  async function removeOverseer(profileId) {
    if (!window.confirm('Remover este dirigente da lista?')) return;
    const { error } = await client.from('territory_overseers').delete().eq('profile_id', profileId);
    if (error) showToast(toast, error.message, true);
    else { showToast(toast, 'Dirigente removido.'); await refresh(); }
  }

  function openOverseerEditModal(overseer) {
    if (!overseer) return;
    const selected = new Set(H.overseerDays(overseer));
    const wrap = document.createElement('div');
    wrap.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40';
    wrap.innerHTML = `
      <form class="bg-white rounded-xl border border-outline-variant p-6 w-full max-w-md space-y-4 shadow-xl">
        <div>
          <h3 class="font-bold text-primary">Dias disponíveis</h3>
          <p class="text-sm text-on-surface-variant mt-1">${escapeHtml(profileName(overseer.profiles))}</p>
        </div>
        <fieldset class="grid grid-cols-2 gap-2 border-0 p-0 m-0">
          <legend class="sr-only">Dias da semana</legend>
          ${H.CRONOGRAMA_DAYS.map((day) => `
            <label class="flex items-center gap-2 text-sm cursor-pointer rounded-lg border border-outline-variant/60 px-3 py-2 hover:bg-surface-container-low">
              <input type="checkbox" name="day" value="${escapeHtml(day)}" ${selected.has(day) ? 'checked' : ''} class="rounded border-outline-variant"/>
              <span>${escapeHtml(day)}</span>
            </label>`).join('')}
        </fieldset>
        <div class="flex gap-2 pt-1">
          <button type="submit" class="bg-secondary text-white text-sm font-semibold px-4 py-2 rounded-lg">Salvar</button>
          <button type="button" data-cancel class="text-sm px-3">Cancelar</button>
        </div>
      </form>`;
    document.body.appendChild(wrap);
    wrap.querySelector('[data-cancel]').addEventListener('click', () => wrap.remove());
    wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
    wrap.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const days = [...e.target.querySelectorAll('input[name="day"]:checked')].map((el) => el.value);
      if (!days.length) {
        showToast(toast, 'Selecione pelo menos um dia.', true);
        return;
      }
      const { error } = await client.from('territory_overseers').update({
        available_days: days,
        preference: H.preferenceFromDays(days)
      }).eq('profile_id', overseer.profile_id);
      wrap.remove();
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, 'Dias atualizados.');
        await refresh();
      }
    });
  }

  function openScheduleFormModal(existing) {
    const row = existing || null;
    const isEdit = Boolean(row);
    const wrap = document.createElement('div');
    wrap.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40';
    wrap.innerHTML = `
      <form class="bg-white rounded-xl border border-outline-variant p-6 w-full max-w-lg space-y-3 shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 class="font-bold text-primary">${isEdit ? 'Editar linha do cronograma' : 'Nova linha do cronograma'}</h3>
        <label class="block text-xs font-semibold text-primary">Dia da semana
          <input name="weekday_label" required value="${escapeHtml(row?.weekday_label || '')}" list="cronograma-dias" class="mt-1 w-full rounded-lg border-outline-variant text-sm" placeholder="Ex.: Terça, Quarta (Tarde)"/>
        </label>
        <datalist id="cronograma-dias">${H.CRONOGRAMA_DAYS.map((d) => `<option value="${escapeHtml(d)}">`).join('')}</datalist>
        <label class="block text-xs font-semibold text-primary">Dirigente (cadastrado)
          <select name="profile_id" class="mt-1 w-full rounded-lg border-outline-variant text-sm">
            <option value="">— Dupla / outro —</option>
            ${overseerOptions(row?.profile_id)}
          </select>
        </label>
        <label class="block text-xs font-semibold text-primary">Nome do dirigente
          <input name="dirigente_name" value="${escapeHtml(row?.dirigente_name || '')}" class="mt-1 w-full rounded-lg border-outline-variant text-sm" placeholder="Ex.: Denison e Arnaldo"/>
        </label>
        <label class="block text-xs font-semibold text-primary">Território
          <select name="territory_id" class="mt-1 w-full rounded-lg border-outline-variant text-sm">
            <option value="">— Selecione —</option>
            ${territories.map((t) => `<option value="${t.id}" ${row?.territory_id === t.id ? 'selected' : ''}>T${escapeHtml(t.num)} — ${escapeHtml(t.display_name)}</option>`).join('')}
          </select>
        </label>
        <label class="block text-xs font-semibold text-primary">Código (planilha)
          <input name="territory_code" value="${escapeHtml(row?.territory_code || '')}" class="mt-1 w-full rounded-lg border-outline-variant text-sm" placeholder="Ex.: T4"/>
        </label>
        <label class="block text-xs font-semibold text-primary">Local
          <input name="location_name" value="${escapeHtml(row?.location_name || '')}" class="mt-1 w-full rounded-lg border-outline-variant text-sm"/>
        </label>
        <label class="block text-xs font-semibold text-primary">Horários
          <input name="schedule_times" value="${escapeHtml(row?.schedule_times || '')}" class="mt-1 w-full rounded-lg border-outline-variant text-sm" placeholder="Ex.: 16:00"/>
        </label>
        <label class="block text-xs font-semibold text-primary">Sugestão
          <input name="suggestion" value="${escapeHtml(row?.suggestion || '')}" class="mt-1 w-full rounded-lg border-outline-variant text-sm" placeholder="Ex.: T5"/>
        </label>
        <label class="block text-xs font-semibold text-primary">Comentário da sugestão
          <input name="suggestion_note" value="${escapeHtml(row?.suggestion_note || '')}" class="mt-1 w-full rounded-lg border-outline-variant text-sm"/>
        </label>
        <label class="block text-xs font-semibold text-primary">Observações
          <input name="observations" value="${escapeHtml(row?.observations || '')}" class="mt-1 w-full rounded-lg border-outline-variant text-sm"/>
        </label>
        <div class="flex gap-2 pt-2">
          <button type="submit" class="bg-secondary text-white text-sm font-semibold px-4 py-2 rounded-lg">Salvar</button>
          <button type="button" data-cancel class="text-sm px-3">Cancelar</button>
        </div>
      </form>`;
    document.body.appendChild(wrap);
    wrap.querySelector('[data-cancel]').addEventListener('click', () => wrap.remove());
    wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
    wrap.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const profileId = fd.get('profile_id') || null;
      let dirigenteName = fd.get('dirigente_name')?.trim() || null;
      if (profileId) {
        const p = profiles.find((pr) => pr.id === profileId) || overseers.find((o) => o.profile_id === profileId)?.profiles;
        dirigenteName = profileName(p) || dirigenteName;
      }
      if (!profileId && !dirigenteName) {
        showToast(toast, 'Informe o dirigente.', true);
        return;
      }
      const territoryId = fd.get('territory_id') || null;
      let territoryCode = fd.get('territory_code')?.trim() || null;
      if (territoryId && !territoryCode) {
        const t = territories.find((tr) => tr.id === territoryId);
        if (t) territoryCode = `T${t.num}`;
      }
      const payload = {
        weekday_label: fd.get('weekday_label')?.trim(),
        profile_id: profileId,
        dirigente_name: dirigenteName,
        territory_id: territoryId,
        territory_code: territoryCode,
        location_name: fd.get('location_name')?.trim() || null,
        schedule_times: fd.get('schedule_times')?.trim() || null,
        suggestion: fd.get('suggestion')?.trim() || null,
        suggestion_note: fd.get('suggestion_note')?.trim() || null,
        observations: fd.get('observations')?.trim() || null
      };
      wrap.remove();
      const req = isEdit
        ? client.from('territory_week_schedule').update(payload).eq('id', row.id)
        : client.from('territory_week_schedule').insert({ ...payload, sort_order: weekTemplate.length + 1 });
      const { error } = await req;
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, isEdit ? 'Linha atualizada.' : 'Linha adicionada.');
        await refresh();
      }
    });
  }

  function openSpotFormModal() {
    const wrap = document.createElement('div');
    wrap.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40';
    wrap.innerHTML = `
      <form class="bg-white rounded-xl border border-outline-variant p-6 w-full max-w-md space-y-3 shadow-xl">
        <h3 class="font-bold text-primary">Novo local de encontro</h3>
        <label class="block text-xs font-semibold text-primary">Dia
          <select name="weekday_label" required class="mt-1 w-full rounded-lg border-outline-variant text-sm">
            ${H.CRONOGRAMA_DAYS.map((d) => `<option value="${d}">${d}</option>`).join('')}
          </select>
        </label>
        <label class="block text-xs font-semibold text-primary">Local
          <input name="location_name" required class="mt-1 w-full rounded-lg border-outline-variant text-sm"/>
        </label>
        <label class="block text-xs font-semibold text-primary">Endereço
          <input name="address" class="mt-1 w-full rounded-lg border-outline-variant text-sm"/>
        </label>
        <label class="block text-xs font-semibold text-primary">Horários
          <input name="schedule_times" class="mt-1 w-full rounded-lg border-outline-variant text-sm"/>
        </label>
        <div class="flex gap-2 pt-2">
          <button type="submit" class="bg-secondary text-white text-sm font-semibold px-4 py-2 rounded-lg">Salvar</button>
          <button type="button" data-cancel class="text-sm px-3">Cancelar</button>
        </div>
      </form>`;
    document.body.appendChild(wrap);
    wrap.querySelector('[data-cancel]').addEventListener('click', () => wrap.remove());
    wrap.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const { error } = await client.from('territory_meeting_spots').insert({
        weekday_label: fd.get('weekday_label'),
        location_name: fd.get('location_name')?.trim(),
        address: fd.get('address')?.trim() || null,
        schedule_times: fd.get('schedule_times')?.trim() || null
      });
      wrap.remove();
      if (error) showToast(toast, error.message, true);
      else { showToast(toast, 'Local adicionado.'); await refresh(); }
    });
  }

  function copyWhatsApp() {
    const byId = Object.fromEntries(territories.map((t) => [t.id, t]));
    const msg = H.generateWhatsAppSchedule(currentWeek, weekTemplate, byId);
    document.getElementById('semana-whatsapp').textContent = msg;
    document.getElementById('semana-whatsapp-wrap').classList.remove('hidden');
    navigator.clipboard?.writeText(msg).then(
      () => showToast(toast, 'Mensagem copiada para a área de transferência.'),
      () => showToast(toast, 'Mensagem gerada abaixo (copie manualmente).')
    );
  }

  async function init() {
    const profile = await guardPermission('territorios');
    if (!profile) return;
    toast = document.getElementById('admin-toast');
    client = await getClient();
    setupTabs();

    document.getElementById('form-designar').addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await client.rpc('assign_territory_field', {
        p_territory_id: document.getElementById('designar-territory').value,
        p_profile_id: document.getElementById('designar-profile').value,
        p_assigned_at: document.getElementById('designar-date').value
      });
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, 'Território designado com sucesso.');
        e.target.reset();
        await refresh();
      }
    });

    document.getElementById('form-overseer').addEventListener('submit', async (e) => {
      e.preventDefault();
      const preference = document.getElementById('overseer-pref').value;
      const { error } = await client.from('territory_overseers').upsert({
        profile_id: document.getElementById('overseer-profile').value,
        preference,
        available_days: H.daysFromPreference(preference),
        is_active: true
      });
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, 'Dirigente adicionado.');
        e.target.reset();
        await refresh();
      }
    });

    document.getElementById('terr-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('terr-id').value;
      const { error } = await client.from('territories').update({
        display_name: document.getElementById('terr-name').value.trim(),
        map_image_url: document.getElementById('terr-image').value.trim(),
        territory_type: document.getElementById('terr-type').value,
        best_occasion: document.getElementById('terr-occasion').value.trim() || null,
        observations: document.getElementById('terr-obs').value.trim() || null
      }).eq('id', id);
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, 'Território atualizado.');
        document.getElementById('terr-form').classList.add('hidden');
        await client.rpc('log_territory_history', {
          p_event_type: 'edicao',
          p_territory_id: id,
          p_profile_id: null,
          p_event_date: H.toISODate(new Date()),
          p_details: 'Catálogo atualizado pelo servo de territórios',
          p_metadata: {}
        }).catch(() => {});
        await refresh();
      }
    });

    document.getElementById('btn-cancel-terr').addEventListener('click', () =>
      document.getElementById('terr-form').classList.add('hidden')
    );

    document.getElementById('semana-week').addEventListener('change', (e) => {
      currentWeek = H.snapToMonday(e.target.value);
    });

    document.getElementById('btn-whatsapp').addEventListener('click', copyWhatsApp);
    document.getElementById('btn-new-schedule').addEventListener('click', openScheduleFormModal);
    document.getElementById('btn-new-spot').addEventListener('click', openSpotFormModal);

    await refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
