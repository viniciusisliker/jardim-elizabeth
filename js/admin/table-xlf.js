(function () {
  const escapeHtml = (value) => (window.JEAdmin?.escapeHtml ? window.JEAdmin.escapeHtml(value) : String(value ?? ''));

  function xlfMapAllTrue(map) {
    return Object.fromEntries(Object.keys(map).map((k) => [k, true]));
  }

  function xlfAllSelected(map) {
    if (!map || typeof map !== 'object') return true;
    const vals = Object.values(map);
    return vals.length === 0 || vals.every(Boolean);
  }

  function xlfSelectedKeys(map) {
    if (!map || typeof map !== 'object') return [];
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
    if (!map || typeof map !== 'object') return list;
    const total = Object.keys(map).length;
    const keys = xlfSelectedKeys(map);
    if (!total || keys.length >= total) return list;
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
    const filterMap = filterKey ? filterState[filterKey] : null;
    const active = filterKey ? xlfIsActive(filterMap) : false;
    const sortActive = sortState.col === col;
    const sortIcon = sortActive ? (sortState.dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more';
    const checks = filterKey && filterMap
      ? (options || []).map((o) => `
      <label class="terr-xlf-check">
        <input type="checkbox" data-xlf-filter="${filterKey}" value="${escapeHtml(String(o.value))}" ${filterMap[o.value] ? 'checked' : ''}>
        <span>${escapeHtml(o.label)}</span>
      </label>`).join('')
      : '';
    const filterUi = filterKey && filterMap ? `
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
        </div>` : '';
    const inner = `
      <div class="terr-xlf-head">
        <button type="button" class="terr-xlf-sort terr-catalog-sort terr-hist-sort${sortActive ? ' terr-xlf-sort--active terr-catalog-sort--active terr-hist-sort--active' : ''}" data-${sortAttr}="${col}">
          <span>${label}</span>
          <span class="material-symbols-outlined terr-xlf-sort-icon terr-catalog-sort-icon terr-hist-sort-icon" aria-hidden="true">${sortIcon}</span>
        </button>${filterUi}
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
        const map = filterState[key];
        if (!map) return;
        map[box.value] = box.checked;
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
          sortState.dir = 'asc';
        }
        xlfUpdateSortUI(root, sortAttr, sortState);
        onRefresh();
      });
    });

    if (!window.__JETableXlfBound) {
      window.__JETableXlfBound = true;
      document.addEventListener('click', () => xlfCloseMenus());
      document.addEventListener('scroll', (e) => {
        if (e.target instanceof Node && e.target.closest('[data-xlf-menu]:not(.hidden)')) return;
        xlfCloseMenus();
      }, true);
      window.addEventListener('resize', () => xlfCloseMenus());
    }
  }

  window.JETableXlf = {
    xlfMapAllTrue,
    xlfAllSelected,
    xlfSelectedKeys,
    xlfIsActive,
    xlfEnsureKeys,
    xlfOptionsFromKeys,
    xlfApplyMapFilter,
    xlfCloseMenus,
    xlfUpdateFilterUI,
    xlfUpdateSortUI,
    xlfColumnHeader,
    bindXlfPanel
  };
})();
