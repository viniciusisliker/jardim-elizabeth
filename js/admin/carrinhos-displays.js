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
  const ITEM_TYPE_OPTIONS = [
    { value: 'carrinho', label: 'Carrinho' },
    { value: 'display', label: 'Display' }
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
    return equipmentItems
      .filter((item) => item.is_active !== false && item.equipment_type === type)
      .sort((a, b) => {
        const sortDiff = (a.sort_order || 0) - (b.sort_order || 0);
        if (sortDiff) return sortDiff;
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      });
  }

  function activeLocationsList() {
    return locations
      .filter((loc) => loc.is_active !== false)
      .sort((a, b) => {
        const sortDiff = (a.sort_order || 0) - (b.sort_order || 0);
        if (sortDiff) return sortDiff;
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      });
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

  async function loadEquipment() {
    const { data, error } = await client
      .from('equipment_items')
      .select('*')
      .order('sort_order')
      .order('name');
    if (error) throw error;
    equipmentItems = data || [];
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
    const { updateUi = false } = opts;
    const body = document.getElementById('eq-item-table-body');
    const foot = document.getElementById('eq-item-table-foot');
    const list = document.getElementById('eq-item-list');
    if (!body) return;

    updateItemStats();
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

  function ensureItemModalPortal() {
    const modal = document.getElementById('eq-item-modal');
    if (modal && modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
  }

  function resetItemForm() {
    document.getElementById('eq-form-item')?.reset();
    document.getElementById('eq-item-id').value = '';
    document.getElementById('eq-item-sort').value = '0';
    document.getElementById('eq-item-type').value = 'carrinho';
  }

  function openItemModal(item) {
    ensureItemModalPortal();
    const modal = document.getElementById('eq-item-modal');
    if (!modal) return;
    resetItemForm();
    document.getElementById('eq-item-modal-title').textContent = item ? 'Editar equipamento' : 'Adicionar equipamento';
    if (item) {
      document.getElementById('eq-item-id').value = item.id;
      document.getElementById('eq-item-name').value = item.name;
      document.getElementById('eq-item-type').value = item.equipment_type;
      document.getElementById('eq-item-location').value = item.default_location || '';
      document.getElementById('eq-item-sort').value = String(item.sort_order ?? 0);
      document.getElementById('eq-item-notes').value = item.notes || '';
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

    const { error } = id
      ? await client.from('equipment_items').update(payload).eq('id', id)
      : await client.from('equipment_items').insert({ ...payload, is_active: true });

    if (error) {
      showToast(toast, error.message.includes('equipment_items_name_type_unique')
        ? 'Já existe um equipamento com este nome e tipo.'
        : error.message, true);
      return;
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
    const { error } = id
      ? await client.from('equipment_items').update(data).eq('id', id)
      : await client.from('equipment_items').insert({ ...data, is_active: true });

    if (error) {
      showToast(toast, error.message.includes('equipment_items_name_type_unique')
        ? 'Já existe um equipamento com este nome e tipo.'
        : error.message, true);
      return;
    }

    showToast(toast, id ? 'Equipamento atualizado.' : 'Equipamento adicionado.');
    inlineItemDraft = null;
    await loadEquipment();
  }

  async function deleteInlineItem() {
    const id = inlineItemDraft?.id;
    if (!id || !confirm('Excluir este equipamento?')) return;
    const { error } = await client.from('equipment_items').delete().eq('id', id);
    if (error) showToast(toast, error.message, true);
    else {
      showToast(toast, 'Equipamento excluído.');
      inlineItemDraft = null;
      await loadEquipment();
    }
  }

  async function loadLocations() {
    const { data, error } = await client
      .from('equipment_locations')
      .select('*')
      .order('sort_order')
      .order('name');
    if (error) throw error;
    locations = data || [];
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
    const { updateUi = false } = opts;
    const body = document.getElementById('eq-loc-table-body');
    const foot = document.getElementById('eq-loc-table-foot');
    const list = document.getElementById('eq-loc-list');
    if (!body) return;

    updateLocStats();
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

  function resetLocForm() {
    document.getElementById('eq-form-loc')?.reset();
    document.getElementById('eq-loc-id').value = '';
    document.getElementById('eq-loc-sort').value = '0';
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

    const { error } = id
      ? await client.from('equipment_locations').update(payload).eq('id', id)
      : await client.from('equipment_locations').insert({ ...payload, is_active: true });

    if (error) {
      showToast(toast, error.message.includes('equipment_locations_name_unique')
        ? 'Já existe um local com este nome.'
        : error.message, true);
      return;
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
    const { error } = id
      ? await client.from('equipment_locations').update(data).eq('id', id)
      : await client.from('equipment_locations').insert({ ...data, is_active: true });

    if (error) {
      showToast(toast, error.message.includes('equipment_locations_name_unique')
        ? 'Já existe um local com este nome.'
        : error.message, true);
      return;
    }

    showToast(toast, id ? 'Local atualizado.' : 'Local adicionado.');
    inlineLocDraft = null;
    await loadLocations();
  }

  async function deleteInlineLoc() {
    const id = inlineLocDraft?.id;
    if (!id || !confirm('Excluir este local?')) return;
    const { error } = await client.from('equipment_locations').delete().eq('id', id);
    if (error) showToast(toast, error.message, true);
    else {
      showToast(toast, 'Local excluído.');
      inlineLocDraft = null;
      await loadLocations();
    }
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
    const { error } = id
      ? await client.from('equipment_schedule_slots').update(data).eq('id', id)
      : await client.from('equipment_schedule_slots').insert(data);

    if (error) {
      showToast(toast, error.message, true);
      return;
    }

    showToast(toast, 'Linha salva.');
    inlineSlotDraft = null;
    closeInlinePubPop();
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
      document.getElementById('eq-inline-day')?.focus();
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
    document.getElementById('eq-btn-add-item')?.addEventListener('click', () => startNewItemInline());
    document.getElementById('eq-btn-add-loc')?.addEventListener('click', () => startNewLocInline());
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
      renderSlotPublisherPicker('eq-inline');
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

    document.getElementById('eq-pub-search')?.addEventListener('input', (e) => {
      pubSearch = e.target.value;
      renderPublishersTable();
    });

    document.getElementById('eq-item-search')?.addEventListener('input', (e) => {
      itemSearch = e.target.value;
      renderEquipmentTable();
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

    document.getElementById('eq-loc-search')?.addEventListener('input', (e) => {
      locSearch = e.target.value;
      renderLocationsTable();
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
      const { error } = await client
        .from('equipment_locations')
        .update({ is_active: row.is_active === false, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, row.is_active === false ? 'Local reativado.' : 'Local desativado.');
        await loadLocations();
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
      const { error } = await client
        .from('equipment_items')
        .update({ is_active: row.is_active === false, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, row.is_active === false ? 'Equipamento reativado.' : 'Equipamento desativado.');
        await loadEquipment();
      }
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
      await loadPublishers();
      await Promise.all([loadSlots(), loadEquipment(), loadLocations()]);
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
  }

  window.JEAdminCarrinhosDisplays = { init };
})();
