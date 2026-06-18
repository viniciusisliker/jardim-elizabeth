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

  const UNDO_SCOPE = 'territorios';

  function undoApi() {
    return window.JEHubUndo;
  }

  function pushUndo(entry) {
    undoApi()?.push(UNDO_SCOPE, entry);
  }

  function snapTerritory(t) {
    if (!t) return null;
    return {
      id: t.id,
      status: t.status,
      last_worked_at: t.last_worked_at ?? null,
      observations: t.observations ?? null
    };
  }

  function snapAssignment(a) {
    if (!a) return null;
    return {
      id: a.id,
      profile_id: a.profile_id,
      assigned_at: a.assigned_at,
      status: a.status,
      returned_at: a.returned_at ?? null,
      return_notes: a.return_notes ?? null,
      last_work_date: a.last_work_date ?? null
    };
  }

  function buildCatalogRowUndo(t, assignment, fd) {
    const beforeT = snapTerritory(t);
    const beforeA = snapAssignment(assignment);
    const newStatus = fd.get('status');
    const observations = fd.get('observations')?.trim() || null;
    const coverageDate = fd.get('coverage_date') || null;
    const wasDesignado = t.status === 'designado' && assignment;
    const orphanDesignado = t.status === 'designado' && !assignment;

    return {
      label: 'Edição no painel',
      undo: async (c) => {
        if (orphanDesignado && newStatus !== 'designado') {
          const { error: terrErr } = await c.from('territories').update({
            status: 'designado',
            last_worked_at: beforeT.last_worked_at,
            observations: beforeT.observations
          }).eq('id', beforeT.id);
          if (terrErr) throw terrErr;
          return;
        }
        if (wasDesignado && newStatus === 'designado') {
          if (beforeA) {
            const { error } = await c.from('territory_active_assignments').update({
              profile_id: beforeA.profile_id,
              assigned_at: beforeA.assigned_at
            }).eq('id', beforeA.id);
            if (error) throw error;
          }
          const { error: terrErr } = await c.from('territories').update({
            observations: beforeT.observations
          }).eq('id', beforeT.id);
          if (terrErr) throw terrErr;
          return;
        }
        if (!wasDesignado && newStatus === 'designado') {
          const { data: asn } = await c
            .from('territory_active_assignments')
            .select('id, assigned_at')
            .eq('territory_id', beforeT.id)
            .eq('status', 'active')
            .maybeSingle();
          if (asn) {
            const { error } = await c.rpc('return_territory_field', {
              p_assignment_id: asn.id,
              p_work_date: String(asn.assigned_at || coverageDate).slice(0, 10),
              p_notes: null
            });
            if (error) throw error;
          }
          if (beforeT.observations !== observations) {
            await c.from('territories').update({ observations: beforeT.observations }).eq('id', beforeT.id);
          }
          return;
        }
        if (wasDesignado && newStatus !== 'designado') {
          if (beforeA) {
            const { error } = await c.from('territory_active_assignments').update({
              status: 'active',
              returned_at: null,
              return_notes: null,
              last_work_date: beforeA.last_work_date
            }).eq('id', beforeA.id);
            if (error) throw error;
          }
          const { error: terrErr } = await c.from('territories').update({
            status: 'designado',
            last_worked_at: beforeT.last_worked_at,
            observations: beforeT.observations
          }).eq('id', beforeT.id);
          if (terrErr) throw terrErr;
          return;
        }
        const { error } = await c.from('territories').update({
          observations: beforeT.observations,
          last_worked_at: beforeT.last_worked_at
        }).eq('id', beforeT.id);
        if (error) throw error;
      }
    };
  }

  function buildAssignUndo(territoryId, observationsBefore) {
    return {
      label: 'Designação de território',
      undo: async (c) => {
        const { data: asn } = await c
          .from('territory_active_assignments')
          .select('id, assigned_at')
          .eq('territory_id', territoryId)
          .eq('status', 'active')
          .maybeSingle();
        if (!asn) return;
        const { error } = await c.rpc('return_territory_field', {
          p_assignment_id: asn.id,
          p_work_date: String(asn.assigned_at).slice(0, 10),
          p_notes: null
        });
        if (error) throw error;
        if (observationsBefore != null) {
          await c.from('territories').update({ observations: observationsBefore }).eq('id', territoryId);
        }
      }
    };
  }

  function buildReturnUndo(t, assignment) {
    const beforeT = snapTerritory(t);
    const beforeA = snapAssignment(assignment);
    return {
      label: 'Devolução de território',
      undo: async (c) => {
        if (beforeA) {
          const { error } = await c.from('territory_active_assignments').update({
            status: 'active',
            returned_at: null,
            return_notes: null,
            last_work_date: beforeA.last_work_date
          }).eq('id', beforeA.id);
          if (error) throw error;
        }
        const { error: terrErr } = await c.from('territories').update({
          status: 'designado',
          last_worked_at: beforeT.last_worked_at,
          observations: beforeT.observations
        }).eq('id', beforeT.id);
        if (terrErr) throw terrErr;
      }
    };
  }

  async function ensureAccess(permission) {
    if (window.JEHubRouter) {
      const profile = window.JEHubRouter.getProfile?.() || await window.JEAuth.getCurrentProfile();
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
  const lastTerritoryByProfileCache = new Map();
  let meetingSpots = [];
  let currentWeek = '';
  let histFilter = { q: '', date: {}, day: {}, dirigente: {}, territorio: {}, eventType: {} };
  let histSort = { col: 'date', dir: 'desc' };
  let catalogFilter = {
    q: '',
    num: {},
    name: {},
    status: { designado: true, disponivel: true },
    type: { meio_de_semana: true, final_de_semana: true },
    assignee: {},
    coverage: { working: true, fresh: true, warn: true, critical: true, unknown: true }
  };
  let catalogSort = { col: 'num', dir: 'asc' };
  let schedFilter = {
    day: {},
    dirigente: {},
    territorio: {},
    location: {},
    time: {},
    suggestion: { sim: true, nao: true }
  };
  let schedSort = { col: 'day', dir: 'asc' };
  let overFilter = {
    name: {},
    preference: { meio_de_semana: true, final_de_semana: true, ambos: true },
    days: {},
    status: { active: true, inactive: true }
  };
  let overSort = { col: 'name', dir: 'asc' };
  let weekendByDate = {};
  let tabsRendered = { painel: false, semana: false, historico: false, dirigentes: false };
  let assignmentByTerritoryId = new Map();
  let catalogTableTimer = null;
  let histTableTimer = null;
  let catalogFilterSig = '';
  let schedFilterSig = '';
  let histFilterSig = '';
  let overFilterSig = '';

  const TERR_COL_DEFAULTS = {
    catalog: ['52px', '220px', '128px', '96px', '148px', '196px', '52px'],
    sched: ['64px', '148px', '172px', '152px', '72px', '280px', '69px'],
    hist: ['76px', '96px', '168px', '210px', '240px', '40px'],
    over: ['220px', '136px', '200px', '88px', '72px'],
    spots: ['72px', '280px', '48px']
  };

  const SCHED_COLUMNS = [
    { id: 'day', label: 'Dia' },
    { id: 'dirigente', label: 'Dirigente' },
    { id: 'territorio', label: 'Território' },
    { id: 'location', label: 'Local' },
    { id: 'time', label: 'Horário' },
    { id: 'suggestion', label: 'Sugestão' },
    { id: 'actions', label: 'Ações', locked: true }
  ];

  const SCHED_COL_STORAGE = 'je-terr-sched-cols';

  function loadSchedColVisibility() {
    const base = Object.fromEntries(SCHED_COLUMNS.map((c) => [c.id, true]));
    try {
      const raw = localStorage.getItem(SCHED_COL_STORAGE);
      if (!raw) return base;
      const saved = JSON.parse(raw);
      SCHED_COLUMNS.forEach((c) => {
        if (c.locked) base[c.id] = true;
        else if (typeof saved[c.id] === 'boolean') base[c.id] = saved[c.id];
      });
    } catch {
      /* ignore */
    }
    return base;
  }

  let schedColVisibility = loadSchedColVisibility();

  function saveSchedColVisibility() {
    try {
      localStorage.setItem(SCHED_COL_STORAGE, JSON.stringify(schedColVisibility));
    } catch {
      /* ignore */
    }
  }

  function isSchedColVisible(id) {
    if (id === 'actions') return true;
    return schedColVisibility[id] !== false;
  }

  function visibleSchedColCount() {
    return SCHED_COLUMNS.filter((c) => isSchedColVisible(c.id)).length;
  }

  function tagSchedColgroup(table) {
    const cols = table?.querySelectorAll('colgroup col');
    if (!cols?.length) return;
    SCHED_COLUMNS.forEach((col, i) => {
      if (cols[i]) cols[i].dataset.schedCol = col.id;
    });
  }

  function schedColVisible(cell) {
    return cell && !cell.classList.contains('terr-sched-col--hidden');
  }

  function applySchedColVisibility() {
    const table = document.querySelector('#semana-sched-scroll .terr-sched-table');
    if (!table) return;
    SCHED_COLUMNS.forEach((col) => {
      const hidden = !isSchedColVisible(col.id);
      table.querySelectorAll(`[data-sched-col="${col.id}"]`).forEach((el) => {
        el.classList.toggle('terr-sched-col--hidden', hidden);
        if (hidden) el.setAttribute('aria-hidden', 'true');
        else el.removeAttribute('aria-hidden');
      });
    });
    tagSchedColgroup(table);
    initTerrColResize('sched');
    const emptyTd = table.querySelector('.terr-sched-empty-td');
    if (emptyTd) emptyTd.colSpan = visibleSchedColCount();
  }

  function renderSchedColsMenu() {
    const menu = document.getElementById('sched-cols-menu');
    if (!menu) return;
    const checks = SCHED_COLUMNS.filter((c) => !c.locked).map((col) => `
      <label class="terr-xlf-check">
        <input type="checkbox" data-sched-col-toggle="${col.id}" ${isSchedColVisible(col.id) ? 'checked' : ''}>
        <span>${escapeHtml(col.label)}</span>
      </label>`).join('');
    menu.innerHTML = `
      <div class="terr-sched-cols-menu__head">
        <p class="terr-xlf-menu-title">Colunas visíveis</p>
        <button type="button" class="terr-sched-cols-menu__close" data-sched-cols-close aria-label="Fechar">
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </div>
      <div class="terr-xlf-checks">${checks}</div>
      <div class="terr-xlf-menu-actions">
        <button type="button" class="terr-xlf-clear" data-sched-cols-reset>Restaurar todas</button>
      </div>`;
  }

  function closeSchedColsMenu() {
    const menu = document.getElementById('sched-cols-menu');
    const btn = document.getElementById('btn-sched-cols');
    menu?.classList.add('hidden');
    btn?.setAttribute('aria-expanded', 'false');
  }

  function setupSchedColsMenu() {
    if (window.__JESchedColsMenuBound) return;
    window.__JESchedColsMenuBound = true;
    renderSchedColsMenu();
    const wrap = document.getElementById('sched-cols-wrap');
    const btn = document.getElementById('btn-sched-cols');
    const menu = document.getElementById('sched-cols-menu');
    if (!wrap || !btn || !menu) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.classList.contains('hidden');
      document.querySelectorAll('.terr-sched-cols-menu').forEach((m) => m.classList.add('hidden'));
      if (open) {
        renderSchedColsMenu();
        menu.classList.remove('hidden');
        btn.setAttribute('aria-expanded', 'true');
      } else {
        closeSchedColsMenu();
      }
    });

    menu.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target.closest('[data-sched-cols-close]')) {
        closeSchedColsMenu();
        return;
      }
      const reset = e.target.closest('[data-sched-cols-reset]');
      if (!reset) return;
      schedColVisibility = Object.fromEntries(SCHED_COLUMNS.map((c) => [c.id, true]));
      saveSchedColVisibility();
      renderSchedColsMenu();
      applySchedColVisibility();
    });

    menu.addEventListener('change', (e) => {
      const box = e.target.closest('[data-sched-col-toggle]');
      if (!box) return;
      const id = box.dataset.schedColToggle;
      if (!id || id === 'actions') return;
      const nextVisible = box.checked;
      const othersVisible = SCHED_COLUMNS.filter((c) => !c.locked && c.id !== id && isSchedColVisible(c.id)).length;
      if (!nextVisible && othersVisible < 1) {
        box.checked = true;
        if (toast) showToast(toast, 'Deixe pelo menos uma coluna visível.', true);
        return;
      }
      schedColVisibility[id] = nextVisible;
      saveSchedColVisibility();
      applySchedColVisibility();
    });

    document.addEventListener('click', () => closeSchedColsMenu());
    document.addEventListener('scroll', (e) => {
      if (!menu.classList.contains('hidden') && e.target instanceof Node && menu.contains(e.target)) return;
      closeSchedColsMenu();
    }, true);
    menu.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    window.addEventListener('resize', () => closeSchedColsMenu());
  }

  function initTerrColResize(scope) {
    const R = window.JETerrColumnResize;
    if (!R) return;
    if (scope === 'catalog' || !scope) {
      R.mountTable({
        key: 'catalog',
        table: document.querySelector('#catalogo-grid .terr-catalog-table'),
        defaults: TERR_COL_DEFAULTS.catalog
      });
    }
    if (scope === 'sched' || !scope) {
      R.mountTable({
        key: 'sched-v7',
        table: document.querySelector('#semana-sched-scroll .terr-sched-table'),
        defaults: TERR_COL_DEFAULTS.sched,
        isColVisible: schedColVisible
      });
    }
    if (scope === 'spots' || !scope) {
      R.mountGrid({
        key: 'spots',
        panel: document.querySelector('#spots-list .terr-spots-panel'),
        headSelector: '.terr-spot-row--head',
        defaults: TERR_COL_DEFAULTS.spots
      });
    }
    if (scope === 'hist' || !scope) {
      R.mountGrid({
        key: 'hist',
        panel: document.querySelector('#historico-grid .terr-hist-panel'),
        headSelector: '.terr-hist-row--head',
        defaults: TERR_COL_DEFAULTS.hist
      });
    }
    if (scope === 'over' || !scope) {
      R.mountGrid({
        key: 'over',
        panel: document.querySelector('#dirigentes-list .terr-over-panel'),
        headSelector: '.terr-over-row--head',
        defaults: TERR_COL_DEFAULTS.over
      });
    }
  }

  function priorityBadge(t) {
    const p = H().computePriority(t);
    return `<span class="terr-priority terr-priority--${p.tone}">${escapeHtml(p.label)}</span>`;
  }

  function profileName(p) {
    if (!p) return '—';
    return p.full_name || p.profiles?.full_name || '—';
  }

  function overseerProfileRecord(o) {
    const linked = profiles.find((p) => p.id === o.profile_id);
    return linked ? { ...o.profiles, ...linked } : (o.profiles || {});
  }

  function overseerAvatarHtml(o, size = 28) {
    const profile = overseerProfileRecord(o);
    const inner = window.JEAuth?.renderAvatarHtml
      ? window.JEAuth.renderAvatarHtml(profile, { size, className: 'terr-over-avatar__img' })
      : '<span class="material-symbols-outlined terr-over-avatar__fallback" aria-hidden="true">person</span>';
    return `<span class="terr-over-avatar" aria-hidden="true">${inner}</span>`;
  }

  function overseerOptions(selectedId) {
    const ids = new Set(overseers.filter((o) => o.is_active !== false).map((o) => o.profile_id));
    const list = profiles.filter((p) => ids.has(p.id));
    return list.map((p) =>
      `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${escapeHtml(profileName(p))}</option>`
    ).join('');
  }

  function scheduleModalSelectedProfileId(row) {
    if (!row) return '';
    if (row.profile_id) return row.profile_id;
    const name = String(row.dirigente_name || '').trim();
    if (!name || H().isSundayCronogramaDay(row.weekday_label)) return '';
    const profile = H().resolveProfileByName(name, profiles)
      || H().resolveProfileByName(H().primaryDirigenteFromPair(name), profiles);
    return profile?.id || '';
  }

  function scheduleModalSelectedTerritoryId(row) {
    if (!row) return '';
    if (row.territory_id) return row.territory_id;
    return territoryByScheduleNum(row)?.id || '';
  }

  function resolveScheduleTerritoryPayload(row, territoryIdFromForm) {
    let territoryId = territoryIdFromForm || row?.territory_id || null;
    let territoryCode = null;
    if (territoryId) {
      const terr = territories.find((tr) => tr.id === territoryId);
      if (terr) territoryCode = scheduleTerritoryCodeFromTerr(terr);
    }
    if (!territoryId && row) {
      const terr = territoryByScheduleNum(row);
      if (terr) {
        territoryId = terr.id;
        territoryCode = scheduleTerritoryCodeFromTerr(terr);
      }
    }
    if (!territoryCode && row?.territory_code) {
      territoryCode = String(row.territory_code).trim();
    }
    return { territoryId, territoryCode };
  }

  function scheduleDirigenteOptions(selectedId) {
    const sorted = [...profiles].sort((a, b) =>
      profileName(a).localeCompare(profileName(b), 'pt-BR', { sensitivity: 'base' })
    );
    return sorted.map((p) =>
      `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${escapeHtml(profileName(p))}</option>`
    ).join('');
  }

  function scheduleModalDesignationAssignment(row) {
    if (!row) return null;
    if (H().isSundayCronogramaDay(row.weekday_label)) return scheduleDomingoPairAssignment(row);
    return scheduleActiveAssignment(row);
  }

  function scheduleModalAssignedAtIso(row, assignment) {
    const asn = assignment || scheduleModalDesignationAssignment(row);
    if (asn?.assigned_at) return String(asn.assigned_at).slice(0, 10);
    return H().toISODate(new Date());
  }

  function formatDesignationError(err) {
    const msg = String(err?.message || err || '');
    if (/territory_active_one_per_profile|territory_active_one_individual_per_profile/i.test(msg)) {
      return 'Este dirigente já possui um território individual ativo. Devolva-o antes ou use outro dirigente.';
    }
    if (/já possui um território ativo/i.test(msg) && !/domingo/i.test(msg)) {
      return 'Este dirigente já possui um território individual ativo.';
    }
    if (/dupla de domingo ativa/i.test(msg)) {
      return msg;
    }
    if (/territory_active_one_per_territory/i.test(msg)) {
      return 'Este território já possui designação ativa.';
    }
    if (/territory_active_one_domingo_per_profile/i.test(msg)) {
      return 'Este dirigente já está em uma dupla de domingo ativa.';
    }
    if (/duplicate key/i.test(msg) && /domingo_pair/i.test(msg)) {
      return 'Conflito de designação: dupla de domingo e território individual exigem migração no banco. Avise o administrador.';
    }
    return msg || 'Erro ao designar território.';
  }

  async function fetchActiveAssignmentForTerritory(territoryId) {
    if (!client || !territoryId) return null;
    const { data, error } = await client
      .from('territory_active_assignments')
      .select(`
        id, assigned_at, territory_id, profile_id, is_domingo_pair, status,
        territories ( num, display_name, map_image_url ),
        profiles!profile_id ( full_name, username )
      `)
      .eq('territory_id', territoryId)
      .eq('status', 'active')
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function repairOrphanTerritoryStatus(territoryId) {
    const terr = territories.find((t) => t.id === territoryId);
    if (!terr || terr.status !== 'designado') return;
    let active = activeAssignments.find((a) => a.territory_id === territoryId && a.status === 'active');
    if (!active?.id && client) {
      const { data } = await client
        .from('territory_active_assignments')
        .select('id')
        .eq('territory_id', territoryId)
        .eq('status', 'active')
        .maybeSingle();
      if (data?.id) return;
    } else if (active?.id) {
      return;
    }
    const { error } = await client
      .from('territories')
      .update({ status: 'disponivel' })
      .eq('id', territoryId);
    if (error) throw error;
    terr.status = 'disponivel';
  }

  async function syncScheduleFieldDesignation({ profileId, territoryId, assignedAt }) {
    if (!client) throw new Error('Sem conexão com o Supabase.');
    if (!profileId || !territoryId) {
      throw new Error('Dirigente e território são obrigatórios para designar no Painel.');
    }
    const assignedDate = assignedAt || H().toISODate(new Date());
    const terr = territories.find((t) => t.id === territoryId);
    if (!terr) throw new Error('Território não encontrado.');

    const existingOnTerritory = activeAssignments.find(
      (a) => a.territory_id === territoryId && a.status === 'active'
    );
    if (existingOnTerritory?.id) {
      if (existingOnTerritory.profile_id === profileId) {
        if (String(existingOnTerritory.assigned_at || '').slice(0, 10) !== assignedDate) {
          const { error } = await client
            .from('territory_active_assignments')
            .update({ assigned_at: assignedDate })
            .eq('id', existingOnTerritory.id);
          if (error) throw error;
          await loadActiveAssignments();
        }
        return;
      }
      const name = profileName(existingOnTerritory.profiles);
      throw new Error(`${H().territoryLabel(terr)} já está designado para ${name}.`);
    }

    const profileBusy = activeAssignments.find(
      (a) => a.profile_id === profileId
        && a.territory_id !== territoryId
        && a.status === 'active'
        && H().assignmentBlocksIndividualDesignation(a, profiles)
    );
    if (profileBusy) {
      const busyTerr = territories.find((t) => t.id === profileBusy.territory_id);
      throw new Error(
        `Este dirigente já possui ${busyTerr ? H().territoryLabel(busyTerr) : 'um território'} ativo.`
      );
    }

    await repairOrphanTerritoryStatus(territoryId);

    let rpcError = null;
    const { error } = await client.rpc('assign_territory_field', {
      p_territory_id: territoryId,
      p_profile_id: profileId,
      p_assigned_at: assignedDate,
      p_is_domingo_pair: false
    });
    if (error) rpcError = error;

    if (rpcError && /function|does not exist|42883/i.test(String(rpcError.message || ''))) {
      const { error: legacyErr } = await client.rpc('assign_territory_field', {
        p_territory_id: territoryId,
        p_profile_id: profileId,
        p_assigned_at: assignedDate
      });
      if (legacyErr) throw legacyErr;
    } else if (rpcError) {
      throw new Error(formatDesignationError(rpcError));
    }

    await Promise.all([loadActiveAssignments(), loadTerritories()]);
    await syncScheduleRowsForAssignment(profileId, territoryId);
  }

  async function syncScheduleDomingoPairDesignation({ territoryId, assignedAt, pairNum }) {
    if (!client) throw new Error('Sem conexão com o Supabase.');
    if (!pairNum) throw new Error('Selecione a dupla de domingo.');
    if (!territoryId) throw new Error('Selecione o território.');
    const terr = territories.find((t) => t.id === territoryId);
    if (!terr) throw new Error('Território não encontrado.');

    await loadActiveAssignments();
    await repairOrphanTerritoryStatus(territoryId);

    let existingOnTerritory = activeAssignments.find(
      (a) => a.territory_id === territoryId && a.status === 'active'
    );
    if (!existingOnTerritory?.id) {
      existingOnTerritory = await fetchActiveAssignmentForTerritory(territoryId);
      if (existingOnTerritory?.id) await loadActiveAssignments();
    }

    const reconcileDomingoAssignment = async (existing) => {
      const assignedDate = assignedAt || H().toISODate(new Date());
      const patch = {};
      if (String(existing.assigned_at || '').slice(0, 10) !== assignedDate) {
        patch.assigned_at = assignedDate;
      }
      if (!existing.is_domingo_pair) patch.is_domingo_pair = true;
      if (Object.keys(patch).length) {
        const { error: patchErr } = await client
          .from('territory_active_assignments')
          .update(patch)
          .eq('id', existing.id);
        if (patchErr) throw patchErr;
        await loadActiveAssignments();
      }
    };

    if (existingOnTerritory?.id) {
      await reconcileDomingoAssignment(existingOnTerritory);
      return;
    }

    await ensureProfiles();
    const profileId = H().resolveProfileIdForDomingoPair(
      pairNum,
      territoryId,
      profiles,
      activeAssignments,
      null
    );
    if (!profileId) {
      throw new Error(
        'Não foi possível designar a dupla: verifique se os nomes estão no cadastro e se nenhum membro já está em outra dupla de domingo.'
      );
    }

    const assignedDate = assignedAt || H().toISODate(new Date());
    const { error } = await client.rpc('assign_territory_field', {
      p_territory_id: territoryId,
      p_profile_id: profileId,
      p_assigned_at: assignedDate,
      p_is_domingo_pair: true
    });
    if (error) {
      if (/já possui designação ativa|already has an active assignment/i.test(String(error.message || ''))) {
        const existing = await fetchActiveAssignmentForTerritory(territoryId);
        if (existing?.id) {
          await reconcileDomingoAssignment(existing);
          await loadActiveAssignments();
          return;
        }
      }
      throw new Error(formatDesignationError(error));
    }

    await Promise.all([loadActiveAssignments(), loadTerritories()]);
    const pair = H().domingoPairForTerritoryNum(pairNum);
    if (pair?.dirigente_name) {
      await syncScheduleRowsForDomingoPair(pair.dirigente_name, territoryId);
    }
  }

  function availableTerritories() {
    return H().sortByPriority(territories.filter((t) => t.status !== 'designado'));
  }

  function territoryNumSortKey(num) {
    return parseInt(normalizeTerritoryNum(num), 10) || 0;
  }

  function territoryNumLabel(num) {
    const n = parseInt(normalizeTerritoryNum(num), 10);
    return Number.isNaN(n) ? `T${num}` : `T${String(n).padStart(2, '0')}`;
  }

  function availableTerritoriesByNum() {
    return territories
      .filter((t) => t.status !== 'designado')
      .sort((a, b) => territoryNumSortKey(a.num) - territoryNumSortKey(b.num)
        || String(a.num).localeCompare(String(b.num), 'pt-BR', { numeric: true }));
  }

  const TERRITORY_LIST_SELECT = 'id, num, display_name, status, map_image_url, last_worked_at, territory_type, observations, sort_order';

  async function loadTerritories() {
    const { data, error } = await client.from('territories').select(TERRITORY_LIST_SELECT).order('sort_order');
    if (error) throw error;
    territories = data || [];
  }

  async function loadProfiles() {
    const { data, error } = await client.from('profiles').select('id, full_name, username, role, avatar_url').order('full_name');
    if (error) {
      const { data: overseerProfiles } = await client
        .from('territory_overseers')
        .select('profile_id, profiles(id, full_name, username, role, avatar_url)');
      profiles = (overseerProfiles || []).map((o) => o.profiles).filter(Boolean);
      if (!profiles.length) throw error;
      return;
    }
    profiles = data || [];
  }

  async function loadOverseers() {
    const { data, error } = await client
      .from('territory_overseers')
      .select('profile_id, preference, available_days, is_active, notes, profiles(full_name, username, avatar_url)');
    if (error) throw error;
    overseers = (data || []).sort((a, b) => profileName(a.profiles).localeCompare(profileName(b.profiles)));
  }

  async function loadActiveAssignments() {
    const { data, error } = await client
      .from('territory_active_assignments')
      .select(`
        id, assigned_at, territory_id, profile_id, is_domingo_pair, status,
        territories ( num, display_name, map_image_url ),
        profiles!profile_id ( full_name, username )
      `)
      .eq('status', 'active')
      .order('assigned_at', { ascending: false });
    if (error) throw error;
    activeAssignments = data || [];
    assignmentByTerritoryId = new Map(activeAssignments.map((a) => [a.territory_id, a]));
  }

  function activeAssignmentForTerritoryId(terrId) {
    if (!terrId) return null;
    const fromMap = assignmentByTerritoryId.get(terrId);
    if (fromMap?.id) return fromMap;
    return activeAssignments.find((a) => a.territory_id === terrId) || null;
  }

  async function loadWeekTemplate() {
    const { data, error } = await client
      .from('territory_week_schedule')
      .select(`
        id, weekday_label, sort_order, dirigente_name, territory_code,
        location_name, schedule_times, suggestion, suggestion_note, observations,
        profile_id, territory_id,
        profiles ( full_name ),
        territories ( num, display_name, map_image_url )
      `)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    weekTemplate = data || [];
  }

  async function loadHistory() {
    const { data, error } = await client
      .from('territory_history')
      .select(`
        id, event_type, event_date, details, metadata, created_at, created_by, territory_id, profile_id,
        territories ( num, display_name, map_image_url ),
        profiles!profile_id ( full_name )
      `)
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(250);
    if (error) throw error;
    history = data || [];
    lastTerritoryByProfileCache.clear();
  }

  async function loadMeetingSpots() {
    const { data, error } = await client
      .from('territory_meeting_spots')
      .select('id, weekday_label, location_name, address, schedule_times, sort_order');
    if (error) throw error;
    meetingSpots = (data || []).sort((a, b) =>
      H().CRONOGRAMA_DAYS.indexOf(a.weekday_label) - H().CRONOGRAMA_DAYS.indexOf(b.weekday_label) ||
      (a.sort_order || 0) - (b.sort_order || 0)
    );
  }

  async function reloadCore() {
    const loads = [loadTerritories(), loadActiveAssignments(), loadWeekTemplate()];
    const labels = ['territories', 'active', 'schedule'];
    if (!profiles.length) {
      loads.push(loadProfiles());
      labels.push('profiles');
    }
    const results = await Promise.allSettled(loads);
    const errors = results
      .map((r, i) => (r.status === 'rejected' ? `${labels[i]}: ${r.reason?.message || r.reason}` : null))
      .filter(Boolean);
    if (errors.length && toast) {
      showToast(toast, `Alguns dados não carregaram: ${errors[0]}`, true);
    }
    return errors;
  }

  const tabLoadPromises = new Map();

  async function loadTabData(tab) {
    const loads = [];
    const labels = [];

    if (tab === 'designar' || tab === 'semana' || tab === 'dirigentes') {
      if (!profiles.length) {
        loads.push(loadProfiles());
        labels.push('profiles');
      }
    }
    if (tab === 'semana') {
      loads.push(loadWeekTemplate(), loadMeetingSpots(), loadHistory());
      labels.push('schedule', 'spots', 'history');
    }
    if (tab === 'historico') {
      loads.push(loadHistory());
      labels.push('history');
    }
    if (tab === 'designar' || tab === 'dirigentes') {
      if (!overseers.length) {
        loads.push(loadOverseers());
        labels.push('overseers');
      }
    }
    if (tab === 'painel' || tab === 'semana') {
      if (!weekTemplate.length) {
        loads.push(loadWeekTemplate());
        labels.push('schedule');
      }
      if (!profiles.length) {
        loads.push(loadProfiles());
        labels.push('profiles');
      }
    }
    if (tab === 'designar') {
      if (!territories.length) {
        loads.push(loadTerritories());
        labels.push('territories');
      }
      loads.push(loadActiveAssignments());
      labels.push('active');
    }

    const results = await Promise.allSettled(loads);
    const errors = results
      .map((r, i) => (r.status === 'rejected' ? `${labels[i]}: ${r.reason?.message || r.reason}` : null))
      .filter(Boolean);
    if (errors.length && toast) {
      showToast(toast, `Alguns dados não carregaram: ${errors[0]}`, true);
    }

    if (tab === 'semana') {
      try {
        weekendByDate = await H().fetchWeekendAnnouncements(client, currentWeek);
      } catch (err) {
        console.warn('Weekend announcements:', err);
      }
    }
    if (tab === 'dirigentes') fillOverseerProfileSelect();
    return errors;
  }

  function ensureTabData(tab) {
    if (tabLoadPromises.has(tab)) return tabLoadPromises.get(tab);
    const promise = loadTabData(tab).finally(() => {
      tabLoadPromises.delete(tab);
    });
    tabLoadPromises.set(tab, promise);
    return promise;
  }

  async function ensureProfiles() {
    if (profiles.length) return;
    await loadProfiles();
  }

  async function ensureCatalogModalData() {
    const loads = [];
    if (!profiles.length) loads.push(loadProfiles());
    if (!overseers.length) loads.push(loadOverseers());
    if (loads.length) await Promise.all(loads);
  }

  function activeTerrTab() {
    return document.querySelector('[data-terr-tab].active')?.dataset.terrTab || 'painel';
  }

  async function ensureTabReady(tab) {
    if (tab === 'painel') {
      if (!tabsRendered.painel) renderCatalogo();
      tabsRendered.painel = true;
      return;
    }
    if (tab === 'semana') {
      await prepareSemanaView();
      tabsRendered.semana = true;
      return;
    }
    await ensureTabData(tab);
    if (tab === 'historico' && !tabsRendered.historico) {
      renderHistorico();
      tabsRendered.historico = true;
    } else if (tab === 'dirigentes' && !tabsRendered.dirigentes) {
      renderDirigentes();
      tabsRendered.dirigentes = true;
    }
  }

  async function reloadForRefresh() {
    const loads = [loadTerritories(), loadActiveAssignments()];
    const labels = ['territories', 'active'];
    if (tabsRendered.semana || tabsRendered.painel) {
      loads.push(loadWeekTemplate());
      labels.push('schedule');
    }
    if (tabsRendered.semana) {
      loads.push(loadMeetingSpots());
      labels.push('spots');
    }
    if (tabsRendered.painel && !profiles.length) {
      loads.push(loadProfiles());
      labels.push('profiles');
    }
    if (tabsRendered.historico) {
      loads.push(loadHistory());
      labels.push('history');
    }
    if (tabsRendered.dirigentes) {
      loads.push(loadProfiles(), loadOverseers());
      labels.push('profiles', 'overseers');
    }
    const results = await Promise.allSettled(loads);
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
        ensureTabReady(tab).catch((err) => {
          console.error('Territory tab load:', err);
          if (toast) showToast(toast, err.message || 'Erro ao carregar aba.', true);
        });
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

  function openPriorityModal() {
    const modal = document.getElementById('terr-priority-modal');
    if (!modal) return;
    renderPriorityList();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closePriorityModal() {
    const modal = document.getElementById('terr-priority-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function setupPriorityModal() {
    document.getElementById('btn-priority-disponiveis')?.addEventListener('click', openPriorityModal);
    document.getElementById('terr-priority-modal-close')?.addEventListener('click', closePriorityModal);
    document.getElementById('terr-priority-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'terr-priority-modal') closePriorityModal();
      if (e.target.closest('[data-go-tab]')) closePriorityModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (document.getElementById('terr-map-lightbox')?.classList.contains('is-open')) return;
      if (document.getElementById('terr-priority-modal')?.classList.contains('is-open')) {
        closePriorityModal();
      }
    });
  }

  function renderPriorityList() {
    const priEl = document.getElementById('semana-priority-list');
    const btn = document.getElementById('btn-priority-disponiveis');
    const badge = document.getElementById('btn-priority-disponiveis-count');
    const avail = territories.filter((t) => t.status === 'disponivel');
    const sorted = H().sortByPriority(avail);
    const alta = avail.filter((t) => H().computePriority(t).tone === 'high').length;

    if (badge) {
      const count = alta || avail.length;
      badge.textContent = String(count);
      badge.classList.toggle('hidden', !count);
    }
    if (btn) {
      btn.classList.toggle('terr-sched-toolbar-btn--alert-pulse', alta > 0);
      btn.disabled = !avail.length;
      btn.title = avail.length
        ? `${avail.length} disponíve${avail.length === 1 ? 'l' : 'is'}${alta ? ` · ${alta} prioridade alta` : ''}`
        : 'Nenhum território disponível';
    }

    if (!priEl) return;
    priEl.innerHTML = sorted.length ? sorted.map((t) => {
      const days = H().daysSince(t.last_worked_at);
      return `
        <div class="terr-dash-row">
          <span class="terr-dash-terr-wrap">${catalogTerritoryCell(t)}</span>
          <span class="flex items-center gap-2 shrink-0">
            ${days !== null ? `<span class="text-[10px] text-on-surface-variant">${days}d</span>` : ''}
            ${priorityBadge(t)}
          </span>
        </div>`;
    }).join('') : '<p class="terr-dash-empty">Nenhum disponível.</p>';
    bindDashLinks(document.getElementById('terr-priority-modal'));
  }

  function activeDomingoAssignmentForPair(pair) {
    if (!pair?.dirigente_name) return null;
    const members = H().profilesInDomingoPair(pair.dirigente_name, profiles);
    if (!members.length) return null;
    return activeAssignments.find(
      (a) => a.status === 'active'
        && a.is_domingo_pair === true
        && members.some((m) => m.id === a.profile_id)
    ) || null;
  }

  function parseDesignarAssignee(value) {
    const pairNum = H().parseDomingoPairOptionValue(value);
    if (pairNum) {
      return {
        kind: 'domingo',
        pairNum,
        pair: H().domingoPairForTerritoryNum(pairNum)
      };
    }
    if (value) return { kind: 'individual', profileId: value };
    return { kind: null };
  }

  function designarDirigenteOptions(selectedValue) {
    const busyProfileIds = H().profilesWithIndividualAssignment(activeAssignments, profiles);
    const activeOverseers = overseers.filter((o) => o.is_active !== false);
    const individualOpts = activeOverseers.length
      ? activeOverseers.map((o) => {
        const p = profiles.find((pr) => pr.id === o.profile_id) || o.profiles;
        const disabled = busyProfileIds.has(o.profile_id) ? ' disabled' : '';
        const selected = selectedValue === o.profile_id;
        return `<option value="${o.profile_id}"${disabled}${selected ? ' selected' : ''}>${escapeHtml(profileName(p))}${disabled ? ' (já designado)' : ''}</option>`;
      }).join('')
      : '<option value="" disabled>Nenhum dirigente cadastrado — abra a aba Dirigentes</option>';

    const pairOpts = H().listDomingoPairs()
      .map((pair) => {
        const value = H().domingoPairOptionValue(pair.territory_num);
        const existing = activeDomingoAssignmentForPair(pair);
        const selectable = !existing?.id && H().domingoPairSelectable(
          pair,
          null,
          activeAssignments,
          profiles,
          null,
          null
        );
        const selected = selectedValue === value;
        const suffix = existing?.id ? ' (designado)' : (!selectable && !selected ? ' (indisponível)' : '');
        return `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}${!selectable && !selected ? ' disabled' : ''}>${escapeHtml(pair.dirigente_name)} · Dupla${escapeHtml(suffix)}</option>`;
      })
      .join('');

    return `
      <option value="">Selecione o dirigente</option>
      <optgroup label="Dirigentes">${individualOpts}</optgroup>
      <optgroup label="Duplas de domingo">${pairOpts}</optgroup>`;
  }

  function territoriesForDesignarSelect() {
    return availableTerritoriesByNum();
  }

  function fillDesignarTerritorySelect(assignee, selectedTerritoryId) {
    const terrSel = document.getElementById('designar-territory');
    if (!terrSel) return;
    const list = territoriesForDesignarSelect();
    terrSel.innerHTML = `<option value="">Selecione o território</option>${list.map((t) =>
      `<option value="${t.id}"${selectedTerritoryId === t.id ? ' selected' : ''}>${escapeHtml(territoryNumLabel(t.num))} — ${escapeHtml(t.display_name)}</option>`
    ).join('')}`;
    if (selectedTerritoryId && list.some((t) => t.id === selectedTerritoryId)) {
      terrSel.value = selectedTerritoryId;
    }
  }

  function onDesignarAssigneeChange() {
    const profSel = document.getElementById('designar-profile');
    const terrSel = document.getElementById('designar-territory');
    const assignee = parseDesignarAssignee(profSel?.value);
    const keepTerritoryId = terrSel?.value || '';
    fillDesignarTerritorySelect(assignee, keepTerritoryId);
    updateDesignarPreview();
  }

  function updateDesignarPreview() {
    const previewEl = document.getElementById('designar-preview');
    if (!previewEl) return;

    const assigneeVal = document.getElementById('designar-profile')?.value;
    const assignee = parseDesignarAssignee(assigneeVal);
    const territoryId = document.getElementById('designar-territory')?.value;
    const dateVal = document.getElementById('designar-date')?.value;
    const isDomingo = assignee.kind === 'domingo';

    if (!assigneeVal && !territoryId && !dateVal) {
      previewEl.innerHTML = `
        <div class="terr-assign-preview__empty">
          <span class="material-symbols-outlined" aria-hidden="true">touch_app</span>
          <p>Preencha os campos ao lado para ver o resumo antes de confirmar.</p>
        </div>`;
      return;
    }

    const profile = assignee.kind === 'individual'
      ? profiles.find((p) => p.id === assignee.profileId)
      : null;
    const territory = territories.find((t) => t.id === territoryId);
    const priority = territory ? H().computePriority(territory) : null;
    const rows = [];

    rows.push(`
      <div class="terr-assign-preview__row">
        <span class="terr-assign-preview__icon"><span class="material-symbols-outlined" aria-hidden="true">${isDomingo ? 'groups' : 'person'}</span></span>
        <div>
          <p class="terr-assign-preview__label">${isDomingo ? 'Dupla' : 'Dirigente'}</p>
          <p class="terr-assign-preview__value">${isDomingo
    ? escapeHtml(assignee.pair?.dirigente_name || 'Selecione…')
    : (profile ? escapeHtml(profileName(profile)) : 'Selecione…')}</p>
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

    const ready = assigneeVal && territoryId && dateVal;
    previewEl.innerHTML = rows.join('') + (ready ? `
      <div class="terr-assign-preview__foot">
        <span class="material-symbols-outlined" aria-hidden="true">${isDomingo ? 'weekend' : 'notifications_active'}</span>
        ${isDomingo
    ? 'Designação de dupla de domingo no Painel (não bloqueia território individual).'
    : 'O dirigente verá esta designação no Hub após confirmar.'}
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

  function fillDesignarSelects(selectedAssignee = '', selectedTerritoryId = '') {
    const profSel = document.getElementById('designar-profile');
    const dateEl = document.getElementById('designar-date');
    if (!profSel || !dateEl) return;
    const busyProfileIds = H().profilesWithIndividualAssignment(activeAssignments, profiles);
    const activeOverseers = overseers.filter((o) => o.is_active !== false);
    const freeOverseers = activeOverseers.filter((o) => !busyProfileIds.has(o.profile_id));
    const avail = availableTerritoriesByNum();

    profSel.innerHTML = designarDirigenteOptions(selectedAssignee);
    fillDesignarTerritorySelect(parseDesignarAssignee(selectedAssignee), selectedTerritoryId);

    dateEl.value = H().toISODate(new Date());

    const statAvail = document.getElementById('designar-stat-avail');
    const statFree = document.getElementById('designar-stat-free');
    const statBusy = document.getElementById('designar-stat-busy');
    if (statAvail) statAvail.textContent = String(avail.length);
    if (statFree) statFree.textContent = String(freeOverseers.length);
    const individualAssignments = activeAssignments.filter(
      (a) => H().assignmentBlocksIndividualDesignation(a, profiles)
    );
    if (statBusy) statBusy.textContent = String(individualAssignments.length);

    const busyWrap = document.getElementById('designar-busy-wrap');
    const busyList = document.getElementById('designar-busy-list');
    if (busyWrap && busyList) {
      if (!individualAssignments.length) {
        busyWrap.classList.add('hidden');
        busyList.innerHTML = '';
      } else {
        busyWrap.classList.remove('hidden');
        busyList.innerHTML = individualAssignments.map((a) => `
          <div class="terr-assign-busy__row">
            <span class="terr-assign-busy__person">${escapeHtml(profileName(a.profiles))}</span>
            <span class="terr-assign-busy__terr">${escapeHtml(H().territoryLabel(a.territories))}</span>
          </div>`).join('');
      }
    }

    onDesignarAssigneeChange();
  }

  function designarModalMarkup() {
    return `
      <div class="terr-assign-toolbar !rounded-t-xl !rounded-b-none !mb-0">
        <div class="flex-1 min-w-[10rem]">
          <h2>Nova designação de campo</h2>
          <p>Dirigente individual ou dupla de domingo e território.</p>
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
              <p class="terr-assign-note">Duplas de domingo aparecem no seletor com a tag Dupla.</p>
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
    ensureTabData('designar')
      .then(() => openDesignarModalInner(preset))
      .catch((err) => {
        console.error('Designar modal:', err);
        if (toast) showToast(toast, err.message || 'Erro ao carregar dados.', true);
      });
  }

  function openDesignarModalInner(preset = {}) {
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

    const presetAssignee = preset.pairId || preset.profileId || '';
    fillDesignarSelects(presetAssignee, preset.territoryId || '');
    if (preset.date) document.getElementById('designar-date').value = preset.date;
    onDesignarAssigneeChange();

    document.getElementById('designar-profile')?.addEventListener('change', onDesignarAssigneeChange);
    ['designar-territory', 'designar-date'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', updateDesignarPreview);
      document.getElementById(id)?.addEventListener('input', updateDesignarPreview);
    });

    wrap.querySelector('#form-designar').addEventListener('submit', async (e) => {
      e.preventDefault();
      const assignedAt = document.getElementById('designar-date').value;
      const assigneeVal = document.getElementById('designar-profile').value;
      const assignee = parseDesignarAssignee(assigneeVal);
      const territoryId = document.getElementById('designar-territory').value;

      if (assignee.kind === 'domingo') {
        if (!assignee.pairNum) {
          showToast(toast, 'Selecione a dupla de domingo.', true);
          return;
        }
        if (!territoryId) {
          showToast(toast, 'Selecione o território.', true);
          return;
        }
        const terr = territories.find((t) => t.id === territoryId);
        const undoEntry = buildAssignUndo(territoryId, terr?.observations ?? null);
        try {
          await syncScheduleDomingoPairDesignation({
            territoryId,
            assignedAt,
            pairNum: assignee.pairNum
          });
          pushUndo(undoEntry);
          showToast(toast, 'Dupla de domingo designada no Painel.');
          close();
          await refresh();
        } catch (err) {
          showToast(toast, err.message || 'Erro ao designar dupla de domingo.', true);
        }
        return;
      }

      const terr = territories.find((item) => item.id === territoryId);
      const undoEntry = buildAssignUndo(territoryId, terr?.observations ?? null);
      const profileId = assignee.profileId || assigneeVal;
      if (!profileId || !territoryId) {
        showToast(toast, 'Selecione o dirigente e o território.', true);
        return;
      }
      try {
        await syncScheduleFieldDesignation({ profileId, territoryId, assignedAt });
        pushUndo(undoEntry);
        showToast(toast, 'Território designado com sucesso.');
        close();
        await refresh();
      } catch (err) {
        showToast(toast, err.message || 'Erro ao designar território.', true);
      }
    });
  }

  function resolveDevolverAssignment(assignment) {
    if (!assignment) return null;
    if (assignment.id) return assignment;
    const terrId = assignment.territory_id || assignment.territories?.id;
    if (!terrId) return null;
    return activeAssignments.find((a) => a.territory_id === terrId && a.status === 'active') || null;
  }

  function devolverAssigneeLabel(assignment) {
    const terr = assignment.territories
      || territories.find((t) => t.id === assignment.territory_id);
    const pairLabel = terr
      ? H().domingoPairAssigneeLabel(terr.num, assignment, profiles, assigneeLabelContext(terr.id))
      : null;
    return pairLabel || profileName(assignment.profiles);
  }

  function openDevolverModal(assignment) {
    const resolved = resolveDevolverAssignment(assignment);
    if (!resolved?.id) {
      if (toast) showToast(toast, 'Não há designação ativa para devolver.', true);
      return;
    }
    if (document.getElementById('devolver-modal-wrap')) return;

    const isDomingoPair = H().isDomingoPairContextAssignment(resolved, profiles);
    const today = H().toISODate(new Date());
    const terr = territories.find((item) => item.id === resolved.territory_id) || resolved.territories;
    const terrLabel = H().territoryLabel(terr);
    const person = devolverAssigneeLabel({ ...resolved, territories: terr });
    const assignedIso = resolved.assigned_at ? String(resolved.assigned_at).slice(0, 10) : '';
    const modalTitle = isDomingoPair ? 'Devolver dupla de domingo' : 'Devolver território';
    const modalKicker = isDomingoPair ? 'Devolução da dupla' : 'Devolução de território';

    const wrap = document.createElement('div');
    wrap.id = 'devolver-modal-wrap';
    wrap.className = 'terr-catalog-modal';
    wrap.innerHTML = `
      <div class="terr-catalog-modal__panel" role="dialog" aria-modal="true" aria-labelledby="devolver-modal-title">
        <div class="terr-catalog-modal__hero">
          <button type="button" data-cancel class="terr-catalog-modal__close" aria-label="Fechar">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
          <p class="terr-catalog-modal__kicker">${escapeHtml(modalKicker)}</p>
          <h3 id="devolver-modal-title">${escapeHtml(modalTitle)}</h3>
          <p class="terr-catalog-modal__subtitle">${escapeHtml(terrLabel)}</p>
        </div>
        <form id="devolver-modal-form">
          <div class="terr-catalog-modal__body">
            <div class="terr-catalog-modal__context">
              <span class="terr-catalog-num">${escapeHtml(terr?.num || '—')}</span>
              <div class="terr-catalog-modal__context-main">
                <span class="terr-catalog-modal__context-name">${escapeHtml(terrLabel)}</span>
                <span class="text-xs text-on-surface-variant">Designado: ${escapeHtml(person)}${assignedIso ? ` · desde ${escapeHtml(H().formatDisplayDate(assignedIso))}` : ''}</span>
              </div>
            </div>
            <label class="terr-catalog-modal-field">
              <span class="terr-catalog-modal-field__label"><span class="material-symbols-outlined" aria-hidden="true">event</span>Data da devolução</span>
              <input name="work_date" type="date" required value="${escapeHtml(today)}" class="terr-catalog-modal-input terr-catalog-modal-input--date"/>
              <p class="terr-catalog-modal__cov-hint">Último dia em que o território foi trabalhado. Padrão: hoje.</p>
            </label>
            <label class="terr-catalog-modal-field">
              <span class="terr-catalog-modal-field__label"><span class="material-symbols-outlined" aria-hidden="true">notes</span>Observações</span>
              <input name="notes" type="text" class="terr-catalog-modal-input" placeholder="Opcional"/>
            </label>
          </div>
          <div class="terr-catalog-modal__foot">
            <div class="terr-catalog-modal__foot-actions">
              <button type="button" data-cancel class="terr-catalog-modal-btn terr-catalog-modal-btn--ghost">Cancelar</button>
              <button type="submit" class="terr-catalog-modal-btn terr-catalog-modal-btn--warn">
                <span class="material-symbols-outlined" aria-hidden="true">undo</span>
                Confirmar devolução
              </button>
            </div>
          </div>
        </form>
      </div>`;
    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';

    const close = () => {
      wrap.remove();
      document.body.style.overflow = '';
    };

    wrap.querySelectorAll('[data-cancel]').forEach((btn) => btn.addEventListener('click', close));
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    wrap.querySelector('#devolver-modal-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      const fd = new FormData(e.target);
      const workDate = fd.get('work_date') || today;
      const undoEntry = buildReturnUndo(terr, resolved);
      try {
        const { error } = await client.rpc('return_territory_field', {
          p_assignment_id: resolved.id,
          p_work_date: workDate,
          p_notes: fd.get('notes')?.trim() || null
        });
        if (error) {
          if (toast) showToast(toast, error.message, true);
          if (submitBtn) submitBtn.disabled = false;
          return;
        }
        close();
        pushUndo(undoEntry);
        if (toast) showToast(toast, 'Território devolvido.');
        await refresh();
      } catch (err) {
        if (toast) showToast(toast, err.message || 'Erro ao devolver território.', true);
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  function scheduleTerritoryNum(row) {
    if (row?.territories?.num != null && row.territories.num !== '') {
      return normalizeTerritoryNum(row.territories.num);
    }
    if (row?.territory_id) {
      const linked = territories.find((t) => t.id === row.territory_id);
      if (linked?.num != null && linked.num !== '') return normalizeTerritoryNum(linked.num);
    }
    for (const src of [row?.territory_code, row?.suggestion, row?.suggestion_note]) {
      const match = String(src || '').match(/T?\s*(\d+)/i);
      if (match) return normalizeTerritoryNum(match[1]);
    }
    return null;
  }

  function territoryByScheduleNum(row) {
    const num = scheduleTerritoryNum(row);
    if (!num) return null;
    return territories.find((t) => normalizeTerritoryNum(t.num) === num) || null;
  }

  function resolveScheduleTerritoryId(row) {
    if (row.territory_id) return row.territory_id;
    if (row.territories?.id) return row.territories.id;
    return territoryByScheduleNum(row)?.id || null;
  }

  function resolveScheduleTerritory(row) {
    const terrId = resolveScheduleTerritoryId(row);
    if (terrId) {
      return territories.find((t) => t.id === terrId) || row.territories || null;
    }
    return row.territories || territoryByScheduleNum(row) || null;
  }

  function assignmentForTerritoryId(terrId) {
    if (!terrId) return null;
    const direct = assignmentByTerritoryId.get(terrId);
    if (direct) return direct;
    const terr = territories.find((t) => t.id === terrId);
    if (!terr) return null;
    const byNum = activeAssignments.find(
      (a) => normalizeTerritoryNum(a.territories?.num) === normalizeTerritoryNum(terr.num)
    );
    if (byNum) return byNum;
    if (terr.status === 'designado') {
      return {
        id: null,
        territory_id: terr.id,
        profiles: null,
        territories: terr,
        assigned_at: null,
        _statusOnly: true
      };
    }
    return null;
  }

  function scheduleRowAcceptsAssignment(row, assignment) {
    if (!assignment?.id) return false;
    if (H().isSundayCronogramaDay(row?.weekday_label)) return false;
    return !H().isDomingoPairContextAssignment(assignment, profiles);
  }

  function isScheduleIndividualAssignment(assignment) {
    return !!assignment?.id && !H().isDomingoPairContextAssignment(assignment, profiles);
  }

  function isScheduleDomingoPairAssignment(assignment) {
    return !!assignment?.id && H().isDomingoPairContextAssignment(assignment, profiles);
  }

  function scheduleDomingoPairAssignment(row) {
    if (!H().isSundayCronogramaDay(row?.weekday_label)) return null;
    const terrId = resolveScheduleTerritoryId(row);

    if (terrId) {
      const direct = activeAssignmentForTerritoryId(terrId);
      if (direct?.id && H().isDomingoPairContextAssignment(direct, profiles)) return direct;
    }

    const pairName = String(row?.dirigente_name || '').trim() || H().domingoDirigenteName(row);
    if (!pairName) return null;
    const members = H().profilesInDomingoPair(pairName, profiles);
    if (!members.length) return null;

    const matches = activeAssignments.filter(
      (a) => a.status === 'active'
        && H().isDomingoPairContextAssignment(a, profiles)
        && members.some((m) => m.id === a.profile_id)
    );
    if (!matches.length) return null;
    if (terrId) {
      const onTerr = matches.find((a) => a.territory_id === terrId);
      if (onTerr) return onTerr;
    }
    return matches[0];
  }

  /** Designação ativa individual da linha (com id — usada no verde e no Devolver). */
  function scheduleActiveAssignment(row) {
    if (H().isSundayCronogramaDay(row?.weekday_label)) return null;

    const terrId = resolveScheduleTerritoryId(row);
    if (terrId) {
      const fromMap = assignmentByTerritoryId.get(terrId);
      if (isScheduleIndividualAssignment(fromMap)) return fromMap;
      const onTerritory = activeAssignments.find(
        (a) => a.territory_id === terrId
          && a.status === 'active'
          && isScheduleIndividualAssignment(a)
      );
      if (onTerritory) return onTerritory;
    }

    const profileId = resolveScheduleProfileId(row);
    if (profileId) {
      const onProfile = activeAssignments.find(
        (a) => a.profile_id === profileId
          && a.status === 'active'
          && isScheduleIndividualAssignment(a)
      );
      if (onProfile) return onProfile;
    }

    const normalized = scheduleTerritoryNum(row);
    if (normalized) {
      for (const a of activeAssignments) {
        if (!isScheduleIndividualAssignment(a)) continue;
        let aNum = normalizeTerritoryNum(a.territories?.num);
        if (!aNum && a.territory_id) {
          const t = territories.find((item) => item.id === a.territory_id);
          aNum = normalizeTerritoryNum(t?.num);
        }
        if (aNum === normalized) return a;
      }
    }

    return null;
  }

  function scheduleRowAssignment(row) {
    if (H().isSundayCronogramaDay(row?.weekday_label)) {
      return scheduleDomingoPairAssignment(row);
    }
    return scheduleActiveAssignment(row);
  }

  function scheduleReturnAssignment(row) {
    return scheduleActiveAssignment(row);
  }

  function assignmentForScheduleProfile(row) {
    if (H().isSundayCronogramaDay(row?.weekday_label)) return null;
    const profileId = resolveScheduleProfileId(row);
    if (!profileId) return null;
    const hit = activeAssignments.find(
      (a) => a.profile_id === profileId && !H().isDomingoPairContextAssignment(a, profiles)
    );
    if (!hit || !scheduleRowAcceptsAssignment(row, hit)) return null;
    return hit;
  }

  function resolveScheduleDisplayContext(row) {
    if (H().isSundayCronogramaDay(row?.weekday_label)) {
      const assignment = scheduleDomingoPairAssignment(row);
      return { terr: resolveScheduleTerritory(row), assignment: assignment || null };
    }
    const assignment = scheduleActiveAssignment(row);
    const terr = assignment?.territories
      || (assignment?.territory_id && territories.find((t) => t.id === assignment.territory_id))
      || resolveScheduleTerritory(row);
    return { terr: terr || null, assignment: assignment || null };
  }

  function scheduleTerritoryCodeFromTerr(terr) {
    if (!terr?.num && terr?.num !== 0) return null;
    return `T${terr.num}`;
  }

  async function syncScheduleRowsForAssignment(profileId, territoryId) {
    if (!client || !profileId || !territoryId) return;
    const existing = activeAssignments.find(
      (a) => a.profile_id === profileId && a.territory_id === territoryId
    );
    if (existing && H().isDomingoPairContextAssignment(existing, profiles)) return;
    const terr = territories.find((t) => t.id === territoryId);
    if (!terr) return;
    const territoryCode = scheduleTerritoryCodeFromTerr(terr);
    const rows = weekTemplate.filter((row) => {
      if (H().isSundayCronogramaDay(row.weekday_label)) return false;
      return resolveScheduleProfileId(row) === profileId;
    });
    const updates = rows.filter(
      (row) => row.territory_id !== territoryId || row.territory_code !== territoryCode
    );
    if (!updates.length) return;
    const results = await Promise.allSettled(
      updates.map((row) => client.from('territory_week_schedule').update({
        territory_id: territoryId,
        territory_code: territoryCode
      }).eq('id', row.id))
    );
    const failed = results.find((r) => r.status === 'rejected' || r.value?.error);
    if (failed) {
      const msg = failed.status === 'rejected'
        ? failed.reason?.message
        : failed.value?.error?.message;
      console.warn('Sync cronograma (designação):', msg);
      return;
    }
    await loadWeekTemplate();
  }

  async function syncScheduleRowsForDomingoPair(pairName, territoryId) {
    if (!client || !pairName || !territoryId) return;
    const pairNum = H().domingoPairNumForDirigenteName(pairName);
    if (!pairNum) return;
    const terr = territories.find((t) => t.id === territoryId);
    if (!terr) return;
    const territoryCode = scheduleTerritoryCodeFromTerr(terr);
    const rows = weekTemplate.filter((row) => {
      if (!H().isSundayCronogramaDay(row.weekday_label)) return false;
      const rowPair = String(row.dirigente_name || '').trim();
      if (!rowPair) return false;
      return H().domingoPairNumForDirigenteName(rowPair) === pairNum;
    });
    const updates = rows.filter(
      (row) => row.territory_id !== territoryId || row.territory_code !== territoryCode
    );
    if (!updates.length) return;
    const results = await Promise.allSettled(
      updates.map((row) => client.from('territory_week_schedule').update({
        territory_id: territoryId,
        territory_code: territoryCode,
        profile_id: null
      }).eq('id', row.id))
    );
    const failed = results.find((r) => r.status === 'rejected' || r.value?.error);
    if (failed) {
      const msg = failed.status === 'rejected'
        ? failed.reason?.message
        : failed.value?.error?.message;
      console.warn('Sync cronograma (dupla domingo):', msg);
      return;
    }
    await loadWeekTemplate();
  }

  async function reconcileDomingoPairFlags() {
    if (!client || !weekTemplate.length) return;
    let changed = false;
    for (const a of activeAssignments) {
      if (a.is_domingo_pair) continue;
      const scheduledPair = H().pairNameFromSundaySchedule(a.territory_id, weekTemplate);
      if (!scheduledPair) continue;
      if (profiles.length && !H().profileInDomingoPair(a.profile_id, scheduledPair, profiles)) {
        const personName = a.profiles?.full_name;
        const primary = H().primaryDirigenteFromPair(scheduledPair);
        if (!personName || !H().normalizeName(personName).startsWith(H().normalizeName(primary).split(/\s+/)[0])) {
          continue;
        }
      }
      const { error } = await client
        .from('territory_active_assignments')
        .update({ is_domingo_pair: true })
        .eq('id', a.id);
      if (error) {
        console.warn('Dupla domingo (reconciliar):', error.message);
        continue;
      }
      a.is_domingo_pair = true;
      changed = true;
    }
    if (changed) {
      assignmentByTerritoryId = new Map(activeAssignments.map((item) => [item.territory_id, item]));
    }
  }

  function findAssignmentForScheduleRow(row) {
    return scheduleRowAssignment(row);
  }

  function scheduleAssignmentTitle(assignment) {
    if (!assignment) return '';
    if (H().isDomingoPairContextAssignment(assignment, profiles)) {
      for (const pair of H().listDomingoPairs()) {
        if (H().profileInDomingoPair(assignment.profile_id, pair.dirigente_name, profiles)) {
          return pair.dirigente_name;
        }
      }
    }
    const person = profileName(assignment.profiles);
    return person !== '—' ? person : 'Em campo';
  }

  function scheduleTerritoryIdsForWeek() {
    const ids = new Set();
    scheduleRowsForWeek().forEach((row) => {
      const terr = resolveScheduleTerritory(row);
      if (terr?.id) ids.add(terr.id);
      else {
        const id = resolveScheduleTerritoryId(row);
        if (id) ids.add(id);
      }
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
    const rows = weekTemplate.map((row) => H().applyWeekendDirigente(row, currentWeek, weekendByDate, profiles));
    return H().applyDomingoFixedDirigentes(rows);
  }

  function resolveScheduleProfileId(row) {
    if (H().isSundayCronogramaDay(row?.weekday_label)) return null;
    if (row?.profile_id) return row.profile_id;
    const name = scheduleDirigente(row);
    if (!name || name === '—') return null;
    const primary = H().primaryDirigenteFromPair(name);
    const profile = H().resolveProfileByName(primary, profiles);
    return profile?.id || null;
  }

  async function sanitizeDomingoScheduleRows() {
    if (!client || !weekTemplate.length) return;
    const territoriesById = Object.fromEntries(territories.map((t) => [t.id, t]));
    const dirty = weekTemplate.filter((row) => {
      if (!H().isSundayCronogramaDay(row.weekday_label)) return false;
      if (row.profile_id) return true;
      const stored = String(row.dirigente_name || '').trim();
      if (stored && H().isKnownDomingoPairName(stored)) return false;
      const expected = H().domingoDirigenteName(row)
        || H().domingoPairNameForSchedule(
          row.weekday_label,
          row.territory_id,
          row.territory_code,
          territoriesById,
          stored
        )
        || stored;
      return expected && row.dirigente_name !== expected;
    });
    if (!dirty.length) return;
    for (const row of dirty) {
      const stored = String(row.dirigente_name || '').trim();
      const pairName = H().domingoDirigenteName(row)
        || H().domingoPairNameForSchedule(
          row.weekday_label,
          row.territory_id,
          row.territory_code,
          territoriesById,
          stored
        )
        || stored;
      const { error } = await client.from('territory_week_schedule').update({
        profile_id: null,
        dirigente_name: pairName || row.dirigente_name
      }).eq('id', row.id);
      if (error) console.warn('Domingo (cronograma):', error.message);
    }
    await loadWeekTemplate();
  }

  async function backfillScheduleRowLinks() {
    if (!client || !weekTemplate.length) return;
    const dirty = weekTemplate.filter((row) => {
      if (H().isSundayCronogramaDay(row.weekday_label)) return false;
      const needsTerritory = !row.territory_id && territoryByScheduleNum(row);
      const needsProfile = !row.profile_id && scheduleModalSelectedProfileId(row);
      return needsTerritory || needsProfile;
    });
    if (!dirty.length) return;
    for (const row of dirty) {
      const patch = {};
      if (!row.territory_id) {
        const terr = territoryByScheduleNum(row);
        if (terr) {
          patch.territory_id = terr.id;
          patch.territory_code = scheduleTerritoryCodeFromTerr(terr) || row.territory_code;
        }
      }
      if (!row.profile_id) {
        const profileId = scheduleModalSelectedProfileId(row);
        if (profileId) patch.profile_id = profileId;
      }
      if (!Object.keys(patch).length) continue;
      const { error } = await client.from('territory_week_schedule').update(patch).eq('id', row.id);
      if (error) console.warn('Cronograma (vínculos):', error.message);
    }
    await loadWeekTemplate();
  }

  async function syncScheduleDesignations() {
    if (!client || !weekTemplate.length) return 0;
    await sanitizeDomingoScheduleRows();
    await backfillScheduleRowLinks();
    return 0;
  }

  async function prepareSemanaView() {
    await ensureTabData('semana');
    await syncScheduleDesignations();
    renderSemana();
  }

  function scheduleDirigente(row) {
    if (H().isSundayCronogramaDay(row.weekday_label)) {
      const pair = H().domingoDirigenteName(row) || String(row.dirigente_name || '').trim();
      return pair || '—';
    }
    const pName = row.profiles?.full_name || row.profiles?.username;
    if (pName) return pName;
    const dName = String(row.dirigente_name || '').trim();
    return dName || '—';
  }

  function scheduleDomingoSort(a, b) {
    if (!H().isSundayCronogramaDay(a.weekday_label) || !H().isSundayCronogramaDay(b.weekday_label)) return 0;
    return H().compareDomingoRows(a, b);
  }

  function scheduleDirigenteHtml(row) {
    const name = scheduleDirigente(row);
    if (row.from_announcement) {
      return `${escapeHtml(name)} <span class="terr-sched-qa-badge" title="Definido no Quadro de Anúncios — Final de Semana">Quadro</span>`;
    }
    if (H().isSundayCronogramaDay(row.weekday_label) && name && name !== '—') {
      return `${escapeHtml(name)} <span class="terr-sched-qa-badge" title="Par de dirigentes aos domingos">Dupla</span>`;
    }
    if (row.announcement_special) {
      return '<span class="terr-sched-cell--muted">Evento especial — sem território</span>';
    }
    if (row.announcement_missing && H().isSaturdayCronogramaDay(row.weekday_label)) {
      const manual = String(row.dirigente_name || '').trim();
      if (manual) return escapeHtml(manual);
      return '<span class="terr-sched-cell--muted">Preencher no Quadro de Anúncios</span>';
    }
    return escapeHtml(name);
  }

  function scheduleTerritory(row) {
    const { terr } = resolveScheduleDisplayContext(row);
    if (terr) return H().territoryLabel(terr);
    if (row.territories) return H().territoryLabel(row.territories);
    return row.territory_code || '—';
  }

  function scheduleTerritoryMapUrl(row, assignment) {
    const ctx = resolveScheduleDisplayContext(row);
    const terr = ctx.terr;
    const asn = assignment || ctx.assignment;
    const num = terr?.num ?? scheduleTerritoryNum(row);
    return H().resolveTerritoryMapUrl(terr?.map_image_url ?? asn?.territories?.map_image_url, num);
  }

  function profileActiveIndividualAssignment(profileId) {
    if (!profileId) return null;
    return activeAssignments.find(
      (a) => a.profile_id === profileId
        && a.status === 'active'
        && isScheduleIndividualAssignment(a)
    ) || null;
  }

  function historyEntryMatchesProfile(entry, profileId, profileName) {
    if (!entry) return false;
    if (profileId && entry.profile_id === profileId) return true;
    if (!profileName) return false;
    const entryName = historyDirigente(entry);
    if (!entryName || entryName === '—') return false;
    return entryName.localeCompare(profileName, 'pt-BR', { sensitivity: 'base' }) === 0;
  }

  function lastTerritoryWorkedByProfile(profileId, rowFallback) {
    if (!profileId) return null;
    if (lastTerritoryByProfileCache.has(profileId)) {
      return lastTerritoryByProfileCache.get(profileId);
    }

    const profileName = profiles.find((p) => p.id === profileId)?.full_name
      || scheduleDirigente(rowFallback);
    const entry = history.find(
      (h) => historyEntryMatchesProfile(h, profileId, profileName)
        && (h.territory_id || h.territories || h.metadata?.territory_num)
    );
    if (entry) {
      const terr = resolveHistoryTerritory(entry);
      if (terr) {
        const result = { terr, eventDate: entry.event_date };
        lastTerritoryByProfileCache.set(profileId, result);
        return result;
      }
    }

    const fromRow = resolveScheduleTerritory(rowFallback);
    if (fromRow) {
      const result = { terr: fromRow, eventDate: null };
      lastTerritoryByProfileCache.set(profileId, result);
      return result;
    }

    lastTerritoryByProfileCache.set(profileId, null);
    return null;
  }

  function lastTerritoryWorkedForRow(row) {
    const profileId = resolveScheduleProfileId(row);
    if (profileId) return lastTerritoryWorkedByProfile(profileId, row);

    const terrId = resolveScheduleTerritoryId(row);
    const dirigenteName = scheduleDirigente(row);
    const cacheKey = terrId ? `terr:${terrId}` : `row:${row?.id || dirigenteName}`;
    if (lastTerritoryByProfileCache.has(cacheKey)) {
      return lastTerritoryByProfileCache.get(cacheKey);
    }

    const entry = history.find((h) => {
      if (!(h.territory_id || h.territories || h.metadata?.territory_num)) return false;
      if (terrId && h.territory_id === terrId) return true;
      if (dirigenteName && dirigenteName !== '—') {
        const entryName = historyDirigente(h);
        if (!entryName || entryName === '—') return false;
        return entryName.localeCompare(dirigenteName, 'pt-BR', { sensitivity: 'base' }) === 0;
      }
      return false;
    });
    if (entry) {
      const terr = resolveHistoryTerritory(entry);
      if (terr) {
        const result = { terr, eventDate: entry.event_date };
        lastTerritoryByProfileCache.set(cacheKey, result);
        return result;
      }
    }

    const fromRow = resolveScheduleTerritory(row);
    if (fromRow) {
      const result = { terr: fromRow, eventDate: null };
      lastTerritoryByProfileCache.set(cacheKey, result);
      return result;
    }

    lastTerritoryByProfileCache.set(cacheKey, null);
    return null;
  }

  function scheduleEmptyTerritoryCell(row) {
    const last = lastTerritoryWorkedForRow(row);
    const dateHint = last?.eventDate
      ? ` · ${H().formatShortDate(String(last.eventDate).slice(0, 10))}`
      : '';
    const lastHtml = last
      ? scheduleTerritoryInnerHtml(
        last.terr,
        H().territoryLabel(last.terr),
        last.terr.num,
        H().resolveTerritoryMapUrl(last.terr.map_image_url, last.terr.num),
        '',
        `Último território${dateHint}`
      )
      : '<span class="terr-sched-cell--muted">Nenhum registro encontrado</span>';

    return `
      <div class="terr-sched-terr-empty" data-sched-reveal-wrap>
        <button type="button" class="terr-sched-no-terr-btn" data-sched-reveal-last-terr aria-expanded="false" title="Clique para ver o último território trabalhado">
          Sem Territórios
        </button>
        <div class="terr-sched-last-terr" hidden>${lastHtml}</div>
      </div>`;
  }

  function scheduleTerritoryInnerHtml(terr, label, terrNum, mapUrl, assignedClass, title) {
    const inner = `
      ${terrNum != null && terrNum !== '' ? `<span class="terr-hist-terr-num">T${escapeHtml(String(terrNum))}</span>` : ''}
      <span class="terr-hist-terr-name">${escapeHtml(terr?.display_name || label)}</span>
      ${mapUrl ? '<span class="material-symbols-outlined terr-hist-terr-map-icon" aria-hidden="true">map</span>' : ''}`;

    if (!mapUrl) {
      return `<span class="terr-hist-terr-btn terr-sched-terr-btn${assignedClass}" title="${escapeHtml(title)}">${inner}</span>`;
    }

    return `
      <button type="button" class="terr-hist-terr-btn terr-hist-terr-btn--map terr-sched-terr-btn${assignedClass}"
        data-terr-map="${escapeHtml(mapUrl)}"
        data-terr-title="${escapeHtml(label)}"
        title="Ver mapa · ${escapeHtml(title)}">${inner}</button>`;
  }

  function scheduleTerritoryCell(row, assignment) {
    if (row.announcement_special) {
      return '<span class="terr-sched-cell--muted">Evento especial — sem território</span>';
    }

    if (H().isSundayCronogramaDay(row?.weekday_label)) {
      const domingoAssignment = assignment || scheduleDomingoPairAssignment(row);
      if (domingoAssignment?.id) {
        const terr = domingoAssignment.territories
          || (domingoAssignment.territory_id && territories.find((t) => t.id === domingoAssignment.territory_id))
          || resolveScheduleTerritory(row);
        const label = terr ? H().territoryLabel(terr) : scheduleTerritory(row);
        const terrNum = terr?.num ?? scheduleTerritoryNum(row);
        const mapUrl = terr
          ? H().resolveTerritoryMapUrl(terr.map_image_url, terrNum)
          : scheduleTerritoryMapUrl(row, domingoAssignment);
        const title = `Designado · ${scheduleAssignmentTitle(domingoAssignment)}`;
        return scheduleTerritoryInnerHtml(terr, label, terrNum, mapUrl, ' terr-sched-cell--assigned', title);
      }
      if (scheduleDirigente(row) && scheduleDirigente(row) !== '—') {
        return scheduleEmptyTerritoryCell(row);
      }
    }

    const profileId = resolveScheduleProfileId(row);
    const activeOnProfile = profileActiveIndividualAssignment(profileId);
    const ctx = resolveScheduleDisplayContext(row);
    const assignmentResolved = assignment || ctx.assignment;

    if (activeOnProfile) {
      const terr = activeOnProfile.territories
        || (activeOnProfile.territory_id && territories.find((t) => t.id === activeOnProfile.territory_id))
        || ctx.terr;
      const label = terr ? H().territoryLabel(terr) : scheduleTerritory(row);
      const terrNum = terr?.num ?? scheduleTerritoryNum(row);
      const mapUrl = terr
        ? H().resolveTerritoryMapUrl(terr.map_image_url, terrNum)
        : scheduleTerritoryMapUrl(row, activeOnProfile);
      const assignedClass = ' terr-sched-cell--assigned';
      const title = `Designado · ${scheduleAssignmentTitle(activeOnProfile)}`;
      return scheduleTerritoryInnerHtml(terr, label, terrNum, mapUrl, assignedClass, title);
    }

    if (profileId || (scheduleDirigente(row) && scheduleDirigente(row) !== '—')) {
      return scheduleEmptyTerritoryCell(row);
    }

    const terr = ctx.terr;
    const label = terr ? H().territoryLabel(terr) : scheduleTerritory(row);
    const terrNum = terr?.num ?? scheduleTerritoryNum(row);
    const mapUrl = scheduleTerritoryMapUrl(row, assignmentResolved);
    const assignedClass = assignmentResolved?.id ? ' terr-sched-cell--assigned' : '';
    const title = assignmentResolved?.id
      ? `Designado · ${scheduleAssignmentTitle(assignmentResolved)}`
      : (row.observations || label);
    return scheduleTerritoryInnerHtml(terr, label, terrNum, mapUrl, assignedClass, title);
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

  function scheduleDaySortIndex(label) {
    const idx = H().CRONOGRAMA_DAYS.indexOf(label);
    return idx >= 0 ? idx : 99;
  }

  function scheduleHasSuggestion(row) {
    return !!(row.suggestion || row.suggestion_note);
  }

  function syncSchedFilterOptions() {
    const rows = scheduleRowsForWeek();
    const days = [...new Set(rows.map((r) => r.weekday_label))].sort(
      (a, b) => scheduleDaySortIndex(a) - scheduleDaySortIndex(b)
    );
    xlfEnsureKeys(schedFilter.day, days);
    xlfEnsureKeys(
      schedFilter.dirigente,
      [...new Set(rows.map((r) => scheduleDirigente(r)))].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
    );
    xlfEnsureKeys(
      schedFilter.territorio,
      [...new Set(rows.map((r) => scheduleTerritory(r)))].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
    );
    xlfEnsureKeys(
      schedFilter.location,
      [...new Set(rows.map((r) => r.location_name || '—'))].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
    );
    xlfEnsureKeys(
      schedFilter.time,
      [...new Set(rows.map((r) => r.schedule_times || '—'))].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
    );
    const sig = [schedFilter.day, schedFilter.dirigente, schedFilter.territorio, schedFilter.location, schedFilter.time]
      .map((m) => Object.keys(m).join('\0'))
      .join('::');
    const changed = sig !== schedFilterSig;
    schedFilterSig = sig;
    return changed;
  }

  function getSortedScheduleRows(list) {
    const { col, dir } = schedSort;
    const mul = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (col) {
        case 'day':
          cmp = scheduleDaySortIndex(a.weekday_label) - scheduleDaySortIndex(b.weekday_label);
          if (cmp === 0) cmp = scheduleDomingoSort(a, b);
          break;
        case 'dirigente':
          cmp = scheduleDirigente(a).localeCompare(scheduleDirigente(b), 'pt-BR', { sensitivity: 'base' });
          break;
        case 'territorio':
          cmp = scheduleTerritory(a).localeCompare(scheduleTerritory(b), 'pt-BR', { sensitivity: 'base' });
          break;
        case 'location':
          cmp = String(a.location_name || '—').localeCompare(String(b.location_name || '—'), 'pt-BR', { sensitivity: 'base' });
          break;
        case 'time':
          cmp = String(a.schedule_times || '—').localeCompare(String(b.schedule_times || '—'), 'pt-BR', { sensitivity: 'base' });
          break;
        case 'suggestion':
          cmp = Number(scheduleHasSuggestion(a)) - Number(scheduleHasSuggestion(b));
          break;
        default:
          cmp = scheduleDaySortIndex(a.weekday_label) - scheduleDaySortIndex(b.weekday_label);
          if (cmp === 0) cmp = scheduleDomingoSort(a, b);
      }
      if (cmp === 0) cmp = scheduleDomingoSort(a, b);
      if (cmp === 0) cmp = (a.sort_order || 0) - (b.sort_order || 0);
      return cmp * mul;
    });
  }

  function getFilteredScheduleRows() {
    let list = scheduleRowsForWeek();
    list = xlfApplyMapFilter(list, schedFilter.day, (r) => r.weekday_label);
    list = xlfApplyMapFilter(list, schedFilter.dirigente, (r) => scheduleDirigente(r));
    list = xlfApplyMapFilter(list, schedFilter.territorio, (r) => scheduleTerritory(r));
    list = xlfApplyMapFilter(list, schedFilter.location, (r) => r.location_name || '—');
    list = xlfApplyMapFilter(list, schedFilter.time, (r) => r.schedule_times || '—');
    list = xlfApplyMapFilter(list, schedFilter.suggestion, (r) => (scheduleHasSuggestion(r) ? 'sim' : 'nao'));
    return getSortedScheduleRows(list);
  }

  function schedHeaderRow() {
    syncSchedFilterOptions();
    const dayOpts = xlfOptionsFromKeys(Object.keys(schedFilter.day));
    const dirOpts = xlfOptionsFromKeys(Object.keys(schedFilter.dirigente));
    const terrOpts = xlfOptionsFromKeys(Object.keys(schedFilter.territorio));
    const locOpts = xlfOptionsFromKeys(Object.keys(schedFilter.location));
    const timeOpts = xlfOptionsFromKeys(Object.keys(schedFilter.time));
    return `
      ${xlfColumnHeader('sched-sort', schedSort, schedFilter, { col: 'day', label: 'Dia', filterKey: 'day', options: dayOpts, wrap: 'th' })}
      ${xlfColumnHeader('sched-sort', schedSort, schedFilter, { col: 'dirigente', label: 'Dirigente', filterKey: 'dirigente', options: dirOpts, wrap: 'th' })}
      ${xlfColumnHeader('sched-sort', schedSort, schedFilter, { col: 'territorio', label: 'Território', filterKey: 'territorio', options: terrOpts, wrap: 'th' })}
      ${xlfColumnHeader('sched-sort', schedSort, schedFilter, { col: 'location', label: 'Local', filterKey: 'location', options: locOpts, wrap: 'th' })}
      ${xlfColumnHeader('sched-sort', schedSort, schedFilter, { col: 'time', label: 'Horário', filterKey: 'time', options: timeOpts, wrap: 'th' })}
      ${xlfColumnHeader('sched-sort', schedSort, schedFilter, { col: 'suggestion', label: 'Sugestão', filterKey: 'suggestion', options: SCHED_SUGGESTION_OPTIONS, wrap: 'th' })}
      <th scope="col" class="terr-sched-actions-th" data-sched-col="actions" aria-hidden="true"></th>`;
  }

  function bindSchedFilters() {
    const scroll = document.getElementById('semana-sched-scroll');
    if (!scroll) return;
    scroll.dataset.xlfScope = 'sched';
    delete scroll.dataset.xlfBound;
    bindXlfPanel(scroll, 'sched-sort', schedFilter, schedSort, () => renderSemanaTable({ updateUi: true }));
  }

  function renderSemanaTable(opts = {}) {
    const { updateUi = true } = opts;
    const body = document.getElementById('semana-table-body');
    const foot = document.getElementById('semana-table-foot');
    if (!body) return;
    if (updateUi) {
      xlfUpdateSortUI(document.getElementById('semana-sched-scroll'), 'sched-sort', schedSort);
      xlfUpdateFilterUI(document.getElementById('semana-sched-scroll'), schedFilter);
    }
    const filtered = getFilteredScheduleRows();
    const total = scheduleRowsForWeek().length;

    if (!filtered.length) {
      body.innerHTML = `
        <tr>
          <td colspan="${visibleSchedColCount()}" class="terr-sched-empty-td">
            <div class="terr-empty !border-0 !rounded-none">
              <span class="material-symbols-outlined" aria-hidden="true">search_off</span>
              <p class="text-sm">${total ? 'Nenhuma linha corresponde ao filtro.' : 'Nenhuma linha no cronograma.'}</p>
            </div>
          </td>
        </tr>`;
      if (foot) foot.textContent = '';
      applySchedColVisibility();
      return;
    }

    body.innerHTML = filtered.map((r) => {
      const tone = scheduleDayTone(r.weekday_label);
      const dirigenteHtml = scheduleDirigenteHtml(r);
      const assignment = scheduleRowAssignment(r);
      const territorioHtml = scheduleTerritoryCell(r, assignment);
      const sugg = scheduleSuggestion(r);
      const hasSugg = r.suggestion || r.suggestion_note;
      const satHint = r.announcement_sat_date && H().isSaturdayCronogramaDay(r.weekday_label)
        ? ` · ${H().formatDisplayDate(r.announcement_sat_date)}`
        : '';
      const returnBtn = assignment?.id
        ? `<button type="button" data-return-assignment="${assignment.id}" class="terr-sched-icon-btn terr-sched-icon-btn--return terr-sched-action--return" title="Devolver ${escapeHtml(H().isDomingoPairContextAssignment(assignment, profiles, assigneeLabelContext(assignment.territory_id)) ? (H().domingoPairAssigneeLabel(assignment.territories?.num, assignment, profiles, assigneeLabelContext(assignment.territory_id)) || H().territoryLabel(assignment.territories)) : H().territoryLabel(assignment.territories))}" aria-label="Devolver território">
            <span class="material-symbols-outlined" aria-hidden="true">undo</span>
          </button>`
        : '<span class="terr-sched-icon-btn terr-sched-icon-btn--slot terr-sched-action--return" aria-hidden="true"></span>';
      return `
      <tr class="terr-sched-tr terr-sched-tr--${tone}" title="${escapeHtml(r.observations || '')}${satHint}">
        <td data-sched-col="day"><span class="terr-sched-day-pill">
          <span class="material-symbols-outlined" aria-hidden="true">${scheduleDayIcon(r.weekday_label)}</span>
          ${escapeHtml(r.weekday_label)}
        </span></td>
        <td data-sched-col="dirigente" class="terr-sched-cell terr-sched-cell--dirigente">${dirigenteHtml}</td>
        <td data-sched-col="territorio">${territorioHtml}</td>
        <td data-sched-col="location" class="terr-sched-cell${r.location_name ? '' : ' terr-sched-cell--muted'}">${escapeHtml(r.location_name || '—')}</td>
        <td data-sched-col="time" class="terr-sched-time">${escapeHtml(r.schedule_times || '—')}</td>
        <td data-sched-col="suggestion"><span class="terr-sched-sugg" title="${escapeHtml(sugg)}">${hasSugg ? escapeHtml(sugg) : '—'}</span></td>
        <td data-sched-col="actions" class="terr-sched-actions-td">
          <div class="terr-sched-row-actions">
            ${returnBtn}
            <button type="button" data-edit-schedule="${r.id}" class="terr-sched-icon-btn terr-sched-action--edit" title="Editar">
              <span class="material-symbols-outlined" aria-hidden="true">edit</span>
            </button>
            <button type="button" data-del-schedule="${r.id}" class="terr-sched-icon-btn terr-sched-icon-btn--del terr-sched-action--delete" title="Excluir">
              <span class="material-symbols-outlined" aria-hidden="true">delete</span>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');

    if (foot) {
      const activeFilters = Object.entries(schedFilter).filter(([, map]) => xlfIsActive(map)).length;
      const filterNote = activeFilters ? ` · ${activeFilters} filtro${activeFilters === 1 ? '' : 's'} ativo${activeFilters === 1 ? '' : 's'}` : '';
      const suffix = filtered.length < total ? ` (${total} no total)` : '';
      foot.textContent = `Exibindo ${filtered.length} linha${filtered.length === 1 ? '' : 's'}${suffix}${filterNote}`;
    }
    applySchedColVisibility();
  }

  function renderMeetingSpots() {
    const spotsEl = document.getElementById('spots-list');
    if (!spotsEl) return;
    if (!meetingSpots.length) {
      spotsEl.innerHTML = '<p class="text-xs text-on-surface-variant text-center py-3">Nenhum local cadastrado.</p>';
      return;
    }
    spotsEl.innerHTML = `<div class="terr-spots-panel">
      <div class="terr-spot-row terr-spot-row--head">
        <span class="terr-col-resize-cell">Dia</span>
        <span class="terr-col-resize-cell">Local</span>
        <span class="terr-col-resize-cell terr-xlf-head-cell--actions" aria-hidden="true"></span>
      </div>
      ${meetingSpots.map((s) => `
      <div class="terr-spot-row">
        <span class="terr-spot-day">${escapeHtml(s.weekday_label)}</span>
        <div class="min-w-0">
          <span class="font-semibold text-primary">${escapeHtml(s.location_name)}</span>
          <span class="terr-spot-meta">${escapeHtml(s.address || s.schedule_times || '')}</span>
        </div>
        <button type="button" data-del-spot="${s.id}" class="terr-sched-icon-btn terr-sched-icon-btn--del" title="Excluir">
          <span class="material-symbols-outlined" aria-hidden="true">delete</span>
        </button>
      </div>`).join('')}
    </div>`;
    initTerrColResize('spots');
  }

  function syncSemanaWeekInput() {
    const weekInput = document.getElementById('semana-week');
    if (!weekInput || !window.JEWeekInput) return;
    weekInput.value = window.JEWeekInput.weekInputFromMonday(currentWeek);
  }

  async function syncAllScheduleRowsFromAssignments() {
    for (const a of activeAssignments) {
      if (a.profile_id && a.territory_id && !H().isDomingoPairContextAssignment(a, profiles)) {
        await syncScheduleRowsForAssignment(a.profile_id, a.territory_id);
      }
    }
  }

  async function reloadSemanaData() {
    const results = await Promise.allSettled([
      loadWeekTemplate(),
      loadMeetingSpots(),
      loadTerritories(),
      loadActiveAssignments()
    ]);
    const errors = results
      .filter((r) => r.status === 'rejected')
      .map((r) => r.reason?.message || String(r.reason));
    if (errors.length) throw new Error(errors[0]);
    await syncAllScheduleRowsFromAssignments();
    try {
      weekendByDate = await H().fetchWeekendAnnouncements(client, currentWeek);
    } catch (err) {
      console.warn('Weekend announcements:', err);
    }
  }

  async function refreshSemanaView() {
    await syncScheduleDesignations();
    syncSemanaWeekInput();
    renderExtraDesignados();
    renderPriorityList();
    renderMeetingSpots();

    const el = document.getElementById('semana-list');
    if (!el) return;
    if (!weekTemplate.length) {
      if (document.getElementById('semana-table-body')) renderSemana();
      else if (!el.querySelector('.terr-empty')) renderSemana();
      return;
    }
    if (!document.getElementById('semana-table-body')) {
      renderSemana();
      return;
    }

    const filtersChanged = syncSchedFilterOptions();
    if (filtersChanged) {
      const head = document.querySelector('#semana-sched-scroll .terr-sched-table thead tr');
      if (head) head.innerHTML = schedHeaderRow();
      const scroll = document.getElementById('semana-sched-scroll');
      if (scroll) {
        delete scroll.dataset.xlfBound;
        bindSchedFilters();
      }
      initTerrColResize('sched');
    }
    renderSemanaTable({ updateUi: filtersChanged });
  }

  function renderSemana() {
    syncSemanaWeekInput();
    const el = document.getElementById('semana-list');
    if (!weekTemplate.length) {
      el.innerHTML = `
        <div class="terr-empty">
          <span class="material-symbols-outlined" aria-hidden="true">calendar_month</span>
          <p class="text-sm font-semibold text-primary">Nenhuma linha no cronograma</p>
        </div>`;
    } else {
      el.innerHTML = `
        <div class="terr-sched-scroll" id="semana-sched-scroll">
          <div class="terr-sched-panel">
            <table class="terr-sched-table">
              <thead><tr>${schedHeaderRow()}</tr></thead>
              <tbody id="semana-table-body"></tbody>
            </table>
            <p id="semana-table-foot" class="terr-catalog-foot"></p>
          </div>
        </div>`;
      bindSchedFilters();
      renderSemanaTable();
      setupSchedColsMenu();
    }

    renderExtraDesignados();
    renderPriorityList();
    renderMeetingSpots();
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

  function catalogCoverageMetaForPreview(t, assignment, overrides = {}) {
    if (t.status === 'designado' && assignment) {
      const assignedIso = overrides.assigned_at
        ?? (assignment.assigned_at ? String(assignment.assigned_at).slice(0, 10) : null);
      const assignedLabel = assignedIso ? H().formatShortDate(assignedIso) : null;
      return {
        tone: 'working',
        barPct: 100,
        headline: 'Em campo',
        sub: assignedLabel ? `Designado em ${assignedLabel}` : 'Trabalho em andamento',
        title: assignedLabel ? `Designado em ${H().formatDisplayDate(assignedIso)}` : 'Território com designação ativa'
      };
    }

    const lastWorked = overrides.last_worked_at !== undefined ? overrides.last_worked_at : t.last_worked_at;
    const days = H().daysSince(lastWorked);
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

    const lastIso = String(lastWorked).slice(0, 10);
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

  function catalogCoverageCellFromMeta(m) {
    return `
      <span class="terr-catalog-cov terr-catalog-cov--${m.tone}" title="${escapeHtml(m.title)}">
        <span class="terr-catalog-cov__bar" aria-hidden="true"><span class="terr-catalog-cov__fill" style="width:${m.barPct}%"></span></span>
        <span class="terr-catalog-cov__text">
          <strong class="terr-catalog-cov__head">${escapeHtml(m.headline)}</strong>
          <span class="terr-catalog-cov__sub">${escapeHtml(m.sub)}</span>
        </span>
      </span>`;
  }

  function catalogCoverageMeta(t) {
    const active = assignmentByTerritoryId.get(t.id);
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
    return catalogCoverageCellFromMeta(catalogCoverageMeta(t));
  }

  function assigneeLabelContext(territoryId) {
    return { territoryId: territoryId || null, weekTemplate };
  }

  function catalogAssignee(t) {
    const active = assignmentByTerritoryId.get(t.id);
    if (!active) return '—';
    const pairLabel = H().domingoPairAssigneeLabel(t.num, active, profiles, assigneeLabelContext(t.id));
    return pairLabel || profileName(active.profiles);
  }

  function catalogModalDesigneeLabel(rawProfileId, t, assignment) {
    const pairNum = H().parseDomingoPairOptionValue(rawProfileId);
    if (pairNum) {
      const pair = H().domingoPairForTerritoryNum(pairNum);
      return pair?.dirigente_name || '—';
    }
    if (rawProfileId) {
      const terrPair = H().domingoPairForTerritoryNum(t?.num);
      if (terrPair && H().profileInDomingoPair(rawProfileId, terrPair.dirigente_name, profiles)) {
        return terrPair.dirigente_name;
      }
      const p = profiles.find((pr) => pr.id === rawProfileId)
        || overseers.find((o) => o.profile_id === rawProfileId)?.profiles;
      return profileName(p) || '—';
    }
    if (assignment) {
      const pairLabel = H().domingoPairAssigneeLabel(
        t?.num,
        assignment,
        profiles,
        assigneeLabelContext(t?.id || assignment.territory_id)
      );
      return pairLabel || profileName(assignment.profiles);
    }
    return '—';
  }

  function catalogModalSelectedDesignee(t, assignment) {
    const currentId = assignment?.profile_id || '';
    if (assignment?.is_domingo_pair) {
      for (const pair of H().listDomingoPairs()) {
        if (H().profileInDomingoPair(currentId, pair.dirigente_name, profiles)) {
          return { pairId: H().domingoPairOptionValue(pair.territory_num), profileId: '' };
        }
      }
    }
    const scheduledPair = H().pairNameFromSundaySchedule(t?.id, weekTemplate);
    if (scheduledPair && H().profileInDomingoPair(currentId, scheduledPair, profiles)) {
      const pairNum = H().domingoPairNumForDirigenteName(scheduledPair);
      if (pairNum) return { pairId: H().domingoPairOptionValue(pairNum), profileId: '' };
    }
    const terrPair = H().domingoPairForTerritoryNum(t?.num);
    if (terrPair && assignment && H().profileInDomingoPair(currentId, terrPair.dirigente_name, profiles)) {
      return { pairId: H().domingoPairOptionValue(t.num), profileId: '' };
    }
    return { pairId: '', profileId: currentId };
  }

  function catalogPairTerritoryId(pair) {
    return territories.find(
      (tr) => H().normalizeTerritoryNum(tr.num) === H().normalizeTerritoryNum(pair.territory_num)
    )?.id || null;
  }

  function resolveCatalogProfileId(rawProfileId, territoryId) {
    const pairNum = H().parseDomingoPairOptionValue(rawProfileId);
    if (pairNum) {
      const resolved = H().resolveProfileIdForDomingoPair(
        pairNum,
        territoryId,
        profiles,
        activeAssignments,
        null
      );
      if (!resolved) throw new Error('Não foi possível resolver a dupla selecionada.');
      return resolved;
    }
    return rawProfileId || null;
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
  const CATALOG_COVERAGE_OPTIONS = [
    { value: 'working', label: 'Em campo' },
    { value: 'fresh', label: 'Cobertura recente' },
    { value: 'warn', label: 'Atenção (14–27d)' },
    { value: 'critical', label: 'Crítico (28d+)' },
    { value: 'unknown', label: 'Sem registro' }
  ];
  const SCHED_SUGGESTION_OPTIONS = [
    { value: 'sim', label: 'Com sugestão' },
    { value: 'nao', label: 'Sem sugestão' }
  ];
  const OVER_PREF_OPTIONS = [
    { value: 'meio_de_semana', label: 'Meio de semana' },
    { value: 'final_de_semana', label: 'Final de semana' },
    { value: 'ambos', label: 'Ambos' }
  ];
  const OVER_STATUS_OPTIONS = [
    { value: 'active', label: 'Ativo' },
    { value: 'inactive', label: 'Inativo' }
  ];

  function xlfMapAllTrue(map) {
    return Object.fromEntries(Object.keys(map).map((k) => [k, true]));
  }

  function xlfAllSelected(map) {
    return Object.values(map).every(Boolean);
  }

  function xlfSelectedKeys(map) {
    return Object.entries(map).filter(([, on]) => on).map(([k]) => k);
  }

  function xlfIsActive(map) {
    return map && Object.keys(map).length > 0 && !xlfAllSelected(map);
  }

  function xlfEnsureKeys(map, keys) {
    keys.forEach((k) => {
      if (!(k in map)) map[k] = true;
    });
    Object.keys(map).forEach((k) => {
      if (!keys.includes(k)) delete map[k];
    });
    return map;
  }

  function xlfOptionsFromKeys(keys, labelFn) {
    return keys.map((k) => ({ value: k, label: labelFn ? labelFn(k) : k }));
  }

  function xlfApplyMapFilter(list, map, valueFn) {
    const total = Object.keys(map).length;
    const keys = xlfSelectedKeys(map);
    if (keys.length >= total) return list;
    if (!keys.length) return [];
    return list.filter((item) => keys.includes(String(valueFn(item))));
  }

  function xlfResetMenuPosition(menu) {
    if (!menu) return;
    menu.classList.remove('terr-xlf-menu--floating');
    menu.style.position = '';
    menu.style.top = '';
    menu.style.left = '';
    menu.style.right = '';
    menu.style.width = '';
    menu.style.visibility = '';
    menu.style.zIndex = '';
  }

  function xlfPositionMenu(btn, menu) {
    const margin = 8;
    const gap = 4;
    menu.classList.add('terr-xlf-menu--floating');
    menu.classList.remove('hidden');
    menu.style.visibility = 'hidden';

    requestAnimationFrame(() => {
      const btnRect = btn.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      let left = btnRect.right - menuRect.width;
      if (left < margin) left = margin;
      if (left + menuRect.width > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - menuRect.width - margin);
      }
      let top = btnRect.bottom + gap;
      if (top + menuRect.height > window.innerHeight - margin) {
        top = Math.max(margin, btnRect.top - menuRect.height - gap);
      }
      menu.style.position = 'fixed';
      menu.style.left = `${Math.round(left)}px`;
      menu.style.top = `${Math.round(top)}px`;
      menu.style.right = 'auto';
      menu.style.width = `${Math.round(menuRect.width)}px`;
      menu.style.zIndex = '1000';
      menu.style.visibility = '';
    });
  }

  function xlfCloseMenus(scope = null) {
    document.querySelectorAll('[data-xlf-menu]').forEach((menu) => {
      const menuScope = menu.closest('[data-xlf-scope]')?.dataset.xlfScope;
      if (scope && menuScope === scope) return;
      menu.classList.add('hidden');
      xlfResetMenuPosition(menu);
      const trigger = menu.closest('[data-xlf-scope]')?.querySelector(`[data-xlf-trigger="${menu.dataset.xlfMenu}"]`);
      trigger?.setAttribute('aria-expanded', 'false');
    });
  }

  function xlfUpdateFilterUI(root, filterState) {
    if (!root) return;
    Object.keys(filterState).forEach((filterKey) => {
      const map = filterState[filterKey];
      if (!map || typeof map !== 'object') return;
      const active = xlfIsActive(map);
      root.querySelectorAll(`[data-xlf-trigger="${filterKey}"]`).forEach((btn) => {
        btn.classList.toggle('terr-xlf-filter-btn--active', active);
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = active ? 'filter_alt' : 'filter_list';
      });
      root.querySelectorAll(`[data-xlf-filter="${filterKey}"]`).forEach((box) => {
        box.checked = !!map[box.value];
      });
      xlfSyncSelectAll(root, filterKey, map);
    });
  }

  function xlfSyncSelectAll(root, filterKey, map) {
    const selectAll = root.querySelector(`[data-xlf-select-all="${filterKey}"]`);
    const boxes = root.querySelectorAll(`[data-xlf-filter="${filterKey}"]`);
    if (!selectAll || !boxes.length) return;
    const checked = [...boxes].filter((b) => b.checked).length;
    selectAll.checked = checked === boxes.length;
    selectAll.indeterminate = checked > 0 && checked < boxes.length;
  }

  function xlfUpdateSortUI(root, sortAttr, sortState) {
    if (!root) return;
    root.querySelectorAll(`[data-${sortAttr}]`).forEach((btn) => {
      const col = btn.getAttribute(`data-${sortAttr}`);
      const isActive = sortState.col === col;
      btn.classList.toggle('terr-xlf-sort--active', isActive);
      btn.classList.toggle('terr-catalog-sort--active', isActive);
      btn.classList.toggle('terr-hist-sort--active', isActive);
      const icon = btn.querySelector('.terr-xlf-sort-icon, .terr-catalog-sort-icon, .terr-hist-sort-icon');
      if (icon) icon.textContent = isActive ? (sortState.dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more';
    });
  }

  function xlfColumnHeader(sortAttr, sortState, filterState, config) {
    const { col, label, filterKey, options, wrap = 'th', extraClass = '' } = config;
    const filterMap = filterState[filterKey];
    const active = xlfIsActive(filterMap);
    const sortActive = sortState.col === col;
    const sortIcon = sortActive ? (sortState.dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more';
    const checks = (options || []).map((o) => `
      <label class="terr-xlf-check">
        <input type="checkbox" data-xlf-filter="${filterKey}" value="${escapeHtml(String(o.value))}" ${filterMap[o.value] ? 'checked' : ''}>
        <span>${escapeHtml(o.label)}</span>
      </label>`).join('');
    const inner = `
      <div class="terr-xlf-head">
        <button type="button" class="terr-xlf-sort terr-catalog-sort terr-hist-sort${sortActive ? ' terr-xlf-sort--active terr-catalog-sort--active terr-hist-sort--active' : ''}" data-${sortAttr}="${col}">
          <span>${label}</span>
          <span class="material-symbols-outlined terr-xlf-sort-icon terr-catalog-sort-icon terr-hist-sort-icon" aria-hidden="true">${sortIcon}</span>
        </button>
        <div class="terr-xlf-filter">
          <button type="button" class="terr-xlf-filter-btn${active ? ' terr-xlf-filter-btn--active' : ''}" data-xlf-trigger="${filterKey}" aria-expanded="false" aria-haspopup="true" aria-label="Filtrar ${label}" title="Filtrar">
            <span class="material-symbols-outlined" aria-hidden="true">${active ? 'filter_alt' : 'filter_list'}</span>
          </button>
          <div class="terr-xlf-menu hidden" data-xlf-menu="${filterKey}" role="dialog" aria-label="Filtrar ${label}">
            <p class="terr-xlf-menu-title">${escapeHtml(label)}</p>
            <label class="terr-xlf-check terr-xlf-check--all">
              <input type="checkbox" data-xlf-select-all="${filterKey}" ${xlfAllSelected(filterMap) ? 'checked' : ''}>
              <span>(Selecionar tudo)</span>
            </label>
            <div class="terr-xlf-checks">${checks}</div>
            <div class="terr-xlf-menu-actions">
              <button type="button" class="terr-xlf-clear" data-xlf-clear="${filterKey}">Limpar filtro</button>
            </div>
          </div>
        </div>
      </div>`;
    if (wrap === 'th') return `<th scope="col" class="${extraClass}" data-sched-col="${col}">${inner}</th>`;
    return `<span class="terr-xlf-head-cell ${extraClass}" data-sched-col="${col}">${inner}</span>`;
  }

  function bindXlfPanel(root, sortAttr, filterState, sortState, onRefresh) {
    if (!root || root.dataset.xlfBound === '1') return;
    root.dataset.xlfBound = '1';

    root.querySelectorAll('[data-xlf-trigger]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.xlfTrigger;
        const menu = root.querySelector(`[data-xlf-menu="${key}"]`);
        if (!menu) return;
        const willOpen = menu.classList.contains('hidden');
        xlfCloseMenus();
        if (willOpen) {
          xlfPositionMenu(btn, menu);
          btn.setAttribute('aria-expanded', 'true');
          xlfUpdateFilterUI(root, filterState);
        }
      });
    });

    root.querySelectorAll('[data-xlf-select-all]').forEach((box) => {
      box.addEventListener('change', () => {
        const key = box.dataset.xlfSelectAll;
        const map = filterState[key];
        if (!map) return;
        Object.keys(map).forEach((k) => { map[k] = box.checked; });
        xlfUpdateFilterUI(root, filterState);
        onRefresh();
      });
    });

    root.querySelectorAll('[data-xlf-filter]').forEach((box) => {
      box.addEventListener('change', () => {
        const key = box.dataset.xlfFilter;
        if (!filterState[key]) return;
        filterState[key][box.value] = box.checked;
        xlfSyncSelectAll(root, key, filterState[key]);
        xlfUpdateFilterUI(root, filterState);
        onRefresh();
      });
    });

    root.querySelectorAll('[data-xlf-clear]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.xlfClear;
        if (!filterState[key]) return;
        filterState[key] = xlfMapAllTrue(filterState[key]);
        xlfUpdateFilterUI(root, filterState);
        onRefresh();
        xlfCloseMenus();
      });
    });

    root.querySelectorAll('.terr-xlf-menu').forEach((menu) => {
      menu.addEventListener('click', (e) => e.stopPropagation());
    });

    root.querySelectorAll(`[data-${sortAttr}]`).forEach((btn) => {
      btn.addEventListener('click', () => {
        const col = btn.getAttribute(`data-${sortAttr}`);
        if (sortState.col === col) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
        else {
          sortState.col = col;
          sortState.dir = (col === 'coverage' || col === 'date') ? 'desc' : 'asc';
        }
        xlfUpdateSortUI(root, sortAttr, sortState);
        onRefresh();
      });
    });

    if (!window.__JETerrXlfBound) {
      window.__JETerrXlfBound = true;
      document.addEventListener('click', () => xlfCloseMenus());
      document.addEventListener('scroll', (e) => {
        if (e.target instanceof Node && e.target.closest('[data-xlf-menu]:not(.hidden)')) return;
        xlfCloseMenus();
      }, true);
      window.addEventListener('resize', () => xlfCloseMenus());
    }
  }

  function syncCatalogFilterOptions() {
    xlfEnsureKeys(catalogFilter.num, territories.map((t) => String(t.num)).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b, 'pt-BR', { numeric: true })));
    xlfEnsureKeys(catalogFilter.name, [...new Set(territories.map((t) => t.display_name || '—'))].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })));
    xlfEnsureKeys(catalogFilter.assignee, [...new Set(territories.map((t) => catalogAssignee(t)))].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })));
    const sig = [catalogFilter.num, catalogFilter.name, catalogFilter.assignee]
      .map((m) => Object.keys(m).join('\0'))
      .join('::');
    const changed = sig !== catalogFilterSig;
    catalogFilterSig = sig;
    return changed;
  }

  function catalogCoverageTone(t) {
    return catalogCoverageMeta(t).tone;
  }

  function updateCatalogSortUI() {
    xlfUpdateSortUI(document.getElementById('catalogo-grid'), 'catalog-sort', catalogSort);
  }

  function updateCatalogFilterUI() {
    xlfUpdateFilterUI(document.getElementById('catalogo-grid'), catalogFilter);
  }

  function closeCatalogFilterMenus() {
    xlfCloseMenus();
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
    list = xlfApplyMapFilter(list, catalogFilter.num, (t) => String(t.num));
    list = xlfApplyMapFilter(list, catalogFilter.name, (t) => t.display_name || '—');
    list = xlfApplyMapFilter(list, catalogFilter.status, (t) => t.status);
    list = xlfApplyMapFilter(list, catalogFilter.type, (t) => t.territory_type);
    list = xlfApplyMapFilter(list, catalogFilter.assignee, (t) => catalogAssignee(t));
    list = xlfApplyMapFilter(list, catalogFilter.coverage, (t) => catalogCoverageTone(t));
    return getSortedCatalog(list);
  }

  function scheduleCatalogoTable(opts = {}) {
    clearTimeout(catalogTableTimer);
    catalogTableTimer = setTimeout(() => renderCatalogoTable(opts), 100);
  }

  function bindCatalogFilters() {
    const grid = document.getElementById('catalogo-grid');
    if (!grid) return;
    grid.dataset.xlfScope = 'catalog';
    if (!grid.dataset.catalogSearchBound) {
      grid.dataset.catalogSearchBound = '1';
      grid.addEventListener('input', (e) => {
        if (e.target.id !== 'catalog-search') return;
        catalogFilter.q = e.target.value;
        scheduleCatalogoTable();
      });
    }
    const search = grid.querySelector('#catalog-search');
    if (search && search.value !== catalogFilter.q) search.value = catalogFilter.q;
    delete grid.dataset.xlfBound;
    bindXlfPanel(grid, 'catalog-sort', catalogFilter, catalogSort, () => renderCatalogoTable({ updateUi: true }));
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

  function renderCatalogoTable(opts = {}) {
    const { updateUi = false, updateStats = false } = opts;
    const listEl = document.getElementById('catalogo-table-body');
    const footEl = document.getElementById('catalogo-foot');
    if (!listEl) return;

    if (updateUi) {
      updateCatalogSortUI();
      updateCatalogFilterUI();
    }
    const filtered = getFilteredCatalog();
    if (updateStats) updateCatalogStats();

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
          <button type="button" data-edit-catalog-row="${t.id}" class="terr-sched-icon-btn" title="Editar registro">
            <span class="material-symbols-outlined" aria-hidden="true">edit</span>
          </button>
        </td>
      </tr>`;
    }).join('');

    if (footEl) {
      const parts = [];
      if (catalogFilter.q.trim()) parts.push('busca');
      Object.entries(catalogFilter).forEach(([key, map]) => {
        if (key === 'q' || typeof map !== 'object') return;
        if (xlfIsActive(map)) parts.push(key);
      });
      const filterNote = parts.length ? ` · filtro: ${parts.join(', ')}` : '';
      const suffix = filtered.length < territories.length ? ` (${territories.length} no total)` : '';
      footEl.textContent = `Exibindo ${filtered.length} território${filtered.length === 1 ? '' : 's'}${suffix}${filterNote}`;
    }
  }

  function catalogHeaderRow() {
    syncCatalogFilterOptions();
    const numOpts = xlfOptionsFromKeys(Object.keys(catalogFilter.num), (k) => `T${k}`);
    const nameOpts = xlfOptionsFromKeys(Object.keys(catalogFilter.name));
    const assigneeOpts = xlfOptionsFromKeys(Object.keys(catalogFilter.assignee));
    return `
      ${xlfColumnHeader('catalog-sort', catalogSort, catalogFilter, { col: 'num', label: 'ID', filterKey: 'num', options: numOpts })}
      ${xlfColumnHeader('catalog-sort', catalogSort, catalogFilter, { col: 'name', label: 'Território', filterKey: 'name', options: nameOpts })}
      ${xlfColumnHeader('catalog-sort', catalogSort, catalogFilter, { col: 'type', label: 'Tipo', filterKey: 'type', options: CATALOG_TYPE_OPTIONS })}
      ${xlfColumnHeader('catalog-sort', catalogSort, catalogFilter, { col: 'status', label: 'Status', filterKey: 'status', options: CATALOG_STATUS_OPTIONS })}
      ${xlfColumnHeader('catalog-sort', catalogSort, catalogFilter, { col: 'assignee', label: 'Designado', filterKey: 'assignee', options: assigneeOpts })}
      ${xlfColumnHeader('catalog-sort', catalogSort, catalogFilter, { col: 'coverage', label: 'Cobertura', filterKey: 'coverage', options: CATALOG_COVERAGE_OPTIONS })}
      <th scope="col" class="terr-catalog-actions" aria-label="Ações"></th>`;
  }

  function updateCatalogToolbarMeta() {
    const grid = document.getElementById('catalogo-grid');
    const p = grid?.querySelector('.terr-catalog-toolbar p');
    if (!p) return;
    const { avgDays } = territorySummaryMetrics();
    p.textContent = `Mapas, status e cobertura · ${territories.length} territórios${avgDays !== null ? ` · média ${avgDays}d sem cobertura` : ''}`;
  }

  function refreshCatalogoView() {
    const grid = document.getElementById('catalogo-grid');
    if (!grid || !document.getElementById('catalogo-table-body')) {
      renderCatalogo();
      return;
    }
    updateCatalogToolbarMeta();
    const filtersChanged = syncCatalogFilterOptions();
    if (filtersChanged) {
      const tr = grid.querySelector('thead tr');
      if (tr) tr.innerHTML = catalogHeaderRow();
      delete grid.dataset.xlfBound;
      bindXlfPanel(grid, 'catalog-sort', catalogFilter, catalogSort, () => renderCatalogoTable({ updateUi: true, updateStats: true }));
    }
    renderCatalogoTable({ updateUi: filtersChanged, updateStats: true });
  }

  function renderCatalogo() {
    const grid = document.getElementById('catalogo-grid');
    if (!grid) return;
    if (document.getElementById('catalogo-table-body')) {
      refreshCatalogoView();
      return;
    }
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
              <tr>${catalogHeaderRow()}</tr>
            </thead>
            <tbody id="catalogo-table-body"></tbody>
          </table>
          <p id="catalogo-foot" class="terr-catalog-foot"></p>
        </div>
      </div>`;

    bindCatalogFilters();
    renderCatalogoTable({ updateUi: true, updateStats: true });
    initTerrColResize('catalog');
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

  const HIST_EVENT_FILTERS = ['', 'designacao', 'devolucao', 'edicao', 'cronograma', 'status', 'trabalho'];

  function histEventFilterLabel(type) {
    if (!type) return 'Todos';
    return EVENT_LABELS[type] || type;
  }

  function syncHistFilterOptions() {
    const dates = [...new Set(history.map((h) => String(h.event_date).slice(0, 10)))].sort().reverse();
    xlfEnsureKeys(histFilter.date, dates);
    xlfEnsureKeys(
      histFilter.day,
      [...new Set(history.map((h) => historyWeekday(h)))].sort((a, b) => (WEEKDAY_ORDER[a] || 99) - (WEEKDAY_ORDER[b] || 99))
    );
    xlfEnsureKeys(
      histFilter.dirigente,
      [...new Set(history.map((h) => historyDirigente(h)))].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
    );
    xlfEnsureKeys(
      histFilter.territorio,
      [...new Set(history.map((h) => historyTerritory(h)))].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
    );
    xlfEnsureKeys(
      histFilter.eventType,
      [...new Set(history.map((h) => h.event_type || 'default'))].sort((a, b) => histEventFilterLabel(a).localeCompare(histEventFilterLabel(b), 'pt-BR', { sensitivity: 'base' }))
    );
    const sig = [histFilter.date, histFilter.day, histFilter.dirigente, histFilter.territorio, histFilter.eventType]
      .map((m) => Object.keys(m).join('\0'))
      .join('::');
    const changed = sig !== histFilterSig;
    histFilterSig = sig;
    return changed;
  }

  function histHeaderRow() {
    syncHistFilterOptions();
    const dateOpts = xlfOptionsFromKeys(Object.keys(histFilter.date), (k) => H().formatShortDate(k));
    const dayOpts = xlfOptionsFromKeys(Object.keys(histFilter.day));
    const dirOpts = xlfOptionsFromKeys(Object.keys(histFilter.dirigente));
    const terrOpts = xlfOptionsFromKeys(Object.keys(histFilter.territorio));
    const eventOpts = xlfOptionsFromKeys(Object.keys(histFilter.eventType), (k) => histEventFilterLabel(k));
    return `
      ${xlfColumnHeader('hist-sort', histSort, histFilter, { col: 'date', label: 'Data', filterKey: 'date', options: dateOpts, wrap: 'span' })}
      ${xlfColumnHeader('hist-sort', histSort, histFilter, { col: 'day', label: 'Dia', filterKey: 'day', options: dayOpts, wrap: 'span' })}
      ${xlfColumnHeader('hist-sort', histSort, histFilter, { col: 'dirigente', label: 'Dirigente', filterKey: 'dirigente', options: dirOpts, wrap: 'span' })}
      ${xlfColumnHeader('hist-sort', histSort, histFilter, { col: 'territorio', label: 'Território', filterKey: 'territorio', options: terrOpts, wrap: 'span' })}
      ${xlfColumnHeader('hist-sort', histSort, histFilter, { col: 'obs', label: 'Observações', filterKey: 'eventType', options: eventOpts, wrap: 'span' })}
      <span class="terr-xlf-head-cell terr-xlf-head-cell--actions" aria-hidden="true"></span>`;
  }

  function updateHistSortUI() {
    xlfUpdateSortUI(document.getElementById('historico-grid'), 'hist-sort', histSort);
  }

  function updateHistFilterUI() {
    xlfUpdateFilterUI(document.getElementById('historico-grid'), histFilter);
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
    list = xlfApplyMapFilter(list, histFilter.date, (h) => String(h.event_date).slice(0, 10));
    list = xlfApplyMapFilter(list, histFilter.day, (h) => historyWeekday(h));
    list = xlfApplyMapFilter(list, histFilter.dirigente, (h) => historyDirigente(h));
    list = xlfApplyMapFilter(list, histFilter.territorio, (h) => historyTerritory(h));
    list = xlfApplyMapFilter(list, histFilter.eventType, (h) => h.event_type || 'default');
    return getSortedHistory(list);
  }

  function scheduleHistoricoTable(opts = {}) {
    clearTimeout(histTableTimer);
    histTableTimer = setTimeout(() => renderHistoricoTable(opts), 100);
  }

  function bindHistoricoFilters() {
    const grid = document.getElementById('historico-grid');
    if (!grid) return;
    grid.dataset.xlfScope = 'hist';
    if (!grid.dataset.histSearchBound) {
      grid.dataset.histSearchBound = '1';
      grid.addEventListener('input', (e) => {
        if (e.target.id !== 'hist-search') return;
        histFilter.q = e.target.value;
        scheduleHistoricoTable();
      });
    }
    const search = grid.querySelector('#hist-search');
    if (search && search.value !== histFilter.q) search.value = histFilter.q;
    delete grid.dataset.xlfBound;
    bindXlfPanel(grid, 'hist-sort', histFilter, histSort, () => renderHistoricoTable({ updateUi: true }));
  }

  function renderHistoricoTable(opts = {}) {
    const { updateUi = false } = opts;
    const listEl = document.getElementById('historico-table-body');
    const footEl = document.getElementById('historico-foot');
    if (!listEl) return;

    if (updateUi) {
      updateHistSortUI();
      updateHistFilterUI();
    }
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
        <div class="terr-hist-actions">
          <button type="button" data-del-history="${h.id}" class="terr-sched-icon-btn terr-sched-icon-btn--del" title="Excluir registro">
            <span class="material-symbols-outlined" aria-hidden="true">delete</span>
          </button>
        </div>
      </div>`;
    }).join('');

    if (footEl) {
      const parts = [];
      if (histFilter.q.trim()) parts.push('busca');
      Object.entries(histFilter).forEach(([key, map]) => {
        if (key === 'q' || typeof map !== 'object') return;
        if (xlfIsActive(map)) parts.push(key);
      });
      const filterNote = parts.length ? ` · filtro: ${parts.join(', ')}` : '';
      const suffix = filtered.length < history.length ? ` (${history.length} no total)` : '';
      footEl.textContent = `Exibindo ${filtered.length} registro${filtered.length === 1 ? '' : 's'}${suffix}${filterNote}`;
    }
  }

  function refreshHistoricoView() {
    const grid = document.getElementById('historico-grid');
    if (!grid) return;
    if (!history.length) {
      if (document.getElementById('historico-table-body') || !grid.querySelector('.terr-empty')) renderHistorico();
      return;
    }
    if (!document.getElementById('historico-table-body')) {
      renderHistorico();
      return;
    }
    const toolbarP = grid.querySelector('.terr-hist-toolbar p');
    if (toolbarP) toolbarP.textContent = `${history.length} registro${history.length === 1 ? '' : 's'}`;
    const filtersChanged = syncHistFilterOptions();
    if (filtersChanged) {
      const head = grid.querySelector('.terr-hist-row--head');
      if (head) head.innerHTML = histHeaderRow();
      delete grid.dataset.xlfBound;
      bindHistoricoFilters();
    }
    renderHistoricoTable({ updateUi: filtersChanged });
  }

  function entryTerrName(entry) {
    const label = entry.metadata?.territory_label || '';
    return label.replace(/^T?\d+\s*[-–—]?\s*/i, '').trim() || label;
  }

  function renderHistorico() {
    const grid = document.getElementById('historico-grid');
    if (document.getElementById('historico-table-body') && history.length) {
      refreshHistoricoView();
      return;
    }
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
      </div>
      <div class="terr-hist-scroll">
        <div class="terr-hist-panel">
          <div class="terr-hist-row terr-hist-row--head">${histHeaderRow()}</div>
          <div id="historico-table-body"></div>
          <p id="historico-foot" class="terr-hist-foot"></p>
        </div>
      </div>`;

    bindHistoricoFilters();
    renderHistoricoTable({ updateUi: true });
    initTerrColResize('hist');
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

  function overDaySortKey(overseer) {
    const days = H().overseerDays(overseer);
    if (days.length >= H().CRONOGRAMA_DAYS.length) return '0';
    return days.map((d) => String(WEEKDAY_ORDER[d] || 99).padStart(2, '0')).join(',');
  }

  function overMatchesDayFilter(overseer) {
    if (xlfAllSelected(overFilter.days)) return true;
    const selected = xlfSelectedKeys(overFilter.days);
    if (!selected.length) return false;
    const days = H().overseerDays(overseer);
    if (days.length >= H().CRONOGRAMA_DAYS.length) return selected.includes('__all__');
    return days.some((d) => selected.includes(d));
  }

  function syncOverFilterOptions() {
    xlfEnsureKeys(
      overFilter.name,
      [...new Set(overseers.map((o) => profileName(o.profiles)))].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
    );
    const dayKeys = new Set();
    overseers.forEach((o) => {
      const days = H().overseerDays(o);
      if (days.length >= H().CRONOGRAMA_DAYS.length) dayKeys.add('__all__');
      else days.forEach((d) => dayKeys.add(d));
    });
    const sortedDays = [...dayKeys].sort((a, b) => {
      if (a === '__all__') return -1;
      if (b === '__all__') return 1;
      return (WEEKDAY_ORDER[a] || 99) - (WEEKDAY_ORDER[b] || 99);
    });
    xlfEnsureKeys(overFilter.days, sortedDays);
    const sig = [overFilter.name, overFilter.days]
      .map((m) => Object.keys(m).join('\0'))
      .join('::');
    const changed = sig !== overFilterSig;
    overFilterSig = sig;
    return changed;
  }

  function getSortedOverseers(list) {
    const { col, dir } = overSort;
    const mul = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (col) {
        case 'name':
          cmp = profileName(a.profiles).localeCompare(profileName(b.profiles), 'pt-BR', { sensitivity: 'base' });
          break;
        case 'preference':
          cmp = preferenceMeta(a.preference).label.localeCompare(preferenceMeta(b.preference).label, 'pt-BR', { sensitivity: 'base' });
          break;
        case 'days':
          cmp = overDaySortKey(a).localeCompare(overDaySortKey(b));
          break;
        case 'status':
          cmp = Number(a.is_active !== false) - Number(b.is_active !== false);
          break;
        default:
          cmp = profileName(a.profiles).localeCompare(profileName(b.profiles), 'pt-BR', { sensitivity: 'base' });
      }
      return cmp * mul;
    });
  }

  function getFilteredOverseers() {
    let list = overseers;
    list = xlfApplyMapFilter(list, overFilter.name, (o) => profileName(o.profiles));
    list = xlfApplyMapFilter(list, overFilter.preference, (o) => o.preference || 'meio_de_semana');
    list = xlfApplyMapFilter(list, overFilter.status, (o) => (o.is_active !== false ? 'active' : 'inactive'));
    if (xlfIsActive(overFilter.days)) list = list.filter((o) => overMatchesDayFilter(o));
    return getSortedOverseers(list);
  }

  function overHeaderRow() {
    syncOverFilterOptions();
    const nameOpts = xlfOptionsFromKeys(Object.keys(overFilter.name));
    const dayOpts = xlfOptionsFromKeys(Object.keys(overFilter.days), (k) => (k === '__all__' ? 'Todos os dias' : k));
    return `
      ${xlfColumnHeader('over-sort', overSort, overFilter, { col: 'name', label: 'Dirigente', filterKey: 'name', options: nameOpts, wrap: 'span' })}
      ${xlfColumnHeader('over-sort', overSort, overFilter, { col: 'preference', label: 'Preferência', filterKey: 'preference', options: OVER_PREF_OPTIONS, wrap: 'span' })}
      ${xlfColumnHeader('over-sort', overSort, overFilter, { col: 'days', label: 'Dias', filterKey: 'days', options: dayOpts, wrap: 'span' })}
      ${xlfColumnHeader('over-sort', overSort, overFilter, { col: 'status', label: 'Status', filterKey: 'status', options: OVER_STATUS_OPTIONS, wrap: 'span' })}
      <span class="terr-xlf-head-cell terr-xlf-head-cell--actions" aria-hidden="true"></span>`;
  }

  function bindOverFilters() {
    const list = document.getElementById('dirigentes-list');
    if (!list) return;
    const scroll = list.querySelector('.terr-over-scroll');
    if (!scroll) return;
    scroll.dataset.xlfScope = 'over';
    delete scroll.dataset.xlfBound;
    bindXlfPanel(scroll, 'over-sort', overFilter, overSort, () => renderDirigentesTable({ updateUi: true }));
  }

  function renderDirigentesTable(opts = {}) {
    const { updateUi = false } = opts;
    const el = document.getElementById('dirigentes-list');
    const body = document.getElementById('dirigentes-table-body');
    const foot = document.getElementById('dirigentes-table-foot');
    if (!el || !body) return;

    const activeOverseers = overseers.filter((o) => o.is_active !== false);
    const countEl = document.getElementById('dirigentes-count');
    const statTotal = document.getElementById('dirigentes-stat-total');
    const statActive = document.getElementById('dirigentes-stat-active');

    if (countEl) countEl.textContent = `${overseers.length} cadastrados`;
    if (statTotal) statTotal.textContent = String(overseers.length);
    if (statActive) statActive.textContent = String(activeOverseers.length);

    if (updateUi) {
      xlfUpdateSortUI(el.querySelector('.terr-over-scroll'), 'over-sort', overSort);
      xlfUpdateFilterUI(el.querySelector('.terr-over-scroll'), overFilter);
    }
    const filtered = getFilteredOverseers();

    if (!filtered.length) {
      body.innerHTML = `
        <div class="terr-empty !border-0 !rounded-none">
          <span class="material-symbols-outlined" aria-hidden="true">search_off</span>
          <p class="text-sm">${overseers.length ? 'Nenhum dirigente corresponde ao filtro.' : 'Nenhum dirigente cadastrado.'}</p>
        </div>`;
      if (foot) foot.textContent = '';
      return;
    }

    body.innerHTML = filtered.map((o) => {
      const pref = preferenceMeta(o.preference);
      const isActive = o.is_active !== false;
      const statusHtml = isActive
        ? '<span class="terr-over-status terr-over-status--active">Ativo</span>'
        : '<span class="terr-over-status terr-over-status--inactive">Inativo</span>';
      return `
      <div class="terr-over-row" title="${escapeHtml(profileName(o.profiles))}">
        <span class="terr-over-name">
          ${overseerAvatarHtml(o)}
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
    }).join('');

    if (foot) {
      const activeFilters = Object.entries(overFilter).filter(([, map]) => xlfIsActive(map)).length;
      const filterNote = activeFilters ? ` · ${activeFilters} filtro${activeFilters === 1 ? '' : 's'} ativo${activeFilters === 1 ? '' : 's'}` : '';
      const suffix = filtered.length < overseers.length ? ` (${overseers.length} no total)` : '';
      foot.textContent = `Exibindo ${filtered.length} dirigente${filtered.length === 1 ? '' : 's'}${suffix}${filterNote}`;
    }
  }

  function refreshDirigentesView() {
    const el = document.getElementById('dirigentes-list');
    if (!el) return;
    if (!overseers.length) {
      if (document.getElementById('dirigentes-table-body') || !el.querySelector('.terr-empty')) renderDirigentes();
      return;
    }
    if (!document.getElementById('dirigentes-table-body')) {
      renderDirigentes();
      return;
    }
    const filtersChanged = syncOverFilterOptions();
    if (filtersChanged) {
      const head = el.querySelector('.terr-over-row--head');
      if (head) head.innerHTML = overHeaderRow();
      const scroll = el.querySelector('.terr-over-scroll');
      if (scroll) {
        delete scroll.dataset.xlfBound;
        bindOverFilters();
      }
    }
    renderDirigentesTable({ updateUi: filtersChanged });
  }

  function renderDirigentes() {
    const el = document.getElementById('dirigentes-list');
    if (document.getElementById('dirigentes-table-body') && overseers.length) {
      refreshDirigentesView();
      return;
    }
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
          <div class="terr-over-row terr-over-row--head">${overHeaderRow()}</div>
          <div id="dirigentes-table-body"></div>
          <p id="dirigentes-table-foot" class="terr-hist-foot"></p>
        </div>
      </div>`;

    bindOverFilters();
    renderDirigentesTable({ updateUi: true });
    initTerrColResize('over');
  }

  function catalogModalPairOptions(territoryId, selectedPairId, currentProfileId) {
    return H().listDomingoPairs()
      .map((pair) => {
        const value = H().domingoPairOptionValue(pair.territory_num);
        const homeTerritoryId = catalogPairTerritoryId(pair);
        const selectable = H().domingoPairSelectable(
          pair,
          territoryId,
          activeAssignments,
          profiles,
          currentProfileId,
          homeTerritoryId
        );
        const selected = selectedPairId === value;
        return `<option value="${escapeHtml(value)}" ${selected ? 'selected' : ''}${!selectable && !selected ? ' disabled' : ''}>${escapeHtml(pair.dirigente_name)}${!selectable && !selected ? ' (ocupado)' : ''}</option>`;
      })
      .join('');
  }

  function catalogModalIndividualOptions(territoryId, selectedProfileId) {
    const busyElsewhere = new Set(
      activeAssignments
        .filter((a) => a.territory_id !== territoryId && H().assignmentBlocksIndividualDesignation(a, profiles))
        .map((a) => a.profile_id)
    );
    return overseers
      .filter((o) => o.is_active !== false)
      .map((o) => {
        const p = profiles.find((pr) => pr.id === o.profile_id) || o.profiles;
        const disabled = busyElsewhere.has(o.profile_id) && o.profile_id !== selectedProfileId;
        return `<option value="${o.profile_id}" ${o.profile_id === selectedProfileId ? 'selected' : ''}${disabled ? ' disabled' : ''}>${escapeHtml(profileName(p))}${disabled ? ' (ocupado)' : ''}</option>`;
      })
      .join('');
  }

  function renderCatalogModalLiveRowHtml(form, t, assignment) {
    const fd = new FormData(form);
    const status = fd.get('status');
    const isDesignado = status === 'designado';
    const statusClass = isDesignado ? 'designado' : 'disponivel';
    const designeeRaw = fd.get('pair_id') || fd.get('profile_id');
    let assignee = '—';
    if (isDesignado) {
      assignee = catalogModalDesigneeLabel(designeeRaw, t, assignment);
    }
    const coverageDate = fd.get('coverage_date') || null;
    const previewT = { ...t, status: isDesignado ? 'designado' : 'disponivel' };
    let previewAssignment = null;
    if (isDesignado) {
      const resolvedId = H().parseDomingoPairOptionValue(designeeRaw)
        ? H().resolveProfileIdForDomingoPair(
          H().parseDomingoPairOptionValue(designeeRaw),
          t.id,
          profiles,
          activeAssignments,
          assignment?.profile_id || null
        )
        : designeeRaw;
      previewAssignment = assignment && assignment.profile_id === resolvedId
        ? { ...assignment, assigned_at: coverageDate || assignment.assigned_at }
        : resolvedId
          ? {
              assigned_at: coverageDate || H().toISODate(new Date()),
              profiles: profiles.find((p) => p.id === resolvedId)
                || overseers.find((o) => o.profile_id === resolvedId)?.profiles
            }
          : assignment || null;
    }
    const overrides = isDesignado
      ? { assigned_at: coverageDate }
      : { last_worked_at: coverageDate };
    const cov = catalogCoverageMetaForPreview(previewT, previewAssignment, overrides);
    return `
      <div class="terr-catalog-modal__live-row">
        <span class="terr-catalog-status terr-catalog-status--${statusClass}">${escapeHtml(STATUS_LABELS[status] || status)}</span>
        <span class="terr-catalog-modal__live-assign${assignee === '—' ? ' terr-catalog-modal__live-assign--muted' : ''}">${escapeHtml(assignee)}</span>
        ${catalogCoverageCellFromMeta(cov)}
      </div>`;
  }

  function syncCatalogModalUi(form, t, assignment) {
    if (!form) return;
    const status = form.querySelector('[name="status"]')?.value;
    const isDesignado = status === 'designado';
    const pairSel = form.querySelector('[name="pair_id"]');
    const profileSel = form.querySelector('[name="profile_id"]');
    const covLabel = form.querySelector('#catalog-modal-cov-label');
    const covHint = form.querySelector('#catalog-modal-cov-hint');
    const liveRow = form.querySelector('#catalog-modal-live-row');

    if (pairSel) pairSel.disabled = !isDesignado;
    if (profileSel) {
      profileSel.disabled = !isDesignado;
      profileSel.required = isDesignado && !pairSel?.value;
    }
    if (pairSel) pairSel.required = isDesignado && !profileSel?.value;
    if (covLabel) {
      covLabel.textContent = isDesignado ? 'Data da designação' : 'Último dia trabalhado';
    }
    if (covHint) {
      covHint.textContent = isDesignado
        ? 'Define quando o território entrou em campo.'
        : 'Dias sem cobertura são calculados a partir desta data.';
    }
    if (liveRow) {
      liveRow.innerHTML = renderCatalogModalLiveRowHtml(form, t, assignment);
    }
  }

  async function saveCatalogRowChanges(t, assignment, fd) {
    const newStatus = fd.get('status');
    const profileId = resolveCatalogProfileId(fd.get('pair_id') || fd.get('profile_id'), t.id);
    const coverageDate = fd.get('coverage_date') || null;
    const observations = fd.get('observations')?.trim() || null;
    const wasDesignado = t.status === 'designado' && assignment;
    const orphanDesignado = t.status === 'designado' && !assignment;

    if (newStatus === 'designado') {
      if (!profileId) throw new Error('Selecione o designado.');
      const assignedAt = coverageDate || H().toISODate(new Date());
      const isDomingoPair = Boolean(H().parseDomingoPairOptionValue(fd.get('pair_id')));

      if (wasDesignado) {
        const profileChanged = assignment.profile_id !== profileId;
        if (profileChanged) {
          const busy = activeAssignments.find(
            (a) => a.profile_id === profileId
              && a.territory_id !== t.id
              && H().assignmentBlocksIndividualDesignation(a, profiles)
          );
          if (busy) throw new Error('Este dirigente já possui um território ativo.');
          const { error } = await client
            .from('territory_active_assignments')
            .update({ profile_id: profileId, assigned_at: assignedAt })
            .eq('id', assignment.id);
          if (error) throw error;
        } else {
          const { error } = await client
            .from('territory_active_assignments')
            .update({ assigned_at: assignedAt })
            .eq('id', assignment.id);
          if (error) throw error;
        }
        const { error: terrErr } = await client
          .from('territories')
          .update({ observations })
          .eq('id', t.id);
        if (terrErr) throw terrErr;
      } else {
        const { error } = await client.rpc('assign_territory_field', {
          p_territory_id: t.id,
          p_profile_id: profileId,
          p_assigned_at: assignedAt,
          p_is_domingo_pair: isDomingoPair
        });
        if (error) throw error;
        if (observations) {
          const { error: terrErr } = await client
            .from('territories')
            .update({ observations })
            .eq('id', t.id);
          if (terrErr) throw terrErr;
        }
      }
      if (!isDomingoPair) {
        await syncScheduleRowsForAssignment(profileId, t.id);
      } else {
        const pairNum = H().parseDomingoPairOptionValue(fd.get('pair_id'));
        const pair = H().domingoPairForTerritoryNum(pairNum);
        if (pair?.dirigente_name) {
          await syncScheduleRowsForDomingoPair(pair.dirigente_name, t.id);
        }
      }
      return;
    }

    if (wasDesignado) {
      const { error } = await client.rpc('return_territory_field', {
        p_assignment_id: assignment.id,
        p_work_date: coverageDate || H().toISODate(new Date()),
        p_notes: observations
      });
      if (error) throw error;
      return;
    }

    if (orphanDesignado) {
      const { error } = await client
        .from('territories')
        .update({
          status: 'disponivel',
          observations,
          last_worked_at: coverageDate || null
        })
        .eq('id', t.id);
      if (error) throw error;
      return;
    }

    const { error } = await client
      .from('territories')
      .update({
        observations,
        last_worked_at: coverageDate || null
      })
      .eq('id', t.id);
    if (error) throw error;
  }

  function catalogStreetInfoBlock(t) {
    const api = window.JETerritoryStreets;
    const entry = api?.byNum(t?.num);
    if (!entry?.streets?.length) return '';

    const items = entry.streets.map((s) => `<li>${escapeHtml(s)}</li>`).join('');
    const notes = entry.notes
      ? `<p class="terr-catalog-modal__street-notes">${escapeHtml(entry.notes)}</p>`
      : '';
    const href = api.mapsUrl(t.num);
    const mapsLink = href
      ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="terr-catalog-modal__maps-link"><span class="material-symbols-outlined" aria-hidden="true">map</span>Google Maps</a>`
      : '';

    return `
      <div class="terr-catalog-modal-field terr-catalog-modal-field--streets">
        <span class="terr-catalog-modal-field__label"><span class="material-symbols-outlined" aria-hidden="true">info</span>Informações adicionais</span>
        <ul class="terr-catalog-modal__street-list">${items}</ul>
        ${notes}
        ${mapsLink}
      </div>`;
  }

  function openCatalogRowModal(t) {
    if (!t) return;
    if (document.getElementById('catalog-row-modal-wrap')) return;

    const open = () => openCatalogRowModalInner(t);
    if (!profiles.length || !overseers.length) {
      ensureCatalogModalData()
        .then(open)
        .catch((err) => {
          console.error('Catalog modal:', err);
          if (toast) showToast(toast, err.message || 'Erro ao carregar dados do modal.', true);
        });
      return;
    }
    open();
  }

  function openCatalogRowModalInner(t) {
    if (!t) return;
    if (document.getElementById('catalog-row-modal-wrap')) return;

    const assignment = assignmentByTerritoryId.get(t.id);
    const isDesignado = t.status === 'designado';
    const assignedIso = assignment?.assigned_at ? String(assignment.assigned_at).slice(0, 10) : H().toISODate(new Date());
    const lastWorkedIso = t.last_worked_at ? String(t.last_worked_at).slice(0, 10) : '';
    const coverageIso = isDesignado ? assignedIso : lastWorkedIso;
    const { pairId: selectedPair, profileId: selectedProfile } = catalogModalSelectedDesignee(t, assignment);

    const wrap = document.createElement('div');
    wrap.id = 'catalog-row-modal-wrap';
    wrap.className = 'terr-catalog-modal';
    wrap.innerHTML = `
      <div class="terr-catalog-modal__panel" role="dialog" aria-modal="true" aria-labelledby="catalog-row-modal-title">
        <div class="terr-catalog-modal__hero">
          <button type="button" data-cancel class="terr-catalog-modal__close" aria-label="Fechar">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
          <p class="terr-catalog-modal__kicker">Painel de territórios</p>
          <h3 id="catalog-row-modal-title">Editar registro</h3>
          <p class="terr-catalog-modal__subtitle">T${escapeHtml(t.num)} · ${escapeHtml(t.display_name)}</p>
        </div>
        <form id="catalog-row-modal-form">
          <div class="terr-catalog-modal__body">
            <div class="terr-catalog-modal__context">
              <span class="terr-catalog-num">${escapeHtml(t.num)}</span>
              <div class="terr-catalog-modal__context-main">
                <span class="terr-catalog-modal__context-name">${escapeHtml(H().territoryLabel(t))}</span>
                ${catalogTypeCell(t)}
              </div>
            </div>
            <p class="terr-catalog-modal__section-label">Prévia da linha</p>
            <div id="catalog-modal-live-row" class="terr-catalog-modal__live-wrap"></div>
            <div class="terr-catalog-modal__edit-grid">
              <label class="terr-catalog-modal-field">
                <span class="terr-catalog-modal-field__label"><span class="material-symbols-outlined" aria-hidden="true">flag</span>Status</span>
                <select name="status" class="terr-catalog-modal-input terr-catalog-modal-input--status" aria-label="Status">
                  <option value="disponivel" ${!isDesignado ? 'selected' : ''}>Disponível</option>
                  <option value="designado" ${isDesignado ? 'selected' : ''}>Designado</option>
                </select>
              </label>
              <label class="terr-catalog-modal-field">
                <span class="terr-catalog-modal-field__label"><span class="material-symbols-outlined" aria-hidden="true">groups</span>Dupla (domingo)</span>
                <select name="pair_id" class="terr-catalog-modal-input" aria-label="Dupla" ${!isDesignado ? 'disabled' : ''}>
                  <option value="">— Nenhuma —</option>
                  ${catalogModalPairOptions(t.id, selectedPair, selectedProfile)}
                </select>
              </label>
              <label class="terr-catalog-modal-field">
                <span class="terr-catalog-modal-field__label"><span class="material-symbols-outlined" aria-hidden="true">person</span>Dirigente</span>
                <select name="profile_id" class="terr-catalog-modal-input" aria-label="Dirigente" ${!isDesignado ? 'disabled' : ''}>
                  <option value="">— Selecione —</option>
                  ${catalogModalIndividualOptions(t.id, selectedProfile)}
                </select>
              </label>
              <div class="terr-catalog-modal-field terr-catalog-modal-field--cov">
                <span class="terr-catalog-modal-field__label"><span class="material-symbols-outlined" aria-hidden="true">schedule</span><span id="catalog-modal-cov-label">${isDesignado ? 'Data da designação' : 'Último dia trabalhado'}</span></span>
                <input name="coverage_date" type="date" value="${escapeHtml(coverageIso)}" class="terr-catalog-modal-input terr-catalog-modal-input--date"/>
                <p id="catalog-modal-cov-hint" class="terr-catalog-modal__cov-hint">${isDesignado ? 'Define quando o território entrou em campo.' : 'Dias sem cobertura são calculados a partir desta data.'}</p>
              </div>
            </div>
            ${catalogStreetInfoBlock(t)}
            <label class="terr-catalog-modal-field">
              <span class="terr-catalog-modal-field__label"><span class="material-symbols-outlined" aria-hidden="true">notes</span>Observações</span>
              <textarea name="observations" rows="2" class="terr-catalog-modal-input terr-catalog-modal-input--area">${escapeHtml(t.observations || '')}</textarea>
            </label>
          </div>
          <div class="terr-catalog-modal__foot">
            <div class="terr-catalog-modal__foot-actions">
              <button type="button" data-cancel class="terr-catalog-modal-btn terr-catalog-modal-btn--ghost">Cancelar</button>
              <button type="submit" class="terr-catalog-modal-btn terr-catalog-modal-btn--primary">
                <span class="material-symbols-outlined" aria-hidden="true">save</span>
                Salvar
              </button>
            </div>
          </div>
        </form>
      </div>`;

    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';

    const form = wrap.querySelector('#catalog-row-modal-form');

    const close = () => {
      wrap.remove();
      document.body.style.overflow = '';
    };

    syncCatalogModalUi(form, t, assignment);
    form.querySelectorAll('input, select, textarea').forEach((el) => {
      el.addEventListener('input', () => syncCatalogModalUi(form, t, assignment));
      el.addEventListener('change', () => {
        if (el.name === 'pair_id' && el.value) {
          const profileField = form.querySelector('[name="profile_id"]');
          if (profileField) profileField.value = '';
        }
        if (el.name === 'profile_id' && el.value) {
          const pairField = form.querySelector('[name="pair_id"]');
          if (pairField) pairField.value = '';
        }
        syncCatalogModalUi(form, t, assignment);
      });
    });

    wrap.querySelectorAll('[data-cancel]').forEach((btn) => btn.addEventListener('click', close));
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const undoEntry = buildCatalogRowUndo(t, assignment, fd);

      try {
        await saveCatalogRowChanges(t, assignment, fd);
        pushUndo(undoEntry);
        const { error: logErr } = await client.rpc('log_territory_history', {
          p_event_type: 'edicao',
          p_territory_id: t.id,
          p_profile_id: resolveCatalogProfileId(fd.get('pair_id') || fd.get('profile_id'), t.id) || assignment?.profile_id || null,
          p_event_date: H().toISODate(new Date()),
          p_details: 'Registro atualizado no painel',
          p_metadata: {}
        });
        if (logErr) console.warn('Histórico (painel):', logErr.message);
        close();
        showToast(toast, 'Registro atualizado.');
        await refresh();
      } catch (err) {
        showToast(toast, err.message || 'Erro ao salvar.', true);
      }
    });
  }

  async function refresh() {
    try {
      await reloadForRefresh();
      await reconcileDomingoPairFlags();
      if (tabsRendered.semana) {
        try {
          weekendByDate = await H().fetchWeekendAnnouncements(client, currentWeek);
        } catch (err) {
          console.warn('Weekend announcements:', err);
        }
      }
      if (tabsRendered.dirigentes) fillOverseerProfileSelect();
      if (tabsRendered.painel) refreshCatalogoView();
      else renderCatalogo();
      tabsRendered.painel = true;
      if (tabsRendered.semana) refreshSemanaView();
      if (tabsRendered.historico) refreshHistoricoView();
      if (tabsRendered.dirigentes) refreshDirigentesView();
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

  async function deleteHistoryEntry(id) {
    if (!window.confirm('Excluir este registro do histórico?')) return;
    const row = history.find((item) => item.id === id);
    const { error } = await client.from('territory_history').delete().eq('id', id);
    if (error) showToast(toast, error.message, true);
    else {
      if (row) {
        undoApi()?.registerDelete(UNDO_SCOPE, 'territory_history', {
          id: row.id,
          event_type: row.event_type,
          event_date: row.event_date,
          details: row.details,
          metadata: row.metadata,
          territory_id: row.territory_id,
          profile_id: row.profile_id,
          created_by: row.created_by,
          created_at: row.created_at
        }, 'Registro do histórico');
      }
      showToast(toast, 'Registro excluído.');
      await refresh();
    }
  }

  async function deleteScheduleRow(id) {
    if (!window.confirm('Excluir esta linha do cronograma?')) return;
    const row = weekTemplate.find((item) => item.id === id);
    const { error } = await client.from('territory_week_schedule').delete().eq('id', id);
    if (error) showToast(toast, error.message, true);
    else {
      if (row) undoApi()?.registerDelete(UNDO_SCOPE, 'territory_week_schedule', { ...row }, 'Linha do cronograma');
      showToast(toast, 'Linha removida.');
      await refresh();
    }
  }

  async function deleteSpot(id) {
    if (!window.confirm('Excluir este local?')) return;
    const row = meetingSpots.find((item) => item.id === id);
    const { error } = await client.from('territory_meeting_spots').delete().eq('id', id);
    if (error) showToast(toast, error.message, true);
    else {
      if (row) undoApi()?.registerDelete(UNDO_SCOPE, 'territory_meeting_spots', { ...row }, 'Local de encontro');
      showToast(toast, 'Local removido.');
      await refresh();
    }
  }

  async function removeOverseer(profileId) {
    if (!window.confirm('Remover este dirigente da lista?')) return;
    const row = overseers.find((item) => item.profile_id === profileId);
    const { error } = await client.from('territory_overseers').delete().eq('profile_id', profileId);
    if (error) showToast(toast, error.message, true);
    else {
      if (row) {
        undoApi()?.registerDelete(UNDO_SCOPE, 'territory_overseers', {
          profile_id: row.profile_id,
          preference: row.preference,
          available_days: row.available_days,
          is_active: row.is_active !== false
        }, 'Dirigente removido');
      }
      showToast(toast, 'Dirigente removido.');
      await refresh();
    }
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
      const beforeDays = [...H().overseerDays(overseer)];
      const beforePref = overseer.preference;
      const { error } = await client.from('territory_overseers').update({
        available_days: days,
        preference: H().preferenceFromDays(days)
      }).eq('profile_id', overseer.profile_id);
      wrap.remove();
      if (error) showToast(toast, error.message, true);
      else {
        pushUndo({
          label: 'Dias do dirigente',
          undo: async (c) => {
            const { error: undoErr } = await c.from('territory_overseers').update({
              available_days: beforeDays,
              preference: beforePref
            }).eq('profile_id', overseer.profile_id);
            if (undoErr) throw undoErr;
          }
        });
        showToast(toast, 'Dias atualizados.');
        await refresh();
      }
    });
  }

  function scheduleModalPreviewFromForm(form, ctx) {
    const fd = new FormData(form);
    const weekday = fd.get('weekday_label')?.trim() || '—';
    let dirigenteName = '—';
    if (H().isSundayCronogramaDay(weekday)) {
      const territoryId = fd.get('territory_id') || ctx.row?.territory_id || null;
      const territoriesById = Object.fromEntries(territories.map((t) => [t.id, t]));
      dirigenteName = H().domingoPairNameForSchedule(
        weekday,
        territoryId,
        ctx.row?.territory_code,
        territoriesById,
        fd.get('dirigente_name')?.trim() || ctx.row?.dirigente_name
      )
        || fd.get('dirigente_name')?.trim()
        || ctx.row?.dirigente_name
        || '—';
    } else {
      const profileId = fd.get('profile_id');
      if (profileId) {
        const p = profiles.find((pr) => pr.id === profileId) || overseers.find((o) => o.profile_id === profileId)?.profiles;
        dirigenteName = profileName(p) || '—';
      } else {
        dirigenteName = ctx.row?.dirigente_name || '—';
      }
    }
    const territoryId = fd.get('territory_id');
    let territorio = '—';
    if (territoryId) {
      const t = territories.find((tr) => tr.id === territoryId);
      if (t) territorio = H().territoryLabel(t);
    } else if (ctx.row?.territory_code) {
      territorio = ctx.row.territory_code;
    }
    const location = fd.get('location_name')?.trim() || '';
    const time = fd.get('schedule_times')?.trim() || '';
    const sugg = fd.get('suggestion')?.trim();
    const suggNote = fd.get('suggestion_note')?.trim();
    let suggestionDisplay = '';
    if (sugg) suggestionDisplay = suggNote ? `${sugg} · ${suggNote}` : sugg;
    return {
      weekday,
      dirigenteName,
      territorio,
      location,
      time,
      suggestionDisplay,
      saturdayFromQuadro: ctx.saturdayFromQuadro,
      enriched: ctx.enriched
    };
  }

  function renderScheduleModalPreviewHtml(values, assignment) {
    const tone = scheduleDayTone(values.weekday);
    const dayIcon = scheduleDayIcon(values.weekday);
    let dirigenteHtml = escapeHtml(values.dirigenteName);
    if (values.saturdayFromQuadro && values.enriched?.from_announcement) {
      dirigenteHtml = `${escapeHtml(values.dirigenteName)} <span class="terr-sched-qa-badge" title="Definido no Quadro de Anúncios — Final de Semana">Quadro</span>`;
    } else if (H().isSundayCronogramaDay(values.weekday) && values.dirigenteName && values.dirigenteName !== '—') {
      dirigenteHtml = `${escapeHtml(values.dirigenteName)} <span class="terr-sched-qa-badge" title="Par de dirigentes aos domingos">Dupla</span>`;
    }
    const territorioHtml = assignment?.id
      ? `<span class="terr-sched-cell terr-sched-cell--assigned" title="Designado · ${escapeHtml(scheduleAssignmentTitle(assignment))}">${escapeHtml(values.territorio)}</span>`
      : `<span class="terr-sched-cell">${escapeHtml(values.territorio)}</span>`;
    const hasSugg = !!values.suggestionDisplay;
    return `
      <div class="terr-sched-modal__preview-panel">
        <div class="terr-sched-row terr-sched-row--${tone} terr-sched-modal__preview-row">
          <span class="terr-sched-day-pill">
            <span class="material-symbols-outlined" aria-hidden="true">${dayIcon}</span>
            ${escapeHtml(values.weekday)}
          </span>
          <span class="terr-sched-cell terr-sched-cell--dirigente">${dirigenteHtml}</span>
          ${territorioHtml}
          <span class="terr-sched-cell${values.location ? '' : ' terr-sched-cell--muted'}">${escapeHtml(values.location || '—')}</span>
          <span class="terr-sched-time">${escapeHtml(values.time || '—')}</span>
          <span class="terr-sched-sugg">${hasSugg ? escapeHtml(values.suggestionDisplay) : '—'}</span>
        </div>
      </div>`;
  }

  function syncScheduleModalPreview(form, previewEl, ctx, assignment) {
    if (!form || !previewEl) return;
    const values = scheduleModalPreviewFromForm(form, ctx);
    previewEl.innerHTML = renderScheduleModalPreviewHtml(values, assignment);
  }

  function openScheduleFormModal(existing) {
    const row = existing || null;
    const isEdit = Boolean(row);
    const enriched = row ? H().applyWeekendDirigente(row, currentWeek, weekendByDate, profiles) : null;
    const saturdayFromQuadro = enriched?.from_announcement;
    const sundayRow = row && H().isSundayCronogramaDay(row.weekday_label);
    const sundayPairName = sundayRow
      ? (H().domingoDirigenteName(row) || String(row.dirigente_name || '').trim())
      : '';
    const assignment = row && !H().isSundayCronogramaDay(row.weekday_label)
      ? findAssignmentForScheduleRow(row)
      : null;
    const designationAssignment = row ? scheduleModalDesignationAssignment(row) : null;
    const assignedAtIso = scheduleModalAssignedAtIso(row, designationAssignment);
    if (document.getElementById('sched-form-modal-wrap')) return;

    const wrap = document.createElement('div');
    wrap.id = 'sched-form-modal-wrap';
    wrap.className = 'terr-sched-modal';
    wrap.innerHTML = `
      <div class="terr-sched-modal__panel" role="dialog" aria-modal="true" aria-labelledby="sched-form-modal-title">
        <div class="terr-sched-modal__hero">
          <button type="button" data-cancel class="terr-sched-modal__close" aria-label="Fechar">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
          <p class="terr-sched-modal__kicker">Cronograma semanal</p>
          <h3 id="sched-form-modal-title">${isEdit ? 'Editar linha do cronograma' : 'Nova linha do cronograma'}</h3>
        </div>
        <form id="sched-form-modal-form">
          <div class="terr-sched-modal__body">
            ${saturdayFromQuadro ? `
            <p class="terr-sched-modal__alert">
              Sugestão do Quadro de Anúncios para este sábado:
              <strong>${escapeHtml(enriched.announcement_dirigente || enriched.dirigente_name || '—')}</strong>.
              Você pode escolher outro dirigente abaixo ou editar em
              <a href="anuncios.html">Quadro de Anúncios → Final de Semana</a>.
            </p>` : ''}
            ${sundayRow ? `
            <p class="terr-sched-modal__alert">
              Nos <strong>domingos</strong> o cronograma usa a <strong>dupla</strong>
              ${sundayPairName ? `(${escapeHtml(sundayPairName)})` : ''}.
              Ao salvar, designa a dupla no território escolhido no Painel.
            </p>` : ''}
            <p class="terr-sched-modal__preview-label">Prévia da linha</p>
            <div class="terr-sched-modal__preview-wrap">
              <div id="sched-modal-preview"></div>
            </div>
            <div class="terr-sched-modal__fields">
              ${sundayRow ? `
              <label class="terr-sched-modal-field terr-sched-modal-field--day">
                <span class="terr-sched-modal-field__label"><span class="material-symbols-outlined" aria-hidden="true">today</span>Dia</span>
                <select name="weekday_label" required class="terr-sched-modal-input terr-sched-modal-input--day">
                  ${H().CRONOGRAMA_DAYS.map((d) => `<option value="${escapeHtml(d)}" ${row?.weekday_label === d ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}
                </select>
              </label>
              ${!sundayPairName ? `
              <label class="terr-sched-modal-field">
                <span class="terr-sched-modal-field__label"><span class="material-symbols-outlined" aria-hidden="true">groups</span>Dupla</span>
                <input name="dirigente_name" value="${escapeHtml(row?.dirigente_name || '')}" class="terr-sched-modal-input" placeholder="Ex.: Denison e Arnaldo"/>
              </label>` : ''}` : `
              <div class="terr-sched-modal-grid terr-sched-modal-grid--lead">
                <label class="terr-sched-modal-field terr-sched-modal-field--day">
                  <span class="terr-sched-modal-field__label"><span class="material-symbols-outlined" aria-hidden="true">today</span>Dia</span>
                  <select name="weekday_label" required class="terr-sched-modal-input terr-sched-modal-input--day">
                    <option value="">—</option>
                    ${H().CRONOGRAMA_DAYS.map((d) => `<option value="${escapeHtml(d)}" ${row?.weekday_label === d ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}
                  </select>
                </label>
                <label class="terr-sched-modal-field">
                  <span class="terr-sched-modal-field__label"><span class="material-symbols-outlined" aria-hidden="true">person</span>Dirigente</span>
                  <select name="profile_id" class="terr-sched-modal-input">
                    <option value="">— Selecione —</option>
                    ${scheduleDirigenteOptions(scheduleModalSelectedProfileId(row))}
                  </select>
                </label>
              </div>`}
              <label class="terr-sched-modal-field">
                <span class="terr-sched-modal-field__label"><span class="material-symbols-outlined" aria-hidden="true">map</span>Território</span>
                <select name="territory_id" class="terr-sched-modal-input">
                  <option value="">— Selecione —</option>
                  ${[...territories].sort((a, b) => territoryNumSortKey(a.num) - territoryNumSortKey(b.num)).map((t) => {
                    const selectedTerrId = scheduleModalSelectedTerritoryId(row);
                    return `<option value="${t.id}" ${t.id === selectedTerrId ? 'selected' : ''}>${escapeHtml(territoryNumLabel(t.num))} — ${escapeHtml(t.display_name)}</option>`;
                  }).join('')}
                </select>
              </label>
              <label class="terr-sched-modal-field">
                <span class="terr-sched-modal-field__label"><span class="material-symbols-outlined" aria-hidden="true">event</span>Data da designação</span>
                <input name="assigned_at" type="date" value="${escapeHtml(assignedAtIso)}" class="terr-sched-modal-input"/>
                <p class="terr-catalog-modal__cov-hint">${sundayRow
                  ? 'Designa a dupla de domingo no Painel ao salvar.'
                  : 'Designa o território no Painel ao salvar (dirigente + território disponível).'}</p>
              </label>
              <div class="terr-sched-modal-grid">
                <label class="terr-sched-modal-field">
                  <span class="terr-sched-modal-field__label"><span class="material-symbols-outlined" aria-hidden="true">location_on</span>Local</span>
                  <input name="location_name" value="${escapeHtml(row?.location_name || '')}" class="terr-sched-modal-input"/>
                </label>
                <label class="terr-sched-modal-field">
                  <span class="terr-sched-modal-field__label"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>Horário</span>
                  <input name="schedule_times" value="${escapeHtml(row?.schedule_times || '')}" class="terr-sched-modal-input" placeholder="Ex.: 16:00"/>
                </label>
              </div>
              <div class="terr-sched-modal-grid">
                <label class="terr-sched-modal-field">
                  <span class="terr-sched-modal-field__label"><span class="material-symbols-outlined" aria-hidden="true">lightbulb</span>Sugestão</span>
                  <input name="suggestion" value="${escapeHtml(row?.suggestion || '')}" class="terr-sched-modal-input" placeholder="Ex.: T5"/>
                </label>
                <label class="terr-sched-modal-field">
                  <span class="terr-sched-modal-field__label"><span class="material-symbols-outlined" aria-hidden="true">comment</span>Comentário</span>
                  <input name="suggestion_note" value="${escapeHtml(row?.suggestion_note || '')}" class="terr-sched-modal-input"/>
                </label>
              </div>
              <label class="terr-sched-modal-field">
                <span class="terr-sched-modal-field__label"><span class="material-symbols-outlined" aria-hidden="true">notes</span>Observações</span>
                <input name="observations" value="${escapeHtml(row?.observations || '')}" class="terr-sched-modal-input"/>
              </label>
            </div>
          </div>
          <div class="terr-sched-modal__foot">
            <div class="terr-sched-modal__foot-actions">
              <button type="button" data-cancel class="terr-sched-modal-btn terr-sched-modal-btn--ghost">Cancelar</button>
              <button type="submit" class="terr-sched-modal-btn terr-sched-modal-btn--primary">
                <span class="material-symbols-outlined" aria-hidden="true">save</span>
                Salvar
              </button>
            </div>
          </div>
        </form>
      </div>`;

    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';

    const form = wrap.querySelector('#sched-form-modal-form');
    const previewEl = wrap.querySelector('#sched-modal-preview');
    const ctx = { saturdayFromQuadro, sundayRow, enriched, row };

    const close = () => {
      wrap.remove();
      document.body.style.overflow = '';
    };

    syncScheduleModalPreview(form, previewEl, ctx, assignment);
    form.querySelectorAll('input, select, textarea').forEach((el) => {
      el.addEventListener('input', () => syncScheduleModalPreview(form, previewEl, ctx, assignment));
      el.addEventListener('change', () => syncScheduleModalPreview(form, previewEl, ctx, assignment));
    });

    wrap.querySelectorAll('[data-cancel]').forEach((btn) => btn.addEventListener('click', close));
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await ensureProfiles();
      const fd = new FormData(e.target);
      const weekdayLabel = fd.get('weekday_label')?.trim();
      const isSunday = H().isSundayCronogramaDay(weekdayLabel);
      const { territoryId, territoryCode } = resolveScheduleTerritoryPayload(row, fd.get('territory_id') || null);
      const territoriesById = Object.fromEntries(territories.map((t) => [t.id, t]));
      let profileId = null;
      let dirigenteName = null;
      if (isSunday) {
        profileId = null;
        dirigenteName = H().domingoPairNameForSchedule(
          weekdayLabel,
          territoryId,
          territoryCode,
          territoriesById,
          fd.get('dirigente_name')?.trim() || row?.dirigente_name
        )
          || fd.get('dirigente_name')?.trim()
          || row?.dirigente_name
          || null;
        if (!dirigenteName) {
          showToast(toast, 'Informe o nome da dupla de domingo.', true);
          return;
        }
      } else {
        profileId = fd.get('profile_id') || null;
        if (profileId) {
          const p = profiles.find((pr) => pr.id === profileId) || overseers.find((o) => o.profile_id === profileId)?.profiles;
          dirigenteName = profileName(p) || null;
        } else if (isEdit) {
          dirigenteName = row.dirigente_name || null;
        }
        if (!profileId && dirigenteName) {
          const resolved = H().resolveProfileByName(dirigenteName, profiles)
            || H().resolveProfileByName(H().primaryDirigenteFromPair(dirigenteName), profiles);
          profileId = resolved?.id || null;
        }
        if (!profileId && !dirigenteName) {
          showToast(toast, 'Selecione o dirigente.', true);
          return;
        }
      }
      const assignedAt = fd.get('assigned_at')?.trim() || H().toISODate(new Date());
      const payload = {
        weekday_label: weekdayLabel,
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
      close();
      if (isEdit) {
        const beforeRow = { ...row };
        const { error } = await client.from('territory_week_schedule').update(payload).eq('id', row.id);
        if (error) showToast(toast, error.message, true);
        else {
          let designationNote = '';
          let syncOk = true;
          let syncMessage = '';
          try {
            if (isSunday && territoryId) {
              const pairNum = H().domingoPairNumForDirigenteName(dirigenteName);
              if (!pairNum) {
                syncOk = false;
                syncMessage = 'Linha salva, mas a dupla não foi reconhecida para designar no Painel.';
              } else {
                await syncScheduleDomingoPairDesignation({ territoryId, assignedAt, pairNum });
                designationNote = ' e designado no Painel';
              }
            } else if (profileId && territoryId) {
              await syncScheduleFieldDesignation({ profileId, territoryId, assignedAt });
              designationNote = ' e designado no Painel';
            } else if (profileId && !territoryId) {
              syncOk = false;
              syncMessage = 'Linha salva, mas falta o território para designar no Painel.';
            } else if (!profileId && territoryId) {
              syncOk = false;
              syncMessage = 'Linha salva, mas falta o dirigente para designar no Painel.';
            }
          } catch (syncErr) {
            console.warn('Designação (cronograma):', syncErr);
            syncOk = false;
            syncMessage = formatDesignationError(syncErr);
          }
          undoApi()?.registerUpdate(
            UNDO_SCOPE,
            'territory_week_schedule',
            row.id,
            beforeRow,
            'Linha do cronograma',
            [
              'weekday_label', 'profile_id', 'dirigente_name', 'territory_id', 'territory_code',
              'location_name', 'schedule_times', 'suggestion', 'suggestion_note', 'observations'
            ]
          );
          if (syncOk && designationNote) {
            showToast(toast, `Linha atualizada${designationNote}.`);
          } else if (syncOk) {
            showToast(toast, 'Linha atualizada.');
          } else {
            showToast(toast, syncMessage, true);
          }
          await refresh();
        }
      } else {
        const { data: inserted, error } = await client
          .from('territory_week_schedule')
          .insert({ ...payload, sort_order: weekTemplate.length + 1 })
          .select()
          .single();
        if (error) showToast(toast, error.message, true);
        else {
          let designationNote = '';
          let syncOk = true;
          let syncMessage = '';
          try {
            if (isSunday && territoryId) {
              const pairNum = H().domingoPairNumForDirigenteName(dirigenteName);
              if (!pairNum) {
                syncOk = false;
                syncMessage = 'Linha salva, mas a dupla não foi reconhecida para designar no Painel.';
              } else {
                await syncScheduleDomingoPairDesignation({ territoryId, assignedAt, pairNum });
                designationNote = ' e designado no Painel';
              }
            } else if (profileId && territoryId) {
              await syncScheduleFieldDesignation({ profileId, territoryId, assignedAt });
              designationNote = ' e designado no Painel';
            } else if (profileId && !territoryId) {
              syncOk = false;
              syncMessage = 'Linha salva, mas falta o território para designar no Painel.';
            } else if (!profileId && territoryId) {
              syncOk = false;
              syncMessage = 'Linha salva, mas falta o dirigente para designar no Painel.';
            }
          } catch (syncErr) {
            console.warn('Designação (cronograma):', syncErr);
            syncOk = false;
            syncMessage = formatDesignationError(syncErr);
          }
          if (inserted?.id) {
            undoApi()?.registerInsert(UNDO_SCOPE, 'territory_week_schedule', inserted.id, 'Linha do cronograma');
          }
          if (syncOk && designationNote) {
            showToast(toast, `Linha adicionada${designationNote}.`);
          } else if (syncOk) {
            showToast(toast, 'Linha adicionada.');
          } else {
            showToast(toast, syncMessage, true);
          }
          await refresh();
        }
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
      const { data: inserted, error } = await client.from('territory_meeting_spots').insert({
        weekday_label: fd.get('weekday_label'),
        location_name: fd.get('location_name')?.trim(),
        address: fd.get('address')?.trim() || null,
        schedule_times: fd.get('schedule_times')?.trim() || null
      }).select().single();
      wrap.remove();
      if (error) showToast(toast, error.message, true);
      else {
        if (inserted?.id) {
          undoApi()?.registerInsert(UNDO_SCOPE, 'territory_meeting_spots', inserted.id, 'Local de encontro');
        }
        showToast(toast, 'Local adicionado.');
        await refresh();
      }
    });
  }

  function scheduleRowsEnrichedForExport() {
    return scheduleRowsForWeek().map((row) => {
      const { terr } = resolveScheduleDisplayContext(row);
      if (!terr) return row;
      return {
        ...row,
        territory_id: terr.id,
        territory_code: scheduleTerritoryCodeFromTerr(terr),
        territories: terr
      };
    });
  }

  function copyWhatsApp() {
    const byId = Object.fromEntries(territories.map((t) => [t.id, t]));
    const msg = H().generateWhatsAppSchedule(currentWeek, scheduleRowsEnrichedForExport(), byId);
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

  function setupDelegatedActions() {
    if (window.__JETerrDelegatedActions) return;
    window.__JETerrDelegatedActions = true;

    document.getElementById('panel-painel')?.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-edit-catalog-row]');
      if (editBtn) {
        openCatalogRowModal(territories.find((x) => x.id === editBtn.dataset.editCatalogRow));
      }
    });

    document.getElementById('semana-list')?.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-edit-schedule]');
      if (editBtn) {
        openScheduleFormModal(
          scheduleRowsForWeek().find((r) => r.id === editBtn.dataset.editSchedule)
            || weekTemplate.find((r) => r.id === editBtn.dataset.editSchedule)
        );
        return;
      }
      const delBtn = e.target.closest('[data-del-schedule]');
      if (delBtn) {
        deleteScheduleRow(delBtn.dataset.delSchedule);
        return;
      }
      const retBtn = e.target.closest('[data-return-assignment]');
      if (retBtn) {
        if (e.target.closest('[data-edit-schedule]') || e.target.closest('[data-del-schedule]')) return;
        const asn = activeAssignments.find((a) => a.id === retBtn.dataset.returnAssignment);
        if (asn) openDevolverModal(asn);
        else if (toast) showToast(toast, 'Designação não encontrada. Atualize a página.', true);
        return;
      }
      const revealBtn = e.target.closest('[data-sched-reveal-last-terr]');
      if (revealBtn) {
        const expanded = revealBtn.getAttribute('aria-expanded') === 'true';
        const panel = revealBtn.nextElementSibling;
        const next = !expanded;
        revealBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
        if (panel?.classList.contains('terr-sched-last-terr')) {
          panel.hidden = !next;
        }
        return;
      }
    });

    document.getElementById('spots-list')?.addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-del-spot]');
      if (delBtn) deleteSpot(delBtn.dataset.delSpot);
    });

    document.getElementById('dirigentes-list')?.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-edit-overseer]');
      if (editBtn) {
        openOverseerEditModal(overseers.find((o) => o.profile_id === editBtn.dataset.editOverseer));
        return;
      }
      const delBtn = e.target.closest('[data-del-overseer]');
      if (delBtn) removeOverseer(delBtn.dataset.delOverseer);
    });
  }

  function setupTerritoryMapLightbox() {
    document.getElementById('terr-map-lightbox-close')?.addEventListener('click', closeTerritoryMapLightbox);
    document.getElementById('terr-map-lightbox')?.addEventListener('click', (e) => {
      if (e.target.id === 'terr-map-lightbox') closeTerritoryMapLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('terr-map-lightbox')?.classList.contains('is-open')) {
        closeTerritoryMapLightbox();
      }
    });
    document.getElementById('semana-priority-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-terr-map]');
      if (!btn) return;
      openTerritoryMapLightbox(btn.dataset.terrTitle, btn.dataset.terrMap);
    });
    document.getElementById('panel-historico')?.addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-del-history]');
      if (delBtn) {
        deleteHistoryEntry(delBtn.dataset.delHistory);
        return;
      }
      const btn = e.target.closest('[data-terr-map]');
      if (!btn) return;
      openTerritoryMapLightbox(btn.dataset.terrTitle, btn.dataset.terrMap);
    });
    document.getElementById('panel-painel')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-terr-map]');
      if (!btn) return;
      openTerritoryMapLightbox(btn.dataset.terrTitle, btn.dataset.terrMap);
    });
    document.getElementById('semana-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-terr-map]');
      if (!btn) return;
      openTerritoryMapLightbox(btn.dataset.terrTitle, btn.dataset.terrMap);
    });
  }

  async function init() {
    if (window.__JEAdminTerritoriosInit) {
      queueNavIndicatorRefresh();
      undoApi()?.updateUi(UNDO_SCOPE);
      if (!tabsRendered.painel && territories.length) {
        if (document.getElementById('catalogo-table-body')) refreshCatalogoView();
        else renderCatalogo();
        tabsRendered.painel = true;
      }
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
      setupDelegatedActions();
      setupPriorityModal();
      setupTerritoryMapLightbox();
      setupSchedColsMenu();

      document.getElementById('btn-designar')?.addEventListener('click', () => openDesignarModal());
      document.getElementById('btn-semana-refresh')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-semana-refresh');
        if (!btn || btn.disabled) return;
        btn.disabled = true;
        btn.classList.add('terr-sched-toolbar-btn--spin');
        try {
          await reloadSemanaData();
          await refreshSemanaView();
          tabsRendered.semana = true;
          if (toast) showToast(toast, 'Cronograma atualizado.');
        } catch (err) {
          console.error('Refresh cronograma:', err);
          if (toast) showToast(toast, err.message || 'Erro ao atualizar cronograma.', true);
        } finally {
          btn.disabled = false;
          btn.classList.remove('terr-sched-toolbar-btn--spin');
        }
      });
      document.getElementById('btn-whatsapp')?.addEventListener('click', async () => {
        try {
          await ensureTabData('semana');
          copyWhatsApp();
        } catch (err) {
          console.error('WhatsApp cronograma:', err);
          if (toast) showToast(toast, err.message || 'Erro ao carregar cronograma.', true);
        }
      });
      document.getElementById('btn-new-schedule')?.addEventListener('click', async () => {
        try {
          await ensureTabData('semana');
          openScheduleFormModal();
        } catch (err) {
          console.error('Schedule modal:', err);
          if (toast) showToast(toast, err.message || 'Erro ao carregar cronograma.', true);
        }
      });
      document.getElementById('btn-new-spot')?.addEventListener('click', async () => {
        try {
          await ensureTabData('semana');
          openSpotFormModal();
        } catch (err) {
          console.error('Spot modal:', err);
          if (toast) showToast(toast, err.message || 'Erro ao carregar locais.', true);
        }
      });

      document.getElementById('form-overseer')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const profileId = document.getElementById('overseer-profile').value;
        const preference = document.getElementById('overseer-pref').value;
        const { error } = await client.from('territory_overseers').upsert({
          profile_id: profileId,
          preference,
          available_days: helpers.daysFromPreference(preference),
          is_active: true
        });
        if (error) showToast(toast, error.message, true);
        else {
          pushUndo({
            label: 'Dirigente adicionado',
            undo: async (c) => {
              const { error: undoErr } = await c.from('territory_overseers').delete().eq('profile_id', profileId);
              if (undoErr) throw undoErr;
            }
          });
          showToast(toast, 'Dirigente adicionado.');
          e.target.reset();
          await refresh();
        }
      });

      undoApi()?.bind(UNDO_SCOPE, {
        getClient: async () => client,
        onAfterUndo: refresh,
        showToast,
        toastEl: toast
      });

      document.getElementById('semana-week')?.addEventListener('change', async (e) => {
        currentWeek = window.JEWeekInput?.mondayFromWeekInput(e.target.value)
          || helpers.snapToMonday(e.target.value);
        syncSemanaWeekInput();
        try {
          await ensureTabData('semana');
          weekendByDate = await helpers.fetchWeekendAnnouncements(client, currentWeek);
          await refreshSemanaView();
          tabsRendered.semana = true;
        } catch (err) {
          console.error('Semana change:', err);
          if (toast) showToast(toast, err.message || 'Erro ao carregar semana.', true);
        }
      });

      await reloadCore();
      await reconcileDomingoPairFlags();
      renderCatalogo();
      renderPriorityList();
      tabsRendered = { painel: true, semana: false, historico: false, dirigentes: false };
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
