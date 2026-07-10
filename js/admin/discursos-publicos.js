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

  function layout() {
    root.innerHTML = `
      <div class="terr-nav-stage dp-nav-stage">
        <div class="terr-nav-scroll">
          <nav class="terr-nav dp-crm-nav" role="tablist" aria-label="Abas de Discursos Públicos">
            ${[['painel', 'Painel', 'dashboard'], ['agenda', 'Agenda', 'calendar_month'], ['oradores', 'Oradores', 'groups'], ['temas', 'Temas', 'menu_book'], ['arranjo', 'Arranjo', 'view_week']]
              .map(([id, label, icon], i) => `<button type="button" class="terr-tab${i ? '' : ' active'}" data-dp-tab="${id}" role="tab" title="${label}" aria-label="${label}">
                <span class="material-symbols-outlined" aria-hidden="true">${icon}</span>
                <span class="terr-tab-label">${label}</span>
              </button>`).join('')}
          </nav>
        </div>
      </div>
      <section id="dp-panel-painel" class="terr-panel active"></section>
      <section id="dp-panel-agenda" class="terr-panel"></section>
      <section id="dp-panel-oradores" class="terr-panel"></section>
      <section id="dp-panel-temas" class="terr-panel"></section>
      <section id="dp-panel-arranjo" class="terr-panel"></section>`;
  }

  function dateRange(days) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + days);
    return assignments.filter((a) => a.event_date >= today() && a.event_date <= end.toISOString().slice(0, 10));
  }

  function renderPanel() {
    const host = $('#dp-panel-painel');
    const next30 = dateRange(30);
    const upcoming = dateRange(56).sort((a, b) => a.event_date.localeCompare(b.event_date));
    const pending = assignments.filter((a) => a.confirmation_status === 'pendente' && a.event_date >= today()).length;
    const activeSpeakers = speakers.filter((s) => s.is_active).length;
    host.innerHTML = `
      <div class="terr-catalog-stats dp-stats">
        <article><strong>${next30.filter((a) => a.direction === 'receive').length}</strong><span>Recebemos — próximos 30 dias</span></article>
        <article><strong>${next30.filter((a) => a.direction === 'send').length}</strong><span>Enviamos — próximos 30 dias</span></article>
        <article><strong>${pending}</strong><span>Pendentes de confirmação</span></article>
        <article><strong>${activeSpeakers}</strong><span>Oradores ativos</span></article>
        <article><strong>${themes.filter((t) => t.is_active).length}</strong><span>Temas cadastrados</span></article>
      </div>
      <div class="terr-catalog-card">
        <div class="terr-catalog-heading"><div><h2>Próximas designações</h2><p>Próximas oito semanas</p></div><button type="button" class="btn-primary" data-dp-new>Nova designação</button></div>
        ${assignmentTable(upcoming, { dashboard: true })}</div>`;
    bindAssignmentActions(host);
  }

  function assignmentTable(rows, { dashboard = false } = {}) {
    if (!rows.length) return empty('Nenhuma designação encontrada.');
    return `<div class="terr-table-wrap"><table class="terr-catalog-table dp-table"><thead><tr>
      <th>Direção</th><th>Data</th><th>Orador</th><th>Tema</th><th>Congregação</th><th>Status</th>${dashboard ? '' : '<th></th>'}
    </tr></thead><tbody>${rows.map((a) => `<tr data-dp-edit="${a.id}" class="dp-assignment-row">
      <td><span class="dp-badge dp-badge--${a.direction}">${DIRECTION[a.direction]}</span></td>
      <td>${escapeHtml(dateText(a.event_date))}${a.event_time ? `<small>${escapeHtml(a.event_time.slice(0, 5))}</small>` : ''}</td>
      <td>${escapeHtml(a.speaker_name || a.speech_speakers?.full_name || '—')}</td>
      <td>${escapeHtml(assignmentTheme(a))}</td>
      <td>${escapeHtml(a.congregation_name || a.speech_congregations?.name || '—')}</td>
      <td><span class="dp-status dp-status--${a.confirmation_status}">${STATUS[a.confirmation_status]}</span></td>
      ${dashboard ? '' : `<td class="dp-actions"><button type="button" data-dp-wa="${a.id}" title="WhatsApp">WhatsApp</button><button type="button" data-dp-delete="${a.id}" title="Excluir">Excluir</button></td>`}
    </tr>`).join('')}</tbody></table></div>`;
  }

  function renderAgenda() {
    const host = $('#dp-panel-agenda');
    const month = host.dataset.month || new Date().toISOString().slice(0, 7);
    const direction = host.dataset.direction || '';
    const status = host.dataset.status || '';
    const rows = assignments.filter((a) => (!month || a.event_date.startsWith(month)) && (!direction || a.direction === direction) && (!status || a.confirmation_status === status))
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
    host.innerHTML = `
      <div class="terr-sched-toolbar dp-toolbar">
        <label>Direção <select data-dp-filter="direction">${option('', 'Todos', direction)}${option('receive', 'Recebemos', direction)}${option('send', 'Enviamos', direction)}</select></label>
        <label>Status <select data-dp-filter="status">${option('', 'Todos', status)}${Object.entries(STATUS).map(([k, v]) => option(k, v, status)).join('')}</select></label>
        <label>Mês <input type="month" value="${month}" data-dp-month></label>
        <button type="button" class="btn-primary" data-dp-new>Nova designação</button>
        <button type="button" data-dp-wa-range>WhatsApp da semana</button>
      </div>${assignmentTable(rows)}`;
    host.querySelectorAll('[data-dp-filter]').forEach((el) => el.addEventListener('change', () => { host.dataset[el.dataset.dpFilter] = el.value; renderAgenda(); }));
    host.querySelector('[data-dp-month]')?.addEventListener('change', (e) => { host.dataset.month = e.target.value; renderAgenda(); });
    bindAssignmentActions(host);
  }

  function speakerOptions(selected, includeBlank = true) {
    return `${includeBlank ? option('', 'Digite ou selecione...', selected) : ''}${speakers.filter((s) => s.is_active).sort((a, b) => a.full_name.localeCompare(b.full_name))
      .map((s) => option(s.id, `${s.full_name}${s.is_local ? ' (local)' : ''}`, selected)).join('')}`;
  }
  function congregationOptions(selected) {
    return `${option('', 'Digite ou selecione...', selected)}${congregations.filter((c) => c.is_active).sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => option(c.id, c.name, selected)).join('')}`;
  }
  function themeOptions(selected, speakerId) {
    const speaker = getSpeaker(speakerId);
    const prepared = new Set((speaker?.speech_speaker_themes || []).map((x) => x.theme_id));
    const ordered = [...themes].filter((t) => t.is_active).sort((a, b) => (prepared.has(b.id) - prepared.has(a.id)) || (a.outline_number - b.outline_number));
    return `${option('', 'Digite ou selecione...', selected)}${ordered.map((t) => option(t.id, `${prepared.has(t.id) ? '★ ' : ''}Esboço ${t.outline_number} — ${t.title}`, selected)).join('')}`;
  }

  function openAssignmentModal(existing) {
    const a = existing || { direction: 'receive', event_date: today(), modality: 'presencial', confirmation_status: 'pendente' };
    openModal(`${existing ? 'Editar' : 'Nova'} designação`, `
      <form class="dp-form" data-dp-assignment-form>
        <label>Direção<select name="direction">${option('receive', 'Recebemos', a.direction)}${option('send', 'Enviamos', a.direction)}</select></label>
        <label>Data<input required name="event_date" type="date" value="${escapeHtml(a.event_date || '')}"></label>
        <label>Horário<input name="event_time" type="time" value="${escapeHtml((a.event_time || '').slice(0, 5))}"></label>
        <label>Orador<select name="speaker_id" data-dp-speaker>${speakerOptions(a.speaker_id)}</select><input name="speaker_name" placeholder="Ou informe o nome" value="${escapeHtml(a.speaker_name || '')}"></label>
        <label class="dp-span-2">Tema<input data-dp-theme-filter placeholder="Buscar esboço ou título"><select name="theme_id" data-dp-theme>${themeOptions(a.theme_id, a.speaker_id)}</select><input name="theme_title" placeholder="Ou informe o tema" value="${escapeHtml(a.theme_title || '')}"></label>
        <label>Congregação<select name="congregation_id" data-dp-congregation>${congregationOptions(a.congregation_id)}</select><input name="congregation_name" placeholder="Ou informe a congregação" value="${escapeHtml(a.congregation_name || '')}"></label>
        <label>Cântico inicial<input name="opening_song" value="${escapeHtml(a.opening_song || '')}"></label>
        <label>Modalidade<select name="modality">${option('presencial', 'Presencial', a.modality)}${option('online', 'Online', a.modality)}</select></label>
        <label>Status<select name="confirmation_status">${Object.entries(STATUS).map(([k, v]) => option(k, v, a.confirmation_status)).join('')}</select></label>
        <label class="dp-span-2">Observações<textarea name="notes" rows="3">${escapeHtml(a.notes || '')}</textarea></label>
        <footer><button type="button" data-dp-close>Cancelar</button><button class="btn-primary">Salvar</button></footer>
      </form>`);
    const form = document.querySelector('[data-dp-assignment-form]');
    form.querySelector('[data-dp-theme-filter]').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      form.querySelectorAll('[data-dp-theme] option').forEach((item) => {
        item.hidden = !!q && !item.textContent.toLowerCase().includes(q);
      });
    });
    form.querySelector('[data-dp-speaker]').addEventListener('change', (e) => {
      const select = form.querySelector('[data-dp-theme]');
      select.innerHTML = themeOptions(select.value, e.target.value);
      const s = getSpeaker(e.target.value); if (s && !form.speaker_name.value) form.speaker_name.value = s.full_name;
    });
    form.querySelector('[data-dp-theme]').addEventListener('change', (e) => {
      const t = getTheme(e.target.value); if (t && !form.theme_title.value) form.theme_title.value = t.title;
    });
    form.querySelector('[data-dp-congregation]').addEventListener('change', (e) => {
      const c = getCongregation(e.target.value); if (c && !form.congregation_name.value) form.congregation_name.value = c.name;
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(form)); const s = getSpeaker(v.speaker_id); const t = getTheme(v.theme_id); const c = getCongregation(v.congregation_id);
      const payload = { ...v, event_time: v.event_time || null, speaker_id: v.speaker_id || null, theme_id: v.theme_id || null, congregation_id: v.congregation_id || null,
        speaker_name: text(v.speaker_name) || s?.full_name || null, theme_title: text(v.theme_title) || t?.title || null, outline_number: t?.outline_number || null,
        congregation_name: text(v.congregation_name) || c?.name || null, opening_song: text(v.opening_song) || null, notes: text(v.notes) || null };
      const q = existing ? client.from('speech_assignments').update(payload).eq('id', existing.id) : client.from('speech_assignments').insert(payload);
      const { error } = await q; if (error) return toast(errorText(error), true);
      closeModal(); await loadData(); refresh(); toast('Designação salva.');
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

  function renderSpeakers() {
    const host = $('#dp-panel-oradores'); const q = host.dataset.query || '';
    const rows = speakers.filter((s) => `${s.full_name} ${s.phone} ${s.email}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.full_name.localeCompare(b.full_name));
    const count = (fn) => speakers.filter(fn).length;
    host.innerHTML = `
      <div class="terr-catalog-stats dp-stats"><article><strong>${speakers.length}</strong><span>Total</span></article><article><strong>${count((s) => s.is_local)}</strong><span>Locais</span></article><article><strong>${count((s) => s.privilege === 'anciao')}</strong><span>Anciãos</span></article><article><strong>${count((s) => s.privilege === 'servo_ministerial')}</strong><span>Servos</span></article></div>
      <div class="terr-catalog-card"><div class="terr-sched-toolbar"><input data-dp-speaker-search placeholder="Buscar orador" value="${escapeHtml(q)}"><button class="btn-primary" type="button" data-dp-speaker-new>Novo orador</button></div>
      ${rows.length ? `<div class="terr-table-wrap"><table class="terr-catalog-table"><thead><tr><th>Nome</th><th>Congregação</th><th>Privilégio</th><th>Telefone</th><th>E-mail</th><th>Temas</th><th></th></tr></thead><tbody>${rows.map((s) => `<tr><td>${escapeHtml(s.full_name)}${s.is_local ? ' <small>Local</small>' : ''}</td><td>${escapeHtml(s.speech_congregations?.name || '—')}</td><td>${PRIVILEGE[s.privilege]}</td><td>${escapeHtml(s.phone || '—')}</td><td>${escapeHtml(s.email || '—')}</td><td>${s.speech_speaker_themes?.length || 0}</td><td><button type="button" data-dp-speaker-edit="${s.id}">Editar</button></td></tr>`).join('')}</tbody></table></div>` : empty('Nenhum orador encontrado.')}</div>`;
    host.querySelector('[data-dp-speaker-search]').addEventListener('input', (e) => { host.dataset.query = e.target.value; renderSpeakers(); });
    host.querySelector('[data-dp-speaker-new]').addEventListener('click', () => openSpeakerModal());
    host.querySelectorAll('[data-dp-speaker-edit]').forEach((b) => b.addEventListener('click', () => openSpeakerModal(getSpeaker(b.dataset.dpSpeakerEdit))));
  }

  function openSpeakerModal(existing) {
    const s = existing || { privilege: 'anciao', is_local: true, is_active: true };
    const selected = new Set((s.speech_speaker_themes || []).map((x) => x.theme_id));
    openModal(`${existing ? 'Editar' : 'Novo'} orador`, `<form class="dp-form" data-dp-speaker-form>
      <label class="dp-span-2">Nome completo<input required name="full_name" value="${escapeHtml(s.full_name || '')}"></label>
      <label>Congregação<select name="congregation_id">${congregationOptions(s.congregation_id)}</select><input name="quick_congregation" placeholder="Nova congregação (rápido)"></label>
      <label>Telefone<input name="phone" value="${escapeHtml(s.phone || '')}"></label><label>E-mail<input name="email" value="${escapeHtml(s.email || '')}"></label>
      <label>Privilégio<select name="privilege">${Object.entries(PRIVILEGE).map(([k, v]) => option(k, v, s.privilege)).join('')}</select></label>
      <label><input name="is_local" type="checkbox"${s.is_local ? ' checked' : ''}> Orador local</label><label><input name="is_active" type="checkbox"${s.is_active ? ' checked' : ''}> Ativo</label>
      <label class="dp-span-2">Observações<textarea name="notes" rows="2">${escapeHtml(s.notes || '')}</textarea></label>
      <div class="dp-span-2"><label>Temas preparados</label><input data-dp-theme-search placeholder="Filtrar por número ou título"><div class="dp-theme-checks" data-dp-theme-checks>${themeCheckboxes(selected)}</div></div>
      <footer><button type="button" data-dp-close>Cancelar</button><button class="btn-primary">Salvar</button></footer></form>`);
    const form = document.querySelector('[data-dp-speaker-form]');
    form.querySelector('[data-dp-theme-search]').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase(); form.querySelectorAll('[data-dp-theme-checks] label').forEach((l) => { l.hidden = !l.textContent.toLowerCase().includes(q); });
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); const v = Object.fromEntries(new FormData(form));
      let congregationId = v.congregation_id || null;
      if (text(v.quick_congregation)) {
        const { data, error } = await client.from('speech_congregations').insert({ name: text(v.quick_congregation) }).select().single();
        if (error) return toast(errorText(error), true); congregationId = data.id;
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
    return themes.filter((t) => t.is_active).map((t) => `<label><input type="checkbox" name="theme_ids" value="${t.id}"${selected.has(t.id) ? ' checked' : ''}> ${t.outline_number} — ${escapeHtml(t.title)}</label>`).join('');
  }

  function renderThemes() {
    const host = $('#dp-panel-temas'); const q = host.dataset.query || '';
    const rows = themes.filter((t) => `${t.outline_number} ${t.title}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.outline_number - b.outline_number);
    const preparedCount = (id) => speakers.filter((s) => (s.speech_speaker_themes || []).some((x) => x.theme_id === id)).length;
    host.innerHTML = `<div class="terr-catalog-card"><div class="terr-sched-toolbar"><input data-dp-themes-search placeholder="Buscar por número ou título" value="${escapeHtml(q)}"></div><p class="dp-catalog-note">Catálogo de temas baseado na lista S-34 (jw.org). Esta lista é somente leitura.</p>
      ${rows.length ? `<div class="terr-table-wrap"><table class="terr-catalog-table"><thead><tr><th>Esboço</th><th>Título</th><th>Oradores preparados</th></tr></thead><tbody>${rows.map((t) => `<tr><td>${t.outline_number}</td><td>${escapeHtml(t.title)}</td><td>${preparedCount(t.id)}</td></tr>`).join('')}</tbody></table></div>` : empty('Nenhum tema encontrado.')}</div>`;
    host.querySelector('[data-dp-themes-search]').addEventListener('input', (e) => { host.dataset.query = e.target.value; renderThemes(); });
  }

  function renderArrangement() {
    $('#dp-panel-arranjo').innerHTML = `<div class="terr-catalog-card dp-arrangement-note"><h2>Arranjo mensal</h2><p>O arranjo mensal legado continua disponível para consulta. Para novas designações, use a <strong>Agenda</strong>.</p><p>As designações recebidas em <strong>speech_assignments</strong> serão usadas para a sincronização do programa de final de semana.</p><button type="button" data-dp-go-agenda>Ir para Agenda</button></div>`;
    $('#dp-panel-arranjo [data-dp-go-agenda]').addEventListener('click', () => selectTab('agenda'));
  }

  function selectTab(tab) {
    root.querySelectorAll('[data-dp-tab]').forEach((b) => b.classList.toggle('active', b.dataset.dpTab === tab));
    root.querySelectorAll('.terr-panel').forEach((p) => p.classList.toggle('active', p.id === `dp-panel-${tab}`));
    if (!rendered[tab]) { ({ painel: renderPanel, agenda: renderAgenda, oradores: renderSpeakers, temas: renderThemes, arranjo: renderArrangement }[tab])(); rendered[tab] = true; }
  }
  function refresh() {
    Object.keys(rendered).forEach((tab) => { if (rendered[tab]) ({ painel: renderPanel, agenda: renderAgenda, oradores: renderSpeakers, temas: renderThemes, arranjo: renderArrangement }[tab])(); });
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
      renderPanel();
      rendered.painel = true;
    } catch (err) {
      console.error('Discursos Públicos:', err);
      toast(errorText(err), true);
      const host = $('#dp-panel-painel');
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
