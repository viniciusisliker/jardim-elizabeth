(function () {
  const { guardAdmin, getClient, showToast, escapeHtml } = window.JEAdmin;
  const Dates = window.JEAnnouncementDates;
  const Schemas = window.JEAnnouncementSchemas;
  const Pdf = window.JEAnnouncementPdf;
  const Export = window.JEAnnouncementExport;

  let board = null;
  let entries = [];
  let client = null;
  let toastEl = null;

  function $(id) { return document.getElementById(id); }

  function entriesFor(block) {
    return entries.filter((e) => e.block === block).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  function limpezaEntries() {
    return entries.filter((e) => e.block === 'limpeza_mensal').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  function readFormIntoEntries() {
    document.querySelectorAll('[data-entry-id]').forEach((card) => {
      const id = card.dataset.entryId;
      const entry = entries.find((e) => e.id === id);
      if (!entry) return;
      const dateInput = card.querySelector('[data-field="event_date"]');
      if (dateInput) entry.event_date = dateInput.value || null;
      card.querySelectorAll('[data-data-key]').forEach((input) => {
        entry.data = entry.data || {};
        entry.data[input.dataset.dataKey] = input.value;
      });
    });
  }

  function fieldInput(field, entry) {
    const val = (entry.data && entry.data[field.key]) || '';
    if (field.type === 'select') {
      const opts = (field.options || Schemas.CLEANING_GROUPS).map((o) =>
        `<option value="${escapeHtml(o)}" ${val === o ? 'selected' : ''}>${escapeHtml(o)}</option>`
      ).join('');
      return `<label class="block text-xs font-semibold text-on-surface-variant">${escapeHtml(field.label)}
        <select data-data-key="${field.key}" class="mt-0.5 w-full rounded border-outline-variant text-sm"><option value=""></option>${opts}</select></label>`;
    }
    return `<label class="block text-xs font-semibold text-on-surface-variant">${escapeHtml(field.label)}
      <input data-data-key="${field.key}" value="${escapeHtml(val)}" class="mt-0.5 w-full rounded border-outline-variant text-sm"/></label>`;
  }

  function renderEntryCard(entry, fields, container) {
    const card = document.createElement('div');
    card.className = 'bg-white border border-outline-variant rounded-xl p-4';
    card.dataset.entryId = entry.id;
    const fieldsHtml = fields.map((f) => fieldInput(f, entry)).join('');
    card.innerHTML = `
      <div class="flex items-center justify-between gap-2 mb-3">
        <label class="text-sm font-bold text-primary flex items-center gap-2">
          Data <input type="date" data-field="event_date" value="${entry.event_date || ''}" class="rounded border-outline-variant text-sm font-normal"/>
          <span class="text-xs text-on-surface-variant">${escapeHtml(entry.weekday_label || '')}</span>
        </label>
        <button type="button" data-remove-entry="${entry.id}" class="text-xs text-error font-semibold">Remover</button>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">${fieldsHtml}</div>`;
    container.appendChild(card);
    card.querySelector('[data-remove-entry]')?.addEventListener('click', () => {
      if (!confirm('Remover esta linha?')) return;
      entries = entries.filter((e) => e.id !== entry.id);
      renderAllEditors();
    });
  }

  function renderBlockEditor(block, containerId) {
    const container = $(containerId);
    if (!container) return;
    container.innerHTML = '';
    const fields = Schemas.fieldsForBlock(block);
    entriesFor(block).forEach((entry) => renderEntryCard(entry, fields, container));
  }

  function renderLimpezaEditor() {
    const container = $('editor-limpeza');
    if (!container) return;
    container.innerHTML = '';
    limpezaEntries().forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'grid sm:grid-cols-3 gap-2 items-end';
      row.dataset.entryId = entry.id;
      const d = entry.data || {};
      row.innerHTML = `
        <label class="text-xs font-semibold sm:col-span-1">Fim de semana<input data-data-key="fim_de_semana" value="${escapeHtml(d.fim_de_semana || '')}" class="mt-0.5 w-full rounded border-outline-variant text-sm"/></label>
        <label class="text-xs font-semibold sm:col-span-1">Grupo
          <select data-data-key="grupo" class="mt-0.5 w-full rounded border-outline-variant text-sm">
            <option value=""></option>
            ${Schemas.CLEANING_GROUPS.map((g) => `<option ${d.grupo === g ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
          </select>
        </label>
        <button type="button" data-remove-entry="${entry.id}" class="text-xs text-error font-semibold pb-2">Remover</button>`;
      container.appendChild(row);
      row.querySelector('[data-remove-entry]')?.addEventListener('click', () => {
        entries = entries.filter((e) => e.id !== entry.id);
        renderLimpezaEditor();
      });
    });
    if (!limpezaEntries().length) {
      container.innerHTML = '<p class="text-xs text-on-surface-variant">Nenhuma linha — adicione abaixo.</p>';
    }
  }

  function renderAllEditors() {
    renderBlockEditor('mecanicas', 'editor-mecanicas');
    renderBlockEditor('midweek', 'editor-midweek');
    renderBlockEditor('weekend', 'editor-weekend');
    renderLimpezaEditor();
    refreshCsvPreview();
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
    renderAllEditors();
  }

  async function regenerateBlock(block) {
    if (!board) return;
    if (entriesFor(block).some((e) => Object.values(e.data || {}).some((v) => String(v).trim()))) {
      if (!confirm('Regenerar apaga linhas desta seção e recria as datas do mês. Continuar?')) return;
    }
    entries = entries.filter((e) => e.block !== block);
    const generated = Dates.generateEntriesForBoard(block, board.reference_month);
    generated.forEach((g) => {
      entries.push({ ...g, id: newLocalId(), board_id: board.id, data: Schemas.emptyData(block) });
    });
    renderAllEditors();
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
      board = existing;
      const { data: rows } = await client.from('announcement_entries').select('*').eq('board_id', board.id).order('sort_order');
      entries = (rows || []).map((r) => ({ ...r, data: r.data || {} }));
      if (!entries.length) {
        ['mecanicas', 'midweek', 'weekend'].forEach((block) => {
          Dates.generateEntriesForBoard(block, referenceMonth).forEach((g, i) => {
            entries.push({ ...g, id: newLocalId(), board_id: board.id, sort_order: i + 1, data: Schemas.emptyData(block) });
          });
        });
        [{ fim_de_semana: '', grupo: '' }, { fim_de_semana: '', grupo: '' }].forEach((d, i) => {
          entries.push({ id: newLocalId(), board_id: board.id, block: 'limpeza_mensal', sort_order: i + 1, data: d, export_to_calendar: false });
        });
        await persistEntries();
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
      await persistEntries();
    }

    $('board-label').textContent = `${board.reference_label} — ${board.status === 'published' ? 'Publicado' : 'Rascunho'}`;
    renderAllEditors();
    showToast(toastEl, existing ? 'Quadro carregado.' : 'Novo quadro criado com datas do mês.');
    } catch (err) {
      showToast(toastEl, err.message || 'Erro ao carregar quadro.', true);
      throw err;
    }
  }

  async function persistEntries() {
    readFormIntoEntries();
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
      showToast(toastEl, 'Rascunho salvo.');
    } catch (err) {
      showToast(toastEl, err.message, true);
    }
  }

  async function publishBlock(block) {
    try {
      readFormIntoEntries();
      if (!board) { showToast(toastEl, 'Carregue um quadro primeiro.', true); return; }
      await persistEntries();

      const html = Pdf.renderHtml(block, board, entries);
      const blob = await Pdf.htmlToPdfBlob(html);
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
      $('board-label').textContent = `${board.reference_label} — Publicado`;
      showToast(toastEl, `${Schemas.SECTION_TITLES[block]} publicado no site.`);
      loadPublishedList();
    } catch (err) {
      showToast(toastEl, err.message || 'Erro ao publicar.', true);
      console.error(err);
    }
  }

  function refreshCsvPreview() {
    readFormIntoEntries();
    const csv = Export.buildCsvRows(entries.filter((e) => e.block !== 'limpeza_mensal'), '19:30');
    const el = $('csv-preview');
    if (el) el.value = csv;
  }

  async function loadPublishedList() {
    const { data } = await client.from('announcement_boards').select('id, reference_label, status, published_at, pdf_mecanicas_url, pdf_midweek_url, pdf_weekend_url').order('reference_month', { ascending: false }).limit(12);
    const list = $('published-list');
    if (!list) return;
    list.innerHTML = (data || []).map((b) => `
      <div class="px-4 py-3 text-sm">
        <p class="font-bold text-primary">${escapeHtml(b.reference_label)} <span class="text-xs font-normal text-on-surface-variant">(${escapeHtml(b.status)})</span></p>
        <p class="text-xs text-on-surface-variant mt-1">
          ${b.pdf_mecanicas_url ? '✓ Mecânicas ' : ''}${b.pdf_midweek_url ? '✓ VMC ' : ''}${b.pdf_weekend_url ? '✓ Final de semana' : ''}
        </p>
      </div>`).join('') || '<p class="px-4 py-6 text-sm text-on-surface-variant">Nenhum quadro ainda.</p>';
  }

  async function loadHistorySettings() {
    const { data } = await client.from('announcement_settings').select('*').eq('id', 1).maybeSingle();
    if (data) {
      $('history-url').value = data.history_folder_url || '';
      $('history-desc').value = data.history_description || '';
    }
  }

  function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach((b) => {
          b.classList.toggle('tab-active', b === btn);
          b.classList.toggle('text-on-surface-variant', b !== btn);
        });
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
        $('panel-' + tab)?.classList.remove('hidden');
        if (tab === 'export') refreshCsvPreview();
        if (tab === 'published') loadPublishedList();
      });
    });
  }

  async function init() {
    if (!(await guardAdmin())) return;
    toastEl = $('admin-toast');
    client = await getClient();

    const now = new Date();
    $('board-month').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    setupTabs();
    await loadHistorySettings();
    await loadPublishedList();

    $('btn-new-board').addEventListener('click', loadOrCreateBoard);
    $('btn-save-draft').addEventListener('click', saveDraft);
    document.querySelectorAll('.btn-save-draft').forEach((b) => b.addEventListener('click', saveDraft));
    document.querySelectorAll('.btn-publish').forEach((b) => b.addEventListener('click', () => publishBlock(b.dataset.publish)));

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
      renderLimpezaEditor();
    });

    $('btn-download-csv').addEventListener('click', () => {
      refreshCsvPreview();
      const label = board?.reference_label?.replace(/\s+/g, '-') || 'quadro';
      Export.downloadCsv($('csv-preview').value, `calendario-${label}.csv`);
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

    try {
      await loadOrCreateBoard();
    } catch (err) {
      showToast(toastEl, err.message || 'Erro ao carregar quadro.', true);
      console.error(err);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
