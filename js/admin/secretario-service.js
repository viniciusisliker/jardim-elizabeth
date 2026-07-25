(function () {
  const { getClient, showToast, escapeHtml } = window.JEAdmin;

  const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const TYPE_LABELS = {
    publicador: 'Publicadores',
    pioneiro_auxiliar: 'Pioneiros auxiliares',
    pioneiro_regular: 'Pioneiros regulares'
  };
  const PUBLISHER_TYPE_LABEL = {
    publicador: 'Publicador',
    pioneiro_auxiliar: 'Pioneiro auxiliar',
    pioneiro_regular: 'Pioneiro regular'
  };
  const PUBLISHER_STATUS_LABEL = {
    ativo: 'Ativo',
    irregular: 'Irregular',
    inativo: 'Desativado',
    reintegrado: 'Readmitido',
    primeiro_relatorio: 'Primeiro relatório'
  };
  const STATUS_LABELS = {
    ativo: 'Publicadores ativos',
    irregular: 'Irregulares',
    inativo: 'Desativados',
    reintegrado: 'Readmitidos',
    primeiro_relatorio: 'Primeiro registro de relatório'
  };
  const STAT_ICONS = {
    'Publicadores': 'groups',
    'Pioneiros auxiliares': 'star',
    'Pioneiros regulares': 'military_tech'
  };

  let client = null;
  let toast = null;
  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;
  let pubView = 'total';
  let activeTab = 'publicadores';
  let groups = [];
  let publishers = [];
  let reports = new Map();
  let monthStatus = { is_closed: false, observations: '' };
  let attendance = { midweek: 0, weekend: 0, midweekZoom: null, weekendZoom: null };
  let attendanceLogs = [];
  let adjustments = [];
  let settings = {};

  function toastEl() {
    return document.getElementById('hub-admin-toast') || document.getElementById('admin-toast');
  }

  function monthLabel(y, m) {
    return `${MONTHS[m - 1]} ${y}`;
  }

  function updateMonthLabel() {
    const el = document.getElementById('sec-month-label');
    if (el) el.textContent = monthLabel(year, month);
    const adj = document.getElementById('sec-adj-month-label');
    if (adj) adj.textContent = monthLabel(year, month);
    updateMonthBadge();
  }

  function updateMonthBadge() {
    const badge = document.getElementById('sec-month-badge');
    if (!badge) return;
    badge.textContent = monthStatus.is_closed ? 'Mês fechado' : 'Mês aberto';
    badge.classList.toggle('sec-month-badge--closed', !!monthStatus.is_closed);
  }

  function updateNavIndicator(activeBtn) {
    const nav = document.getElementById('sec-nav');
    const indicator = document.getElementById('sec-nav-indicator');
    if (!nav || !indicator || !activeBtn) return;
    const navRect = nav.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    if (!navRect.width || !btnRect.width) {
      indicator.style.opacity = '0';
      return;
    }
    indicator.style.opacity = '1';
    indicator.style.width = `${btnRect.width}px`;
    indicator.style.transform = `translateX(${btnRect.left - navRect.left}px)`;
  }

  function queueNavIndicatorRefresh() {
    const active = document.querySelector('[data-sec-tab].active');
    if (!active) return;
    const run = () => updateNavIndicator(active);
    run();
    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
  }

  function ageYears(dateStr) {
    if (!dateStr) return null;
    const d = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const diff = Date.now() - d.getTime();
    return Math.max(0, diff / (365.25 * 24 * 3600 * 1000));
  }

  function fmtYears(n) {
    if (n == null) return '—';
    return `${n.toFixed(1).replace('.', ',')} anos`;
  }

  function displayName(p) {
    if (settings.show_last_name_first && p.full_name?.includes(' ')) {
      const parts = p.full_name.trim().split(/\s+/);
      const last = parts.pop();
      return `${last} ${parts.join(' ')}`;
    }
    return p.full_name || '—';
  }

  function publishersByType(type) {
    return publishers.filter((p) => p.publisher_type === type && p.status === 'ativo');
  }

  function reportFor(profileId) {
    return reports.get(profileId) || null;
  }

  function hasReport(profileId) {
    const r = reportFor(profileId);
    return !!(r?.participated || r?.submitted_at);
  }

  function statsForType(type) {
    const list = publishersByType(type);
    const total = list.length;
    const submitted = list.filter((p) => hasReport(p.profile_id)).length;
    const studies = list.reduce((s, p) => s + (Number(reportFor(p.profile_id)?.bible_studies) || 0), 0);
    const hours = list.reduce((s, p) => s + (Number(reportFor(p.profile_id)?.hours) || 0), 0);
    const irregular = type === 'publicador'
      ? publishers.filter((p) => p.publisher_type === 'publicador' && p.status === 'irregular').length
      : 0;
    const avg = (v) => (total ? (v / total).toFixed(1).replace('.', ',') : '0,0');
    return { total, submitted, studies, hours, irregular, avg };
  }

  function renderStatCard(title, rows, mod = '') {
    const icon = STAT_ICONS[title] || 'bar_chart';
    const body = rows.map((row) => `
      <div class="sec-stat-row">
        <span class="sec-stat-row__label">${escapeHtml(row.label)}</span>
        <span class="sec-stat-row__vals">
          ${row.total != null ? `<span class="sec-stat-row__total">${escapeHtml(String(row.total))}</span>` : ''}
          ${row.avg != null ? `<span class="sec-stat-row__avg">${escapeHtml(String(row.avg))}</span>` : ''}
        </span>
      </div>`).join('');
    return `<article class="sec-stat-card ${mod}">
      <div class="sec-stat-card__head">
        <span class="material-symbols-outlined" aria-hidden="true">${icon}</span>
        <h3>${escapeHtml(title)}</h3>
      </div>
      <div class="sec-stat-card__body">${body}</div>
    </article>`;
  }

  function renderKpiStrip() {
    const root = document.getElementById('sec-kpi-strip');
    if (!root) return;
    const active = publishers.filter((p) => p.status === 'ativo');
    const submitted = active.filter((p) => hasReport(p.profile_id)).length;
    const missing = Math.max(0, active.length - submitted);
    root.innerHTML = `
      <article class="sec-kpi">
        <span class="sec-kpi__icon"><span class="material-symbols-outlined" aria-hidden="true">groups</span></span>
        <div>
          <span class="sec-kpi__val">${active.length}</span>
          <span class="sec-kpi__label">Publicadores ativos</span>
        </div>
      </article>
      <article class="sec-kpi sec-kpi--ok">
        <span class="sec-kpi__icon"><span class="material-symbols-outlined" aria-hidden="true">task_alt</span></span>
        <div>
          <span class="sec-kpi__val">${submitted}</span>
          <span class="sec-kpi__label">Relatórios recebidos</span>
        </div>
      </article>
      <article class="sec-kpi ${missing ? 'sec-kpi--warn' : 'sec-kpi--gold'}">
        <span class="sec-kpi__icon"><span class="material-symbols-outlined" aria-hidden="true">${missing ? 'warning' : 'celebration'}</span></span>
        <div>
          <span class="sec-kpi__val">${missing}</span>
          <span class="sec-kpi__label">${missing ? 'Sem relatório' : 'Todos entregues'}</span>
        </div>
      </article>`;
  }

  function renderPubStats() {
    const root = document.getElementById('sec-pub-stats');
    if (!root) return;
    const pub = statsForType('publicador');
    const aux = statsForType('pioneiro_auxiliar');
    const reg = statsForType('pioneiro_regular');
    const cards = [];
    if (pubView === 'total') {
      cards.push(renderStatCard('Publicadores', [
        { label: 'Relatórios', total: pub.submitted },
        { label: 'Irregulares', total: pub.irregular },
        { label: 'Estudos bíblicos', total: pub.studies }
      ]));
      cards.push(renderStatCard('Pioneiros auxiliares', [
        { label: 'Relatórios', total: aux.submitted },
        { label: 'Estudos bíblicos', total: aux.studies },
        { label: 'Horas', total: `${aux.hours}h` }
      ], 'sec-stat-card--aux'));
      cards.push(renderStatCard('Pioneiros regulares', [
        { label: 'Relatórios', total: reg.submitted },
        { label: 'Estudos bíblicos', total: reg.studies },
        { label: 'Horas', total: `${reg.hours}h` }
      ], 'sec-stat-card--reg'));
    } else {
      cards.push(renderStatCard('Publicadores', [
        { label: 'Relatórios', total: pub.submitted, avg: pub.avg(pub.submitted) },
        { label: 'Irregulares', total: pub.irregular, avg: pub.avg(pub.irregular) },
        { label: 'Estudos bíblicos', total: pub.studies, avg: pub.avg(pub.studies) }
      ], 'sec-stat-card--detail'));
      cards.push(renderStatCard('Pioneiros auxiliares', [
        { label: 'Relatórios', total: aux.submitted, avg: aux.avg(aux.submitted) },
        { label: 'Estudos bíblicos', total: aux.studies, avg: aux.avg(aux.studies) },
        { label: 'Horas', total: `${aux.hours}h` }
      ], 'sec-stat-card--detail sec-stat-card--aux'));
      cards.push(renderStatCard('Pioneiros regulares', [
        { label: 'Relatórios', total: reg.submitted, avg: reg.avg(reg.submitted) },
        { label: 'Estudos bíblicos', total: reg.studies, avg: reg.avg(reg.studies) },
        { label: 'Horas', total: `${reg.hours}h` }
      ], 'sec-stat-card--detail sec-stat-card--reg'));
    }
    root.innerHTML = cards.join('');
  }

  function renderPublisherList() {
    const root = document.getElementById('sec-publisher-list');
    const filter = document.getElementById('sec-publisher-filter')?.value || 'all';
    if (!root) return;

    let list = [...publishers];
    if (filter === 'ativo') list = list.filter((p) => p.status === 'ativo');
    else if (filter === 'irregular') list = list.filter((p) => p.status === 'irregular');
    else if (filter === 'pioneiro_auxiliar') list = list.filter((p) => p.publisher_type === 'pioneiro_auxiliar');
    else if (filter === 'pioneiro_regular') list = list.filter((p) => p.publisher_type === 'pioneiro_regular');

    list.sort((a, b) => displayName(a).localeCompare(displayName(b), 'pt-BR'));

    if (!list.length) {
      root.innerHTML = '<p class="sec-empty">Nenhum publicador neste filtro.</p>';
      return;
    }

    const byGroup = new Map();
    list.forEach((p) => {
      const g = p.group_name || 'Sem grupo';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push(p);
    });

    root.innerHTML = [...byGroup.entries()].map(([groupName, items]) => `
      <section class="sec-publisher-group">
        <h3 class="sec-publisher-group__title">${escapeHtml(groupName)}</h3>
        ${items.map((p) => `
          <button type="button" class="sec-publisher-row" data-sec-edit-publisher="${p.profile_id}">
            <span class="material-symbols-outlined sec-publisher-row__avatar">person</span>
            <span class="sec-publisher-row__body">
              <span class="sec-publisher-row__name">${escapeHtml(displayName(p))}</span>
              <span class="sec-publisher-row__status">${escapeHtml(PUBLISHER_TYPE_LABEL[p.publisher_type] || p.publisher_type)} · ${escapeHtml(PUBLISHER_STATUS_LABEL[p.status] || p.status)}</span>
            </span>
            <span class="sec-publisher-row__meta">
              ${p.baptism_date ? `<span>Batismo: ${fmtYears(ageYears(p.baptism_date))}</span>` : ''}
              ${p.phone ? `<span>${escapeHtml(p.phone)}</span>` : ''}
            </span>
            ${p.is_starred ? '<span class="material-symbols-outlined sec-publisher-row__star">star</span>' : ''}
            <span class="material-symbols-outlined sec-publisher-row__edit" aria-hidden="true">edit</span>
          </button>`).join('')}
      </section>`).join('');
  }

  function fillPublisherGroupSelect() {
    const select = document.getElementById('sec-publisher-group');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">Sem grupo</option>' + groups.map((g) =>
      `<option value="${g.id}">${escapeHtml(g.name)}</option>`
    ).join('');
    if (current) select.value = current;
  }

  function openPublisherModal(profileId = null) {
    fillPublisherGroupSelect();
    const isEdit = !!profileId;
    const p = isEdit ? publishers.find((x) => x.profile_id === profileId) : null;

    document.getElementById('sec-publisher-modal-title').textContent = isEdit ? 'Editar Publicador' : 'Novo Publicador';
    document.getElementById('sec-publisher-modal-sub').textContent = isEdit
      ? 'Atualize os dados da ficha do publicador.'
      : 'Cria a conta de login e a ficha no Secretário.';
    document.getElementById('sec-publisher-profile-id').value = profileId || '';
    document.getElementById('sec-publisher-name').value = p?.full_name || '';
    document.getElementById('sec-publisher-username').value = p?.username || '';
    document.getElementById('sec-publisher-login-email').value = '';
    document.getElementById('sec-publisher-password').value = '';
    document.getElementById('sec-publisher-group').value = p?.group_id || '';
    document.getElementById('sec-publisher-type').value = p?.publisher_type || 'publicador';
    document.getElementById('sec-publisher-status').value = p?.status || 'ativo';
    document.getElementById('sec-publisher-baptism').value = p?.baptism_date || '';
    document.getElementById('sec-publisher-birth').value = p?.birth_date || '';
    document.getElementById('sec-publisher-phone').value = p?.phone || '';
    document.getElementById('sec-publisher-contact-email').value = p?.email || '';
    document.getElementById('sec-publisher-starred').checked = !!p?.is_starred;
    document.getElementById('sec-publisher-notes').value = p?.notes || '';

    document.getElementById('sec-publisher-username-wrap').classList.toggle('hidden', isEdit);
    document.getElementById('sec-publisher-email-wrap').classList.toggle('hidden', isEdit);
    document.getElementById('sec-publisher-password-wrap').classList.toggle('hidden', isEdit);
    document.getElementById('sec-publisher-username').required = !isEdit;
    document.getElementById('sec-publisher-password').required = !isEdit;
    document.getElementById('sec-publisher-save').textContent = isEdit ? 'Salvar alterações' : 'Criar publicador';

    openModal('sec-publisher-modal');
    document.getElementById('sec-publisher-name')?.focus();
  }

  function normalizeFullName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
  }

  async function savePublisher(e) {
    e.preventDefault();
    const profileId = document.getElementById('sec-publisher-profile-id').value;
    const isEdit = !!profileId;
    const fullName = normalizeFullName(document.getElementById('sec-publisher-name').value);
    const saveBtn = document.getElementById('sec-publisher-save');

    if (fullName.length < 2) {
      showToast(toast, 'Informe o nome completo.', true);
      return;
    }

    saveBtn?.setAttribute('disabled', 'disabled');

    try {
      let targetProfileId = profileId;

      if (!isEdit) {
        const username = normalizeUsername(document.getElementById('sec-publisher-username').value);
        const loginEmail = document.getElementById('sec-publisher-login-email').value.trim().toLowerCase();
        const password = document.getElementById('sec-publisher-password').value || '';

        if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
          showToast(toast, 'Usuário inválido (3–32 caracteres).', true);
          return;
        }
        if (password.length < 8) {
          showToast(toast, 'A senha deve ter pelo menos 8 caracteres.', true);
          return;
        }

        const { data: createdId, error: createError } = await client.rpc('secretary_create_publisher', {
          p_full_name: fullName,
          p_username: username,
          p_email: loginEmail || null,
          p_password: password
        });
        if (createError) throw createError;
        targetProfileId = createdId;
      } else if (fullName !== (publishers.find((p) => p.profile_id === profileId)?.full_name || '')) {
        const { error: nameError } = await client.rpc('secretary_update_publisher_name', {
          p_profile_id: profileId,
          p_full_name: fullName
        });
        if (nameError) throw nameError;
      }

      const payload = {
        profile_id: targetProfileId,
        group_id: document.getElementById('sec-publisher-group').value || null,
        publisher_type: document.getElementById('sec-publisher-type').value,
        status: document.getElementById('sec-publisher-status').value,
        baptism_date: document.getElementById('sec-publisher-baptism').value || null,
        birth_date: document.getElementById('sec-publisher-birth').value || null,
        phone: document.getElementById('sec-publisher-phone').value.trim(),
        email: document.getElementById('sec-publisher-contact-email').value.trim(),
        is_starred: document.getElementById('sec-publisher-starred').checked,
        notes: document.getElementById('sec-publisher-notes').value.trim(),
        updated_at: new Date().toISOString()
      };

      const { error: profileError } = await client
        .from('secretary_publisher_profiles')
        .upsert(payload, { onConflict: 'profile_id' });
      if (profileError) throw profileError;

      showToast(toast, isEdit ? 'Publicador atualizado.' : 'Publicador criado.');
      closeModal('sec-publisher-modal');
      await loadData();
      renderAll();
    } catch (err) {
      showToast(toast, err?.message || 'Erro ao salvar publicador.', true);
    } finally {
      saveBtn?.removeAttribute('disabled');
    }
  }

  function renderReportList() {
    const root = document.getElementById('sec-report-list');
    const filter = document.getElementById('sec-report-filter')?.value || 'missing';
    if (!root) return;
    let list = [...publishers];
    if (filter === 'missing') list = list.filter((p) => !hasReport(p.profile_id));
    else if (filter === 'irregular') list = list.filter((p) => p.status === 'irregular');
    else if (filter === 'pioneiro_auxiliar') list = list.filter((p) => p.publisher_type === 'pioneiro_auxiliar');

    const byGroup = new Map();
    list.forEach((p) => {
      const g = p.group_name || 'Sem grupo';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push(p);
    });

    if (!list.length) {
      root.innerHTML = '<p class="sec-empty">Nenhum publicador neste filtro.</p>';
      return;
    }

    root.innerHTML = [...byGroup.entries()].map(([groupName, items]) => `
      <section class="sec-publisher-group">
        <h3 class="sec-publisher-group__title">${escapeHtml(groupName)}</h3>
        ${items.map((p) => {
          const rep = reportFor(p.profile_id);
          const status = hasReport(p.profile_id) ? 'Relatório registrado' : 'Sem relatórios';
          return `
          <button type="button" class="sec-publisher-row" data-sec-edit-report="${p.profile_id}">
            <span class="material-symbols-outlined sec-publisher-row__avatar">person</span>
            <span class="sec-publisher-row__body">
              <span class="sec-publisher-row__name">${escapeHtml(displayName(p))}</span>
              <span class="sec-publisher-row__status ${hasReport(p.profile_id) ? '' : 'sec-publisher-row__status--warn'}">${escapeHtml(status)}</span>
            </span>
            <span class="sec-publisher-row__meta">
              ${p.baptism_date ? `<span>Batizado: ${fmtYears(ageYears(p.baptism_date))}</span>` : ''}
              ${p.birth_date ? `<span>Idade: ${fmtYears(ageYears(p.birth_date))}</span>` : ''}
            </span>
            ${p.is_starred ? '<span class="material-symbols-outlined sec-publisher-row__star">star</span>' : ''}
          </button>`;
        }).join('')}
      </section>`).join('');
  }

  function fmtDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function fmtDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function meetingKindLabel(kind) {
    return kind === 'weekend' ? 'Final de semana' : 'Meio de semana';
  }

  function logsForMonth(logs, y, m) {
    return (logs || []).filter((row) => {
      const d = new Date(`${row.meeting_date}T12:00:00`);
      return d.getFullYear() === y && d.getMonth() + 1 === m;
    });
  }

  function avgFromLogs(logs, kind, field = 'attendance_count') {
    const items = logs.filter((row) => row.meeting_kind === kind);
    if (!items.length) return 0;
    const sum = items.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
    return Math.round(sum / items.length);
  }

  function avgZoomFromLogs(logs, kind) {
    const items = logs.filter((row) => row.meeting_kind === kind && row.zoom_attendance_count != null);
    if (!items.length) return null;
    const sum = items.reduce((acc, row) => acc + Number(row.zoom_attendance_count), 0);
    return Math.round(sum / items.length);
  }

  function applyAttendanceFromLogs(monthLogs) {
    attendance.midweek = avgFromLogs(monthLogs, 'midweek');
    attendance.weekend = avgFromLogs(monthLogs, 'weekend');
    attendance.midweekZoom = avgZoomFromLogs(monthLogs, 'midweek');
    attendance.weekendZoom = avgZoomFromLogs(monthLogs, 'weekend');
  }

  function renderAttendance() {
    const summaryRoot = document.getElementById('sec-attendance-summary');
    const historyRoot = document.getElementById('sec-attendance-history');
    if (!summaryRoot || !historyRoot) return;

    const monthLogs = logsForMonth(attendanceLogs, year, month).sort((a, b) => b.meeting_date.localeCompare(a.meeting_date));
    const midCount = monthLogs.filter((row) => row.meeting_kind === 'midweek').length;
    const weekCount = monthLogs.filter((row) => row.meeting_kind === 'weekend').length;

    summaryRoot.innerHTML = `
      <div class="sec-attendance-grid">
        <article class="sec-attendance-card sec-attendance-card--readonly">
          <h3 class="sec-attendance-card__title">Meio de semana</h3>
          <p class="sec-attendance-card__value">${attendance.midweek || '—'}</p>
          ${attendance.midweekZoom != null ? `<p class="sec-attendance-card__zoom">Zoom: ${attendance.midweekZoom}</p>` : ''}
          <p class="sec-attendance-card__meta">${midCount} registro${midCount === 1 ? '' : 's'} · média do mês</p>
        </article>
        <article class="sec-attendance-card sec-attendance-card--readonly">
          <h3 class="sec-attendance-card__title">Final de semana</h3>
          <p class="sec-attendance-card__value">${attendance.weekend || '—'}</p>
          ${attendance.weekendZoom != null ? `<p class="sec-attendance-card__zoom">Zoom: ${attendance.weekendZoom}</p>` : ''}
          <p class="sec-attendance-card__meta">${weekCount} registro${weekCount === 1 ? '' : 's'} · média do mês</p>
        </article>
      </div>`;

    if (!monthLogs.length) {
      historyRoot.innerHTML = '<p class="sec-empty">Nenhum registro de assistência neste mês. A equipe de Áudio e Vídeo preenche após cada reunião.</p>';
      return;
    }

    historyRoot.innerHTML = monthLogs.map((row) => `
      <article class="sec-attendance-log">
        <div class="sec-attendance-log__main">
          <p class="sec-attendance-log__date">${escapeHtml(fmtDate(row.meeting_date))}</p>
          <p class="sec-attendance-log__kind">${escapeHtml(meetingKindLabel(row.meeting_kind))}</p>
        </div>
        <div class="sec-attendance-log__counts">
          <span class="sec-attendance-log__count">${escapeHtml(String(row.attendance_count))}</span>
          ${row.zoom_attendance_count != null ? `<span class="sec-attendance-log__zoom">Zoom ${escapeHtml(String(row.zoom_attendance_count))}</span>` : ''}
        </div>
        <div class="sec-attendance-log__meta">
          ${row.remarks ? `<p class="sec-attendance-log__remarks">${escapeHtml(row.remarks)}</p>` : ''}
          <p class="sec-attendance-log__by">
            ${escapeHtml(row.profiles?.full_name || 'Áudio e Vídeo')}
            · ${escapeHtml(fmtDateTime(row.created_at))}
          </p>
        </div>
      </article>`).join('');
  }

  function renderS1Summary() {
    const root = document.getElementById('sec-s1-summary');
    if (!root) return;
    const pub = statsForType('publicador');
    const aux = statsForType('pioneiro_auxiliar');
    const reg = statsForType('pioneiro_regular');
    const closed = monthStatus.is_closed;
    root.innerHTML = `
      <div class="sec-s1-head">
        <p class="sec-s1-status ${closed ? 'sec-s1-status--closed' : ''}">
          ${closed ? 'Mês fechado' : 'Mês aberto'}
        </p>
        ${monthStatus.observations ? `<p class="sec-s1-notes">${escapeHtml(monthStatus.observations)}</p>` : ''}
      </div>
      <div class="sec-stats-grid sec-stats-grid--s1">
        ${renderStatCard('Publicadores', [
          { label: 'Relatórios', total: pub.submitted },
          { label: 'Estudos bíblicos', total: pub.studies }
        ])}
        ${renderStatCard('Pioneiros auxiliares', [
          { label: 'Relatórios', total: aux.submitted },
          { label: 'Horas', total: `${aux.hours}h` }
        ])}
        ${renderStatCard('Pioneiros regulares', [
          { label: 'Relatórios', total: reg.submitted },
          { label: 'Horas', total: `${reg.hours}h` }
        ])}
      </div>
      <div class="sec-s1-attendance">
        <p>Assistência meio de semana (média): <strong>${attendance.midweek}</strong></p>
        <p>Assistência final de semana (média): <strong>${attendance.weekend}</strong></p>
      </div>`;
  }

  function renderGroupsList() {
    const root = document.getElementById('sec-groups-list');
    if (!root) return;
    root.innerHTML = groups.map((g) => `
      <div class="sec-group-row">
        <span>${escapeHtml(g.name)}</span>
        <button type="button" class="sec-toolbar-btn sec-toolbar-btn--danger sec-toolbar-btn--sm" data-sec-del-group="${g.id}">Excluir</button>
      </div>`).join('') || '<p class="sec-empty">Nenhum grupo cadastrado.</p>';
  }

  function fillSettingsForm() {
    document.getElementById('sec-setting-reminder').value = settings.reminder_message || '';
    document.getElementById('sec-setting-lastname-first').checked = !!settings.show_last_name_first;
    document.getElementById('sec-setting-sc-name').value = settings.circuit_overseer_name || '';
    renderGroupsList();
  }

  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('hidden');
    m.setAttribute('aria-hidden', 'false');
    document.body.classList.add('sec-modal-open');
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (!m || m.classList.contains('hidden')) return;
    m.classList.add('hidden');
    m.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.sec-modal:not(.hidden)')) document.body.classList.remove('sec-modal-open');
  }

  function openReportModal(profileId) {
    const p = publishers.find((x) => x.profile_id === profileId);
    if (!p) return;
    const r = reportFor(profileId) || {};
    document.getElementById('sec-report-profile-id').value = profileId;
    document.getElementById('sec-report-modal-title').textContent = displayName(p);
    document.getElementById('sec-report-modal-sub').textContent = TYPE_LABELS[p.publisher_type] || '';
    document.getElementById('sec-report-participated').checked = !!r.participated;
    document.getElementById('sec-report-hours').value = r.hours ?? '';
    document.getElementById('sec-report-studies').value = r.bible_studies ?? '';
    document.getElementById('sec-report-remarks').value = r.remarks || '';
    openModal('sec-report-modal');
  }

  function renderAnalysisModal() {
    const body = document.getElementById('sec-list-modal-body');
    document.getElementById('sec-list-modal-title').textContent = 'Relatório de análise de congregação';
    const sections = Object.entries(STATUS_LABELS).map(([key, title]) => {
      const items = publishers.filter((p) => p.status === key);
      if (!items.length) return '';
      return `
        <section class="sec-analysis-section">
          <h3>${escapeHtml(title)}</h3>
          ${items.map((p) => `
            <div class="sec-analysis-row">
              <span class="sec-analysis-row__name">${escapeHtml(displayName(p))}</span>
              <span class="sec-analysis-row__meta">${hasReport(p.profile_id) ? 'Com relatório' : 'Sem relatórios'}</span>
            </div>`).join('')}
        </section>`;
    }).join('');
    body.innerHTML = sections || '<p class="sec-empty">Nenhum dado para análise.</p>';
    openModal('sec-list-modal');
  }

  function renderPetitionsModal() {
    const body = document.getElementById('sec-list-modal-body');
    document.getElementById('sec-list-modal-title').textContent = 'Petições — Pioneiros auxiliares';
    const items = publishers.filter((p) => p.publisher_type === 'pioneiro_auxiliar');
    const byGroup = new Map();
    items.forEach((p) => {
      const g = p.group_name || 'Sem grupo';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push(p);
    });
    body.innerHTML = [...byGroup.entries()].map(([g, list]) => `
      <section class="sec-analysis-section">
        <h3>${escapeHtml(g)}</h3>
        ${list.map((p) => `
          <div class="sec-analysis-row">
            <span class="sec-analysis-row__name">${escapeHtml(displayName(p))}</span>
            <span class="sec-analysis-row__meta">${hasReport(p.profile_id) ? 'Com relatório' : 'Sem relatórios'}</span>
          </div>`).join('')}
      </section>`).join('') || '<p class="sec-empty">Nenhum pioneiro auxiliar cadastrado.</p>';
    openModal('sec-list-modal');
  }

  function renderAdjustmentsForm() {
    const form = document.getElementById('sec-adjustments-form');
    if (!form) return;
    const cats = [
      { id: 'publicadores', label: 'Publicadores', fields: ['relatorios', 'estudos_biblicos'] },
      { id: 'pioneiro_auxiliar', label: 'Pioneiros auxiliares', fields: ['relatorios', 'horas', 'estudos_biblicos'] },
      { id: 'pioneiro_regular', label: 'Pioneiros regulares', fields: ['relatorios', 'horas', 'estudos_biblicos'] }
    ];
    const fieldLabels = { relatorios: 'Relatórios', horas: 'Horas', estudos_biblicos: 'Estudos bíblicos' };
    form.innerHTML = cats.map((cat) => `
      <section class="sec-adj-section">
        <h3>${escapeHtml(cat.label)}</h3>
        ${cat.fields.map((f) => {
          const adj = adjustments.find((a) => a.category === cat.id && a.field_key === f);
          return `
          <label class="sec-adj-row">
            <span>${escapeHtml(fieldLabels[f])}</span>
            <input type="number" step="any" class="sec-input sec-adj-input"
              data-adj-cat="${cat.id}" data-adj-field="${f}" value="${adj?.adjustment_value ?? 0}"/>
          </label>`;
        }).join('')}
      </section>`).join('') + `
      <label class="sec-field sec-field--full">
        <span class="sec-label">Observações do mês</span>
        <textarea id="sec-month-observations" class="sec-input sec-textarea" rows="3">${escapeHtml(monthStatus.observations || '')}</textarea>
      </label>
      <div class="sec-modal__foot">
        <button type="button" class="sec-toolbar-btn sec-toolbar-btn--accent" id="sec-adj-save">Salvar ajustes</button>
      </div>`;
  }

  async function loadData() {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEndDate = new Date(year, month, 0);
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`;

    const [gRes, pRes, rRes, mRes, aRes, logRes, adjRes, sRes] = await Promise.all([
      client.from('secretary_service_groups').select('id, name, sort_order').order('sort_order'),
      client.from('secretary_publisher_profiles').select(`
        profile_id, group_id, publisher_type, status, baptism_date, birth_date, phone, email, is_starred, notes,
        profiles ( full_name, username, role ),
        secretary_service_groups ( name )
      `),
      client.from('secretary_field_reports').select('*').eq('service_year', year).eq('service_month', month),
      client.from('secretary_month_status').select('*').eq('service_year', year).eq('service_month', month).maybeSingle(),
      client.from('secretary_meeting_attendance').select('*').eq('service_year', year).eq('service_month', month),
      client.from('secretary_attendance_logs').select(`
        id, meeting_date, meeting_kind, attendance_count, zoom_attendance_count, remarks, created_at,
        profiles:submitted_by ( full_name )
      `).gte('meeting_date', monthStart).lte('meeting_date', monthEnd).order('meeting_date', { ascending: false }),
      client.from('secretary_month_adjustments').select('*').eq('service_year', year).eq('service_month', month),
      client.from('secretary_settings').select('*').eq('id', true).maybeSingle()
    ]);

    if (gRes.error) throw gRes.error;
    if (pRes.error) throw pRes.error;
    if (rRes.error) throw rRes.error;

    groups = gRes.data || [];
    publishers = (pRes.data || []).map((row) => ({
      profile_id: row.profile_id,
      group_id: row.group_id,
      group_name: row.secretary_service_groups?.name || '',
      publisher_type: row.publisher_type,
      status: row.status,
      baptism_date: row.baptism_date,
      birth_date: row.birth_date,
      phone: row.phone,
      email: row.email,
      is_starred: row.is_starred,
      notes: row.notes || '',
      full_name: row.profiles?.full_name || '',
      username: row.profiles?.username || ''
    })).sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'));

    reports = new Map((rRes.data || []).map((r) => [r.profile_id, r]));
    monthStatus = mRes.data || { is_closed: false, observations: '' };
    adjustments = adjRes.data || [];
    settings = sRes.data || {};
    attendanceLogs = logRes.error ? [] : (logRes.data || []);

    const monthLogs = logsForMonth(attendanceLogs, year, month);
    if (monthLogs.length) {
      applyAttendanceFromLogs(monthLogs);
    } else {
      const att = aRes.data || [];
      attendance.midweek = att.find((a) => a.meeting_kind === 'midweek')?.attendance_count ?? 0;
      attendance.weekend = att.find((a) => a.meeting_kind === 'weekend')?.attendance_count ?? 0;
    }
  }

  async function syncPublishersFromProfiles() {
    const { data: profiles, error } = await client
      .from('profiles')
      .select('id')
      .eq('role', 'publicador');
    if (error || !profiles?.length) return;
    const rows = profiles.map((p) => ({ profile_id: p.id }));
    await client.from('secretary_publisher_profiles').upsert(rows, { onConflict: 'profile_id', ignoreDuplicates: true });
  }

  function renderAll() {
    updateMonthLabel();
    renderKpiStrip();
    renderPubStats();
    renderPublisherList();
    renderReportList();
    renderAttendance();
    renderS1Summary();
    fillSettingsForm();
  }

  async function saveReport(e) {
    e.preventDefault();
    const profileId = document.getElementById('sec-report-profile-id').value;
    const payload = {
      profile_id: profileId,
      service_year: year,
      service_month: month,
      participated: document.getElementById('sec-report-participated').checked,
      hours: document.getElementById('sec-report-hours').value || null,
      bible_studies: document.getElementById('sec-report-studies').value || null,
      remarks: document.getElementById('sec-report-remarks').value.trim(),
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const { error } = await client.from('secretary_field_reports').upsert(payload, { onConflict: 'profile_id,service_year,service_month' });
    if (error) {
      showToast(toast, error.message, true);
      return;
    }
    showToast(toast, 'Relatório salvo.');
    closeModal('sec-report-modal');
    await loadData();
    renderAll();
  }

  async function closeMonth() {
    const missing = publishers.filter((p) => p.status === 'ativo' && !hasReport(p.profile_id)).length;
    let proceed = true;
    if (missing > 0) {
      proceed = window.JEDialog?.confirm
        ? await window.JEDialog.confirm({
          title: 'Fechar o mês',
          message: `Faltam ${missing} relatórios por entregar. Deseja continuar?`,
          confirmLabel: 'Fechar mês'
        })
        : window.confirm(`Faltam ${missing} relatórios. Continuar?`);
    }
    if (!proceed) return;
    const { error } = await client.from('secretary_month_status').upsert({
      service_year: year,
      service_month: month,
      is_closed: true,
      closed_at: new Date().toISOString(),
      closed_by: (await client.auth.getUser()).data.user?.id || null
    }, { onConflict: 'service_year,service_month' });
    if (error) {
      showToast(toast, error.message, true);
      return;
    }
    showToast(toast, 'Mês fechado.');
    await loadData();
    renderAll();
  }

  function exportS1Csv() {
    if (!monthStatus.is_closed) {
      const proceed = window.confirm('O mês ainda não está fechado. Deseja continuar com a exportação?');
      if (!proceed) return;
    }
    const pub = statsForType('publicador');
    const aux = statsForType('pioneiro_auxiliar');
    const reg = statsForType('pioneiro_regular');
    const lines = [
      ['Campo', 'Valor'],
      ['Mês', monthLabel(year, month)],
      ['Publicadores — Relatórios', pub.submitted],
      ['Publicadores — Estudos', pub.studies],
      ['Pioneiros aux. — Relatórios', aux.submitted],
      ['Pioneiros aux. — Horas', aux.hours],
      ['Pioneiros reg. — Relatórios', reg.submitted],
      ['Pioneiros reg. — Horas', reg.hours],
      ['Assistência meio de semana', attendance.midweek],
      ['Assistência final de semana', attendance.weekend]
    ];
    const csv = lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `S-1_${year}-${String(month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function saveSettings() {
    const payload = {
      id: true,
      reminder_message: document.getElementById('sec-setting-reminder').value.trim(),
      show_last_name_first: document.getElementById('sec-setting-lastname-first').checked,
      circuit_overseer_name: document.getElementById('sec-setting-sc-name').value.trim(),
      updated_at: new Date().toISOString()
    };
    const { error } = await client.from('secretary_settings').upsert(payload);
    if (error) {
      showToast(toast, error.message, true);
      return;
    }
    showToast(toast, 'Configurações salvas.');
    await loadData();
    renderAll();
    closeModal('sec-settings-modal');
  }

  async function addGroup() {
    const name = document.getElementById('sec-new-group-name').value.trim();
    if (!name) return;
    const { error } = await client.from('secretary_service_groups').insert({ name, sort_order: (groups.length + 1) * 10 });
    if (error) {
      showToast(toast, error.message, true);
      return;
    }
    document.getElementById('sec-new-group-name').value = '';
    await loadData();
    renderGroupsList();
  }

  async function deleteGroup(id) {
    const { error } = await client.from('secretary_service_groups').delete().eq('id', id);
    if (error) {
      showToast(toast, error.message, true);
      return;
    }
    await loadData();
    renderGroupsList();
  }

  async function saveAdjustments() {
    const inputs = document.querySelectorAll('.sec-adj-input');
    const rows = [...inputs].map((el) => ({
      service_year: year,
      service_month: month,
      category: el.dataset.adjCat,
      field_key: el.dataset.adjField,
      adjustment_value: Number(el.value) || 0
    }));
    if (rows.length) {
      const { error } = await client.from('secretary_month_adjustments').upsert(rows, { onConflict: 'service_year,service_month,category,field_key' });
      if (error) {
        showToast(toast, error.message, true);
        return;
      }
    }
    const obs = document.getElementById('sec-month-observations')?.value?.trim() || '';
    await client.from('secretary_month_status').upsert({
      service_year: year,
      service_month: month,
      is_closed: monthStatus.is_closed,
      observations: obs
    }, { onConflict: 'service_year,service_month' });
    showToast(toast, 'Ajustes salvos.');
    closeModal('sec-adjustments-modal');
    await loadData();
    renderAll();
  }

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('[data-sec-tab]').forEach((el) => {
      const on = el.dataset.secTab === tab;
      el.classList.toggle('active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.sec-panel').forEach((el) => {
      el.classList.toggle('active', el.id === `sec-panel-${tab}`);
    });
    const activeBtn = document.querySelector(`[data-sec-tab="${tab}"]`);
    updateNavIndicator(activeBtn);
    activeBtn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    if (tab === 'visita') window.JEAdminSecretarioVisit?.initVisit?.(client);
  }

  function bindEvents() {
    if (window.__JEAdminSecretarioServiceInit) return;
    window.__JEAdminSecretarioServiceInit = true;

    document.querySelectorAll('[data-sec-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.secTab));
    });

    document.querySelectorAll('[data-sec-pub-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        pubView = btn.dataset.secPubView;
        document.querySelectorAll('[data-sec-pub-view]').forEach((b) => b.classList.toggle('sec-segment__btn--active', b === btn));
        renderPubStats();
      });
    });

    document.getElementById('sec-month-prev')?.addEventListener('click', async () => {
      month -= 1;
      if (month < 1) { month = 12; year -= 1; }
      await loadData();
      renderAll();
    });

    document.getElementById('sec-month-next')?.addEventListener('click', async () => {
      month += 1;
      if (month > 12) { month = 1; year += 1; }
      await loadData();
      renderAll();
    });

    document.getElementById('sec-publisher-new')?.addEventListener('click', () => openPublisherModal());
    document.getElementById('sec-publisher-filter')?.addEventListener('change', renderPublisherList);
    document.getElementById('sec-publisher-list')?.addEventListener('click', (e) => {
      const id = e.target.closest('[data-sec-edit-publisher]')?.dataset.secEditPublisher;
      if (id) openPublisherModal(id);
    });
    document.getElementById('sec-publisher-form')?.addEventListener('submit', savePublisher);
    document.querySelectorAll('[data-sec-publisher-close]').forEach((el) => {
      el.addEventListener('click', () => closeModal('sec-publisher-modal'));
    });

    document.getElementById('sec-report-filter')?.addEventListener('change', renderReportList);
    document.getElementById('sec-report-list')?.addEventListener('click', (e) => {
      const id = e.target.closest('[data-sec-edit-report]')?.dataset.secEditReport;
      if (id) openReportModal(id);
    });
    document.getElementById('sec-report-form')?.addEventListener('submit', saveReport);
    document.querySelectorAll('[data-sec-report-close]').forEach((el) => el.addEventListener('click', () => closeModal('sec-report-modal')));

    document.getElementById('sec-settings-open')?.addEventListener('click', () => {
      fillSettingsForm();
      openModal('sec-settings-modal');
    });
    document.querySelectorAll('[data-sec-settings-close]').forEach((el) => el.addEventListener('click', () => closeModal('sec-settings-modal')));
    document.getElementById('sec-settings-save')?.addEventListener('click', saveSettings);
    document.getElementById('sec-new-group-add')?.addEventListener('click', addGroup);
    document.getElementById('sec-groups-list')?.addEventListener('click', (e) => {
      const id = e.target.closest('[data-sec-del-group]')?.dataset.secDelGroup;
      if (id) deleteGroup(id);
    });

    document.getElementById('sec-close-month')?.addEventListener('click', closeMonth);
    document.getElementById('sec-s1-export')?.addEventListener('click', exportS1Csv);
    document.getElementById('sec-adjustments-open')?.addEventListener('click', () => {
      renderAdjustmentsForm();
      openModal('sec-adjustments-modal');
    });
    document.querySelectorAll('[data-sec-adj-close]').forEach((el) => el.addEventListener('click', () => closeModal('sec-adjustments-modal')));
    document.getElementById('sec-adjustments-form')?.addEventListener('click', (e) => {
      if (e.target.id === 'sec-adj-save') saveAdjustments();
    });

    document.getElementById('sec-analysis-open')?.addEventListener('click', renderAnalysisModal);
    document.getElementById('sec-petitions-open')?.addEventListener('click', renderPetitionsModal);
    document.querySelectorAll('[data-sec-list-close]').forEach((el) => el.addEventListener('click', () => closeModal('sec-list-modal')));

    document.getElementById('sec-reminder-copy')?.addEventListener('click', async () => {
      const msg = settings.reminder_message || '';
      try {
        await navigator.clipboard.writeText(msg);
        showToast(toast, 'Lembrete copiado.');
      } catch {
        showToast(toast, msg, false);
      }
    });
  }

  async function initService(c) {
    client = c;
    toast = toastEl();
    bindEvents();
    try {
      await syncPublishersFromProfiles();
      await loadData();
      renderAll();
      switchTab('publicadores');
      queueNavIndicatorRefresh();
      window.addEventListener('resize', queueNavIndicatorRefresh);
    } catch (err) {
      showToast(toast, err?.message || 'Erro ao carregar dados do Secretário.', true);
    }
  }

  window.JEAdminSecretarioService = { initService, switchTab };
})();
