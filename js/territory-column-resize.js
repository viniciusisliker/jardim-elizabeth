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

  function normalizeWidths(saved, defaults) {
    if (!Array.isArray(saved) || !Array.isArray(defaults) || saved.length !== defaults.length) {
      return defaults;
    }
    return saved.map((w, i) => {
      const savedStr = String(w || '');
      const defStr = String(defaults[i] || '');
      if (savedStr.includes('%') || defStr.includes('%')) {
        const savedVal = parseFloat(savedStr) || 0;
        const minVal = parseFloat(defStr) || 4;
        return `${Math.max(savedVal, minVal)}%`;
      }
      const savedPx = parseFloat(savedStr) || 0;
      const minPx = parseFloat(defStr) || 48;
      return toPx(Math.max(savedPx, minPx));
    });
  }

  function save(key, widths) {
    try {
      localStorage.setItem(`${STORAGE}:${key}`, JSON.stringify(widths));
    } catch {
      /* ignore quota */
    }
  }

  function toPx(n) {
    return `${Math.max(48, Math.round(n))}px`;
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

  function applyTable(table, widths) {
    if (!table || !widths?.length) return;
    table.style.tableLayout = 'fixed';
    table.style.width = '100%';
    const colgroup = ensureColgroup(table, widths.length);
    [...colgroup.children].forEach((col, i) => {
      if (widths[i]) col.style.width = widths[i];
    });
  }

  function headCells(headRow, includeAll) {
    if (!headRow) return [];
    const cells = [...headRow.children];
    if (includeAll) return cells;
    return cells.filter((el) => !el.classList.contains('terr-catalog-actions'));
  }

  function hasPercentWidths(widths) {
    return Array.isArray(widths) && widths.some((w) => String(w).includes('%'));
  }

  function toPxWidths(widths, headRow, includeAll) {
    const measured = measureCells(headRow, includeAll);
    if (!Array.isArray(widths) || !widths.length || hasPercentWidths(widths)) {
      return measured.length ? measured : [];
    }
    const px = widths.map((w) => parseFloat(w) || 0);
    if (px.some((n) => n < 24) || Math.abs(px.reduce((a, b) => a + b, 0) - measured.reduce((a, b) => a + b, 0)) > measured.reduce((a, b) => a + b, 0) * 0.5) {
      return measured;
    }
    return px.map((n) => Math.max(48, n));
  }

  function measureCells(row, includeAll) {
    return headCells(row, includeAll).map((cell) => cell.getBoundingClientRect().width);
  }

  function attachHandles(headRow, applyFn, targetEl, key, defaults, includeAll) {
    if (!headRow) return;
    headRow.querySelectorAll('.terr-col-resize').forEach((el) => el.remove());

    const cells = headCells(headRow, includeAll);

    const startDrag = (handle, pairIndex, e) => {
      e.preventDefault();
      e.stopPropagation();

      const stored = load(key);
      const normalized = normalizeWidths(stored, defaults);
      let widthsPx = toPxWidths(stored || normalized, headRow, includeAll);
      if (widthsPx.length < cells.length) {
        widthsPx = measureCells(headRow, includeAll);
      }

      const startX = e.clientX;
      const startPair = [widthsPx[pairIndex], widthsPx[pairIndex + 1]];
      handle.classList.add('terr-col-resize--active');
      const minFor = (idx) => (idx === cells.length - 1 ? 69 : 48);

      const onMove = (ev) => {
        const delta = ev.clientX - startX;
        const total = startPair[0] + startPair[1];
        const minLeft = minFor(pairIndex);
        const minRight = minFor(pairIndex + 1);
        let left = startPair[0] + delta;
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
        widthsPx[pairIndex] = left;
        widthsPx[pairIndex + 1] = right;
        applyFn(targetEl, widthsPx.map(toPx));
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.body.classList.remove('terr-col-resizing');
        handle.classList.remove('terr-col-resize--active');
        save(key, widthsPx.map(toPx));
      };

      document.body.classList.add('terr-col-resizing');
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    };

    cells.forEach((cell, index) => {
      if (index === 0) return;
      if (cell.classList.contains('terr-sched-col--hidden')) return;
      if (cells[index - 1]?.classList.contains('terr-sched-col--hidden')) return;
      cell.classList.add('terr-col-resize-cell');
      const handle = document.createElement('span');
      handle.className = 'terr-col-resize terr-col-resize--leading';
      handle.title = 'Arraste para redimensionar';
      handle.setAttribute('role', 'separator');
      handle.setAttribute('aria-orientation', 'vertical');
      cell.appendChild(handle);

      const pairIndex = index - 1;
      handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        startDrag(handle, pairIndex, e);
      });

      handle.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        localStorage.removeItem(`${STORAGE}:${key}`);
        applyFn(targetEl, defaults);
      });
    });
  }

  function mountGrid({ key, panel, headSelector, defaults }) {
    const panelEl = typeof panel === 'string' ? document.querySelector(panel) : panel;
    if (!panelEl) return;
    const widths = normalizeWidths(load(key), defaults);
    applyGrid(panelEl, widths);
    const headRow = panelEl.querySelector(headSelector);
    attachHandles(headRow, applyGrid, panelEl, key, defaults, false);
  }

  function mountTable({ key, table, defaults }) {
    const tableEl = typeof table === 'string' ? document.querySelector(table) : table;
    if (!tableEl) return;
    const widths = normalizeWidths(load(key), defaults);
    applyTable(tableEl, widths);
    const headRow = tableEl.querySelector('thead tr');
    attachHandles(headRow, applyTable, tableEl, key, defaults, true);
  }

  window.JETerrColumnResize = { mountGrid, mountTable, reset: (key) => localStorage.removeItem(`${STORAGE}:${key}`) };
})();
