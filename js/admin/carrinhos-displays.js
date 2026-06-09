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
  const ITEM_UNDO_FIELDS = ['name', 'equipment_type', 'default_location', 'sort_order', 'notes'];
  const LOC_UNDO_FIELDS = ['name', 'sort_order', 'notes'];
  const SLOT_UNDO_FIELDS = [
    'weekday_label', 'period_label', 'slot_kind', 'week_start', 'equipment_type',
    'equipment_name', 'location_name', 'publisher_names', 'sort_order', 'is_active'
  ];
  const PUB_UNDO_FIELDS = ['publisher_name', 'can_carrinho', 'can_display', 'available_days', 'notes'];

  const UNDO_SCOPE = 'carrinhos-displays';

  function undoApi() {
    return window.JEHubUndo;
  }

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
  let inlineItemDraft = null;
  let inlineLocDraft = null;
  let equipmentItems = [];
  let itemSearch = '';
  let itemFilter = {
    name: {},
    type: { carrinho: true, display: true },
    location: {},
    status: { active: true, inactive: true }
  };
  let itemSort = { col: 'name', dir: 'asc' };
  let itemFilterSig = '';
  let locations = [];
  let locSearch = '';
  let locFilter = {
    name: {},
    status: { active: true, inactive: true }
  };
  let locSort = { col: 'name', dir: 'asc' };
  let locFilterSig = '';
  let catalogCache = { equipmentByType: null, locations: null };
  let inlinePubSearchTimer = null;

  function debounce(fn, wait) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  function invalidateCatalogCache() {
    catalogCache.equipmentByType = null;
    catalogCache.locations = null;
  }

  function enrichPublisherRow(row) {
    const parsed = parsePublisherNotes(row.notes);
    row._pubName = row.profiles?.full_name || row.publisher_name || '—';
    row._grupo = parsed.grupo;
    row._casa = parsed.casa;
    return row;
  }

  function normalizePublishers(list) {
    return (list || []).map(enrichPublisherRow);
  }

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

  function activeEquipmentForType(type) {
    if (!catalogCache.equipmentByType) {
      const byType = {};
      equipmentItems
        .filter((item) => item.is_active !== false)
        .forEach((item) => {
          if (!byType[item.equipment_type]) byType[item.equipment_type] = [];
          byType[item.equipment_type].push(item);
        });
      Object.values(byType).forEach((items) => {
        items.sort((a, b) => {
          const sortDiff = (a.sort_order || 0) - (b.sort_order || 0);
          if (sortDiff) return sortDiff;
          return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
        });
      });
      catalogCache.equipmentByType = byType;
    }
    return catalogCache.equipmentByType[type] || [];
  }

  function activeLocationsList() {
    if (!catalogCache.locations) {
      catalogCache.locations = locations
        .filter((loc) => loc.is_active !== false)
        .sort((a, b) => {
          const sortDiff = (a.sort_order || 0) - (b.sort_order || 0);
          if (sortDiff) return sortDiff;
          return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
        });
    }
    return catalogCache.locations;
  }

  function inlineEquipmentSelectOptions(type, selectedName) {
    const items = activeEquipmentForType(type);
    const known = new Set(items.map((item) => item.name));
    let html = '<option value="">Selecione…</option>';
    if (selectedName && !known.has(selectedName)) {
      html += `<option value="${escapeHtml(selectedName)}" selected>${escapeHtml(selectedName)}</option>`;
    }
    html += items.map((item) =>
      `<option value="${escapeHtml(item.name)}" ${item.name === selectedName ? 'selected' : ''}>${escapeHtml(item.name)}</option>`
    ).join('');
    return html;
  }

  function inlineLocationSelectOptions(selectedName) {
    const items = activeLocationsList();
    const known = new Set(items.map((loc) => loc.name));
    let html = '<option value="">Selecione…</option>';
    if (selectedName && !known.has(selectedName)) {
      html += `<option value="${escapeHtml(selectedName)}" selected>${escapeHtml(selectedName)}</option>`;
    }
    html += items.map((loc) =>
      `<option value="${escapeHtml(loc.name)}" ${loc.name === selectedName ? 'selected' : ''}>${escapeHtml(loc.name)}</option>`
    ).join('');
    return html;
  }

  function refreshInlineCatalogSelects() {
    const type = document.getElementById('eq-inline-type')?.value || 'carrinho';
    const equipSel = document.getElementById('eq-inline-equipment');
    const locSel = document.getElementById('eq-inline-location');
    if (equipSel) {
      const current = equipSel.value;
      const items = activeEquipmentForType(type);
      const nextName = items.some((item) => item.name === current) ? current : '';
      equipSel.innerHTML = inlineEquipmentSelectOptions(type, nextName);
    }
    if (locSel) {
      const currentLoc = locSel.value;
      locSel.innerHTML = inlineLocationSelectOptions(currentLoc);
    }
  }

  function applyInlineEquipmentDefaultLocation() {
    const type = document.getElementById('eq-inline-type')?.value;
    const name = document.getElementById('eq-inline-equipment')?.value;
    const locSel = document.getElementById('eq-inline-location');
    if (!type || !name || !locSel) return;
    const item = equipmentItems.find((row) => row.equipment_type === type && row.name === name);
    const defaultLoc = item?.default_location?.trim();
    if (!defaultLoc) return;
    if ([...locSel.options].some((opt) => opt.value === defaultLoc)) {
      locSel.value = defaultLoc;
    }
  }

  async function loadProfiles(editingProfileId, forceReload) {
    if (forceReload || !profiles.length) {
      const { data, error } = await client
        .from('profiles')
        .select('id, full_name, username, role, avatar_url')
        .order('full_name');
      if (error) throw error;
      profiles = data || [];
    }
    const select = document.getElementById('eq-publisher-profile');
    if (!select) return;
    const used = new Set(
      publishers
        .filter((p) => p.profile_id && p.profile_id !== editingProfileId)
        .map((p) => p.profile_id)
    );
    select.innerHTML = ['<option value="">Selecione…</option>']
      .concat(
        profiles
          .filter((p) => !used.has(p.id))
          .map((p) => `<option value="${p.id}">${escapeHtml(p.full_name)}</option>`)
      )
      .join('');
  }

  async function fetchPublishers() {
    const { data, error } = await client
      .from('equipment_publishers')
      .select('*, profiles(full_name, username, avatar_url, role)')
      .order('publisher_name');
    if (error) throw error;
    publishers = normalizePublishers(data || []);
  }

  async function loadPublishers() {
    await fetchPublishers();
    if (document.getElementById('eq-pub-table-body')) refreshPublishersView();
    else renderPublishers();
  }

  async function fetchEquipment() {
    const { data, error } = await client
      .from('equipment_items')
      .select('*')
      .order('sort_order')
      .order('name');
    if (error) throw error;
    equipmentItems = data || [];
    invalidateCatalogCache();
  }

  async function loadEquipment() {
    await fetchEquipment();
    if (document.getElementById('eq-item-table-body')) refreshEquipmentView();
    else renderEquipment();
  }

  function itemTypePill(row) {
    const isDisplay = row.equipment_type === 'display';
    return `<span class="eq-type-pill${isDisplay ? ' eq-type-pill--display' : ''}">${escapeHtml(helpers.EQUIPMENT_TYPES[row.equipment_type] || row.equipment_type)}</span>`;
  }

  function syncItemFilterOptions() {
    if (!xlf) return false;
    xlf.xlfEnsureKeys(
      itemFilter.name,
      [...new Set(equipmentItems.map((i) => i.name))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
      )
    );
    xlf.xlfEnsureKeys(
      itemFilter.location,
      [...new Set(equipmentItems.map((i) => i.default_location || '—'))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
      )
    );
    const sig = [itemFilter.name, itemFilter.location]
      .map((m) => Object.keys(m).join('\0'))
      .join('::');
    const changed = sig !== itemFilterSig;
    itemFilterSig = sig;
    return changed;
  }

  function getSortedItems(list) {
    const { col, dir } = itemSort;
    const mul = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (col) {
        case 'name':
          cmp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
          break;
        case 'type':
          cmp = a.equipment_type.localeCompare(b.equipment_type, 'pt-BR', { sensitivity: 'base' });
          break;
        case 'location':
          cmp = (a.default_location || '').localeCompare(b.default_location || '', 'pt-BR', { sensitivity: 'base' });
          break;
        case 'sort':
          cmp = (a.sort_order || 0) - (b.sort_order || 0);
          break;
        case 'status':
          cmp = Number(a.is_active !== false) - Number(b.is_active !== false);
          break;
        default:
          cmp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      }
      if (cmp === 0) cmp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      return cmp * mul;
    });
  }

  function getFilteredItems() {
    let list = equipmentItems;
    const q = itemSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((row) =>
        row.name.toLowerCase().includes(q)
        || (row.default_location || '').toLowerCase().includes(q)
        || (row.notes || '').toLowerCase().includes(q)
      );
    }
    if (!xlf) return list;
    list = xlf.xlfApplyMapFilter(list, itemFilter.name, (i) => i.name);
    list = xlf.xlfApplyMapFilter(list, itemFilter.type, (i) => i.equipment_type);
    list = xlf.xlfApplyMapFilter(list, itemFilter.location, (i) => i.default_location || '—');
    list = xlf.xlfApplyMapFilter(list, itemFilter.status, (i) => (i.is_active !== false ? 'active' : 'inactive'));
    return getSortedItems(list);
  }

  function itemHeaderRow() {
    syncItemFilterOptions();
    const nameOpts = xlf.xlfOptionsFromKeys(Object.keys(itemFilter.name));
    const locationOpts = xlf.xlfOptionsFromKeys(Object.keys(itemFilter.location));
    return `
      ${xlf.xlfColumnHeader('item-sort', itemSort, itemFilter, { col: 'name', label: 'Nome', filterKey: 'name', options: nameOpts, wrap: 'span' })}
      ${xlf.xlfColumnHeader('item-sort', itemSort, itemFilter, { col: 'type', label: 'Tipo', filterKey: 'type', options: ITEM_TYPE_OPTIONS, wrap: 'span' })}
      ${xlf.xlfColumnHeader('item-sort', itemSort, itemFilter, { col: 'location', label: 'Local padrão', filterKey: 'location', options: locationOpts, wrap: 'span' })}
      ${xlf.xlfColumnHeader('item-sort', itemSort, itemFilter, { col: 'sort', label: 'Ordem', wrap: 'span' })}
      ${xlf.xlfColumnHeader('item-sort', itemSort, itemFilter, { col: 'status', label: 'Status', filterKey: 'status', options: PUB_STATUS_OPTIONS, wrap: 'span' })}
      <span class="terr-xlf-head-cell terr-xlf-head-cell--actions" aria-hidden="true"></span>`;
  }

  function bindItemFilters() {
    const scroll = document.querySelector('#eq-item-list .eq-item-scroll');
    if (!scroll || !xlf) return;
    scroll.dataset.xlfScope = 'item';
    delete scroll.dataset.xlfBound;
    xlf.bindXlfPanel(scroll, 'item-sort', itemFilter, itemSort, () => renderEquipmentTable({ updateUi: true }));
  }

  function refreshEquipmentView() {
    const list = document.getElementById('eq-item-list');
    if (!list) return;
    if (!equipmentItems.length && !inlineItemDraft) {
      renderEquipment();
      return;
    }
    if (!document.getElementById('eq-item-table-body')) {
      renderEquipment();
      return;
    }
    const filtersChanged = syncItemFilterOptions();
    if (filtersChanged) {
      const head = list.querySelector('.eq-item-row--head');
      if (head) head.innerHTML = itemHeaderRow();
      const scroll = list.querySelector('.eq-item-scroll');
      if (scroll) {
        delete scroll.dataset.xlfBound;
        bindItemFilters();
      }
    }
    renderEquipmentTable({ updateUi: filtersChanged });
  }

  function updateItemStats() {
    const active = equipmentItems.filter((i) => i.is_active !== false);
    const countEl = document.getElementById('eq-item-count');
    const statTotal = document.getElementById('eq-item-stat-total');
    const statActive = document.getElementById('eq-item-stat-active');
    const statCart = document.getElementById('eq-item-stat-carrinho');
    const statDisplay = document.getElementById('eq-item-stat-display');

    if (countEl) countEl.textContent = `${equipmentItems.length} cadastrados`;
    if (statTotal) statTotal.textContent = String(equipmentItems.length);
    if (statActive) statActive.textContent = String(active.length);
    if (statCart) statCart.textContent = String(equipmentItems.filter((i) => i.equipment_type === 'carrinho').length);
    if (statDisplay) statDisplay.textContent = String(equipmentItems.filter((i) => i.equipment_type === 'display').length);
  }

  function renderEquipmentTable(opts = {}) {
    const { updateUi = false, stats = true } = opts;
    const body = document.getElementById('eq-item-table-body');
    const foot = document.getElementById('eq-item-table-foot');
    const list = document.getElementById('eq-item-list');
    if (!body) return;

    if (stats) updateItemStats();
    if (updateUi && xlf) {
      xlf.xlfUpdateSortUI(list?.querySelector('.eq-item-scroll'), 'item-sort', itemSort);
      xlf.xlfUpdateFilterUI(list?.querySelector('.eq-item-scroll'), itemFilter);
    }
    const filtered = getFilteredItems();
    const editingId = inlineItemDraft?.mode === 'edit' ? inlineItemDraft.id : '';
    const displayRows = editingId ? filtered.filter((row) => row.id !== editingId) : filtered;

    let bodyHtml = '';
    if (inlineItemDraft) bodyHtml += renderInlineItemEditor(inlineItemDraft);

    if (displayRows.length) {
      bodyHtml += displayRows.map((row) => {
      const isActive = row.is_active !== false;
      const inactiveClass = isActive ? '' : ' eq-item-row--inactive';
      const statusHtml = isActive
        ? '<span class="eq-pub-status eq-pub-status--active">Ativo</span>'
        : '<span class="eq-pub-status eq-pub-status--inactive">Inativo</span>';
      const toggleTitle = isActive ? 'Desativar' : 'Reativar';
      const toggleIcon = isActive ? 'toggle_off' : 'toggle_on';
      const toggleClass = isActive ? 'eq-pub-icon-btn eq-pub-icon-btn--off' : 'eq-pub-icon-btn';

      return `
        <div class="eq-item-row${inactiveClass}" data-item-id="${row.id}" title="${escapeHtml(row.name)}">
          <span class="eq-item-name">${escapeHtml(row.name)}</span>
          <span>${itemTypePill(row)}</span>
          <span class="eq-item-location">${escapeHtml(row.default_location || '—')}</span>
          <span class="eq-item-sort">${escapeHtml(String(row.sort_order ?? 0))}</span>
          <span class="eq-pub-status-cell">${statusHtml}</span>
          <span class="eq-pub-actions">
            <button type="button" class="eq-pub-icon-btn" data-eq-edit-item="${row.id}" title="Editar">
              <span class="material-symbols-outlined" aria-hidden="true">edit</span>
            </button>
            <button type="button" class="${toggleClass}" data-eq-toggle-item="${row.id}" title="${toggleTitle}">
              <span class="material-symbols-outlined" aria-hidden="true">${toggleIcon}</span>
            </button>
          </span>
        </div>`;
      }).join('');
    } else if (!inlineItemDraft) {
      bodyHtml = `
        <div class="eq-pub-empty !border-0 !rounded-none">
          <span class="material-symbols-outlined" aria-hidden="true">search_off</span>
          <p class="text-sm">${equipmentItems.length ? 'Nenhum equipamento corresponde ao filtro.' : 'Nenhum equipamento cadastrado.'}</p>
        </div>`;
    }

    body.innerHTML = bodyHtml;

    if (foot) {
      const shown = displayRows.length + (inlineItemDraft ? 1 : 0);
      const activeFilters = xlf
        ? Object.entries(itemFilter).filter(([, map]) => xlf.xlfIsActive(map)).length
        : 0;
      const filterNote = activeFilters
        ? ` · ${activeFilters} filtro${activeFilters === 1 ? '' : 's'} ativo${activeFilters === 1 ? '' : 's'}`
        : '';
      const suffix = filtered.length < equipmentItems.length ? ` (${equipmentItems.length} no total)` : '';
      foot.textContent = shown
        ? `Exibindo ${shown} equipamento${shown === 1 ? '' : 's'}${suffix}${filterNote}`
        : '';
    }

    if (inlineItemDraft) {
      document.getElementById('eq-inline-item-name')?.focus();
    }
  }

  function renderEquipment() {
    const list = document.getElementById('eq-item-list');
    if (!list) return;

    if (!equipmentItems.length && !inlineItemDraft) {
      updateItemStats();
      list.innerHTML = `
        <div class="eq-pub-empty">
          <span class="material-symbols-outlined" aria-hidden="true">inventory_2</span>
          <p class="text-sm font-semibold text-primary">Nenhum equipamento cadastrado</p>
          <p class="text-xs mt-1">Use o botão <strong>Adicionar equipamento</strong> para incluir carrinhos e displays.</p>
        </div>`;
      return;
    }

    if (!document.getElementById('eq-item-table-body')) {
      list.innerHTML = `
        <div class="eq-item-scroll">
          <div class="eq-item-panel">
            <div class="eq-item-row eq-item-row--head">${xlf ? itemHeaderRow() : `
              <span>Nome</span>
              <span>Tipo</span>
              <span>Local padrão</span>
              <span>Ordem</span>
              <span>Status</span>
              <span></span>`}
            </div>
            <div id="eq-item-table-body"></div>
            <p id="eq-item-table-foot" class="eq-pub-foot"></p>
          </div>
        </div>`;
      bindItemFilters();
    }

    renderEquipmentTable({ updateUi: true });
  }

  const EQUIPMENT_BRAND_SVG = {
    carrinho: '<svg class="eq-item-modal-svg eq-item-modal-svg--cart" viewBox="0 0 64 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="20" cy="72" r="4" fill="#3b5e97"/><circle cx="44" cy="72" r="4" fill="#3b5e97"/><rect x="12" y="62" width="40" height="6" rx="3" fill="#3b5e97"/><rect x="10" y="22" width="44" height="42" rx="3" fill="#3b5e97"/><rect x="10" y="50" width="44" height="3" rx="1.5" fill="#2b4b7a"/><rect x="10" y="36" width="44" height="3" rx="1.5" fill="#2b4b7a"/><rect x="14" y="24" width="16" height="11" rx="1" fill="#9dbcf2"/><rect x="33" y="24" width="16" height="11" rx="1" fill="#aac7ff"/><rect x="14" y="39" width="16" height="10" rx="1" fill="#d6e3ff"/><rect x="33" y="39" width="16" height="10" rx="1" fill="#9cbffe"/><rect x="13" y="53" width="11" height="8" rx="1" fill="#c8a96e"/><rect x="26" y="53" width="11" height="8" rx="1" fill="#c8a96e"/><rect x="39" y="53" width="11" height="8" rx="1" fill="#c8a96e"/><rect x="18" y="6" width="28" height="18" rx="2" fill="white" stroke="#3b5e97" stroke-width="1.5"/><rect x="18" y="2" width="28" height="18" rx="2" fill="white" stroke="#3b5e97" stroke-width="1.5"/><rect x="22" y="6" width="10" height="7" rx="1" fill="#d6e3ff"/><line x1="22" y1="16" x2="34" y2="16" stroke="#3b5e97" stroke-width="1.2" stroke-linecap="round"/><line x1="22" y1="19" x2="30" y2="19" stroke="#3b5e97" stroke-width="1.2" stroke-linecap="round"/></svg>',
    display: '<svg class="eq-item-modal-svg eq-item-modal-svg--display" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="8" y="52" width="48" height="5" rx="2.5" fill="#3b5e97"/><rect x="8" y="12" width="5" height="42" rx="2" fill="#3b5e97"/><rect x="51" y="12" width="5" height="42" rx="2" fill="#3b5e97"/><rect x="8" y="12" width="48" height="4" rx="2" fill="#3b5e97"/><rect x="8" y="34" width="48" height="4" rx="2" fill="#2b4b7a"/><rect x="14" y="14" width="16" height="18" rx="1.5" fill="#9dbcf2"/><rect x="33" y="14" width="16" height="18" rx="1.5" fill="#aac7ff"/><rect x="14" y="38" width="16" height="13" rx="1.5" fill="#d6e3ff"/><rect x="33" y="38" width="16" height="13" rx="1.5" fill="#9cbffe"/><rect x="16" y="16" width="6" height="5" rx="0.5" fill="#3b5e97" opacity="0.4"/><rect x="35" y="16" width="6" height="5" rx="0.5" fill="#3b5e97" opacity="0.4"/></svg>'
  };

  function ensureItemModalPortal() {
    const modal = document.getElementById('eq-item-modal');
    if (modal && modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
  }

  function mountItemModalArt() {
    const visual = document.getElementById('eq-item-modal-visual');
    if (visual && !visual.querySelector('svg')) {
      visual.innerHTML = EQUIPMENT_BRAND_SVG.carrinho;
    }
    const cartIcon = document.querySelector('.eq-item-type-card__icon--cart');
    const displayIcon = document.querySelector('.eq-item-type-card__icon--display');
    if (cartIcon && !cartIcon.querySelector('svg')) {
      cartIcon.insertAdjacentHTML('afterbegin', EQUIPMENT_BRAND_SVG.carrinho);
    }
    if (displayIcon && !displayIcon.querySelector('svg')) {
      displayIcon.insertAdjacentHTML('afterbegin', EQUIPMENT_BRAND_SVG.display);
    }
  }

  function populateItemLocationSelect(selectedName) {
    const select = document.getElementById('eq-item-location');
    if (!select) return;
    select.innerHTML = inlineLocationSelectOptions(selectedName || '');
  }

  function setItemModalType(type) {
    const next = type === 'display' ? 'display' : 'carrinho';
    const typeInput = document.getElementById('eq-item-type');
    const hero = document.getElementById('eq-item-modal-hero');
    const visual = document.getElementById('eq-item-modal-visual');
    if (typeInput) typeInput.value = next;
    if (hero) hero.dataset.type = next;
    if (visual) visual.innerHTML = EQUIPMENT_BRAND_SVG[next];
    document.querySelectorAll('[data-eq-item-type]').forEach((btn) => {
      const active = btn.dataset.eqItemType === next;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    syncItemModalPreview();
  }

  function syncItemModalPreview() {
    const type = document.getElementById('eq-item-type')?.value || 'carrinho';
    const name = document.getElementById('eq-item-name')?.value.trim();
    const typeLabel = helpers.EQUIPMENT_TYPES[type] || 'Equipamento';
    const preview = document.getElementById('eq-item-modal-preview');
    if (preview) {
      preview.textContent = name || `Novo ${typeLabel.toLowerCase()}`;
    }
  }

  function resetItemForm() {
    document.getElementById('eq-form-item')?.reset();
    document.getElementById('eq-item-id').value = '';
    document.getElementById('eq-item-sort').value = '0';
    setItemModalType('carrinho');
    populateItemLocationSelect('');
  }

  function openItemModal(item) {
    ensureItemModalPortal();
    mountItemModalArt();
    const modal = document.getElementById('eq-item-modal');
    if (!modal) return;
    resetItemForm();
    document.getElementById('eq-item-modal-title').textContent = item ? 'Editar equipamento' : 'Adicionar equipamento';
    if (item) {
      document.getElementById('eq-item-id').value = item.id;
      document.getElementById('eq-item-name').value = item.name;
      setItemModalType(item.equipment_type);
      populateItemLocationSelect(item.default_location || '');
      if (item.default_location) {
        document.getElementById('eq-item-location').value = item.default_location;
      }
      document.getElementById('eq-item-sort').value = String(item.sort_order ?? 0);
      document.getElementById('eq-item-notes').value = item.notes || '';
      syncItemModalPreview();
    }
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('eq-item-name')?.focus();
  }

  function closeItemModal() {
    const modal = document.getElementById('eq-item-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    resetItemForm();
  }

  async function saveItem(e) {
    e.preventDefault();
    const id = document.getElementById('eq-item-id').value;
    const payload = {
      name: document.getElementById('eq-item-name').value.trim(),
      equipment_type: document.getElementById('eq-item-type').value,
      default_location: document.getElementById('eq-item-location').value.trim(),
      sort_order: parseInt(document.getElementById('eq-item-sort').value, 10) || 0,
      notes: document.getElementById('eq-item-notes').value.trim() || null,
      updated_at: new Date().toISOString()
    };
    if (!payload.name) {
      showToast(toast, 'Informe o nome do equipamento.', true);
      return;
    }

    const beforeRow = id ? equipmentItems.find((item) => item.id === id) : null;
    if (id) {
      const { error } = await client.from('equipment_items').update(payload).eq('id', id);
      if (error) {
        showToast(toast, error.message.includes('equipment_items_name_type_unique')
          ? 'Já existe um equipamento com este nome e tipo.'
          : error.message, true);
        return;
      }
      undoApi()?.registerUpdate(UNDO_SCOPE, 'equipment_items', id, beforeRow, 'Equipamento', ITEM_UNDO_FIELDS);
    } else {
      const { data: inserted, error } = await client
        .from('equipment_items')
        .insert({ ...payload, is_active: true })
        .select('id')
        .single();
      if (error) {
        showToast(toast, error.message.includes('equipment_items_name_type_unique')
          ? 'Já existe um equipamento com este nome e tipo.'
          : error.message, true);
        return;
      }
      if (inserted?.id) undoApi()?.registerInsert(UNDO_SCOPE, 'equipment_items', inserted.id, 'Equipamento');
    }

    showToast(toast, id ? 'Equipamento atualizado.' : 'Equipamento adicionado.');
    closeItemModal();
    await loadEquipment();
  }

  function defaultItemDraft(item) {
    return {
      id: item?.id || '',
      name: item?.name || '',
      equipment_type: item?.equipment_type || 'carrinho',
      default_location: item?.default_location || '',
      sort_order: item?.sort_order ?? 0,
      notes: item?.notes || ''
    };
  }

  function startNewItemInline() {
    inlineItemDraft = { mode: 'new', ...defaultItemDraft(null) };
    renderEquipment();
  }

  function startEditItemInline(item) {
    if (!item) return;
    inlineItemDraft = { mode: 'edit', ...defaultItemDraft(item) };
    if (document.getElementById('eq-item-table-body')) renderEquipmentTable();
    else renderEquipment();
  }

  function cancelInlineItem() {
    inlineItemDraft = null;
    if (equipmentItems.length || document.getElementById('eq-item-table-body')) renderEquipmentTable();
    else renderEquipment();
  }

  function renderInlineItemEditor(draft) {
    const locOpts = inlineLocationSelectOptions(draft.default_location);
    return `
      <div class="eq-item-row eq-item-row--edit" id="eq-inline-item-form">
        <span><input id="eq-inline-item-name" type="text" class="eq-sched-inline-input" value="${escapeHtml(draft.name)}" placeholder="Nome…" autocomplete="off"/></span>
        <span>
          <select id="eq-inline-item-type" class="eq-sched-inline-input" title="Tipo">
            <option value="carrinho" ${draft.equipment_type === 'carrinho' ? 'selected' : ''}>Carrinho</option>
            <option value="display" ${draft.equipment_type === 'display' ? 'selected' : ''}>Display</option>
          </select>
        </span>
        <span><select id="eq-inline-item-location" class="eq-sched-inline-input" title="Local padrão">${locOpts}</select></span>
        <span><input id="eq-inline-item-sort" type="number" class="eq-sched-inline-input eq-sched-inline-input--sort" value="${escapeHtml(String(draft.sort_order ?? 0))}" title="Ordem"/></span>
        <span class="eq-inline-status-hint">${draft.mode === 'new' ? 'Novo' : '—'}</span>
        <span class="eq-row-actions eq-row-actions--icons">
          ${draft.mode === 'edit' ? '<button type="button" class="eq-row-btn eq-row-btn--danger" data-eq-inline-item-delete title="Excluir"><span class="material-symbols-outlined" aria-hidden="true">delete</span></button>' : ''}
          <button type="button" class="eq-row-btn eq-row-btn--ghost" data-eq-inline-item-cancel title="Cancelar"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>
          <button type="button" class="eq-row-btn eq-row-btn--save" data-eq-inline-item-save title="Salvar"><span class="material-symbols-outlined" aria-hidden="true">check</span></button>
        </span>
        <input type="hidden" id="eq-inline-item-notes" value="${escapeHtml(draft.notes || '')}"/>
      </div>`;
  }

  function readInlineItemPayload() {
    return {
      id: inlineItemDraft?.id || '',
      name: document.getElementById('eq-inline-item-name')?.value.trim() || '',
      equipment_type: document.getElementById('eq-inline-item-type')?.value || 'carrinho',
      default_location: document.getElementById('eq-inline-item-location')?.value.trim() || '',
      sort_order: parseInt(document.getElementById('eq-inline-item-sort')?.value, 10) || 0,
      notes: document.getElementById('eq-inline-item-notes')?.value.trim() || null,
      updated_at: new Date().toISOString()
    };
  }

  async function saveInlineItem() {
    if (!inlineItemDraft) return;
    const payload = readInlineItemPayload();
    if (!payload.name) {
      showToast(toast, 'Informe o nome do equipamento.', true);
      return;
    }
    const { id, ...data } = payload;
    const beforeRow = id ? equipmentItems.find((item) => item.id === id) : null;
    if (id) {
      const { error } = await client.from('equipment_items').update(data).eq('id', id);
      if (error) {
        showToast(toast, error.message.includes('equipment_items_name_type_unique')
          ? 'Já existe um equipamento com este nome e tipo.'
          : error.message, true);
        return;
      }
      undoApi()?.registerUpdate(UNDO_SCOPE, 'equipment_items', id, beforeRow, 'Equipamento', ITEM_UNDO_FIELDS);
    } else {
      const { data: inserted, error } = await client
        .from('equipment_items')
        .insert({ ...data, is_active: true })
        .select('id')
        .single();
      if (error) {
        showToast(toast, error.message.includes('equipment_items_name_type_unique')
          ? 'Já existe um equipamento com este nome e tipo.'
          : error.message, true);
        return;
      }
      if (inserted?.id) undoApi()?.registerInsert(UNDO_SCOPE, 'equipment_items', inserted.id, 'Equipamento');
    }

    showToast(toast, id ? 'Equipamento atualizado.' : 'Equipamento adicionado.');
    inlineItemDraft = null;
    await loadEquipment();
  }

  async function deleteInlineItem() {
    const id = inlineItemDraft?.id;
    if (!id || !confirm('Excluir este equipamento?')) return;
    const row = equipmentItems.find((item) => item.id === id);
    const { error } = await client.from('equipment_items').delete().eq('id', id);
    if (error) showToast(toast, error.message, true);
    else {
      if (row) undoApi()?.registerDelete(UNDO_SCOPE, 'equipment_items', { ...row }, 'Equipamento');
      showToast(toast, 'Equipamento excluído.');
      inlineItemDraft = null;
      await loadEquipment();
    }
  }

  async function fetchLocations() {
    const { data, error } = await client
      .from('equipment_locations')
      .select('*')
      .order('sort_order')
      .order('name');
    if (error) throw error;
    locations = data || [];
    invalidateCatalogCache();
  }

  async function loadLocations() {
    await fetchLocations();
    if (document.getElementById('eq-loc-table-body')) refreshLocationsView();
    else renderLocations();
  }

  function syncLocFilterOptions() {
    if (!xlf) return false;
    xlf.xlfEnsureKeys(
      locFilter.name,
      [...new Set(locations.map((l) => l.name))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
      )
    );
    const sig = Object.keys(locFilter.name).join('\0');
    const changed = sig !== locFilterSig;
    locFilterSig = sig;
    return changed;
  }

  function getSortedLocations(list) {
    const { col, dir } = locSort;
    const mul = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (col) {
        case 'name':
          cmp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
          break;
        case 'sort':
          cmp = (a.sort_order || 0) - (b.sort_order || 0);
          break;
        case 'status':
          cmp = Number(a.is_active !== false) - Number(b.is_active !== false);
          break;
        default:
          cmp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      }
      if (cmp === 0) cmp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      return cmp * mul;
    });
  }

  function getFilteredLocations() {
    let list = locations;
    const q = locSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((row) =>
        row.name.toLowerCase().includes(q)
        || (row.notes || '').toLowerCase().includes(q)
      );
    }
    if (!xlf) return list;
    list = xlf.xlfApplyMapFilter(list, locFilter.name, (l) => l.name);
    list = xlf.xlfApplyMapFilter(list, locFilter.status, (l) => (l.is_active !== false ? 'active' : 'inactive'));
    return getSortedLocations(list);
  }

  function locHeaderRow() {
    syncLocFilterOptions();
    const nameOpts = xlf.xlfOptionsFromKeys(Object.keys(locFilter.name));
    return `
      ${xlf.xlfColumnHeader('loc-sort', locSort, locFilter, { col: 'name', label: 'Local', filterKey: 'name', options: nameOpts, wrap: 'span' })}
      ${xlf.xlfColumnHeader('loc-sort', locSort, locFilter, { col: 'sort', label: 'Ordem', wrap: 'span' })}
      ${xlf.xlfColumnHeader('loc-sort', locSort, locFilter, { col: 'status', label: 'Status', filterKey: 'status', options: PUB_STATUS_OPTIONS, wrap: 'span' })}
      <span class="terr-xlf-head-cell terr-xlf-head-cell--actions" aria-hidden="true"></span>`;
  }

  function bindLocFilters() {
    const scroll = document.querySelector('#eq-loc-list .eq-loc-scroll');
    if (!scroll || !xlf) return;
    scroll.dataset.xlfScope = 'loc';
    delete scroll.dataset.xlfBound;
    xlf.bindXlfPanel(scroll, 'loc-sort', locFilter, locSort, () => renderLocationsTable({ updateUi: true }));
  }

  function refreshLocationsView() {
    const list = document.getElementById('eq-loc-list');
    if (!list) return;
    if (!locations.length && !inlineLocDraft) {
      renderLocations();
      return;
    }
    if (!document.getElementById('eq-loc-table-body')) {
      renderLocations();
      return;
    }
    const filtersChanged = syncLocFilterOptions();
    if (filtersChanged) {
      const head = list.querySelector('.eq-loc-row--head');
      if (head) head.innerHTML = locHeaderRow();
      const scroll = list.querySelector('.eq-loc-scroll');
      if (scroll) {
        delete scroll.dataset.xlfBound;
        bindLocFilters();
      }
    }
    renderLocationsTable({ updateUi: filtersChanged });
  }

  function updateLocStats() {
    const active = locations.filter((l) => l.is_active !== false);
    const countEl = document.getElementById('eq-loc-count');
    const statTotal = document.getElementById('eq-loc-stat-total');
    const statActive = document.getElementById('eq-loc-stat-active');

    if (countEl) countEl.textContent = `${locations.length} cadastrados`;
    if (statTotal) statTotal.textContent = String(locations.length);
    if (statActive) statActive.textContent = String(active.length);
  }

  function renderLocationsTable(opts = {}) {
    const { updateUi = false, stats = true } = opts;
    const body = document.getElementById('eq-loc-table-body');
    const foot = document.getElementById('eq-loc-table-foot');
    const list = document.getElementById('eq-loc-list');
    if (!body) return;

    if (stats) updateLocStats();
    if (updateUi && xlf) {
      xlf.xlfUpdateSortUI(list?.querySelector('.eq-loc-scroll'), 'loc-sort', locSort);
      xlf.xlfUpdateFilterUI(list?.querySelector('.eq-loc-scroll'), locFilter);
    }
    const filtered = getFilteredLocations();
    const editingId = inlineLocDraft?.mode === 'edit' ? inlineLocDraft.id : '';
    const displayRows = editingId ? filtered.filter((row) => row.id !== editingId) : filtered;

    let bodyHtml = '';
    if (inlineLocDraft) bodyHtml += renderInlineLocEditor(inlineLocDraft);

    if (displayRows.length) {
      bodyHtml += displayRows.map((row) => {
      const isActive = row.is_active !== false;
      const inactiveClass = isActive ? '' : ' eq-loc-row--inactive';
      const statusHtml = isActive
        ? '<span class="eq-pub-status eq-pub-status--active">Ativo</span>'
        : '<span class="eq-pub-status eq-pub-status--inactive">Inativo</span>';
      const toggleTitle = isActive ? 'Desativar' : 'Reativar';
      const toggleIcon = isActive ? 'toggle_off' : 'toggle_on';
      const toggleClass = isActive ? 'eq-pub-icon-btn eq-pub-icon-btn--off' : 'eq-pub-icon-btn';
      const notesHint = row.notes ? ` · ${row.notes}` : '';

      return `
        <div class="eq-loc-row${inactiveClass}" data-loc-id="${row.id}" title="${escapeHtml(row.name + notesHint)}">
          <span class="eq-loc-name">
            <span class="material-symbols-outlined eq-loc-pin" aria-hidden="true">location_on</span>
            <span>${escapeHtml(row.name)}</span>
          </span>
          <span class="eq-loc-sort">${escapeHtml(String(row.sort_order ?? 0))}</span>
          <span class="eq-pub-status-cell">${statusHtml}</span>
          <span class="eq-pub-actions">
            <button type="button" class="eq-pub-icon-btn" data-eq-edit-loc="${row.id}" title="Editar">
              <span class="material-symbols-outlined" aria-hidden="true">edit</span>
            </button>
            <button type="button" class="${toggleClass}" data-eq-toggle-loc="${row.id}" title="${toggleTitle}">
              <span class="material-symbols-outlined" aria-hidden="true">${toggleIcon}</span>
            </button>
          </span>
        </div>`;
      }).join('');
    } else if (!inlineLocDraft) {
      bodyHtml = `
        <div class="eq-pub-empty !border-0 !rounded-none">
          <span class="material-symbols-outlined" aria-hidden="true">search_off</span>
          <p class="text-sm">${locations.length ? 'Nenhum local corresponde ao filtro.' : 'Nenhum local cadastrado.'}</p>
        </div>`;
    }

    body.innerHTML = bodyHtml;

    if (foot) {
      const shown = displayRows.length + (inlineLocDraft ? 1 : 0);
      const activeFilters = xlf
        ? Object.entries(locFilter).filter(([, map]) => xlf.xlfIsActive(map)).length
        : 0;
      const filterNote = activeFilters
        ? ` · ${activeFilters} filtro${activeFilters === 1 ? '' : 's'} ativo${activeFilters === 1 ? '' : 's'}`
        : '';
      const suffix = filtered.length < locations.length ? ` (${locations.length} no total)` : '';
      foot.textContent = shown
        ? `Exibindo ${shown} local${shown === 1 ? '' : 'is'}${suffix}${filterNote}`
        : '';
    }

    if (inlineLocDraft) {
      document.getElementById('eq-inline-loc-name')?.focus();
    }
  }

  function renderLocations() {
    const list = document.getElementById('eq-loc-list');
    if (!list) return;

    if (!locations.length && !inlineLocDraft) {
      updateLocStats();
      list.innerHTML = `
        <div class="eq-pub-empty">
          <span class="material-symbols-outlined" aria-hidden="true">location_on</span>
          <p class="text-sm font-semibold text-primary">Nenhum local cadastrado</p>
          <p class="text-xs mt-1">Use o botão <strong>Adicionar local</strong> para cadastrar praças e pontos fixos.</p>
        </div>`;
      return;
    }

    if (!document.getElementById('eq-loc-table-body')) {
      list.innerHTML = `
        <div class="eq-loc-scroll">
          <div class="eq-loc-panel">
            <div class="eq-loc-row eq-loc-row--head">${xlf ? locHeaderRow() : `
              <span>Local</span>
              <span>Ordem</span>
              <span>Status</span>
              <span></span>`}
            </div>
            <div id="eq-loc-table-body"></div>
            <p id="eq-loc-table-foot" class="eq-pub-foot"></p>
          </div>
        </div>`;
      bindLocFilters();
    }

    renderLocationsTable({ updateUi: true });
  }

  function ensureLocModalPortal() {
    const modal = document.getElementById('eq-loc-modal');
    if (modal && modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
  }

  function syncLocModalPreview() {
    const name = document.getElementById('eq-loc-name')?.value.trim();
    const preview = document.getElementById('eq-loc-modal-preview');
    if (preview) preview.textContent = name || 'Novo local';
  }

  function resetLocForm() {
    document.getElementById('eq-form-loc')?.reset();
    document.getElementById('eq-loc-id').value = '';
    document.getElementById('eq-loc-sort').value = '0';
    syncLocModalPreview();
  }

  function openLocModal(row) {
    ensureLocModalPortal();
    const modal = document.getElementById('eq-loc-modal');
    if (!modal) return;
    resetLocForm();
    document.getElementById('eq-loc-modal-title').textContent = row ? 'Editar local' : 'Adicionar local';
    if (row) {
      document.getElementById('eq-loc-id').value = row.id;
      document.getElementById('eq-loc-name').value = row.name;
      document.getElementById('eq-loc-sort').value = String(row.sort_order ?? 0);
      document.getElementById('eq-loc-notes').value = row.notes || '';
      syncLocModalPreview();
    }
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('eq-loc-name')?.focus();
  }

  function closeLocModal() {
    const modal = document.getElementById('eq-loc-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    resetLocForm();
  }

  async function saveLoc(e) {
    e.preventDefault();
    const id = document.getElementById('eq-loc-id').value;
    const payload = {
      name: document.getElementById('eq-loc-name').value.trim(),
      sort_order: parseInt(document.getElementById('eq-loc-sort').value, 10) || 0,
      notes: document.getElementById('eq-loc-notes').value.trim() || null,
      updated_at: new Date().toISOString()
    };
    if (!payload.name) {
      showToast(toast, 'Informe o nome do local.', true);
      return;
    }

    const beforeRow = id ? locations.find((item) => item.id === id) : null;
    if (id) {
      const { error } = await client.from('equipment_locations').update(payload).eq('id', id);
      if (error) {
        showToast(toast, error.message.includes('equipment_locations_name_unique')
          ? 'Já existe um local com este nome.'
          : error.message, true);
        return;
      }
      undoApi()?.registerUpdate(UNDO_SCOPE, 'equipment_locations', id, beforeRow, 'Local', LOC_UNDO_FIELDS);
    } else {
      const { data: inserted, error } = await client
        .from('equipment_locations')
        .insert({ ...payload, is_active: true })
        .select('id')
        .single();
      if (error) {
        showToast(toast, error.message.includes('equipment_locations_name_unique')
          ? 'Já existe um local com este nome.'
          : error.message, true);
        return;
      }
      if (inserted?.id) undoApi()?.registerInsert(UNDO_SCOPE, 'equipment_locations', inserted.id, 'Local');
    }

    showToast(toast, id ? 'Local atualizado.' : 'Local adicionado.');
    closeLocModal();
    await loadLocations();
  }

  function defaultLocDraft(row) {
    return {
      id: row?.id || '',
      name: row?.name || '',
      sort_order: row?.sort_order ?? 0,
      notes: row?.notes || ''
    };
  }

  function startNewLocInline() {
    inlineLocDraft = { mode: 'new', ...defaultLocDraft(null) };
    renderLocations();
  }

  function startEditLocInline(row) {
    if (!row) return;
    inlineLocDraft = { mode: 'edit', ...defaultLocDraft(row) };
    if (document.getElementById('eq-loc-table-body')) renderLocationsTable();
    else renderLocations();
  }

  function cancelInlineLoc() {
    inlineLocDraft = null;
    if (locations.length || document.getElementById('eq-loc-table-body')) renderLocationsTable();
    else renderLocations();
  }

  function renderInlineLocEditor(draft) {
    return `
      <div class="eq-loc-row eq-loc-row--edit" id="eq-inline-loc-form">
        <span class="eq-loc-name">
          <span class="material-symbols-outlined eq-loc-pin" aria-hidden="true">location_on</span>
          <input id="eq-inline-loc-name" type="text" class="eq-sched-inline-input" value="${escapeHtml(draft.name)}" placeholder="Nome do local…" autocomplete="off"/>
        </span>
        <span><input id="eq-inline-loc-sort" type="number" class="eq-sched-inline-input eq-sched-inline-input--sort" value="${escapeHtml(String(draft.sort_order ?? 0))}" title="Ordem"/></span>
        <span class="eq-inline-status-hint">${draft.mode === 'new' ? 'Novo' : '—'}</span>
        <span class="eq-row-actions eq-row-actions--icons">
          ${draft.mode === 'edit' ? '<button type="button" class="eq-row-btn eq-row-btn--danger" data-eq-inline-loc-delete title="Excluir"><span class="material-symbols-outlined" aria-hidden="true">delete</span></button>' : ''}
          <button type="button" class="eq-row-btn eq-row-btn--ghost" data-eq-inline-loc-cancel title="Cancelar"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>
          <button type="button" class="eq-row-btn eq-row-btn--save" data-eq-inline-loc-save title="Salvar"><span class="material-symbols-outlined" aria-hidden="true">check</span></button>
        </span>
        <input type="hidden" id="eq-inline-loc-notes" value="${escapeHtml(draft.notes || '')}"/>
      </div>`;
  }

  function readInlineLocPayload() {
    return {
      id: inlineLocDraft?.id || '',
      name: document.getElementById('eq-inline-loc-name')?.value.trim() || '',
      sort_order: parseInt(document.getElementById('eq-inline-loc-sort')?.value, 10) || 0,
      notes: document.getElementById('eq-inline-loc-notes')?.value.trim() || null,
      updated_at: new Date().toISOString()
    };
  }

  async function saveInlineLoc() {
    if (!inlineLocDraft) return;
    const payload = readInlineLocPayload();
    if (!payload.name) {
      showToast(toast, 'Informe o nome do local.', true);
      return;
    }
    const { id, ...data } = payload;
    const beforeRow = id ? locations.find((item) => item.id === id) : null;
    if (id) {
      const { error } = await client.from('equipment_locations').update(data).eq('id', id);
      if (error) {
        showToast(toast, error.message.includes('equipment_locations_name_unique')
          ? 'Já existe um local com este nome.'
          : error.message, true);
        return;
      }
      undoApi()?.registerUpdate(UNDO_SCOPE, 'equipment_locations', id, beforeRow, 'Local', LOC_UNDO_FIELDS);
    } else {
      const { data: inserted, error } = await client
        .from('equipment_locations')
        .insert({ ...data, is_active: true })
        .select('id')
        .single();
      if (error) {
        showToast(toast, error.message.includes('equipment_locations_name_unique')
          ? 'Já existe um local com este nome.'
          : error.message, true);
        return;
      }
      if (inserted?.id) undoApi()?.registerInsert(UNDO_SCOPE, 'equipment_locations', inserted.id, 'Local');
    }

    showToast(toast, id ? 'Local atualizado.' : 'Local adicionado.');
    inlineLocDraft = null;
    await loadLocations();
  }

  async function deleteInlineLoc() {
    const id = inlineLocDraft?.id;
    if (!id || !confirm('Excluir este local?')) return;
    const row = locations.find((item) => item.id === id);
    const { error } = await client.from('equipment_locations').delete().eq('id', id);
    if (error) showToast(toast, error.message, true);
    else {
      if (row) undoApi()?.registerDelete(UNDO_SCOPE, 'equipment_locations', { ...row }, 'Local');
      showToast(toast, 'Local excluído.');
      inlineLocDraft = null;
      await loadLocations();
    }
  }

  function publisherName(row) {
    return row._pubName || row.profiles?.full_name || row.publisher_name || '—';
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
    const btn = document.querySelector(`[data-eq-inline-pub-toggle]`);
    if (!summary) return;
    const names = getSelectedSlotPublisherNames(prefix);
    if (!names.length) {
      summary.textContent = 'Selecionar…';
      summary.removeAttribute('title');
      btn?.classList.add('eq-sched-pub-btn--empty');
      return;
    }
    btn?.classList.remove('eq-sched-pub-btn--empty');
    summary.title = names.join(', ');
    summary.textContent = names.length === 1 ? names[0] : `${names.length} pub.`;
  }

  function renderSlotPublisherPicker(prefix = 'eq-inline') {
    const container = document.getElementById(`${prefix}-pub-list`);
    const hint = document.getElementById(`${prefix}-pub-hint`);
    const hidden = document.getElementById(`${prefix}-publishers`);
    if (!container) return;

    const day = document.getElementById(`${prefix}-day`)?.value || helpers.DEFAULT_SLOT_DAY || helpers.EQUIPMENT_DAYS[0];
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

  async function fetchSlots() {
    const { data, error } = await client
      .from('equipment_schedule_slots')
      .select('*')
      .order('sort_order');
    if (error) throw error;
    slots = data || [];
  }

  async function loadSlots() {
    await fetchSlots();
    renderSchedule();
  }

  function refreshAllViews() {
    renderSchedule();
    if (document.getElementById('eq-pub-table-body')) refreshPublishersView();
    else renderPublishers();
    if (document.getElementById('eq-item-table-body')) refreshEquipmentView();
    else renderEquipment();
    if (document.getElementById('eq-loc-table-body')) refreshLocationsView();
    else renderLocations();
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

  function formatPublisherNotes(grupo, casa) {
    const parts = [];
    if (grupo) parts.push(`Grupo: ${grupo}`);
    if (casa) parts.push(`Casa: ${casa}`);
    return parts.length ? parts.join(' · ') : null;
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
      [...new Set(publishers.map((p) => p._grupo || '—'))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
      )
    );
    xlf.xlfEnsureKeys(
      pubFilter.casa,
      [...new Set(publishers.map((p) => p._casa || '—'))].sort((a, b) =>
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
          cmp = (a._grupo || '').localeCompare(b._grupo || '', 'pt-BR', { sensitivity: 'base' });
          break;
        case 'casa':
          cmp = (a._casa || '').localeCompare(b._casa || '', 'pt-BR', { sensitivity: 'base' });
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
        const grupo = (row._grupo || '').toLowerCase();
        const casa = (row._casa || '').toLowerCase();
        return name.includes(q) || grupo.includes(q) || casa.includes(q);
      });
    }
    if (!xlf) return list;
    list = xlf.xlfApplyMapFilter(list, pubFilter.name, (p) => publisherName(p));
    list = xlf.xlfApplyMapFilter(list, pubFilter.services, (p) => publisherServiceKey(p));
    list = xlf.xlfApplyMapFilter(list, pubFilter.grupo, (p) => p._grupo || '—');
    list = xlf.xlfApplyMapFilter(list, pubFilter.casa, (p) => p._casa || '—');
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
    const { updateUi = false, stats = true } = opts;
    const body = document.getElementById('eq-pub-table-body');
    const foot = document.getElementById('eq-pub-table-foot');
    const list = document.getElementById('eq-pub-list');
    if (!body) return;

    if (stats) updatePublisherStats();
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
      const grupo = row._grupo || '';
      const casa = row._casa || '';
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
            <button type="button" class="eq-pub-icon-btn" data-eq-edit-pub="${row.id}" title="Editar">
              <span class="material-symbols-outlined" aria-hidden="true">edit</span>
            </button>
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
      weekday_label: item?.weekday_label || helpers.DEFAULT_SLOT_DAY || helpers.EQUIPMENT_DAYS[1] || helpers.EQUIPMENT_DAYS[0],
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
    closeInlinePubPop();
    renderSchedule();
  }

  function closeInlinePubPop() {
    const pop = document.getElementById('eq-inline-pub-pop');
    if (!pop) return;
    pop.classList.add('hidden');
    pop.classList.remove('eq-sched-pub-pop--floating');
    pop.style.top = '';
    pop.style.left = '';
    pop.style.minWidth = '';
    pop.style.visibility = '';
  }

  function positionInlinePubPop(btn) {
    const pop = document.getElementById('eq-inline-pub-pop');
    if (!pop || !btn) return;
    pop.classList.remove('hidden');
    pop.classList.add('eq-sched-pub-pop--floating');
    pop.style.visibility = 'hidden';
    requestAnimationFrame(() => {
      const rect = btn.getBoundingClientRect();
      const popRect = pop.getBoundingClientRect();
      const margin = 8;
      let top = rect.bottom + 4;
      let left = rect.left;
      if (left + popRect.width > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - popRect.width - margin);
      }
      if (top + popRect.height > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - popRect.height - 4);
      }
      pop.style.top = `${Math.round(top)}px`;
      pop.style.left = `${Math.round(left)}px`;
      pop.style.minWidth = `${Math.round(Math.max(rect.width, 17.5 * 16))}px`;
      pop.style.visibility = '';
    });
  }

  function openInlinePubPop(btn) {
    renderSlotPublisherPicker('eq-inline');
    positionInlinePubPop(btn);
    document.getElementById('eq-inline-pub-search')?.focus();
  }

  function renderInlineSlotEditor(draft) {
    const { dayOpts, periodOpts } = slotSelectOptions(draft.weekday_label, draft.period_label);
    const pubNames = parsePublisherNames(draft.publisher_names);
    const pubSummary = !pubNames.length ? 'Selecionar…' : (pubNames.length === 1 ? pubNames[0] : `${pubNames.length} pub.`);
    const equipOpts = inlineEquipmentSelectOptions(draft.equipment_type, draft.equipment_name);
    const locOpts = inlineLocationSelectOptions(draft.location_name);
    return `
      <div class="eq-sched-row eq-sched-row--edit" id="eq-inline-slot-form">
        <span class="eq-sched-inline-cell eq-sched-inline-cell--day">
          <select id="eq-inline-day" class="eq-sched-inline-input" title="Dia">${dayOpts}</select>
          <select id="eq-inline-period" class="eq-sched-inline-input eq-sched-inline-input--period" title="Período">${periodOpts}</select>
        </span>
        <span>
          <select id="eq-inline-kind" class="eq-sched-inline-input" title="Tipo de linha">
            <option value="fixed" ${draft.slot_kind === 'fixed' ? 'selected' : ''}>Fixo</option>
            <option value="temporary" ${draft.slot_kind === 'temporary' ? 'selected' : ''}>Temp.</option>
          </select>
        </span>
        <span>
          <select id="eq-inline-type" class="eq-sched-inline-input" title="Equipamento">
            <option value="carrinho" ${draft.equipment_type === 'carrinho' ? 'selected' : ''}>Carrinho</option>
            <option value="display" ${draft.equipment_type === 'display' ? 'selected' : ''}>Display</option>
          </select>
        </span>
        <span class="eq-sched-inline-cell eq-sched-inline-cell--pubs">
          <input type="hidden" id="eq-inline-publishers" value="${escapeHtml(draft.publisher_names)}"/>
          <button type="button" class="eq-sched-pub-btn${pubNames.length ? '' : ' eq-sched-pub-btn--empty'}" data-eq-inline-pub-toggle title="Selecionar publicadores">
            <span class="material-symbols-outlined" aria-hidden="true">group</span>
            <span id="eq-inline-pub-summary" class="eq-sched-pub-btn__text">${escapeHtml(pubSummary)}</span>
          </button>
          <div class="eq-sched-pub-pop hidden" id="eq-inline-pub-pop" role="dialog" aria-label="Publicadores">
            <div class="eq-slot-pub-picker eq-slot-pub-picker--pop">
              <div class="eq-slot-pub-picker__toolbar">
                <input id="eq-inline-pub-search" type="search" class="eq-sched-inline-input" placeholder="Buscar…" autocomplete="off"/>
                <span class="eq-slot-pub-picker__hint" id="eq-inline-pub-hint">—</span>
              </div>
              <div id="eq-inline-pub-list" class="eq-slot-pub-picker__list" role="group" aria-label="Publicadores aptos"></div>
            </div>
          </div>
        </span>
        <span>
          <select id="eq-inline-equipment" class="eq-sched-inline-input" title="Equipamento (aba Equipamentos)">${equipOpts}</select>
        </span>
        <span>
          <select id="eq-inline-location" class="eq-sched-inline-input" title="Local (aba Locais)">${locOpts}</select>
        </span>
        <span class="eq-row-actions eq-row-actions--icons">
          ${draft.mode === 'edit' ? '<button type="button" class="eq-row-btn eq-row-btn--danger" data-eq-inline-delete title="Excluir linha"><span class="material-symbols-outlined" aria-hidden="true">delete</span></button>' : ''}
          <button type="button" class="eq-row-btn eq-row-btn--ghost" data-eq-inline-cancel title="Cancelar"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>
          <button type="button" class="eq-row-btn eq-row-btn--save" data-eq-inline-save title="Salvar linha"><span class="material-symbols-outlined" aria-hidden="true">check</span></button>
        </span>
        <input type="hidden" id="eq-inline-sort" value="${escapeHtml(String(draft.sort_order ?? 0))}"/>
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
      showToast(toast, 'Selecione equipamento e local.', true);
      return;
    }

    const { id, ...data } = payload;
    const beforeRow = id ? slots.find((item) => item.id === id) : null;
    if (id) {
      const { error } = await client.from('equipment_schedule_slots').update(data).eq('id', id);
      if (error) {
        showToast(toast, error.message, true);
        return;
      }
      undoApi()?.registerUpdate(UNDO_SCOPE, 'equipment_schedule_slots', id, beforeRow, 'Linha do cronograma', SLOT_UNDO_FIELDS);
    } else {
      const { data: inserted, error } = await client
        .from('equipment_schedule_slots')
        .insert(data)
        .select('id')
        .single();
      if (error) {
        showToast(toast, error.message, true);
        return;
      }
      if (inserted?.id) {
        undoApi()?.registerInsert(UNDO_SCOPE, 'equipment_schedule_slots', inserted.id, 'Linha do cronograma');
      }
    }

    showToast(toast, 'Linha salva.');
    inlineSlotDraft = null;
    closeInlinePubPop();
    await loadSlots();
  }

  async function deleteInlineSlot() {
    const id = inlineSlotDraft?.id;
    if (!id || !confirm('Excluir esta linha do cronograma?')) return;
    const row = slots.find((item) => item.id === id);
    const { error } = await client.from('equipment_schedule_slots').delete().eq('id', id);
    if (error) showToast(toast, error.message, true);
    else {
      if (row) undoApi()?.registerDelete(UNDO_SCOPE, 'equipment_schedule_slots', { ...row }, 'Linha do cronograma');
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

  function syncEqWeekInput() {
    const weekInput = document.getElementById('eq-week');
    if (!weekInput || !window.JEWeekInput) return;
    weekInput.value = window.JEWeekInput.weekInputFromSunday(currentWeek);
  }

  function renderSchedule() {
    const list = document.getElementById('eq-sched-list');
    syncEqWeekInput();
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
      document.getElementById('eq-inline-day')?.focus();
    }
  }

  function ensurePublisherModalPortal() {
    const modal = document.getElementById('eq-pub-modal');
    if (modal && modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
  }

  function renderPubModalAvatar(profile) {
    const host = document.getElementById('eq-pub-modal-avatar');
    if (!host) return;
    if (profile && window.JEAuth?.renderAvatarHtml) {
      host.innerHTML = window.JEAuth.renderAvatarHtml(profile, { size: 72, className: 'je-profile-avatar' });
      return;
    }
    host.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">groups</span>';
  }

  function syncPubModalPreview(row) {
    const preview = document.getElementById('eq-pub-modal-preview');
    if (!preview) return;
    if (row) {
      preview.textContent = publisherName(row);
      renderPubModalAvatar(row.profiles || profiles.find((p) => p.id === row.profile_id));
      return;
    }
    const profileId = document.getElementById('eq-publisher-profile')?.value;
    const profile = profiles.find((p) => p.id === profileId);
    preview.textContent = profile?.full_name || 'Selecione um irmão(ã)';
    renderPubModalAvatar(profile || null);
  }

  function updatePubSubmitLabel(isEdit) {
    const submitBtn = document.getElementById('eq-pub-submit');
    if (!submitBtn) return;
    submitBtn.innerHTML = isEdit
      ? '<span class="material-symbols-outlined" aria-hidden="true">save</span> Salvar'
      : '<span class="material-symbols-outlined" aria-hidden="true">person_add</span> Adicionar';
  }

  function resetPublisherForm() {
    const form = document.getElementById('eq-form-publisher');
    form?.reset();
    document.getElementById('eq-pub-id').value = '';
    const carrinho = document.getElementById('eq-pub-carrinho');
    const display = document.getElementById('eq-pub-display');
    if (carrinho) carrinho.checked = true;
    if (display) display.checked = true;
    document.getElementById('eq-pub-grupo').value = '';
    document.getElementById('eq-pub-casa').value = '';
    document.getElementById('eq-pub-profile-wrap')?.classList.remove('hidden');
    document.getElementById('eq-pub-edit-name')?.classList.add('hidden');
    document.getElementById('eq-publisher-profile')?.setAttribute('required', '');
    buildDayCheckboxes(document.getElementById('eq-pub-days'), 'eq-pub', helpers.EQUIPMENT_DAYS);
    const title = document.getElementById('eq-pub-modal-title');
    if (title) title.textContent = 'Adicionar publicador';
    updatePubSubmitLabel(false);
    syncPubModalPreview(null);
  }

  async function openPublisherModal(row) {
    ensurePublisherModalPortal();
    const modal = document.getElementById('eq-pub-modal');
    if (!modal) return;
    resetPublisherForm();

    if (row) {
      document.getElementById('eq-pub-id').value = row.id;
      document.getElementById('eq-pub-modal-title').textContent = 'Editar publicador';
      updatePubSubmitLabel(true);
      document.getElementById('eq-pub-profile-wrap')?.classList.add('hidden');
      document.getElementById('eq-publisher-profile')?.removeAttribute('required');
      const editNameText = document.getElementById('eq-pub-edit-name-text');
      if (editNameText) editNameText.textContent = publisherName(row);
      document.getElementById('eq-pub-carrinho').checked = row.can_carrinho !== false;
      document.getElementById('eq-pub-display').checked = row.can_display !== false;
      buildDayCheckboxes(
        document.getElementById('eq-pub-days'),
        'eq-pub',
        row.available_days?.length ? row.available_days : helpers.EQUIPMENT_DAYS
      );
      document.getElementById('eq-pub-grupo').value = row._grupo || '';
      document.getElementById('eq-pub-casa').value = row._casa || '';
      syncPubModalPreview(row);
    } else {
      await loadProfiles();
      syncPubModalPreview(null);
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    if (row) document.getElementById('eq-pub-grupo')?.focus();
    else document.getElementById('eq-publisher-profile')?.focus();
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

  function openVolunteerWhatsApp() {
    const msg = helpers.generateVolunteerOutreachMessage();
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(msg)
        .then(() => showToast(toast, 'WhatsApp aberto — mensagem também copiada.'))
        .catch(() => showToast(toast, 'WhatsApp aberto com a mensagem pronta.'));
    } else {
      showToast(toast, 'WhatsApp aberto com a mensagem pronta.');
    }
  }

  async function init() {
    if (window.__JEAdminCarrinhosDisplaysInit) return true;

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
    ensureItemModalPortal();
    ensureLocModalPortal();

    document.getElementById('eq-week')?.addEventListener('change', (e) => {
      currentWeek = window.JEWeekInput?.sundayFromWeekInput(e.target.value)
        || helpers.snapToWeekStart(e.target.value);
      inlineSlotDraft = null;
      renderSchedule();
      document.getElementById('eq-whatsapp-wrap')?.classList.add('hidden');
    });

    document.getElementById('eq-btn-new-slot')?.addEventListener('click', () => startNewSlotInline());
    document.getElementById('eq-btn-add-publisher')?.addEventListener('click', () => openPublisherModal(null));
    document.getElementById('eq-btn-add-item')?.addEventListener('click', () => openItemModal(null));
    document.getElementById('eq-btn-add-loc')?.addEventListener('click', () => openLocModal(null));
    document.getElementById('eq-form-item')?.addEventListener('submit', saveItem);
    document.getElementById('eq-item-cancel')?.addEventListener('click', closeItemModal);
    document.getElementById('eq-item-modal-close')?.addEventListener('click', closeItemModal);
    document.getElementById('eq-item-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'eq-item-modal') closeItemModal();
    });
    document.getElementById('eq-item-name')?.addEventListener('input', syncItemModalPreview);
    document.querySelectorAll('[data-eq-item-type]').forEach((btn) => {
      btn.addEventListener('click', () => setItemModalType(btn.dataset.eqItemType));
    });
    document.getElementById('eq-form-loc')?.addEventListener('submit', saveLoc);
    document.getElementById('eq-loc-cancel')?.addEventListener('click', closeLocModal);
    document.getElementById('eq-loc-modal-close')?.addEventListener('click', closeLocModal);
    document.getElementById('eq-loc-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'eq-loc-modal') closeLocModal();
    });
    document.getElementById('eq-loc-name')?.addEventListener('input', syncLocModalPreview);
    document.getElementById('eq-btn-whatsapp')?.addEventListener('click', copyWhatsApp);
    document.getElementById('eq-btn-whatsapp-volunteers')?.addEventListener('click', openVolunteerWhatsApp);

    document.getElementById('eq-sched-list')?.addEventListener('click', async (e) => {
      const pubToggle = e.target.closest('[data-eq-inline-pub-toggle]');
      if (pubToggle) {
        e.stopPropagation();
        const pop = document.getElementById('eq-inline-pub-pop');
        if (!pop) return;
        if (pop.classList.contains('hidden')) openInlinePubPop(pubToggle);
        else closeInlinePubPop();
        return;
      }

      const pop = document.getElementById('eq-inline-pub-pop');
      if (pop && !pop.classList.contains('hidden') && !pop.contains(e.target) && !e.target.closest('[data-eq-inline-pub-toggle]')) {
        closeInlinePubPop();
      }

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
      if (e.target.name === 'eq-inline-pub') {
        syncSlotPublishersField('eq-inline');
        return;
      }
      if (e.target.id === 'eq-inline-equipment') {
        applyInlineEquipmentDefaultLocation();
        return;
      }
      const form = document.getElementById('eq-inline-slot-form');
      if (!form?.contains(e.target)) return;
      if (e.target.id === 'eq-inline-day' || e.target.id === 'eq-inline-type') {
        syncSlotPublishersField('eq-inline');
        if (e.target.id === 'eq-inline-type') refreshInlineCatalogSelects();
        const pop = document.getElementById('eq-inline-pub-pop');
        if (pop && !pop.classList.contains('hidden')) {
          renderSlotPublisherPicker('eq-inline');
          positionInlinePubPop(document.querySelector('[data-eq-inline-pub-toggle]'));
        }
      }
    });

    document.getElementById('eq-sched-list')?.addEventListener('input', (e) => {
      if (e.target.id !== 'eq-inline-pub-search') return;
      syncSlotPublishersField('eq-inline');
      clearTimeout(inlinePubSearchTimer);
      inlinePubSearchTimer = setTimeout(() => renderSlotPublisherPicker('eq-inline'), 120);
    });

    if (!window.__JEInlinePubPopBound) {
      window.__JEInlinePubPopBound = true;
      document.addEventListener('scroll', (e) => {
        const pop = document.getElementById('eq-inline-pub-pop');
        if (!pop || pop.classList.contains('hidden')) return;
        if (e.target instanceof Node && pop.contains(e.target)) return;
        closeInlinePubPop();
      }, true);
      window.addEventListener('resize', () => closeInlinePubPop());
    }

    document.getElementById('eq-pub-modal-close')?.addEventListener('click', closePublisherModal);
    document.getElementById('eq-pub-cancel')?.addEventListener('click', closePublisherModal);
    document.getElementById('eq-pub-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'eq-pub-modal') closePublisherModal();
    });
    document.getElementById('eq-publisher-profile')?.addEventListener('change', () => syncPubModalPreview(null));

    const debouncedPubSearch = debounce(() => renderPublishersTable({ stats: false }), 150);
    document.getElementById('eq-pub-search')?.addEventListener('input', (e) => {
      pubSearch = e.target.value;
      debouncedPubSearch();
    });

    const debouncedItemSearch = debounce(() => renderEquipmentTable({ stats: false }), 150);
    document.getElementById('eq-item-search')?.addEventListener('input', (e) => {
      itemSearch = e.target.value;
      debouncedItemSearch();
    });

    document.getElementById('eq-item-list')?.addEventListener('click', async (e) => {
      if (e.target.closest('[data-eq-inline-item-save]')) {
        await saveInlineItem();
        return;
      }
      if (e.target.closest('[data-eq-inline-item-cancel]')) {
        cancelInlineItem();
        return;
      }
      if (e.target.closest('[data-eq-inline-item-delete]')) {
        await deleteInlineItem();
      }
    });

    const debouncedLocSearch = debounce(() => renderLocationsTable({ stats: false }), 150);
    document.getElementById('eq-loc-search')?.addEventListener('input', (e) => {
      locSearch = e.target.value;
      debouncedLocSearch();
    });

    document.getElementById('eq-loc-list')?.addEventListener('click', async (e) => {
      if (e.target.closest('[data-eq-inline-loc-save]')) {
        await saveInlineLoc();
        return;
      }
      if (e.target.closest('[data-eq-inline-loc-cancel]')) {
        cancelInlineLoc();
        return;
      }
      if (e.target.closest('[data-eq-inline-loc-delete]')) {
        await deleteInlineLoc();
      }
    });

    document.getElementById('eq-panel-locais')?.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-eq-edit-loc]');
      if (editBtn) {
        startEditLocInline(locations.find((l) => l.id === editBtn.dataset.eqEditLoc));
        return;
      }
      const toggleBtn = e.target.closest('[data-eq-toggle-loc]');
      if (!toggleBtn) return;
      const row = locations.find((l) => l.id === toggleBtn.dataset.eqToggleLoc);
      if (!row) return;
      const prevActive = row.is_active !== false;
      const nextActive = row.is_active === false;
      const { error } = await client
        .from('equipment_locations')
        .update({ is_active: nextActive, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) showToast(toast, error.message, true);
      else {
        undoApi()?.registerToggle(UNDO_SCOPE, 'equipment_locations', row.id, 'is_active', prevActive, 'Local');
        row.is_active = nextActive;
        showToast(toast, nextActive ? 'Local reativado.' : 'Local desativado.');
        refreshLocationsView();
      }
    });

    document.getElementById('eq-panel-equipamentos')?.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-eq-edit-item]');
      if (editBtn) {
        startEditItemInline(equipmentItems.find((i) => i.id === editBtn.dataset.eqEditItem));
        return;
      }
      const toggleBtn = e.target.closest('[data-eq-toggle-item]');
      if (!toggleBtn) return;
      const row = equipmentItems.find((i) => i.id === toggleBtn.dataset.eqToggleItem);
      if (!row) return;
      const prevActive = row.is_active !== false;
      const nextActive = row.is_active === false;
      const { error } = await client
        .from('equipment_items')
        .update({ is_active: nextActive, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) showToast(toast, error.message, true);
      else {
        undoApi()?.registerToggle(UNDO_SCOPE, 'equipment_items', row.id, 'is_active', prevActive, 'Equipamento');
        row.is_active = nextActive;
        showToast(toast, nextActive ? 'Equipamento reativado.' : 'Equipamento desativado.');
        refreshEquipmentView();
      }
    });

    document.getElementById('eq-panel-publicadores')?.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-eq-edit-pub]');
      if (editBtn) {
        openPublisherModal(publishers.find((p) => p.id === editBtn.dataset.eqEditPub));
        return;
      }
      const btn = e.target.closest('[data-eq-toggle-pub]');
      if (!btn) return;
      const row = publishers.find((p) => p.id === btn.dataset.eqTogglePub);
      if (!row) return;
      const prevActive = row.is_active !== false;
      const nextActive = row.is_active === false;
      const { error } = await client
        .from('equipment_publishers')
        .update({ is_active: nextActive, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) showToast(toast, error.message, true);
      else {
        undoApi()?.registerToggle(UNDO_SCOPE, 'equipment_publishers', row.id, 'is_active', prevActive, 'Publicador');
        row.is_active = nextActive;
        showToast(toast, nextActive ? 'Publicador reativado.' : 'Publicador desativado.');
        refreshPublishersView();
      }
    });

    document.getElementById('eq-form-publisher')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('eq-pub-id').value;
      const dayInputs = document.querySelectorAll('#eq-pub-days input[name="eq-pub-day"]:checked');
      const availableDays = Array.from(dayInputs).map((input) => input.value);
      if (!availableDays.length) {
        showToast(toast, 'Selecione ao menos um dia.', true);
        return;
      }

      const grupo = document.getElementById('eq-pub-grupo').value.trim();
      const casa = document.getElementById('eq-pub-casa').value.trim();
      const payload = {
        can_carrinho: document.getElementById('eq-pub-carrinho').checked,
        can_display: document.getElementById('eq-pub-display').checked,
        available_days: availableDays,
        notes: formatPublisherNotes(grupo, casa),
        updated_at: new Date().toISOString()
      };

      if (id) {
        const row = publishers.find((p) => p.id === id);
        if (!row) return;
        if (row.profile_id) {
          const profileRow = profiles.find((p) => p.id === row.profile_id)
            || row.profiles;
          if (profileRow?.full_name) payload.publisher_name = profileRow.full_name;
        }
        const { error } = await client.from('equipment_publishers').update(payload).eq('id', id);
        if (error) showToast(toast, error.message, true);
        else {
          undoApi()?.registerUpdate(UNDO_SCOPE, 'equipment_publishers', id, row, 'Publicador', PUB_UNDO_FIELDS);
          Object.assign(row, payload);
          enrichPublisherRow(row);
          showToast(toast, 'Publicador atualizado.');
          closePublisherModal();
          refreshPublishersView();
        }
        return;
      }

      const profileId = document.getElementById('eq-publisher-profile').value;
      if (!profileId) return;
      const profileRow = profiles.find((p) => p.id === profileId);
      if (!profileRow) return;

      const { data: inserted, error } = await client.from('equipment_publishers').insert({
        profile_id: profileId,
        publisher_name: profileRow.full_name,
        ...payload,
        is_active: true
      }).select('*, profiles(full_name, username, avatar_url, role)').single();

      if (error) showToast(toast, error.message, true);
      else {
        if (inserted?.id) {
          undoApi()?.registerInsert(UNDO_SCOPE, 'equipment_publishers', inserted.id, 'Publicador');
        }
        if (inserted) publishers.push(enrichPublisherRow(inserted));
        showToast(toast, 'Publicador adicionado.');
        closePublisherModal();
        refreshPublishersView();
      }
    });

    undoApi()?.bind(UNDO_SCOPE, {
      getClient: async () => client,
      onAfterUndo: async () => {
        await Promise.all([fetchPublishers(), fetchSlots(), fetchEquipment(), fetchLocations()]);
        refreshAllViews();
      },
      showToast,
      toastEl: toast
    });

    try {
      await Promise.all([fetchPublishers(), fetchSlots(), fetchEquipment(), fetchLocations()]);
      refreshAllViews();
    } catch (err) {
      console.error('Carrinhos e Displays:', err);
      const msg = String(err?.message || err);
      const list = document.getElementById('eq-sched-list');
      if (list) {
        list.innerHTML = `<div class="eq-sched-card p-5 text-sm text-error">Não foi possível carregar os dados.${msg ? ` (${escapeHtml(msg)})` : ''}</div>`;
      }
      showToast(toast, msg.includes('equipment_') ? 'Tabelas de Carrinhos e Displays ainda não existem no Supabase.' : msg, true);
      throw err;
    }

    window.__JEAdminCarrinhosDisplaysInit = true;
    return true;
  }

  window.JEAdminCarrinhosDisplays = { init };
})();
