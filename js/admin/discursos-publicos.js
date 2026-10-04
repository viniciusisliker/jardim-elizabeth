(function () {
  const { guardPermission, getClient, showToast, escapeHtml } = window.JEAdmin;
  const DIRECTION = { receive: 'Recebemos', send: 'Enviamos' };
  const PRIVILEGE = { anciao: 'Ancião', servo_ministerial: 'Servo Ministerial' };
  const STATUS = { pendente: 'Pendente', confirmado: 'Confirmado', cancelado: 'Cancelado' };
  let client, root, toastEl, themes = [], speakers = [], congregations = [], assignments = [], exchanges = [];
  let exchangeAvailable = false;
  const rendered = {};

  const $ = (selector) => root?.querySelector(selector);
  const text = (v) => String(v ?? '').trim();
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
            ${[['agenda', 'Agenda', 'calendar_month'], ['intercambio', 'Intercâmbio', 'handshake'], ['oradores', 'Oradores', 'groups'], ['temas', 'Temas', 'menu_book']]
              .map(([id, label, icon], i) => `<button type="button" class="terr-tab${i ? '' : ' active'}" data-dp-tab="${id}" role="tab" title="${label}" aria-label="${label}">
                <span class="material-symbols-outlined" aria-hidden="true">${icon}</span>
                <span class="terr-tab-label">${label}</span>
              </button>`).join('')}
          </nav>
        </div>
      </div>
      <section id="dp-panel-agenda" class="terr-panel active"></section>
      <section id="dp-panel-intercambio" class="terr-panel"></section>
      <section id="dp-panel-oradores" class="terr-panel"></section>
      <section id="dp-panel-temas" class="terr-panel"></section>`;
  }

  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const EXCHANGE_STATUS = { a_combinar: 'A combinar', aguardando: 'Aguardando', fechado: 'Fechado', cancelado: 'Cancelado' };
  const REPEAT_WINDOW_DAYS = 365;

  const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const localToday = () => isoOf(new Date());
  const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
  const shiftMonth = (ym, delta) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); return isoOf(d).slice(0, 7); };
  const shortDate = (iso) => { const d = new Date(`${iso}T12:00:00`); return `${WEEKDAYS[d.getDay()]} ${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 864e5);
  const speakerKey = (a) => a.speaker_id || normalizeSearch(text(a.speaker_name));

  // Mesmo critério do quadro (weekend-discursos-sync): discurso de domingo pertence ao sábado anterior.
  function weekendOf(iso) {
    const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -1 : 6 - day));
    return isoOf(d);
  }

  function saturdaysOf(ym) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1, 1, 12);
    while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
    const out = [];
    while (d.getMonth() === m - 1) { out.push(isoOf(d)); d.setDate(d.getDate() + 7); }
    return out;
  }

  function phoneDigits(phone) {
    let d = String(phone || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length <= 9) d = `11${d}`;
    if (d.length <= 11) d = `55${d}`;
    return d;
  }

  function relativeDays(iso) {
    const n = daysBetween(localToday(), iso);
    if (n === 0) return 'hoje';
    if (n === 1) return 'amanhã';
    if (n === -1) return 'ontem';
    if (n > 0) return n < 14 ? `em ${n} dias` : `em ${Math.round(n / 7)} semanas`;
    const k = -n;
    if (k < 60) return `há ${Math.round(k / 7) || 1} sem.`;
    if (k < 730) return `há ${Math.round(k / 30)} meses`;
    return `há ${Math.round(k / 365)} anos`;
  }

  // Discursos feitos no nosso salão (recebidos, não cancelados), por esboço.
  function hallHistoryByOutline() {
    const map = {};
    assignments.forEach((a) => {
      if (a.direction !== 'receive' || a.confirmation_status === 'cancelado' || !a.outline_number) return;
      (map[a.outline_number] = map[a.outline_number] || []).push(a);
    });
    Object.values(map).forEach((list) => list.sort((x, y) => x.event_date.localeCompare(y.event_date)));
    return map;
  }

  function assignmentAlerts(a, weekendRows, history) {
    const alerts = [];
    if (a.confirmation_status === 'cancelado') return alerts;
    if (a.direction === 'receive' && a.outline_number) {
      const near = (history[a.outline_number] || [])
        .filter((o) => o.id !== a.id && Math.abs(daysBetween(o.event_date, a.event_date)) < REPEAT_WINDOW_DAYS);
      if (near.length) alerts.push(`Esboço ${a.outline_number} também em ${near.map((o) => dateText(o.event_date)).join(', ')}`);
    }
    const key = speakerKey(a);
    if (key && weekendRows.some((o) => o.id !== a.id && o.confirmation_status !== 'cancelado' && speakerKey(o) === key)) {
      alerts.push(`${text(a.speaker_name) || 'Orador'} está em mais de uma designação neste fim de semana`);
    }
    if (!text(a.speaker_name)) alerts.push('Sem orador definido');
    if (!a.outline_number && !text(a.theme_title)) alerts.push('Sem tema definido');
    return alerts;
  }

  function statusChip(a) {
    const s = a.confirmation_status;
    if (s === 'cancelado') return `<span class="dp-chip dp-chip--cancelado">Cancelado</span>`;
    const next = s === 'confirmado' ? 'pendente' : 'confirmado';
    return `<button type="button" class="dp-chip dp-chip--${s}" data-dp-status="${a.id}" data-next="${next}" title="Toque para marcar como ${STATUS[next].toLowerCase()}">
      <span class="material-symbols-outlined" aria-hidden="true">${s === 'confirmado' ? 'check_circle' : 'schedule'}</span>${STATUS[s]}</button>`;
  }

  function outlineBadge(a) {
    if (a.outline_number) return `<span class="dp-wk-num">${a.outline_number}</span>`;
    return `<span class="dp-wk-num dp-wk-num--text">${text(a.theme_title) ? 'DE' : '—'}</span>`;
  }

  function receiveBlock(a, weekendRows, history) {
    const theme = a.theme_title || a.speech_themes?.title || '';
    const cong = a.congregation_name || a.speech_congregations?.name || '';
    const alerts = assignmentAlerts(a, weekendRows, history);
    return `<div class="dp-wk-receive${a.confirmation_status === 'cancelado' ? ' is-cancelled' : ''}" data-dp-edit="${a.id}" role="button" tabindex="0">
      ${outlineBadge(a)}
      <div class="dp-wk-body">
        <p class="dp-wk-theme">${escapeHtml(theme || 'Tema não definido')}</p>
        <p class="dp-wk-who"><strong>${escapeHtml(a.speaker_name || 'Orador não definido')}</strong>${cong ? ` · ${escapeHtml(cong)}` : ''}${a.event_time ? ` · ${escapeHtml(a.event_time.slice(0, 5))}` : ''}</p>
        ${alerts.map((m) => `<p class="dp-wk-alert"><span class="material-symbols-outlined" aria-hidden="true">warning</span>${escapeHtml(m)}</p>`).join('')}
        <div class="dp-wk-actions">${statusChip(a)}</div>
      </div>
    </div>`;
  }

  function sendRow(a, weekendRows, history) {
    const cong = a.congregation_name || a.speech_congregations?.name || '—';
    const alerts = assignmentAlerts(a, weekendRows, history);
    const outline = a.outline_number ? `nº ${a.outline_number}` : (text(a.theme_title) ? 'DE' : '');
    return `<li class="dp-wk-send${a.confirmation_status === 'cancelado' ? ' is-cancelled' : ''}" data-dp-edit="${a.id}" role="button" tabindex="0">
      <div class="dp-wk-send__main">
        <p><strong>${escapeHtml(a.speaker_name || 'Orador não definido')}</strong> <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span> ${escapeHtml(cong)}</p>
        <p class="dp-wk-send__meta">${escapeHtml(shortDate(a.event_date))}${a.event_time ? ` · ${escapeHtml(a.event_time.slice(0, 5))}` : ''}${outline ? ` · ${escapeHtml(outline)}` : ''}${a.theme_title ? ` · ${escapeHtml(a.theme_title)}` : ''}</p>
        ${alerts.map((m) => `<p class="dp-wk-alert"><span class="material-symbols-outlined" aria-hidden="true">warning</span>${escapeHtml(m)}</p>`).join('')}
      </div>
      ${statusChip(a)}
    </li>`;
  }

  function weekendCard(sat, rows, history, onlyPending) {
    const receive = rows.filter((a) => a.direction === 'receive');
    const send = rows.filter((a) => a.direction === 'send');
    const current = weekendOf(localToday());
    const isPast = sat < current;
    const isNow = sat === current;
    const satDate = new Date(`${sat}T12:00:00`);
    const visibleReceive = onlyPending ? receive.filter((a) => a.confirmation_status === 'pendente') : receive;
    const visibleSend = onlyPending ? send.filter((a) => a.confirmation_status === 'pendente') : send;
    if (onlyPending && !visibleReceive.length && !visibleSend.length && receive.length) return '';
    return `<article class="dp-wk${isPast ? ' is-past' : ''}${isNow ? ' is-now' : ''}" data-dp-weekend="${sat}">
      <header class="dp-wk-head">
        <div class="dp-wk-date"><span class="dp-wk-day">${satDate.getDate()}</span><span class="dp-wk-month">${MONTHS[satDate.getMonth()].slice(0, 3)}</span></div>
        <div class="dp-wk-head-text"><strong>Sábado</strong><span>${isNow ? 'Este fim de semana' : escapeHtml(relativeDays(sat))}</span></div>
        ${rows.length ? `<button type="button" class="dp-icon-btn" data-dp-wa-weekend="${sat}" title="Mensagem de WhatsApp deste fim de semana" aria-label="WhatsApp deste fim de semana"><span class="material-symbols-outlined">share</span></button>` : ''}
      </header>
      <section class="dp-wk-lane">
        <h4><span class="material-symbols-outlined" aria-hidden="true">home</span>No nosso salão</h4>
        ${receive.length
          ? visibleReceive.map((a) => receiveBlock(a, rows, history)).join('')
          : `<button type="button" class="dp-wk-empty" data-dp-new-at="${sat}" data-direction="receive"><span class="material-symbols-outlined" aria-hidden="true">add_circle</span>Sem orador · adicionar</button>`}
      </section>
      <section class="dp-wk-lane dp-wk-lane--send">
        <h4><span class="material-symbols-outlined" aria-hidden="true">directions_car</span>Saindo${send.length ? ` · ${send.length}` : ''}</h4>
        ${visibleSend.length ? `<ul class="dp-wk-send-list">${visibleSend.map((a) => sendRow(a, rows, history)).join('')}</ul>` : ''}
        <button type="button" class="dp-wk-add" data-dp-new-at="${sat}" data-direction="send"><span class="material-symbols-outlined" aria-hidden="true">add</span>Enviar orador</button>
      </section>
    </article>`;
  }

  function nextSpeechHtml() {
    const t = localToday();
    const next = assignments
      .filter((a) => a.direction === 'receive' && a.confirmation_status !== 'cancelado' && a.event_date >= t)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))[0];
    if (!next) return '';
    const cong = next.congregation_name || next.speech_congregations?.name || '';
    return `<button type="button" class="dp-next" data-dp-edit="${next.id}">
      <span class="dp-next__num">${next.outline_number || 'DE'}</span>
      <span class="dp-next__body">
        <span class="dp-next__when">Próximo discurso · ${escapeHtml(shortDate(next.event_date))} · ${escapeHtml(relativeDays(next.event_date))}</span>
        <span class="dp-next__theme">${escapeHtml(next.theme_title || 'Tema não definido')}</span>
        <span class="dp-next__who">${escapeHtml(next.speaker_name || 'Orador não definido')}${cong ? ` · ${escapeHtml(cong)}` : ''}</span>
      </span>
    </button>`;
  }

  function exchangeForMonth(ym) {
    return exchanges.filter((x) => String(x.reference_month).slice(0, 7) === ym);
  }

  function exchangeCard(x, compact) {
    const phone = phoneDigits(x.coordinator_phone);
    return `<div class="dp-ex${compact ? ' dp-ex--compact' : ''} dp-ex--${x.status}" data-dp-ex-edit="${x.id}" role="button" tabindex="0">
      <div class="dp-ex__main">
        <p class="dp-ex__cong">${escapeHtml(x.congregation_name || 'Congregação não definida')}${x.region ? ` <small>${escapeHtml(x.region)}</small>` : ''}</p>
        <p class="dp-ex__coord">${x.coordinator_name ? `Coordenador: <strong>${escapeHtml(x.coordinator_name)}</strong>` : 'Sem coordenador'}${x.coordinator_phone ? ` · ${escapeHtml(x.coordinator_phone)}` : ''}</p>
        ${x.sent_note ? `<p class="dp-ex__sent"><span class="material-symbols-outlined" aria-hidden="true">sync_alt</span>Enviamos: ${escapeHtml(x.sent_note)}</p>` : ''}
        ${x.notes ? `<p class="dp-ex__notes">${escapeHtml(x.notes)}</p>` : ''}
      </div>
      <div class="dp-ex__side">
        <span class="dp-chip dp-chip--ex-${x.status}">${EXCHANGE_STATUS[x.status] || x.status}</span>
        ${phone ? `<a class="dp-icon-btn" href="https://wa.me/${phone}" target="_blank" rel="noopener" data-dp-stop title="WhatsApp do coordenador" aria-label="WhatsApp do coordenador"><span class="material-symbols-outlined">chat</span></a>` : ''}
      </div>
    </div>`;
  }

  function exchangeMonthHtml(ym) {
    if (!exchangeAvailable) return '';
    const list = exchangeForMonth(ym);
    return `<section class="dp-ex-month">
      <div class="dp-ex-month__head"><h3><span class="material-symbols-outlined" aria-hidden="true">handshake</span>Intercâmbio do mês</h3>
        <button type="button" class="dp-link-btn" data-dp-ex-new="${ym}">${list.length ? 'Adicionar' : 'Definir'}</button></div>
      ${list.length ? list.map((x) => exchangeCard(x, true)).join('') : '<p class="dp-ex-month__empty">Nenhuma congregação parceira definida para este mês.</p>'}
    </section>`;
  }

  function renderAgenda() {
    const host = $('#dp-panel-agenda');
    if (!host) return;
    const month = host.dataset.month || localToday().slice(0, 7);
    const onlyPending = host.dataset.pending === '1';
    const history = hallHistoryByOutline();
    const sats = new Set(saturdaysOf(month));
    const byWeekend = {};
    assignments.forEach((a) => {
      const sat = weekendOf(a.event_date);
      if (!sat.startsWith(month) && !a.event_date.startsWith(month)) return;
      (byWeekend[sat] = byWeekend[sat] || []).push(a);
      sats.add(sat);
    });
    const weekends = [...sats].sort();
    const monthRows = Object.values(byWeekend).flat();
    const pending = monthRows.filter((a) => a.confirmation_status === 'pendente').length;
    const gaps = weekends.filter((s) => !(byWeekend[s] || []).some((a) => a.direction === 'receive')).length;
    const cards = weekends.map((s) => weekendCard(s, (byWeekend[s] || []).sort((a, b) => a.event_date.localeCompare(b.event_date)), history, onlyPending)).join('');

    host.innerHTML = `
      ${nextSpeechHtml()}
      <div class="dp-month-bar">
        <button type="button" class="dp-icon-btn" data-dp-month-step="-1" aria-label="Mês anterior"><span class="material-symbols-outlined">chevron_left</span></button>
        <h2 class="dp-month-title">${escapeHtml(monthLabel(month))}</h2>
        <button type="button" class="dp-icon-btn" data-dp-month-step="1" aria-label="Próximo mês"><span class="material-symbols-outlined">chevron_right</span></button>
        ${month !== localToday().slice(0, 7) ? '<button type="button" class="dp-link-btn" data-dp-month-today>Hoje</button>' : ''}
      </div>
      <div class="dp-month-summary">
        <span>${weekends.length} fins de semana</span>
        ${gaps ? `<span class="is-warn">${gaps} sem orador</span>` : '<span class="is-ok">todos com orador</span>'}
        <button type="button" class="dp-filter-chip${onlyPending ? ' is-on' : ''}" data-dp-pending>${pending} pendente${pending === 1 ? '' : 's'}</button>
      </div>
      ${exchangeMonthHtml(month)}
      <div class="dp-weekends">${cards || empty('Nenhuma designação pendente neste mês.')}</div>
      <button type="button" class="dp-fab" data-dp-new aria-label="Nova designação"><span class="material-symbols-outlined" aria-hidden="true">add</span><span>Nova designação</span></button>`;

    host.querySelectorAll('[data-dp-month-step]').forEach((b) => b.addEventListener('click', () => {
      host.dataset.month = shiftMonth(month, Number(b.dataset.dpMonthStep));
      renderAgenda();
    }));
    host.querySelector('[data-dp-month-today]')?.addEventListener('click', () => { host.dataset.month = localToday().slice(0, 7); renderAgenda(); });
    host.querySelector('[data-dp-pending]')?.addEventListener('click', () => { host.dataset.pending = onlyPending ? '' : '1'; renderAgenda(); });
    host.querySelectorAll('[data-dp-wa-weekend]').forEach((b) => b.addEventListener('click', () => openWhatsapp(byWeekend[b.dataset.dpWaWeekend] || [])));
    host.querySelectorAll('[data-dp-new-at]').forEach((b) => b.addEventListener('click', () => openAssignmentModal(null, {
      direction: b.dataset.direction,
      event_date: b.dataset.direction === 'send' ? isoOf(new Date(new Date(`${b.dataset.dpNewAt}T12:00:00`).getTime() + 864e5)) : b.dataset.dpNewAt
    })));
    bindExchangeActions(host);
    bindAssignmentActions(host);
  }

  async function setAssignmentStatus(id, status) {
    const { error } = await client.from('speech_assignments').update({ confirmation_status: status }).eq('id', id);
    if (error) return toast(errorText(error), true);
    const a = assignments.find((x) => x.id === id);
    if (a) a.confirmation_status = status;
    refresh();
    toast(status === 'confirmado' ? 'Confirmado.' : 'Marcado como pendente.');
  }

  /* ---------- Intercâmbio ---------- */
  function renderExchange() {
    const host = $('#dp-panel-intercambio');
    if (!host) return;
    if (!exchangeAvailable) {
      host.innerHTML = `<div class="terr-empty-state dp-empty"><p>O intercâmbio mensal precisa da migration <code>20261004120000_speech_exchange_months</code>.</p></div>`;
      return;
    }
    const view = host.dataset.view || 'next';
    const thisMonth = `${localToday().slice(0, 7)}-01`;
    const rows = exchanges
      .filter((x) => (view === 'next' ? x.reference_month >= thisMonth : x.reference_month < thisMonth))
      .sort((a, b) => (view === 'next' ? a.reference_month.localeCompare(b.reference_month) : b.reference_month.localeCompare(a.reference_month)));
    const byYear = {};
    rows.forEach((x) => (byYear[x.reference_month.slice(0, 4)] = byYear[x.reference_month.slice(0, 4)] || []).push(x));
    const years = Object.keys(byYear).sort((a, b) => (view === 'next' ? a.localeCompare(b) : b.localeCompare(a)));
    const lastVisit = {};
    exchanges.filter((x) => x.reference_month < thisMonth && x.status !== 'cancelado').forEach((x) => {
      const k = normalizeSearch(text(x.congregation_name));
      if (k && (!lastVisit[k] || lastVisit[k] < x.reference_month)) lastVisit[k] = x.reference_month;
    });

    host.innerHTML = `
      <div class="dp-ex-bar">
        <div class="dp-themes-chips" role="group" aria-label="Período">
          ${[['next', 'Próximos'], ['past', 'Histórico']].map(([id, label]) => `<button type="button" class="dp-themes-chip${view === id ? ' is-on' : ''}" data-dp-ex-view="${id}">${label}</button>`).join('')}
        </div>
        <button type="button" class="dp-link-btn" data-dp-ex-new="${localToday().slice(0, 7)}">Novo mês</button>
      </div>
      ${years.length ? years.map((y) => `<section class="dp-ex-year"><h3>${y}</h3>
        ${byYear[y].map((x) => {
          const ym = x.reference_month.slice(0, 7);
          const lv = view === 'next' ? lastVisit[normalizeSearch(text(x.congregation_name))] : null;
          return `<div class="dp-ex-row">
            <span class="dp-ex-row__month">${escapeHtml(MONTHS[Number(ym.slice(5)) - 1].slice(0, 3))}</span>
            <div class="dp-ex-row__card">${exchangeCard(x)}${lv ? `<p class="dp-ex__last">Última vez: ${escapeHtml(monthLabel(lv.slice(0, 7)))}</p>` : ''}</div>
          </div>`;
        }).join('')}</section>`).join('') : empty(view === 'next' ? 'Nenhum intercâmbio futuro cadastrado.' : 'Nenhum histórico cadastrado.')}`;

    host.querySelectorAll('[data-dp-ex-view]').forEach((b) => b.addEventListener('click', () => { host.dataset.view = b.dataset.dpExView; renderExchange(); }));
    bindExchangeActions(host);
  }

  function bindExchangeActions(scope) {
    scope.querySelectorAll('[data-dp-stop]').forEach((el) => el.addEventListener('click', (e) => e.stopPropagation()));
    scope.querySelectorAll('[data-dp-ex-new]').forEach((b) => b.addEventListener('click', () => openExchangeModal(null, b.dataset.dpExNew)));
    scope.querySelectorAll('[data-dp-ex-edit]').forEach((el) => {
      const open = () => openExchangeModal(exchanges.find((x) => x.id === el.dataset.dpExEdit));
      el.addEventListener('click', open);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
    });
  }

  function openExchangeModal(existing, ym) {
    const x = existing || { reference_month: `${ym || localToday().slice(0, 7)}-01`, status: 'a_combinar' };
    openModal(existing ? 'Editar intercâmbio' : 'Novo intercâmbio', `
      <form class="dp-form" data-dp-ex-form>
        <label>Mês<input required name="month" type="month" value="${escapeHtml(String(x.reference_month).slice(0, 7))}"></label>
        <label>Status<select name="status">${Object.entries(EXCHANGE_STATUS).map(([k, v]) => option(k, v, x.status)).join('')}</select></label>
        <label class="dp-span-3">Congregação<input required name="congregation_name" list="dp-ex-congs" autocomplete="off" value="${escapeHtml(x.congregation_name || '')}">
          <datalist id="dp-ex-congs">${activeCongregations().map((c) => `<option value="${escapeHtml(c.name)}"></option>`).join('')}</datalist></label>
        <label>Coordenador<input name="coordinator_name" autocomplete="off" value="${escapeHtml(x.coordinator_name || '')}"></label>
        <label>Telefone<input name="coordinator_phone" type="tel" value="${escapeHtml(x.coordinator_phone || '')}"></label>
        <label class="dp-span-3">Região / referência<input name="region" autocomplete="off" value="${escapeHtml(x.region || '')}"></label>
        <label class="dp-span-3">Enviamos<input name="sent_note" autocomplete="off" placeholder="Quem vai daqui para lá (ex.: Edvan / Lucas)" value="${escapeHtml(x.sent_note || '')}"></label>
        <label class="dp-span-3">Observações<textarea name="notes" rows="2">${escapeHtml(x.notes || '')}</textarea></label>
        <footer>${existing ? '<button type="button" class="dp-danger-btn" data-dp-ex-delete>Excluir</button>' : ''}<span class="dp-footer-spacer"></span><button type="button" data-dp-close>Cancelar</button><button class="btn-primary">Salvar</button></footer>
      </form>`);
    const form = modalRoot()?.querySelector('[data-dp-ex-form]');
    if (!form) return;
    form.querySelector('[data-dp-ex-delete]')?.addEventListener('click', async () => {
      if (!await confirmDialog('Excluir intercâmbio', `Excluir o intercâmbio de ${x.congregation_name || 'congregação'} em ${monthLabel(String(x.reference_month).slice(0, 7))}?`)) return;
      const { error } = await client.from('speech_exchange_months').delete().eq('id', existing.id);
      if (error) return toast(errorText(error), true);
      closeModal(); await loadData(); refresh(); toast('Intercâmbio excluído.');
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(form).entries());
      const name = text(v.congregation_name);
      const cong = congregations.find((c) => normalizeSearch(c.name) === normalizeSearch(name));
      const payload = {
        reference_month: `${v.month}-01`,
        congregation_id: cong?.id || null,
        congregation_name: name || null,
        coordinator_name: text(v.coordinator_name) || null,
        coordinator_phone: text(v.coordinator_phone) || null,
        region: text(v.region) || null,
        status: v.status,
        sent_note: text(v.sent_note) || null,
        notes: text(v.notes) || null,
        updated_at: new Date().toISOString()
      };
      const { error } = existing
        ? await client.from('speech_exchange_months').update(payload).eq('id', existing.id)
        : await client.from('speech_exchange_months').insert(payload);
      if (error) return toast(/duplicate|unique/i.test(error.message) ? 'Essa congregação já está cadastrada neste mês.' : errorText(error), true);
      closeModal(); await loadData(); refresh(); toast('Intercâmbio salvo.');
    });
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

  function comboFieldHtml(kind, assignment, { label, span2 = false, span3 = false } = {}) {
    const cfg = COMBO_FIELDS[kind];
    const { id, text: textVal } = assignmentComboValue(kind, assignment);
    const theme = kind === 'theme' ? getTheme(id) : null;
    const spanClass = span3 ? 'dp-span-3' : span2 ? 'dp-span-2' : '';
    const leading = kind === 'theme'
      ? `<span class="dp-combo__badge${theme ? '' : ' hidden'}" data-dp-combo-badge aria-hidden="true">${theme?.outline_number || ''}</span>
         <span class="material-symbols-outlined dp-combo__icon${theme ? ' hidden' : ''}" aria-hidden="true">${cfg.icon}</span>`
      : `<span class="material-symbols-outlined dp-combo__icon" aria-hidden="true">${cfg.icon}</span>`;
    return `
      <label class="${spanClass}">${label}
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
    if (combo.dataset.dpCombo === 'congregation' && hidden.value) {
      fillCongregationDetailFields(form, hidden.value);
    }
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
          fillCongregationDetailFields(form, congregation.id);
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
    container?.querySelectorAll('[data-dp-theme-item]').forEach((el) => {
      const label = el.dataset.dpThemeText || el.textContent;
      el.classList.toggle('dp-filter-hidden', !matchesSearch(label, query));
    });
  }

  function themeChipsHtml(selectedIds) {
    const ids = [...selectedIds];
    if (!ids.length) {
      return '<span class="dp-theme-chips__empty">Nenhum esboço — busque abaixo para adicionar.</span>';
    }
    return ids
      .map((id) => getTheme(id))
      .filter(Boolean)
      .sort((a, b) => a.outline_number - b.outline_number)
      .map((t) => `<span class="dp-theme-chip" data-dp-theme-chip="${t.id}">
        <span class="dp-theme-chip__num">${t.outline_number}</span>
        <span class="dp-theme-chip__title">${escapeHtml(t.title)}</span>
        <button type="button" class="dp-theme-chip__remove" aria-label="Remover esboço ${t.outline_number}"><span class="material-symbols-outlined">close</span></button>
      </span>`).join('');
  }

  function updateThemeChipCount(form, selected) {
    const countEl = form.querySelector('[data-dp-theme-count]');
    if (!countEl) return;
    const n = selected.size;
    countEl.textContent = `${n} selecionado${n === 1 ? '' : 's'}`;
  }

  function bindThemeAddCombo(form, selected, sync) {
    const combo = form.querySelector('[data-dp-theme-add]');
    if (!combo) return;
    const input = combo.querySelector('.dp-combo__input');
    const list = combo.querySelector('.dp-combo__list');
    const toggle = combo.querySelector('.dp-combo__toggle');

    const open = () => {
      const items = activeThemes(input.value).filter((t) => !selected.has(t.id)).slice(0, 14);
      list.innerHTML = items.length
        ? items.map((t) => themeOptionHtml(mapThemeComboItem(t, false))).join('')
        : '<li class="dp-combo__empty">Nenhum esboço encontrado</li>';
      list.hidden = false;
      combo.classList.add('is-open');
    };
    const close = () => closeCombo(combo);

    input.addEventListener('focus', open);
    input.addEventListener('input', open);
    input.addEventListener('blur', () => {
      window.setTimeout(() => {
        if (!combo.contains(document.activeElement)) close();
      }, 120);
    });
    toggle?.addEventListener('mousedown', (e) => e.preventDefault());
    toggle?.addEventListener('click', () => {
      if (combo.classList.contains('is-open')) close();
      else { input.focus(); open(); }
    });
    list.addEventListener('mousedown', (e) => e.preventDefault());
    list.addEventListener('click', (e) => {
      const opt = e.target.closest('.dp-combo__option');
      if (!opt?.dataset.id) return;
      selected.add(opt.dataset.id);
      input.value = '';
      sync();
      close();
    });
  }

  function bindThemeChipPicker(form, initialSelected) {
    const selected = new Set(initialSelected);
    const chipsHost = form.querySelector('[data-dp-theme-chips]');
    const sync = () => {
      if (chipsHost) chipsHost.innerHTML = themeChipsHtml(selected);
      updateThemeChipCount(form, selected);
    };
    chipsHost?.addEventListener('click', (e) => {
      const btn = e.target.closest('.dp-theme-chip__remove');
      if (!btn) return;
      const id = btn.closest('[data-dp-theme-chip]')?.dataset.dpThemeChip;
      if (id) {
        selected.delete(id);
        sync();
      }
    });
    bindThemeAddCombo(form, selected, sync);
    sync();
    form.__themeSelected = selected;
  }

  function speakerThemeFieldHtml(selected) {
    return `<div class="dp-span-3 dp-theme-chips-field">
      <div class="dp-theme-picker__head">
        <span class="dp-theme-picker__label">Temas preparados</span>
        <span class="dp-theme-picker__count" data-dp-theme-count>0 selecionados</span>
      </div>
      <div class="dp-theme-chips" data-dp-theme-chips></div>
      <div class="dp-combo dp-combo--theme-add" data-dp-theme-add>
        <span class="material-symbols-outlined dp-combo__icon" aria-hidden="true">add</span>
        <input class="dp-combo__input" type="text" autocomplete="off" placeholder="Adicionar esboço por nº ou título…">
        <button type="button" class="dp-combo__btn dp-combo__toggle" aria-label="Abrir lista" tabindex="-1">
          <span class="material-symbols-outlined" aria-hidden="true">expand_more</span>
        </button>
        <ul class="dp-combo__list" role="listbox" hidden></ul>
      </div>
    </div>`;
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

  function congregationForAssignment(a) {
    const linked = a.speech_congregations;
    const cached = getCongregation(a.congregation_id);
    return {
      name: a.congregation_name || linked?.name || cached?.name || '',
      contact_name: linked?.contact_name ?? cached?.contact_name ?? '',
      phone: linked?.phone ?? cached?.phone ?? '',
      address: linked?.address ?? cached?.address ?? '',
      city: linked?.city ?? cached?.city ?? ''
    };
  }

  function congregationContactLine(cong) {
    const parts = [text(cong.contact_name), text(cong.phone)].filter(Boolean);
    return parts.length ? parts.join(' — ') : '—';
  }

  function congregationAddressLine(cong) {
    return text(cong.address) || text(cong.city) || '—';
  }

  function congregationDetailsForAssignment(a) {
    const c = congregationForAssignment(a || {});
    return {
      contact_name: c.contact_name || '',
      phone: c.phone || '',
      address: c.address || ''
    };
  }

  function congregationDetailFieldsHtml(a) {
    const d = congregationDetailsForAssignment(a);
    return `
      <label>Contato da congregação<input name="congregation_contact_name" autocomplete="off" value="${escapeHtml(d.contact_name)}" placeholder="Nome do contato"></label>
      <label>Telefone do contato<input name="congregation_phone" type="tel" autocomplete="tel" value="${escapeHtml(d.phone)}" placeholder="Telefone"></label>
      <label class="dp-span-3">Endereço<input name="congregation_address" autocomplete="off" value="${escapeHtml(d.address)}" placeholder="Endereço completo"></label>`;
  }

  function fillCongregationDetailFields(form, congregationId) {
    const c = getCongregation(congregationId) || {};
    const contact = form.querySelector('[name="congregation_contact_name"]');
    const phone = form.querySelector('[name="congregation_phone"]');
    const address = form.querySelector('[name="congregation_address"]');
    if (contact) contact.value = c.contact_name || '';
    if (phone) phone.value = c.phone || '';
    if (address) address.value = c.address || '';
  }

  async function saveCongregationDetails(congregationId, formData) {
    if (!congregationId) return;
    const payload = {
      contact_name: text(formData.congregation_contact_name) || null,
      phone: text(formData.congregation_phone) || null,
      address: text(formData.congregation_address) || null
    };
    const { data, error } = await client.from('speech_congregations').update(payload).eq('id', congregationId).select().single();
    if (error) throw error;
    const idx = congregations.findIndex((c) => c.id === congregationId);
    if (idx >= 0) congregations[idx] = { ...congregations[idx], ...data };
    else if (data) congregations.push(data);
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

    if (congregationId) {
      await saveCongregationDetails(congregationId, v);
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

  function openAssignmentModal(existing, defaults = {}) {
    const a = existing || { direction: 'receive', event_date: localToday(), modality: 'presencial', confirmation_status: 'pendente', ...defaults };
    openModal(`${existing ? 'Editar' : 'Nova'} designação`, `
      <form class="dp-form dp-form--assignment" data-dp-assignment-form>
        <label>Direção<select name="direction">${option('receive', 'Recebemos', a.direction)}${option('send', 'Enviamos', a.direction)}</select></label>
        <label>Data<input required name="event_date" type="date" value="${escapeHtml(a.event_date || '')}"></label>
        <label>Horário<input name="event_time" type="time" value="${escapeHtml((a.event_time || '').slice(0, 5))}"></label>
        ${comboFieldHtml('speaker', a, { label: 'Orador', span2: true })}
        ${comboFieldHtml('congregation', a, { label: 'Congregação' })}
        ${congregationDetailFieldsHtml(a)}
        ${comboFieldHtml('theme', a, { label: 'Tema', span3: true })}
        <label>Cântico<input name="opening_song" value="${escapeHtml(a.opening_song || '')}"></label>
        <label>Modalidade<select name="modality">${option('presencial', 'Presencial', a.modality)}${option('online', 'Online', a.modality)}</select></label>
        <label>Status<select name="confirmation_status">${Object.entries(STATUS).map(([k, v]) => option(k, v, a.confirmation_status)).join('')}</select></label>
        <label class="dp-span-3">Observações<textarea name="notes" rows="1">${escapeHtml(a.notes || '')}</textarea></label>
        <footer>${existing ? `<button type="button" class="dp-danger-btn" data-dp-delete="${existing.id}">Excluir</button><button type="button" data-dp-wa="${existing.id}">WhatsApp</button>` : ''}<span class="dp-footer-spacer"></span><button type="button" data-dp-close>Cancelar</button><button class="btn-primary">Salvar</button></footer>
      </form>`, { wide: true });
    const form = modalRoot()?.querySelector('[data-dp-assignment-form]');
    if (!form) return;
    bindFormCombos(form);
    if (existing) bindAssignmentActions(form);
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
    scope.querySelectorAll('[data-dp-edit]').forEach((row) => {
      const open = () => openAssignmentModal(assignments.find((a) => a.id === row.dataset.dpEdit));
      row.addEventListener('click', (e) => { if (e.target.closest('button:not([data-dp-edit]), a')) return; open(); });
      if (row.tagName !== 'BUTTON') row.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === row) open(); });
    });
    scope.querySelectorAll('[data-dp-status]').forEach((button) => button.addEventListener('click', (e) => {
      e.stopPropagation();
      setAssignmentStatus(button.dataset.dpStatus, button.dataset.next);
    }));
    scope.querySelectorAll('[data-dp-delete]').forEach((button) => button.addEventListener('click', async () => {
      const a = assignments.find((x) => x.id === button.dataset.dpDelete);
      if (!await confirmDialog('Excluir designação', `Excluir a designação de ${a?.speaker_name || 'orador'}?`)) return;
      const { error } = await client.from('speech_assignments').delete().eq('id', button.dataset.dpDelete);
      if (error) return toast(errorText(error), true); closeModal(); await loadData(); refresh(); toast('Designação excluída.');
    }));
    scope.querySelectorAll('[data-dp-wa]').forEach((button) => button.addEventListener('click', () => openWhatsapp([assignments.find((a) => a.id === button.dataset.dpWa)])));
    scope.querySelector('[data-dp-wa-range]')?.addEventListener('click', () => {
      const start = new Date(); start.setDate(start.getDate() - start.getDay()); const end = new Date(start); end.setDate(end.getDate() + 6);
      openWhatsapp(assignments.filter((a) => a.event_date >= start.toISOString().slice(0, 10) && a.event_date <= end.toISOString().slice(0, 10)));
    });
  }

  function whatsappText(a) {
    const cong = congregationForAssignment(a);
    const congregationName = text(cong.name) || '—';
    return [
      '*DISCURSO PÚBLICO*',
      `*Data:* ${dateText(a.event_date)}`,
      `*Horário:* ${a.event_time?.slice(0, 5) || '—'}`,
      `*Orador:* ${a.speaker_name || '—'}`,
      `*Tema:* ${assignmentTheme(a)}`,
      `*Congregação:* ${congregationName}`,
      `*Contato da Congregação:* ${congregationContactLine(cong)}`,
      `*Endereço:* ${congregationAddressLine(cong)}`,
      `*Cântico:* ${text(a.opening_song) || '—'}`
    ].join('\n');
  }
  function openWhatsapp(rows) {
    const message = rows.filter(Boolean).sort((a, b) => a.event_date.localeCompare(b.event_date)).map(whatsappText).join('\n\n');
    openModal('Mensagem para WhatsApp', `<div class="dp-whatsapp"><textarea readonly>${escapeHtml(message || 'Nenhuma designação nesta semana.')}</textarea><footer><button type="button" data-dp-copy>Copiar mensagem</button><button type="button" data-dp-close>Fechar</button></footer></div>`, { wide: true });
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
    openModal(`${existing ? 'Editar' : 'Novo'} orador`, `
      <form class="dp-form dp-form--speaker" data-dp-speaker-form>
        <label class="dp-span-3">Nome completo
          <div class="dp-input-icon">
            <span class="material-symbols-outlined" aria-hidden="true">person</span>
            <input required name="full_name" autocomplete="name" value="${escapeHtml(s.full_name || '')}">
          </div>
        </label>
        ${comboFieldHtml('congregation', congregationValue, { label: 'Congregação', span3: true })}
        <label>Telefone
          <div class="dp-input-icon">
            <span class="material-symbols-outlined" aria-hidden="true">call</span>
            <input name="phone" type="tel" autocomplete="tel" value="${escapeHtml(s.phone || '')}">
          </div>
        </label>
        <label>E-mail
          <div class="dp-input-icon">
            <span class="material-symbols-outlined" aria-hidden="true">mail</span>
            <input name="email" type="email" autocomplete="email" value="${escapeHtml(s.email || '')}">
          </div>
        </label>
        <label>Privilégio<select name="privilege">${Object.entries(PRIVILEGE).map(([k, v]) => option(k, v, s.privilege)).join('')}</select></label>
        <div class="dp-form-toggles dp-span-3">
          <label class="dp-toggle"><input name="is_local" type="checkbox"${s.is_local ? ' checked' : ''}><span class="material-symbols-outlined" aria-hidden="true">home</span> Orador local</label>
          <label class="dp-toggle"><input name="is_active" type="checkbox"${s.is_active ? ' checked' : ''}><span class="material-symbols-outlined" aria-hidden="true">verified</span> Ativo</label>
        </div>
        <label class="dp-span-3">Observações<textarea name="notes" rows="1">${escapeHtml(s.notes || '')}</textarea></label>
        ${speakerThemeFieldHtml(selected)}
        <footer><button type="button" data-dp-close>Cancelar</button><button class="btn-primary">Salvar</button></footer>
      </form>`, { wide: true });
    const form = modalRoot()?.querySelector('[data-dp-speaker-form]');
    if (!form) return;
    bindFormCombos(form);
    bindThemeChipPicker(form, selected);
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
      const ids = form.__themeSelected ? [...form.__themeSelected] : [...form.querySelectorAll('[data-dp-theme-chip]')].map((el) => el.dataset.dpThemeChip);
      const { error: deleteError } = await client.from('speech_speaker_themes').delete().eq('speaker_id', result.data.id);
      if (deleteError) return toast(errorText(deleteError), true);
      if (ids.length) { const { error } = await client.from('speech_speaker_themes').insert(ids.map((theme_id) => ({ speaker_id: result.data.id, theme_id }))); if (error) return toast(errorText(error), true); }
      closeModal(); await loadData(); refresh(); toast('Orador salvo.');
    });
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
    const history = hallHistoryByOutline();
    const t0 = localToday();
    const lastDone = (t) => (history[t.outline_number] || []).filter((a) => a.event_date <= t0).pop()?.event_date || '';
    const nextDone = (t) => (history[t.outline_number] || []).find((a) => a.event_date > t0)?.event_date || '';
    if (filter === 'stale') {
      rows = rows.filter((t) => t.is_active && !nextDone(t))
        .sort((a, b) => lastDone(a).localeCompare(lastDone(b)) || (a.outline_number - b.outline_number));
    }
    const doneLabel = (t) => {
      const next = nextDone(t);
      if (next) return `<span class="dp-theme-last is-next">agendado ${escapeHtml(shortDate(next))}</span>`;
      const last = lastDone(t);
      return last ? `<span class="dp-theme-last">${escapeHtml(relativeDays(last))}</span>` : '<span class="dp-theme-last is-never">nunca aqui</span>';
    };

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
            ${[['all', `Todos · ${themes.length}`], ['stale', 'Há mais tempo'], ['prepared', `Com orador · ${withPrep}`], ['bare', `Sem orador · ${bare}`]]
              .map(([id, label]) => `<button type="button" class="dp-themes-chip${filter === id ? ' is-on' : ''}" data-dp-themes-filter="${id}">${label}</button>`).join('')}
          </div>
        </div>
        <div class="dp-themes-meta"><span>${filter === 'stale' ? 'Nunca feitos no nosso salão primeiro, depois os mais antigos' : 'Catálogo S-34'}</span><span>${rows.length} exibido${rows.length === 1 ? '' : 's'}</span></div>
        ${rows.length ? `<div class="dp-themes-list" role="list">${rows.map((t) => {
          const n = preparedCount(t.id);
          return `<button type="button" class="dp-theme-row" role="listitem" data-dp-theme-id="${t.id}" title="Ver oradores">
            <span class="dp-theme-num">${t.outline_number}</span>
            <span class="dp-theme-title">${escapeHtml(t.title)}${doneLabel(t)}</span>
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
    const renderers = { agenda: renderAgenda, intercambio: renderExchange, oradores: renderSpeakers, temas: renderThemes };
    if (!rendered[tab] && renderers[tab]) {
      renderers[tab]();
      rendered[tab] = true;
    }
  }
  function refresh() {
    const renderers = { agenda: renderAgenda, intercambio: renderExchange, oradores: renderSpeakers, temas: renderThemes };
    Object.keys(rendered).forEach((tab) => {
      if (rendered[tab] && renderers[tab]) renderers[tab]();
    });
  }

  function openModal(title, body, { wide = false } = {}) {
    closeModal();
    document.body.insertAdjacentHTML('beforeend', `<div class="dp-modal" role="dialog" aria-modal="true"><div class="dp-modal__card${wide ? ' dp-modal__card--wide' : ''}"><header><h2>${escapeHtml(title)}</h2><button type="button" data-dp-close aria-label="Fechar">×</button></header>${body}</div></div>`);
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
      client.from('speech_assignments').select('*, speech_speakers(full_name, phone), speech_themes(outline_number, title), speech_congregations(name, contact_name, phone, address, city)').order('event_date')
    ]);
    const failure = [themeRes, speakerRes, congregationRes, assignmentRes].find((x) => x.error);
    if (failure) throw failure.error;
    themes = themeRes.data || []; speakers = speakerRes.data || []; congregations = congregationRes.data || []; assignments = assignmentRes.data || [];
    // Intercâmbio é opcional: sem a migration a Agenda continua funcionando.
    const exchangeRes = await client.from('speech_exchange_months').select('*').order('reference_month');
    exchangeAvailable = !exchangeRes.error;
    exchanges = exchangeRes.data || [];
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
