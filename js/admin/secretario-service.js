(function () {
  const { getClient, showToast, escapeHtml } = window.JEAdmin;

  const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const TYPE_LABELS = {
    publicador: 'Publicadores',
    pioneiro_auxiliar: 'Pioneiros auxiliares',
    pioneiro_regular: 'Pioneiros regulares'
  };
  const STATUS_LABELS = {
    ativo: 'Publicadores ativos',
    irregular: 'Irregulares',
    inativo: 'Desativados',
    reintegrado: 'Readmitidos',
    primeiro_relatorio: 'Primeiro registro de relatório'
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
  let attendance = { midweek: 0, weekend: 0, midweekExtra: null, weekendExtra: null };
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
    document.getElementById('sec-adj-month-label')?.replaceChildren?.();
    const adj = document.getElementById('sec-adj-month-label');
    if (adj) adj.textContent = monthLabel(year, month);
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
    const body = rows.map((row) => `
      <div class="sec-stat-row">
        <span class="sec-stat-row__label">${escapeHtml(row.label)}</span>
        <span class="sec-stat-row__vals">
          ${row.total != null ? `<span class="sec-stat-row__total">${escapeHtml(String(row.total))}</span>` : ''}
          ${row.avg != null ? `<span class="sec-stat-row__avg">${escapeHtml(String(row.avg))}</span>` : ''}
        </span>
      </div>`).join('');
    return `<article class="sec-stat-card ${mod}"><h3 class="sec-stat-card__title">${escapeHtml(title)}</h3>${body}</article>`;
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

  function renderAttendance() {
    const root = document.getElementById('sec-attendance-cards');
    if (!root) return;
    const extra = settings.extra_attendance_count;
    root.innerHTML = ['midweek', 'weekend'].map((kind) => {
      const label = kind === 'midweek' ? 'Reunião de meio de semana' : 'Reunião de final de semana';
      const count = kind === 'midweek' ? attendance.midweek : attendance.weekend;
      const extraVal = kind === 'midweek' ? attendance.midweekExtra : attendance.weekendExtra;
      return `
      <article class="sec-attendance-card">
        <h3 class="sec-attendance-card__title">${label}</h3>
        <label class="sec-field">
          <span class="sec-label">Assistência</span>
          <input type="number" min="0" class="sec-input" data-sec-att="${kind}" value="${count}"/>
        </label>
        ${extra ? `
        <label class="sec-field">
          <span class="sec-label">Contagem extra</span>
          <input type="number" min="0" class="sec-input" data-sec-att-extra="${kind}" value="${extraVal ?? ''}"/>
        </label>` : ''}
        <button type="button" class="sec-btn sec-btn--primary sec-attendance-save" data-sec-att-save="${kind}">Salvar</button>
      </article>`;
    }).join('');
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
        <p>Assistência meio de semana: <strong>${attendance.midweek}</strong></p>
        <p>Assistência final de semana: <strong>${attendance.weekend}</strong></p>
      </div>`;
  }

  function renderGroupsList() {
    const root = document.getElementById('sec-groups-list');
    if (!root) return;
    root.innerHTML = groups.map((g) => `
      <div class="sec-group-row">
        <span>${escapeHtml(g.name)}</span>
        <button type="button" class="sec-btn sec-btn--danger sec-btn--xs" data-sec-del-group="${g.id}">Excluir</button>
      </div>`).join('') || '<p class="sec-empty">Nenhum grupo cadastrado.</p>';
  }

  function fillSettingsForm() {
    document.getElementById('sec-setting-reminder').value = settings.reminder_message || '';
    document.getElementById('sec-setting-lastname-first').checked = !!settings.show_last_name_first;
    document.getElementById('sec-setting-extra-attendance').checked = !!settings.extra_attendance_count;
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
        <button type="button" class="sec-btn sec-btn--primary" id="sec-adj-save">Salvar ajustes</button>
      </div>`;
  }

  async function loadData() {
    const [gRes, pRes, rRes, mRes, aRes, adjRes, sRes] = await Promise.all([
      client.from('secretary_service_groups').select('id, name, sort_order').order('sort_order'),
      client.from('secretary_publisher_profiles').select(`
        profile_id, group_id, publisher_type, status, baptism_date, birth_date, phone, email, is_starred,
        profiles ( full_name, username, role ),
        secretary_service_groups ( name )
      `),
      client.from('secretary_field_reports').select('*').eq('service_year', year).eq('service_month', month),
      client.from('secretary_month_status').select('*').eq('service_year', year).eq('service_month', month).maybeSingle(),
      client.from('secretary_meeting_attendance').select('*').eq('service_year', year).eq('service_month', month),
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
      full_name: row.profiles?.full_name || '',
      username: row.profiles?.username || ''
    })).sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'));

    reports = new Map((rRes.data || []).map((r) => [r.profile_id, r]));
    monthStatus = mRes.data || { is_closed: false, observations: '' };
    adjustments = adjRes.data || [];
    settings = sRes.data || {};

    const att = aRes.data || [];
    attendance.midweek = att.find((a) => a.meeting_kind === 'midweek')?.attendance_count ?? 0;
    attendance.weekend = att.find((a) => a.meeting_kind === 'weekend')?.attendance_count ?? 0;
    attendance.midweekExtra = att.find((a) => a.meeting_kind === 'midweek')?.extra_count ?? null;
    attendance.weekendExtra = att.find((a) => a.meeting_kind === 'weekend')?.extra_count ?? null;
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
    renderPubStats();
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

  async function saveAttendance(kind) {
    const count = Number(document.querySelector(`[data-sec-att="${kind}"]`)?.value) || 0;
    const extraEl = document.querySelector(`[data-sec-att-extra="${kind}"]`);
    const payload = {
      service_year: year,
      service_month: month,
      meeting_kind: kind,
      attendance_count: count,
      extra_count: extraEl ? (extraEl.value === '' ? null : Number(extraEl.value)) : null
    };
    const { error } = await client.from('secretary_meeting_attendance').upsert(payload, { onConflict: 'service_year,service_month,meeting_kind' });
    if (error) {
      showToast(toast, error.message, true);
      return;
    }
    showToast(toast, 'Assistência salva.');
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
      extra_attendance_count: document.getElementById('sec-setting-extra-attendance').checked,
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
    document.querySelectorAll('.sec-tab').forEach((el) => {
      const on = el.dataset.secTab === tab;
      el.classList.toggle('sec-tab--active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.sec-panel').forEach((el) => {
      el.classList.toggle('hidden', el.id !== `sec-panel-${tab}`);
    });
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
        document.querySelectorAll('[data-sec-pub-view]').forEach((b) => b.classList.toggle('sec-subtab--active', b === btn));
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

    document.getElementById('sec-report-filter')?.addEventListener('change', renderReportList);
    document.getElementById('sec-report-list')?.addEventListener('click', (e) => {
      const id = e.target.closest('[data-sec-edit-report]')?.dataset.secEditReport;
      if (id) openReportModal(id);
    });
    document.getElementById('sec-report-form')?.addEventListener('submit', saveReport);
    document.querySelectorAll('[data-sec-report-close]').forEach((el) => el.addEventListener('click', () => closeModal('sec-report-modal')));

    document.getElementById('sec-attendance-cards')?.addEventListener('click', (e) => {
      const kind = e.target.closest('[data-sec-att-save]')?.dataset.secAttSave;
      if (kind) saveAttendance(kind);
    });

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
    } catch (err) {
      showToast(toast, err?.message || 'Erro ao carregar dados do Secretário.', true);
    }
  }

  window.JEAdminSecretarioService = { initService };
})();
