(function () {
  const STORAGE = 'je-terr-col-widths';

  function load(key) {
    try {
      const raw = localStorage.getItem(`${STORAGE}:${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function save(key, widthsPx) {
    try {
      localStorage.setItem(`${STORAGE}:${key}`, JSON.stringify(widthsPx.map((n) => toPx(n))));
    } catch {
      /* ignore quota */
    }
  }

  function toPx(n) {
    return `${Math.max(40, Math.round(Number(n) || 0))}px`;
  }

  function parsePx(value, fallback) {
    const n = parseFloat(String(value || ''));
    if (Number.isFinite(n) && n > 0) return n;
    return fallback;
  }

  function normalizePxWidths(saved, defaults) {
    if (!Array.isArray(defaults) || !defaults.length) return [];
    const defPx = defaults.map((w, i) => parsePx(w, [64, 140, 168, 148, 72, 260, 69][i] || 72));
    if (!Array.isArray(saved) || saved.length !== defaults.length) return defPx;
    return saved.map((w, i) => {
      const n = parsePx(w, 0);
      if (n > 0) return Math.max(40, n);
      return defPx[i];
    });
  }

  function applyGrid(panel, widths) {
    if (!panel || !widths?.length) return;
    panel.style.setProperty('--terr-grid-cols', widths.join(' '));
    panel.style.removeProperty('width');
  }

  function ensureColgroup(table, count) {
    let colgroup = table.querySelector('colgroup');
    if (!colgroup) {
      colgroup = document.createElement('colgroup');
      for (let i = 0; i < count; i += 1) colgroup.appendChild(document.createElement('col'));
      table.insertBefore(colgroup, table.firstChild);
    }
    while (colgroup.children.length < count) colgroup.appendChild(document.createElement('col'));
    return colgroup;
  }

  function headCells(headRow, includeAll) {
    if (!headRow) return [];
    const cells = [...headRow.children];
    if (includeAll) return cells;
    return cells.filter((el) => !el.classList.contains('terr-catalog-actions'));
  }

  function cellVisible(cell, index, isColVisible) {
    if (!isColVisible) return true;
    return isColVisible(cell, index);
  }

  function measureColWidths(headRow, includeAll, isColVisible) {
    return headCells(headRow, includeAll).map((cell, index) => {
      if (!cellVisible(cell, index, isColVisible)) return 0;
      return cell.getBoundingClientRect().width;
    });
  }

  function applyTable(table, widthsPx, isColVisible) {
    if (!table || !widthsPx?.length) return;
    table.style.tableLayout = 'fixed';
    table.style.width = '100%';
    const colgroup = ensureColgroup(table, widthsPx.length);
    const headCellsList = table.querySelector('thead tr') ? [...table.querySelector('thead tr').children] : [];
    [...colgroup.children].forEach((col, i) => {
      const cell = headCellsList[i];
      const visible = !isColVisible || isColVisible(cell, i);
      const w = widthsPx[i] || 0;
      col.style.width = visible && w > 0 ? toPx(w) : '0px';
    });
  }

  function visibleColIndices(cells, isColVisible) {
    const indices = [];
    cells.forEach((cell, index) => {
      if (cellVisible(cell, index, isColVisible)) indices.push(index);
    });
    return indices;
  }

  function attachHandles(headRow, applyFn, targetEl, key, defaults, includeAll, isColVisible) {
    if (!headRow) return;
    headRow.querySelectorAll('.terr-col-resize').forEach((el) => el.remove());

    const cells = headCells(headRow, includeAll);
    const defPx = normalizePxWidths(null, defaults);

    const startDrag = (handle, leftIndex, rightIndex, e) => {
      e.preventDefault();
      e.stopPropagation();

      let widthsPx = normalizePxWidths(load(key), defaults);
      const measured = measureColWidths(headRow, includeAll, isColVisible);
      if (measured.length === widthsPx.length && measured.some((w) => w > 0)) {
        const measuredTotal = measured.reduce((a, b) => a + b, 0);
        const savedTotal = widthsPx.reduce((a, b) => a + b, 0);
        if (Math.abs(measuredTotal - savedTotal) > measuredTotal * 0.35) {
          widthsPx = measured.map((w, i) => (w > 0 ? w : widthsPx[i]));
        }
      }

      const startX = e.clientX;
      const startLeft = widthsPx[leftIndex];
      const startRight = widthsPx[rightIndex];
      const total = startLeft + startRight;
      const minLeft = leftIndex === cells.length - 2 ? 69 : 48;
      const minRight = rightIndex === cells.length - 1 ? 69 : 48;

      handle.classList.add('terr-col-resize--active');
      document.body.classList.add('terr-col-resizing');

      const onMove = (ev) => {
        const delta = ev.clientX - startX;
        let left = startLeft + delta;
        let right = total - left;
        if (left < minLeft) {
          left = minLeft;
          right = total - minLeft;
        }
        if (right < minRight) {
          right = minRight;
          left = total - minRight;
        }
        widthsPx = widthsPx.slice();
        widthsPx[leftIndex] = left;
        widthsPx[rightIndex] = right;
        applyFn(targetEl, widthsPx);
      };

      const onUp = (ev) => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
        if (handle.hasPointerCapture?.(ev.pointerId)) {
          handle.releasePointerCapture(ev.pointerId);
        }
        document.body.classList.remove('terr-col-resizing');
        handle.classList.remove('terr-col-resize--active');
        save(key, widthsPx);
      };

      if (handle.setPointerCapture) handle.setPointerCapture(e.pointerId);
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    };

    const vis = visibleColIndices(cells, isColVisible);
    vis.forEach((colIndex, visPos) => {
      if (visPos === vis.length - 1) return;
      const cell = cells[colIndex];
      const nextIndex = vis[visPos + 1];
      cell.classList.add('terr-col-resize-cell');
      const handle = document.createElement('span');
      handle.className = 'terr-col-resize terr-col-resize--trailing';
      handle.title = 'Arraste para redimensionar';
      handle.setAttribute('role', 'separator');
      handle.setAttribute('aria-orientation', 'vertical');
      cell.appendChild(handle);

      handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        startDrag(handle, colIndex, nextIndex, e);
      });

      handle.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        localStorage.removeItem(`${STORAGE}:${key}`);
        applyFn(targetEl, defPx);
        save(key, defPx);
      });
    });
  }

  function mountGrid({ key, panel, headSelector, defaults }) {
    const panelEl = typeof panel === 'string' ? document.querySelector(panel) : panel;
    if (!panelEl) return;
    const widthsPx = normalizePxWidths(load(key), defaults);
    applyGrid(panelEl, widthsPx.map(toPx));
    const headRow = panelEl.querySelector(headSelector);
    const applyFn = (el, px) => applyGrid(el, px.map(toPx));
    attachHandles(headRow, applyFn, panelEl, key, defaults, false, null);
  }

  function mountTable({ key, table, defaults, isColVisible }) {
    const tableEl = typeof table === 'string' ? document.querySelector(table) : table;
    if (!tableEl) return;
    const widthsPx = normalizePxWidths(load(key), defaults);
    const applyFn = (el, px) => applyTable(el, px, isColVisible);
    applyFn(tableEl, widthsPx);
    const headRow = tableEl.querySelector('thead tr');
    attachHandles(headRow, applyFn, tableEl, key, defaults, true, isColVisible);
  }

  function reset(key) {
    localStorage.removeItem(`${STORAGE}:${key}`);
  }

  window.JETerrColumnResize = { mountGrid, mountTable, reset };
})();
