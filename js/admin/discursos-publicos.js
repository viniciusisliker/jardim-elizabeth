(function () {
  const { guardPermission, getClient, showToast, escapeHtml } = window.JEAdmin;
  const DIRECTION = { receive: 'Recebemos', send: 'Enviamos' };
  const PRIVILEGE = { anciao: 'Ancião', servo_ministerial: 'Servo Ministerial' };
  const STATUS = { pendente: 'Pendente', confirmado: 'Confirmado', cancelado: 'Cancelado' };
  let client, root, toastEl, themes = [], speakers = [], congregations = [], assignments = [];
  const rendered = {};

  const $ = (selector) => root?.querySelector(selector);
  const text = (v) => String(v ?? '').trim();
  const today = () => new Date().toISOString().slice(0, 10);
  const dateText = (iso) => iso ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${iso}T12:00:00`)) : '—';
  const errorText = (err) => /does not exist|schema cache/i.test(String(err?.message || err))
    ? 'As tabelas de Discursos Públicos ainda não foram aplicadas.'
    : String(err?.message || err || 'Ocorreu um erro.');
  const toast = (message, danger) => showToast(toastEl, message, danger);
  const option = (value, label, selected) => `<option value="${escapeHtml(value)}"${String(value) === String(selected ?? '') ? ' selected' : ''}>${escapeHtml(label)}</option>`;
  const empty = (message) => `<div class="terr-empty-state dp-empty">${escapeHtml(message)}</div>`;
  const assignmentTheme = (a) => a.outline_number ? `Esboço ${a.outline_number}${a.theme_title ? ` — ${a.theme_title}` : ''}` : (a.theme_title || '—');
  const getSpeaker = (id) => speakers.find((s) => s.id === id);
  const getTheme = (id) => themes.find((t) => t.id === id);
  const getCongregation = (id) => congregations.find((c) => c.id === id);

  function normalizeSearch(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function matchesSearch(text, query) {
    const q = normalizeSearch(query);
    if (!q) return true;
    return normalizeSearch(text).includes(q);
  }

  function activeSpeakers(query = '') {
    return speakers
      .filter((s) => s.is_active && matchesSearch(`${s.full_name}${s.is_local ? ' local' : ''}`, query))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'));
  }

  function activeThemes(query = '', speakerId) {
    const speaker = getSpeaker(speakerId);
    const prepared = new Set((speaker?.speech_speaker_themes || []).map((x) => x.theme_id));
    return themes
      .filter((t) => t.is_active && matchesSearch(`${t.outline_number} ${t.title}`, query))
      .sort((a, b) => (prepared.has(b.id) - prepared.has(a.id)) || (a.outline_number - b.outline_number));
  }

  function activeCongregations(query = '') {
    return congregations
      .filter((c) => c.is_active && matchesSearch(c.name, query))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  function modalRoot() {
    return document.querySelector('.dp-modal');
  }

  function layout() {
    root.innerHTML = `
      <div class="terr-nav-stage dp-nav-stage">
        <div class="terr-nav-scroll">
          <nav class="terr-nav dp-crm-nav" role="tablist" aria-label="Abas de Discursos Públicos">
            ${[['agenda', 'Agenda', 'calendar_month'], ['oradores', 'Oradores', 'groups'], ['temas', 'Temas', 'menu_book']]
              .map(([id, label, icon], i) => `<button type="button" class="terr-tab${i ? '' : ' active'}" data-dp-tab="${id}" role="tab" title="${label}" aria-label="${label}">
                <span class="material-symbols-outlined" aria-hidden="true">${icon}</span>
                <span class="terr-tab-label">${label}</span>
              </button>`).join('')}
          </nav>
        </div>
      </div>
      <section id="dp-panel-agenda" class="terr-panel active"></section>
      <section id="dp-panel-oradores" class="terr-panel"></section>
      <section id="dp-panel-temas" class="terr-panel"></section>`;
  }

  function dateRange(days) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + days);
    return assignments.filter((a) => a.event_date >= today() && a.event_date <= end.toISOString().slice(0, 10));
  }

  function statsHtml() {
    const next30 = dateRange(30);
    const pending = assignments.filter((a) => a.confirmation_status === 'pendente' && a.event_date >= today()).length;
    return `
      <div class="terr-catalog-stats dp-stats">
        <article><strong>${next30.filter((a) => a.direction === 'receive').length}</strong><span>Recebemos — 30 dias</span></article>
        <article><strong>${next30.filter((a) => a.direction === 'send').length}</strong><span>Enviamos — 30 dias</span></article>
        <article><strong>${pending}</strong><span>Pendentes</span></article>
        <article><strong>${speakers.filter((s) => s.is_active).length}</strong><span>Oradores ativos</span></article>
        <article><strong>${themes.filter((t) => t.is_active).length}</strong><span>Temas S-34</span></article>
      </div>`;
  }

  function assignmentTable(rows) {
    if (!rows.length) return empty('Nenhuma designação encontrada.');
    return `<div class="terr-table-wrap"><table class="terr-catalog-table dp-table"><colgroup>
      <col class="dp-col-direction"/><col class="dp-col-date"/><col class="dp-col-speaker"/><col class="dp-col-theme"/><col class="dp-col-congregation"/><col class="dp-col-status"/><col class="dp-col-actions"/>
    </colgroup><thead><tr>
      <th>Direção</th><th>Data</th><th>Orador</th><th>Tema</th><th>Congregação</th><th>Status</th><th></th>
    </tr></thead><tbody>${rows.map((a) => {
      const theme = assignmentTheme(a);
      const congregation = a.congregation_name || a.speech_congregations?.name || '—';
      const speaker = a.speaker_name || a.speech_speakers?.full_name || '—';
      return `<tr data-dp-edit="${a.id}" class="dp-assignment-row">
      <td><span class="dp-badge dp-badge--${a.direction}">${DIRECTION[a.direction]}</span></td>
      <td class="dp-cell-date">${escapeHtml(dateText(a.event_date))}${a.event_time ? `<small>${escapeHtml(a.event_time.slice(0, 5))}</small>` : ''}</td>
      <td class="dp-cell-truncate" title="${escapeHtml(speaker)}">${escapeHtml(speaker)}</td>
      <td class="dp-cell-truncate dp-cell-theme" title="${escapeHtml(theme)}">${escapeHtml(theme)}</td>
      <td class="dp-cell-truncate" title="${escapeHtml(congregation)}">${escapeHtml(congregation)}</td>
      <td><span class="dp-status dp-status--${a.confirmation_status}">${STATUS[a.confirmation_status]}</span></td>
      <td class="dp-actions"><button type="button" data-dp-wa="${a.id}" title="WhatsApp">WhatsApp</button><button type="button" data-dp-delete="${a.id}" title="Excluir">Excluir</button></td>
    </tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function renderAgenda() {
    const host = $('#dp-panel-agenda');
    if (!host) return;
    const month = host.dataset.month || new Date().toISOString().slice(0, 7);
    const direction = host.dataset.direction || '';
    const status = host.dataset.status || '';
    const rows = assignments
      .filter((a) => (!month || a.event_date.startsWith(month))
        && (!direction || a.direction === direction)
        && (!status || a.confirmation_status === status))
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
    host.innerHTML = `
      ${statsHtml()}
      <div class="terr-catalog-card">
        <div class="terr-catalog-heading">
          <div>
            <h2>Agenda</h2>
            <p>Recebemos e enviamos · confirmação · WhatsApp · sincroniza com o Quadro (final de semana)</p>
          </div>
        </div>
        <div class="terr-sched-toolbar dp-toolbar">
          <label>Direção <select data-dp-filter="direction">${option('', 'Todos', direction)}${option('receive', 'Recebemos', direction)}${option('send', 'Enviamos', direction)}</select></label>
          <label>Status <select data-dp-filter="status">${option('', 'Todos', status)}${Object.entries(STATUS).map(([k, v]) => option(k, v, status)).join('')}</select></label>
          <label>Mês <input type="month" value="${month}" data-dp-month></label>
          <button type="button" class="btn-primary" data-dp-new>Nova designação</button>
          <button type="button" data-dp-wa-range>WhatsApp da semana</button>
        </div>
        ${assignmentTable(rows)}
      </div>`;
    host.querySelectorAll('[data-dp-filter]').forEach((el) => el.addEventListener('change', () => {
      host.dataset[el.dataset.dpFilter] = el.value;
      renderAgenda();
    }));
    host.querySelector('[data-dp-month]')?.addEventListener('change', (e) => {
      host.dataset.month = e.target.value;
      renderAgenda();
    });
    bindAssignmentActions(host);
  }

  const LOCAL_CONGREGATION = 'Jardim Elizabeth';

  function isLocalCongregationName(name) {
    return normalizeSearch(name) === normalizeSearch(LOCAL_CONGREGATION);
  }

  const COMBO_FIELDS = {
    speaker: { idName: 'speaker_id', textName: 'speaker_name', icon: 'person', placeholder: 'Buscar ou digitar orador…', createLabel: 'Novo orador' },
    theme: { idName: 'theme_id', textName: 'theme_title', icon: 'menu_book', placeholder: 'Nº ou título do esboço…', createLabel: 'Texto livre' },
    congregation: { idName: 'congregation_id', textName: 'congregation_name', icon: 'location_on', placeholder: 'Nome da congregação…', createLabel: 'Nova congregação' }
  };

  function themeDisplay(theme) {
    if (!theme) return '';
    return `${theme.outline_number} · ${theme.title}`;
  }

  function assignmentComboValue(kind, assignment) {
    const a = assignment || {};
    if (kind === 'speaker') {
      const s = getSpeaker(a.speaker_id);
      return { id: a.speaker_id || '', text: s?.full_name || a.speaker_name || '' };
    }
    if (kind === 'theme') {
      const t = getTheme(a.theme_id);
      return { id: a.theme_id || '', text: t ? themeDisplay(t) : (a.theme_title || '') };
    }
    const c = getCongregation(a.congregation_id);
    return { id: a.congregation_id || '', text: c?.name || a.congregation_name || '' };
  }

  function comboFieldHtml(kind, assignment, { label, span2 = false } = {}) {
    const cfg = COMBO_FIELDS[kind];
    const { id, text: textVal } = assignmentComboValue(kind, assignment);
    const theme = kind === 'theme' ? getTheme(id) : null;
    const leading = kind === 'theme'
      ? `<span class="dp-combo__badge${theme ? '' : ' hidden'}" data-dp-combo-badge aria-hidden="true">${theme?.outline_number || ''}</span>
         <span class="material-symbols-outlined dp-combo__icon${theme ? ' hidden' : ''}" aria-hidden="true">${cfg.icon}</span>`
      : `<span class="material-symbols-outlined dp-combo__icon" aria-hidden="true">${cfg.icon}</span>`;
    return `
      <label class="${span2 ? 'dp-span-2' : ''}">${label}
        <div class="dp-combo${kind === 'theme' ? ' dp-combo--theme' : ''}" data-dp-combo="${kind}">
          ${leading}
          <input class="dp-combo__input" type="text" name="${cfg.textName}" autocomplete="off" placeholder="${escapeHtml(cfg.placeholder)}" value="${escapeHtml(textVal)}">
          <input type="hidden" name="${cfg.idName}" value="${escapeHtml(id)}">
          <button type="button" class="dp-combo__btn dp-combo__clear${textVal ? '' : ' hidden'}" aria-label="Limpar" tabindex="-1">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
          <button type="button" class="dp-combo__btn dp-combo__toggle" aria-label="Abrir lista" tabindex="-1">
            <span class="material-symbols-outlined" aria-hidden="true">expand_more</span>
          </button>
          <ul class="dp-combo__list" role="listbox" hidden></ul>
        </div>
      </label>`;
  }

  function mapCongregationItem(congregation) {
    const local = isLocalCongregationName(congregation.name);
    return {
      id: congregation.id,
      text: congregation.name,
      display: congregation.name,
      label: congregation.name,
      meta: local ? 'Nossa congregação' : '',
      local
    };
  }

  function congregationComboGroups(query) {
    const all = activeCongregations(query);
    return {
      local: all.filter((c) => isLocalCongregationName(c.name)).map(mapCongregationItem),
      others: all.filter((c) => !isLocalCongregationName(c.name)).map(mapCongregationItem)
    };
  }

  function congregationOptionHtml(item) {
    return `<li class="dp-combo__option" role="option" tabindex="-1" data-id="${escapeHtml(item.id)}" data-text="${escapeHtml(item.text)}" data-display="${escapeHtml(item.display)}">
      <span class="material-symbols-outlined dp-combo__opt-icon${item.local ? ' is-local' : ''}" aria-hidden="true">${item.local ? 'home_pin' : 'location_on'}</span>
      <span class="dp-combo__opt-main">${escapeHtml(item.label)}</span>
      ${item.meta ? `<span class="dp-combo__opt-meta">${escapeHtml(item.meta)}</span>` : ''}
    </li>`;
  }

  function comboEmptyMessage(kind) {
    if (kind === 'theme') return 'Nenhum esboço encontrado';
    if (kind === 'congregation') return 'Nenhuma congregação encontrada';
    if (kind === 'speaker') return 'Nenhum orador encontrado';
    return 'Nenhum resultado';
  }

  function mapThemeComboItem(theme, prepared) {
    return {
      id: theme.id,
      text: theme.title,
      display: themeDisplay(theme),
      label: `Esboço ${theme.outline_number}`,
      meta: theme.title,
      num: theme.outline_number,
      prepared
    };
  }

  function themeComboGroups(query, form) {
    const speakerId = form.querySelector('[name="speaker_id"]')?.value || '';
    const preparedSet = new Set((getSpeaker(speakerId)?.speech_speaker_themes || []).map((x) => x.theme_id));
    const all = activeThemes(query, speakerId);
    return {
      speaker: getSpeaker(speakerId),
      prepared: all.filter((t) => preparedSet.has(t.id)).map((t) => mapThemeComboItem(t, true)),
      catalog: all.filter((t) => !preparedSet.has(t.id)).map((t) => mapThemeComboItem(t, false))
    };
  }

  function themeOptionHtml(item) {
    return `<li class="dp-combo__option" role="option" tabindex="-1" data-id="${escapeHtml(item.id)}" data-text="${escapeHtml(item.text)}" data-display="${escapeHtml(item.display)}">
      <span class="dp-combo__num${item.prepared ? ' is-prepared' : ''}">${item.num}${item.prepared ? '★' : ''}</span>
      <span class="dp-combo__opt-main">${escapeHtml(item.label)}</span>
      <span class="dp-combo__opt-meta">${escapeHtml(item.meta)}</span>
    </li>`;
  }

  function updateThemeComboBadge(combo, themeId) {
    if (combo.dataset.dpCombo !== 'theme') return;
    const badge = combo.querySelector('[data-dp-combo-badge]');
    const icon = combo.querySelector('.dp-combo__icon');
    const theme = getTheme(themeId);
    badge?.classList.toggle('hidden', !theme);
    icon?.classList.toggle('hidden', !!theme);
    if (badge && theme) badge.textContent = theme.outline_number;
  }

  function comboItems(kind, query, form) {
    if (kind === 'speaker') {
      return activeSpeakers(query).slice(0, 14).map((s) => ({
        id: s.id,
        text: s.full_name,
        display: s.full_name,
        label: s.full_name,
        meta: [s.speech_congregations?.name, s.is_local ? 'Local' : ''].filter(Boolean).join(' · ')
      }));
    }
    if (kind === 'theme') {
      const { prepared, catalog } = themeComboGroups(query, form);
      return [...prepared, ...catalog].slice(0, 16);
    }
    const { local, others } = congregationComboGroups(query);
    return [...local, ...others].slice(0, 16);
  }

  function comboHasExactMatch(kind, query, form) {
    const q = normalizeSearch(query);
    if (!q) return true;
    const num = q.match(/^(\d{1,3})$/)?.[1];
    return comboItems(kind, query, form).some((item) => {
      if (num && item.num != null) return String(item.num) === num;
      return normalizeSearch(item.text) === q
        || normalizeSearch(item.display || '') === q
        || normalizeSearch(item.label) === q;
    });
  }

  function closeCombo(combo) {
    combo.querySelector('.dp-combo__list').hidden = true;
    combo.classList.remove('is-open');
  }

  function renderComboList(combo, query = '') {
    const kind = combo.dataset.dpCombo;
    const form = combo.closest('form');
    const list = combo.querySelector('.dp-combo__list');
    const cfg = COMBO_FIELDS[kind];
    const q = text(query);
    let html = '';

    if (kind === 'theme') {
      const { speaker, prepared, catalog } = themeComboGroups(query, form);
      if (speaker && prepared.length) {
        html += `<li class="dp-combo__heading"><span class="material-symbols-outlined" aria-hidden="true">star</span> Preparados · ${escapeHtml(speaker.full_name)}</li>`;
        html += prepared.map(themeOptionHtml).join('');
      }
      if (catalog.length) {
        if (prepared.length) html += `<li class="dp-combo__heading">Catálogo S-34</li>`;
        html += catalog.map(themeOptionHtml).join('');
      }
    } else if (kind === 'congregation') {
      const { local, others } = congregationComboGroups(query);
      if (local.length) {
        html += `<li class="dp-combo__heading"><span class="material-symbols-outlined" aria-hidden="true">home_pin</span> Nossa congregação</li>`;
        html += local.map(congregationOptionHtml).join('');
      }
      if (others.length) {
        if (local.length) html += `<li class="dp-combo__heading">Outras congregações</li>`;
        html += others.slice(0, 12).map(congregationOptionHtml).join('');
      }
    } else {
      html = comboItems(kind, query, form).map((item) => `<li class="dp-combo__option" role="option" tabindex="-1" data-id="${escapeHtml(item.id)}" data-text="${escapeHtml(item.text)}" data-display="${escapeHtml(item.display || item.text)}">
        <span class="material-symbols-outlined dp-combo__opt-icon" aria-hidden="true">${cfg.icon}</span>
        <span class="dp-combo__opt-main">${escapeHtml(item.label)}</span>
        ${item.meta ? `<span class="dp-combo__opt-meta">${escapeHtml(item.meta)}</span>` : ''}
      </li>`).join('');
    }

    if (q && !comboHasExactMatch(kind, q, form)) {
      html += `<li class="dp-combo__option dp-combo__option--new" role="option" tabindex="-1" data-id="" data-text="${escapeHtml(q)}" data-display="${escapeHtml(q)}">
        <span class="material-symbols-outlined dp-combo__opt-icon" aria-hidden="true">add</span>
        <span class="dp-combo__opt-main">Usar “${escapeHtml(q)}”</span>
        <span class="dp-combo__opt-meta">${cfg.createLabel}</span>
      </li>`;
    }

    list.innerHTML = html || `<li class="dp-combo__empty">${comboEmptyMessage(kind)}</li>`;
    list.hidden = false;
    combo.classList.add('is-open');
  }

  function selectComboOption(combo, optionEl) {
    const input = combo.querySelector('.dp-combo__input');
    const hidden = combo.querySelector('input[type="hidden"]');
    const clearBtn = combo.querySelector('.dp-combo__clear');
    hidden.value = optionEl.dataset.id || '';
    input.value = optionEl.dataset.display || optionEl.dataset.text || '';
    clearBtn?.classList.toggle('hidden', !input.value);
    updateThemeComboBadge(combo, hidden.value);
    closeCombo(combo);
    const form = combo.closest('form');
    if (combo.dataset.dpCombo === 'speaker' && hidden.value) {
      const speaker = getSpeaker(hidden.value);
      const congCombo = form?.querySelector('[data-dp-combo="congregation"]');
      const congHidden = congCombo?.querySelector('input[type="hidden"]');
      const congInput = congCombo?.querySelector('.dp-combo__input');
      if (speaker?.congregation_id && congCombo && !text(congHidden?.value) && !text(congInput?.value)) {
        const congregation = getCongregation(speaker.congregation_id);
        if (congregation) {
          congHidden.value = congregation.id;
          congInput.value = congregation.name;
          congCombo.querySelector('.dp-combo__clear')?.classList.remove('hidden');
        }
      }
      const themeCombo = form?.querySelector('[data-dp-combo="theme"]');
      if (themeCombo?.classList.contains('is-open')) renderComboList(themeCombo, themeCombo.querySelector('.dp-combo__input')?.value || '');
    }
  }

  function bindCombo(combo) {
    const input = combo.querySelector('.dp-combo__input');
    const hidden = combo.querySelector('input[type="hidden"]');
    const clearBtn = combo.querySelector('.dp-combo__clear');
    const toggleBtn = combo.querySelector('.dp-combo__toggle');
    const list = combo.querySelector('.dp-combo__list');

    const open = () => renderComboList(combo, input.value);
    const close = () => closeCombo(combo);

    input.addEventListener('focus', open);
    input.addEventListener('input', () => {
      hidden.value = '';
      updateThemeComboBadge(combo, '');
      clearBtn?.classList.toggle('hidden', !input.value);
      open();
    });
    input.addEventListener('blur', () => {
      window.setTimeout(() => {
        if (!combo.contains(document.activeElement)) close();
      }, 120);
    });

    toggleBtn?.addEventListener('mousedown', (e) => e.preventDefault());
    toggleBtn?.addEventListener('click', () => {
      if (combo.classList.contains('is-open')) close();
      else { input.focus(); open(); }
    });

    clearBtn?.addEventListener('mousedown', (e) => e.preventDefault());
    clearBtn?.addEventListener('click', () => {
      input.value = '';
      hidden.value = '';
      updateThemeComboBadge(combo, '');
      clearBtn.classList.add('hidden');
      close();
      input.focus();
    });

    list.addEventListener('mousedown', (e) => e.preventDefault());
    list.addEventListener('click', (e) => {
      const opt = e.target.closest('.dp-combo__option');
      if (!opt || opt.classList.contains('dp-combo__empty')) return;
      selectComboOption(combo, opt);
    });
  }

  function bindFormCombos(form) {
    form.querySelectorAll('[data-dp-combo]').forEach(bindCombo);
    modalRoot()?.addEventListener('click', (e) => {
      if (!e.target.closest('.dp-combo')) {
        modalRoot()?.querySelectorAll('.dp-combo.is-open').forEach(closeCombo);
      }
    });
  }

  function filterThemeCheckboxLabels(container, query) {
    container?.querySelectorAll('[data-dp-theme-item]').forEach((label) => {
      const text = label.dataset.dpThemeText || label.textContent;
      label.classList.toggle('dp-filter-hidden', !matchesSearch(text, query));
    });
  }

  function findSpeakerByName(name) {
    const n = text(name);
    if (!n) return null;
    const key = normalizeSearch(n);
    return speakers.find((s) => normalizeSearch(s.full_name) === key) || null;
  }

  function findCongregationByName(name) {
    const n = text(name);
    if (!n) return null;
    const key = normalizeSearch(n);
    return congregations.find((c) => c.is_active !== false && normalizeSearch(c.name) === key) || null;
  }

  function resolveThemeId({ themeId, themeTitle }) {
    if (themeId) return themeId;
    const title = text(themeTitle);
    if (!title) return null;

    const numMatch = title.match(/(?:esbo[cç]o\s*)?#?\s*(\d{1,3})\b/i);
    if (numMatch) {
      const byNum = themes.find((t) => t.outline_number === Number(numMatch[1]));
      if (byNum) return byNum.id;
    }

    const key = normalizeSearch(title);
    const exact = themes.find((t) => normalizeSearch(t.title) === key);
    if (exact) return exact.id;

    const partial = themes.find((t) => {
      const label = normalizeSearch(`${t.outline_number} ${t.title}`);
      return label.includes(key) || key.includes(normalizeSearch(t.title));
    });
    return partial?.id || null;
  }

  async function ensureCongregationId(congregationId, congregationName) {
    if (congregationId) return congregationId;
    const name = text(congregationName);
    if (!name) return null;
    const existing = findCongregationByName(name);
    if (existing) return existing.id;
    const { data, error } = await client.from('speech_congregations').insert({ name }).select('id').single();
    if (error) throw error;
    return data.id;
  }

  async function ensureSpeakerFromAssignment({ speakerId, speakerName, congregationId, congregationName }) {
    if (speakerId) return speakerId;
    const name = text(speakerName);
    if (!name) return null;

    const existing = findSpeakerByName(name);
    if (existing) return existing.id;

    const congId = await ensureCongregationId(congregationId, congregationName);
    const congName = congregationName || getCongregation(congId)?.name || '';
    const { data, error } = await client.from('speech_speakers').insert({
      full_name: name,
      congregation_id: congId,
      privilege: 'anciao',
      is_local: normalizeSearch(congName) === normalizeSearch('Jardim Elizabeth'),
      is_active: true
    }).select('id').single();
    if (error) throw error;
    return data.id;
  }

  async function ensureSpeakerThemeLink(speakerId, themeId) {
    if (!speakerId || !themeId) return;
    const speaker = getSpeaker(speakerId);
    const linked = (speaker?.speech_speaker_themes || []).some((row) => row.theme_id === themeId);
    if (linked) return;
    const { error } = await client.from('speech_speaker_themes').insert({ speaker_id: speakerId, theme_id: themeId });
    if (error && error.code !== '23505') throw error;
  }

  async function saveAssignmentFromForm(form, existing) {
    const v = Object.fromEntries(new FormData(form));
    let speakerId = v.speaker_id || null;
    let themeId = v.theme_id || null;
    let s = getSpeaker(speakerId);
    let t = getTheme(themeId);
    let c = getCongregation(v.congregation_id);

    const speakerName = text(v.speaker_name) || s?.full_name || null;
    const themeTitle = text(v.theme_title) || t?.title || null;
    const congregationName = text(v.congregation_name) || c?.name || null;
    const congregationId = await ensureCongregationId(v.congregation_id || null, congregationName);

    speakerId = await ensureSpeakerFromAssignment({
      speakerId,
      speakerName,
      congregationId,
      congregationName
    });
    s = speakerId ? (getSpeaker(speakerId) || { full_name: speakerName }) : s;

    themeId = resolveThemeId({ themeId, themeTitle });
    t = getTheme(themeId) || t;

    if (speakerId && themeId) {
      await ensureSpeakerThemeLink(speakerId, themeId);
    }

    const payload = {
      direction: v.direction,
      event_date: v.event_date,
      event_time: v.event_time || null,
      speaker_id: speakerId,
      speaker_name: speakerName || s?.full_name || null,
      theme_id: themeId,
      theme_title: t?.title || themeTitle || null,
      outline_number: t?.outline_number || null,
      congregation_id: congregationId,
      congregation_name: congregationName || getCongregation(congregationId)?.name || null,
      opening_song: text(v.opening_song) || null,
      modality: v.modality,
      confirmation_status: v.confirmation_status,
      notes: text(v.notes) || null
    };

    const q = existing
      ? client.from('speech_assignments').update(payload).eq('id', existing.id)
      : client.from('speech_assignments').insert(payload);
    const { error } = await q;
    if (error) throw error;
  }

  function openAssignmentModal(existing) {
    const a = existing || { direction: 'receive', event_date: today(), modality: 'presencial', confirmation_status: 'pendente' };
    openModal(`${existing ? 'Editar' : 'Nova'} designação`, `
      <form class="dp-form" data-dp-assignment-form>
        <label>Direção<select name="direction">${option('receive', 'Recebemos', a.direction)}${option('send', 'Enviamos', a.direction)}</select></label>
        <label>Data<input required name="event_date" type="date" value="${escapeHtml(a.event_date || '')}"></label>
        <label>Horário<input name="event_time" type="time" value="${escapeHtml((a.event_time || '').slice(0, 5))}"></label>
        ${comboFieldHtml('speaker', a, { label: 'Orador' })}
        ${comboFieldHtml('theme', a, { label: 'Tema', span2: true })}
        ${comboFieldHtml('congregation', a, { label: 'Congregação' })}
        <label>Cântico inicial<input name="opening_song" value="${escapeHtml(a.opening_song || '')}"></label>
        <label>Modalidade<select name="modality">${option('presencial', 'Presencial', a.modality)}${option('online', 'Online', a.modality)}</select></label>
        <label>Status<select name="confirmation_status">${Object.entries(STATUS).map(([k, v]) => option(k, v, a.confirmation_status)).join('')}</select></label>
        <label class="dp-span-2">Observações<textarea name="notes" rows="3">${escapeHtml(a.notes || '')}</textarea></label>
        <footer><button type="button" data-dp-close>Cancelar</button><button class="btn-primary">Salvar</button></footer>
      </form>`);
    const form = modalRoot()?.querySelector('[data-dp-assignment-form]');
    if (!form) return;
    bindFormCombos(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await saveAssignmentFromForm(form, existing);
        closeModal();
        await loadData();
        refresh();
        toast('Designação salva.');
      } catch (err) {
        toast(errorText(err), true);
      }
    });
  }

  function bindAssignmentActions(scope) {
    scope.querySelector('[data-dp-new]')?.addEventListener('click', () => openAssignmentModal());
    scope.querySelectorAll('[data-dp-edit]').forEach((row) => row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return; openAssignmentModal(assignments.find((a) => a.id === row.dataset.dpEdit));
    }));
    scope.querySelectorAll('[data-dp-delete]').forEach((button) => button.addEventListener('click', async () => {
      const a = assignments.find((x) => x.id === button.dataset.dpDelete);
      if (!await confirmDialog('Excluir designação', `Excluir a designação de ${a?.speaker_name || 'orador'}?`)) return;
      const { error } = await client.from('speech_assignments').delete().eq('id', button.dataset.dpDelete);
      if (error) return toast(errorText(error), true); await loadData(); refresh(); toast('Designação excluída.');
    }));
    scope.querySelectorAll('[data-dp-wa]').forEach((button) => button.addEventListener('click', () => openWhatsapp([assignments.find((a) => a.id === button.dataset.dpWa)])));
    scope.querySelector('[data-dp-wa-range]')?.addEventListener('click', () => {
      const start = new Date(); start.setDate(start.getDate() - start.getDay()); const end = new Date(start); end.setDate(end.getDate() + 6);
      openWhatsapp(assignments.filter((a) => a.event_date >= start.toISOString().slice(0, 10) && a.event_date <= end.toISOString().slice(0, 10)));
    });
  }

  function whatsappText(a) {
    return `*DISCURSO PÚBLICO*\n*Data:* ${dateText(a.event_date)}\n*Horário:* ${a.event_time?.slice(0, 5) || '—'}\n*Direção:* ${DIRECTION[a.direction]}\n*Orador:* ${a.speaker_name || '—'}\n*Tema:* ${assignmentTheme(a)}\n*Congregação:* ${a.congregation_name || '—'}\n*Cântico:* ${a.opening_song || '—'}\n*Modalidade:* ${a.modality === 'online' ? 'Online' : 'Presencial'}\n*Status:* ${STATUS[a.confirmation_status]}`;
  }
  function openWhatsapp(rows) {
    const message = rows.filter(Boolean).sort((a, b) => a.event_date.localeCompare(b.event_date)).map(whatsappText).join('\n\n');
    openModal('Mensagem para WhatsApp', `<div class="dp-whatsapp"><textarea readonly rows="16">${escapeHtml(message || 'Nenhuma designação nesta semana.')}</textarea><footer><button type="button" data-dp-copy>Copiar mensagem</button><button type="button" data-dp-close>Fechar</button></footer></div>`);
    document.querySelector('[data-dp-copy]')?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(message); toast('Mensagem copiada.'); } catch { toast('Não foi possível copiar automaticamente.', true); }
    });
  }

  function speakersTable(rows) {
    if (!rows.length) return empty('Nenhum orador encontrado.');
    return `<div class="terr-table-wrap"><table class="terr-catalog-table dp-table dp-table-speakers"><colgroup>
      <col class="dp-sp-col-name"/><col class="dp-sp-col-congregation"/><col class="dp-sp-col-privilege"/><col class="dp-sp-col-phone"/><col class="dp-sp-col-email"/><col class="dp-sp-col-themes"/><col class="dp-sp-col-actions"/>
    </colgroup><thead><tr><th>Nome</th><th>Congregação</th><th>Privilégio</th><th>Telefone</th><th>E-mail</th><th>Temas</th><th></th></tr></thead><tbody>${rows.map((s) => {
      const congregation = s.speech_congregations?.name || '—';
      const email = s.email || '—';
      const name = `${s.full_name}${s.is_local ? ' (local)' : ''}`;
      return `<tr>
        <td class="dp-cell-truncate dp-cell-name" title="${escapeHtml(name)}">${escapeHtml(s.full_name)}${s.is_local ? ' <small>Local</small>' : ''}</td>
        <td class="dp-cell-truncate" title="${escapeHtml(congregation)}">${escapeHtml(congregation)}</td>
        <td class="dp-cell-truncate" title="${escapeHtml(PRIVILEGE[s.privilege] || '')}">${PRIVILEGE[s.privilege]}</td>
        <td class="dp-cell-nowrap">${escapeHtml(s.phone || '—')}</td>
        <td class="dp-cell-truncate dp-cell-email" title="${escapeHtml(email)}">${escapeHtml(email)}</td>
        <td class="dp-cell-center">${s.speech_speaker_themes?.length || 0}</td>
        <td class="dp-actions"><button type="button" data-dp-speaker-edit="${s.id}">Editar</button></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function speakerStatsHtml() {
    const count = (fn) => speakers.filter(fn).length;
    return `<article><strong>${speakers.length}</strong><span>Total</span></article><article><strong>${count((s) => s.is_local)}</strong><span>Locais</span></article><article><strong>${count((s) => s.privilege === 'anciao')}</strong><span>Anciãos</span></article><article><strong>${count((s) => s.privilege === 'servo_ministerial')}</strong><span>Servos</span></article>`;
  }

  function bindSpeakerListActions(host) {
    host.querySelectorAll('[data-dp-speaker-edit]').forEach((b) => b.addEventListener('click', () => openSpeakerModal(getSpeaker(b.dataset.dpSpeakerEdit))));
  }

  function renderSpeakers() {
    const host = $('#dp-panel-oradores');
    if (!host) return;
    const q = host.dataset.query || '';
    const rows = speakers
      .filter((s) => matchesSearch(`${s.full_name} ${s.phone} ${s.email}`, q))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'));
    const listHtml = rows.length ? speakersTable(rows) : empty('Nenhum orador encontrado.');

    if (!host.querySelector('[data-dp-speaker-search]')) {
      host.innerHTML = `
        <div class="terr-catalog-stats dp-stats" data-dp-speaker-stats></div>
        <div class="terr-catalog-card">
          <div class="terr-sched-toolbar">
            <input data-dp-speaker-search type="search" placeholder="Buscar orador" aria-label="Buscar orador">
            <button class="btn-primary" type="button" data-dp-speaker-new>Novo orador</button>
          </div>
          <div data-dp-speaker-list></div>
        </div>`;
      host.querySelector('[data-dp-speaker-search]').addEventListener('input', (e) => {
        host.dataset.query = e.target.value;
        renderSpeakers();
      });
      host.querySelector('[data-dp-speaker-new]').addEventListener('click', () => openSpeakerModal());
    }

    host.querySelector('[data-dp-speaker-stats]').innerHTML = speakerStatsHtml();
    const searchInput = host.querySelector('[data-dp-speaker-search]');
    if (document.activeElement !== searchInput) searchInput.value = q;
    host.querySelector('[data-dp-speaker-list]').innerHTML = listHtml;
    bindSpeakerListActions(host);
  }

  function openSpeakerModal(existing) {
    const s = existing || { privilege: 'anciao', is_local: true, is_active: true };
    const selected = new Set((s.speech_speaker_themes || []).map((x) => x.theme_id));
    const congregationValue = { congregation_id: s.congregation_id, congregation_name: s.speech_congregations?.name || '' };
    openModal(`${existing ? 'Editar' : 'Novo'} orador`, `<form class="dp-form" data-dp-speaker-form>
      <label class="dp-span-2">Nome completo<input required name="full_name" value="${escapeHtml(s.full_name || '')}"></label>
      ${comboFieldHtml('congregation', congregationValue, { label: 'Congregação' })}
      <label>Telefone<input name="phone" value="${escapeHtml(s.phone || '')}"></label><label>E-mail<input name="email" value="${escapeHtml(s.email || '')}"></label>
      <label>Privilégio<select name="privilege">${Object.entries(PRIVILEGE).map(([k, v]) => option(k, v, s.privilege)).join('')}</select></label>
      <label><input name="is_local" type="checkbox"${s.is_local ? ' checked' : ''}> Orador local</label><label><input name="is_active" type="checkbox"${s.is_active ? ' checked' : ''}> Ativo</label>
      <label class="dp-span-2">Observações<textarea name="notes" rows="2">${escapeHtml(s.notes || '')}</textarea></label>
      <div class="dp-span-2"><label>Temas preparados</label><input data-dp-theme-search type="search" placeholder="Filtrar por número ou título…"><div class="dp-theme-checks" data-dp-theme-checks>${themeCheckboxes(selected)}</div></div>
      <footer><button type="button" data-dp-close>Cancelar</button><button class="btn-primary">Salvar</button></footer></form>`);
    const form = modalRoot()?.querySelector('[data-dp-speaker-form]');
    if (!form) return;
    bindFormCombos(form);
    const themeChecks = form.querySelector('[data-dp-theme-checks]');
    form.querySelector('[data-dp-theme-search]')?.addEventListener('input', (e) => {
      filterThemeCheckboxLabels(themeChecks, e.target.value);
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); const v = Object.fromEntries(new FormData(form));
      let congregationId;
      try {
        congregationId = await ensureCongregationId(v.congregation_id || null, v.congregation_name);
      } catch (err) {
        return toast(errorText(err), true);
      }
      const payload = { full_name: text(v.full_name), congregation_id: congregationId, phone: text(v.phone) || null, email: text(v.email) || null, privilege: v.privilege, is_local: form.is_local.checked, is_active: form.is_active.checked, notes: text(v.notes) || null };
      const result = existing ? await client.from('speech_speakers').update(payload).eq('id', existing.id).select().single() : await client.from('speech_speakers').insert(payload).select().single();
      if (result.error) return toast(errorText(result.error), true);
      const ids = [...form.querySelectorAll('input[name="theme_ids"]:checked')].map((x) => x.value);
      const { error: deleteError } = await client.from('speech_speaker_themes').delete().eq('speaker_id', result.data.id);
      if (deleteError) return toast(errorText(deleteError), true);
      if (ids.length) { const { error } = await client.from('speech_speaker_themes').insert(ids.map((theme_id) => ({ speaker_id: result.data.id, theme_id }))); if (error) return toast(errorText(error), true); }
      closeModal(); await loadData(); refresh(); toast('Orador salvo.');
    });
  }
  function themeCheckboxes(selected) {
    return themes.filter((t) => t.is_active).map((t) => {
      const label = `${t.outline_number} — ${t.title}`;
      return `<label data-dp-theme-item data-dp-theme-text="${escapeHtml(label)}"><input type="checkbox" name="theme_ids" value="${t.id}"${selected.has(t.id) ? ' checked' : ''}> ${t.outline_number} — ${escapeHtml(t.title)}</label>`;
    }).join('');
  }

  function speakersForTheme(themeId) {
    return speakers.filter((s) => s.is_active !== false && (s.speech_speaker_themes || []).some((x) => x.theme_id === themeId));
  }

  function openThemeDetail(themeId) {
    const theme = getTheme(themeId);
    if (!theme) return;
    const list = speakersForTheme(themeId);
    openModal(`Esboço ${theme.outline_number}`, `
      <div class="dp-theme-detail">
        <p class="dp-theme-detail__title">${escapeHtml(theme.title)}</p>
        <p class="dp-theme-detail__meta">S-34 · ${list.length ? `${list.length} orador${list.length === 1 ? '' : 'es'} preparado${list.length === 1 ? '' : 's'}` : 'Nenhum orador preparado'}</p>
        ${list.length ? `<ul class="dp-theme-detail__speakers">${list.map((s) => `<li>
          <div><strong>${escapeHtml(s.full_name)}</strong><span>${escapeHtml(s.speech_congregations?.name || (s.is_local ? 'Local' : '—'))}</span></div>
          <button type="button" data-dp-theme-speaker="${s.id}">Ver orador</button>
        </li>`).join('')}</ul>` : `<p class="dp-theme-detail__empty">Marque este esboço nos temas preparados do orador.</p>`}
      </div>`);
    document.querySelectorAll('[data-dp-theme-speaker]').forEach((btn) => btn.addEventListener('click', () => {
      closeModal();
      selectTab('oradores');
      const speaker = getSpeaker(btn.dataset.dpThemeSpeaker);
      if (speaker) openSpeakerModal(speaker);
    }));
  }

  function renderThemes() {
    const host = $('#dp-panel-temas');
    if (!host) return;
    const q = host.dataset.query || '';
    const filter = host.dataset.filter || 'all';
    const preparedCount = (id) => speakersForTheme(id).length;
    const withPrep = themes.filter((t) => preparedCount(t.id) > 0).length;
    const bare = themes.length - withPrep;
    let rows = themes
      .filter((t) => `${t.outline_number} ${t.title}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => a.outline_number - b.outline_number);
    if (filter === 'prepared') rows = rows.filter((t) => preparedCount(t.id) > 0);
    if (filter === 'bare') rows = rows.filter((t) => preparedCount(t.id) === 0);

    const keepFocus = document.activeElement?.matches?.('[data-dp-themes-search]');
    const caret = keepFocus ? document.activeElement.selectionStart : null;

    host.innerHTML = `
      <div class="dp-themes">
        <div class="dp-themes-bar">
          <label class="dp-themes-search">
            <span class="material-symbols-outlined" aria-hidden="true">search</span>
            <input data-dp-themes-search type="search" placeholder="Nº ou título…" value="${escapeHtml(q)}" aria-label="Buscar temas">
          </label>
          <div class="dp-themes-chips" role="group" aria-label="Filtro de temas">
            ${[['all', `Todos · ${themes.length}`], ['prepared', `Com orador · ${withPrep}`], ['bare', `Sem orador · ${bare}`]]
              .map(([id, label]) => `<button type="button" class="dp-themes-chip${filter === id ? ' is-on' : ''}" data-dp-themes-filter="${id}">${label}</button>`).join('')}
          </div>
        </div>
        <div class="dp-themes-meta"><span>Catálogo S-34</span><span>${rows.length} exibido${rows.length === 1 ? '' : 's'}</span></div>
        ${rows.length ? `<div class="dp-themes-list" role="list">${rows.map((t) => {
          const n = preparedCount(t.id);
          return `<button type="button" class="dp-theme-row" role="listitem" data-dp-theme-id="${t.id}" title="Ver oradores">
            <span class="dp-theme-num">${t.outline_number}</span>
            <span class="dp-theme-title">${escapeHtml(t.title)}</span>
            <span class="dp-theme-prep${n ? ' has' : ''}" aria-label="${n} preparados">${n || '—'}</span>
          </button>`;
        }).join('')}</div>` : empty('Nenhum tema encontrado.')}
      </div>`;

    const input = host.querySelector('[data-dp-themes-search]');
    input.addEventListener('input', (e) => { host.dataset.query = e.target.value; renderThemes(); });
    if (keepFocus) {
      input.focus();
      if (caret != null) input.setSelectionRange(caret, caret);
    }
    host.querySelectorAll('[data-dp-themes-filter]').forEach((btn) => btn.addEventListener('click', () => {
      host.dataset.filter = btn.dataset.dpThemesFilter;
      renderThemes();
    }));
    host.querySelectorAll('[data-dp-theme-id]').forEach((btn) => btn.addEventListener('click', () => openThemeDetail(btn.dataset.dpThemeId)));
  }

  function selectTab(tab) {
    root.querySelectorAll('[data-dp-tab]').forEach((b) => b.classList.toggle('active', b.dataset.dpTab === tab));
    root.querySelectorAll('.terr-panel').forEach((p) => p.classList.toggle('active', p.id === `dp-panel-${tab}`));
    const renderers = { agenda: renderAgenda, oradores: renderSpeakers, temas: renderThemes };
    if (!rendered[tab] && renderers[tab]) {
      renderers[tab]();
      rendered[tab] = true;
    }
  }
  function refresh() {
    const renderers = { agenda: renderAgenda, oradores: renderSpeakers, temas: renderThemes };
    Object.keys(rendered).forEach((tab) => {
      if (rendered[tab] && renderers[tab]) renderers[tab]();
    });
  }

  function openModal(title, body) {
    closeModal();
    document.body.insertAdjacentHTML('beforeend', `<div class="dp-modal" role="dialog" aria-modal="true"><div class="dp-modal__card"><header><h2>${escapeHtml(title)}</h2><button type="button" data-dp-close aria-label="Fechar">×</button></header>${body}</div></div>`);
    document.querySelectorAll('[data-dp-close]').forEach((b) => b.addEventListener('click', closeModal));
  }
  function closeModal() { document.querySelector('.dp-modal')?.remove(); }
  async function confirmDialog(title, message) {
    if (window.JEDialog?.confirm) return window.JEDialog.confirm({ title, message, confirmLabel: 'Excluir', danger: true });
    return window.confirm(message);
  }

  async function loadData() {
    const [themeRes, speakerRes, congregationRes, assignmentRes] = await Promise.all([
      client.from('speech_themes').select('*').order('outline_number'),
      client.from('speech_speakers').select('*, speech_congregations(name), speech_speaker_themes(theme_id)').order('full_name'),
      client.from('speech_congregations').select('*').order('name'),
      client.from('speech_assignments').select('*, speech_speakers(full_name, phone), speech_themes(outline_number, title), speech_congregations(name)').order('event_date')
    ]);
    const failure = [themeRes, speakerRes, congregationRes, assignmentRes].find((x) => x.error);
    if (failure) throw failure.error;
    themes = themeRes.data || []; speakers = speakerRes.data || []; congregations = congregationRes.data || []; assignments = assignmentRes.data || [];
  }

  async function init() {
    if (window.__JEAdminDiscursosInit) return true;
    const profile = await guardPermission('public_speeches');
    if (!profile) return false;
    root = document.getElementById('hub-view-discursos') || document.body;
    toastEl = document.getElementById('hub-admin-toast');
    client = await getClient();
    layout();
    root.querySelectorAll('[data-dp-tab]').forEach((button) => button.addEventListener('click', () => selectTab(button.dataset.dpTab)));
    window.__JEAdminDiscursosInit = true;
    try {
      await loadData();
      renderAgenda();
      rendered.agenda = true;
    } catch (err) {
      console.error('Discursos Públicos:', err);
      toast(errorText(err), true);
      const host = $('#dp-panel-agenda');
      if (host) {
        host.innerHTML = `<div class="terr-empty-state dp-empty"><p>${escapeHtml(errorText(err))}</p><p class="text-sm mt-2">Aplique a migration <code>20260710220000_speech_crm_system</code> e o seed dos temas S-34.</p></div>`;
      }
    }
    return true;
  }

  window.JEAdminDiscursos = { init };
  if (!window.JEHubRouter && document.getElementById('hub-view-discursos')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  }
})();
