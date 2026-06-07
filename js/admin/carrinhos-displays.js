(function () {
  const { guardPermission, getClient, showToast, escapeHtml } = window.JEAdmin;
  const helpers = window.JEEquipmentSchedule;

  let toast;
  let client;
  let currentWeek;
  let slots = [];
  let publishers = [];
  let profiles = [];
  let pubSearch = '';

  function toastEl() {
    return document.getElementById('hub-admin-toast') || document.getElementById('admin-toast');
  }

  function moveNavIndicator(tab) {
    const indicator = document.getElementById('eq-nav-indicator');
    if (!indicator || !tab) return;
    indicator.style.width = `${tab.offsetWidth}px`;
    indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
  }

  function setupTabs() {
    const tabs = document.querySelectorAll('[data-eq-tab]');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.eq-panel').forEach((panel) => {
          panel.classList.toggle('active', panel.id === `eq-panel-${tab.dataset.eqTab}`);
        });
        moveNavIndicator(tab);
      });
    });
    moveNavIndicator(document.querySelector('[data-eq-tab].active'));
    window.addEventListener('resize', () => {
      moveNavIndicator(document.querySelector('[data-eq-tab].active'));
    });
  }

  function buildDayCheckboxes(container, prefix, selectedDays) {
    if (!container) return;
    const selected = new Set(selectedDays || helpers.EQUIPMENT_DAYS);
    container.innerHTML = helpers.EQUIPMENT_DAYS.map((day) => `
      <label class="eq-pub-day-pick">
        <input type="checkbox" name="${prefix}-day" value="${escapeHtml(day)}" ${selected.has(day) ? 'checked' : ''}/>
        ${escapeHtml(day.slice(0, 3))}
      </label>`).join('');
  }

  function fillSelectOptions() {
    const daySel = document.getElementById('eq-slot-day');
    const periodSel = document.getElementById('eq-slot-period');
    if (daySel && !daySel.options.length) {
      daySel.innerHTML = helpers.EQUIPMENT_DAYS.map((d) =>
        `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`
      ).join('');
    }
    if (periodSel && !periodSel.options.length) {
      periodSel.innerHTML = helpers.PERIOD_LABELS.map((p) =>
        `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`
      ).join('');
    }
    buildDayCheckboxes(document.getElementById('eq-pub-days'), 'eq-pub', helpers.EQUIPMENT_DAYS);
  }

  async function loadProfiles() {
    const { data, error } = await client
      .from('profiles')
      .select('id, full_name, username, role, avatar_url')
      .order('full_name');
    if (error) throw error;
    profiles = data || [];
    const select = document.getElementById('eq-publisher-profile');
    if (!select) return;
    const used = new Set(publishers.filter((p) => p.profile_id).map((p) => p.profile_id));
    select.innerHTML = ['<option value="">Selecione…</option>']
      .concat(
        profiles
          .filter((p) => !used.has(p.id))
          .map((p) => `<option value="${p.id}">${escapeHtml(p.full_name)}</option>`)
      )
      .join('');
  }

  async function loadPublishers() {
    const { data, error } = await client
      .from('equipment_publishers')
      .select('*, profiles(full_name, username, avatar_url, role)')
      .order('publisher_name');
    if (error) throw error;
    publishers = data || [];
    renderPublishers();
    await loadProfiles();
  }

  function publisherName(row) {
    return row.profiles?.full_name || row.publisher_name || '—';
  }

  async function loadSlots() {
    const { data, error } = await client
      .from('equipment_schedule_slots')
      .select('*')
      .order('sort_order');
    if (error) throw error;
    slots = data || [];
    renderSchedule();
  }

  function parsePublisherNotes(notes) {
    if (!notes) return { grupo: '', casa: '' };
    const grupoMatch = notes.match(/Grupo:\s*([^·]+)/i);
    const casaMatch = notes.match(/Casa:\s*(.+)$/i);
    return {
      grupo: grupoMatch ? grupoMatch[1].trim() : '',
      casa: casaMatch ? casaMatch[1].trim() : ''
    };
  }

  function publisherAvatarHtml(row) {
    const profile = row.profiles;
    const inner = profile && window.JEAuth?.renderAvatarHtml
      ? window.JEAuth.renderAvatarHtml(profile, { size: 28, className: 'je-profile-avatar' })
      : '<span class="material-symbols-outlined" aria-hidden="true">person</span>';
    return `<span class="eq-pub-avatar" aria-hidden="true">${inner}</span>`;
  }

  function renderPublisherServicePills(row) {
    const pills = [];
    if (row.can_carrinho) pills.push('<span class="eq-pub-svc-pill eq-pub-svc-pill--cart">Carrinho</span>');
    if (row.can_display) pills.push('<span class="eq-pub-svc-pill eq-pub-svc-pill--display">Display</span>');
    return pills.join('') || '<span class="eq-pub-day">—</span>';
  }

  function renderPublisherDayPills(row) {
    const days = row.available_days || [];
    if (!days.length) return '<span class="eq-pub-day">—</span>';
    return days.map((day) =>
      `<span class="eq-pub-day" title="${escapeHtml(day)}">${escapeHtml(day.slice(0, 3))}</span>`
    ).join('');
  }

  function getFilteredPublishers() {
    const q = pubSearch.trim().toLowerCase();
    if (!q) return publishers;
    return publishers.filter((row) => {
      const name = publisherName(row).toLowerCase();
      const { grupo, casa } = parsePublisherNotes(row.notes);
      return name.includes(q) || grupo.toLowerCase().includes(q) || casa.toLowerCase().includes(q);
    });
  }

  function updatePublisherStats() {
    const active = publishers.filter((p) => p.is_active !== false);
    const countEl = document.getElementById('eq-pub-count');
    const statTotal = document.getElementById('eq-pub-stat-total');
    const statActive = document.getElementById('eq-pub-stat-active');
    const statCart = document.getElementById('eq-pub-stat-carrinho');
    const statDisplay = document.getElementById('eq-pub-stat-display');

    if (countEl) countEl.textContent = `${publishers.length} cadastrados`;
    if (statTotal) statTotal.textContent = String(publishers.length);
    if (statActive) statActive.textContent = String(active.length);
    if (statCart) statCart.textContent = String(publishers.filter((p) => p.can_carrinho).length);
    if (statDisplay) statDisplay.textContent = String(publishers.filter((p) => p.can_display).length);
  }

  function renderPublishersTable() {
    const body = document.getElementById('eq-pub-table-body');
    const foot = document.getElementById('eq-pub-table-foot');
    if (!body) return;

    updatePublisherStats();
    const filtered = getFilteredPublishers();

    if (!filtered.length) {
      body.innerHTML = `
        <div class="eq-pub-empty !border-0 !rounded-none">
          <span class="material-symbols-outlined" aria-hidden="true">search_off</span>
          <p class="text-sm">${publishers.length ? 'Nenhum publicador corresponde à busca.' : 'Nenhum publicador cadastrado.'}</p>
        </div>`;
      if (foot) foot.textContent = '';
      return;
    }

    body.innerHTML = filtered.map((row) => {
      const name = publisherName(row);
      const { grupo, casa } = parsePublisherNotes(row.notes);
      const isActive = row.is_active !== false;
      const inactiveClass = isActive ? '' : ' eq-pub-row--inactive';
      const statusHtml = isActive
        ? '<span class="eq-pub-status eq-pub-status--active">Ativo</span>'
        : '<span class="eq-pub-status eq-pub-status--inactive">Inativo</span>';
      const toggleTitle = isActive ? 'Desativar' : 'Reativar';
      const toggleIcon = isActive ? 'toggle_off' : 'toggle_on';
      const toggleClass = isActive ? 'eq-pub-icon-btn eq-pub-icon-btn--off' : 'eq-pub-icon-btn';

      return `
        <div class="eq-pub-row${inactiveClass}" data-pub-id="${row.id}" title="${escapeHtml(name)}">
          <span class="eq-pub-name">
            ${publisherAvatarHtml(row)}
            <span>${escapeHtml(name)}</span>
          </span>
          <span class="eq-pub-services">${renderPublisherServicePills(row)}</span>
          <span class="eq-pub-days" title="${escapeHtml((row.available_days || []).join(', '))}">${renderPublisherDayPills(row)}</span>
          <span class="eq-pub-meta">${grupo ? `<strong>Grupo:</strong> ${escapeHtml(grupo)}` : '—'}</span>
          <span class="eq-pub-meta">${casa ? `<strong>Casa:</strong> ${escapeHtml(casa)}` : '—'}</span>
          <span class="eq-pub-status-cell">${statusHtml}</span>
          <div class="eq-pub-actions">
            <button type="button" class="${toggleClass}" data-eq-toggle-pub="${row.id}" title="${toggleTitle}">
              <span class="material-symbols-outlined" aria-hidden="true">${toggleIcon}</span>
            </button>
          </div>
        </div>`;
    }).join('');

    if (foot) {
      const suffix = filtered.length < publishers.length ? ` (${publishers.length} no total)` : '';
      foot.textContent = `Exibindo ${filtered.length} publicador${filtered.length === 1 ? '' : 'es'}${suffix}`;
    }
  }

  function renderPublishers() {
    const list = document.getElementById('eq-pub-list');
    if (!list) return;

    if (!publishers.length) {
      updatePublisherStats();
      list.innerHTML = `
        <div class="eq-pub-empty">
          <span class="material-symbols-outlined" aria-hidden="true">groups</span>
          <p class="text-sm font-semibold text-primary">Nenhum publicador cadastrado</p>
          <p class="text-xs mt-1">Use o formulário acima para adicionar irmãos aptos a carrinho ou display.</p>
        </div>`;
      return;
    }

    if (!document.getElementById('eq-pub-table-body')) {
      list.innerHTML = `
        <div class="eq-pub-scroll">
          <div class="eq-pub-panel">
            <div class="eq-pub-row eq-pub-row--head">
              <span>Irmão(ã)</span>
              <span>Serviços</span>
              <span>Dias</span>
              <span>Grupo</span>
              <span>Casa</span>
              <span>Status</span>
              <span></span>
            </div>
            <div id="eq-pub-table-body"></div>
            <p id="eq-pub-table-foot" class="eq-pub-foot"></p>
          </div>
        </div>`;
    }

    renderPublishersTable();
  }

  function renderSchedule() {
    const list = document.getElementById('eq-sched-list');
    const weekInput = document.getElementById('eq-week');
    if (weekInput) weekInput.value = currentWeek;
    if (!list) return;

    const rows = helpers.slotsForWeek(slots, currentWeek);
    if (!rows.length) {
      list.innerHTML = `
        <div class="eq-sched-card p-5 text-sm text-on-surface-variant">
          Nenhuma linha para esta semana. Adicione slots <strong>fixos</strong> (repetem sempre) ou <strong>temporários</strong> (só esta semana).
        </div>`;
      return;
    }

    list.innerHTML = `
      <div class="eq-sched-card">
        <div class="eq-sched-row eq-sched-row--head">
          <span>Dia / período</span><span>Tipo</span><span>Equip.</span><span>Publicadores</span><span>Nome</span><span>Local</span><span></span>
        </div>
        ${rows.map((row) => `
          <div class="eq-sched-row">
            <span><strong>${escapeHtml(row.weekday_label)}</strong> · ${escapeHtml(row.period_label)}</span>
            <span><span class="eq-slot-kind eq-slot-kind--${row.slot_kind === 'fixed' ? 'fixed' : 'temp'}">${row.slot_kind === 'fixed' ? 'Fixo' : 'Temp.'}</span></span>
            <span><span class="eq-type-pill${row.equipment_type === 'display' ? ' eq-type-pill--display' : ''}">${escapeHtml(helpers.EQUIPMENT_TYPES[row.equipment_type] || row.equipment_type)}</span></span>
            <span>${escapeHtml(row.publisher_names || '—')}</span>
            <span>${escapeHtml(row.equipment_name || '—')}</span>
            <span>${escapeHtml(row.location_name || '—')}</span>
            <span class="eq-row-actions">
              <button type="button" class="eq-row-btn" data-eq-edit-slot="${row.id}">Editar</button>
            </span>
          </div>`).join('')}
      </div>`;

    list.querySelectorAll('[data-eq-edit-slot]').forEach((btn) => {
      btn.addEventListener('click', () => openSlotModal(slots.find((s) => s.id === btn.dataset.eqEditSlot)));
    });
  }

  function openSlotModal(item) {
    const modal = document.getElementById('eq-slot-modal');
    const deleteBtn = document.getElementById('eq-slot-delete');
    if (!modal) return;

    document.getElementById('eq-slot-id').value = item?.id || '';
    document.getElementById('eq-slot-day').value = item?.weekday_label || helpers.EQUIPMENT_DAYS[0];
    document.getElementById('eq-slot-period').value = item?.period_label || 'Manhã';
    document.getElementById('eq-slot-kind').value = item?.slot_kind || 'temporary';
    document.getElementById('eq-slot-type').value = item?.equipment_type || 'carrinho';
    document.getElementById('eq-slot-equipment').value = item?.equipment_name || '';
    document.getElementById('eq-slot-location').value = item?.location_name || '';
    document.getElementById('eq-slot-publishers').value = item?.publisher_names || '';
    document.getElementById('eq-slot-sort').value = item?.sort_order ?? 0;
    document.getElementById('eq-slot-modal-title').textContent = item ? 'Editar linha' : 'Nova linha';
    deleteBtn.classList.toggle('hidden', !item?.id);

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeSlotModal() {
    const modal = document.getElementById('eq-slot-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.getElementById('eq-slot-form')?.reset();
    document.getElementById('eq-slot-id').value = '';
  }

  async function saveSlot(e) {
    e.preventDefault();
    const id = document.getElementById('eq-slot-id').value;
    const slotKind = document.getElementById('eq-slot-kind').value;
    const payload = {
      weekday_label: document.getElementById('eq-slot-day').value,
      period_label: document.getElementById('eq-slot-period').value,
      slot_kind: slotKind,
      week_start: slotKind === 'temporary' ? currentWeek : null,
      equipment_type: document.getElementById('eq-slot-type').value,
      equipment_name: document.getElementById('eq-slot-equipment').value.trim(),
      location_name: document.getElementById('eq-slot-location').value.trim(),
      publisher_names: document.getElementById('eq-slot-publishers').value.trim(),
      sort_order: parseInt(document.getElementById('eq-slot-sort').value, 10) || 0,
      is_active: true,
      updated_at: new Date().toISOString()
    };

    const { error } = id
      ? await client.from('equipment_schedule_slots').update(payload).eq('id', id)
      : await client.from('equipment_schedule_slots').insert(payload);

    if (error) {
      showToast(toast, error.message, true);
      return;
    }

    showToast(toast, 'Linha salva.');
    closeSlotModal();
    await loadSlots();
  }

  async function deleteSlot() {
    const id = document.getElementById('eq-slot-id').value;
    if (!id || !confirm('Excluir esta linha do cronograma?')) return;
    const { error } = await client.from('equipment_schedule_slots').delete().eq('id', id);
    if (error) showToast(toast, error.message, true);
    else {
      showToast(toast, 'Linha excluída.');
      closeSlotModal();
      await loadSlots();
    }
  }

  function copyWhatsApp() {
    const msg = helpers.generateWhatsAppEquipmentSchedule(currentWeek, slots);
    const wrap = document.getElementById('eq-whatsapp-wrap');
    const box = document.getElementById('eq-whatsapp');
    if (box) box.textContent = msg;
    if (wrap) wrap.classList.remove('hidden');

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(msg)
        .then(() => showToast(toast, 'Mensagem copiada para a área de transferência.'))
        .catch(() => showToast(toast, 'Mensagem gerada — copie manualmente.', false));
    } else {
      showToast(toast, 'Mensagem gerada abaixo.');
    }
  }

  async function init() {
    if (window.__JEAdminCarrinhosDisplaysInit) return;

    const profile = await guardPermission('agendamentos');
    if (!profile) return false;

    if (!helpers) throw new Error('Módulo de cronograma não carregou. Recarregue a página.');

    toast = toastEl();
    client = await getClient();
    currentWeek = helpers.toISODate(helpers.getSunday(new Date()));

    setupTabs();
    fillSelectOptions();

    document.getElementById('eq-week')?.addEventListener('change', (e) => {
      currentWeek = helpers.snapToWeekStart(e.target.value);
      renderSchedule();
      document.getElementById('eq-whatsapp-wrap')?.classList.add('hidden');
    });

    document.getElementById('eq-btn-new-slot')?.addEventListener('click', () => openSlotModal(null));
    document.getElementById('eq-btn-whatsapp')?.addEventListener('click', copyWhatsApp);
    document.getElementById('eq-slot-form')?.addEventListener('submit', saveSlot);
    document.getElementById('eq-slot-cancel')?.addEventListener('click', closeSlotModal);
    document.getElementById('eq-slot-modal-close')?.addEventListener('click', closeSlotModal);
    document.getElementById('eq-slot-delete')?.addEventListener('click', deleteSlot);
    document.getElementById('eq-slot-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'eq-slot-modal') closeSlotModal();
    });

    document.getElementById('eq-pub-search')?.addEventListener('input', (e) => {
      pubSearch = e.target.value;
      renderPublishersTable();
    });

    document.getElementById('eq-panel-publicadores')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-eq-toggle-pub]');
      if (!btn) return;
      const row = publishers.find((p) => p.id === btn.dataset.eqTogglePub);
      if (!row) return;
      const { error } = await client
        .from('equipment_publishers')
        .update({ is_active: row.is_active === false, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, row.is_active === false ? 'Publicador reativado.' : 'Publicador desativado.');
        await loadPublishers();
      }
    });

    document.getElementById('eq-form-publisher')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const profileId = document.getElementById('eq-publisher-profile').value;
      if (!profileId) return;
      const profileRow = profiles.find((p) => p.id === profileId);
      if (!profileRow) return;

      const dayInputs = document.querySelectorAll('#eq-pub-days input[name="eq-pub-day"]:checked');
      const availableDays = Array.from(dayInputs).map((input) => input.value);
      if (!availableDays.length) {
        showToast(toast, 'Selecione ao menos um dia.', true);
        return;
      }

      const { error } = await client.from('equipment_publishers').insert({
        profile_id: profileId,
        publisher_name: profileRow.full_name,
        can_carrinho: document.getElementById('eq-pub-carrinho').checked,
        can_display: document.getElementById('eq-pub-display').checked,
        available_days: availableDays,
        is_active: true,
        updated_at: new Date().toISOString()
      });

      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, 'Publicador adicionado.');
        e.target.reset();
        document.getElementById('eq-pub-carrinho').checked = true;
        document.getElementById('eq-pub-display').checked = true;
        buildDayCheckboxes(document.getElementById('eq-pub-days'), 'eq-pub', helpers.EQUIPMENT_DAYS);
        await loadPublishers();
      }
    });

    try {
      await Promise.all([loadPublishers(), loadSlots()]);
    } catch (err) {
      console.error('Carrinhos e Displays:', err);
      const msg = String(err?.message || err);
      const list = document.getElementById('eq-sched-list');
      if (list) {
        list.innerHTML = `<div class="eq-sched-card p-5 text-sm text-error">Não foi possível carregar os dados.${msg ? ` (${escapeHtml(msg)})` : ''}</div>`;
      }
      showToast(toast, msg.includes('equipment_') ? 'Tabelas do cronograma ainda não existem no Supabase.' : msg, true);
      throw err;
    }

    window.__JEAdminCarrinhosDisplaysInit = true;
  }

  window.JEAdminCarrinhosDisplays = { init };
})();
