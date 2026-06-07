(function () {
  const { guardPermission, getClient, showToast, escapeHtml } = window.JEAdmin;

  const MONTHS_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const WEEKDAY_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const CHAR_PILLS = ['Bíblia/Deus', 'Provações/Problemas', 'Religião/Adoração', 'Março/Agosto - SC', 'Orador Local'];

  let board = null;
  let entries = [];
  let client = null;
  let toastEl = null;
  let activeTab = 'receive';
  let selection = { receive: 0, send: 0 };
  let dirty = false;

  function $(id) { return document.getElementById(id); }

  function pad(n) { return String(n).padStart(2, '0'); }

  function trim(v) { return String(v ?? '').trim(); }

  function toISODate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function monthLabel(year, monthIndex) {
    return `${MONTHS_PT[monthIndex]} / ${year}`;
  }

  function formatDisplayDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T12:00:00');
    return `${pad(d.getDate())} de ${MONTHS_PT[d.getMonth()]}`;
  }

  function referenceMonthFromInput() {
    const val = $('board-month').value;
    return val ? `${val}-01` : null;
  }

  function getSaturdaysInMonth(referenceMonth) {
    const d = new Date(referenceMonth + 'T12:00:00');
    const out = [];
    const cursor = new Date(d.getFullYear(), d.getMonth(), 1);
    while (cursor.getMonth() === d.getMonth()) {
      if (cursor.getDay() === 6) out.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  function newId() {
    return crypto.randomUUID ? crypto.randomUUID() : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function entriesFor(direction) {
    return entries.filter((e) => e.direction === direction).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  function speechEntry(direction, partial) {
    return {
      id: newId(),
      board_id: board?.id || null,
      direction,
      entry_type: 'speech',
      event_date: null,
      event_date_end: null,
      speaker_name: '',
      outline_number: '',
      theme: '',
      characteristics: '',
      observation: '',
      note_text: '',
      sort_order: entriesFor(direction).length + 1,
      ...partial
    };
  }

  function entryFilled(entry) {
    if (!entry) return false;
    if (entry.entry_type === 'note') return !!trim(entry.note_text);
    if (entry.entry_type === 'convention') return !!(trim(entry.theme) || trim(entry.event_date));
    return ['speaker_name', 'outline_number', 'theme', 'characteristics', 'observation']
      .some((k) => trim(entry[k]));
  }

  function entryTitle(entry) {
    if (entry.entry_type === 'note') return trim(entry.note_text).slice(0, 36) || 'Nota informativa';
    if (entry.entry_type === 'convention') return trim(entry.theme) || 'Congresso';
    if (entry.entry_type === 'special_visit') return trim(entry.speaker_name) || 'Visita SC';
    return trim(entry.speaker_name) || 'Discurso';
  }

  function entryMeta(entry) {
    if (entry.entry_type === 'convention') return 'Congresso';
    if (entry.entry_type === 'special_visit') return 'Visita SC';
    if (entry.entry_type === 'note') return 'Nota';
    if (entry.event_date) {
      const d = new Date(entry.event_date + 'T12:00:00');
      return `${WEEKDAY_PT[d.getDay()]} · ${pad(d.getDate())}`;
    }
    return 'Sem data';
  }

  function typeBadge(entry) {
    const map = {
      speech: ['Discurso', 'speech'],
      convention: ['Congresso', 'convention'],
      special_visit: ['Visita SC', 'special'],
      note: ['Nota', 'note']
    };
    const [label, mod] = map[entry.entry_type] || map.speech;
    return `<span class="dp-type-badge dp-type-badge--${mod}">${label}</span>`;
  }

  function setDirty(value) {
    dirty = value;
    $('btn-save')?.classList.toggle('is-dirty', dirty);
  }

  function readActiveForm() {
    const card = document.querySelector('[data-entry-editor]');
    if (!card) return;
    const id = card.dataset.entryEditor;
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    card.querySelectorAll('[data-field]').forEach((input) => {
      entry[input.dataset.field] = input.value.trim() || null;
    });
  }

  function markDirty() { setDirty(true); }

  function selectEntry(direction, index) {
    readActiveForm();
    const list = entriesFor(direction);
    selection[direction] = Math.max(0, Math.min(index, list.length - 1));
    renderWorkspace();
  }

  function reindex(direction) {
    entriesFor(direction).forEach((e, i) => { e.sort_order = i + 1; });
  }

  function statsHtml(direction) {
    const list = entriesFor(direction);
    const speeches = list.filter((e) => e.entry_type === 'speech');
    const filled = speeches.filter(entryFilled).length;
    const pct = speeches.length ? Math.round((filled / speeches.length) * 100) : 0;
    const specials = list.filter((e) => e.entry_type !== 'speech').length;
    const label = direction === 'receive' ? 'Recebemos' : 'Enviamos';
    return `
      <span class="dp-stat dp-stat--progress" style="--dp-pct:${pct}%">
        <span class="material-symbols-outlined" style="font-size:16px">pie_chart</span>
        <strong>${filled}/${speeches.length || 0}</strong> discursos · ${label}
      </span>
      ${specials ? `<span class="dp-stat"><strong>${specials}</strong> evento${specials > 1 ? 's' : ''} especial${specials > 1 ? 'is' : ''}</span>` : ''}
      <span class="dp-stat"><strong>${list.length}</strong> linha${list.length !== 1 ? 's' : ''} no mês</span>`;
  }

  function renderStats() {
    $('dp-stats').innerHTML = statsHtml(activeTab);
  }

  function renderTimeline() {
    const list = entriesFor(activeTab);
    const host = $('dp-timeline');
    if (!list.length) {
      host.innerHTML = '';
      return;
    }
    host.innerHTML = list.map((entry, idx) => {
      const isActive = idx === selection[activeTab];
      const classes = [
        'dp-timeline-chip',
        isActive ? 'is-active' : '',
        entryFilled(entry) ? 'is-filled' : '',
        entry.entry_type !== 'speech' ? 'is-special' : ''
      ].filter(Boolean).join(' ');
      let day = '•';
      if (entry.entry_type === 'speech' && entry.event_date) {
        day = pad(new Date(entry.event_date + 'T12:00:00').getDate());
      } else if (entry.entry_type === 'convention') day = 'C';
      else if (entry.entry_type === 'special_visit') day = 'SC';
      else if (entry.entry_type === 'note') day = 'N';
      return `
        <button type="button" class="${classes}" data-timeline-index="${idx}" title="${escapeHtml(entryTitle(entry))}">
          <span class="dp-timeline-chip__day">${day}</span>
          <span class="dp-timeline-chip__meta">${escapeHtml(entryMeta(entry))}</span>
        </button>`;
    }).join('');

    host.querySelectorAll('[data-timeline-index]').forEach((btn) => {
      btn.addEventListener('click', () => selectEntry(activeTab, parseInt(btn.dataset.timelineIndex, 10)));
    });
  }

  function renderNav() {
    const list = entriesFor(activeTab);
    const host = $('dp-nav');
    if (!list.length) {
      host.innerHTML = '<p class="text-xs text-on-surface-variant">Nenhuma linha.</p>';
      return;
    }
    host.innerHTML = list.map((entry, idx) => {
      const isActive = idx === selection[activeTab];
      return `
        <button type="button" class="dp-nav-btn${isActive ? ' is-active' : ''}${entryFilled(entry) ? ' is-filled' : ''}" data-nav-index="${idx}">
          <span class="dp-nav-meta">${escapeHtml(entryMeta(entry))}</span>
          <span class="dp-nav-title">${escapeHtml(entryTitle(entry))}</span>
        </button>`;
    }).join('');

    host.querySelectorAll('[data-nav-index]').forEach((btn) => {
      btn.addEventListener('click', () => selectEntry(activeTab, parseInt(btn.dataset.navIndex, 10)));
    });
  }

  function fieldHtml(label, field, entry, extra) {
    const val = entry[field] || '';
    const filled = trim(val) ? ' is-filled' : '';
    const attrs = extra || '';
    return `
      <div class="dp-field${filled}${field === 'theme' || field === 'note_text' || field === 'observation' ? ' span-2' : ''}">
        <label>${escapeHtml(label)}</label>
        ${attrs.includes('textarea')
          ? `<textarea rows="3" data-field="${field}" placeholder="${escapeHtml(attrs.replace('textarea','').trim())}">${escapeHtml(val)}</textarea>`
          : `<input data-field="${field}" value="${escapeHtml(val)}" ${attrs}/>`}
      </div>`;
  }

  function charPillsHtml(entry) {
    const current = trim(entry.characteristics);
    return `
      <div class="dp-char-pills" data-char-pills>
        ${CHAR_PILLS.map((pill) =>
          `<button type="button" class="dp-char-pill${current === pill ? ' is-on' : ''}" data-char-pill="${escapeHtml(pill)}">${escapeHtml(pill)}</button>`
        ).join('')}
      </div>`;
  }

  function renderEditorForm(entry, idx, list) {
    let fields = '';
    if (entry.entry_type === 'note') {
      fields = `
        ${fieldHtml('Data (opcional)', 'event_date', entry, 'type="date"')}
        ${fieldHtml('Texto da nota', 'note_text', entry, 'textarea Ex.: Não enviaremos — arranjo de oradores locais')}
      `;
    } else if (entry.entry_type === 'convention') {
      fields = `
        ${fieldHtml('Início', 'event_date', entry, 'type="date"')}
        ${fieldHtml('Fim', 'event_date_end', entry, 'type="date"')}
        ${fieldHtml('Título do evento', 'theme', entry, 'placeholder="Congresso Regional"')}
        ${fieldHtml('Observação', 'observation', entry, 'placeholder="Detalhes adicionais"')}
      `;
    } else {
      fields = `
        ${fieldHtml('Data', 'event_date', entry, 'type="date"')}
        ${fieldHtml('Orador', 'speaker_name', entry, 'placeholder="Nome do orador"')}
        ${fieldHtml('Esboço', 'outline_number', entry, 'inputmode="numeric" placeholder="26"')}
        ${fieldHtml('Tema', 'theme', entry, 'placeholder="Título do discurso"')}
        <div class="dp-field span-2">
          <label>Características</label>
          <input data-field="characteristics" value="${escapeHtml(entry.characteristics || '')}" list="characteristics-list" placeholder="Categoria do esboço"/>
          ${charPillsHtml(entry)}
        </div>
        ${fieldHtml('Observação', 'observation', entry, 'placeholder="Congregação, telefone, etc."')}
      `;
    }

    return `
      <div class="dp-doc-panel" data-entry-editor="${entry.id}">
        <div class="dp-doc-banner">
          <div>
            ${typeBadge(entry)}
            <h3>${escapeHtml(entryTitle(entry))}</h3>
            <p class="dp-doc-banner-meta">${activeTab === 'receive' ? 'Recebemos' : 'Enviamos'} · ${escapeHtml(entryMeta(entry))}</p>
          </div>
        </div>
        <div class="dp-doc-body">
          <div class="dp-fields">${fields}</div>
        </div>
        <div class="dp-doc-footer">
          <div class="flex gap-2">
            <button type="button" class="dp-nav-arrow" data-prev-entry ${idx <= 0 ? 'disabled' : ''}>
              <span class="material-symbols-outlined" style="font-size:16px">chevron_left</span>Anterior
            </button>
            <button type="button" class="dp-nav-arrow" data-next-entry ${idx >= list.length - 1 ? 'disabled' : ''}>
              Próximo<span class="material-symbols-outlined" style="font-size:16px">chevron_right</span>
            </button>
          </div>
          <button type="button" class="dp-mini-btn" data-remove-entry style="color:#C00000;border-color:rgba(192,0,0,.25)">
            <span class="material-symbols-outlined" style="font-size:16px">delete</span>Remover
          </button>
        </div>
      </div>`;
  }

  function renderPreview(entry) {
    const host = $('dp-preview-body');
    if (!entry) {
      host.className = 'dp-preview-empty';
      host.textContent = 'Selecione uma entrada para ver o resumo.';
      return;
    }
    host.className = 'dp-preview-sheet';
    if (entry.entry_type === 'note') {
      host.innerHTML = `
        <div class="dp-preview-row"><dt>Nota</dt><dd>${escapeHtml(entry.note_text) || '—'}</dd></div>
        <div class="dp-preview-row"><dt>Data</dt><dd>${escapeHtml(formatDisplayDate(entry.event_date))}</dd></div>`;
      return;
    }
    if (entry.entry_type === 'convention') {
      const range = entry.event_date_end && entry.event_date !== entry.event_date_end
        ? `${formatDisplayDate(entry.event_date)} — ${formatDisplayDate(entry.event_date_end)}`
        : formatDisplayDate(entry.event_date);
      host.innerHTML = `
        <div class="dp-preview-row"><dt>Evento</dt><dd>${escapeHtml(entry.theme) || '—'}</dd></div>
        <div class="dp-preview-row"><dt>Período</dt><dd>${escapeHtml(range)}</dd></div>
        <div class="dp-preview-row"><dt>Obs.</dt><dd>${escapeHtml(entry.observation) || '—'}</dd></div>`;
      return;
    }
    host.innerHTML = `
      <div class="dp-preview-row"><dt>Data</dt><dd>${escapeHtml(formatDisplayDate(entry.event_date))}</dd></div>
      <div class="dp-preview-row"><dt>Orador</dt><dd>${escapeHtml(entry.speaker_name) || '—'}</dd></div>
      <div class="dp-preview-row"><dt>Esboço</dt><dd>${escapeHtml(entry.outline_number) || '—'}</dd></div>
      <div class="dp-preview-row"><dt>Tema</dt><dd>${escapeHtml(entry.theme) || '—'}</dd></div>
      <div class="dp-preview-row"><dt>Categ.</dt><dd>${escapeHtml(entry.characteristics) || '—'}</dd></div>
      <div class="dp-preview-row"><dt>Obs.</dt><dd>${escapeHtml(entry.observation) || '—'}</dd></div>`;
  }

  function bindEditorEvents(entry, idx, list) {
    const card = document.querySelector('[data-entry-editor]');
    if (!card) return;

    card.querySelectorAll('[data-field]').forEach((input) => {
      input.addEventListener('input', () => {
        markDirty();
        readActiveForm();
        renderStats();
        renderTimeline();
        renderNav();
        renderPreview(entries.find((e) => e.id === entry.id));
        input.closest('.dp-field')?.classList.toggle('is-filled', !!trim(input.value));
      });
    });

    card.querySelectorAll('[data-char-pill]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = card.querySelector('[data-field="characteristics"]');
        const value = btn.dataset.charPill;
        input.value = input.value === value ? '' : value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });

    card.querySelector('[data-prev-entry]')?.addEventListener('click', () => selectEntry(activeTab, idx - 1));
    card.querySelector('[data-next-entry]')?.addEventListener('click', () => selectEntry(activeTab, idx + 1));
    card.querySelector('[data-remove-entry]')?.addEventListener('click', async () => {
      if (!await window.JEDialog.confirm({
        title: 'Remover linha',
        message: 'Remover esta entrada do arranjo?',
        confirmLabel: 'Remover',
        danger: true
      })) return;
      readActiveForm();
      entries = entries.filter((e) => e.id !== entry.id);
      reindex(activeTab);
      selection[activeTab] = Math.min(selection[activeTab], entriesFor(activeTab).length - 1);
      markDirty();
      renderWorkspace();
    });
  }

  function renderEditor() {
    const list = entriesFor(activeTab);
    const host = $('dp-editor-host');
    if (!list.length) {
      host.innerHTML = `
        <div class="dp-empty-state">
          <span class="material-symbols-outlined text-secondary" style="font-size:2.5rem">event_busy</span>
          <p class="mt-3 font-bold text-primary">Nenhuma linha nesta aba</p>
          <p class="text-sm mt-1">Use <strong>Regenerar sábados</strong> ou adicione uma entrada.</p>
        </div>`;
      renderPreview(null);
      return;
    }
    const idx = selection[activeTab];
    const entry = list[idx];
    host.innerHTML = renderEditorForm(entry, idx, list);
    bindEditorEvents(entry, idx, list);
    renderPreview(entry);
  }

  function renderWorkspace() {
    renderStats();
    renderTimeline();
    renderNav();
    renderEditor();
  }

  function renderAll() {
    renderWorkspace();
  }

  function switchTab(tab) {
    readActiveForm();
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('tab-active', btn.dataset.tab === tab);
      btn.classList.toggle('text-on-surface-variant', btn.dataset.tab !== tab);
    });
    renderWorkspace();
  }

  async function regenerateSaturdays() {
    if (!board) return;
    if (!await window.JEDialog.confirm({
      title: 'Regenerar sábados',
      message: 'Substituir os discursos (sábados) desta aba? Congressos, visitas e notas serão mantidos.',
      confirmLabel: 'Regenerar'
    })) return;
    readActiveForm();
    const direction = activeTab;
    const kept = entries.filter((e) => e.direction !== direction || e.entry_type !== 'speech');
    const newSpeech = getSaturdaysInMonth(board.reference_month).map((date, i) =>
      speechEntry(direction, { event_date: toISODate(date), sort_order: i + 1 })
    );
    entries = [...kept, ...newSpeech];
    reindex(direction);
    selection[direction] = 0;
    markDirty();
    renderWorkspace();
    showToast(toastEl, 'Sábados regenerados.');
  }

  function addEntry(entryType) {
    readActiveForm();
    const direction = activeTab;
    const partial = { entry_type: entryType };
    if (entryType === 'convention') partial.theme = 'Congresso Regional';
    if (entryType === 'special_visit') partial.characteristics = 'Março/Agosto - SC';
    entries.push(speechEntry(direction, partial));
    reindex(direction);
    selection[direction] = entriesFor(direction).length - 1;
    markDirty();
    renderWorkspace();
  }

  async function loadBoard() {
    const ref = referenceMonthFromInput();
    if (!ref) {
      showToast(toastEl, 'Selecione um mês.', true);
      return;
    }

    const d = new Date(ref + 'T12:00:00');
    const label = monthLabel(d.getFullYear(), d.getMonth());

    let { data: existing } = await client.from('public_speech_boards').select('*').eq('reference_month', ref).maybeSingle();

    if (!existing) {
      const { data: created, error } = await client.from('public_speech_boards').insert({
        reference_month: ref,
        reference_label: label,
        status: 'draft'
      }).select('*').single();
      if (error) { showToast(toastEl, error.message, true); return; }
      existing = created;
    }

    board = existing;
    $('board-label').textContent = `${board.reference_label} (${board.status === 'draft' ? 'Rascunho' : board.status})`;
    $('editor-shell').classList.remove('hidden');

    const { data: rows, error: loadErr } = await client
      .from('public_speech_entries')
      .select('*')
      .eq('board_id', board.id)
      .order('sort_order');

    if (loadErr) { showToast(toastEl, loadErr.message, true); return; }

    entries = rows || [];
    if (!entries.length) {
      ['receive', 'send'].forEach((direction) => {
        getSaturdaysInMonth(ref).forEach((date, i) => {
          entries.push(speechEntry(direction, {
            board_id: board.id,
            event_date: toISODate(date),
            sort_order: i + 1
          }));
        });
      });
    }

    selection = { receive: 0, send: 0 };
    setDirty(false);
    renderAll();
    showToast(toastEl, 'Arranjo carregado.');
  }

  async function saveBoard() {
    if (!board) return;
    readActiveForm();

    const { error: delErr } = await client.from('public_speech_entries').delete().eq('board_id', board.id);
    if (delErr) { showToast(toastEl, delErr.message, true); return; }

    const payload = entries.map((e, i) => ({
      board_id: board.id,
      direction: e.direction,
      entry_type: e.entry_type || 'speech',
      event_date: e.event_date || null,
      event_date_end: e.event_date_end || null,
      speaker_name: e.speaker_name || null,
      outline_number: e.outline_number || null,
      theme: e.theme || null,
      characteristics: e.characteristics || null,
      observation: e.observation || null,
      note_text: e.note_text || null,
      sort_order: e.sort_order ?? i + 1
    }));

    const { data: inserted, error: insErr } = await client.from('public_speech_entries').insert(payload).select('*');
    if (insErr) { showToast(toastEl, insErr.message, true); return; }

    entries = inserted || [];
    await client.from('public_speech_boards').update({ updated_at: new Date().toISOString() }).eq('id', board.id);

    setDirty(false);
    renderAll();
    showToast(toastEl, 'Arranjo salvo. Orador e tema aparecem no Quadro — Final de Semana.');
  }

  async function init() {
    if (window.__JEAdminDiscursosInit) return;
    window.__JEAdminDiscursosInit = true;
    const profile = await guardPermission('public_speeches');
    if (!profile) return;

    client = await getClient();
    toastEl = document.getElementById('hub-admin-toast') || $('admin-toast');
    $('board-month').value = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`;

    $('btn-load-board').addEventListener('click', loadBoard);
    $('btn-save').addEventListener('click', saveBoard);
    $('btn-regen-saturdays').addEventListener('click', regenerateSaturdays);
    $('btn-add-speech').addEventListener('click', () => addEntry('speech'));
    $('btn-add-convention').addEventListener('click', () => addEntry('convention'));
    $('btn-add-special').addEventListener('click', () => addEntry('special_visit'));
    $('btn-add-note').addEventListener('click', () => addEntry('note'));

    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.addEventListener('keydown', (e) => {
      if (!board || !document.querySelector('[data-entry-editor]')) return;
      if (e.target.matches('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') selectEntry(activeTab, selection[activeTab] - 1);
      if (e.key === 'ArrowRight') selectEntry(activeTab, selection[activeTab] + 1);
    });
  }

  window.JEAdminDiscursos = { init };

  if (!window.JEHubRouter && document.getElementById('board-month')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})();
