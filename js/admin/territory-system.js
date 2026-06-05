(function () {
  const { guardPermission, getClient, showToast, escapeHtml, STATUS_LABELS } = window.JEAdmin;
  const H = window.JETerritoryAssignment;

  const EVENT_LABELS = {
    designacao: 'Designação',
    devolucao: 'Devolução',
    edicao: 'Edição',
    cronograma: 'Cronograma',
    status: 'Status'
  };

  let client;
  let toast;
  let territories = [];
  let profiles = [];
  let overseers = [];
  let activeAssignments = [];
  let weekSchedule = [];
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
      .select('profile_id, preference, is_active, notes, profiles(full_name, username)');
    if (error) throw error;
    overseers = (data || []).sort((a, b) => profileName(a.profiles).localeCompare(profileName(b.profiles)));
  }

  async function loadActiveAssignments() {
    const { data, error } = await client
      .from('territory_active_assignments')
      .select(`
        id, assigned_at, territory_id, profile_id,
        territories ( num, display_name, map_image_url ),
        profiles ( full_name, username )
      `)
      .eq('status', 'active')
      .order('assigned_at', { ascending: false });
    if (error) throw error;
    activeAssignments = data || [];
  }

  async function loadWeekSchedule() {
    const { data, error } = await client
      .from('territory_assignments')
      .select(`
        id, week_start, work_date, work_time, meeting_point, notes,
        location_name, schedule_times, suggestion, observation_override,
        profile_id, territory_id,
        profiles ( full_name ),
        territories ( num, display_name )
      `)
      .eq('week_start', currentWeek)
      .order('work_date', { ascending: true });
    if (error) throw error;
    weekSchedule = data || [];
  }

  async function loadHistory() {
    const { data, error } = await client
      .from('territory_history')
      .select(`
        id, event_type, event_date, details, created_at,
        territories ( num, display_name ),
        profiles ( full_name )
      `)
      .order('created_at', { ascending: false })
      .limit(80);
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
      loadWeekSchedule(),
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

  function renderSemana() {
    document.getElementById('semana-week').value = currentWeek;
    const el = document.getElementById('semana-list');
    if (!weekSchedule.length) {
      el.innerHTML = `<p class="text-sm text-on-surface-variant mb-3">Nenhuma linha para a semana de ${escapeHtml(H.formatWeekRange(currentWeek))}.</p>`;
    } else {
      el.innerHTML = weekSchedule.map((r) => `
        <div class="terr-table-row terr-table-row--6 text-sm py-3 border-b border-outline-variant/50">
          <span class="text-on-surface-variant">${escapeHtml(H.formatWeekday(r.work_date))}</span>
          <span class="font-medium text-primary">${escapeHtml(profileName(r.profiles))}</span>
          <span>${escapeHtml(r.observation_override || H.territoryLabel(r.territories))}</span>
          <span class="text-xs text-on-surface-variant">${escapeHtml(r.location_name || r.meeting_point || '—')}</span>
          <span class="text-xs text-on-surface-variant">${escapeHtml(r.schedule_times || (r.work_time ? H.formatTime(r.work_time) : '—'))}</span>
          <button type="button" data-del-schedule="${r.id}" class="text-xs font-semibold text-error justify-self-start">Excluir</button>
        </div>`).join('');
      el.querySelectorAll('[data-del-schedule]').forEach((btn) =>
        btn.addEventListener('click', () => deleteScheduleRow(btn.dataset.delSchedule))
      );
    }

    const spotsEl = document.getElementById('spots-list');
    if (!meetingSpots.length) {
      spotsEl.innerHTML = '<p class="text-sm text-on-surface-variant">Nenhum local cadastrado.</p>';
    } else {
      spotsEl.innerHTML = meetingSpots.map((s) => `
        <div class="terr-table-row terr-table-row--4 text-sm">
          <span class="font-medium">${escapeHtml(s.weekday_label)}</span>
          <span>${escapeHtml(s.location_name)}</span>
          <span class="text-xs text-on-surface-variant">${escapeHtml(s.schedule_times || s.address || '—')}</span>
          <button type="button" data-del-spot="${s.id}" class="text-xs font-semibold text-error">Excluir</button>
        </div>`).join('');
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

  function renderHistorico() {
    const el = document.getElementById('historico-list');
    if (!history.length) {
      el.innerHTML = '<p class="text-sm text-on-surface-variant">Nenhum registro ainda.</p>';
      return;
    }
    el.innerHTML = history.map((h) => `
      <div class="terr-table-row terr-table-row--4 text-sm py-3 border-b border-outline-variant/40">
        <span class="text-xs text-on-surface-variant">${escapeHtml(H.formatDisplayDate(String(h.event_date).slice(0, 10)))}</span>
        <span class="font-semibold text-primary">${escapeHtml(EVENT_LABELS[h.event_type] || h.event_type)}</span>
        <span class="text-on-surface-variant">${escapeHtml(h.details || '—')}</span>
        <span class="text-xs text-on-surface-variant">${escapeHtml(H.territoryLabel(h.territories))}</span>
      </div>`).join('');
  }

  function renderDirigentes() {
    const el = document.getElementById('dirigentes-list');
    if (!overseers.length) {
      el.innerHTML = '<p class="text-sm text-on-surface-variant">Nenhum dirigente cadastrado. Adicione acima.</p>';
      return;
    }
    el.innerHTML = overseers.map((o) => `
      <div class="terr-table-row terr-table-row--4 text-sm py-3 border-b border-outline-variant/40">
        <span class="font-semibold text-primary">${escapeHtml(profileName(o.profiles))}</span>
        <span>${escapeHtml(H.PREFERENCE_LABELS[o.preference] || o.preference)}</span>
        <span class="text-xs ${o.is_active !== false ? 'text-green-700' : 'text-on-surface-variant'}">${o.is_active !== false ? 'Ativo' : 'Inativo'}</span>
        <button type="button" data-del-overseer="${o.profile_id}" class="text-xs font-semibold text-error justify-self-start">Remover</button>
      </div>`).join('');
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
    const { error } = await client.from('territory_assignments').delete().eq('id', id);
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

  function openScheduleFormModal() {
    const wrap = document.createElement('div');
    wrap.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40';
    wrap.innerHTML = `
      <form class="bg-white rounded-xl border border-outline-variant p-6 w-full max-w-md space-y-3 shadow-xl">
        <h3 class="font-bold text-primary">Nova linha do cronograma</h3>
        <label class="block text-xs font-semibold text-primary">Dirigente
          <select name="profile_id" required class="mt-1 w-full rounded-lg border-outline-variant text-sm">${overseerOptions()}</select>
        </label>
        <label class="block text-xs font-semibold text-primary">Dia de trabalho
          <input name="work_date" type="date" required value="${currentWeek}" class="mt-1 w-full rounded-lg border-outline-variant text-sm"/>
        </label>
        <label class="block text-xs font-semibold text-primary">Território
          <select name="territory_id" class="mt-1 w-full rounded-lg border-outline-variant text-sm">
            <option value="">— Observação only —</option>
            ${territories.map((t) => `<option value="${t.id}">T${escapeHtml(t.num)} — ${escapeHtml(t.display_name)}</option>`).join('')}
          </select>
        </label>
        <label class="block text-xs font-semibold text-primary">Observação (WhatsApp)
          <input name="observation_override" class="mt-1 w-full rounded-lg border-outline-variant text-sm" placeholder="Substitui o território na mensagem"/>
        </label>
        <label class="block text-xs font-semibold text-primary">Local / encontro
          <input name="location_name" class="mt-1 w-full rounded-lg border-outline-variant text-sm"/>
        </label>
        <label class="block text-xs font-semibold text-primary">Horários
          <input name="schedule_times" class="mt-1 w-full rounded-lg border-outline-variant text-sm" placeholder="Ex.: 14h"/>
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
      const workDate = fd.get('work_date');
      const territoryId = fd.get('territory_id') || null;
      const obs = fd.get('observation_override')?.trim() || null;
      if (!territoryId && !obs) {
        showToast(toast, 'Escolha um território ou preencha a observação.', true);
        return;
      }
      const weekStart = H.snapToMonday(workDate);
      const payload = {
        week_start: weekStart,
        work_date: workDate,
        profile_id: fd.get('profile_id'),
        observation_override: obs,
        location_name: fd.get('location_name')?.trim() || null,
        meeting_point: fd.get('location_name')?.trim() || null,
        schedule_times: fd.get('schedule_times')?.trim() || null
      };
      if (territoryId) payload.territory_id = territoryId;
      const { error } = await client.from('territory_assignments').insert(payload);
      wrap.remove();
      if (error) showToast(toast, error.message, true);
      else {
        currentWeek = weekStart;
        showToast(toast, 'Linha adicionada.');
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
    const msg = H.generateWhatsAppSchedule(currentWeek, weekSchedule, byId);
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
      const { error } = await client.from('territory_overseers').upsert({
        profile_id: document.getElementById('overseer-profile').value,
        preference: document.getElementById('overseer-pref').value,
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

    document.getElementById('semana-week').addEventListener('change', async (e) => {
      currentWeek = H.snapToMonday(e.target.value);
      await loadWeekSchedule();
      renderSemana();
    });

    document.getElementById('btn-whatsapp').addEventListener('click', copyWhatsApp);
    document.getElementById('btn-new-schedule').addEventListener('click', openScheduleFormModal);
    document.getElementById('btn-new-spot').addEventListener('click', openSpotFormModal);

    await refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
