(function () {
  const { guardAnnouncements, getClient, showToast, escapeHtml, adminToastEl } = window.JEAdmin;
  const Dates = window.JEAnnouncementDates;
  const Schemas = window.JEAnnouncementSchemas;
  const Export = window.JEAnnouncementExport;

  function pdfApi() {
    const api = window.JEAnnouncementPdf;
    if (!api?.blockToPdfBlob) {
      throw new Error('Módulo de PDF não carregou. Recarregue a página (Ctrl+F5).');
    }
    return api;
  }
  const Sync = window.JEWeekendDiscursosSync;

  let board = null;
  let entries = [];
  let client = null;
  let toastEl = null;
  let gcalExportBlock = 'mecanicas';
  let savedBoards = [];
  let boardListFilter = 'all';
  let receiveSpeechesByDate = {};
  let receiveSpeechesMonth = null;
  const blockSelection = { mecanicas: 0, midweek: 0, weekend: 0, limpeza_mensal: 0 };
  const pendingPdfs = {};
  let pdfPreviewBlock = null;

  const MIDWEEK_SECTIONS = {
    header: { title: 'Semana', icon: 'calendar_today' },
    tesouros: { title: 'Tesouros da Palavra de Deus', icon: 'auto_stories' },
    ministerio: { title: 'Faça seu melhor no ministério', icon: 'diversity_3' },
    vida: { title: 'Nossa vida cristã', icon: 'favorite' }
  };

  function $(id) { return document.getElementById(id); }

  function entriesFor(block) {
    return entries.filter((e) => e.block === block).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  function limpezaEntries() {
    return entries.filter((e) => e.block === 'limpeza_mensal').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  function dayNum(iso) {
    if (!iso) return '—';
    return String(new Date(iso + 'T12:00:00').getDate()).padStart(2, '0');
  }

  function entryFilled(entry) {
    let data = entry.data || {};
    if (entry.block === 'weekend' && entry.event_date) {
      data = Sync.mergeWeekendDisplayData(entry.data, receiveSpeechesByDate[entry.event_date]).data;
    }
    return Object.values(data).some((v) => String(v || '').trim());
  }

  async function loadReceiveSpeeches(force) {
    if (!board?.reference_month || !client) {
      receiveSpeechesByDate = {};
      receiveSpeechesMonth = null;
      return;
    }
    if (!force && receiveSpeechesMonth === board.reference_month) return;
    receiveSpeechesByDate = await Sync.fetchReceiveSpeechesByDate(client, board.reference_month);
    receiveSpeechesMonth = board.reference_month;
  }

  function readFormIntoEntries() {
    document.querySelectorAll('[data-entry-id]').forEach((card) => {
      const id = card.dataset.entryId;
      const entry = entries.find((e) => e.id === id);
      if (!entry) return;
      const dateInput = card.querySelector('[data-field="event_date"]');
      if (dateInput) {
        entry.event_date = dateInput.value || null;
        if (entry.event_date) {
          const d = new Date(entry.event_date + 'T12:00:00');
          entry.weekday_label = Dates.WEEKDAY_PT[d.getDay()];
        }
      }
      card.querySelectorAll('[data-data-key]').forEach((input) => {
        if (input.readOnly) return;
        entry.data = entry.data || {};
        entry.data[input.dataset.dataKey] = input.value;
      });
    });
  }

  function fieldCell(field, entry) {
    const val = (entry.data && entry.data[field.key]) || '';
    if (field.type === 'select') {
      const opts = (field.options || Schemas.CLEANING_GROUPS).map((o) =>
        `<option value="${escapeHtml(o)}" ${val === o ? 'selected' : ''}>${escapeHtml(o)}</option>`
      ).join('');
      return `<div class="qa-cell"><label>${escapeHtml(field.label)}</label>
        <select data-data-key="${field.key}"><option value=""></option>${opts}</select></div>`;
    }
    return `<div class="qa-cell"><label>${escapeHtml(field.label)}</label>
      <input data-data-key="${field.key}" value="${escapeHtml(val)}"/></div>`;
  }

  function fieldInput(field, entry, extraClass, opts) {
    const o = opts || {};
    const data = o.data || entry.data || {};
    const val = data[field.key] || '';
    const optional = field.optional ? ' is-optional' : '';
    const filled = trim(val) ? ' is-filled' : '';
    const spanClass = extraClass || (field.fullWidth ? ' span-2' : '');
    const badge = field.optional ? '<span class="qa-field-badge">Opcional</span>' : '';
    const discursosBadge = o.fromDiscursos ? '<span class="qa-field-badge qa-field-badge--discursos">Discursos Públicos</span>' : '';
    const hint = field.hint ? `<p class="qa-field-hint">${escapeHtml(field.hint)}</p>` : '';
    const readonly = o.readonly ? ' readonly tabindex="-1"' : '';

    let control;
    if (field.type === 'select') {
      const options = (field.options || Schemas.CLEANING_GROUPS).map((opt) =>
        `<option value="${escapeHtml(opt)}" ${val === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`
      ).join('');
      control = `<select class="qa-field-control" data-data-key="${field.key}"${readonly}><option value=""></option>${options}</select>`;
    } else {
      control = `<input class="qa-field-control" data-data-key="${field.key}" value="${escapeHtml(val)}"${field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : ''}${readonly}/>`;
    }

    return `
      <div class="qa-field${optional}${filled}${spanClass}${o.fromDiscursos ? ' qa-field--discursos' : ''}">
        <div class="qa-field-head">
          <span class="qa-field-tag">${escapeHtml(field.label)}</span>
          ${badge}${discursosBadge}
        </div>
        ${control}
        ${hint}
      </div>`;
  }

  function trim(val) {
    return String(val ?? '').trim();
  }

  function sectionShell(title, icon, bodyHtml, bodyClass) {
    return `
      <div class="qa-section">
        <div class="qa-section-title">
          <span class="material-symbols-outlined">${escapeHtml(icon)}</span>
          ${escapeHtml(title)}
        </div>
        <div class="qa-section-body">
          <div class="qa-fields-grid${bodyClass ? ' ' + bodyClass : ''}">${bodyHtml}</div>
        </div>
      </div>`;
  }

  function fieldsHtmlWeekend(fields, entry) {
    const groups = Schemas.WEEKEND_GROUPS;
    const order = ['territorio', 'discurso', 'sentinela', 'sala_b', 'especial'];
    const speech = receiveSpeechesByDate[entry.event_date];
    const { data, discursosKeys } = Sync.mergeWeekendDisplayData(entry.data, speech);
    return order.map((gid) => {
      const meta = groups[gid];
      const groupFields = fields.filter((f) => f.group === gid);
      if (!groupFields.length || !meta) return '';
      const isSpecial = gid === 'especial';
      const gridClass = isSpecial ? 'cols-1' : '';
      const fieldsHtml = groupFields.map((f) => fieldInput(f, entry, isSpecial ? ' span-2' : '', {
        data,
        readonly: discursosKeys.includes(f.key),
        fromDiscursos: discursosKeys.includes(f.key)
      })).join('');
      return `
        <div class="qa-subsection${isSpecial ? ' qa-subsection--optional' : ''}">
          <div class="qa-subsection-head">
            <span class="material-symbols-outlined">${escapeHtml(meta.icon)}</span>
            ${escapeHtml(meta.title)}
          </div>
          <div class="qa-fields-grid${gridClass ? ' ' + gridClass : ''}">${fieldsHtml}</div>
        </div>`;
    }).join('');
  }

  function fieldsHtmlMecanicas(entry, fields) {
    const byKey = (k) => fields.find((f) => f.key === k);
    const row1 = ['portao', 'indicador', 'som'].map((k) => fieldCell(byKey(k), entry)).join('');
    const row2 = ['microf_volantes_1', 'microf_volantes_2', 'limpeza_grupo'].map((k) => fieldCell(byKey(k), entry)).join('');
    return `
      <div class="qa-table-block qa-table-block--mecanicas">
        <div class="qa-table-head"><span>Portão</span><span>Indicador</span><span>Som</span></div>
        <div class="qa-table-row">${row1}</div>
        <div class="qa-table-head"><span>Microf. volante 1</span><span>Microf. volante 2</span><span>Limpeza (grupo)</span></div>
        <div class="qa-table-row">${row2}</div>
      </div>`;
  }

  function fieldsHtmlGrouped(fields, entry, block) {
    if (block === 'mecanicas') return fieldsHtmlMecanicas(entry, fields);
    if (block === 'weekend') {
      const speechHint = Object.keys(receiveSpeechesByDate).length
        ? '<p class="text-xs text-on-surface-variant mb-3">Orador e tema de cada sábado vêm de <strong>Discursos Públicos → Recebemos</strong> (badge dourado). Presidente, Sentinela e território editam aqui.</p>'
        : '<p class="text-xs text-on-surface-variant mb-3">Preencha <strong>Discursos Públicos → Recebemos</strong> e salve para trazer orador e tema automaticamente.</p>';
      return speechHint + sectionShell('Programa de final de semana', 'weekend', fieldsHtmlWeekend(fields, entry));
    }
    const sections = ['header', 'tesouros', 'ministerio', 'vida'];
    return sections.map((sec) => {
      const secFields = fields.filter((f) => f.section === sec);
      if (!secFields.length) return '';
      const meta = MIDWEEK_SECTIONS[sec];
      const body = secFields.map((f) => fieldInput(f, entry)).join('');
      return sectionShell(meta.title, meta.icon, body);
    }).join('');
  }

  const BLOCK_TITLES = {
    mecanicas: 'Designações Mecânicas',
    midweek: 'Nossa Vida e Ministério Cristão',
    weekend: 'Discurso Público e Sentinela'
  };

  function selectBlockEntry(block, index) {
    readFormIntoEntries();
    const list = entriesFor(block);
    blockSelection[block] = Math.max(0, Math.min(index, list.length - 1));
    if (block === 'limpeza_mensal') renderLimpezaEditor();
    else renderBlockEditor(block, `editor-${block}`);
  }

  function bindEntryForm(container, block, list, idx) {
    const entry = list[idx];
    container.querySelector('[data-remove-entry]')?.addEventListener('click', async () => {
      if (!await window.JEDialog.confirm({
        title: 'Remover data',
        message: 'Remover esta data?',
        confirmLabel: 'Remover',
        danger: true
      })) return;
      readFormIntoEntries();
      entries = entries.filter((e) => e.id !== entry.id);
      blockSelection[block] = Math.min(blockSelection[block], entriesFor(block).length - 1);
      renderBlockEditorOnly(block);
    });
    container.querySelector('[data-prev-entry]')?.addEventListener('click', () => selectBlockEntry(block, idx - 1));
    container.querySelector('[data-next-entry]')?.addEventListener('click', () => selectBlockEntry(block, idx + 1));
    container.querySelectorAll('[data-nav-index]').forEach((btn) => {
      btn.addEventListener('click', () => selectBlockEntry(block, parseInt(btn.dataset.navIndex, 10)));
    });
  }

  function renderBlockEditor(block, containerId) {
    const container = $(containerId);
    if (!container) return;
    const list = entriesFor(block);
    const fields = Schemas.fieldsForBlock(block);

    if (!list.length) {
      container.innerHTML = '<p class="text-sm text-on-surface-variant py-8 text-center bg-white rounded-xl border border-outline-variant">Nenhuma data — use <strong>+ Data</strong> ou <strong>Regenerar datas</strong>.</p>';
      return;
    }

    let idx = blockSelection[block] ?? 0;
    if (idx >= list.length) idx = list.length - 1;
    blockSelection[block] = idx;
    const entry = list[idx];
    const dateTitle = entry.event_date ? Dates.formatDisplayDate(entry.event_date) : 'Sem data';

    const navHtml = list.map((e, i) => {
      const active = i === idx ? ' is-active' : '';
      const filled = entryFilled(e) ? ' is-filled' : '';
      return `
        <button type="button" data-nav-index="${i}" class="entry-nav-btn${active}${filled}">
          <span class="text-lg font-extrabold leading-none">${escapeHtml(dayNum(e.event_date))}</span>
          <span class="entry-nav-meta">${escapeHtml(e.weekday_label || '')}${entryFilled(e) ? ' · ✓' : ''}</span>
        </button>`;
    }).join('');

    container.innerHTML = `
      <div class="grid lg:grid-cols-[11rem_1fr] gap-4 items-start">
        <div class="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:max-h-[32rem] pb-1 lg:pb-0 shrink-0">
          ${navHtml}
        </div>
        <div class="qa-doc-panel min-w-0" data-entry-id="${entry.id}">
          <div class="qa-doc-banner">
            <div>
              <p class="qa-doc-banner-meta">${escapeHtml(BLOCK_TITLES[block] || block)} · ${idx + 1} de ${list.length}</p>
              <h3>${escapeHtml(dateTitle)} <span style="opacity:.9;font-weight:600">(${escapeHtml(entry.weekday_label || '')})</span></h3>
            </div>
            <label class="text-xs font-semibold shrink-0" style="opacity:.95">
              Data
              <input type="date" data-field="event_date" value="${entry.event_date || ''}" class="mt-1 block rounded border-0 text-[#002060] text-sm py-1.5 px-2"/>
            </label>
          </div>
          <div class="qa-doc-body">
            ${fieldsHtmlGrouped(fields, entry, block)}
          </div>
          ${window.JEHubDocFooter.renderDocEntryFooter({
            prevDisabled: idx === 0,
            nextDisabled: idx >= list.length - 1,
            removeAttrs: `data-remove-entry="${entry.id}"`,
            removeAria: 'Remover esta data'
          })}
        </div>
      </div>`;

    bindEntryForm(container, block, list, idx);
  }

  function renderLimpezaEditor() {
    const container = $('editor-limpeza');
    if (!container) return;
    const list = limpezaEntries();

    if (!list.length) {
      container.innerHTML = '<p class="text-xs text-on-surface-variant">Nenhuma linha — adicione abaixo.</p>';
      return;
    }

    let idx = blockSelection.limpeza_mensal ?? 0;
    if (idx >= list.length) idx = list.length - 1;
    blockSelection.limpeza_mensal = idx;
    const entry = list[idx];
    const d = entry.data || {};

    const tabs = list.map((e, i) => {
      const active = i === idx ? ' is-active' : '';
      const filled = entryFilled(e) ? ' is-filled' : '';
      return `<button type="button" data-nav-index="${i}" class="entry-nav-btn${active}${filled} px-4 py-2 !flex-row !items-center gap-2">
        <span class="text-sm font-bold">Linha ${i + 1}</span>${entryFilled(e) ? '<span class="text-xs">✓</span>' : ''}
      </button>`;
    }).join('');

    container.innerHTML = `
      <div class="space-y-3">
        <div class="flex flex-wrap gap-2">${tabs}</div>
        <div class="qa-table-block" data-entry-id="${entry.id}">
          <div class="qa-table-head"><span>Fim de semana</span><span>Grupo</span><span></span></div>
          <div class="qa-table-row">
            <div class="qa-cell"><label>Fim de semana</label>
              <input data-data-key="fim_de_semana" value="${escapeHtml(d.fim_de_semana || '')}" placeholder="03 - 04 de Junho"/></div>
            <div class="qa-cell"><label>Grupo</label>
              <select data-data-key="grupo">
                <option value=""></option>
                ${Schemas.CLEANING_GROUPS.map((g) => `<option ${d.grupo === g ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
              </select></div>
            <div class="qa-cell" aria-hidden="true"></div>
          </div>
        </div>
        ${window.JEHubDocFooter.renderDocEntryFooter({
          prevDisabled: idx === 0,
          nextDisabled: idx >= list.length - 1,
          removeAttrs: `data-remove-entry="${entry.id}"`,
          removeAria: 'Remover esta linha'
        })}
      </div>`;

    bindEntryForm(container, 'limpeza_mensal', list, idx);
  }

  function renderBlockEditorOnly(block) {
    if (block === 'limpeza_mensal') {
      renderLimpezaEditor();
      return;
    }
    renderBlockEditor(block, `editor-${block}`);
  }

  function renderActiveEditors() {
    const tab = activeEditorTab();
    if (tab === 'mecanicas') {
      renderBlockEditor('mecanicas', 'editor-mecanicas');
      renderLimpezaEditor();
    } else if (tab === 'midweek') {
      renderBlockEditor('midweek', 'editor-midweek');
    } else if (tab === 'weekend') {
      renderBlockEditor('weekend', 'editor-weekend');
    }
  }

  function newLocalId() {
    return 'local-' + crypto.randomUUID();
  }

  function addEntry(block, dateIso) {
    const d = dateIso ? new Date(dateIso + 'T12:00:00') : new Date();
    const entry = {
      id: newLocalId(),
      board_id: board?.id,
      block,
      event_date: dateIso || Dates.toISODate(d),
      weekday_label: Dates.WEEKDAY_PT[d.getDay()],
      sort_order: entriesFor(block).length + 1,
      data: Schemas.emptyData(block),
      export_to_calendar: true
    };
    entries.push(entry);
    blockSelection[block] = entriesFor(block).length - 1;
    renderBlockEditorOnly(block);
  }

  async function regenerateBlock(block) {
    if (!board) return;
    if (entriesFor(block).some((e) => Object.values(e.data || {}).some((v) => String(v).trim()))) {
      if (!await window.JEDialog.confirm({
        title: 'Regenerar datas',
        message: 'Regenerar apaga linhas desta seção e recria as datas do mês. Continuar?',
        confirmLabel: 'Regenerar'
      })) return;
    }
    entries = entries.filter((e) => e.block !== block);
    const generated = Dates.generateEntriesForBoard(block, board.reference_month);
    generated.forEach((g) => {
      entries.push({ ...g, id: newLocalId(), board_id: board.id, data: Schemas.emptyData(block) });
    });
    blockSelection[block] = 0;
    revokePendingPdf(block);
    renderBlockEditorOnly(block);
  }

  function resetBlockSelection() {
    blockSelection.mecanicas = 0;
    blockSelection.midweek = 0;
    blockSelection.weekend = 0;
    blockSelection.limpeza_mensal = 0;
  }

  function updateBoardLabel() {
    const el = $('board-label');
    if (!el) return;
    if (!board) {
      el.textContent = '—';
      return;
    }
    el.textContent = `${board.reference_label} — ${board.status === 'published' ? 'Publicado' : 'Rascunho'}`;
  }

  function switchToEditorTab(tab) {
    const btn = document.querySelector(`#qa-board-nav .tab-btn[data-tab="${tab}"]`);
    if (btn) btn.click();
  }

  function updateBoardNavIndicator() {
    const nav = document.getElementById('qa-board-nav');
    const indicator = document.getElementById('qa-board-nav-indicator');
    const active = nav?.querySelector('.qa-board-nav-link--active');
    if (!nav || !indicator || !active) {
      if (indicator) indicator.style.opacity = '0';
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const linkRect = active.getBoundingClientRect();
    if (!navRect.width || !linkRect.width) {
      indicator.style.opacity = '0';
      return;
    }
    indicator.style.opacity = '1';
    indicator.style.width = `${linkRect.width}px`;
    indicator.style.transform = `translateX(${linkRect.left - navRect.left}px)`;
  }

  function queueBoardNavIndicatorRefresh() {
    const run = () => updateBoardNavIndicator();
    run();
    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
  }

  function formatBoardDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  }

  async function hydrateBoardFromRecord(existing) {
    clearAllPendingPdfs();
    const referenceMonth = existing.reference_month;
    board = existing;
    entries = [];
    resetBlockSelection();

    const { data: rows } = await client.from('announcement_entries').select('*').eq('board_id', board.id).order('sort_order');
    const raw = (rows || []).map((r) => ({ ...r, data: r.data || {} }));
    const sanitized = Dates.sanitizeEntriesForMonth(raw, referenceMonth);
    entries = sanitized;

    let removedOtherMonth = 0;
    if (sanitized.length < raw.length) {
      removedOtherMonth = raw.length - sanitized.length;
      await persistEntries(true);
    }

    if (!entries.length) {
      ['mecanicas', 'midweek', 'weekend'].forEach((block) => {
        Dates.generateEntriesForBoard(block, referenceMonth).forEach((g, i) => {
          entries.push({ ...g, id: newLocalId(), board_id: board.id, sort_order: i + 1, data: Schemas.emptyData(block) });
        });
      });
      [{ fim_de_semana: '', grupo: '' }, { fim_de_semana: '', grupo: '' }].forEach((d, i) => {
        entries.push({ id: newLocalId(), board_id: board.id, block: 'limpeza_mensal', sort_order: i + 1, data: d, export_to_calendar: false });
      });
      await persistEntries(true);
    }

    updateBoardLabel();
    await loadReceiveSpeeches(true);
    renderActiveEditors();
    return removedOtherMonth;
  }

  async function loadBoardById(boardId) {
    const { data: existing, error } = await client
      .from('announcement_boards')
      .select('*')
      .eq('id', boardId)
      .maybeSingle();
    if (error || !existing) throw new Error('Quadro não encontrado.');

    $('board-month').value = existing.reference_month.slice(0, 7);
    await hydrateBoardFromRecord(existing);
    switchToEditorTab('mecanicas');
    renderPublishedList();
  }

  async function deleteBoard(boardId) {
    const item = savedBoards.find((b) => b.id === boardId);
    const label = item?.reference_label || 'este quadro';
    const isDraft = item?.status === 'draft';
    const message = isDraft
      ? `Excluir o rascunho "${label}"?\n\nTodas as designações deste período serão apagadas. Esta ação não pode ser desfeita.`
      : `Excluir "${label}"?\n\nO registro do quadro será removido. Os PDFs já publicados no site permanecem até você publicar outra versão.`;

    if (!await window.JEDialog.confirm({
      title: isDraft ? 'Excluir rascunho' : 'Excluir quadro',
      message,
      confirmLabel: 'Excluir',
      danger: true
    })) return;

    const { error } = await client.from('announcement_boards').delete().eq('id', boardId);
    if (error) throw new Error(error.message);

    if (board?.id === boardId) {
      board = null;
      entries = [];
      resetBlockSelection();
      clearAllPendingPdfs();
      updateBoardLabel();
      renderActiveEditors();
    }

    showToast(toastEl, isDraft ? 'Rascunho excluído.' : 'Quadro excluído.');
    await loadPublishedList();
  }

  async function loadOrCreateBoard() {
    const monthInput = $('board-month').value;
    if (!monthInput) {
      showToast(toastEl, 'Selecione um mês.', true);
      return;
    }
    const [y, m] = monthInput.split('-').map(Number);
    const referenceMonth = `${y}-${String(m).padStart(2, '0')}-01`;
    const referenceLabel = Dates.monthLabel(y, m - 1);

    entries = [];
    resetBlockSelection();
    clearAllPendingPdfs();

    let existing = null;
    try {
      const { data, error } = await client
        .from('announcement_boards')
        .select('*')
        .eq('reference_month', referenceMonth)
        .neq('status', 'archived')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      existing = data;

    if (existing) {
      const removedOtherMonth = await hydrateBoardFromRecord(existing);
      if (removedOtherMonth > 0) {
        showToast(toastEl, `${removedOtherMonth} data(s) de outro mês removida(s) — quadro de ${board.reference_label} atualizado.`);
      } else {
        showToast(toastEl, 'Quadro carregado.');
      }
    } else {
      const { data: created, error } = await client.from('announcement_boards').insert({
        reference_month: referenceMonth,
        reference_label: referenceLabel,
        status: 'draft'
      }).select().single();
      if (error) { showToast(toastEl, error.message, true); return; }
      board = created;
      ['mecanicas', 'midweek', 'weekend'].forEach((block) => {
        Dates.generateEntriesForBoard(block, referenceMonth).forEach((g, i) => {
          entries.push({
            ...g,
            id: newLocalId(),
            board_id: board.id,
            sort_order: i + 1,
            data: Schemas.emptyData(block)
          });
        });
      });
      [{ fim_de_semana: '', grupo: '' }, { fim_de_semana: '', grupo: '' }].forEach((d, i) => {
        entries.push({
          id: newLocalId(),
          board_id: board.id,
          block: 'limpeza_mensal',
          sort_order: i + 1,
          data: d,
          export_to_calendar: false
        });
      });
      await persistEntries(true);
      updateBoardLabel();
      await loadReceiveSpeeches(true);
      renderActiveEditors();
      showToast(toastEl, 'Novo quadro criado com datas do mês.');
    }
    await loadPublishedList();
    } catch (err) {
      showToast(toastEl, err.message || 'Erro ao carregar quadro.', true);
      throw err;
    }
  }

  async function persistEntries(skipRead) {
    if (!skipRead) readFormIntoEntries();
    if (!board?.id) return;

    const { error: delErr } = await client.from('announcement_entries').delete().eq('board_id', board.id);
    if (delErr) throw new Error(delErr.message);

    const payload = entries.map((e, idx) => ({
      board_id: board.id,
      block: e.block,
      event_date: e.event_date || null,
      weekday_label: e.weekday_label || null,
      sort_order: e.sort_order ?? idx,
      data: e.data || {},
      export_to_calendar: e.export_to_calendar !== false
    }));

    const { data: saved, error } = await client.from('announcement_entries').insert(payload).select();
    if (error) throw new Error(error.message);

    entries = (saved || []).map((r) => ({ ...r, data: r.data || {} }));
    await client.from('announcement_boards').update({ updated_at: new Date().toISOString() }).eq('id', board.id);
  }

  async function saveDraft() {
    try {
      readFormIntoEntries();
      if (!board) { showToast(toastEl, 'Carregue um quadro primeiro.', true); return; }
      await persistEntries();
      clearAllPendingPdfs();
      showToast(toastEl, 'Rascunho salvo.');
    } catch (err) {
      showToast(toastEl, err.message, true);
    }
  }

  function revokePendingPdf(block) {
    if (pendingPdfs[block]?.objectUrl) {
      URL.revokeObjectURL(pendingPdfs[block].objectUrl);
    }
    delete pendingPdfs[block];
    updatePublishButtonsState();
  }

  function clearAllPendingPdfs() {
    Object.keys(pendingPdfs).forEach((block) => revokePendingPdf(block));
  }

  function updatePublishButtonsState() {
    document.querySelectorAll('.btn-publish-block').forEach((btn) => {
      const block = btn.dataset.publishBlock;
      const ready = !!pendingPdfs[block]?.blob;
      btn.disabled = !ready;
      btn.title = ready ? 'Publica o PDF revisado no site' : 'Gere o PDF antes de publicar';
    });
  }

  function openPdfPreviewModal(block) {
    const pending = pendingPdfs[block];
    if (!pending?.objectUrl) return;
    pdfPreviewBlock = block;
    const frame = $('pdf-preview-frame');
    const title = $('pdf-preview-title');
    const openTab = $('pdf-preview-open-tab');
    if (title) title.textContent = `Prévia — ${Schemas.SECTION_TITLES[block]}`;
    if (frame) frame.src = pending.objectUrl;
    if (openTab) openTab.href = pending.objectUrl;
    $('pdf-preview-modal')?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closePdfPreviewModal() {
    $('pdf-preview-modal')?.classList.add('hidden');
    const frame = $('pdf-preview-frame');
    if (frame) frame.src = 'about:blank';
    document.body.style.overflow = '';
    pdfPreviewBlock = null;
  }

  async function generatePdfBlock(block) {
    try {
      readFormIntoEntries();
      if (!board) { showToast(toastEl, 'Carregue um quadro primeiro.', true); return; }

      showToast(toastEl, 'Gerando PDF…');
      const pdfEntries = block === 'weekend'
        ? Sync.mergeWeekendEntries(entries, receiveSpeechesByDate)
        : entries;
      const blob = await pdfApi().blockToPdfBlob(block, board, pdfEntries);

      if (entries.some((e) => String(e.id).startsWith('local-'))) {
        await persistEntries(true);
      }

      revokePendingPdf(block);
      const objectUrl = URL.createObjectURL(blob);
      pendingPdfs[block] = { blob, objectUrl };
      updatePublishButtonsState();
      openPdfPreviewModal(block);
      showToast(toastEl, `${Schemas.SECTION_TITLES[block]} — PDF pronto para revisão.`);
    } catch (err) {
      showToast(toastEl, err.message || 'Erro ao gerar PDF.', true);
      console.error(err);
    }
  }

  async function publishBlock(block) {
    try {
      const pending = pendingPdfs[block];
      if (!pending?.blob) {
        showToast(toastEl, 'Gere e revise o PDF antes de publicar.', true);
        return;
      }
      if (!board) { showToast(toastEl, 'Carregue um quadro primeiro.', true); return; }

      readFormIntoEntries();
      await persistEntries();

      const blob = pending.blob;
      const path = `${board.id}/${block}-${Date.now()}.pdf`;

      const { error: upErr } = await client.storage.from('announcements').upload(path, blob, {
        upsert: true,
        contentType: 'application/pdf'
      });
      if (upErr) throw new Error(upErr.message);

      const { data: pub } = client.storage.from('announcements').getPublicUrl(path);
      const pdfUrl = pub.publicUrl;

      const col = block === 'mecanicas' ? 'pdf_mecanicas_url' : block === 'midweek' ? 'pdf_midweek_url' : 'pdf_weekend_url';
      const boardUpdate = {
        [col]: pdfUrl,
        updated_at: new Date().toISOString(),
        status: 'published',
        published_at: board.published_at || new Date().toISOString()
      };
      const { error: boardErr } = await client.from('announcement_boards').update(boardUpdate).eq('id', board.id);
      if (boardErr) throw new Error(boardErr.message);

      const slug = Schemas.SECTION_SLUGS[block];
      const { error: sectionErr } = await client.from('announcement_sections').update({ document_url: pdfUrl, updated_at: new Date().toISOString() }).eq('slug', slug);
      if (sectionErr) throw new Error(sectionErr.message);

      board[col] = pdfUrl;
      board.status = 'published';
      board.published_at = boardUpdate.published_at;
      revokePendingPdf(block);
      closePdfPreviewModal();
      updateBoardLabel();
      showToast(toastEl, `${Schemas.SECTION_TITLES[block]} publicado no site.`);
      loadPublishedList();
    } catch (err) {
      showToast(toastEl, err.message || 'Erro ao publicar.', true);
      console.error(err);
    }
  }

  function activeEditorTab() {
    const btn = document.querySelector('#qa-board-nav .qa-board-nav-link--active[data-tab]');
    const tab = btn?.dataset.tab;
    return ['mecanicas', 'midweek', 'weekend'].includes(tab) ? tab : 'mecanicas';
  }

  function setGcalExportBlock(block) {
    gcalExportBlock = block;
    document.querySelectorAll('.gcal-block-btn').forEach((btn) => {
      const active = btn.dataset.gcalBlock === block;
      btn.classList.toggle('tab-active', active);
      btn.classList.toggle('text-on-surface-variant', !active);
    });
    const meta = Export.BLOCK_EXPORT_META[block];
    const titleEl = $('gcal-block-title');
    const rulesEl = $('gcal-block-rules-list');
    if (titleEl && meta) titleEl.textContent = meta.title;
    if (rulesEl && meta) {
      rulesEl.innerHTML = meta.rules.map((r) => `<li>${escapeHtml(r)}</li>`).join('');
    }
    refreshCsvPreview();
  }

  function refreshCsvPreview() {
    readFormIntoEntries();
    const list = gcalExportBlock === 'weekend'
      ? Sync.mergeWeekendEntries(entries, receiveSpeechesByDate)
      : entries;
    const csv = Export.buildCsvForBlock(list, gcalExportBlock);
    const el = $('csv-preview');
    if (el) el.value = csv;
  }

  function renderPublishedList() {
    const list = $('published-list');
    if (!list) return;

    const filtered = savedBoards.filter((b) => boardListFilter === 'all' || b.status === boardListFilter);

    if (!filtered.length) {
      const emptyMsg = boardListFilter === 'draft'
        ? 'Nenhum rascunho. Crie um quadro pelo seletor de mês acima.'
        : boardListFilter === 'published'
          ? 'Nenhum quadro publicado ainda.'
          : 'Nenhum quadro salvo. Use "Novo / Carregar" para começar.';
      list.innerHTML = `<div class="board-card justify-center text-sm text-on-surface-variant py-8">${escapeHtml(emptyMsg)}</div>`;
      return;
    }

    list.innerHTML = filtered.map((b) => {
      const isCurrent = board?.id === b.id;
      const isDraft = b.status === 'draft';
      const statusClass = isDraft ? 'board-status--draft' : 'board-status--published';
      const statusLabel = isDraft ? 'Rascunho' : 'Publicado';
      const pdfs = [
        b.pdf_mecanicas_url ? 'Mecânicas' : null,
        b.pdf_midweek_url ? 'VMC' : null,
        b.pdf_weekend_url ? 'Final de semana' : null
      ].filter(Boolean);
      const pdfHtml = pdfs.length
        ? pdfs.map((p) => `<span class="board-pdf-chip">${escapeHtml(p)}</span>`).join('')
        : '<span class="text-xs text-on-surface-variant">Nenhuma seção publicada</span>';
      const updated = formatBoardDate(b.updated_at || b.published_at);

      return `
        <article class="board-card${isCurrent ? ' is-current' : ''}" data-board-id="${b.id}">
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-bold text-primary">${escapeHtml(b.reference_label)}</h3>
              <span class="board-status ${statusClass}">${statusLabel}</span>
              ${isCurrent ? '<span class="text-[10px] font-bold uppercase tracking-wider text-accent">Em edição</span>' : ''}
            </div>
            <div class="flex flex-wrap gap-1.5 mt-2">${pdfHtml}</div>
            ${updated ? `<p class="text-xs text-on-surface-variant mt-2">Atualizado em ${escapeHtml(updated)}</p>` : ''}
          </div>
          <div class="flex flex-wrap gap-2 shrink-0">
            <button type="button" data-board-edit="${b.id}" class="board-action-btn board-action-btn--edit">
              <span class="material-symbols-outlined" style="font-size:16px">edit</span>
              Editar
            </button>
            <button type="button" data-board-delete="${b.id}" class="board-action-btn board-action-btn--delete">
              <span class="material-symbols-outlined" style="font-size:16px">${isDraft ? 'delete' : 'delete_forever'}</span>
              ${isDraft ? 'Excluir' : 'Excluir'}
            </button>
          </div>
        </article>`;
    }).join('');

    list.querySelectorAll('[data-board-edit]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await loadBoardById(btn.dataset.boardEdit);
          showToast(toastEl, 'Quadro aberto para edição.');
        } catch (err) {
          showToast(toastEl, err.message || 'Erro ao abrir quadro.', true);
        }
      });
    });

    list.querySelectorAll('[data-board-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await deleteBoard(btn.dataset.boardDelete);
        } catch (err) {
          showToast(toastEl, err.message || 'Erro ao excluir.', true);
        }
      });
    });
  }

  async function loadPublishedList() {
    const { data, error } = await client
      .from('announcement_boards')
      .select('id, reference_label, reference_month, status, published_at, updated_at, pdf_mecanicas_url, pdf_midweek_url, pdf_weekend_url')
      .neq('status', 'archived')
      .order('reference_month', { ascending: false })
      .limit(24);
    if (error) {
      const list = $('published-list');
      if (list) list.innerHTML = `<p class="text-error text-sm px-4 py-6">${escapeHtml(error.message)}</p>`;
      return;
    }
    savedBoards = data || [];
    renderPublishedList();
  }

  function setupPublishedFilters() {
    document.querySelectorAll('[data-board-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        boardListFilter = btn.dataset.boardFilter || 'all';
        document.querySelectorAll('[data-board-filter]').forEach((b) => {
          b.classList.toggle('is-active', b === btn);
        });
        renderPublishedList();
      });
    });
  }

  async function loadHistorySettings() {
    const { data } = await client.from('announcement_settings').select('*').eq('id', 1).maybeSingle();
    if (data) {
      $('history-url').value = data.history_folder_url || '';
      $('history-desc').value = data.history_description || '';
    }
  }

  function setupTabs() {
    const editorTabs = ['mecanicas', 'midweek', 'weekend'];

    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        readFormIntoEntries();
        const tab = btn.dataset.tab;
        const isEditorTab = editorTabs.includes(tab);

        document.querySelectorAll('#qa-board-nav .tab-btn').forEach((b) => {
          const active = isEditorTab && b === btn;
          b.classList.toggle('qa-board-nav-link--active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        document.querySelectorAll('.tab-util-btn').forEach((b) => {
          b.classList.toggle('tab-active', !isEditorTab && b === btn);
          b.classList.toggle('text-on-surface-variant', b !== btn);
        });

        if (isEditorTab) queueBoardNavIndicatorRefresh();
        else {
          const indicator = document.getElementById('qa-board-nav-indicator');
          if (indicator) indicator.style.opacity = '0';
        }

        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
        $('panel-' + tab)?.classList.remove('hidden');
        if (tab === 'published') loadPublishedList();
        else if (board && isEditorTab) renderActiveEditors();
      });
    });

    queueBoardNavIndicatorRefresh();
    if (!window.__JEBoardNavIndicatorBound) {
      window.__JEBoardNavIndicatorBound = true;
      window.addEventListener('resize', queueBoardNavIndicatorRefresh);
    }
  }

  function openGcalExportModal() {
    if (!board) {
      showToast(toastEl, 'Carregue um quadro do mês antes de exportar.', true);
      return;
    }
    setGcalExportBlock(activeEditorTab());
    const modal = $('gcal-export-modal');
    modal?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeGcalExportModal() {
    $('gcal-export-modal')?.classList.add('hidden');
    document.body.style.overflow = '';
  }

  async function init() {
    if (window.__JEAdminAnunciosInit) return;
    window.__JEAdminAnunciosInit = true;
    if (!(await guardAnnouncements())) return;
    toastEl = adminToastEl() || $('admin-toast');
    client = await getClient();

    const now = new Date();
    $('board-month').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    setupTabs();
    setupPublishedFilters();
    await Promise.all([loadHistorySettings(), loadPublishedList()]);

    $('btn-new-board').addEventListener('click', loadOrCreateBoard);
    $('btn-save-draft').addEventListener('click', saveDraft);
    document.querySelectorAll('.btn-save-draft').forEach((b) => b.addEventListener('click', saveDraft));
    document.querySelectorAll('.btn-generate-pdf').forEach((b) => b.addEventListener('click', () => generatePdfBlock(b.dataset.generatePdf)));
    document.querySelectorAll('.btn-publish-block').forEach((b) => b.addEventListener('click', () => publishBlock(b.dataset.publishBlock)));

    $('pdf-preview-close')?.addEventListener('click', closePdfPreviewModal);
    $('pdf-preview-backdrop')?.addEventListener('click', closePdfPreviewModal);
    $('pdf-preview-open-tab')?.addEventListener('click', (e) => {
      const pending = pdfPreviewBlock && pendingPdfs[pdfPreviewBlock];
      if (!pending?.objectUrl) e.preventDefault();
    });
    $('pdf-preview-publish')?.addEventListener('click', () => {
      if (pdfPreviewBlock) publishBlock(pdfPreviewBlock);
    });

    $('btn-regen-mecanicas').addEventListener('click', () => regenerateBlock('mecanicas'));
    $('btn-regen-midweek').addEventListener('click', () => regenerateBlock('midweek'));
    $('btn-regen-weekend').addEventListener('click', () => regenerateBlock('weekend'));

    $('btn-add-mecanicas').addEventListener('click', () => addEntry('mecanicas'));
    $('btn-add-midweek').addEventListener('click', () => addEntry('midweek'));
    $('btn-add-weekend').addEventListener('click', () => addEntry('weekend'));

    $('btn-add-limpeza').addEventListener('click', () => {
      entries.push({
        id: newLocalId(),
        board_id: board?.id,
        block: 'limpeza_mensal',
        sort_order: limpezaEntries().length + 1,
        data: { fim_de_semana: '', grupo: '' },
        export_to_calendar: false
      });
      blockSelection.limpeza_mensal = limpezaEntries().length - 1;
      renderLimpezaEditor();
    });

    $('btn-download-csv').addEventListener('click', () => {
      refreshCsvPreview();
      const monthLabel = board?.reference_label?.replace(/\s+/g, '-') || 'quadro';
      const blockSlug = Export.BLOCK_EXPORT_META[gcalExportBlock]?.filename || gcalExportBlock;
      Export.downloadCsv($('csv-preview').value, `google-agenda-${blockSlug}-${monthLabel}.csv`);
      showToast(toastEl, 'CSV baixado — importe em calendar.google.com → Configurações → Importar.');
    });

    document.querySelectorAll('.gcal-block-btn').forEach((btn) => {
      btn.addEventListener('click', () => setGcalExportBlock(btn.dataset.gcalBlock));
    });

    $('btn-open-gcal-export').addEventListener('click', openGcalExportModal);
    $('gcal-export-close').addEventListener('click', closeGcalExportModal);
    $('gcal-export-backdrop').addEventListener('click', closeGcalExportModal);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('gcal-export-modal')?.classList.contains('hidden')) closeGcalExportModal();
      else if (!$('pdf-preview-modal')?.classList.contains('hidden')) closePdfPreviewModal();
    });

    $('history-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await client.from('announcement_settings').upsert({
        id: 1,
        history_folder_url: $('history-url').value.trim(),
        history_description: $('history-desc').value.trim()
      });
      if (error) showToast(toastEl, error.message, true);
      else showToast(toastEl, 'Histórico salvo.');
    });

    const loadBoardWhenIdle = async () => {
      try {
        await loadOrCreateBoard();
        updatePublishButtonsState();
      } catch (err) {
        showToast(toastEl, err.message || 'Erro ao carregar quadro.', true);
        console.error(err);
      }
    };
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => { loadBoardWhenIdle(); }, { timeout: 900 });
    } else {
      setTimeout(loadBoardWhenIdle, 0);
    }
  }

  window.JEAdminAnuncios = { init };

  if (!window.JEHubRouter && document.getElementById('board-month')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})();
