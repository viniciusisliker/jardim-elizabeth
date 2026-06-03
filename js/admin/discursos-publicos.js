(function () {
  const { guardPermission, getClient, showToast, escapeHtml } = window.JEAdmin;

  const MONTHS_PT = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  let board = null;
  let entries = [];
  let client = null;
  let toastEl = null;
  let activeTab = 'receive';

  function $(id) { return document.getElementById(id); }

  function pad(n) { return String(n).padStart(2, '0'); }

  function toISODate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function monthLabel(year, monthIndex) {
    return `${MONTHS_PT[monthIndex]} / ${year}`;
  }

  function referenceMonthFromInput() {
    const val = $('board-month').value;
    if (!val) return null;
    return `${val}-01`;
  }

  function getSaturdaysInMonth(referenceMonth) {
    const d = new Date(referenceMonth + 'T12:00:00');
    const year = d.getFullYear();
    const month = d.getMonth();
    const out = [];
    const cursor = new Date(year, month, 1);
    while (cursor.getMonth() === month) {
      if (cursor.getDay() === 6) {
        out.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  function newId() {
    return crypto.randomUUID ? crypto.randomUUID() : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function entriesFor(direction) {
    return entries
      .filter((e) => e.direction === direction)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
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

  function readFormIntoEntries() {
    document.querySelectorAll('[data-entry-id]').forEach((row) => {
      const id = row.dataset.entryId;
      const entry = entries.find((e) => e.id === id);
      if (!entry) return;
      row.querySelectorAll('[data-field]').forEach((input) => {
        entry[input.dataset.field] = input.value.trim() || null;
      });
    });
  }

  function rowClass(entry) {
    if (entry.entry_type === 'convention') return 'row-convention';
    if (entry.entry_type === 'special_visit') return 'row-special';
    if (entry.entry_type === 'note') return 'row-note';
    return '';
  }

  function typeBadge(entry) {
    if (entry.entry_type === 'convention') return '<span class="dp-type-badge dp-type-badge--convention">Congresso</span>';
    if (entry.entry_type === 'special_visit') return '<span class="dp-type-badge dp-type-badge--special">Visita SC</span>';
    if (entry.entry_type === 'note') return '<span class="dp-type-badge dp-type-badge--note">Nota</span>';
    return '';
  }

  function renderRow(entry) {
    const isNote = entry.entry_type === 'note';
    const isConvention = entry.entry_type === 'convention';

    if (isNote) {
      return `
        <tr class="${rowClass(entry)}" data-entry-id="${entry.id}">
          <td><input type="date" data-field="event_date" value="${escapeHtml(entry.event_date || '')}"/></td>
          <td colspan="5">
            ${typeBadge(entry)}
            <textarea rows="2" data-field="note_text" placeholder="Ex.: Não enviaremos — arranjo de oradores locais">${escapeHtml(entry.note_text || '')}</textarea>
          </td>
          <td><div class="dp-row-actions"><button type="button" class="dp-row-btn" data-remove="${entry.id}">Remover</button></div></td>
        </tr>`;
    }

    if (isConvention) {
      return `
        <tr class="${rowClass(entry)}" data-entry-id="${entry.id}">
          <td>
            ${typeBadge(entry)}
            <input type="date" data-field="event_date" value="${escapeHtml(entry.event_date || '')}" title="Início"/>
            <input type="date" data-field="event_date_end" value="${escapeHtml(entry.event_date_end || '')}" title="Fim" class="mt-1"/>
          </td>
          <td colspan="4">
            <input data-field="theme" value="${escapeHtml(entry.theme || '')}" placeholder="Ex.: Congresso Regional"/>
          </td>
          <td><input data-field="observation" value="${escapeHtml(entry.observation || '')}" placeholder="Observação"/></td>
          <td><div class="dp-row-actions"><button type="button" class="dp-row-btn" data-remove="${entry.id}">Remover</button></div></td>
        </tr>`;
    }

    return `
      <tr class="${rowClass(entry)}" data-entry-id="${entry.id}">
        <td>
          ${typeBadge(entry)}
          <input type="date" data-field="event_date" value="${escapeHtml(entry.event_date || '')}"/>
        </td>
        <td><input data-field="speaker_name" value="${escapeHtml(entry.speaker_name || '')}" placeholder="Nome do orador"/></td>
        <td><input data-field="outline_number" value="${escapeHtml(entry.outline_number || '')}" inputmode="numeric"/></td>
        <td><input data-field="theme" value="${escapeHtml(entry.theme || '')}" placeholder="Tema do discurso"/></td>
        <td><input data-field="characteristics" value="${escapeHtml(entry.characteristics || '')}" list="characteristics-list"/></td>
        <td><input data-field="observation" value="${escapeHtml(entry.observation || '')}" placeholder="Cong., telefone, etc."/></td>
        <td><div class="dp-row-actions"><button type="button" class="dp-row-btn" data-remove="${entry.id}">Remover</button></div></td>
      </tr>`;
  }

  function renderTable(direction) {
    const tbody = $(direction === 'receive' ? 'tbody-receive' : 'tbody-send');
    const list = entriesFor(direction);
    tbody.innerHTML = list.length
      ? list.map(renderRow).join('')
      : '<tr><td colspan="7" class="text-center text-on-surface-variant py-6">Nenhuma linha — use Regenerar sábados ou + Discurso.</td></tr>';

    tbody.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!confirm('Remover esta linha?')) return;
        readFormIntoEntries();
        entries = entries.filter((e) => e.id !== btn.dataset.remove);
        reindex(direction);
        renderTable(direction);
      });
    });
  }

  function reindex(direction) {
    entriesFor(direction).forEach((e, i) => { e.sort_order = i + 1; });
  }

  function renderAll() {
    renderTable('receive');
    renderTable('send');
  }

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('tab-active', btn.dataset.tab === tab);
      btn.classList.toggle('text-on-surface-variant', btn.dataset.tab !== tab);
    });
    $('panel-receive').classList.toggle('hidden', tab !== 'receive');
    $('panel-send').classList.toggle('hidden', tab !== 'send');
  }

  function regenerateSaturdays() {
    if (!board) return;
    if (!confirm('Substituir os discursos (sábados) desta aba? Congressos, visitas e notas serão mantidos.')) return;
    readFormIntoEntries();
    const direction = activeTab;
    const kept = entries.filter((e) =>
      e.direction !== direction || e.entry_type !== 'speech'
    );
    const saturdays = getSaturdaysInMonth(board.reference_month);
    const newSpeech = saturdays.map((date, i) =>
      speechEntry(direction, {
        event_date: toISODate(date),
        sort_order: i + 1
      })
    );
    entries = [...kept, ...newSpeech];
    reindex(direction);
    renderTable(direction);
    showToast(toastEl, 'Sábados regenerados nesta aba.');
  }

  function addEntry(entryType) {
    readFormIntoEntries();
    const direction = activeTab;
    const partial = { entry_type: entryType };
    if (entryType === 'convention') {
      partial.theme = 'Congresso Regional';
    }
    if (entryType === 'special_visit') {
      partial.characteristics = 'Março/Agosto - SC';
    }
    entries.push(speechEntry(direction, partial));
    reindex(direction);
    renderTable(direction);
  }

  async function loadBoard() {
    const ref = referenceMonthFromInput();
    if (!ref) {
      showToast(toastEl, 'Selecione um mês.', true);
      return;
    }

    const d = new Date(ref + 'T12:00:00');
    const label = monthLabel(d.getFullYear(), d.getMonth());

    let { data: existing } = await client
      .from('public_speech_boards')
      .select('*')
      .eq('reference_month', ref)
      .maybeSingle();

    if (!existing) {
      const { data: created, error } = await client
        .from('public_speech_boards')
        .insert({
          reference_month: ref,
          reference_label: label,
          status: 'draft'
        })
        .select('*')
        .single();
      if (error) {
        showToast(toastEl, error.message, true);
        return;
      }
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

    if (loadErr) {
      showToast(toastEl, loadErr.message, true);
      return;
    }

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

    renderAll();
    showToast(toastEl, 'Arranjo carregado.');
  }

  async function saveBoard() {
    if (!board) return;
    readFormIntoEntries();

    const { error: delErr } = await client
      .from('public_speech_entries')
      .delete()
      .eq('board_id', board.id);

    if (delErr) {
      showToast(toastEl, delErr.message, true);
      return;
    }

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

    const { data: inserted, error: insErr } = await client
      .from('public_speech_entries')
      .insert(payload)
      .select('*');

    if (insErr) {
      showToast(toastEl, insErr.message, true);
      return;
    }

    entries = inserted || [];
    await client
      .from('public_speech_boards')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', board.id);

    renderAll();
    showToast(toastEl, 'Arranjo salvo com sucesso.');
  }

  async function init() {
    const profile = await guardPermission('public_speeches');
    if (!profile) return;

    client = await getClient();
    toastEl = $('admin-toast');

    const now = new Date();
    $('board-month').value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
