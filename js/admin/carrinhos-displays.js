(function () {
  const { guardPermission, getClient, showToast, escapeHtml } = window.JEAdmin;
  const helpers = window.JEEquipmentSchedule;
  const xlf = window.JETableXlf;

  const PUB_SVC_OPTIONS = [
    { value: 'carrinho', label: 'Carrinho' },
    { value: 'display', label: 'Display' },
    { value: 'ambos', label: 'Carrinho + Display' }
  ];
  const PUB_STATUS_OPTIONS = [
    { value: 'active', label: 'Ativo' },
    { value: 'inactive', label: 'Inativo' }
  ];

  let toast;
  let client;
  let currentWeek;
  let slots = [];
  let publishers = [];
  let profiles = [];
  let pubSearch = '';
  let pubFilter = {
    name: {},
    services: { carrinho: true, display: true, ambos: true },
    days: {},
    grupo: {},
    casa: {},
    status: { active: true, inactive: true }
  };
  let pubSort = { col: 'name', dir: 'asc' };
  let pubFilterSig = '';
  let inlineSlotDraft = null;

  function toastEl() {
    return document.getElementById('hub-admin-toast') || document.getElementById('admin-toast');
  }

  function moveNavIndicator(tab) {
    const indicator = document.getElementById('eq-nav-indicator');
    if (!indicator || !tab) return;
    indicator.style.width = `${tab.offsetWidth}px`;
    indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
  }

  function setupTabs() {
    const tabs = document.querySelectorAll('[data-eq-tab]');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.eq-panel').forEach((panel) => {
          panel.classList.toggle('active', panel.id === `eq-panel-${tab.dataset.eqTab}`);
        });
        moveNavIndicator(tab);
      });
    });
    moveNavIndicator(document.querySelector('[data-eq-tab].active'));
    window.addEventListener('resize', () => {
      moveNavIndicator(document.querySelector('[data-eq-tab].active'));
    });
  }

  function buildDayCheckboxes(container, prefix, selectedDays) {
    if (!container) return;
    const selected = new Set(selectedDays || helpers.EQUIPMENT_DAYS);
    container.innerHTML = helpers.EQUIPMENT_DAYS.map((day) => `
      <label class="eq-pub-day-pick">
        <input type="checkbox" name="${prefix}-day" value="${escapeHtml(day)}" ${selected.has(day) ? 'checked' : ''}/>
        ${escapeHtml(day.slice(0, 3))}
      </label>`).join('');
  }

  function fillSelectOptions() {
    buildDayCheckboxes(document.getElementById('eq-pub-days'), 'eq-pub', helpers.EQUIPMENT_DAYS);
  }

  function slotSelectOptions(selectedDay, selectedPeriod) {
    const dayOpts = helpers.EQUIPMENT_DAYS.map((d) =>
      `<option value="${escapeHtml(d)}" ${d === selectedDay ? 'selected' : ''}>${escapeHtml(d)}</option>`
    ).join('');
    const periodOpts = helpers.PERIOD_LABELS.map((p) =>
      `<option value="${escapeHtml(p)}" ${p === selectedPeriod ? 'selected' : ''}>${escapeHtml(p)}</option>`
    ).join('');
    return { dayOpts, periodOpts };
  }

  async function loadProfiles() {
    const { data, error } = await client
      .from('profiles')
      .select('id, full_name, username, role, avatar_url')
      .order('full_name');
    if (error) throw error;
    profiles = data || [];
    const select = document.getElementById('eq-publisher-profile');
    if (!select) return;
    const used = new Set(publishers.filter((p) => p.profile_id).map((p) => p.profile_id));
    select.innerHTML = ['<option value="">Selecione…</option>']
      .concat(
        profiles
          .filter((p) => !used.has(p.id))
          .map((p) => `<option value="${p.id}">${escapeHtml(p.full_name)}</option>`)
      )
      .join('');
  }

  async function loadPublishers() {
    const { data, error } = await client
      .from('equipment_publishers')
      .select('*, profiles(full_name, username, avatar_url, role)')
      .order('publisher_name');
    if (error) throw error;
    publishers = data || [];
    if (document.getElementById('eq-pub-table-body')) refreshPublishersView();
    else renderPublishers();
    await loadProfiles();
  }

  function publisherName(row) {
    return row.profiles?.full_name || row.publisher_name || '—';
  }

  function parsePublisherNames(str) {
    return String(str || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  }

  function normalizePubName(name) {
    return String(name).trim().toLowerCase();
  }

  function publisherEligibleForSlot(row, day, equipmentType) {
    if (row.is_active === false) return false;
    if (equipmentType === 'carrinho' && !row.can_carrinho) return false;
    if (equipmentType === 'display' && !row.can_display) return false;
    const days = row.available_days || [];
    if (day && days.length && !days.some((d) => helpers.weekdayMatches(day, d))) return false;
    return true;
  }

  function getSelectedSlotPublisherNames(prefix = 'eq-inline') {
    return Array.from(document.querySelectorAll(`#${prefix}-pub-list input[name="${prefix}-pub"]:checked`))
      .map((input) => input.value);
  }

  function syncSlotPublishersField(prefix = 'eq-inline') {
    const field = document.getElementById(`${prefix}-publishers`);
    if (field) field.value = getSelectedSlotPublisherNames(prefix).join(', ');
    updateSlotPublisherSummary(prefix);
  }

  function updateSlotPublisherSummary(prefix = 'eq-inline') {
    const summary = document.getElementById(`${prefix}-pub-summary`);
    if (!summary) return;
    const names = getSelectedSlotPublisherNames(prefix);
    if (!names.length) {
      summary.textContent = 'Nenhum publicador selecionado';
      summary.classList.add('eq-slot-pub-picker__summary--empty');
      return;
    }
    summary.classList.remove('eq-slot-pub-picker__summary--empty');
    summary.textContent = names.length === 1
      ? `Selecionado: ${names[0]}`
      : `${names.length} selecionados: ${names.join(', ')}`;
  }

  function renderSlotPublisherPicker(prefix = 'eq-inline') {
    const container = document.getElementById(`${prefix}-pub-list`);
    const hint = document.getElementById(`${prefix}-pub-hint`);
    const hidden = document.getElementById(`${prefix}-publishers`);
    if (!container) return;

    const day = document.getElementById(`${prefix}-day`)?.value || helpers.EQUIPMENT_DAYS[0];
    const equipmentType = document.getElementById(`${prefix}-type`)?.value || 'carrinho';
    const search = document.getElementById(`${prefix}-pub-search`)?.value.trim().toLowerCase() || '';
    const previouslySelected = new Set(parsePublisherNames(hidden?.value).map(normalizePubName));

    let eligible = publishers.filter((row) => publisherEligibleForSlot(row, day, equipmentType));
    if (search) {
      eligible = eligible.filter((row) => publisherName(row).toLowerCase().includes(search));
    }
    eligible.sort((a, b) => publisherName(a).localeCompare(publisherName(b), 'pt-BR', { sensitivity: 'base' }));

    const eligibleNorm = new Set(eligible.map((row) => normalizePubName(publisherName(row))));
    const extras = [...previouslySelected].filter((name) => !eligibleNorm.has(name));

    if (hint) {
      const typeLabel = helpers.EQUIPMENT_TYPES[equipmentType] || equipmentType;
      hint.textContent = `${typeLabel} · ${day} · ${eligible.length} apto${eligible.length === 1 ? '' : 's'}`;
    }

    if (!eligible.length && !extras.length) {
      container.innerHTML = '<p class="eq-slot-pub-picker__empty">Nenhum publicador apto para este dia e equipamento. Cadastre na aba Publicadores.</p>';
      updateSlotPublisherSummary(prefix);
      return;
    }

    container.innerHTML = [
      ...extras.map((name) => `
        <label class="eq-slot-pub-pick eq-slot-pub-pick--extra">
          <input type="checkbox" name="${prefix}-pub" value="${escapeHtml(name)}" checked/>
          <span>${escapeHtml(name)}</span>
          <span class="eq-slot-pub-pick__tag">manual</span>
        </label>`),
      ...eligible.map((row) => {
        const name = publisherName(row);
        const checked = previouslySelected.has(normalizePubName(name));
        return `
          <label class="eq-slot-pub-pick">
            <input type="checkbox" name="${prefix}-pub" value="${escapeHtml(name)}" ${checked ? 'checked' : ''}/>
            <span>${escapeHtml(name)}</span>
          </label>`;
      })
    ].join('');

    syncSlotPublishersField(prefix);
  }

  async function loadSlots() {
    const { data, error } = await client
      .from('equipment_schedule_slots')
      .select('*')
      .order('sort_order');
    if (error) throw error;
    slots = data || [];
    renderSchedule();
  }

  function parsePublisherNotes(notes) {
    if (!notes) return { grupo: '', casa: '' };
    const grupoMatch = notes.match(/Grupo:\s*([^·]+)/i);
    const casaMatch = notes.match(/Casa:\s*(.+)$/i);
    return {
      grupo: grupoMatch ? grupoMatch[1].trim() : '',
      casa: casaMatch ? casaMatch[1].trim() : ''
    };
  }

  function publisherAvatarHtml(row) {
    const profile = row.profiles;
    const inner = profile && window.JEAuth?.renderAvatarHtml
      ? window.JEAuth.renderAvatarHtml(profile, { size: 28, className: 'je-profile-avatar' })
      : '<span class="material-symbols-outlined" aria-hidden="true">person</span>';
    return `<span class="eq-pub-avatar" aria-hidden="true">${inner}</span>`;
  }

  function renderPublisherServicePills(row) {
    const pills = [];
    if (row.can_carrinho) pills.push('<span class="eq-pub-svc-pill eq-pub-svc-pill--cart">Carrinho</span>');
    if (row.can_display) pills.push('<span class="eq-pub-svc-pill eq-pub-svc-pill--display">Display</span>');
    return pills.join('') || '<span class="eq-pub-day">—</span>';
  }

  function renderPublisherDayPills(row) {
    const days = row.available_days || [];
    if (!days.length) return '<span class="eq-pub-day">—</span>';
    return days.map((day) =>
      `<span class="eq-pub-day" title="${escapeHtml(day)}">${escapeHtml(day.slice(0, 3))}</span>`
    ).join('');
  }

  function publisherServiceKey(row) {
    if (row.can_carrinho && row.can_display) return 'ambos';
    if (row.can_display) return 'display';
    if (row.can_carrinho) return 'carrinho';
    return 'nenhum';
  }

  function pubDaySortKey(row) {
    return (row.available_days || []).join(',') || '—';
  }

  function pubMatchesDayFilter(row) {
    if (!xlf || xlf.xlfAllSelected(pubFilter.days)) return true;
    const selected = xlf.xlfSelectedKeys(pubFilter.days);
    return (row.available_days || []).some((day) => selected.includes(day));
  }

  function syncPubFilterOptions() {
    if (!xlf) return false;
    xlf.xlfEnsureKeys(
      pubFilter.name,
      [...new Set(publishers.map((p) => publisherName(p)))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
      )
    );
    xlf.xlfEnsureKeys(
      pubFilter.grupo,
      [...new Set(publishers.map((p) => parsePublisherNotes(p.notes).grupo || '—'))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
      )
    );
    xlf.xlfEnsureKeys(
      pubFilter.casa,
      [...new Set(publishers.map((p) => parsePublisherNotes(p.notes).casa || '—'))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
      )
    );
    xlf.xlfEnsureKeys(
      pubFilter.days,
      [...new Set(publishers.flatMap((p) => p.available_days || []))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
      )
    );
    const sig = [pubFilter.name, pubFilter.grupo, pubFilter.casa, pubFilter.days]
      .map((m) => Object.keys(m).join('\0'))
      .join('::');
    const changed = sig !== pubFilterSig;
    pubFilterSig = sig;
    return changed;
  }

  function getSortedPublishers(list) {
    const { col, dir } = pubSort;
    const mul = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (col) {
        case 'name':
          cmp = publisherName(a).localeCompare(publisherName(b), 'pt-BR', { sensitivity: 'base' });
          break;
        case 'services':
          cmp = publisherServiceKey(a).localeCompare(publisherServiceKey(b), 'pt-BR', { sensitivity: 'base' });
          break;
        case 'days':
          cmp = pubDaySortKey(a).localeCompare(pubDaySortKey(b), 'pt-BR', { sensitivity: 'base' });
          break;
        case 'grupo':
          cmp = parsePublisherNotes(a.notes).grupo.localeCompare(parsePublisherNotes(b.notes).grupo, 'pt-BR', { sensitivity: 'base' });
          break;
        case 'casa':
          cmp = parsePublisherNotes(a.notes).casa.localeCompare(parsePublisherNotes(b.notes).casa, 'pt-BR', { sensitivity: 'base' });
          break;
        case 'status':
          cmp = Number(a.is_active !== false) - Number(b.is_active !== false);
          break;
        default:
          cmp = publisherName(a).localeCompare(publisherName(b), 'pt-BR', { sensitivity: 'base' });
      }
      return cmp * mul;
    });
  }

  function getFilteredPublishers() {
    let list = publishers;
    const q = pubSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((row) => {
        const name = publisherName(row).toLowerCase();
        const { grupo, casa } = parsePublisherNotes(row.notes);
        return name.includes(q) || grupo.toLowerCase().includes(q) || casa.toLowerCase().includes(q);
      });
    }
    if (!xlf) return list;
    list = xlf.xlfApplyMapFilter(list, pubFilter.name, (p) => publisherName(p));
    list = xlf.xlfApplyMapFilter(list, pubFilter.services, (p) => publisherServiceKey(p));
    list = xlf.xlfApplyMapFilter(list, pubFilter.grupo, (p) => parsePublisherNotes(p.notes).grupo || '—');
    list = xlf.xlfApplyMapFilter(list, pubFilter.casa, (p) => parsePublisherNotes(p.notes).casa || '—');
    list = xlf.xlfApplyMapFilter(list, pubFilter.status, (p) => (p.is_active !== false ? 'active' : 'inactive'));
    if (xlf.xlfIsActive(pubFilter.days)) list = list.filter((row) => pubMatchesDayFilter(row));
    return getSortedPublishers(list);
  }

  function pubHeaderRow() {
    syncPubFilterOptions();
    const nameOpts = xlf.xlfOptionsFromKeys(Object.keys(pubFilter.name));
    const grupoOpts = xlf.xlfOptionsFromKeys(Object.keys(pubFilter.grupo));
    const casaOpts = xlf.xlfOptionsFromKeys(Object.keys(pubFilter.casa));
    const dayOpts = xlf.xlfOptionsFromKeys(Object.keys(pubFilter.days));
    return `
      ${xlf.xlfColumnHeader('pub-sort', pubSort, pubFilter, { col: 'name', label: 'Irmão(ã)', filterKey: 'name', options: nameOpts, wrap: 'span' })}
      ${xlf.xlfColumnHeader('pub-sort', pubSort, pubFilter, { col: 'services', label: 'Serviços', filterKey: 'services', options: PUB_SVC_OPTIONS, wrap: 'span' })}
      ${xlf.xlfColumnHeader('pub-sort', pubSort, pubFilter, { col: 'days', label: 'Dias', filterKey: 'days', options: dayOpts, wrap: 'span' })}
      ${xlf.xlfColumnHeader('pub-sort', pubSort, pubFilter, { col: 'grupo', label: 'Grupo', filterKey: 'grupo', options: grupoOpts, wrap: 'span' })}
      ${xlf.xlfColumnHeader('pub-sort', pubSort, pubFilter, { col: 'casa', label: 'Casa', filterKey: 'casa', options: casaOpts, wrap: 'span' })}
      ${xlf.xlfColumnHeader('pub-sort', pubSort, pubFilter, { col: 'status', label: 'Status', filterKey: 'status', options: PUB_STATUS_OPTIONS, wrap: 'span' })}
      <span class="terr-xlf-head-cell terr-xlf-head-cell--actions" aria-hidden="true"></span>`;
  }

  function bindPubFilters() {
    const scroll = document.querySelector('#eq-pub-list .eq-pub-scroll');
    if (!scroll || !xlf) return;
    scroll.dataset.xlfScope = 'pub';
    delete scroll.dataset.xlfBound;
    xlf.bindXlfPanel(scroll, 'pub-sort', pubFilter, pubSort, () => renderPublishersTable({ updateUi: true }));
  }

  function refreshPublishersView() {
    const list = document.getElementById('eq-pub-list');
    if (!list) return;
    if (!publishers.length) {
      renderPublishers();
      return;
    }
    if (!document.getElementById('eq-pub-table-body')) {
      renderPublishers();
      return;
    }
    const filtersChanged = syncPubFilterOptions();
    if (filtersChanged) {
      const head = list.querySelector('.eq-pub-row--head');
      if (head) head.innerHTML = pubHeaderRow();
      const scroll = list.querySelector('.eq-pub-scroll');
      if (scroll) {
        delete scroll.dataset.xlfBound;
        bindPubFilters();
      }
    }
    renderPublishersTable({ updateUi: filtersChanged });
  }

  function updatePublisherStats() {
    const active = publishers.filter((p) => p.is_active !== false);
    const countEl = document.getElementById('eq-pub-count');
    const statTotal = document.getElementById('eq-pub-stat-total');
    const statActive = document.getElementById('eq-pub-stat-active');
    const statCart = document.getElementById('eq-pub-stat-carrinho');
    const statDisplay = document.getElementById('eq-pub-stat-display');

    if (countEl) countEl.textContent = `${publishers.length} cadastrados`;
    if (statTotal) statTotal.textContent = String(publishers.length);
    if (statActive) statActive.textContent = String(active.length);
    if (statCart) statCart.textContent = String(publishers.filter((p) => p.can_carrinho).length);
    if (statDisplay) statDisplay.textContent = String(publishers.filter((p) => p.can_display).length);
  }

  function renderPublishersTable(opts = {}) {
    const { updateUi = false } = opts;
    const body = document.getElementById('eq-pub-table-body');
    const foot = document.getElementById('eq-pub-table-foot');
    const list = document.getElementById('eq-pub-list');
    if (!body) return;

    updatePublisherStats();
    if (updateUi && xlf) {
      xlf.xlfUpdateSortUI(list?.querySelector('.eq-pub-scroll'), 'pub-sort', pubSort);
      xlf.xlfUpdateFilterUI(list?.querySelector('.eq-pub-scroll'), pubFilter);
    }
    const filtered = getFilteredPublishers();

    if (!filtered.length) {
      body.innerHTML = `
        <div class="eq-pub-empty !border-0 !rounded-none">
          <span class="material-symbols-outlined" aria-hidden="true">search_off</span>
          <p class="text-sm">${publishers.length ? 'Nenhum publicador corresponde ao filtro.' : 'Nenhum publicador cadastrado.'}</p>
        </div>`;
      if (foot) foot.textContent = '';
      return;
    }

    body.innerHTML = filtered.map((row) => {
      const name = publisherName(row);
      const { grupo, casa } = parsePublisherNotes(row.notes);
      const isActive = row.is_active !== false;
      const inactiveClass = isActive ? '' : ' eq-pub-row--inactive';
      const statusHtml = isActive
        ? '<span class="eq-pub-status eq-pub-status--active">Ativo</span>'
        : '<span class="eq-pub-status eq-pub-status--inactive">Inativo</span>';
      const toggleTitle = isActive ? 'Desativar' : 'Reativar';
      const toggleIcon = isActive ? 'toggle_off' : 'toggle_on';
      const toggleClass = isActive ? 'eq-pub-icon-btn eq-pub-icon-btn--off' : 'eq-pub-icon-btn';

      return `
        <div class="eq-pub-row${inactiveClass}" data-pub-id="${row.id}" title="${escapeHtml(name)}">
          <span class="eq-pub-name">
            ${publisherAvatarHtml(row)}
            <span>${escapeHtml(name)}</span>
          </span>
          <span class="eq-pub-services">${renderPublisherServicePills(row)}</span>
          <span class="eq-pub-days" title="${escapeHtml((row.available_days || []).join(', '))}">${renderPublisherDayPills(row)}</span>
          <span class="eq-pub-meta">${grupo ? `<strong>Grupo:</strong> ${escapeHtml(grupo)}` : '—'}</span>
          <span class="eq-pub-meta">${casa ? `<strong>Casa:</strong> ${escapeHtml(casa)}` : '—'}</span>
          <span class="eq-pub-status-cell">${statusHtml}</span>
          <div class="eq-pub-actions">
            <button type="button" class="${toggleClass}" data-eq-toggle-pub="${row.id}" title="${toggleTitle}">
              <span class="material-symbols-outlined" aria-hidden="true">${toggleIcon}</span>
            </button>
          </div>
        </div>`;
    }).join('');

    if (foot) {
      const activeFilters = xlf
        ? Object.entries(pubFilter).filter(([, map]) => xlf.xlfIsActive(map)).length
        : 0;
      const filterNote = activeFilters
        ? ` · ${activeFilters} filtro${activeFilters === 1 ? '' : 's'} ativo${activeFilters === 1 ? '' : 's'}`
        : '';
      const suffix = filtered.length < publishers.length ? ` (${publishers.length} no total)` : '';
      foot.textContent = `Exibindo ${filtered.length} publicador${filtered.length === 1 ? '' : 'es'}${suffix}${filterNote}`;
    }
  }

  function renderPublishers() {
    const list = document.getElementById('eq-pub-list');
    if (!list) return;

    if (!publishers.length) {
      updatePublisherStats();
      list.innerHTML = `
        <div class="eq-pub-empty">
          <span class="material-symbols-outlined" aria-hidden="true">groups</span>
          <p class="text-sm font-semibold text-primary">Nenhum publicador cadastrado</p>
          <p class="text-xs mt-1">Use o botão <strong>Adicionar publicador</strong> para incluir irmãos aptos a carrinho ou display.</p>
        </div>`;
      return;
    }

    if (!document.getElementById('eq-pub-table-body')) {
      list.innerHTML = `
        <div class="eq-pub-scroll">
          <div class="eq-pub-panel">
            <div class="eq-pub-row eq-pub-row--head">${xlf ? pubHeaderRow() : `
              <span>Irmão(ã)</span>
              <span>Serviços</span>
              <span>Dias</span>
              <span>Grupo</span>
              <span>Casa</span>
              <span>Status</span>
              <span></span>`}
            </div>
            <div id="eq-pub-table-body"></div>
            <p id="eq-pub-table-foot" class="eq-pub-foot"></p>
          </div>
        </div>`;
      bindPubFilters();
    }

    renderPublishersTable({ updateUi: true });
  }

  function defaultSlotDraft(item) {
    return {
      id: item?.id || '',
      weekday_label: item?.weekday_label || helpers.EQUIPMENT_DAYS[0],
      period_label: item?.period_label || 'Manhã',
      slot_kind: item?.slot_kind || 'temporary',
      equipment_type: item?.equipment_type || 'carrinho',
      equipment_name: item?.equipment_name || '',
      location_name: item?.location_name || '',
      publisher_names: item?.publisher_names || '',
      sort_order: item?.sort_order ?? 0
    };
  }

  function startNewSlotInline() {
    inlineSlotDraft = { mode: 'new', ...defaultSlotDraft(null) };
    renderSchedule();
  }

  function startEditSlotInline(item) {
    if (!item) return;
    inlineSlotDraft = { mode: 'edit', ...defaultSlotDraft(item) };
    renderSchedule();
  }

  function cancelInlineSlot() {
    inlineSlotDraft = null;
    renderSchedule();
  }

  function renderInlineSlotEditor(draft) {
    const { dayOpts, periodOpts } = slotSelectOptions(draft.weekday_label, draft.period_label);
    return `
      <div class="eq-sched-editor" id="eq-inline-slot-form">
        <div class="eq-sched-editor__head">
          <span class="eq-sched-editor__title">${draft.mode === 'new' ? 'Nova linha' : 'Editar linha'}</span>
        </div>
        <div class="eq-sched-editor__grid">
          <label class="eq-sched-editor__field">
            <span>Dia</span>
            <select id="eq-inline-day" class="eq-sched-editor__input">${dayOpts}</select>
          </label>
          <label class="eq-sched-editor__field">
            <span>Período</span>
            <select id="eq-inline-period" class="eq-sched-editor__input">${periodOpts}</select>
          </label>
          <label class="eq-sched-editor__field">
            <span>Tipo</span>
            <select id="eq-inline-kind" class="eq-sched-editor__input">
              <option value="fixed" ${draft.slot_kind === 'fixed' ? 'selected' : ''}>Fixo (toda semana)</option>
              <option value="temporary" ${draft.slot_kind === 'temporary' ? 'selected' : ''}>Temporário (só esta semana)</option>
            </select>
          </label>
          <label class="eq-sched-editor__field">
            <span>Equipamento</span>
            <select id="eq-inline-type" class="eq-sched-editor__input">
              <option value="carrinho" ${draft.equipment_type === 'carrinho' ? 'selected' : ''}>Carrinho</option>
              <option value="display" ${draft.equipment_type === 'display' ? 'selected' : ''}>Display</option>
            </select>
          </label>
          <label class="eq-sched-editor__field eq-sched-editor__field--wide">
            <span>Nome do equipamento</span>
            <input id="eq-inline-equipment" class="eq-sched-editor__input" value="${escapeHtml(draft.equipment_name)}" placeholder="SOUZA, ALMEIDA, DAMASCENO…"/>
          </label>
          <label class="eq-sched-editor__field eq-sched-editor__field--wide">
            <span>Local</span>
            <input id="eq-inline-location" class="eq-sched-editor__input" value="${escapeHtml(draft.location_name)}" placeholder="Praça, endereço…"/>
          </label>
          <label class="eq-sched-editor__field">
            <span>Ordem</span>
            <input id="eq-inline-sort" type="number" class="eq-sched-editor__input" value="${escapeHtml(String(draft.sort_order ?? 0))}"/>
          </label>
        </div>
        <div class="eq-sched-editor__pubs">
          <span class="eq-sched-editor__pubs-label">Publicadores</span>
          <input type="hidden" id="eq-inline-publishers" value="${escapeHtml(draft.publisher_names)}"/>
          <div class="eq-slot-pub-picker">
            <div class="eq-slot-pub-picker__toolbar">
              <input id="eq-inline-pub-search" type="search" class="eq-sched-editor__input" placeholder="Buscar na lista…" autocomplete="off"/>
              <span class="eq-slot-pub-picker__hint" id="eq-inline-pub-hint">—</span>
            </div>
            <div id="eq-inline-pub-list" class="eq-slot-pub-picker__list" role="group" aria-label="Publicadores aptos"></div>
            <p class="eq-slot-pub-picker__summary eq-slot-pub-picker__summary--empty" id="eq-inline-pub-summary">Nenhum publicador selecionado</p>
          </div>
        </div>
        <div class="eq-sched-editor__foot">
          ${draft.mode === 'edit' ? '<button type="button" class="eq-modal-btn eq-modal-btn--danger" data-eq-inline-delete>Excluir</button>' : '<span></span>'}
          <div class="eq-sched-editor__foot-actions">
            <button type="button" class="eq-modal-btn eq-modal-btn--ghost" data-eq-inline-cancel>Cancelar</button>
            <button type="button" class="eq-modal-btn eq-modal-btn--primary" data-eq-inline-save>Salvar</button>
          </div>
        </div>
      </div>`;
  }

  function readInlineSlotPayload() {
    syncSlotPublishersField('eq-inline');
    const publisherNames = document.getElementById('eq-inline-publishers')?.value.trim() || '';
    const slotKind = document.getElementById('eq-inline-kind')?.value || 'temporary';
    return {
      id: inlineSlotDraft?.id || '',
      weekday_label: document.getElementById('eq-inline-day')?.value,
      period_label: document.getElementById('eq-inline-period')?.value,
      slot_kind: slotKind,
      week_start: slotKind === 'temporary' ? currentWeek : null,
      equipment_type: document.getElementById('eq-inline-type')?.value,
      equipment_name: document.getElementById('eq-inline-equipment')?.value.trim() || '',
      location_name: document.getElementById('eq-inline-location')?.value.trim() || '',
      publisher_names: publisherNames,
      sort_order: parseInt(document.getElementById('eq-inline-sort')?.value, 10) || 0,
      is_active: true,
      updated_at: new Date().toISOString()
    };
  }

  async function saveInlineSlot() {
    if (!inlineSlotDraft) return;
    const payload = readInlineSlotPayload();
    if (!payload.publisher_names) {
      showToast(toast, 'Selecione ao menos um publicador.', true);
      return;
    }
    if (!payload.equipment_name || !payload.location_name) {
      showToast(toast, 'Preencha nome do equipamento e local.', true);
      return;
    }

    const { id, ...data } = payload;
    const { error } = id
      ? await client.from('equipment_schedule_slots').update(data).eq('id', id)
      : await client.from('equipment_schedule_slots').insert(data);

    if (error) {
      showToast(toast, error.message, true);
      return;
    }

    showToast(toast, 'Linha salva.');
    inlineSlotDraft = null;
    await loadSlots();
  }

  async function deleteInlineSlot() {
    const id = inlineSlotDraft?.id;
    if (!id || !confirm('Excluir esta linha do cronograma?')) return;
    const { error } = await client.from('equipment_schedule_slots').delete().eq('id', id);
    if (error) showToast(toast, error.message, true);
    else {
      showToast(toast, 'Linha excluída.');
      inlineSlotDraft = null;
      await loadSlots();
    }
  }

  function renderScheduleRow(row) {
    return `
      <div class="eq-sched-row">
        <span><strong>${escapeHtml(row.weekday_label)}</strong> · ${escapeHtml(row.period_label)}</span>
        <span><span class="eq-slot-kind eq-slot-kind--${row.slot_kind === 'fixed' ? 'fixed' : 'temp'}">${row.slot_kind === 'fixed' ? 'Fixo' : 'Temp.'}</span></span>
        <span><span class="eq-type-pill${row.equipment_type === 'display' ? ' eq-type-pill--display' : ''}">${escapeHtml(helpers.EQUIPMENT_TYPES[row.equipment_type] || row.equipment_type)}</span></span>
        <span>${escapeHtml(row.publisher_names || '—')}</span>
        <span>${escapeHtml(row.equipment_name || '—')}</span>
        <span>${escapeHtml(row.location_name || '—')}</span>
        <span class="eq-row-actions">
          <button type="button" class="eq-row-btn" data-eq-edit-slot="${row.id}">Editar</button>
        </span>
      </div>`;
  }

  function renderSchedule() {
    const list = document.getElementById('eq-sched-list');
    const weekInput = document.getElementById('eq-week');
    if (weekInput) weekInput.value = currentWeek;
    if (!list) return;

    const rows = helpers.slotsForWeek(slots, currentWeek);
    const editingId = inlineSlotDraft?.mode === 'edit' ? inlineSlotDraft.id : '';
    const displayRows = editingId ? rows.filter((row) => row.id !== editingId) : rows;

    list.innerHTML = `
      <div class="eq-sched-card">
        <div class="eq-sched-row eq-sched-row--head">
          <span>Dia / período</span><span>Tipo</span><span>Equip.</span><span>Publicadores</span><span>Nome</span><span>Local</span><span></span>
        </div>
        ${inlineSlotDraft ? renderInlineSlotEditor(inlineSlotDraft) : ''}
        ${displayRows.length ? displayRows.map(renderScheduleRow).join('') : ''}
        ${!displayRows.length && !inlineSlotDraft ? `
          <div class="eq-sched-empty">
            Nenhuma linha para esta semana. Clique em <strong>Nova linha</strong> para começar.
          </div>` : ''}
      </div>`;

    if (inlineSlotDraft) {
      renderSlotPublisherPicker('eq-inline');
      document.getElementById('eq-inline-slot-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      document.getElementById('eq-inline-equipment')?.focus();
    }
  }

  function ensurePublisherModalPortal() {
    const modal = document.getElementById('eq-pub-modal');
    if (modal && modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
  }

  function resetPublisherForm() {
    const form = document.getElementById('eq-form-publisher');
    form?.reset();
    const carrinho = document.getElementById('eq-pub-carrinho');
    const display = document.getElementById('eq-pub-display');
    if (carrinho) carrinho.checked = true;
    if (display) display.checked = true;
    buildDayCheckboxes(document.getElementById('eq-pub-days'), 'eq-pub', helpers.EQUIPMENT_DAYS);
  }

  async function openPublisherModal() {
    ensurePublisherModalPortal();
    const modal = document.getElementById('eq-pub-modal');
    if (!modal) return;
    resetPublisherForm();
    await loadProfiles();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('eq-publisher-profile')?.focus();
  }

  function closePublisherModal() {
    const modal = document.getElementById('eq-pub-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    resetPublisherForm();
  }

  function copyWhatsApp() {
    const msg = helpers.generateWhatsAppEquipmentSchedule(currentWeek, slots);
    const wrap = document.getElementById('eq-whatsapp-wrap');
    const box = document.getElementById('eq-whatsapp');
    if (box) box.textContent = msg;
    if (wrap) wrap.classList.remove('hidden');

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(msg)
        .then(() => showToast(toast, 'Mensagem copiada para a área de transferência.'))
        .catch(() => showToast(toast, 'Mensagem gerada — copie manualmente.', false));
    } else {
      showToast(toast, 'Mensagem gerada abaixo.');
    }
  }

  async function init() {
    if (window.__JEAdminCarrinhosDisplaysInit) return;

    const profile = await guardPermission('agendamentos');
    if (!profile) return false;

    if (!helpers) throw new Error('Módulo de cronograma não carregou. Recarregue a página.');
    if (!xlf) throw new Error('Módulo de filtros da tabela não carregou. Recarregue a página.');

    toast = toastEl();
    client = await getClient();
    currentWeek = helpers.toISODate(helpers.getSunday(new Date()));

    setupTabs();
    fillSelectOptions();
    ensurePublisherModalPortal();

    document.getElementById('eq-week')?.addEventListener('change', (e) => {
      currentWeek = helpers.snapToWeekStart(e.target.value);
      inlineSlotDraft = null;
      renderSchedule();
      document.getElementById('eq-whatsapp-wrap')?.classList.add('hidden');
    });

    document.getElementById('eq-btn-new-slot')?.addEventListener('click', () => startNewSlotInline());
    document.getElementById('eq-btn-add-publisher')?.addEventListener('click', () => openPublisherModal());
    document.getElementById('eq-btn-whatsapp')?.addEventListener('click', copyWhatsApp);

    document.getElementById('eq-sched-list')?.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-eq-edit-slot]');
      if (editBtn) {
        startEditSlotInline(slots.find((s) => s.id === editBtn.dataset.eqEditSlot));
        return;
      }
      if (e.target.closest('[data-eq-inline-save]')) {
        await saveInlineSlot();
        return;
      }
      if (e.target.closest('[data-eq-inline-cancel]')) {
        cancelInlineSlot();
        return;
      }
      if (e.target.closest('[data-eq-inline-delete]')) {
        await deleteInlineSlot();
      }
    });

    document.getElementById('eq-sched-list')?.addEventListener('change', (e) => {
      if (!inlineSlotDraft) return;
      const form = document.getElementById('eq-inline-slot-form');
      if (!form?.contains(e.target)) return;
      if (e.target.name === 'eq-inline-pub') syncSlotPublishersField('eq-inline');
      if (e.target.id === 'eq-inline-day' || e.target.id === 'eq-inline-type') {
        syncSlotPublishersField('eq-inline');
        renderSlotPublisherPicker('eq-inline');
      }
    });

    document.getElementById('eq-sched-list')?.addEventListener('input', (e) => {
      if (e.target.id !== 'eq-inline-pub-search') return;
      syncSlotPublishersField('eq-inline');
      renderSlotPublisherPicker('eq-inline');
    });

    document.getElementById('eq-pub-modal-close')?.addEventListener('click', closePublisherModal);
    document.getElementById('eq-pub-cancel')?.addEventListener('click', closePublisherModal);
    document.getElementById('eq-pub-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'eq-pub-modal') closePublisherModal();
    });

    document.getElementById('eq-pub-search')?.addEventListener('input', (e) => {
      pubSearch = e.target.value;
      renderPublishersTable();
    });

    document.getElementById('eq-panel-publicadores')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-eq-toggle-pub]');
      if (!btn) return;
      const row = publishers.find((p) => p.id === btn.dataset.eqTogglePub);
      if (!row) return;
      const { error } = await client
        .from('equipment_publishers')
        .update({ is_active: row.is_active === false, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, row.is_active === false ? 'Publicador reativado.' : 'Publicador desativado.');
        await loadPublishers();
      }
    });

    document.getElementById('eq-form-publisher')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const profileId = document.getElementById('eq-publisher-profile').value;
      if (!profileId) return;
      const profileRow = profiles.find((p) => p.id === profileId);
      if (!profileRow) return;

      const dayInputs = document.querySelectorAll('#eq-pub-days input[name="eq-pub-day"]:checked');
      const availableDays = Array.from(dayInputs).map((input) => input.value);
      if (!availableDays.length) {
        showToast(toast, 'Selecione ao menos um dia.', true);
        return;
      }

      const { error } = await client.from('equipment_publishers').insert({
        profile_id: profileId,
        publisher_name: profileRow.full_name,
        can_carrinho: document.getElementById('eq-pub-carrinho').checked,
        can_display: document.getElementById('eq-pub-display').checked,
        available_days: availableDays,
        is_active: true,
        updated_at: new Date().toISOString()
      });

      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, 'Publicador adicionado.');
        closePublisherModal();
        await loadPublishers();
      }
    });

    try {
      await Promise.all([loadPublishers(), loadSlots()]);
    } catch (err) {
      console.error('Carrinhos e Displays:', err);
      const msg = String(err?.message || err);
      const list = document.getElementById('eq-sched-list');
      if (list) {
        list.innerHTML = `<div class="eq-sched-card p-5 text-sm text-error">Não foi possível carregar os dados.${msg ? ` (${escapeHtml(msg)})` : ''}</div>`;
      }
      showToast(toast, msg.includes('equipment_') ? 'Tabelas do cronograma ainda não existem no Supabase.' : msg, true);
      throw err;
    }

    window.__JEAdminCarrinhosDisplaysInit = true;
  }

  window.JEAdminCarrinhosDisplays = { init };
})();
