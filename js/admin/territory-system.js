(function () {
  let guardPermission;
  let getClient;
  let showToast;
  let escapeHtml;
  let STATUS_LABELS;

  function H() {
    return window.JETerritoryAssignment;
  }

  function bindAdmin() {
    const admin = window.JEAdmin;
    if (!admin) return false;
    ({ guardPermission, getClient, showToast, escapeHtml, STATUS_LABELS } = admin);
    return true;
  }

  async function ensureAccess(permission) {
    if (window.JEHubRouter) {
      const profile = await window.JEAuth.getCurrentProfile();
      if (!profile || !window.JEAuth.hasPermission(profile, permission)) return null;
      return profile;
    }
    return guardPermission(permission);
  }

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
  let currentWeek = '';
  let histFilter = { q: '', eventType: '' };
  let histSort = { col: 'date', dir: 'desc' };
  let catalogFilter = {
    q: '',
    status: { designado: true, disponivel: true },
    type: { meio_de_semana: true, final_de_semana: true }
  };
  let catalogSort = { col: 'num', dir: 'asc' };
  let weekendByDate = {};

  function priorityBadge(t) {
    const p = H().computePriority(t);
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
    return H().sortByPriority(territories.filter((t) => t.status !== 'designado'));
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
        id, event_type, event_date, details, metadata, created_at, territory_id,
        territories ( num, display_name, map_image_url ),
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
      H().CRONOGRAMA_DAYS.indexOf(a.weekday_label) - H().CRONOGRAMA_DAYS.indexOf(b.weekday_label) ||
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

  function updateNavIndicator(activeBtn) {
    const nav = document.getElementById('terr-nav');
    const indicator = document.getElementById('terr-nav-indicator');
    if (!nav || !indicator || !activeBtn) return;
    const navRect = nav.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    if (!navRect.width || !btnRect.width) {
      indicator.style.opacity = '0';
      return;
    }
    indicator.style.opacity = '1';
    indicator.style.width = `${btnRect.width}px`;
    indicator.style.transform = `translateX(${btnRect.left - navRect.left}px)`;
  }

  function queueNavIndicatorRefresh() {
    const active = document.querySelector('[data-terr-tab].active');
    if (!active) return;
    const run = () => updateNavIndicator(active);
    run();
    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
    setTimeout(run, 120);
  }

  function setupTabs() {
    document.querySelectorAll('[data-terr-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.terrTab;
        document.querySelectorAll('[data-terr-tab]').forEach((b) => b.classList.toggle('active', b.dataset.terrTab === tab));
        document.querySelectorAll('.terr-panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${tab}`));
        updateNavIndicator(btn);
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        if (tab === 'semana') renderSemana();
      });
    });
    queueNavIndicatorRefresh();
    window.addEventListener('resize', queueNavIndicatorRefresh);
  }

  function goToTab(tab) {
    const btn = document.querySelector(`[data-terr-tab="${tab}"]`);
    if (btn) btn.click();
  }

  function bindDashLinks(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-go-tab]').forEach((el) =>
      el.addEventListener('click', () => goToTab(el.dataset.goTab))
    );
    scope.querySelectorAll('[data-action="open-designar"]').forEach((el) => {
      el.addEventListener('click', () => {
        goToTab('semana');
        setTimeout(() => openDesignarModal(), 60);
      });
    });
    scope.querySelectorAll('[data-action="go-semana"]').forEach((el) => {
      el.addEventListener('click', () => goToTab('semana'));
    });
  }

  function territorySummaryMetrics() {
    const total = territories.length;
    const designados = activeAssignments.length;
    const disponiveis = territories.filter((t) => t.status === 'disponivel').length;
    const alta = territories.filter((t) => t.status === 'disponivel' && H().computePriority(t).tone === 'high').length;
    const designadosPct = total ? Math.round((designados / total) * 100) : 0;
    const availDays = territories
      .filter((t) => t.status === 'disponivel')
      .map((t) => H().daysSince(t.last_worked_at))
      .filter((d) => d !== null);
    const avgDays = availDays.length
      ? Math.round(availDays.reduce((a, b) => a + b, 0) / availDays.length)
      : null;
    return { total, designados, disponiveis, alta, designadosPct, avgDays };
  }

  function renderPriorityList() {
    const priEl = document.getElementById('semana-priority-list');
    if (!priEl) return;
    const top = H().sortByPriority(territories.filter((t) => t.status === 'disponivel')).slice(0, 8);
    priEl.innerHTML = top.length ? top.map((t) => {
      const days = H().daysSince(t.last_worked_at);
      return `
        <div class="terr-dash-row">
          <span class="terr-dash-terr" title="${escapeHtml(H().territoryLabel(t))}">
            <span class="terr-dash-terr-num">T${escapeHtml(t.num)}</span>${escapeHtml(t.display_name)}
          </span>
          <span class="flex items-center gap-2 shrink-0">
            ${days !== null ? `<span class="text-[10px] text-on-surface-variant">${days}d</span>` : ''}
            ${priorityBadge(t)}
          </span>
        </div>`;
    }).join('') : '<p class="terr-dash-empty">Nenhum disponível.</p>';
    bindDashLinks(priEl.closest('.terr-dash-card'));
  }

  function updateDesignarPreview() {
    const previewEl = document.getElementById('designar-preview');
    if (!previewEl) return;

    const profileId = document.getElementById('designar-profile')?.value;
    const territoryId = document.getElementById('designar-territory')?.value;
    const dateVal = document.getElementById('designar-date')?.value;

    if (!profileId && !territoryId && !dateVal) {
      previewEl.innerHTML = `
        <div class="terr-assign-preview__empty">
          <span class="material-symbols-outlined" aria-hidden="true">touch_app</span>
          <p>Preencha os campos ao lado para ver o resumo antes de confirmar.</p>
        </div>`;
      return;
    }

    const profile = profiles.find((p) => p.id === profileId);
    const territory = territories.find((t) => t.id === territoryId);
    const priority = territory ? H().computePriority(territory) : null;
    const rows = [];

    rows.push(`
      <div class="terr-assign-preview__row">
        <span class="terr-assign-preview__icon"><span class="material-symbols-outlined" aria-hidden="true">person</span></span>
        <div>
          <p class="terr-assign-preview__label">Dirigente</p>
          <p class="terr-assign-preview__value">${profile ? escapeHtml(profileName(profile)) : 'Selecione…'}</p>
        </div>
      </div>`);

    rows.push(`
      <div class="terr-assign-preview__row">
        <span class="terr-assign-preview__icon"><span class="material-symbols-outlined" aria-hidden="true">map</span></span>
        <div>
          <p class="terr-assign-preview__label">Território</p>
          <p class="terr-assign-preview__value">${territory ? escapeHtml(H().territoryLabel(territory)) : 'Selecione…'}</p>
          ${priority && territory ? `<p class="terr-assign-preview__meta">Prioridade ${escapeHtml(priority.label)}</p>` : ''}
        </div>
      </div>`);

    rows.push(`
      <div class="terr-assign-preview__row">
        <span class="terr-assign-preview__icon"><span class="material-symbols-outlined" aria-hidden="true">event</span></span>
        <div>
          <p class="terr-assign-preview__label">Data</p>
          <p class="terr-assign-preview__value">${dateVal ? escapeHtml(H().formatDisplayDate(dateVal)) : 'Selecione…'}</p>
        </div>
      </div>`);

    const ready = profileId && territoryId && dateVal;
    previewEl.innerHTML = rows.join('') + (ready ? `
      <div class="terr-assign-preview__foot">
        <span class="material-symbols-outlined" aria-hidden="true">notifications_active</span>
        O dirigente verá esta designação no Hub após confirmar.
      </div>` : '');
  }

  function fillOverseerProfileSelect() {
    const overseerProfileSel = document.getElementById('overseer-profile');
    if (!overseerProfileSel) return;
    const existing = new Set(overseers.map((o) => o.profile_id));
    overseerProfileSel.innerHTML = `<option value="">Selecione o irmão</option>${profiles
      .filter((p) => !existing.has(p.id))
      .map((p) => `<option value="${p.id}">${escapeHtml(profileName(p))}</option>`).join('')}`;
  }

  function fillDesignarSelects() {
    const profSel = document.getElementById('designar-profile');
    const terrSel = document.getElementById('designar-territory');
    const dateEl = document.getElementById('designar-date');
    if (!profSel || !terrSel || !dateEl) return;
    const activeProfileIds = new Set(activeAssignments.map((a) => a.profile_id));
    const activeOverseers = overseers.filter((o) => o.is_active !== false);
    const freeOverseers = activeOverseers.filter((o) => !activeProfileIds.has(o.profile_id));
    const avail = availableTerritories();

    profSel.innerHTML = `<option value="">Selecione o dirigente</option>${activeOverseers
      .map((o) => {
        const p = profiles.find((pr) => pr.id === o.profile_id) || o.profiles;
        const disabled = activeProfileIds.has(o.profile_id) ? ' disabled' : '';
        return `<option value="${o.profile_id}"${disabled}>${escapeHtml(profileName(p))}${disabled ? ' (já designado)' : ''}</option>`;
      }).join('')}`;

    terrSel.innerHTML = `<option value="">Selecione (por prioridade)</option>${avail.map((t) => {
      const p = H().computePriority(t);
      const days = H().daysSince(t.last_worked_at);
      const extra = days !== null ? ` · ${days}d sem cobertura` : '';
      return `<option value="${t.id}">T${escapeHtml(t.num)} — ${escapeHtml(t.display_name)} (${escapeHtml(p.label)}${escapeHtml(extra)})</option>`;
    }).join('')}`;

    dateEl.value = H().toISODate(new Date());

    const statAvail = document.getElementById('designar-stat-avail');
    const statFree = document.getElementById('designar-stat-free');
    const statBusy = document.getElementById('designar-stat-busy');
    if (statAvail) statAvail.textContent = String(avail.length);
    if (statFree) statFree.textContent = String(freeOverseers.length);
    if (statBusy) statBusy.textContent = String(activeAssignments.length);

    const busyWrap = document.getElementById('designar-busy-wrap');
    const busyList = document.getElementById('designar-busy-list');
    if (busyWrap && busyList) {
      if (!activeAssignments.length) {
        busyWrap.classList.add('hidden');
        busyList.innerHTML = '';
      } else {
        busyWrap.classList.remove('hidden');
        busyList.innerHTML = activeAssignments.map((a) => `
          <div class="terr-assign-busy__row">
            <span class="terr-assign-busy__person">${escapeHtml(profileName(a.profiles))}</span>
            <span class="terr-assign-busy__terr">${escapeHtml(H().territoryLabel(a.territories))}</span>
          </div>`).join('');
      }
    }

    updateDesignarPreview();
  }

  function designarModalMarkup() {
    return `
      <div class="terr-assign-toolbar !rounded-t-xl !rounded-b-none !mb-0">
        <div class="flex-1 min-w-[10rem]">
          <h2>Nova designação de campo</h2>
          <p>O dirigente recebe a designação no Hub · 1 território ativo por dirigente</p>
        </div>
      </div>
      <div class="terr-assign-stats !rounded-none !border-x !border-outline-variant/30">
        <div class="terr-assign-stat terr-assign-stat--avail">
          <span class="terr-assign-stat__icon"><span class="material-symbols-outlined" aria-hidden="true">map</span></span>
          <div><p class="terr-assign-stat__label">Disponíveis</p><p class="terr-assign-stat__val" id="designar-stat-avail">—</p></div>
        </div>
        <div class="terr-assign-stat terr-assign-stat--free">
          <span class="terr-assign-stat__icon"><span class="material-symbols-outlined" aria-hidden="true">group</span></span>
          <div><p class="terr-assign-stat__label">Dirigentes livres</p><p class="terr-assign-stat__val" id="designar-stat-free">—</p></div>
        </div>
        <div class="terr-assign-stat terr-assign-stat--busy">
          <span class="terr-assign-stat__icon"><span class="material-symbols-outlined" aria-hidden="true">pending_actions</span></span>
          <div><p class="terr-assign-stat__label">Designados</p><p class="terr-assign-stat__val" id="designar-stat-busy">—</p></div>
        </div>
      </div>
      <div class="terr-assign-grid !rounded-none border-x border-outline-variant/30">
        <div class="terr-assign-card !border-0 !rounded-none">
          <div class="terr-assign-card__head">
            <span class="material-symbols-outlined" aria-hidden="true">edit_note</span>
            Dados da designação
          </div>
          <form id="form-designar">
            <div class="terr-assign-form">
              <div class="terr-assign-field">
                <span class="terr-assign-field__label"><span class="material-symbols-outlined" aria-hidden="true">person</span>Dirigente</span>
                <div class="terr-assign-input-wrap">
                  <span class="material-symbols-outlined" aria-hidden="true">person</span>
                  <select id="designar-profile" required class="terr-assign-input"></select>
                </div>
              </div>
              <div class="terr-assign-field">
                <span class="terr-assign-field__label"><span class="material-symbols-outlined" aria-hidden="true">map</span>Território</span>
                <div class="terr-assign-input-wrap">
                  <span class="material-symbols-outlined" aria-hidden="true">map</span>
                  <select id="designar-territory" required class="terr-assign-input"></select>
                </div>
              </div>
              <div class="terr-assign-field terr-assign-field--full">
                <span class="terr-assign-field__label"><span class="material-symbols-outlined" aria-hidden="true">event</span>Data da designação</span>
                <input id="designar-date" type="date" required class="terr-assign-input terr-assign-input--date"/>
              </div>
            </div>
            <div class="terr-assign-foot">
              <p class="terr-assign-note">Territórios listados por prioridade de cobertura. Dirigentes com designação ativa ficam desabilitados.</p>
              <button type="submit" class="terr-assign-submit">
                <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
                Confirmar designação
              </button>
            </div>
          </form>
        </div>
        <div class="terr-assign-preview !border-0 !rounded-none">
          <div class="terr-assign-preview__head">
            <span class="material-symbols-outlined" aria-hidden="true">preview</span>
            Resumo
          </div>
          <div class="terr-assign-preview__body" id="designar-preview">
            <div class="terr-assign-preview__empty">
              <span class="material-symbols-outlined" aria-hidden="true">touch_app</span>
              <p>Preencha os campos para ver o resumo antes de confirmar.</p>
            </div>
          </div>
        </div>
      </div>
      <div id="designar-busy-wrap" class="terr-assign-busy hidden border-x border-b border-outline-variant/30 rounded-b-xl">
        <p class="terr-assign-busy__head">Dirigentes com território ativo</p>
        <div id="designar-busy-list"></div>
      </div>`;
  }

  function openDesignarModal(preset = {}) {
    if (document.getElementById('designar-modal-wrap')) return;
    const wrap = document.createElement('div');
    wrap.id = 'designar-modal-wrap';
    wrap.className = 'fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-primary/40';
    wrap.innerHTML = `
      <div class="bg-background w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-outline-variant shadow-xl" role="dialog" aria-modal="true" aria-labelledby="designar-modal-title">
        <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-outline-variant/60 bg-white sticky top-0 z-10">
          <h3 id="designar-modal-title" class="font-bold text-primary text-sm">Designar território</h3>
          <button type="button" data-close-designar class="terr-sched-icon-btn" aria-label="Fechar">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>
        <div class="p-3 sm:p-4 space-y-3">${designarModalMarkup()}</div>
      </div>`;
    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';

    const close = () => {
      wrap.remove();
      document.body.style.overflow = '';
    };
    wrap.querySelector('[data-close-designar]').addEventListener('click', close);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });

    fillDesignarSelects();
    if (preset.profileId) document.getElementById('designar-profile').value = preset.profileId;
    if (preset.territoryId) document.getElementById('designar-territory').value = preset.territoryId;
    if (preset.date) document.getElementById('designar-date').value = preset.date;
    updateDesignarPreview();

    ['designar-profile', 'designar-territory', 'designar-date'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', updateDesignarPreview);
      document.getElementById(id)?.addEventListener('input', updateDesignarPreview);
    });

    wrap.querySelector('#form-designar').addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await client.rpc('assign_territory_field', {
        p_territory_id: document.getElementById('designar-territory').value,
        p_profile_id: document.getElementById('designar-profile').value,
        p_assigned_at: document.getElementById('designar-date').value
      });
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, 'Território designado com sucesso.');
        close();
        await refresh();
      }
    });
  }

  function openDevolverModal(assignment) {
    if (!assignment) return;
    if (document.getElementById('devolver-modal-wrap')) return;
    const today = H().toISODate(new Date());
    const terrLabel = H().territoryLabel(assignment.territories);
    const person = profileName(assignment.profiles);
    const wrap = document.createElement('div');
    wrap.id = 'devolver-modal-wrap';
    wrap.className = 'fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-primary/40';
    wrap.innerHTML = `
      <form class="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-outline-variant p-5 sm:p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto" role="dialog" aria-modal="true">
        <div>
          <h3 class="font-bold text-primary">Devolver território</h3>
          <p class="text-sm text-on-surface-variant mt-1">${escapeHtml(terrLabel)}</p>
          <p class="text-xs text-on-surface-variant mt-0.5">Dirigente: ${escapeHtml(person)}</p>
        </div>
        <label class="block text-xs font-semibold text-primary">Último dia trabalhado
          <input name="work_date" type="date" required value="${today}" class="mt-1 w-full rounded-lg border-outline-variant text-sm"/>
        </label>
        <label class="block text-xs font-semibold text-primary">Observações
          <input name="notes" type="text" class="mt-1 w-full rounded-lg border-outline-variant text-sm" placeholder="Opcional"/>
        </label>
        <div class="flex gap-2 pt-1">
          <button type="submit" class="inline-flex items-center gap-1 bg-secondary text-white text-sm font-semibold px-4 py-2 rounded-lg">
            <span class="material-symbols-outlined text-base" aria-hidden="true">undo</span>
            Confirmar devolução
          </button>
          <button type="button" data-cancel class="text-sm px-3">Cancelar</button>
        </div>
      </form>`;
    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';
    const close = () => {
      wrap.remove();
      document.body.style.overflow = '';
    };
    wrap.querySelector('[data-cancel]').addEventListener('click', close);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    wrap.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const { error } = await client.rpc('return_territory_field', {
        p_assignment_id: assignment.id,
        p_work_date: fd.get('work_date'),
        p_notes: fd.get('notes') || null
      });
      close();
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, 'Território devolvido.');
        await refresh();
      }
    });
  }

  function resolveScheduleTerritoryId(row) {
    if (row.territory_id) return row.territory_id;
    if (row.territories?.id) return row.territories.id;
    const code = row.territory_code || '';
    const match = code.match(/T?\s*(\d+)/i);
    if (!match) return null;
    const normalized = normalizeTerritoryNum(match[1]);
    const t = territories.find((item) => normalizeTerritoryNum(item.num) === normalized);
    return t?.id || null;
  }

  function findAssignmentForScheduleRow(row) {
    const terrId = resolveScheduleTerritoryId(row);
    if (!terrId) return null;
    return activeAssignments.find((a) => a.territory_id === terrId) || null;
  }

  function scheduleTerritoryIdsForWeek() {
    const ids = new Set();
    scheduleRowsForWeek().forEach((row) => {
      const id = resolveScheduleTerritoryId(row);
      if (id) ids.add(id);
    });
    return ids;
  }

  function unmatchedActiveAssignments() {
    const inSchedule = scheduleTerritoryIdsForWeek();
    return activeAssignments.filter((a) => !inSchedule.has(a.territory_id));
  }

  function renderExtraDesignados() {
    const el = document.getElementById('semana-designados-extra');
    if (!el) return;
    const extra = unmatchedActiveAssignments();
    if (!extra.length) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = `
      <div class="terr-sched-designados">
        <p class="terr-sched-designados__head">Designados fora deste cronograma</p>
        ${extra.map((a) => `
          <div class="terr-sched-designados__row">
            <div class="min-w-0">
              <p class="terr-sched-designados__meta">${escapeHtml(H().territoryLabel(a.territories))}</p>
              <p class="terr-sched-designados__sub">${escapeHtml(profileName(a.profiles))} · designado ${escapeHtml(formatAssignedShort(a.assigned_at))}</p>
            </div>
            <button type="button" class="terr-sched-toolbar-btn terr-sched-toolbar-btn--ghost !text-[#b45309] !border-[#f0e4c8] !bg-[#fef9ee] text-[11px] px-2 py-1" data-return-assignment="${a.id}">
              <span class="material-symbols-outlined text-base" aria-hidden="true">undo</span>Devolver
            </button>
          </div>`).join('')}
      </div>`;
    el.querySelectorAll('[data-return-assignment]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const assignment = activeAssignments.find((a) => a.id === btn.dataset.returnAssignment);
        openDevolverModal(assignment);
      });
    });
  }

  function formatAssignedShort(iso) {
    if (!iso) return '—';
    const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  }

  function scheduleRowsForWeek() {
    return weekTemplate.map((row) => H().applyWeekendDirigente(row, currentWeek, weekendByDate, profiles));
  }

  function scheduleDirigente(row) {
    return profileName(row.profiles) || row.dirigente_name || '—';
  }

  function scheduleDirigenteHtml(row) {
    const name = scheduleDirigente(row);
    if (row.from_announcement) {
      return `${escapeHtml(name)} <span class="terr-sched-qa-badge" title="Definido no Quadro de Anúncios — Final de Semana">Quadro</span>`;
    }
    if (row.announcement_special) {
      return '<span class="terr-sched-cell--muted">Evento especial — sem território</span>';
    }
    if (row.announcement_missing && H().isSaturdayCronogramaDay(row.weekday_label)) {
      return '<span class="terr-sched-cell--muted">Preencher no Quadro de Anúncios</span>';
    }
    return escapeHtml(name);
  }

  function scheduleTerritory(row) {
    if (row.territories) return H().territoryLabel(row.territories);
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
            ${scheduleRowsForWeek().map((r) => {
              const tone = scheduleDayTone(r.weekday_label);
              const dirigenteHtml = scheduleDirigenteHtml(r);
              const territorio = scheduleTerritory(r);
              const assignment = findAssignmentForScheduleRow(r);
              const territorioHtml = assignment
                ? `<span class="terr-sched-cell terr-sched-cell--assigned" title="Designado · ${escapeHtml(profileName(assignment.profiles))}">${escapeHtml(territorio)}<span class="terr-sched-assigned-badge">Designado</span></span>`
                : `<span class="terr-sched-cell" title="${escapeHtml(r.observations || '')}">${escapeHtml(territorio)}</span>`;
              const sugg = scheduleSuggestion(r);
              const hasSugg = r.suggestion || r.suggestion_note;
              const satHint = r.announcement_sat_date && H().isSaturdayCronogramaDay(r.weekday_label)
                ? ` · ${H().formatDisplayDate(r.announcement_sat_date)}`
                : '';
              const returnBtn = assignment
                ? `<button type="button" data-return-assignment="${assignment.id}" class="terr-sched-icon-btn terr-sched-icon-btn--return" title="Devolver ${escapeHtml(H().territoryLabel(assignment.territories))}" aria-label="Devolver território">
                    <span class="material-symbols-outlined" aria-hidden="true">undo</span>
                  </button>`
                : '';
              return `
            <div class="terr-sched-row terr-sched-row--${tone}" title="${escapeHtml(r.observations || '')}${satHint}">
              <span class="terr-sched-day-pill">
                <span class="material-symbols-outlined" aria-hidden="true">${scheduleDayIcon(r.weekday_label)}</span>
                ${escapeHtml(r.weekday_label)}
              </span>
              <span class="terr-sched-cell terr-sched-cell--dirigente">${dirigenteHtml}</span>
              ${territorioHtml}
              <span class="terr-sched-cell${r.location_name ? '' : ' terr-sched-cell--muted'}">${escapeHtml(r.location_name || '—')}</span>
              <span class="terr-sched-time">${escapeHtml(r.schedule_times || '—')}</span>
              <span class="terr-sched-sugg" title="${escapeHtml(sugg)}">${hasSugg ? escapeHtml(sugg) : '—'}</span>
              <div class="terr-sched-row-actions">
                ${returnBtn}
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
      el.querySelectorAll('[data-return-assignment]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const assignment = activeAssignments.find((a) => a.id === btn.dataset.returnAssignment);
          openDevolverModal(assignment);
        });
      });
    }

    renderExtraDesignados();
    renderPriorityList();

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

  function catalogTerritoryCell(t) {
    const label = H().territoryLabel(t);
    const mapUrl = H().resolveTerritoryMapUrl(t.map_image_url, t.num);
    const inner = `
      <span class="terr-hist-terr-num">T${escapeHtml(String(t.num))}</span>
      <span class="terr-hist-terr-name">${escapeHtml(t.display_name || '—')}</span>
      ${mapUrl ? '<span class="material-symbols-outlined terr-hist-terr-map-icon" aria-hidden="true">map</span>' : ''}`;

    if (!mapUrl) {
      return `<span class="terr-hist-terr-btn" title="${escapeHtml(label)}">${inner}</span>`;
    }

    return `
      <button type="button" class="terr-hist-terr-btn terr-hist-terr-btn--map"
        data-terr-map="${escapeHtml(mapUrl)}"
        data-terr-title="${escapeHtml(label)}"
        title="Ver mapa · ${escapeHtml(label)}">${inner}</button>`;
  }

  const TERRITORY_TYPE_LABELS = {
    meio_de_semana: 'Meio de semana',
    final_de_semana: 'Final de semana'
  };

  function catalogTypeMeta(type) {
    if (type === 'final_de_semana') {
      return { label: TERRITORY_TYPE_LABELS.final_de_semana, className: 'terr-catalog-type--weekend' };
    }
    return { label: TERRITORY_TYPE_LABELS.meio_de_semana, className: 'terr-catalog-type--mid' };
  }

  function catalogTypeCell(t) {
    const meta = catalogTypeMeta(t.territory_type);
    return `<span class="terr-catalog-type ${meta.className}">${escapeHtml(meta.label)}</span>`;
  }

  function catalogCoverageMeta(t) {
    const active = activeAssignments.find((a) => a.territory_id === t.id);
    if (t.status === 'designado') {
      const assignedIso = active?.assigned_at ? String(active.assigned_at).slice(0, 10) : null;
      const assignedLabel = assignedIso ? H().formatShortDate(assignedIso) : null;
      return {
        tone: 'working',
        barPct: 100,
        headline: 'Em campo',
        sub: assignedLabel ? `Designado em ${assignedLabel}` : 'Trabalho em andamento',
        title: assignedLabel ? `Designado em ${H().formatDisplayDate(assignedIso)}` : 'Território com designação ativa'
      };
    }

    const days = H().daysSince(t.last_worked_at);
    if (days === null) {
      return {
        tone: 'unknown',
        barPct: 100,
        headline: 'Sem registro',
        sub: 'Nunca devolvido no sistema',
        title: 'Sem data de último trabalho registrada'
      };
    }

    const barPct = Math.min(100, Math.round((days / 28) * 100));
    let tone = 'fresh';
    if (days >= 28) tone = 'critical';
    else if (days >= 14) tone = 'warn';

    let headline;
    if (days === 0) headline = 'Hoje';
    else if (days === 1) headline = '1 dia';
    else headline = `${days} dias`;

    const lastIso = String(t.last_worked_at).slice(0, 10);
    const lastShort = H().formatShortDate(lastIso);
    const lastLong = H().formatDisplayDate(lastIso);
    const sub = days === 0
      ? `Trabalhado hoje · ${lastShort}`
      : `${days} ${days === 1 ? 'dia' : 'dias'} sem cobertura · ${lastShort}`;

    return {
      tone,
      barPct,
      headline,
      sub,
      title: `${days} dias sem cobertura · último trabalho em ${lastLong}`
    };
  }

  function catalogCoverageCell(t) {
    const m = catalogCoverageMeta(t);
    return `
      <span class="terr-catalog-cov terr-catalog-cov--${m.tone}" title="${escapeHtml(m.title)}">
        <span class="terr-catalog-cov__bar" aria-hidden="true"><span class="terr-catalog-cov__fill" style="width:${m.barPct}%"></span></span>
        <span class="terr-catalog-cov__text">
          <strong class="terr-catalog-cov__head">${escapeHtml(m.headline)}</strong>
          <span class="terr-catalog-cov__sub">${escapeHtml(m.sub)}</span>
        </span>
      </span>`;
  }

  function catalogAssignee(t) {
    const active = activeAssignments.find((a) => a.territory_id === t.id);
    return active ? profileName(active.profiles) : '—';
  }

  function catalogCoverageDays(t) {
    if (t.status === 'designado') return -1;
    const days = H().daysSince(t.last_worked_at);
    return days === null ? 99999 : days;
  }

  const CATALOG_STATUS_OPTIONS = [
    { value: 'designado', label: 'Designado' },
    { value: 'disponivel', label: 'Disponível' }
  ];
  const CATALOG_TYPE_OPTIONS = [
    { value: 'meio_de_semana', label: 'Meio de semana' },
    { value: 'final_de_semana', label: 'Final de semana' }
  ];

  function catalogFilterMapAllTrue(map) {
    return Object.fromEntries(Object.keys(map).map((k) => [k, true]));
  }

  function catalogFilterAllSelected(map) {
    return Object.values(map).every(Boolean);
  }

  function catalogFilterSelectedKeys(map) {
    return Object.entries(map).filter(([, on]) => on).map(([k]) => k);
  }

  function isCatalogColumnFilterActive(filterKey) {
    if (filterKey === 'status') return !catalogFilterAllSelected(catalogFilter.status);
    if (filterKey === 'type') return !catalogFilterAllSelected(catalogFilter.type);
    return false;
  }

  function syncCatalogFilterSelectAll(filterKey) {
    const grid = document.getElementById('catalogo-grid');
    if (!grid) return;
    const map = filterKey === 'status' ? catalogFilter.status : catalogFilter.type;
    const selectAll = grid.querySelector(`[data-xlf-select-all="${filterKey}"]`);
    const boxes = grid.querySelectorAll(`[data-xlf-filter="${filterKey}"]`);
    if (!selectAll || !boxes.length) return;
    const checked = [...boxes].filter((b) => b.checked).length;
    selectAll.checked = checked === boxes.length;
    selectAll.indeterminate = checked > 0 && checked < boxes.length;
  }

  function updateCatalogFilterUI() {
    const grid = document.getElementById('catalogo-grid');
    if (!grid) return;
    ['status', 'type'].forEach((filterKey) => {
      const active = isCatalogColumnFilterActive(filterKey);
      grid.querySelectorAll(`[data-xlf-trigger="${filterKey}"]`).forEach((btn) => {
        btn.classList.toggle('terr-xlf-filter-btn--active', active);
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = active ? 'filter_alt' : 'filter_list';
      });
      grid.querySelectorAll(`[data-xlf-filter="${filterKey}"]`).forEach((box) => {
        box.checked = !!catalogFilter[filterKey][box.value];
      });
      syncCatalogFilterSelectAll(filterKey);
    });
  }

  function closeCatalogFilterMenus(exceptKey = null) {
    document.querySelectorAll('[data-xlf-menu]').forEach((menu) => {
      if (exceptKey && menu.dataset.xlfMenu === exceptKey) return;
      menu.classList.add('hidden');
      const trigger = document.querySelector(`[data-xlf-trigger="${menu.dataset.xlfMenu}"]`);
      trigger?.setAttribute('aria-expanded', 'false');
    });
  }

  function catalogFilterHeader(col, label, filterKey, options) {
    const active = isCatalogColumnFilterActive(filterKey);
    const checks = options.map((o) => `
      <label class="terr-xlf-check">
        <input type="checkbox" data-xlf-filter="${filterKey}" value="${o.value}" ${catalogFilter[filterKey][o.value] ? 'checked' : ''}>
        <span>${escapeHtml(o.label)}</span>
      </label>`).join('');
    return `<th scope="col">
      <div class="terr-xlf-head">
        <button type="button" class="terr-catalog-sort" data-catalog-sort="${col}">
          <span>${label}</span>
          <span class="material-symbols-outlined terr-catalog-sort-icon" aria-hidden="true">unfold_more</span>
        </button>
        <div class="terr-xlf-filter">
          <button type="button" class="terr-xlf-filter-btn${active ? ' terr-xlf-filter-btn--active' : ''}" data-xlf-trigger="${filterKey}" aria-expanded="false" aria-haspopup="true" aria-label="Filtrar ${label}" title="Filtrar">
            <span class="material-symbols-outlined" aria-hidden="true">${active ? 'filter_alt' : 'filter_list'}</span>
          </button>
          <div class="terr-xlf-menu hidden" data-xlf-menu="${filterKey}" role="dialog" aria-label="Filtrar ${label}">
            <p class="terr-xlf-menu-title">${escapeHtml(label)}</p>
            <label class="terr-xlf-check terr-xlf-check--all">
              <input type="checkbox" data-xlf-select-all="${filterKey}" ${catalogFilterAllSelected(catalogFilter[filterKey]) ? 'checked' : ''}>
              <span>(Selecionar tudo)</span>
            </label>
            <div class="terr-xlf-checks">${checks}</div>
            <div class="terr-xlf-menu-actions">
              <button type="button" class="terr-xlf-clear" data-xlf-clear="${filterKey}">Limpar filtro</button>
            </div>
          </div>
        </div>
      </div>
    </th>`;
  }

  function catalogSortButton(col, label) {
    return `<th scope="col"><button type="button" class="terr-catalog-sort" data-catalog-sort="${col}"><span>${label}</span><span class="material-symbols-outlined terr-catalog-sort-icon" aria-hidden="true">unfold_more</span></button></th>`;
  }

  function updateCatalogSortUI() {
    const grid = document.getElementById('catalogo-grid');
    if (!grid) return;
    grid.querySelectorAll('[data-catalog-sort]').forEach((btn) => {
      const active = catalogSort.col === btn.dataset.catalogSort;
      btn.classList.toggle('terr-catalog-sort--active', active);
      const icon = btn.querySelector('.terr-catalog-sort-icon');
      if (icon) icon.textContent = active ? (catalogSort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more';
    });
  }

  function getSortedCatalog(list) {
    const { col, dir } = catalogSort;
    const mul = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (col) {
        case 'num': {
          const na = Number(a.num) || 9999;
          const nb = Number(b.num) || 9999;
          cmp = na - nb || String(a.num).localeCompare(String(b.num), 'pt-BR', { numeric: true });
          break;
        }
        case 'name':
          cmp = String(a.display_name).localeCompare(String(b.display_name), 'pt-BR', { sensitivity: 'base' });
          break;
        case 'type':
          cmp = catalogTypeMeta(a.territory_type).label.localeCompare(catalogTypeMeta(b.territory_type).label, 'pt-BR', { sensitivity: 'base' });
          break;
        case 'status':
          cmp = String(a.status).localeCompare(String(b.status), 'pt-BR', { sensitivity: 'base' });
          break;
        case 'assignee':
          cmp = catalogAssignee(a).localeCompare(catalogAssignee(b), 'pt-BR', { sensitivity: 'base' });
          break;
        case 'coverage':
          cmp = catalogCoverageDays(a) - catalogCoverageDays(b);
          break;
        default:
          cmp = 0;
      }
      if (cmp === 0 && col !== 'num') {
        const na = Number(a.num) || 9999;
        const nb = Number(b.num) || 9999;
        cmp = na - nb;
      }
      return cmp * mul;
    });
  }

  function getFilteredCatalog() {
    let list = territories;
    const q = catalogFilter.q.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const assignee = catalogAssignee(t);
        const p = H().computePriority(t);
        const days = H().daysSince(t.last_worked_at);
        const cov = catalogCoverageMeta(t);
        return [
          t.num,
          t.display_name,
          t.status,
          t.territory_type,
          TERRITORY_TYPE_LABELS[t.territory_type],
          STATUS_LABELS[t.status],
          assignee === '—' ? '' : assignee,
          p.label,
          days,
          t.last_worked_at,
          cov.headline,
          cov.sub
        ].join(' ').toLowerCase().includes(q);
      });
    }
    const statusKeys = catalogFilterSelectedKeys(catalogFilter.status);
    const statusTotal = Object.keys(catalogFilter.status).length;
    if (statusKeys.length < statusTotal) {
      list = statusKeys.length ? list.filter((t) => statusKeys.includes(t.status)) : [];
    }
    const typeKeys = catalogFilterSelectedKeys(catalogFilter.type);
    const typeTotal = Object.keys(catalogFilter.type).length;
    if (typeKeys.length < typeTotal) {
      list = typeKeys.length ? list.filter((t) => typeKeys.includes(t.territory_type)) : [];
    }
    return getSortedCatalog(list);
  }

  function bindCatalogFilters() {
    const grid = document.getElementById('catalogo-grid');
    if (!grid) return;
    const search = grid.querySelector('#catalog-search');
    if (search && search.value !== catalogFilter.q) search.value = catalogFilter.q;
    search?.addEventListener('input', (e) => {
      catalogFilter.q = e.target.value;
      renderCatalogoTable();
    });

    grid.querySelectorAll('[data-xlf-trigger]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.xlfTrigger;
        const menu = grid.querySelector(`[data-xlf-menu="${key}"]`);
        if (!menu) return;
        const willOpen = menu.classList.contains('hidden');
        closeCatalogFilterMenus();
        if (willOpen) {
          menu.classList.remove('hidden');
          btn.setAttribute('aria-expanded', 'true');
          updateCatalogFilterUI();
        }
      });
    });

    grid.querySelectorAll('[data-xlf-select-all]').forEach((box) => {
      box.addEventListener('change', () => {
        const key = box.dataset.xlfSelectAll;
        const map = catalogFilter[key];
        Object.keys(map).forEach((k) => { map[k] = box.checked; });
        updateCatalogFilterUI();
        renderCatalogoTable();
      });
    });

    grid.querySelectorAll('[data-xlf-filter]').forEach((box) => {
      box.addEventListener('change', () => {
        const key = box.dataset.xlfFilter;
        catalogFilter[key][box.value] = box.checked;
        syncCatalogFilterSelectAll(key);
        updateCatalogFilterUI();
        renderCatalogoTable();
      });
    });

    grid.querySelectorAll('[data-xlf-clear]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.xlfClear;
        catalogFilter[key] = catalogFilterMapAllTrue(catalogFilter[key]);
        updateCatalogFilterUI();
        renderCatalogoTable();
        closeCatalogFilterMenus();
      });
    });

    grid.querySelectorAll('.terr-xlf-menu').forEach((menu) => {
      menu.addEventListener('click', (e) => e.stopPropagation());
    });

    if (!window.__JETerrCatalogXlfBound) {
      window.__JETerrCatalogXlfBound = true;
      document.addEventListener('click', () => closeCatalogFilterMenus());
    }

    grid.querySelectorAll('[data-catalog-sort]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const col = btn.dataset.catalogSort;
        if (catalogSort.col === col) catalogSort.dir = catalogSort.dir === 'asc' ? 'desc' : 'asc';
        else {
          catalogSort.col = col;
          catalogSort.dir = col === 'coverage' ? 'desc' : 'asc';
        }
        updateCatalogSortUI();
        renderCatalogoTable();
      });
    });
  }

  function updateCatalogStats() {
    const { total, designados, disponiveis, alta, designadosPct, avgDays } = territorySummaryMetrics();
    const countAll = document.getElementById('catalog-count-all');
    const countWork = document.getElementById('catalog-count-work');
    const countAvail = document.getElementById('catalog-count-avail');
    const countHigh = document.getElementById('catalog-count-high');
    const countPct = document.getElementById('catalog-count-pct');
    const countAvg = document.getElementById('catalog-count-avg');
    const pctBar = document.getElementById('catalog-pct-bar');

    if (countAll) countAll.textContent = String(total);
    if (countWork) countWork.textContent = String(designados);
    if (countAvail) countAvail.textContent = String(disponiveis);
    if (countHigh) countHigh.textContent = String(alta);
    if (countPct) countPct.textContent = `${designadosPct}%`;
    if (countAvg) countAvg.textContent = avgDays !== null ? `${avgDays}d` : '—';
    if (pctBar) pctBar.style.width = `${designadosPct}%`;
  }

  function renderCatalogoTable() {
    const listEl = document.getElementById('catalogo-table-body');
    const footEl = document.getElementById('catalogo-foot');
    if (!listEl) return;

    updateCatalogSortUI();
    updateCatalogFilterUI();
    const filtered = getFilteredCatalog();
    updateCatalogStats();

    if (!filtered.length) {
      listEl.innerHTML = `
        <tr><td colspan="7">
          <div class="terr-empty !border-0 !rounded-none">
            <span class="material-symbols-outlined" aria-hidden="true">search_off</span>
            <p class="text-sm">${territories.length ? 'Nenhum território corresponde ao filtro.' : 'Nenhum território cadastrado.'}</p>
          </div>
        </td></tr>`;
      if (footEl) footEl.textContent = '';
      return;
    }

    listEl.innerHTML = filtered.map((t) => {
      const assignee = catalogAssignee(t);
      const statusClass = t.status === 'designado' ? 'designado' : 'disponivel';
      return `
      <tr>
        <td><span class="terr-catalog-num">${escapeHtml(t.num)}</span></td>
        <td class="terr-catalog-name">${catalogTerritoryCell(t)}</td>
        <td>${catalogTypeCell(t)}</td>
        <td><span class="terr-catalog-status terr-catalog-status--${statusClass}">${escapeHtml(STATUS_LABELS[t.status] || t.status)}</span></td>
        <td class="terr-catalog-cell terr-catalog-assign${assignee === '—' ? ' terr-catalog-cell--muted' : ''}" title="${escapeHtml(assignee)}">${escapeHtml(assignee)}</td>
        <td>${catalogCoverageCell(t)}</td>
        <td class="terr-catalog-actions">
          <button type="button" data-edit-terr="${t.id}" class="terr-sched-icon-btn" title="Editar">
            <span class="material-symbols-outlined" aria-hidden="true">edit</span>
          </button>
        </td>
      </tr>`;
    }).join('');

    listEl.querySelectorAll('[data-edit-terr]').forEach((btn) =>
      btn.addEventListener('click', () => openTerrFormModal(territories.find((x) => x.id === btn.dataset.editTerr)))
    );

    if (footEl) {
      const parts = [];
      if (catalogFilter.q.trim()) parts.push('busca');
      if (!catalogFilterAllSelected(catalogFilter.status)) {
        parts.push(catalogFilterSelectedKeys(catalogFilter.status).map((s) => STATUS_LABELS[s] || s).join(', ').toLowerCase());
      }
      if (!catalogFilterAllSelected(catalogFilter.type)) {
        parts.push(catalogFilterSelectedKeys(catalogFilter.type).map((t) => TERRITORY_TYPE_LABELS[t] || t).join(', ').toLowerCase());
      }
      const filterNote = parts.length ? ` · filtro: ${parts.join(', ')}` : '';
      const suffix = filtered.length < territories.length ? ` (${territories.length} no total)` : '';
      footEl.textContent = `Exibindo ${filtered.length} território${filtered.length === 1 ? '' : 's'}${suffix}${filterNote}`;
    }
  }

  function renderCatalogo() {
    const grid = document.getElementById('catalogo-grid');
    if (!grid) return;
    const { designadosPct, avgDays, alta } = territorySummaryMetrics();

    grid.innerHTML = `
      <div class="terr-catalog-toolbar">
        <div>
          <h2>Painel</h2>
          <p>Mapas, status e cobertura · ${territories.length} territórios${avgDays !== null ? ` · média ${avgDays}d sem cobertura` : ''}</p>
        </div>
        <div class="terr-catalog-toolbar-search">
          <span class="material-symbols-outlined" aria-hidden="true">search</span>
          <input id="catalog-search" type="search" class="terr-catalog-input" placeholder="Buscar nome, número, status…" autocomplete="off"/>
        </div>
      </div>
      <div class="terr-catalog-stats">
        <div class="terr-catalog-stat terr-catalog-stat--all">
          <span class="terr-catalog-stat__icon"><span class="material-symbols-outlined" aria-hidden="true">map</span></span>
          <div><p class="terr-catalog-stat__label">Total</p><p class="terr-catalog-stat__val" id="catalog-count-all">${territories.length}</p></div>
        </div>
        <div class="terr-catalog-stat terr-catalog-stat--work">
          <span class="terr-catalog-stat__icon"><span class="material-symbols-outlined" aria-hidden="true">assignment_ind</span></span>
          <div><p class="terr-catalog-stat__label">Designados</p><p class="terr-catalog-stat__val" id="catalog-count-work">0</p></div>
        </div>
        <div class="terr-catalog-stat terr-catalog-stat--avail">
          <span class="terr-catalog-stat__icon"><span class="material-symbols-outlined" aria-hidden="true">inventory</span></span>
          <div><p class="terr-catalog-stat__label">Disponíveis</p><p class="terr-catalog-stat__val" id="catalog-count-avail">0</p></div>
        </div>
        <div class="terr-catalog-stat terr-catalog-stat--high">
          <span class="terr-catalog-stat__icon"><span class="material-symbols-outlined" aria-hidden="true">warning</span></span>
          <div><p class="terr-catalog-stat__label">Prioridade alta</p><p class="terr-catalog-stat__val" id="catalog-count-high">${alta}</p></div>
        </div>
        <div class="terr-catalog-stat terr-catalog-stat--pct">
          <span class="terr-catalog-stat__icon"><span class="material-symbols-outlined" aria-hidden="true">pie_chart</span></span>
          <div class="min-w-0 flex-1">
            <p class="terr-catalog-stat__label">% designados</p>
            <p class="terr-catalog-stat__val" id="catalog-count-pct">${designadosPct}%</p>
            <div class="terr-catalog-stat__bar" aria-hidden="true"><span id="catalog-pct-bar" class="terr-catalog-stat__bar-fill" style="width:${designadosPct}%"></span></div>
          </div>
        </div>
        <div class="terr-catalog-stat terr-catalog-stat--avg">
          <span class="terr-catalog-stat__icon"><span class="material-symbols-outlined" aria-hidden="true">schedule</span></span>
          <div><p class="terr-catalog-stat__label">Média cobertura</p><p class="terr-catalog-stat__val" id="catalog-count-avg">${avgDays !== null ? `${avgDays}d` : '—'}</p></div>
        </div>
      </div>
      <div class="terr-catalog-scroll">
        <div class="terr-catalog-panel">
          <table class="terr-catalog-table">
            <thead>
              <tr>
                ${catalogSortButton('num', 'ID')}${catalogSortButton('name', 'Território')}${catalogFilterHeader('type', 'Tipo', 'type', CATALOG_TYPE_OPTIONS)}${catalogFilterHeader('status', 'Status', 'status', CATALOG_STATUS_OPTIONS)}${catalogSortButton('assignee', 'Designado')}${catalogSortButton('coverage', 'Cobertura')}
                <th scope="col" class="terr-catalog-actions" aria-label="Ações"></th>
              </tr>
            </thead>
            <tbody id="catalogo-table-body"></tbody>
          </table>
          <p id="catalogo-foot" class="terr-catalog-foot"></p>
        </div>
      </div>`;

    bindCatalogFilters();
    renderCatalogoTable();
  }

  function historyWeekday(entry) {
    return entry.metadata?.weekday || H().formatWeekday(String(entry.event_date).slice(0, 10));
  }

  function historyDirigente(entry) {
    return profileName(entry.profiles) || entry.metadata?.dirigente_name || '—';
  }

  function historyTerritory(entry) {
    if (entry.territories) return H().territoryLabel(entry.territories);
    return entry.metadata?.territory_label || '—';
  }

  function historyObservations(entry) {
    const obs = entry.metadata?.observations;
    if (obs) return obs;
    if (entry.metadata?.source === 'spreadsheet') return '';
    return entry.details || EVENT_LABELS[entry.event_type] || entry.event_type || '';
  }

  function historyTerritoryNum(entry) {
    return entry.territories?.num || entry.metadata?.territory_num || null;
  }

  function normalizeTerritoryNum(num) {
    return String(num ?? '').replace(/^0+/, '') || '0';
  }

  function resolveHistoryTerritory(entry) {
    if (entry.territory_id) {
      const byId = territories.find((t) => t.id === entry.territory_id);
      if (byId) return byId;
    }
    const num = historyTerritoryNum(entry);
    if (num) {
      const normalized = normalizeTerritoryNum(num);
      const byNum = territories.find((t) => normalizeTerritoryNum(t.num) === normalized);
      if (byNum) return byNum;
    }
    return entry.territories || null;
  }

  function historyTerritoryMapUrl(entry) {
    const t = resolveHistoryTerritory(entry);
    const num = t?.num || historyTerritoryNum(entry);
    return H().resolveTerritoryMapUrl(t?.map_image_url, num);
  }

  function historyDateTitle(iso) {
    const d = H().parseISODate(String(iso).slice(0, 10));
    if (!d) return '';
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function historyTerritoryCell(entry) {
    const terrNum = historyTerritoryNum(entry);
    const terrText = entry.territories
      ? (entry.territories.display_name || '—')
      : (entryTerrName(entry) || historyTerritory(entry));
    const label = historyTerritory(entry);
    const mapUrl = historyTerritoryMapUrl(entry);
    const inner = `
      ${terrNum ? `<span class="terr-hist-terr-num">T${escapeHtml(String(terrNum))}</span>` : ''}
      <span class="terr-hist-terr-name">${escapeHtml(terrText)}</span>
      ${mapUrl ? '<span class="material-symbols-outlined terr-hist-terr-map-icon" aria-hidden="true">map</span>' : ''}`;

    if (!mapUrl) {
      return `<span class="terr-hist-terr-btn" title="${escapeHtml(label)}">${inner}</span>`;
    }

    return `
      <button type="button" class="terr-hist-terr-btn terr-hist-terr-btn--map"
        data-terr-map="${escapeHtml(mapUrl)}"
        data-terr-title="${escapeHtml(label)}"
        title="Ver mapa · ${escapeHtml(label)}">${inner}</button>`;
  }

  function historyIsWeekend(entry) {
    const day = historyWeekday(entry);
    return day === 'Sábado' || day === 'Domingo';
  }

  function historyTypeClass(entry) {
    const t = entry.event_type || 'default';
    return EVENT_LABELS[t] ? t : 'default';
  }

  function historyTypeBadge(entry) {
    if (entry.event_type === 'trabalho' && entry.metadata?.source === 'spreadsheet') return '';
    const label = EVENT_LABELS[entry.event_type] || entry.event_type || 'Evento';
    return `<span class="terr-hist-type terr-hist-type--${historyTypeClass(entry)}">${escapeHtml(label)}</span>`;
  }

  const WEEKDAY_ORDER = {
    'Segunda-feira': 1,
    Segunda: 1,
    'Terça-feira': 2,
    Terça: 2,
    'Quarta-feira': 3,
    Quarta: 3,
    'Quinta-feira': 4,
    Quinta: 4,
    'Sexta-feira': 5,
    Sexta: 5,
    Sábado: 6,
    Domingo: 7
  };

  const HIST_EVENT_FILTERS = ['', 'designacao', 'devolucao', 'edicao', 'cronograma', 'status'];

  function histEventFilterLabel(type) {
    if (!type) return 'Todos';
    return EVENT_LABELS[type] || type;
  }

  function renderHistEventFilters() {
    return HIST_EVENT_FILTERS.map((type) => {
      const active = histFilter.eventType === type;
      return `<button type="button" class="terr-hist-filter${active ? ' terr-hist-filter--active' : ''}" data-hist-event="${type}">${escapeHtml(histEventFilterLabel(type))}</button>`;
    }).join('');
  }

  function histSortButton(col, label) {
    return `<button type="button" class="terr-hist-sort" data-hist-sort="${col}"><span>${label}</span><span class="material-symbols-outlined terr-hist-sort-icon" aria-hidden="true">unfold_more</span></button>`;
  }

  function updateHistSortUI() {
    const grid = document.getElementById('historico-grid');
    if (!grid) return;
    grid.querySelectorAll('[data-hist-sort]').forEach((btn) => {
      const active = histSort.col === btn.dataset.histSort;
      btn.classList.toggle('terr-hist-sort--active', active);
      btn.classList.toggle('terr-hist-sort--asc', active && histSort.dir === 'asc');
      btn.classList.toggle('terr-hist-sort--desc', active && histSort.dir === 'desc');
      const icon = btn.querySelector('.terr-hist-sort-icon');
      if (icon) icon.textContent = active ? (histSort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more';
    });
  }

  function getSortedHistory(list) {
    const { col, dir } = histSort;
    const mul = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (col) {
        case 'date':
          cmp = String(a.event_date).localeCompare(String(b.event_date));
          break;
        case 'day': {
          const da = WEEKDAY_ORDER[historyWeekday(a)] || 99;
          const db = WEEKDAY_ORDER[historyWeekday(b)] || 99;
          cmp = da - db || String(a.event_date).localeCompare(String(b.event_date));
          break;
        }
        case 'dirigente':
          cmp = historyDirigente(a).localeCompare(historyDirigente(b), 'pt-BR', { sensitivity: 'base' });
          break;
        case 'territorio': {
          const na = Number(historyTerritoryNum(a)) || 9999;
          const nb = Number(historyTerritoryNum(b)) || 9999;
          cmp = na - nb || historyTerritory(a).localeCompare(historyTerritory(b), 'pt-BR', { sensitivity: 'base' });
          break;
        }
        case 'obs':
          cmp = (historyObservations(a) || EVENT_LABELS[a.event_type] || a.event_type || '')
            .localeCompare(historyObservations(b) || EVENT_LABELS[b.event_type] || b.event_type || '', 'pt-BR', { sensitivity: 'base' });
          break;
        default:
          cmp = 0;
      }
      if (cmp === 0 && col !== 'date') cmp = String(a.event_date).localeCompare(String(b.event_date));
      return cmp * mul;
    });
  }

  function getFilteredHistory() {
    let list = history;
    const q = histFilter.q.trim().toLowerCase();
    if (q) {
      list = list.filter((h) => {
        const hay = [
          String(h.event_date).slice(0, 10),
          historyWeekday(h),
          historyDirigente(h),
          historyTerritory(h),
          historyObservations(h),
          EVENT_LABELS[h.event_type]
        ].join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    if (histFilter.eventType) {
      list = list.filter((h) => h.event_type === histFilter.eventType);
    }
    return getSortedHistory(list);
  }

  function bindHistoricoFilters() {
    const grid = document.getElementById('historico-grid');
    if (!grid) return;
    const search = grid.querySelector('#hist-search');
    if (search && search.value !== histFilter.q) search.value = histFilter.q;
    search?.addEventListener('input', (e) => {
      histFilter.q = e.target.value;
      renderHistoricoTable();
    });
    grid.querySelectorAll('[data-hist-event]').forEach((btn) => {
      btn.addEventListener('click', () => {
        histFilter.eventType = btn.dataset.histEvent || '';
        grid.querySelectorAll('[data-hist-event]').forEach((b) => {
          b.classList.toggle('terr-hist-filter--active', (b.dataset.histEvent || '') === histFilter.eventType);
        });
        renderHistoricoTable();
      });
    });
    grid.querySelectorAll('[data-hist-sort]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const col = btn.dataset.histSort;
        if (histSort.col === col) histSort.dir = histSort.dir === 'asc' ? 'desc' : 'asc';
        else {
          histSort.col = col;
          histSort.dir = col === 'date' ? 'desc' : 'asc';
        }
        updateHistSortUI();
        renderHistoricoTable();
      });
    });
  }

  function renderHistoricoTable() {
    const listEl = document.getElementById('historico-table-body');
    const footEl = document.getElementById('historico-foot');
    if (!listEl) return;

    updateHistSortUI();
    const filtered = getFilteredHistory();

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="terr-empty !border-0 !rounded-none">
          <span class="material-symbols-outlined" aria-hidden="true">search_off</span>
          <p class="text-sm">${history.length ? 'Nenhum registro corresponde ao filtro.' : 'Nenhum registro ainda.'}</p>
        </div>`;
      if (footEl) footEl.textContent = '';
      return;
    }

    listEl.innerHTML = filtered.map((h) => {
      const obs = historyObservations(h);
      const isoDate = String(h.event_date).slice(0, 10);
      return `
      <div class="terr-hist-row terr-hist-row--${historyIsWeekend(h) ? 'weekend' : 'weekday'}">
        <span class="terr-hist-date" title="${escapeHtml(historyDateTitle(isoDate))}">${escapeHtml(H().formatShortDate(isoDate))}</span>
        <span class="terr-hist-day">${escapeHtml(historyWeekday(h))}</span>
        <span class="terr-hist-cell terr-hist-cell--dirigente${historyDirigente(h) === '—' ? ' terr-hist-cell--muted' : ''}" title="${escapeHtml(historyDirigente(h))}">${escapeHtml(historyDirigente(h))}</span>
        <span class="terr-hist-cell">${historyTerritoryCell(h)}</span>
        <span class="terr-hist-obs${obs ? '' : ' terr-hist-obs--empty'}" title="${escapeHtml(obs || 'Sem observações')}">${historyTypeBadge(h)}${escapeHtml(obs || '—')}</span>
      </div>`;
    }).join('');

    if (footEl) {
      const parts = [];
      if (histFilter.q.trim()) parts.push('busca');
      if (histFilter.eventType) parts.push(histEventFilterLabel(histFilter.eventType).toLowerCase());
      const filterNote = parts.length ? ` · filtro: ${parts.join(', ')}` : '';
      const suffix = filtered.length < history.length ? ` (${history.length} no total)` : '';
      footEl.textContent = `Exibindo ${filtered.length} registro${filtered.length === 1 ? '' : 's'}${suffix}${filterNote}`;
    }
  }

  function entryTerrName(entry) {
    const label = entry.metadata?.territory_label || '';
    return label.replace(/^T?\d+\s*[-–—]?\s*/i, '').trim() || label;
  }

  function renderHistorico() {
    const grid = document.getElementById('historico-grid');
    if (!history.length) {
      grid.innerHTML = `
        <div class="terr-hist-toolbar">
          <div>
            <h2>Histórico</h2>
            <p>Registros de territórios e trabalho de campo</p>
          </div>
        </div>
        <div class="terr-empty">
          <span class="material-symbols-outlined" aria-hidden="true">history</span>
          <p class="text-sm font-semibold text-primary">Nenhum registro ainda</p>
          <p class="text-xs mt-1">Designações, devoluções e trabalhos aparecerão aqui.</p>
        </div>`;
      return;
    }

    grid.innerHTML = `
      <div class="terr-hist-toolbar">
        <div>
          <h2>Histórico</h2>
          <p>${history.length} registro${history.length === 1 ? '' : 's'}</p>
        </div>
        <div class="terr-hist-toolbar-search">
          <span class="material-symbols-outlined" aria-hidden="true">search</span>
          <input id="hist-search" type="search" class="terr-hist-input" placeholder="Buscar dirigente, território…" autocomplete="off"/>
        </div>
        <div class="terr-hist-filters" role="group" aria-label="Filtrar por tipo">${renderHistEventFilters()}</div>
      </div>
      <div class="terr-hist-scroll">
        <div class="terr-hist-panel">
          <div class="terr-hist-row terr-hist-row--head">
            ${histSortButton('date', 'Data')}${histSortButton('day', 'Dia')}${histSortButton('dirigente', 'Dirigente')}${histSortButton('territorio', 'Território')}${histSortButton('obs', 'Observações')}
          </div>
          <div id="historico-table-body"></div>
          <p id="historico-foot" class="terr-hist-foot"></p>
        </div>
      </div>`;

    bindHistoricoFilters();
    renderHistoricoTable();
  }

  const PREFERENCE_LABELS = {
    meio_de_semana: 'Meio de semana',
    final_de_semana: 'Final de semana',
    ambos: 'Ambos'
  };

  function preferenceMeta(preference) {
    if (preference === 'final_de_semana') return { label: PREFERENCE_LABELS.final_de_semana, className: 'terr-over-pref--weekend' };
    if (preference === 'ambos') return { label: PREFERENCE_LABELS.ambos, className: 'terr-over-pref--both' };
    return { label: PREFERENCE_LABELS.meio_de_semana, className: 'terr-over-pref--mid' };
  }

  function renderOverseerDayPills(overseer) {
    const days = H().overseerDays(overseer);
    if (days.length >= H().CRONOGRAMA_DAYS.length) {
      return '<span class="terr-over-day">Todos</span>';
    }
    return days.map((day) => {
      const weekend = ['Sábado', 'Domingo'].includes(day);
      return `<span class="terr-over-day${weekend ? ' terr-over-day--weekend' : ''}" title="${escapeHtml(day)}">${escapeHtml(day.slice(0, 3))}</span>`;
    }).join('');
  }

  function renderDirigentes() {
    const el = document.getElementById('dirigentes-list');
    const activeOverseers = overseers.filter((o) => o.is_active !== false);

    const countEl = document.getElementById('dirigentes-count');
    const statTotal = document.getElementById('dirigentes-stat-total');
    const statActive = document.getElementById('dirigentes-stat-active');

    if (countEl) countEl.textContent = `${overseers.length} cadastrados`;
    if (statTotal) statTotal.textContent = String(overseers.length);
    if (statActive) statActive.textContent = String(activeOverseers.length);

    if (!overseers.length) {
      el.innerHTML = `
        <div class="terr-empty">
          <span class="material-symbols-outlined" aria-hidden="true">groups</span>
          <p class="text-sm font-semibold text-primary">Nenhum dirigente cadastrado</p>
          <p class="text-xs mt-1">Use o formulário acima para adicionar irmãos aptos a receber território.</p>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="terr-over-scroll">
        <div class="terr-over-panel">
          <div class="terr-over-row terr-over-row--head">
            <span>Dirigente</span><span>Preferência</span><span>Dias</span><span>Status</span><span></span>
          </div>
          ${overseers.map((o) => {
            const pref = preferenceMeta(o.preference);
            const isActive = o.is_active !== false;
            const statusHtml = isActive
              ? '<span class="terr-over-status terr-over-status--active">Ativo</span>'
              : '<span class="terr-over-status terr-over-status--inactive">Inativo</span>';
            return `
          <div class="terr-over-row" title="${escapeHtml(profileName(o.profiles))}">
            <span class="terr-over-name">
              <span class="material-symbols-outlined" aria-hidden="true">person</span>
              <span>${escapeHtml(profileName(o.profiles))}</span>
            </span>
            <span class="terr-over-pref ${pref.className}">${escapeHtml(pref.label)}</span>
            <span class="terr-over-days" title="${escapeHtml(H().overseerDays(o).join(', '))}">${renderOverseerDayPills(o)}</span>
            <span class="terr-over-status-cell">${statusHtml}</span>
            <div class="terr-over-actions">
              <button type="button" data-edit-overseer="${o.profile_id}" class="terr-sched-icon-btn" title="Editar dias">
                <span class="material-symbols-outlined" aria-hidden="true">edit</span>
              </button>
              <button type="button" data-del-overseer="${o.profile_id}" class="terr-sched-icon-btn terr-sched-icon-btn--del" title="Remover">
                <span class="material-symbols-outlined" aria-hidden="true">delete</span>
              </button>
            </div>
          </div>`;
          }).join('')}
        </div>
      </div>`;

    el.querySelectorAll('[data-edit-overseer]').forEach((btn) =>
      btn.addEventListener('click', () =>
        openOverseerEditModal(overseers.find((o) => o.profile_id === btn.dataset.editOverseer))
      )
    );
    el.querySelectorAll('[data-del-overseer]').forEach((btn) =>
      btn.addEventListener('click', () => removeOverseer(btn.dataset.delOverseer))
    );
  }

  function openTerrFormModal(t) {
    if (!t) return;
    const wrap = document.createElement('div');
    wrap.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40';
    wrap.innerHTML = `
      <form class="bg-white rounded-xl border border-outline-variant p-6 w-full max-w-md space-y-3 shadow-xl max-h-[90vh] overflow-y-auto">
        <div>
          <h3 class="font-bold text-primary">Editar território</h3>
          <p class="text-sm text-on-surface-variant mt-0.5">T${escapeHtml(t.num)} · ${escapeHtml(t.display_name)}</p>
        </div>
        <label class="block text-xs font-semibold text-primary">Nome
          <input name="display_name" required value="${escapeHtml(t.display_name)}" class="mt-1 w-full rounded-lg border-outline-variant text-sm"/>
        </label>
        <label class="block text-xs font-semibold text-primary">URL da imagem
          <input name="map_image_url" value="${escapeHtml(t.map_image_url || '')}" class="mt-1 w-full rounded-lg border-outline-variant text-sm"/>
        </label>
        <label class="block text-xs font-semibold text-primary">Tipo
          <select name="territory_type" class="mt-1 w-full rounded-lg border-outline-variant text-sm">
            <option value="meio_de_semana" ${t.territory_type !== 'final_de_semana' ? 'selected' : ''}>Meio de semana</option>
            <option value="final_de_semana" ${t.territory_type === 'final_de_semana' ? 'selected' : ''}>Final de semana</option>
          </select>
        </label>
        <label class="block text-xs font-semibold text-primary">Melhor ocasião
          <input name="best_occasion" value="${escapeHtml(t.best_occasion || '')}" class="mt-1 w-full rounded-lg border-outline-variant text-sm" placeholder="Manhã, Tarde…"/>
        </label>
        <label class="block text-xs font-semibold text-primary">Observações
          <textarea name="observations" rows="2" class="mt-1 w-full rounded-lg border-outline-variant text-sm">${escapeHtml(t.observations || '')}</textarea>
        </label>
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
      const fd = new FormData(e.target);
      const { error } = await client.from('territories').update({
        display_name: fd.get('display_name')?.trim(),
        map_image_url: fd.get('map_image_url')?.trim() || null,
        territory_type: fd.get('territory_type'),
        best_occasion: fd.get('best_occasion')?.trim() || null,
        observations: fd.get('observations')?.trim() || null
      }).eq('id', t.id);
      wrap.remove();
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, 'Território atualizado.');
        await client.rpc('log_territory_history', {
          p_event_type: 'edicao',
          p_territory_id: t.id,
          p_profile_id: null,
          p_event_date: H().toISODate(new Date()),
          p_details: 'Catálogo atualizado pelo servo de territórios',
          p_metadata: {}
        }).catch(() => {});
        await refresh();
      }
    });
  }

  async function refresh() {
    try {
      await reloadAll();
      weekendByDate = await H().fetchWeekendAnnouncements(client, currentWeek);
      fillOverseerProfileSelect();
      renderSemana();
      renderCatalogo();
      renderHistorico();
      renderDirigentes();
    } catch (err) {
      console.error('Territory refresh:', err);
      if (toast) showToast(toast, err.message || 'Erro ao carregar territórios.', true);
      const grid = document.getElementById('catalogo-grid');
      if (grid) {
        grid.innerHTML = `<p class="text-sm text-error p-5">${escapeHtml(err.message || 'Erro ao carregar.')}</p>`;
      }
      const priEl = document.getElementById('semana-priority-list');
      if (priEl) {
        priEl.innerHTML = '<p class="text-sm text-error">Verifique a conexão ou permissões no Supabase.</p>';
      }
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
    const selected = new Set(H().overseerDays(overseer));
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
          ${H().CRONOGRAMA_DAYS.map((day) => `
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
        preference: H().preferenceFromDays(days)
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
    const enriched = row ? H().applyWeekendDirigente(row, currentWeek, weekendByDate, profiles) : null;
    const saturdayFromQuadro = enriched?.from_announcement;
    const wrap = document.createElement('div');
    wrap.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40';
    wrap.innerHTML = `
      <form class="bg-white rounded-xl border border-outline-variant p-6 w-full max-w-lg space-y-3 shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 class="font-bold text-primary">${isEdit ? 'Editar linha do cronograma' : 'Nova linha do cronograma'}</h3>
        ${saturdayFromQuadro ? `
        <p class="text-xs bg-[#faf6ef] border border-[#f0e4c8] text-[#5c4a1f] rounded-lg px-3 py-2">
          O <strong>dirigente de sábado</strong> vem do Quadro de Anúncios
          (${escapeHtml(enriched.announcement_dirigente || '')}).
          Edite em <a href="anuncios.html" class="underline font-semibold">Quadro de Anúncios → Final de Semana</a>.
        </p>` : ''}
        <label class="block text-xs font-semibold text-primary">Dia da semana
          <input name="weekday_label" required value="${escapeHtml(row?.weekday_label || '')}" list="cronograma-dias" class="mt-1 w-full rounded-lg border-outline-variant text-sm" placeholder="Ex.: Terça, Quarta (Tarde)"/>
        </label>
        <datalist id="cronograma-dias">${H().CRONOGRAMA_DAYS.map((d) => `<option value="${escapeHtml(d)}">`).join('')}</datalist>
        ${saturdayFromQuadro ? '' : `
        <label class="block text-xs font-semibold text-primary">Dirigente (cadastrado)
          <select name="profile_id" class="mt-1 w-full rounded-lg border-outline-variant text-sm">
            <option value="">— Dupla / outro —</option>
            ${overseerOptions(row?.profile_id)}
          </select>
        </label>
        <label class="block text-xs font-semibold text-primary">Nome do dirigente
          <input name="dirigente_name" value="${escapeHtml(row?.dirigente_name || '')}" class="mt-1 w-full rounded-lg border-outline-variant text-sm" placeholder="Ex.: Denison e Arnaldo"/>
        </label>`}
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
      const profileId = saturdayFromQuadro ? (enriched.profile_id || row.profile_id) : (fd.get('profile_id') || null);
      let dirigenteName = saturdayFromQuadro
        ? (enriched.dirigente_name || row.dirigente_name)
        : (fd.get('dirigente_name')?.trim() || null);
      if (!saturdayFromQuadro && profileId) {
        const p = profiles.find((pr) => pr.id === profileId) || overseers.find((o) => o.profile_id === profileId)?.profiles;
        dirigenteName = profileName(p) || dirigenteName;
      }
      if (!saturdayFromQuadro && !profileId && !dirigenteName) {
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
            ${H().CRONOGRAMA_DAYS.map((d) => `<option value="${d}">${d}</option>`).join('')}
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
    const msg = H().generateWhatsAppSchedule(currentWeek, scheduleRowsForWeek(), byId);
    document.getElementById('semana-whatsapp').textContent = msg;
    document.getElementById('semana-whatsapp-wrap').classList.remove('hidden');
    navigator.clipboard?.writeText(msg).then(
      () => showToast(toast, 'Mensagem copiada para a área de transferência.'),
      () => showToast(toast, 'Mensagem gerada abaixo (copie manualmente).')
    );
  }

  function openTerritoryMapLightbox(title, url) {
    const box = document.getElementById('terr-map-lightbox');
    const img = document.getElementById('terr-map-lightbox-img');
    const titleEl = document.getElementById('terr-map-lightbox-title');
    const body = box?.querySelector('.terr-map-lightbox__body');
    if (!box || !img || !url) return;
    titleEl.textContent = title || 'Território';
    img.classList.remove('hidden');
    img.src = url;
    img.alt = title || 'Mapa do território';
    body?.querySelector('.terr-map-lightbox__fallback')?.remove();
    img.onerror = () => {
      img.classList.add('hidden');
      if (body && !body.querySelector('.terr-map-lightbox__fallback')) {
        const msg = document.createElement('p');
        msg.className = 'terr-map-lightbox__fallback';
        msg.textContent = 'Mapa não encontrado. Verifique a URL da imagem no catálogo de territórios.';
        body.appendChild(msg);
      }
    };
    box.classList.add('is-open');
    box.setAttribute('aria-hidden', 'false');
  }

  function closeTerritoryMapLightbox() {
    const box = document.getElementById('terr-map-lightbox');
    const img = document.getElementById('terr-map-lightbox-img');
    if (!box) return;
    box.classList.remove('is-open');
    box.setAttribute('aria-hidden', 'true');
    if (img) {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      img.alt = '';
      img.classList.remove('hidden');
    }
    box.querySelector('.terr-map-lightbox__fallback')?.remove();
  }

  function setupTerritoryMapLightbox() {
    document.getElementById('terr-map-lightbox-close')?.addEventListener('click', closeTerritoryMapLightbox);
    document.getElementById('terr-map-lightbox')?.addEventListener('click', (e) => {
      if (e.target.id === 'terr-map-lightbox') closeTerritoryMapLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeTerritoryMapLightbox();
    });
    document.getElementById('panel-historico')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-terr-map]');
      if (!btn) return;
      openTerritoryMapLightbox(btn.dataset.terrTitle, btn.dataset.terrMap);
    });
    document.getElementById('panel-painel')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-terr-map]');
      if (!btn) return;
      openTerritoryMapLightbox(btn.dataset.terrTitle, btn.dataset.terrMap);
    });
  }

  async function init() {
    if (window.__JEAdminTerritoriosInit) {
      queueNavIndicatorRefresh();
      return true;
    }
    if (!bindAdmin()) {
      console.error('Territórios: JEAdmin não carregado');
      return false;
    }
    const helpers = H();
    if (!helpers) {
      console.error('Territórios: JETerritoryAssignment não carregado');
      return false;
    }

    const profile = await ensureAccess('territorios');
    if (!profile) return false;

    window.__JEAdminTerritoriosInit = true;
    try {
      toast = document.getElementById('hub-admin-toast') || document.getElementById('admin-toast');
      client = await getClient();
      if (!currentWeek) currentWeek = helpers.toISODate(helpers.getMonday(new Date()));
      setupTabs();
      setupTerritoryMapLightbox();

      document.getElementById('btn-designar')?.addEventListener('click', () => openDesignarModal());
      document.getElementById('btn-whatsapp')?.addEventListener('click', copyWhatsApp);
      document.getElementById('btn-new-schedule')?.addEventListener('click', openScheduleFormModal);
      document.getElementById('btn-new-spot')?.addEventListener('click', openSpotFormModal);

      document.getElementById('form-overseer')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const preference = document.getElementById('overseer-pref').value;
        const { error } = await client.from('territory_overseers').upsert({
          profile_id: document.getElementById('overseer-profile').value,
          preference,
          available_days: helpers.daysFromPreference(preference),
          is_active: true
        });
        if (error) showToast(toast, error.message, true);
        else {
          showToast(toast, 'Dirigente adicionado.');
          e.target.reset();
          await refresh();
        }
      });

      document.getElementById('semana-week')?.addEventListener('change', async (e) => {
        currentWeek = helpers.snapToMonday(e.target.value);
        weekendByDate = await helpers.fetchWeekendAnnouncements(client, currentWeek);
        renderSemana();
      });

      await refresh();
      return true;
    } catch (err) {
      delete window.__JEAdminTerritoriosInit;
      throw err;
    }
  }

  window.JEAdminTerritorios = { init };

  window.addEventListener('hub:section', (e) => {
    if (e.detail?.section === 'territorios') queueNavIndicatorRefresh();
  });

  if (!window.JEHubRouter && document.getElementById('terr-nav')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})();
