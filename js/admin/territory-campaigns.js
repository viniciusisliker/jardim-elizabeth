(function () {
  let client;
  let toast;
  let escapeHtml;
  let showToast;
  let getProfiles;
  let getTerritories;
  let ensureProfiles;
  let ensureTerritories;

  let campaigns = [];
  let entries = [];
  let activeCampaignId = null;
  let statusFilter = 'all';
  let ready = false;

  function H() {
    return window.JETerritoryAssignment;
  }

  function bindAdmin() {
    const admin = window.JEAdmin;
    if (!admin) return false;
    ({ showToast, escapeHtml } = admin);
    return true;
  }

  function profileName(p) {
    if (!p) return '—';
    return p.full_name || p.profiles?.full_name || '—';
  }

  function profilesList() {
    return typeof getProfiles === 'function' ? getProfiles() : [];
  }

  function territoriesList() {
    return typeof getTerritories === 'function' ? getTerritories() : [];
  }

  function profileById(id) {
    if (!id) return null;
    return profilesList().find((p) => p.id === id) || null;
  }

  function territoryById(id) {
    if (!id) return null;
    return territoriesList().find((t) => t.id === id) || null;
  }

  function sortedTerritories() {
    return [...territoriesList()].sort((a, b) => {
      const na = Number(String(a.num || '').replace(/\D/g, '')) || 0;
      const nb = Number(String(b.num || '').replace(/\D/g, '')) || 0;
      return na - nb || String(a.display_name || '').localeCompare(String(b.display_name || ''), 'pt-BR');
    });
  }

  function activeCampaign() {
    return campaigns.find((c) => c.id === activeCampaignId) || null;
  }

  function entryRows() {
    const terrs = sortedTerritories();
    const byTerritory = new Map(entries.map((e) => [e.territory_id, e]));
    return terrs.map((terr) => {
      const entry = byTerritory.get(terr.id) || null;
      return { terr, entry };
    });
  }

  function filteredRows() {
    const rows = entryRows();
    if (statusFilter === 'pendente') return rows.filter((r) => !r.entry || r.entry.status === 'pendente');
    if (statusFilter === 'trabalhado') return rows.filter((r) => r.entry?.status === 'trabalhado');
    return rows;
  }

  function stats() {
    const rows = entryRows();
    const worked = rows.filter((r) => r.entry?.status === 'trabalhado').length;
    const total = rows.length;
    return { worked, pending: total - worked, total };
  }

  async function loadCampaigns() {
    const { data, error } = await client
      .from('territory_campaigns')
      .select('id, name, notes, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    campaigns = data || [];
    if (!activeCampaignId && campaigns.length) activeCampaignId = campaigns[0].id;
    if (activeCampaignId && !campaigns.some((c) => c.id === activeCampaignId)) {
      activeCampaignId = campaigns[0]?.id || null;
    }
  }

  async function loadEntries(campaignId) {
    if (!campaignId) {
      entries = [];
      return;
    }
    const { data, error } = await client
      .from('territory_campaign_entries')
      .select('id, campaign_id, territory_id, status, profile_id, worked_at, notes, updated_at')
      .eq('campaign_id', campaignId);
    if (error) throw error;
    entries = data || [];
  }

  async function seedMissingEntries(campaignId) {
    const terrs = sortedTerritories();
    if (!campaignId || !terrs.length) return;
    const existing = new Set(entries.map((e) => e.territory_id));
    const missing = terrs.filter((t) => !existing.has(t.id));
    if (!missing.length) return;
    const payload = missing.map((t) => ({
      campaign_id: campaignId,
      territory_id: t.id,
      status: 'pendente'
    }));
    const { data, error } = await client
      .from('territory_campaign_entries')
      .insert(payload)
      .select('id, campaign_id, territory_id, status, profile_id, worked_at, notes, updated_at');
    if (error) throw error;
    entries = [...entries, ...(data || [])];
  }

  function territoryCellHtml(terr) {
    const helpers = H();
    const label = helpers?.territoryLabel ? helpers.territoryLabel(terr) : (terr.display_name || '—');
    const mapUrl = helpers?.resolveTerritoryMapUrl
      ? helpers.resolveTerritoryMapUrl(terr.map_image_url, terr.num)
      : '';
    const inner = `
      ${terr.num != null && terr.num !== '' ? `<span class="terr-hist-terr-num">T${escapeHtml(String(terr.num))}</span>` : ''}
      <span class="terr-hist-terr-name">${escapeHtml(terr.display_name || label)}</span>
      ${mapUrl ? '<span class="material-symbols-outlined terr-hist-terr-map-icon" aria-hidden="true">map</span>' : ''}`;
    if (!mapUrl) {
      return `<span class="terr-hist-terr-btn terr-sched-terr-btn" title="${escapeHtml(label)}">${inner}</span>`;
    }
    return `
      <button type="button" class="terr-hist-terr-btn terr-hist-terr-btn--map terr-sched-terr-btn"
        data-terr-map="${escapeHtml(mapUrl)}"
        data-terr-title="${escapeHtml(label)}"
        title="Ver mapa · ${escapeHtml(label)}">${inner}</button>`;
  }

  function statusBadge(status) {
    if (status === 'trabalhado') {
      return '<span class="terr-camp-status terr-camp-status--trabalhado"><span class="material-symbols-outlined" aria-hidden="true">check_circle</span>Trabalhado</span>';
    }
    return '<span class="terr-camp-status terr-camp-status--pendente"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>Pendente</span>';
  }

  function dirigenteCellHtml(entry) {
    const profile = profileById(entry?.profile_id);
    const name = profileName(profile);
    if (!profile || name === '—') {
      return '<span class="terr-sched-cell--muted">—</span>';
    }
    return escapeHtml(name);
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const helpers = H();
    if (helpers?.formatShortDate) return helpers.formatShortDate(String(iso).slice(0, 10));
    const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR');
  }

  function renderStats() {
    const el = document.getElementById('campanha-stats');
    if (!el) return;
    const { worked, pending, total } = stats();
    if (!activeCampaignId || !total) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = `
      <div class="terr-over-stat terr-over-stat--all">
        <span class="terr-over-stat__icon"><span class="material-symbols-outlined" aria-hidden="true">map</span></span>
        <div><p class="terr-over-stat__label">Territórios</p><p class="terr-over-stat__val">${total}</p></div>
      </div>
      <div class="terr-over-stat terr-over-stat--active">
        <span class="terr-over-stat__icon"><span class="material-symbols-outlined" aria-hidden="true">check_circle</span></span>
        <div><p class="terr-over-stat__label">Trabalhados</p><p class="terr-over-stat__val">${worked}</p></div>
      </div>
      <div class="terr-over-stat">
        <span class="terr-over-stat__icon"><span class="material-symbols-outlined" aria-hidden="true">pending</span></span>
        <div><p class="terr-over-stat__label">Pendentes</p><p class="terr-over-stat__val">${pending}</p></div>
      </div>`;
  }

  function renderCampaignSelect() {
    const sel = document.getElementById('campanha-select');
    if (!sel) return;
    if (!campaigns.length) {
      sel.innerHTML = '<option value="">Nenhuma campanha</option>';
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    sel.innerHTML = campaigns.map((c) =>
      `<option value="${c.id}" ${c.id === activeCampaignId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
    ).join('');
  }

  function renderTable() {
    const body = document.getElementById('campanha-table-body');
    const foot = document.getElementById('campanha-table-foot');
    if (!body) return;

    if (!activeCampaignId) {
      body.innerHTML = `
        <tr>
          <td colspan="6" class="terr-sched-empty-td">
            <div class="terr-empty !border-0 !rounded-none">
              <span class="material-symbols-outlined" aria-hidden="true">campaign</span>
              <p class="text-sm">Crie uma campanha para registrar os 19 territórios.</p>
            </div>
          </td>
        </tr>`;
      if (foot) foot.textContent = '';
      renderStats();
      return;
    }

    const rows = filteredRows();
    const all = entryRows();

    if (!rows.length) {
      body.innerHTML = `
        <tr>
          <td colspan="6" class="terr-sched-empty-td">
            <div class="terr-empty !border-0 !rounded-none">
              <span class="material-symbols-outlined" aria-hidden="true">filter_alt_off</span>
              <p class="text-sm">Nenhum território corresponde ao filtro.</p>
            </div>
          </td>
        </tr>`;
    } else {
      body.innerHTML = rows.map(({ terr, entry }) => {
        const worked = entry?.status === 'trabalhado';
        const tone = worked ? 'weekday' : 'weekend';
        const entryId = entry?.id || '';
        const toggleTitle = worked ? 'Marcar como pendente' : 'Marcar como trabalhado';
        const toggleIcon = worked ? 'pending' : 'task_alt';
        return `
        <tr class="terr-sched-tr terr-sched-tr--${tone}" data-camp-terr="${terr.id}">
          <td data-camp-col="territorio">${territoryCellHtml(terr)}</td>
          <td data-camp-col="status">${statusBadge(entry?.status || 'pendente')}</td>
          <td data-camp-col="dirigente" class="terr-sched-cell terr-sched-cell--dirigente">${dirigenteCellHtml(entry)}</td>
          <td data-camp-col="data" class="terr-sched-cell${entry?.worked_at ? '' : ' terr-sched-cell--muted'}">${escapeHtml(formatDate(entry?.worked_at))}</td>
          <td data-camp-col="notes" class="terr-sched-cell${entry?.notes ? '' : ' terr-sched-cell--muted'}">${escapeHtml(entry?.notes || '—')}</td>
          <td data-camp-col="actions" class="terr-sched-actions-td">
            <div class="terr-sched-row-actions">
              <button type="button" data-camp-toggle="${entryId}" data-camp-terr="${terr.id}" class="terr-sched-icon-btn terr-sched-action--edit" title="${toggleTitle}" aria-label="${toggleTitle}" ${entryId ? '' : 'disabled'}>
                <span class="material-symbols-outlined" aria-hidden="true">${toggleIcon}</span>
              </button>
              <button type="button" data-camp-edit="${entryId}" data-camp-terr="${terr.id}" class="terr-sched-icon-btn terr-sched-action--edit" title="Editar" aria-label="Editar linha">
                <span class="material-symbols-outlined" aria-hidden="true">edit</span>
              </button>
            </div>
          </td>
        </tr>`;
      }).join('');
    }

    if (foot) {
      const { worked, pending } = stats();
      foot.textContent = `Exibindo ${rows.length} de ${all.length} · ${worked} trabalhados · ${pending} pendentes`;
    }
    renderStats();
  }

  function renderShell() {
    const mount = document.getElementById('campanha-list');
    if (!mount || document.getElementById('campanha-table-body')) return;
    mount.innerHTML = `
      <div class="terr-sched-scroll" id="campanha-sched-scroll">
        <div class="terr-sched-panel">
          <table class="terr-sched-table" id="campanha-table">
            <thead>
              <tr>
                <th scope="col">Território</th>
                <th scope="col">Status</th>
                <th scope="col">Dirigente</th>
                <th scope="col">Data</th>
                <th scope="col">Observações</th>
                <th scope="col" class="terr-sched-actions-th" aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody id="campanha-table-body"></tbody>
          </table>
          <p id="campanha-table-foot" class="terr-catalog-foot"></p>
        </div>
      </div>`;
  }

  function profileOptions(selectedId) {
    const list = [...profilesList()].sort((a, b) =>
      profileName(a).localeCompare(profileName(b), 'pt-BR', { sensitivity: 'base' })
    );
    const opts = ['<option value="">— Selecionar —</option>'];
    list.forEach((p) => {
      opts.push(`<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${escapeHtml(profileName(p))}</option>`);
    });
    return opts.join('');
  }

  function closeModal() {
    document.getElementById('camp-form-modal-wrap')?.remove();
    document.getElementById('camp-entry-modal-wrap')?.remove();
  }

  function openNewCampaignModal() {
    closeModal();
    const wrap = document.createElement('div');
    wrap.id = 'camp-form-modal-wrap';
    wrap.className = 'terr-sched-modal';
    wrap.innerHTML = `
      <div class="terr-sched-modal__panel" role="dialog" aria-modal="true" aria-labelledby="camp-form-modal-title">
        <div class="terr-sched-modal__hero">
          <button type="button" data-cancel class="terr-sched-modal__close" aria-label="Fechar">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
          <p class="terr-sched-modal__kicker">Campanhas</p>
          <h3 id="camp-form-modal-title">Nova campanha</h3>
        </div>
        <form id="camp-form-modal-form">
          <div class="terr-sched-modal__body">
            <label class="terr-over-field">
              <span class="terr-over-field__label">Nome da campanha</span>
              <input type="text" name="name" required maxlength="120" class="terr-over-input" placeholder="Ex.: Campanha especial — junho 2026"/>
            </label>
            <label class="terr-over-field">
              <span class="terr-over-field__label">Observações (opcional)</span>
              <textarea name="notes" rows="2" class="terr-over-input" placeholder="Notas internas sobre esta campanha"></textarea>
            </label>
            <p class="text-xs text-on-surface-variant">Serão criadas ${sortedTerritories().length || 19} linhas (T01–T19), todas pendentes. Não altera Painel, Cronograma nem Histórico.</p>
          </div>
          <div class="terr-sched-modal__foot">
            <button type="button" data-cancel class="terr-sched-toolbar-btn terr-sched-toolbar-btn--ghost">Cancelar</button>
            <button type="submit" class="terr-sched-toolbar-btn terr-sched-toolbar-btn--accent">Criar campanha</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(wrap);
    wrap.querySelector('[name="name"]')?.focus();
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-cancel]')) closeModal();
    });
    wrap.querySelector('#camp-form-modal-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const name = String(form.name.value || '').trim();
      const notes = String(form.notes.value || '').trim() || null;
      if (!name) return;
      const submit = form.querySelector('[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        await createCampaign(name, notes);
        closeModal();
        if (toast) showToast(toast, 'Campanha criada.');
      } catch (err) {
        if (toast) showToast(toast, err.message || 'Erro ao criar campanha.', true);
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  function openEntryModal(territoryId, entryId) {
    const terr = territoryById(territoryId);
    const entry = entries.find((e) => e.id === entryId) || entries.find((e) => e.territory_id === territoryId);
    if (!terr) return;
    closeModal();
    const helpers = H();
    const label = helpers?.territoryLabel ? helpers.territoryLabel(terr) : terr.display_name;
    const today = helpers?.toISODate ? helpers.toISODate(new Date()) : new Date().toISOString().slice(0, 10);
    const wrap = document.createElement('div');
    wrap.id = 'camp-entry-modal-wrap';
    wrap.className = 'terr-sched-modal';
    wrap.innerHTML = `
      <div class="terr-sched-modal__panel" role="dialog" aria-modal="true" aria-labelledby="camp-entry-modal-title">
        <div class="terr-sched-modal__hero">
          <button type="button" data-cancel class="terr-sched-modal__close" aria-label="Fechar">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
          <p class="terr-sched-modal__kicker">Campanha · ${escapeHtml(activeCampaign()?.name || '')}</p>
          <h3 id="camp-entry-modal-title">${escapeHtml(label)}</h3>
        </div>
        <form id="camp-entry-modal-form">
          <div class="terr-sched-modal__body">
            <label class="terr-over-field">
              <span class="terr-over-field__label">Status</span>
              <select name="status" class="terr-over-input">
                <option value="pendente" ${entry?.status !== 'trabalhado' ? 'selected' : ''}>Pendente</option>
                <option value="trabalhado" ${entry?.status === 'trabalhado' ? 'selected' : ''}>Trabalhado</option>
              </select>
            </label>
            <label class="terr-over-field">
              <span class="terr-over-field__label">Dirigente</span>
              <select name="profile_id" class="terr-over-input">${profileOptions(entry?.profile_id || '')}</select>
            </label>
            <label class="terr-over-field">
              <span class="terr-over-field__label">Data trabalhada</span>
              <input type="date" name="worked_at" class="terr-over-input" value="${escapeHtml(entry?.worked_at ? String(entry.worked_at).slice(0, 10) : '')}"/>
            </label>
            <label class="terr-over-field">
              <span class="terr-over-field__label">Observações</span>
              <textarea name="notes" rows="2" class="terr-over-input" placeholder="Opcional">${escapeHtml(entry?.notes || '')}</textarea>
            </label>
          </div>
          <div class="terr-sched-modal__foot">
            <button type="button" data-cancel class="terr-sched-toolbar-btn terr-sched-toolbar-btn--ghost">Cancelar</button>
            <button type="submit" class="terr-sched-toolbar-btn terr-sched-toolbar-btn--accent">Salvar</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-cancel]')) closeModal();
    });
    wrap.querySelector('#camp-entry-modal-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const status = form.status.value === 'trabalhado' ? 'trabalhado' : 'pendente';
      const profile_id = form.profile_id.value || null;
      let worked_at = form.worked_at.value || null;
      const notes = String(form.notes.value || '').trim() || null;
      if (status === 'trabalhado' && !worked_at) worked_at = today;
      if (status === 'pendente') worked_at = null;
      const submit = form.querySelector('[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        await saveEntry(entry?.id, territoryId, { status, profile_id, worked_at, notes });
        closeModal();
        if (toast) showToast(toast, 'Campanha atualizada.');
      } catch (err) {
        if (toast) showToast(toast, err.message || 'Erro ao salvar.', true);
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  async function createCampaign(name, notes) {
    const { data, error } = await client
      .from('territory_campaigns')
      .insert({ name, notes })
      .select('id, name, notes, created_at, updated_at')
      .single();
    if (error) throw error;
    campaigns.unshift(data);
    activeCampaignId = data.id;
    entries = [];
    await seedMissingEntries(data.id);
    renderCampaignSelect();
    renderTable();
  }

  async function saveEntry(entryId, territoryId, patch) {
    if (!activeCampaignId) throw new Error('Nenhuma campanha selecionada.');
    const payload = {
      ...patch,
      updated_at: new Date().toISOString()
    };
    let result;
    if (entryId) {
      const { data, error } = await client
        .from('territory_campaign_entries')
        .update(payload)
        .eq('id', entryId)
        .select('id, campaign_id, territory_id, status, profile_id, worked_at, notes, updated_at')
        .single();
      if (error) throw error;
      result = data;
      entries = entries.map((e) => (e.id === entryId ? result : e));
    } else {
      const { data, error } = await client
        .from('territory_campaign_entries')
        .insert({
          campaign_id: activeCampaignId,
          territory_id: territoryId,
          ...payload
        })
        .select('id, campaign_id, territory_id, status, profile_id, worked_at, notes, updated_at')
        .single();
      if (error) throw error;
      result = data;
      entries.push(result);
    }
    renderTable();
  }

  async function toggleEntry(entryId, territoryId) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const next = entry.status === 'trabalhado' ? 'pendente' : 'trabalhado';
    const helpers = H();
    const today = helpers?.toISODate ? helpers.toISODate(new Date()) : new Date().toISOString().slice(0, 10);
    await saveEntry(entryId, territoryId, {
      status: next,
      profile_id: next === 'pendente' ? null : entry.profile_id,
      worked_at: next === 'trabalhado' ? (entry.worked_at || today) : null,
      notes: entry.notes || null
    });
    if (toast) showToast(toast, next === 'trabalhado' ? 'Marcado como trabalhado.' : 'Marcado como pendente.');
  }

  async function refreshCampaignView() {
    if (ensureProfiles) await ensureProfiles();
    if (ensureTerritories) await ensureTerritories();
    await loadCampaigns();
    renderCampaignSelect();
    if (activeCampaignId) {
      await loadEntries(activeCampaignId);
      await seedMissingEntries(activeCampaignId);
    }
    renderTable();
  }

  function setupToolbar() {
    document.getElementById('campanha-select')?.addEventListener('change', async (e) => {
      activeCampaignId = e.target.value || null;
      try {
        if (activeCampaignId) {
          await loadEntries(activeCampaignId);
          await seedMissingEntries(activeCampaignId);
        } else {
          entries = [];
        }
        renderTable();
      } catch (err) {
        if (toast) showToast(toast, err.message || 'Erro ao carregar campanha.', true);
      }
    });

    document.getElementById('campanha-filter')?.addEventListener('change', (e) => {
      statusFilter = e.target.value || 'all';
      renderTable();
    });

    document.getElementById('btn-campanha-new')?.addEventListener('click', () => openNewCampaignModal());

    document.getElementById('btn-campanha-refresh')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-campanha-refresh');
      if (!btn || btn.disabled) return;
      btn.disabled = true;
      btn.classList.add('terr-sched-toolbar-btn--spin');
      try {
        await refreshCampaignView();
        if (toast) showToast(toast, 'Campanha atualizada.');
      } catch (err) {
        if (toast) showToast(toast, err.message || 'Erro ao atualizar.', true);
      } finally {
        btn.disabled = false;
        btn.classList.remove('terr-sched-toolbar-btn--spin');
      }
    });

    document.getElementById('btn-campanha-delete')?.addEventListener('click', async () => {
      const camp = activeCampaign();
      if (!camp) return;
      if (!window.confirm(`Excluir a campanha "${camp.name}"? Esta ação não afeta Painel, Cronograma nem Histórico.`)) return;
      const { error } = await client.from('territory_campaigns').delete().eq('id', camp.id);
      if (error) {
        if (toast) showToast(toast, error.message, true);
        return;
      }
      campaigns = campaigns.filter((c) => c.id !== camp.id);
      activeCampaignId = campaigns[0]?.id || null;
      entries = [];
      if (activeCampaignId) {
        await loadEntries(activeCampaignId);
        await seedMissingEntries(activeCampaignId);
      }
      renderCampaignSelect();
      renderTable();
      if (toast) showToast(toast, 'Campanha excluída.');
    });
  }

  function setupDelegatedActions() {
    const panel = document.getElementById('panel-campanhas');
    if (!panel || panel.dataset.campBound) return;
    panel.dataset.campBound = '1';
    panel.addEventListener('click', async (e) => {
      const toggleBtn = e.target.closest('[data-camp-toggle]');
      if (toggleBtn && !toggleBtn.disabled) {
        const entryId = toggleBtn.dataset.campToggle;
        const terrId = toggleBtn.dataset.campTerr;
        try {
          await toggleEntry(entryId, terrId);
        } catch (err) {
          if (toast) showToast(toast, err.message || 'Erro ao atualizar.', true);
        }
        return;
      }
      const editBtn = e.target.closest('[data-camp-edit]');
      if (editBtn) {
        openEntryModal(editBtn.dataset.campTerr, editBtn.dataset.campEdit || '');
      }
    });
  }

  async function ensureReady(deps) {
    if (!bindAdmin()) return false;
    client = deps?.client;
    toast = deps?.toast;
    getProfiles = deps?.getProfiles;
    getTerritories = deps?.getTerritories;
    ensureProfiles = deps?.ensureProfiles;
    ensureTerritories = deps?.ensureTerritories;
    if (!client) return false;

    if (ensureProfiles) await ensureProfiles();
    if (ensureTerritories) await ensureTerritories();

    if (!ready) {
      setupToolbar();
      setupDelegatedActions();
      ready = true;
    }

    renderShell();
    await refreshCampaignView();
    return true;
  }

  window.JETerritoryCampaigns = { ensureReady, refreshCampaignView };
})();
