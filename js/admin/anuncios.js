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
  const blockSelection = { mecanicas: 0, midweek: 0, weekend: 0, limpeza_mensal: 0 };

  const MIDWEEK_SECTIONS = {
    header: 'Semana',
    tesouros: 'Tesouros da Palavra de Deus',
    ministerio: 'Faça seu melhor no ministério',
    vida: 'Nossa vida cristã'
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
    return Object.values(entry.data || {}).some((v) => String(v || '').trim());
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
        entry.data = entry.data || {};
        entry.data[input.dataset.dataKey] = input.value;
      });
    });
  }

  function fieldInput(field, entry) {
    const val = (entry.data && entry.data[field.key]) || '';
    const inputCls = 'mt-1.5 w-full rounded-lg border-outline-variant text-sm py-2 px-3 focus:border-secondary focus:ring-1 focus:ring-secondary';
    const labelCls = 'block text-sm font-semibold text-primary';
    if (field.type === 'select') {
      const opts = (field.options || Schemas.CLEANING_GROUPS).map((o) =>
        `<option value="${escapeHtml(o)}" ${val === o ? 'selected' : ''}>${escapeHtml(o)}</option>`
      ).join('');
      return `<label class="${labelCls}">${escapeHtml(field.label)}
        <select data-data-key="${field.key}" class="${inputCls}"><option value=""></option>${opts}</select></label>`;
    }
    return `<label class="${labelCls}">${escapeHtml(field.label)}
      <input data-data-key="${field.key}" value="${escapeHtml(val)}" class="${inputCls}"/></label>`;
  }

  function fieldsHtmlGrouped(fields, entry, block) {
    if (block !== 'midweek') {
      return `<div class="grid sm:grid-cols-2 gap-4">${fields.map((f) => fieldInput(f, entry)).join('')}</div>`;
    }
    const sections = ['header', 'tesouros', 'ministerio', 'vida'];
    return sections.map((sec) => {
      const secFields = fields.filter((f) => f.section === sec);
      if (!secFields.length) return '';
      return `
        <div class="space-y-3">
          <h4 class="text-xs font-bold uppercase tracking-widest text-secondary border-b border-outline-variant pb-2">${escapeHtml(MIDWEEK_SECTIONS[sec])}</h4>
          <div class="grid sm:grid-cols-2 gap-4">${secFields.map((f) => fieldInput(f, entry)).join('')}</div>
        </div>`;
    }).join('');
  }

  function selectBlockEntry(block, index) {
    readFormIntoEntries();
    const list = entriesFor(block);
    blockSelection[block] = Math.max(0, Math.min(index, list.length - 1));
    if (block === 'limpeza_mensal') renderLimpezaEditor();
    else renderBlockEditor(block, `editor-${block}`);
  }

  function bindEntryForm(container, block, list, idx) {
    const entry = list[idx];
    container.querySelector('[data-remove-entry]')?.addEventListener('click', () => {
      if (!confirm('Remover esta data?')) return;
      readFormIntoEntries();
      entries = entries.filter((e) => e.id !== entry.id);
      blockSelection[block] = Math.min(blockSelection[block], entriesFor(block).length - 1);
      renderAllEditors();
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
        <div class="bg-white border border-outline-variant rounded-2xl p-5 sm:p-6 shadow-sm min-w-0" data-entry-id="${entry.id}">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-4 border-b border-outline-variant">
            <div>
              <p class="text-xs font-bold uppercase tracking-widest text-secondary mb-1">${idx + 1} de ${list.length}</p>
              <h3 class="text-xl font-extrabold text-primary">${escapeHtml(dateTitle)}</h3>
              <p class="text-sm text-on-surface-variant mt-0.5">${escapeHtml(entry.weekday_label || '')}</p>
            </div>
            <label class="text-sm font-semibold text-primary shrink-0">
              Alterar data
              <input type="date" data-field="event_date" value="${entry.event_date || ''}" class="mt-1 block rounded-lg border-outline-variant text-sm py-2 px-3"/>
            </label>
          </div>
          <div class="space-y-6">${fieldsHtmlGrouped(fields, entry, block)}</div>
          <div class="flex flex-wrap items-center justify-between gap-3 mt-8 pt-4 border-t border-outline-variant">
            <button type="button" data-prev-entry" ${idx === 0 ? 'disabled' : ''} class="text-sm font-semibold text-secondary disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1">
              <span class="material-symbols-outlined" style="font-size:18px">chevron_left</span> Anterior
            </button>
            <button type="button" data-remove-entry="${entry.id}" class="text-xs font-semibold text-error">Remover esta data</button>
            <button type="button" data-next-entry" ${idx >= list.length - 1 ? 'disabled' : ''} class="text-sm font-semibold text-secondary disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1">
              Próxima <span class="material-symbols-outlined" style="font-size:18px">chevron_right</span>
            </button>
          </div>
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
        <div class="grid sm:grid-cols-2 gap-4 p-4 bg-background rounded-xl border border-outline-variant" data-entry-id="${entry.id}">
          <label class="text-sm font-semibold text-primary">Fim de semana
            <input data-data-key="fim_de_semana" value="${escapeHtml(d.fim_de_semana || '')}" class="mt-1.5 w-full rounded-lg border-outline-variant text-sm py-2 px-3" placeholder="03 - 04 de Junho"/>
          </label>
          <label class="text-sm font-semibold text-primary">Grupo
            <select data-data-key="grupo" class="mt-1.5 w-full rounded-lg border-outline-variant text-sm py-2 px-3">
              <option value=""></option>
              ${Schemas.CLEANING_GROUPS.map((g) => `<option ${d.grupo === g ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
            </select>
          </label>
          <div class="sm:col-span-2 flex justify-between items-center pt-2">
            <button type="button" data-prev-entry ${idx === 0 ? 'disabled' : ''} class="text-xs font-semibold text-secondary disabled:opacity-40">← Anterior</button>
            <button type="button" data-remove-entry="${entry.id}" class="text-xs font-semibold text-error">Remover</button>
            <button type="button" data-next-entry ${idx >= list.length - 1 ? 'disabled' : ''} class="text-xs font-semibold text-secondary disabled:opacity-40">Próxima →</button>
          </div>
        </div>
      </div>`;

    bindEntryForm(container, 'limpeza_mensal', list, idx);
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
    blockSelection[block] = entriesFor(block).length - 1;
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
    blockSelection[block] = 0;
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
        readFormIntoEntries();
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach((b) => {
          b.classList.toggle('tab-active', b === btn);
          b.classList.toggle('text-on-surface-variant', b !== btn);
        });
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
        $('panel-' + tab)?.classList.remove('hidden');
        if (tab === 'published') loadPublishedList();
      });
    });
  }

  function openGcalExportModal() {
    if (!board) {
      showToast(toastEl, 'Carregue um quadro do mês antes de exportar.', true);
      return;
    }
    refreshCsvPreview();
    const modal = $('gcal-export-modal');
    modal?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeGcalExportModal() {
    $('gcal-export-modal')?.classList.add('hidden');
    document.body.style.overflow = '';
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
      blockSelection.limpeza_mensal = limpezaEntries().length - 1;
      renderLimpezaEditor();
    });

    $('btn-download-csv').addEventListener('click', () => {
      refreshCsvPreview();
      const label = board?.reference_label?.replace(/\s+/g, '-') || 'quadro';
      Export.downloadCsv($('csv-preview').value, `google-agenda-${label}.csv`);
      showToast(toastEl, 'CSV baixado — importe em calendar.google.com → Configurações → Importar.');
    });

    $('btn-open-gcal-export').addEventListener('click', openGcalExportModal);
    $('gcal-export-close').addEventListener('click', closeGcalExportModal);
    $('gcal-export-backdrop').addEventListener('click', closeGcalExportModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('gcal-export-modal')?.classList.contains('hidden')) closeGcalExportModal();
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
