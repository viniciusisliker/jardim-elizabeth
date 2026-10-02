(function () {
  const { guardAnnouncements, getClient, showToast, escapeHtml, adminToastEl } = window.JEAdmin;
  const Dates = window.JEAnnouncementDates;
  const Schemas = window.JEAnnouncementSchemas;
  const Export = window.JEAnnouncementExport;

  function pdfApi() {
    const api = window.JEAnnouncementPdf;
    if (!api?.blockToPdfBlob || !api?.boardToPdfBlob) {
      throw new Error('Não foi possível gerar o PDF. Recarregue a página (Ctrl+F5) e tente de novo.');
    }
    return api;
  }

  function friendlyError(err, fallback) {
    console.error(err);
    const msg = String(err?.message || err || '');
    if (/PGRST|column |relation |row-level|duplicate key|permission denied|postgres|supabase|violates/i.test(msg)) {
      return fallback;
    }
    if (/Não foi possível|Recarregue a página|Ctrl\+F5|Selecione |Carregue /i.test(msg)) return msg;
    return fallback;
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
  // Mecânicas dos quadros do mês anterior e do seguinte: a regra de folga/repetição
  // olha semanas vizinhas, que na virada do mês estão em outro quadro.
  let neighborMecanicas = [];
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

  // Recarregar a página não pode perder o que está sendo editado: guardamos
  // qual quadro estava aberto e um backup local das alterações ainda não salvas.
  const LAST_BOARD_KEY = 'je.anuncios.lastBoardId';
  const UNSAVED_PREFIX = 'je.anuncios.unsaved.';
  let dirty = false;
  let backupTimer = null;

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch { /* storage cheio ou bloqueado */ }
  }
  function storageRemove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }

  function rememberBoard(boardId) {
    if (boardId) storageSet(LAST_BOARD_KEY, boardId);
    else storageRemove(LAST_BOARD_KEY);
  }

  function writeUnsavedBackup() {
    clearTimeout(backupTimer);
    backupTimer = null;
    if (!board?.id || !dirty) return;
    readFormIntoEntries();
    storageSet(UNSAVED_PREFIX + board.id, JSON.stringify({
      entries,
      baseUpdatedAt: board.updated_at || null,
      savedAt: new Date().toISOString()
    }));
  }

  function markDirty() {
    if (!board?.id) return;
    dirty = true;
    clearTimeout(backupTimer);
    backupTimer = setTimeout(writeUnsavedBackup, 400);
  }

  function clearUnsavedBackup(boardId) {
    clearTimeout(backupTimer);
    backupTimer = null;
    dirty = false;
    if (boardId) storageRemove(UNSAVED_PREFIX + boardId);
  }

  function readUnsavedBackup(boardId) {
    const raw = storageGet(UNSAVED_PREFIX + boardId);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.entries) ? parsed : null;
    } catch {
      return null;
    }
  }

  async function restoreUnsavedBackup(backup, dbUpdatedAt) {
    if (!backup) return false;
    const changedElsewhere = backup.baseUpdatedAt && dbUpdatedAt && backup.baseUpdatedAt !== dbUpdatedAt;
    if (changedElsewhere) {
      const when = new Date(backup.savedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      const keep = await window.JEDialog.confirm({
        title: 'Alterações não salvas',
        message: `Há alterações deste quadro não salvas neste navegador (${when}), mas o quadro foi salvo depois disso. Restaurar suas alterações locais? Se escolher não, elas serão descartadas.`,
        confirmLabel: 'Restaurar'
      });
      if (!keep) {
        clearUnsavedBackup(board.id);
        return false;
      }
    }
    entries = backup.entries.map((e) => ({ ...e, data: e.data || {}, board_id: board.id }));
    dirty = true;
    return true;
  }

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
    return Object.entries(data).some(([k, v]) => !k.startsWith('_') && String(v || '').trim());
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

  function shiftMonth(referenceMonth, delta) {
    const [y, m] = referenceMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1, 12);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }

  async function loadNeighborMecanicas() {
    neighborMecanicas = [];
    if (!board?.reference_month || !client) return;
    const months = [shiftMonth(board.reference_month, -1), shiftMonth(board.reference_month, 1)];
    try {
      const { data: boards, error } = await client
        .from('announcement_boards')
        .select('id, reference_month')
        .in('reference_month', months)
        .neq('status', 'archived')
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Um quadro por mês, o mais recente (mesmo critério de abrir o quadro).
      const ids = months.map((m) => (boards || []).find((b) => b.reference_month === m)?.id).filter(Boolean);
      if (!ids.length) return;
      const { data: rows, error: rowsErr } = await client
        .from('announcement_entries')
        .select('event_date, data')
        .in('board_id', ids)
        .eq('block', 'mecanicas');
      if (rowsErr) throw rowsErr;
      neighborMecanicas = (rows || []).map((r) => ({ block: 'mecanicas', event_date: r.event_date, data: r.data || {} }));
    } catch (err) {
      console.warn('Não foi possível carregar as mecânicas dos meses vizinhos', err);
    }
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
        if (entry.block === 'weekend') {
          Sync.setWeekendFieldValue(entry.data, input.dataset.dataKey, input.value, receiveSpeechesByDate[entry.event_date]);
          return;
        }
        entry.data[input.dataset.dataKey] = input.value;
      });
    });
  }

  // Opções dos campos com rodízio vêm da lista da aba Rodízio. Para os grupos de
  // limpeza, a lista fixa só vale enquanto o rodízio não carregou. Valor já salvo
  // fora da lista continua aparecendo.
  function rotationOptions(slug, current, fallback) {
    const fromRotation = window.JEAnnouncementRotation?.getItems(slug);
    const items = fromRotation && fromRotation.length ? fromRotation : (fallback || []);
    return current && !items.includes(current) ? [current, ...items] : items;
  }

  // Partes do meio e do fim de semana que contam como "já tem designação no dia".
  // O editor das mecânicas cruza os nomes do rodízio com essas partes na mesma data.
  const MIDWEEK_PARTS = [
    ['presidente', 'Presidente'],
    ['tesouros_designado', 'Tesouros'],
    ['joias_designado', 'Joias espirituais'],
    ['leitura_biblia', 'Leitura da Bíblia'],
    ['dirigente_sala_b', 'Dirigente Sala B'],
    ['leitura_biblia_sala_b', 'Leitura da Bíblia (Sala B)'],
    ...[1, 2, 3, 4].flatMap((n) => [
      [`ministerio_${n}_designados`, `Ministério ${n}`, `ministerio_${n}_tipo`],
      [`ministerio_${n}_sala_b`, `Ministério ${n} (Sala B)`, `ministerio_${n}_tipo`]
    ]),
    ['vida_crista_designado', 'Nossa vida cristã', 'vida_crista_titulo'],
    ['estudo_dirigente', 'Dirigente do estudo bíblico'],
    ['leitor_sentinela', 'Leitor do estudo bíblico'],
    ['oracao_final', 'Oração final']
  ];
  const WEEKEND_PARTS = [
    ['dirigente_sabado', 'Dirigente de campo'],
    ['presidente', 'Presidente'],
    ['orador', 'Discurso público'],
    ['leitor_sentinela', 'Leitor de A Sentinela'],
    ['oracao_final', 'Oração final'],
    ['oradores_enviados', 'Discurso em outra congregação']
  ];
  // Nas próprias mecânicas, o mesmo irmão em dois campos do dia também é conflito.
  // Grupo de limpeza não entra: não é nome de irmão.
  const MECANICAS_PARTS = Schemas.fieldsForBlock('mecanicas')
    .filter((f) => f.rotation !== 'grupos')
    .map((f) => [f.key, f.label]);
  const ASSIGNMENT_SOURCES = [
    { block: 'mecanicas', quadro: 'Mecânicas', parts: MECANICAS_PARTS },
    { block: 'midweek', quadro: 'Meio de semana', parts: MIDWEEK_PARTS },
    { block: 'weekend', quadro: 'Fim de semana', parts: WEEKEND_PARTS }
  ];

  function normName(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // Nome inteiro como palavra: "Paulo" não casa com "Paulão", mas casa em "Paulo / Pedro".
  function mentionsName(text, name) {
    const n = normName(name);
    if (!n) return false;
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(normName(text));
  }

  function assignmentsOnDate(dateIso) {
    if (!dateIso) return [];
    const out = [];
    ASSIGNMENT_SOURCES.forEach(({ block, quadro, parts }) => {
      entries.filter((e) => e.block === block && e.event_date === dateIso).forEach((e) => {
        const data = block === 'weekend'
          ? Sync.mergeWeekendDisplayData(e.data, receiveSpeechesByDate[dateIso]).data
          : (e.data || {});
        parts.forEach(([key, label, detailKey]) => {
          const text = trim(data[key]);
          if (!text) return;
          const detail = detailKey ? trim(data[detailKey]) : '';
          out.push({ block, key, quadro, parte: detail ? `${label} — ${detail}` : label, text });
        });
      });
    });
    return out;
  }

  // Regras do rodízio das mecânicas entre semanas (semana = segunda a domingo;
  // quarta e fim de semana contam como uma semana só):
  // - no máximo 2 semanas seguidas; a 3ª sem folga é conflito;
  // - a mesma tarefa em semanas seguidas é conflito. Volante 1 e 2 são a mesma tarefa;
  //   Portão e Auditório não.
  const MAX_WEEKS_IN_A_ROW = 2;
  const TASK_ALIAS = { microf_volantes_2: 'microf_volantes_1' };
  const TASK_LABEL = { microf_volantes_1: 'Microf. volante' };
  const taskOf = (key) => TASK_ALIAS[key] || key;
  const taskLabel = (task) => TASK_LABEL[task] || (MECANICAS_PARTS.find(([k]) => k === task) || [])[1] || task;

  function weekOf(dateIso) {
    const d = new Date(dateIso + 'T12:00:00');
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return Dates.toISODate(d);
  }

  function shiftWeek(weekIso, n) {
    const d = new Date(weekIso + 'T12:00:00');
    d.setDate(d.getDate() + 7 * n);
    return Dates.toISODate(d);
  }

  // Semana -> tarefas que o irmão fez nas mecânicas, ignorando o próprio campo em edição.
  function mecanicasWeeksOf(name, dateIso, ownKey) {
    const weeks = new Map();
    [...entries.filter((e) => e.block === 'mecanicas'), ...neighborMecanicas].forEach((e) => {
      if (!e.event_date) return;
      MECANICAS_PARTS.forEach(([key]) => {
        if (e.event_date === dateIso && key === ownKey) return;
        if (!mentionsName((e.data || {})[key], name)) return;
        const week = weekOf(e.event_date);
        if (!weeks.has(week)) weeks.set(week, new Set());
        weeks.get(week).add(taskOf(key));
      });
    });
    return weeks;
  }

  function weeklyRotationIssues(name, dateIso, ownKey) {
    if (!dateIso || !MECANICAS_PARTS.some(([k]) => k === ownKey)) return [];
    const weeks = mecanicasWeeksOf(name, dateIso, ownKey);
    const week = weekOf(dateIso);
    const task = taskOf(ownKey);
    const out = [];
    const issue = (parte) => out.push({ block: 'rodizio', quadro: 'Rodízio', parte, conflict: true });

    if (weeks.get(shiftWeek(week, -1))?.has(task)) issue(`${taskLabel(task)} na semana anterior`);
    if (weeks.get(shiftWeek(week, 1))?.has(task)) issue(`${taskLabel(task)} na semana seguinte`);

    let before = 0;
    while (before <= MAX_WEEKS_IN_A_ROW && weeks.has(shiftWeek(week, -(before + 1)))) before++;
    let after = 0;
    while (after <= MAX_WEEKS_IN_A_ROW && weeks.has(shiftWeek(week, after + 1))) after++;
    const inARow = before + 1 + after;
    if (inARow > MAX_WEEKS_IN_A_ROW) issue(`sem folga (${inARow} semanas seguidas)`);
    return out;
  }

  // `ownKey`: campo das mecânicas que está sendo preenchido (não conta como conflito consigo mesmo).
  function assignmentsFor(name, dateIso, ownKey) {
    if (!trim(name)) return [];
    return assignmentsOnDate(dateIso)
      .filter((a) => !(a.block === 'mecanicas' && a.key === ownKey))
      .filter((a) => mentionsName(a.text, name))
      .map(({ block, quadro, parte }) => ({ block, quadro, parte, conflict: block === 'mecanicas' }))
      .concat(weeklyRotationIssues(name, dateIso, ownKey));
  }

  function assignmentTagsHtml(name, dateIso, ownKey) {
    return assignmentsFor(name, dateIso, ownKey).map((a) => `
      <span class="qa-assign-tag${a.conflict ? ' qa-assign-tag--conflict' : ''}" title="${escapeHtml(a.quadro)}: ${escapeHtml(a.parte)}">
        <span class="material-symbols-outlined" aria-hidden="true">event_busy</span>
        <span><strong>${escapeHtml(a.quadro)}:</strong> ${escapeHtml(a.parte)}</span>
      </span>`).join('');
  }

  function assignmentOptionLabel(name, dateIso, ownKey) {
    const list = assignmentsFor(name, dateIso, ownKey);
    if (!list.length) return name;
    return `${name}  •  ${list.map((a) => `${a.quadro}: ${a.parte}`).join(' | ')}`;
  }

  // Usado também pelo pop-up do rodízio (anuncios-rodizio.js).
  window.JEAnnouncementAssignments = { assignmentsFor };

  // Seletor de irmão com designações: o <select> nativo não quebra linha e corta o
  // texto das designações. O select continua no DOM (é ele que o formulário lê) e
  // por cima entra um botão que abre uma lista com o nome e as designações em etiquetas.
  let openPicker = null;

  function closePersonPicker(focusTrigger) {
    if (!openPicker) return;
    const { panel, trigger, wrap, onViewport, onOutside } = openPicker;
    openPicker = null;
    panel.remove();
    wrap.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    window.removeEventListener('scroll', onViewport, true);
    window.removeEventListener('resize', onViewport);
    document.removeEventListener('mousedown', onOutside, true);
    if (focusTrigger) trigger.focus();
  }

  function positionPersonPicker() {
    if (!openPicker) return;
    const { panel, trigger } = openPicker;
    const r = trigger.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, 360), vw - 16);
    const left = Math.max(8, Math.min(r.left, vw - width - 8));
    const below = vh - r.bottom - 8;
    const above = r.top - 8;
    const openUp = below < 260 && above > below;
    panel.style.width = `${width}px`;
    panel.style.left = `${left}px`;
    panel.style.maxHeight = `${Math.min(420, Math.max(160, (openUp ? above : below) - 4))}px`;
    panel.style.top = openUp ? '' : `${r.bottom + 4}px`;
    panel.style.bottom = openUp ? `${vh - r.top + 4}px` : '';
  }

  function personPickerLabel(select) {
    return select.value || 'Escolher…';
  }

  function openPersonPicker(wrap) {
    closePersonPicker();
    const select = wrap.querySelector('select');
    const trigger = wrap.querySelector('.qa-picker__trigger');
    const tagsEl = wrap.parentElement.querySelector('[data-assign-tags]');
    const { assignTags: date, assignKey: key } = tagsEl?.dataset || {};
    readFormIntoEntries();

    const items = [...select.options].filter((o) => o.value).map((o) => {
      const list = date ? assignmentsFor(o.value, date, key) : [];
      return { value: o.value, list, conflict: list.some((a) => a.conflict) };
    });
    const optionHtml = (it) => `
      <li role="option" class="qa-picker__opt${it.list.length ? ' is-busy' : ''}${it.conflict ? ' is-conflict' : ''}${it.value === select.value ? ' is-selected' : ''}" data-value="${escapeHtml(it.value)}" aria-selected="${it.value === select.value}">
        <span class="qa-picker__name">${escapeHtml(it.value)}${it.value === select.value ? '<span class="material-symbols-outlined" aria-hidden="true">check</span>' : ''}</span>
        ${it.list.length ? `<span class="qa-assign-tags">${it.list.map((a) => `
          <span class="qa-assign-tag${a.conflict ? ' qa-assign-tag--conflict' : ''}">
            <span class="material-symbols-outlined" aria-hidden="true">event_busy</span>
            <span><strong>${escapeHtml(a.quadro)}:</strong> ${escapeHtml(a.parte)}</span>
          </span>`).join('')}</span>` : ''}
      </li>`;
    const free = items.filter((it) => !it.list.length);
    const busy = items.filter((it) => it.list.length);
    const heading = (label, n) => `<li class="qa-picker__heading" role="presentation">${label} <span>${n}</span></li>`;

    const panel = document.createElement('div');
    panel.className = 'qa-picker-panel';
    panel.innerHTML = `
      <div class="qa-picker-panel__search">
        <span class="material-symbols-outlined" aria-hidden="true">search</span>
        <input type="text" placeholder="Buscar nome…" aria-label="Buscar nome" autocomplete="off"/>
      </div>
      <ul class="qa-picker-panel__list" role="listbox">
        ${select.value ? '<li role="option" class="qa-picker__opt qa-picker__opt--clear" data-value=""><span class="qa-picker__name"><span class="material-symbols-outlined" aria-hidden="true">close</span>Deixar em branco</span></li>' : ''}
        ${free.length ? heading('Disponíveis', free.length) + free.map(optionHtml).join('') : ''}
        ${busy.length ? heading('Já designados', busy.length) + busy.map(optionHtml).join('') : ''}
        <li class="qa-picker__empty" role="presentation" hidden>Nenhum nome encontrado</li>
      </ul>`;
    document.body.appendChild(panel);

    const search = panel.querySelector('input');
    const listEl = panel.querySelector('ul');
    const visibleOpts = () => [...listEl.querySelectorAll('.qa-picker__opt:not([hidden])')];
    let active = null;
    const setActive = (el) => {
      active?.classList.remove('is-active');
      active = el || null;
      if (active) { active.classList.add('is-active'); active.scrollIntoView({ block: 'nearest' }); }
    };
    const choose = (value) => {
      if (select.value !== value) {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      trigger.querySelector('.qa-picker__value').textContent = personPickerLabel(select);
      wrap.classList.toggle('is-empty', !select.value);
      closePersonPicker(true);
    };

    search.addEventListener('input', () => {
      const q = normName(search.value);
      listEl.querySelectorAll('.qa-picker__opt').forEach((li) => {
        li.hidden = !!q && (!li.dataset.value || !normName(li.dataset.value).includes(q));
      });
      listEl.querySelectorAll('.qa-picker__heading').forEach((h) => {
        let n = 0;
        for (let el = h.nextElementSibling; el && el.classList.contains('qa-picker__opt'); el = el.nextElementSibling) if (!el.hidden) n++;
        h.hidden = !n;
        h.querySelector('span').textContent = n;
      });
      listEl.querySelector('.qa-picker__empty').hidden = visibleOpts().length > 0;
      setActive(visibleOpts().find((li) => li.dataset.value));
    });
    search.addEventListener('keydown', (e) => {
      const opts = visibleOpts();
      const i = opts.indexOf(active);
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(opts[Math.min(opts.length - 1, i + 1)]); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(opts[Math.max(0, i - 1)]); }
      else if (e.key === 'Enter') { e.preventDefault(); if (active) choose(active.dataset.value); }
      else if (e.key === 'Escape') { e.preventDefault(); closePersonPicker(true); }
      else if (e.key === 'Tab') closePersonPicker();
    });
    listEl.addEventListener('mousemove', (e) => {
      const li = e.target.closest('.qa-picker__opt');
      if (li && li !== active) setActive(li);
    });
    listEl.addEventListener('click', (e) => {
      const li = e.target.closest('.qa-picker__opt');
      if (li) choose(li.dataset.value);
    });

    const onViewport = (e) => {
      if (e.type === 'scroll' && panel.contains(e.target)) return;
      positionPersonPicker();
    };
    const onOutside = (e) => {
      if (!panel.contains(e.target) && !wrap.contains(e.target)) closePersonPicker();
    };
    openPicker = { panel, trigger, wrap, onViewport, onOutside };
    window.addEventListener('scroll', onViewport, true);
    window.addEventListener('resize', onViewport);
    document.addEventListener('mousedown', onOutside, true);
    wrap.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    positionPersonPicker();
    setActive(listEl.querySelector('.qa-picker__opt.is-selected') || visibleOpts().find((li) => li.dataset.value));
    search.focus({ preventScroll: true });
  }

  function enhancePersonPickers(container) {
    container.querySelectorAll('[data-person-picker]').forEach((wrap) => {
      if (wrap.classList.contains('is-enhanced')) return;
      const select = wrap.querySelector('select');
      if (!select) return;
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'qa-picker__trigger';
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');
      const label = wrap.closest('.qa-cell')?.querySelector('label')?.textContent;
      if (label) trigger.setAttribute('aria-label', label);
      trigger.innerHTML = `<span class="qa-picker__value"></span><span class="material-symbols-outlined" aria-hidden="true">expand_more</span>`;
      trigger.querySelector('.qa-picker__value').textContent = personPickerLabel(select);
      select.tabIndex = -1;
      select.setAttribute('aria-hidden', 'true');
      wrap.classList.toggle('is-empty', !select.value);
      wrap.appendChild(trigger);
      wrap.classList.add('is-enhanced');
      trigger.addEventListener('click', () => {
        if (openPicker?.wrap === wrap) closePersonPicker();
        else openPersonPicker(wrap);
      });
      trigger.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openPersonPicker(wrap); }
      });
    });
  }

  function fieldCell(field, entry) {
    const val = (entry.data && entry.data[field.key]) || '';
    const personField = field.rotation && field.rotation !== 'grupos';
    const date = personField ? entry.event_date : null;
    const rotationBtn = field.rotation ? rotationButton(field.rotation, field.label, date, personField ? field.key : null) : '';
    const head = `<div class="qa-cell-head"><label>${escapeHtml(field.label)}</label>${rotationBtn}</div>`;
    const choices = field.type === 'select'
      ? (field.rotation ? rotationOptions(field.rotation, val, field.options) : (field.options || Schemas.CLEANING_GROUPS))
      : [];
    const tags = date ? `<div class="qa-assign-tags" data-assign-tags="${escapeHtml(date)}" data-assign-key="${escapeHtml(field.key)}">${assignmentTagsHtml(val, date, field.key)}</div>` : '';
    // Lista de rodízio vazia (ou ainda carregando): cai no campo de texto pra não travar o preenchimento.
    if (choices.length) {
      // Quem já tem designação no dia aparece em cinza claro na lista.
      const opts = choices.map((o) => {
        const busy = date && assignmentsFor(o, date, field.key).length ? ' class="qa-option-busy"' : '';
        return `<option value="${escapeHtml(o)}"${busy} ${val === o ? 'selected' : ''}>${escapeHtml(date ? assignmentOptionLabel(o, date, field.key) : o)}</option>`;
      }).join('');
      const select = `<select data-data-key="${field.key}"><option value=""></option>${opts}</select>`;
      return `<div class="qa-cell">${head}
        ${date ? `<div class="qa-picker" data-person-picker>${select}</div>` : select}${tags}</div>`;
    }
    return `<div class="qa-cell">${head}
      <input data-data-key="${field.key}" value="${escapeHtml(val)}"/>${tags}</div>`;
  }

  function fieldInput(field, entry, extraClass, opts) {
    const o = opts || {};
    const data = o.data || entry.data || {};
    const val = data[field.key] || '';
    const optional = field.optional ? ' is-optional' : '';
    const filled = trim(val) ? ' is-filled' : '';
    const spanClass = extraClass || (field.fullWidth ? ' span-2' : '');
    const badge = field.optional ? '<span class="qa-field-badge">Opcional</span>' : '';
    const rotationBtn = field.rotation ? rotationButton(field.rotation, field.label) : '';
    // Origem do valor vai dentro do campo, não no rótulo: evita que o selo
    // quebre linha e desalinhe os inputs vizinhos.
    const discursosBadge = o.fromDiscursos
      ? '<span class="qa-field-source" title="Vem de Discursos Públicos"><span class="material-symbols-outlined">link</span>Discursos</span>'
      : (o.overridden ? '<span class="qa-field-source qa-field-source--manual" title="Apague o campo para voltar ao valor de Discursos Públicos"><span class="material-symbols-outlined">edit</span>Editado</span>' : '');
    const hint = field.hint ? `<p class="qa-field-hint">${escapeHtml(field.hint)}</p>` : '';
    const readonly = o.readonly ? ' readonly tabindex="-1"' : '';

    let control;
    if (field.type === 'select') {
      const options = (field.options || Schemas.CLEANING_GROUPS).map((opt) =>
        `<option value="${escapeHtml(opt)}" ${val === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`
      ).join('');
      control = `<select class="qa-field-control" data-data-key="${field.key}"${readonly}><option value=""></option>${options}</select>`;
    } else if (field.type === 'textarea') {
      const rows = Math.max(2, String(val).split('\n').length);
      control = `<textarea class="qa-field-control" data-data-key="${field.key}" rows="${rows}"${field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : ''}${readonly}>${escapeHtml(val)}</textarea>`;
    } else {
      control = `<input class="qa-field-control" data-data-key="${field.key}" value="${escapeHtml(val)}"${field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : ''}${readonly}/>`;
    }

    return `
      <div class="qa-field${optional}${filled}${spanClass}${o.fromDiscursos ? ' qa-field--discursos' : ''}">
        <div class="qa-field-head">
          <span class="qa-field-tag">${escapeHtml(field.label)}</span>
          ${badge}
          ${rotationBtn}
        </div>
        ${discursosBadge ? `<div class="qa-field-control-wrap">${control}${discursosBadge}</div>` : control}
        ${hint}
      </div>`;
  }

  // Ícone ao lado do campo que abre a lista de rodízio (aba Rodízio) num pop-up.
  // Com `date`, o pop-up marca quem já tem designação no meio/fim de semana nesse dia.
  function rotationButton(slug, label, date, ownKey) {
    const dateAttr = (date ? ` data-rotation-date="${escapeHtml(date)}"` : '')
      + (ownKey ? ` data-rotation-key="${escapeHtml(ownKey)}"` : '');
    return `<button type="button" class="qa-rotation-btn" data-rotation-slug="${escapeHtml(slug)}"${dateAttr} title="Ver lista de rodízio" aria-label="Ver lista de rodízio — ${escapeHtml(label)}">
      <span class="material-symbols-outlined" aria-hidden="true">autorenew</span>
    </button>`;
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

  // Layout do final de semana: cada grupo ocupa a largura toda. Dentro de cada grupo,
  // `wide` indica os campos de texto longo que ocupam a linha inteira.
  const WEEKEND_LAYOUT = [
    { group: 'discurso', order: ['tema_discurso', 'orador', 'congregacao_orador', 'presidente'], wide: ['tema_discurso'] },
    { group: 'sentinela', order: ['estudo_sentinela_tema', 'cantico_sentinela', 'leitor_sentinela', 'cantico_final', 'oracao_final'], wide: ['estudo_sentinela_tema'] },
    { group: 'enviados', wide: ['oradores_enviados'], optional: true },
    { group: 'territorio', wide: ['dirigente_sabado'] },
    { group: 'especial', wide: ['evento_especial'], optional: true }
  ];

  function fieldsHtmlWeekend(fields, entry) {
    const groups = Schemas.WEEKEND_GROUPS;
    const speech = receiveSpeechesByDate[entry.event_date];
    const { data, discursosKeys, overriddenKeys } = Sync.mergeWeekendDisplayData(entry.data, speech);
    return WEEKEND_LAYOUT.map((layout) => {
      const meta = groups[layout.group];
      let groupFields = fields.filter((f) => f.group === layout.group);
      if (!groupFields.length || !meta) return '';
      if (layout.order) {
        const rank = (f) => {
          const i = layout.order.indexOf(f.key);
          return i === -1 ? layout.order.length : i;
        };
        groupFields = [...groupFields].sort((a, b) => rank(a) - rank(b));
      }
      const fieldsHtml = groupFields.map((f) => fieldInput(f, entry, (layout.wide || []).includes(f.key) ? ' span-2' : '', {
        data,
        fromDiscursos: discursosKeys.includes(f.key),
        overridden: overriddenKeys.includes(f.key)
      })).join('');
      const cls = ['qa-subsection', layout.optional ? 'qa-subsection--optional' : '', layout.half ? '' : 'qa-subsection--full']
        .filter(Boolean).join(' ');
      return `
        <div class="${cls}">
          <div class="qa-subsection-head">
            <span class="material-symbols-outlined">${escapeHtml(meta.icon)}</span>
            ${escapeHtml(meta.title)}
          </div>
          <div class="qa-fields-grid">${fieldsHtml}</div>
        </div>`;
    }).join('');
  }

  function fieldsHtmlMecanicas(entry, fields) {
    const byKey = (k) => fields.find((f) => f.key === k);
    const row1 = ['portao', 'indicador', 'som'].map((k) => fieldCell(byKey(k), entry)).join('');
    const row2 = ['microf_volantes_1', 'microf_volantes_2', 'limpeza_grupo'].map((k) => fieldCell(byKey(k), entry)).join('');
    return `
      <div class="qa-table-block qa-table-block--mecanicas">
        <div class="qa-table-head"><span>Indicador (Portão)</span><span>Indicador (Auditório)</span><span>Som</span></div>
        <div class="qa-table-row">${row1}</div>
        <div class="qa-table-head"><span>Microf. volante 1</span><span>Microf. volante 2</span><span>Limpeza (grupo)</span></div>
        <div class="qa-table-row">${row2}</div>
      </div>`;
  }

  // Campos de Tesouros que, só no formulário, aparecem junto dos blocos de sala do
  // ministério para facilitar a montagem. O PDF mantém a ordem original.
  const TESOUROS_NO_BLOCO_DE_SALA = ['leitura_biblia', 'dirigente_sala_b', 'leitura_biblia_sala_b'];

  // Separa salão principal (tipo + designados) da Sala B para facilitar a montagem.
  function fieldsHtmlMinisterio(fields, entry) {
    const isSalaB = (f) => /_sala_b$/.test(f.key);
    const subsection = (title, icon, list) => `
      <div class="qa-subsection">
        <div class="qa-subsection-head">
          <span class="material-symbols-outlined">${escapeHtml(icon)}</span>
          ${escapeHtml(title)}
        </div>
        <div class="qa-fields-grid">${list.map((f) => fieldInput(f, entry)).join('')}</div>
      </div>`;
    return subsection('Salão principal', 'groups', fields.filter((f) => !isSalaB(f)))
      + subsection('Sala B', 'meeting_room', fields.filter(isSalaB));
  }

  function fieldsHtmlGrouped(fields, entry, block) {
    if (block === 'mecanicas') return fieldsHtmlMecanicas(entry, fields);
    if (block === 'weekend') {
      const speechHint = Object.keys(receiveSpeechesByDate).length
        ? '<p class="text-xs text-on-surface-variant mb-3">Orador e tema de cada sábado vêm de <strong>Discursos Públicos → Recebemos</strong>, e os oradores enviados de <strong>Discursos Públicos → Enviamos</strong> (badge dourado), mas dá pra editar aqui. Campo alterado ganha o badge <strong>Editado</strong>; apague o campo para voltar ao valor de Discursos Públicos.</p>'
        : '<p class="text-xs text-on-surface-variant mb-3">Preencha <strong>Discursos Públicos → Recebemos</strong> e salve para trazer orador e tema automaticamente (e <strong>Enviamos</strong> para os oradores enviados).</p>';
      return speechHint + sectionShell('Programa de final de semana', 'weekend', fieldsHtmlWeekend(fields, entry), 'qa-weekend-layout');
    }
    const sections = ['header', 'tesouros', 'ministerio', 'vida'];
    return sections.map((sec) => {
      const moved = (f) => TESOUROS_NO_BLOCO_DE_SALA.includes(f.key);
      const secFields = sec === 'ministerio'
        ? [...fields.filter(moved), ...fields.filter((f) => f.section === sec)]
        : fields.filter((f) => f.section === sec && !moved(f));
      if (!secFields.length) return '';
      const meta = MIDWEEK_SECTIONS[sec];
      if (sec === 'ministerio') return sectionShell(meta.title, meta.icon, fieldsHtmlMinisterio(secFields, entry), 'cols-1');
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
      markDirty();
    });
    // Trocar o irmão nas mecânicas atualiza as tags de todos os campos do dia:
    // colocar alguém no Som também marca o campo do Portão onde ele já estava.
    const assignTagEls = [...container.querySelectorAll('[data-assign-tags]')];
    const refreshAssignTags = () => {
      readFormIntoEntries();
      assignTagEls.forEach((tagsEl) => {
        const input = tagsEl.parentElement.querySelector('[data-data-key]');
        if (!input) return;
        const { assignTags: date, assignKey: key } = tagsEl.dataset;
        tagsEl.innerHTML = assignmentTagsHtml(input.value, date, key);
        tagsEl.parentElement.classList.toggle('has-conflict', !!tagsEl.querySelector('.qa-assign-tag--conflict'));
        if (input.tagName === 'SELECT') {
          [...input.options].forEach((opt) => {
            if (!opt.value) return;
            opt.textContent = assignmentOptionLabel(opt.value, date, key);
            opt.classList.toggle('qa-option-busy', assignmentsFor(opt.value, date, key).length > 0);
          });
        }
      });
    };
    assignTagEls.forEach((tagsEl) => {
      const input = tagsEl.parentElement.querySelector('[data-data-key]');
      input?.addEventListener('change', refreshAssignTags);
      input?.addEventListener('input', refreshAssignTags);
    });
    assignTagEls.forEach((tagsEl) => {
      tagsEl.parentElement.classList.toggle('has-conflict', !!tagsEl.querySelector('.qa-assign-tag--conflict'));
    });
    enhancePersonPickers(container);
    container.querySelector('[data-prev-entry]')?.addEventListener('click', () => selectBlockEntry(block, idx - 1));
    container.querySelector('[data-next-entry]')?.addEventListener('click', () => selectBlockEntry(block, idx + 1));
    container.querySelectorAll('[data-nav-index]').forEach((btn) => {
      btn.addEventListener('click', () => selectBlockEntry(block, parseInt(btn.dataset.navIndex, 10)));
    });
  }

  function renderBlockEditor(block, containerId) {
    closePersonPicker();
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

  // Fins de semana (sábado + domingo) que tocam o mês do quadro, no formato do PDF:
  // "03 - 04 de Junho" ou "31 de Maio - 01 de Junho" quando vira o mês.
  function limpezaWeekendOptions() {
    if (!board?.reference_month) return [];
    const ref = new Date(board.reference_month + 'T12:00:00');
    const month = ref.getMonth();
    const cursor = new Date(ref.getFullYear(), month, 1, 12);
    cursor.setDate(cursor.getDate() - ((cursor.getDay() + 1) % 7)); // sábado anterior ou o próprio dia 1
    const pad = (n) => String(n).padStart(2, '0');
    const out = [];
    while (true) {
      const sat = new Date(cursor);
      const sun = new Date(cursor);
      sun.setDate(sun.getDate() + 1);
      if (sat.getMonth() !== month && sun.getMonth() !== month) {
        if (out.length) break;
      } else {
        const satM = Dates.MONTHS_PT[sat.getMonth()];
        const sunM = Dates.MONTHS_PT[sun.getMonth()];
        out.push(satM === sunM
          ? `${pad(sat.getDate())} - ${pad(sun.getDate())} de ${sunM}`
          : `${pad(sat.getDate())} de ${satM} - ${pad(sun.getDate())} de ${sunM}`);
      }
      cursor.setDate(cursor.getDate() + 7);
    }
    return out;
  }

  function renderLimpezaEditor() {
    const container = $('editor-limpeza');
    if (!container) return;
    const list = limpezaEntries();

    if (!list.length) {
      container.innerHTML = '<p class="qa-limpeza-empty">Nenhum fim de semana ainda. Use <strong>Adicionar fim de semana</strong> abaixo.</p>';
      return;
    }

    const weekends = limpezaWeekendOptions();
    const used = new Set(list.map((e) => (e.data || {}).fim_de_semana).filter(Boolean));

    const rows = list.map((entry, i) => {
      const d = entry.data || {};
      const current = d.fim_de_semana || '';
      // Valor antigo digitado à mão continua aparecendo, mesmo fora da lista gerada.
      const options = current && !weekends.includes(current) ? [current, ...weekends] : weekends;
      const weekendOpts = options.map((w) => {
        const taken = w !== current && used.has(w) ? ' (já escolhido)' : '';
        return `<option value="${escapeHtml(w)}" ${w === current ? 'selected' : ''}>${escapeHtml(w + taken)}</option>`;
      }).join('');
      const groupOpts = rotationOptions('grupos', d.grupo || '', Schemas.CLEANING_GROUPS).map((g) =>
        `<option value="${escapeHtml(g)}" ${d.grupo === g ? 'selected' : ''}>${escapeHtml(g)}</option>`
      ).join('');
      return `
        <div class="qa-limpeza-row" data-entry-id="${entry.id}">
          <label class="qa-limpeza-field">
            <span class="qa-limpeza-label">Fim de semana</span>
            <select data-data-key="fim_de_semana" aria-label="Fim de semana da linha ${i + 1}">
              <option value="">Escolha o fim de semana</option>
              ${weekendOpts}
            </select>
          </label>
          <label class="qa-limpeza-field">
            <span class="qa-limpeza-label">Grupo</span>
            <select data-data-key="grupo" aria-label="Grupo da linha ${i + 1}">
              <option value="">Escolha o grupo</option>
              ${groupOpts}
            </select>
          </label>
          <button type="button" class="qa-limpeza-remove" data-remove-limpeza="${entry.id}" title="Remover" aria-label="Remover linha ${i + 1}">
            <span class="material-symbols-outlined" aria-hidden="true">delete</span>
          </button>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="qa-limpeza-table">
        <div class="qa-limpeza-row qa-limpeza-row--head" aria-hidden="true">
          <span>Fim de semana</span><span>Grupo</span><span></span>
        </div>
        ${rows}
      </div>`;

    // Trocar o fim de semana atualiza os "(já escolhido)" das outras linhas.
    container.querySelectorAll('[data-data-key="fim_de_semana"]').forEach((sel) => {
      sel.addEventListener('change', () => {
        readFormIntoEntries();
        renderLimpezaEditor();
      });
    });

    container.querySelectorAll('[data-remove-limpeza]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        readFormIntoEntries();
        const entry = entries.find((e) => e.id === btn.dataset.removeLimpeza);
        if (!entry) return;
        if (entryFilled(entry) && !await window.JEDialog.confirm({
          title: 'Remover linha',
          message: 'Remover este fim de semana da limpeza?',
          confirmLabel: 'Remover',
          danger: true
        })) return;
        entries = entries.filter((e) => e.id !== entry.id);
        renderLimpezaEditor();
        markDirty();
      });
    });
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
    markDirty();
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
    markDirty();
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
    rememberBoard(board.id);
    dirty = false;
    // Lido antes de qualquer persistEntries abaixo, que limparia o backup.
    const unsavedBackup = readUnsavedBackup(board.id);
    const dbUpdatedAt = board.updated_at || null;

    const { data: rows } = await client.from('announcement_entries').select('*').eq('board_id', board.id).order('sort_order');
    const raw = (rows || []).map((r) => ({ ...r, data: r.data || {} }));
    const sanitized = Dates.sanitizeEntriesForMonth(raw, referenceMonth);
    entries = sanitized;

    let removedOtherMonth = 0;
    if (sanitized.length < raw.length) {
      removedOtherMonth = raw.length - sanitized.length;
      await persistEntries(true);
    }

    const restoredUnsaved = await restoreUnsavedBackup(unsavedBackup, dbUpdatedAt);
    if (restoredUnsaved) storageSet(UNSAVED_PREFIX + board.id, JSON.stringify(unsavedBackup));

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
    await Promise.all([loadReceiveSpeeches(true), loadNeighborMecanicas()]);
    renderActiveEditors();
    if (restoredUnsaved) {
      showToast(toastEl, 'Alterações não salvas restauradas. Clique em "Salvar rascunho" para gravar.');
    }
    return { removedOtherMonth, restoredUnsaved };
  }

  async function loadBoardById(boardId) {
    const { data: existing, error } = await client
      .from('announcement_boards')
      .select('*')
      .eq('id', boardId)
      .maybeSingle();
    if (error || !existing) throw new Error('Quadro não encontrado.');

    writeUnsavedBackup();
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
    if (error) throw new Error('Não foi possível excluir o quadro. Tente de novo.');

    clearUnsavedBackup(boardId);
    if (storageGet(LAST_BOARD_KEY) === boardId) rememberBoard(null);
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

    writeUnsavedBackup();
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
      const { removedOtherMonth, restoredUnsaved } = await hydrateBoardFromRecord(existing);
      if (removedOtherMonth > 0) {
        showToast(toastEl, `${removedOtherMonth} data(s) de outro mês removida(s) — quadro de ${board.reference_label} atualizado.`);
      } else if (!restoredUnsaved) {
        showToast(toastEl, 'Quadro carregado.');
      }
    } else {
      const { data: created, error } = await client.from('announcement_boards').insert({
        reference_month: referenceMonth,
        reference_label: referenceLabel,
        status: 'draft'
      }).select().single();
      if (error) { showToast(toastEl, 'Não foi possível criar o quadro. Tente de novo.', true); return; }
      board = created;
      rememberBoard(board.id);
      dirty = false;
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
      await Promise.all([loadReceiveSpeeches(true), loadNeighborMecanicas()]);
      renderActiveEditors();
      showToast(toastEl, 'Novo quadro criado com datas do mês.');
    }
    await loadPublishedList();
    } catch (err) {
      showToast(toastEl, friendlyError(err, 'Não foi possível carregar o quadro. Tente de novo.'), true);
      throw err;
    }
  }

  async function persistEntries(skipRead) {
    if (!skipRead) readFormIntoEntries();
    if (!board?.id) return;

    const { error: delErr } = await client.from('announcement_entries').delete().eq('board_id', board.id);
    if (delErr) throw new Error('Não foi possível salvar as designações. Tente de novo.');

    const payload = entries.map((e, idx) => ({
      board_id: board.id,
      block: e.block,
      event_date: e.event_date || null,
      weekday_label: e.weekday_label || null,
      sort_order: e.sort_order ?? idx,
      data: e.block === 'weekend'
        ? Sync.withSpeechSnapshot(e.data, receiveSpeechesByDate[e.event_date])
        : (e.data || {}),
      export_to_calendar: e.export_to_calendar !== false
    }));

    const { data: saved, error } = await client.from('announcement_entries').insert(payload).select();
    if (error) throw new Error('Não foi possível salvar as designações. Tente de novo.');

    entries = (saved || []).map((r) => ({ ...r, data: r.data || {} }));
    clearUnsavedBackup(board.id);
    const updatedAt = new Date().toISOString();
    const { error: touchErr } = await client.from('announcement_boards').update({ updated_at: updatedAt }).eq('id', board.id);
    if (!touchErr) board.updated_at = updatedAt;
  }

  async function saveDraft() {
    try {
      readFormIntoEntries();
      if (!board) { showToast(toastEl, 'Carregue um quadro primeiro.', true); return; }
      await persistEntries();
      clearAllPendingPdfs();
      showToast(toastEl, 'Rascunho salvo.');
    } catch (err) {
      showToast(toastEl, friendlyError(err, 'Não foi possível salvar. Tente de novo.'), true);
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
      btn.title = ready ? 'Publica o PDF revisado no site' : 'Gere ou envie o PDF antes de publicar';
    });
  }

  function formatUploadError(err, fallback) {
    if (!err) return fallback;
    const msg = String(err.message || err.error || err);
    if (msg === 'HTTP 400' || msg === '400') {
      return `${fallback} Recarregue a página e tente de novo.`;
    }
    return fallback;
  }

  async function uploadAnnouncementPdf(path, blob) {
    const { error: upErr } = await client.storage.from('announcements').upload(path, blob, {
      contentType: 'application/pdf',
      cacheControl: '3600'
    });
    if (upErr) throw new Error(formatUploadError(upErr, 'Não foi possível enviar o PDF. Tente de novo.'));
    const { data: pub } = client.storage.from('announcements').getPublicUrl(path);
    return pub.publicUrl;
  }

  /** Caminho no Storage: pasta com timestamp (evita cache/colisão) + nome legível do arquivo. */
  function storagePdfPath(block) {
    const title = window.JEAnnouncementPdf?.fileTitle?.(block, board) || block;
    // Chaves do Supabase Storage não aceitam acentos.
    const safe = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w .-]/g, '').trim();
    return `${board.id}/${Date.now()}/${safe || block}.pdf`;
  }

  async function uploadPdfToStorage(block, blob) {
    const path = storagePdfPath(block);
    const pdfUrl = await uploadAnnouncementPdf(path, blob);

    const col = block === 'mecanicas' ? 'pdf_mecanicas_url' : block === 'midweek' ? 'pdf_midweek_url' : 'pdf_weekend_url';
    const boardUpdate = {
      [col]: pdfUrl,
      publish_mode: 'structured',
      updated_at: new Date().toISOString(),
      status: 'published',
      published_at: board.published_at || new Date().toISOString()
    };
    const { error: boardErr } = await client.from('announcement_boards').update(boardUpdate).eq('id', board.id);
    if (boardErr) throw new Error('Não foi possível publicar o PDF. Tente de novo.');

    const slug = Schemas.SECTION_SLUGS[block];
    const { error: sectionErr } = await client.from('announcement_sections').update({ document_url: pdfUrl, updated_at: new Date().toISOString() }).eq('slug', slug);
    if (sectionErr) throw new Error('Não foi possível atualizar a seção no site. Tente de novo.');

    board[col] = pdfUrl;
    board.status = 'published';
    board.publish_mode = 'structured';
    board.published_at = boardUpdate.published_at;
    return pdfUrl;
  }

  async function uploadFullBoardPdf(blob) {
    const path = storagePdfPath('full');
    const pdfUrl = await uploadAnnouncementPdf(path, blob);
    const boardUpdate = {
      pdf_full_url: pdfUrl,
      publish_mode: 'pdf_only',
      updated_at: new Date().toISOString(),
      status: 'published',
      published_at: board.published_at || new Date().toISOString()
    };
    const { error: boardErr } = await client.from('announcement_boards').update(boardUpdate).eq('id', board.id);
    if (boardErr) throw new Error('Não foi possível publicar o PDF. Tente de novo.');

    board.pdf_full_url = pdfUrl;
    board.publish_mode = 'pdf_only';
    board.status = 'published';
    board.published_at = boardUpdate.published_at;
    return pdfUrl;
  }

  function selectedReferenceMonth() {
    const monthInput = $('board-month')?.value;
    if (!monthInput) return null;
    const [y, m] = monthInput.split('-').map(Number);
    return `${y}-${String(m).padStart(2, '0')}-01`;
  }

  async function ensureBoardForSelectedMonth() {
    const ref = selectedReferenceMonth();
    if (!ref) {
      showToast(toastEl, 'Selecione um mês.', true);
      return false;
    }
    if (!board || board.reference_month !== ref) {
      await loadOrCreateBoard();
    }
    return !!board;
  }

  function stageUploadedPdf(block, file) {
    if (!file || file.type !== 'application/pdf') {
      showToast(toastEl, 'Selecione um arquivo PDF.', true);
      return false;
    }
    if (!board) {
      showToast(toastEl, 'Carregue um quadro primeiro.', true);
      return false;
    }
    revokePendingPdf(block);
    const objectUrl = URL.createObjectURL(file);
    pendingPdfs[block] = { blob: file, objectUrl, fileName: file.name };
    updatePublishButtonsState();
    return true;
  }

  async function handleUploadPdfFile(block, file) {
    if (!(await ensureBoardForSelectedMonth())) return;
    if (!stageUploadedPdf(block, file)) return;
    openPdfPreviewModal(block);
    showToast(toastEl, `${Schemas.SECTION_TITLES[block]} — PDF carregado. Revise e publique.`);
  }

  const bulkUploadFiles = {};
  let fullUploadFile = null;
  let pdfUploadMode = 'full';

  function setPdfUploadMode(mode) {
    pdfUploadMode = mode === 'split' ? 'split' : 'full';
    document.querySelectorAll('[data-upload-mode]').forEach((btn) => {
      const active = btn.dataset.uploadMode === pdfUploadMode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $('pdf-upload-panel-full')?.classList.toggle('hidden', pdfUploadMode !== 'full');
    $('pdf-upload-panel-split')?.classList.toggle('hidden', pdfUploadMode !== 'split');
    updateBulkUploadPublishButton();
  }

  function resetBulkUploadModal() {
    fullUploadFile = null;
    const fullInput = $('pdf-upload-full-input');
    const fullName = $('pdf-upload-full-name');
    if (fullInput) fullInput.value = '';
    if (fullName) fullName.textContent = 'Nenhum arquivo';
    ['mecanicas', 'midweek', 'weekend'].forEach((block) => {
      bulkUploadFiles[block] = null;
      const input = document.querySelector(`[data-bulk-upload="${block}"]`);
      const nameEl = document.querySelector(`[data-bulk-upload-name="${block}"]`);
      if (input) input.value = '';
      if (nameEl) nameEl.textContent = 'Nenhum arquivo';
    });
    setPdfUploadMode('full');
    updateBulkUploadPublishButton();
  }

  function updateBulkUploadPublishButton() {
    const btn = $('pdf-upload-publish');
    if (!btn) return;
    const ready = pdfUploadMode === 'full'
      ? !!fullUploadFile
      : ['mecanicas', 'midweek', 'weekend'].some((b) => bulkUploadFiles[b]);
    btn.disabled = !ready;
  }

  function openPdfUploadModal() {
    if (!$('board-month')?.value) {
      showToast(toastEl, 'Selecione um mês antes de enviar PDFs.', true);
      return;
    }
    resetBulkUploadModal();
    $('pdf-upload-modal')?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closePdfUploadModal() {
    $('pdf-upload-modal')?.classList.add('hidden');
    document.body.style.overflow = '';
    resetBulkUploadModal();
  }

  async function publishBulkUploadedPdfs() {
    const publishBtn = $('pdf-upload-publish');
    try {
      if (!(await ensureBoardForSelectedMonth())) return;

      if (pdfUploadMode === 'full') {
        if (!fullUploadFile) {
          showToast(toastEl, 'Selecione o PDF do quadro.', true);
          return;
        }
        if (publishBtn) {
          publishBtn.disabled = true;
          publishBtn.textContent = 'Publicando…';
        }
        showToast(toastEl, 'Publicando PDF do quadro…');
        await uploadFullBoardPdf(fullUploadFile);
        closePdfUploadModal();
        updateBoardLabel();
        loadPublishedList();
        showToast(toastEl, 'Quadro publicado no site como PDF único.');
        return;
      }

      const blocks = ['mecanicas', 'midweek', 'weekend'].filter((b) => bulkUploadFiles[b]);
      if (!blocks.length) {
        showToast(toastEl, 'Selecione ao menos um PDF.', true);
        return;
      }

      if (publishBtn) {
        publishBtn.disabled = true;
        publishBtn.textContent = 'Publicando…';
      }
      showToast(toastEl, 'Publicando PDFs…');

      for (const block of blocks) {
        await uploadPdfToStorage(block, bulkUploadFiles[block]);
      }

      closePdfUploadModal();
      updateBoardLabel();
      loadPublishedList();
        showToast(toastEl, `${blocks.length} PDF(s) publicado(s) no site.`);
    } catch (err) {
      showToast(toastEl, friendlyError(err, 'Não foi possível publicar os PDFs. Tente de novo.'), true);
    } finally {
      if (publishBtn) {
        updateBulkUploadPublishButton();
        publishBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px">publish</span> Publicar no site';
      }
    }
  }

  /** Nome do arquivo ao baixar: URL blob: não carrega nome, então o Chrome salvaria com o UUID. */
  function pdfDownloadName(block, pending) {
    if (pending.fileName) return pending.fileName;
    const title = window.JEAnnouncementPdf?.fileTitle?.(block, board) || 'Quadro de Anúncios';
    return `${title.replace(/[\\/:*?"<>|]/g, '').trim()}.pdf`;
  }

  function openPdfPreviewModal(block) {
    const pending = pendingPdfs[block];
    if (!pending?.objectUrl) return;
    pdfPreviewBlock = block;
    const frame = $('pdf-preview-frame');
    const title = $('pdf-preview-title');
    const openTab = $('pdf-preview-open-tab');
    const titles = { ...Schemas.SECTION_TITLES, full: 'Quadro completo' };
    if (title) title.textContent = `Prévia — ${titles[block] || 'PDF'}`;
    if (frame) frame.src = pending.objectUrl;
    if (openTab) openTab.href = pending.objectUrl;
    const download = $('pdf-preview-download');
    if (download) {
      download.href = pending.objectUrl;
      download.download = pdfDownloadName(block, pending);
    }
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
      showToast(toastEl, friendlyError(err, 'Não foi possível gerar o PDF. Tente de novo.'), true);
    }
  }

  async function generateFullBoardPdf() {
    try {
      if (!(await ensureBoardForSelectedMonth())) return;
      readFormIntoEntries();
      showToast(toastEl, 'Gerando PDF completo…');
      const pdfEntries = Sync.mergeWeekendEntries(entries, receiveSpeechesByDate);
      const blob = await pdfApi().boardToPdfBlob(board, pdfEntries);
      if (entries.some((e) => String(e.id).startsWith('local-'))) {
        await persistEntries(true);
      }
      revokePendingPdf('full');
      const objectUrl = URL.createObjectURL(blob);
      pendingPdfs.full = { blob, objectUrl };
      updatePublishButtonsState();
      openPdfPreviewModal('full');
      showToast(toastEl, 'Quadro completo — PDF pronto para revisão.');
    } catch (err) {
      showToast(toastEl, friendlyError(err, 'Não foi possível gerar o PDF. Tente de novo.'), true);
    }
  }

  async function publishBlock(block) {
    try {
      const pending = pendingPdfs[block];
      if (!pending?.blob) {
        showToast(toastEl, 'Gere ou envie o PDF antes de publicar.', true);
        return;
      }
      if (!board) { showToast(toastEl, 'Carregue um quadro primeiro.', true); return; }

      readFormIntoEntries();
      await persistEntries();

      if (block === 'full') {
        await uploadFullBoardPdf(pending.blob);
        revokePendingPdf(block);
        closePdfPreviewModal();
        updateBoardLabel();
        showToast(toastEl, 'Quadro publicado no site como PDF único.');
        loadPublishedList();
        return;
      }

      await uploadPdfToStorage(block, pending.blob);
      revokePendingPdf(block);
      closePdfPreviewModal();
      updateBoardLabel();
      showToast(toastEl, `${Schemas.SECTION_TITLES[block]} publicado no site.`);
      loadPublishedList();
    } catch (err) {
      showToast(toastEl, friendlyError(err, 'Não foi possível publicar. Tente de novo.'), true);
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
      const pdfs = b.publish_mode === 'pdf_only' && b.pdf_full_url
        ? ['PDF único']
        : [
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
          showToast(toastEl, friendlyError(err, 'Não foi possível abrir o quadro. Tente de novo.'), true);
        }
      });
    });

    list.querySelectorAll('[data-board-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await deleteBoard(btn.dataset.boardDelete);
        } catch (err) {
          showToast(toastEl, friendlyError(err, 'Não foi possível excluir. Tente de novo.'), true);
        }
      });
    });
  }

  async function loadPublishedList() {
    const selectWithMode = 'id, reference_label, reference_month, status, published_at, updated_at, publish_mode, pdf_full_url, pdf_mecanicas_url, pdf_midweek_url, pdf_weekend_url';
    const selectLegacy = 'id, reference_label, reference_month, status, published_at, updated_at, pdf_mecanicas_url, pdf_midweek_url, pdf_weekend_url';

    let { data, error } = await client
      .from('announcement_boards')
      .select(selectWithMode)
      .neq('status', 'archived')
      .order('reference_month', { ascending: false })
      .limit(24);

    if (error?.code === '42703' || /publish_mode|pdf_full_url/.test(error?.message || '')) {
      ({ data, error } = await client
        .from('announcement_boards')
        .select(selectLegacy)
        .neq('status', 'archived')
        .order('reference_month', { ascending: false })
        .limit(24));
    }
    if (error) {
      const list = $('published-list');
      if (list) list.innerHTML = '<p class="text-error text-sm px-4 py-6">Não foi possível carregar os quadros. Tente de novo.</p>';
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
    const navTabs = [...editorTabs, 'rodizio'];

    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        readFormIntoEntries();
        const tab = btn.dataset.tab;
        const isEditorTab = navTabs.includes(tab);

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
        else if (tab === 'rodizio') window.JEAnnouncementRotation?.load();
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

    window.JEAnnouncementRotation?.init({
      client,
      toastEl,
      // Grupos de limpeza vêm do rodízio: re-renderiza quando a lista carrega ou é salva.
      onChange: () => {
        if (!board) return;
        readFormIntoEntries();
        renderActiveEditors();
      }
    });
    window.JEAnnouncementRotation?.load();
    setupTabs();
    setupPublishedFilters();
    await Promise.all([loadHistorySettings(), loadPublishedList()]);

    $('btn-new-board').addEventListener('click', loadOrCreateBoard);
    $('btn-save-draft').addEventListener('click', saveDraft);
    document.querySelectorAll('.btn-save-draft').forEach((b) => b.addEventListener('click', saveDraft));
    document.querySelectorAll('.btn-generate-pdf').forEach((b) => b.addEventListener('click', () => generatePdfBlock(b.dataset.generatePdf)));
    document.querySelectorAll('.btn-publish-block').forEach((b) => b.addEventListener('click', () => publishBlock(b.dataset.publishBlock)));

    document.querySelectorAll('[data-upload-pdf-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const block = btn.dataset.uploadPdfBtn;
        document.querySelector(`[data-upload-pdf="${block}"]`)?.click();
      });
    });
    document.querySelectorAll('[data-upload-pdf]').forEach((input) => {
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        input.value = '';
        if (file) await handleUploadPdfFile(input.dataset.uploadPdf, file);
      });
    });

    $('btn-generate-full-pdf')?.addEventListener('click', generateFullBoardPdf);
    $('btn-open-pdf-upload')?.addEventListener('click', openPdfUploadModal);
    $('pdf-upload-close')?.addEventListener('click', closePdfUploadModal);
    $('pdf-upload-backdrop')?.addEventListener('click', closePdfUploadModal);
    $('pdf-upload-cancel')?.addEventListener('click', closePdfUploadModal);
    $('pdf-upload-publish')?.addEventListener('click', publishBulkUploadedPdfs);
    document.querySelectorAll('[data-upload-mode]').forEach((btn) => {
      btn.addEventListener('click', () => setPdfUploadMode(btn.dataset.uploadMode));
    });
    $('pdf-upload-full-input')?.addEventListener('change', () => {
      const input = $('pdf-upload-full-input');
      const file = input?.files?.[0];
      const nameEl = $('pdf-upload-full-name');
      if (!file) {
        fullUploadFile = null;
        if (nameEl) nameEl.textContent = 'Nenhum arquivo';
      } else if (file.type !== 'application/pdf') {
        showToast(toastEl, 'Selecione um arquivo PDF.', true);
        input.value = '';
        fullUploadFile = null;
        if (nameEl) nameEl.textContent = 'Nenhum arquivo';
      } else {
        fullUploadFile = file;
        if (nameEl) nameEl.textContent = file.name;
      }
      updateBulkUploadPublishButton();
    });
    document.querySelectorAll('[data-bulk-upload]').forEach((input) => {
      input.addEventListener('change', () => {
        const block = input.dataset.bulkUpload;
        const file = input.files?.[0];
        const nameEl = document.querySelector(`[data-bulk-upload-name="${block}"]`);
        if (!file) {
          bulkUploadFiles[block] = null;
          if (nameEl) nameEl.textContent = 'Nenhum arquivo';
        } else if (file.type !== 'application/pdf') {
          showToast(toastEl, 'Selecione um arquivo PDF.', true);
          input.value = '';
          bulkUploadFiles[block] = null;
          if (nameEl) nameEl.textContent = 'Nenhum arquivo';
        } else {
          bulkUploadFiles[block] = file;
          if (nameEl) nameEl.textContent = file.name;
        }
        updateBulkUploadPublishButton();
      });
    });

    $('pdf-preview-close')?.addEventListener('click', closePdfPreviewModal);
    $('pdf-preview-backdrop')?.addEventListener('click', closePdfPreviewModal);
    $('pdf-preview-download')?.addEventListener('click', (e) => {
      const pending = pdfPreviewBlock && pendingPdfs[pdfPreviewBlock];
      if (!pending?.objectUrl) e.preventDefault();
    });
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
      readFormIntoEntries();
      const list = limpezaEntries();
      // Já sugere o próximo fim de semana ainda não escolhido.
      const used = new Set(list.map((e) => (e.data || {}).fim_de_semana).filter(Boolean));
      const next = limpezaWeekendOptions().find((w) => !used.has(w)) || '';
      entries.push({
        id: newLocalId(),
        board_id: board?.id,
        block: 'limpeza_mensal',
        sort_order: list.reduce((max, e) => Math.max(max, e.sort_order || 0), 0) + 1,
        data: { fim_de_semana: next, grupo: '' },
        export_to_calendar: false
      });
      renderLimpezaEditor();
      markDirty();
      const selects = $('editor-limpeza').querySelectorAll('[data-data-key="grupo"]');
      selects[selects.length - 1]?.focus();
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
      else if (!$('pdf-upload-modal')?.classList.contains('hidden')) closePdfUploadModal();
      else if (!$('pdf-preview-modal')?.classList.contains('hidden')) closePdfPreviewModal();
    });

    $('history-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await client.from('announcement_settings').upsert({
        id: 1,
        history_folder_url: $('history-url').value.trim(),
        history_description: $('history-desc').value.trim()
      });
      if (error) showToast(toastEl, 'Não foi possível salvar. Tente de novo.', true);
      else showToast(toastEl, 'Histórico salvo.');
    });

    const markDirtyFromForm = (e) => {
      if (e.target?.closest?.('[data-entry-id]')) markDirty();
    };
    document.addEventListener('input', markDirtyFromForm);
    document.addEventListener('change', markDirtyFromForm);
    window.addEventListener('pagehide', writeUnsavedBackup);
    window.addEventListener('beforeunload', writeUnsavedBackup);

    const loadBoardWhenIdle = async () => {
      try {
        const lastBoardId = storageGet(LAST_BOARD_KEY);
        let reopened = false;
        if (lastBoardId) {
          try {
            await loadBoardById(lastBoardId);
            reopened = true;
          } catch {
            rememberBoard(null);
          }
        }
        if (!reopened) await loadOrCreateBoard();
        updatePublishButtonsState();
      } catch (err) {
        showToast(toastEl, friendlyError(err, 'Não foi possível carregar o quadro. Tente de novo.'), true);
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
