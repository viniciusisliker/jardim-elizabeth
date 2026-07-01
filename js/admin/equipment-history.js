(function () {
  let client;
  let toast;
  let showToast;
  let escapeHtml;
  let xlf;
  let helpers;

  let eqHistory = [];
  let eqHistFilter = { q: '', date: {}, area: {}, action: {} };
  let eqHistSort = { col: 'date', dir: 'desc' };
  let eqHistFilterSig = '';
  let eqHistTableTimer = null;
  let bound = false;

  const AREA_LABELS = {
    cronograma: 'Cronograma',
    publicador: 'Publicador',
    equipamento: 'Equipamento',
    local: 'Local'
  };

  const ACTION_LABELS = {
    criacao: 'Criação',
    edicao: 'Edição',
    exclusao: 'Exclusão',
    status: 'Status'
  };

  function formatShortDate(iso) {
    if (!iso) return '—';
    if (helpers?.formatShortDate) return helpers.formatShortDate(String(iso).slice(0, 10));
    const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  }

  function historyArea(entry) {
    return AREA_LABELS[entry.event_type] || entry.event_type || '—';
  }

  function historyAction(entry) {
    return ACTION_LABELS[entry.action] || entry.action || '—';
  }

  function historyDetails(entry) {
    const base = String(entry.details || '').trim();
    const meta = entry.metadata || {};
    const extra = [];
    if (meta.week_start) extra.push(`Sem. ${formatShortDate(meta.week_start)}`);
    if (meta.entity_name) extra.push(meta.entity_name);
    if (meta.publisher_names) extra.push(meta.publisher_names);
    const suffix = extra.length ? ` · ${extra.join(' · ')}` : '';
    return (base + suffix).trim() || '—';
  }

  function historyTypeBadge(entry) {
    const area = entry.event_type || 'default';
    const label = historyAction(entry);
    return `<span class="terr-hist-type terr-hist-type--${area === 'cronograma' ? 'cronograma' : area === 'status' ? 'status' : 'edicao'}">${escapeHtml(label)}</span>`;
  }

  function syncEqHistFilterOptions() {
    const dates = [...new Set(eqHistory.map((h) => String(h.event_date).slice(0, 10)))].sort().reverse();
    xlf.xlfEnsureKeys(eqHistFilter.date, dates);
    xlf.xlfEnsureKeys(
      eqHistFilter.area,
      [...new Set(eqHistory.map((h) => h.event_type || 'default'))].sort((a, b) =>
        historyArea({ event_type: a }).localeCompare(historyArea({ event_type: b }), 'pt-BR', { sensitivity: 'base' })
      )
    );
    xlf.xlfEnsureKeys(
      eqHistFilter.action,
      [...new Set(eqHistory.map((h) => h.action || 'default'))].sort((a, b) =>
        historyAction({ action: a }).localeCompare(historyAction({ action: b }), 'pt-BR', { sensitivity: 'base' })
      )
    );
    const sig = [eqHistFilter.date, eqHistFilter.area, eqHistFilter.action]
      .map((m) => Object.keys(m).join('\0'))
      .join('::');
    const changed = sig !== eqHistFilterSig;
    eqHistFilterSig = sig;
    return changed;
  }

  function eqHistHeaderRow() {
    syncEqHistFilterOptions();
    const dateOpts = xlf.xlfOptionsFromKeys(Object.keys(eqHistFilter.date), (k) => formatShortDate(k));
    const areaOpts = xlf.xlfOptionsFromKeys(Object.keys(eqHistFilter.area), (k) => historyArea({ event_type: k }));
    const actionOpts = xlf.xlfOptionsFromKeys(Object.keys(eqHistFilter.action), (k) => historyAction({ action: k }));
    return `
      ${xlf.xlfColumnHeader('eq-hist-sort', eqHistSort, eqHistFilter, { col: 'date', label: 'Data', filterKey: 'date', options: dateOpts, wrap: 'span' })}
      ${xlf.xlfColumnHeader('eq-hist-sort', eqHistSort, eqHistFilter, { col: 'area', label: 'Área', filterKey: 'area', options: areaOpts, wrap: 'span' })}
      ${xlf.xlfColumnHeader('eq-hist-sort', eqHistSort, eqHistFilter, { col: 'details', label: 'Detalhes', wrap: 'span' })}
      ${xlf.xlfColumnHeader('eq-hist-sort', eqHistSort, eqHistFilter, { col: 'action', label: 'Ação', filterKey: 'action', options: actionOpts, wrap: 'span' })}
      <span class="terr-xlf-head-cell terr-xlf-head-cell--actions" aria-hidden="true"></span>`;
  }

  function getSortedEqHistory(list) {
    const { col, dir } = eqHistSort;
    const mul = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (col) {
        case 'date':
          cmp = String(a.event_date).localeCompare(String(b.event_date));
          break;
        case 'area':
          cmp = historyArea(a).localeCompare(historyArea(b), 'pt-BR', { sensitivity: 'base' });
          break;
        case 'action':
          cmp = historyAction(a).localeCompare(historyAction(b), 'pt-BR', { sensitivity: 'base' });
          break;
        case 'details':
          cmp = historyDetails(a).localeCompare(historyDetails(b), 'pt-BR', { sensitivity: 'base' });
          break;
        default:
          cmp = 0;
      }
      if (cmp === 0 && col !== 'date') cmp = String(a.event_date).localeCompare(String(b.event_date));
      return cmp * mul;
    });
  }

  function getFilteredEqHistory() {
    let list = eqHistory;
    const q = eqHistFilter.q.trim().toLowerCase();
    if (q) {
      list = list.filter((h) => {
        const hay = [
          String(h.event_date).slice(0, 10),
          historyArea(h),
          historyAction(h),
          historyDetails(h),
          h.details || ''
        ].join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
    list = xlf.xlfApplyMapFilter(list, eqHistFilter.date, (h) => String(h.event_date).slice(0, 10));
    list = xlf.xlfApplyMapFilter(list, eqHistFilter.area, (h) => h.event_type || 'default');
    list = xlf.xlfApplyMapFilter(list, eqHistFilter.action, (h) => h.action || 'default');
    return getSortedEqHistory(list);
  }

  function scheduleEqHistoricoTable(opts = {}) {
    clearTimeout(eqHistTableTimer);
    eqHistTableTimer = setTimeout(() => renderEqHistoricoTable(opts), 100);
  }

  function bindEqHistoricoFilters() {
    const grid = document.getElementById('eq-historico-grid');
    if (!grid) return;
    grid.dataset.xlfScope = 'eq-hist';
    if (!grid.dataset.eqHistSearchBound) {
      grid.dataset.eqHistSearchBound = '1';
      grid.addEventListener('input', (e) => {
        if (e.target.id !== 'eq-hist-search') return;
        eqHistFilter.q = e.target.value;
        scheduleEqHistoricoTable();
      });
    }
    const search = grid.querySelector('#eq-hist-search');
    if (search && search.value !== eqHistFilter.q) search.value = eqHistFilter.q;
    delete grid.dataset.xlfBound;
    xlf.bindXlfPanel(grid, 'eq-hist-sort', eqHistFilter, eqHistSort, () => renderEqHistoricoTable({ updateUi: true }));
  }

  function renderEqHistoricoTable(opts = {}) {
    const { updateUi = false } = opts;
    const listEl = document.getElementById('eq-historico-table-body');
    const footEl = document.getElementById('eq-historico-foot');
    if (!listEl) return;

    if (updateUi) {
      xlf.xlfUpdateSortUI(document.getElementById('eq-historico-grid'), 'eq-hist-sort', eqHistSort);
      xlf.xlfUpdateFilterUI(document.getElementById('eq-historico-grid'), eqHistFilter);
    }

    const filtered = getFilteredEqHistory();
    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="terr-empty !border-0 !rounded-none">
          <span class="material-symbols-outlined" aria-hidden="true">search_off</span>
          <p class="text-sm">${eqHistory.length ? 'Nenhum registro corresponde ao filtro.' : 'Nenhum registro ainda.'}</p>
        </div>`;
      if (footEl) footEl.textContent = '';
      return;
    }

    listEl.innerHTML = filtered.map((h) => {
      const isoDate = String(h.event_date).slice(0, 10);
      const details = historyDetails(h);
      return `
      <div class="terr-hist-row terr-hist-row--weekday">
        <span class="terr-hist-date" title="${escapeHtml(isoDate)}">${escapeHtml(formatShortDate(isoDate))}</span>
        <span class="terr-hist-cell terr-hist-cell--dirigente">${escapeHtml(historyArea(h))}</span>
        <span class="terr-hist-obs${details === '—' ? ' terr-hist-obs--empty' : ''}" title="${escapeHtml(details)}">${historyTypeBadge(h)}${escapeHtml(details)}</span>
        <span class="terr-hist-cell">${escapeHtml(historyAction(h))}</span>
        <div class="terr-hist-actions">
          <button type="button" data-del-eq-history="${h.id}" class="terr-sched-icon-btn terr-sched-icon-btn--del" title="Excluir registro">
            <span class="material-symbols-outlined" aria-hidden="true">delete</span>
          </button>
        </div>
      </div>`;
    }).join('');

    if (footEl) {
      const suffix = filtered.length < eqHistory.length ? ` (${eqHistory.length} no total)` : '';
      footEl.textContent = `Exibindo ${filtered.length} registro${filtered.length === 1 ? '' : 's'}${suffix}`;
    }
  }

  function renderEqHistorico() {
    const grid = document.getElementById('eq-historico-grid');
    if (!grid) return;
    if (document.getElementById('eq-historico-table-body') && eqHistory.length) {
      refreshEqHistoricoView();
      return;
    }
    if (!eqHistory.length) {
      grid.innerHTML = `
        <div class="terr-hist-toolbar">
          <div>
            <h2>Histórico</h2>
            <p>Alterações em cronograma, publicadores, equipamentos e locais</p>
          </div>
        </div>
        <div class="terr-empty">
          <span class="material-symbols-outlined" aria-hidden="true">history</span>
          <p class="text-sm font-semibold text-primary">Nenhum registro ainda</p>
          <p class="text-xs mt-1">Criações, edições e exclusões aparecerão aqui.</p>
        </div>`;
      return;
    }

    grid.innerHTML = `
      <div class="terr-hist-toolbar">
        <div>
          <h2>Histórico</h2>
          <p>${eqHistory.length} registro${eqHistory.length === 1 ? '' : 's'}</p>
        </div>
        <div class="terr-hist-toolbar-search">
          <span class="material-symbols-outlined" aria-hidden="true">search</span>
          <input id="eq-hist-search" type="search" class="terr-hist-input" placeholder="Buscar área, detalhes…" autocomplete="off"/>
        </div>
      </div>
      <div class="terr-hist-scroll">
        <div class="terr-hist-panel eq-hist-panel">
          <div class="terr-hist-row terr-hist-row--head">${eqHistHeaderRow()}</div>
          <div id="eq-historico-table-body"></div>
          <p id="eq-historico-foot" class="terr-hist-foot"></p>
        </div>
      </div>`;

    bindEqHistoricoFilters();
    renderEqHistoricoTable({ updateUi: true });
  }

  function refreshEqHistoricoView() {
    const grid = document.getElementById('eq-historico-grid');
    if (!grid) return;
    if (!eqHistory.length) {
      renderEqHistorico();
      return;
    }
    if (!document.getElementById('eq-historico-table-body')) {
      renderEqHistorico();
      return;
    }
    const toolbarP = grid.querySelector('.terr-hist-toolbar p');
    if (toolbarP) toolbarP.textContent = `${eqHistory.length} registro${eqHistory.length === 1 ? '' : 's'}`;
    const filtersChanged = syncEqHistFilterOptions();
    if (filtersChanged) {
      const head = grid.querySelector('.terr-hist-row--head');
      if (head) head.innerHTML = eqHistHeaderRow();
      delete grid.dataset.xlfBound;
      bindEqHistoricoFilters();
    }
    renderEqHistoricoTable({ updateUi: filtersChanged });
  }

  async function loadEqHistory() {
    const { data, error } = await client
      .from('equipment_history')
      .select('id, event_type, action, event_date, details, metadata, created_at, created_by')
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(250);
    if (error) throw error;
    eqHistory = data || [];
  }

  async function log(eventType, action, details, metadata = {}) {
    if (!client) return;
    try {
      const { error } = await client.rpc('log_equipment_history', {
        p_event_type: eventType,
        p_action: action,
        p_event_date: new Date().toISOString().slice(0, 10),
        p_details: details || null,
        p_metadata: metadata
      });
      if (error) console.warn('Eq history:', error.message);
      else if (document.getElementById('eq-historico-table-body')) {
        await loadEqHistory();
        refreshEqHistoricoView();
      }
    } catch (err) {
      console.warn('Eq history:', err);
    }
  }

  async function deleteEntry(id) {
    if (!window.confirm('Excluir este registro do histórico?')) return;
    const { error } = await client.from('equipment_history').delete().eq('id', id);
    if (error) {
      if (toast) showToast(toast, error.message, true);
      return;
    }
    if (toast) showToast(toast, 'Registro excluído.');
    await loadEqHistory();
    refreshEqHistoricoView();
  }

  function setupDelegatedActions() {
    const panel = document.getElementById('eq-panel-historico');
    if (!panel || panel.dataset.eqHistBound) return;
    panel.dataset.eqHistBound = '1';
    panel.addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-del-eq-history]');
      if (delBtn) deleteEntry(delBtn.dataset.delEqHistory);
    });
  }

  function bind(deps) {
    client = deps.client;
    toast = deps.toast;
    showToast = deps.showToast;
    escapeHtml = deps.escapeHtml;
    xlf = deps.xlf;
    helpers = deps.helpers;
    if (!bound) {
      setupDelegatedActions();
      bound = true;
    }
  }

  async function ensureReady() {
    if (!client) return false;
    await loadEqHistory();
    renderEqHistorico();
    return true;
  }

  window.JEEqHistory = { bind, log, loadEqHistory, ensureReady, refreshEqHistoricoView };
})();
