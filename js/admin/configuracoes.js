(function () {
  const { guardAdmin, getClient, showToast, escapeHtml } = window.JEAdmin;
  const { PERMISSION_LABELS, MODULE_PERMISSIONS } = window.JEAccess;

  const ROLES = [
    { value: 'superuser', label: 'SuperUser' },
    { value: 'anciao', label: 'Ancião' },
    { value: 'servo_ministerial', label: 'Servo Ministerial' },
    { value: 'publicador', label: 'Publicador' }
  ];

  const ADMIN_ROLES = new Set(window.JE_CONFIG?.adminRoles || ['superuser', 'anciao', 'servo_ministerial']);

  function slugify(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 48) || 'designacao';
  }

  function permissionBadges(permissions) {
    return (permissions || [])
      .map((p) => `<span class="cfg-des-badge">${escapeHtml(PERMISSION_LABELS[p] || p)}</span>`)
      .join('');
  }

  function permissionSummary(permissions) {
    const perms = permissions || [];
    if (!perms.length) {
      return '<span class="cfg-des-desc">Nenhum módulo — expanda para configurar</span>';
    }
    return `<div class="cfg-des-badges">${permissionBadges(perms)}</div>`;
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  }

  async function init() {
    if (window.__JEAdminConfigInit) return;
    window.__JEAdminConfigInit = true;
    const profile = await guardAdmin();
    if (!profile) return;

    const toast = document.getElementById('hub-admin-toast') || document.getElementById('admin-toast');
    const client = await getClient();
    const isSuper = window.JEAuth.isSuperUser(profile.role);
    let members = [];
    let catalog = [];
    let expandedDesignationId = null;
    let memberSearch = '';
    let memberEmails = new Map();

    document.getElementById('cfg-role-note').textContent = isSuper
      ? 'Como SuperUser, você gerencia designações, cargos, e-mails de login e atribuições da equipe.'
      : 'Somente o SuperUser pode alterar designações e cargos. Você pode visualizar a equipe.';

    if (isSuper) {
      document.getElementById('cfg-designations-section').classList.remove('hidden');
      document.getElementById('cfg-head-email')?.classList.remove('hidden');
      document.querySelector('.cfg-members-panel')?.classList.add('cfg-members-panel--super');
    }

    function updateStats() {
      const activeDes = catalog.filter((d) => d.is_active).length;
      const adminCount = members.filter((m) => ADMIN_ROLES.has(m.role)).length;
      const statMembers = document.getElementById('cfg-stat-members');
      const statDes = document.getElementById('cfg-stat-designations');
      const statAdmins = document.getElementById('cfg-stat-admins');
      if (statMembers) statMembers.textContent = String(members.length);
      if (statDes) statDes.textContent = String(activeDes);
      if (statAdmins) statAdmins.textContent = String(adminCount);
    }

    function filteredMembers() {
      const q = memberSearch.trim().toLowerCase();
      if (!q) return members;
      return members.filter((m) => {
        const email = memberEmails.get(m.id) || '';
        const hay = `${m.full_name || ''} ${m.username || ''} ${m.designation || ''} ${email}`.toLowerCase();
        return hay.includes(q);
      });
    }

    async function loadMemberEmails() {
      if (!isSuper) return;
      const { data, error } = await client.rpc('list_team_member_emails');
      if (error) {
        console.warn('list_team_member_emails:', error.message);
        memberEmails = new Map();
        return;
      }
      memberEmails = new Map((data || []).map((row) => [row.profile_id, row.email || '']));
    }

    async function reloadCatalog() {
      const { data, error } = await client
        .from('access_designations')
        .select('*')
        .order('sort_order');
      if (error) {
        document.getElementById('designations-catalog').innerHTML = `<p class="cfg-empty text-error">${escapeHtml(error.message)}</p>`;
        return;
      }
      catalog = data || [];
      updateStats();
      renderCatalog();
    }

    async function reloadMembers() {
      const { data, error } = await client
        .from('profiles')
        .select('id, full_name, username, role, display_role, designation, profile_access_designations(designation_id)')
        .order('full_name');
      if (error) {
        document.getElementById('members-table').innerHTML = `<p class="cfg-empty text-error">${escapeHtml(error.message)}</p>`;
        return;
      }
      members = (data || []).map((m) => ({
        ...m,
        assignedIds: new Set((m.profile_access_designations || []).map((r) => r.designation_id))
      }));
      await loadMemberEmails();
      updateStats();
      renderMembers();
    }

    function renderCatalog() {
      const root = document.getElementById('designations-catalog');
      if (!catalog.length) {
        root.innerHTML = '<p class="cfg-empty">Nenhuma designação cadastrada.</p>';
        return;
      }

      root.innerHTML = catalog.map((d) => {
        const expanded = expandedDesignationId === d.id;
        const permChecks = MODULE_PERMISSIONS.map((p) => {
          const checked = (d.permissions || []).includes(p);
          return isSuper
            ? `<label class="inline-flex items-center gap-1.5"><input type="checkbox" data-des-perm="${d.id}" data-perm="${p}" ${checked ? 'checked' : ''} class="rounded border-outline-variant"/><span>${escapeHtml(PERMISSION_LABELS[p])}</span></label>`
            : (checked ? `<span class="cfg-des-badge">${escapeHtml(PERMISSION_LABELS[p])}</span>` : '');
        }).join('');

        const hubChecked = (d.permissions || []).includes('hub');
        const hubLabel = isSuper
          ? `<label class="inline-flex items-center gap-1.5 font-semibold text-primary"><input type="checkbox" data-des-perm="${d.id}" data-perm="hub" ${hubChecked ? 'checked' : ''} class="rounded border-outline-variant"/><span>Hub</span></label>`
          : (hubChecked ? '<span class="cfg-des-badge">Hub</span>' : '');

        const panelContent = expanded
          ? `
            <div class="space-y-3">
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Nome</label>
                <input type="text" value="${escapeHtml(d.label)}" data-des-label="${d.id}" ${isSuper ? '' : 'readonly'}
                  class="cfg-field font-bold text-primary"/>
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Descrição</label>
                <input type="text" value="${escapeHtml(d.description || '')}" placeholder="Descrição opcional" data-des-desc="${d.id}" ${isSuper ? '' : 'readonly'}
                  class="cfg-field text-on-surface-variant"/>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">Módulos permitidos</p>
                <div class="cfg-des-perm-grid">${hubLabel}${permChecks}</div>
              </div>
              ${isSuper ? `
                <div class="cfg-des-actions">
                  <button type="button" data-des-save="${d.id}" class="cfg-btn cfg-btn--primary">Salvar</button>
                  <button type="button" data-des-toggle="${d.id}" class="cfg-btn cfg-btn--ghost">${d.is_active ? 'Desativar' : 'Ativar'}</button>
                </div>
              ` : `<div class="cfg-des-badges">${permissionBadges(d.permissions)}</div>`}
            </div>`
          : '';

        return `
          <article class="cfg-des-card ${expanded ? 'cfg-des-card--open' : ''} ${d.is_active ? '' : 'cfg-des-card--inactive'}">
            <button type="button" class="cfg-des-header" data-des-select="${d.id}" aria-expanded="${expanded ? 'true' : 'false'}">
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="cfg-des-title">${escapeHtml(d.label)}</span>
                  ${!d.is_active ? '<span class="cfg-des-badge cfg-des-badge--off">Inativa</span>' : ''}
                </div>
                ${d.description ? `<p class="cfg-des-desc line-clamp-2">${escapeHtml(d.description)}</p>` : ''}
                ${!expanded ? permissionSummary(d.permissions) : ''}
              </div>
              <span class="material-symbols-outlined cfg-des-chevron" aria-hidden="true">${expanded ? 'expand_less' : 'expand_more'}</span>
            </button>
            ${expanded ? `<div class="cfg-des-panel">${panelContent}</div>` : ''}
          </article>`;
      }).join('');

      root.querySelectorAll('[data-des-select]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.desSelect;
          expandedDesignationId = expandedDesignationId === id ? null : id;
          renderCatalog();
        });
      });

      if (!isSuper) return;

      root.querySelectorAll('[data-des-save]').forEach((btn) =>
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await saveDesignation(btn.dataset.desSave);
        })
      );
      root.querySelectorAll('[data-des-toggle]').forEach((btn) =>
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await toggleDesignation(btn.dataset.desToggle);
        })
      );
    }

    async function saveDesignation(id) {
      const label = document.querySelector(`[data-des-label="${id}"]`)?.value?.trim();
      const description = document.querySelector(`[data-des-desc="${id}"]`)?.value?.trim() || null;
      const permissions = [];
      document.querySelectorAll(`[data-des-perm="${id}"]`).forEach((cb) => {
        if (cb.checked) permissions.push(cb.dataset.perm);
      });
      if (!permissions.includes('hub') && MODULE_PERMISSIONS.some((p) => permissions.includes(p))) {
        permissions.unshift('hub');
      }
      const item = catalog.find((d) => d.id === id);
      const { error } = await client.from('access_designations').update({
        label,
        description,
        permissions,
        updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, `Designação "${label || item?.label}" salva.`);
        await reloadCatalog();
      }
    }

    async function toggleDesignation(id) {
      const item = catalog.find((d) => d.id === id);
      if (!item) return;
      const { error } = await client.from('access_designations').update({
        is_active: !item.is_active,
        updated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, item.is_active ? 'Designação desativada.' : 'Designação ativada.');
        await reloadCatalog();
      }
    }

    function renderMembers() {
      const activeCatalog = catalog.filter((d) => d.is_active);
      const list = filteredMembers();
      const root = document.getElementById('members-table');

      if (!list.length) {
        root.innerHTML = `<p class="cfg-empty">${members.length ? 'Nenhum membro corresponde à busca.' : 'Nenhum membro cadastrado.'}</p>`;
        return;
      }

      root.innerHTML = list.map((m) => {
        const roleSelect = isSuper
          ? `<select data-role="${m.id}" class="cfg-field">${ROLES.map((r) =>
              `<option value="${r.value}" ${m.role === r.value ? 'selected' : ''}>${r.label}</option>`
            ).join('')}</select>`
          : `<span class="cfg-role-label">${escapeHtml(window.JEAuth.getRoleLabel({ role: m.role, display_role: m.display_role, designation: m.designation, designations: [] }))}</span>`;

        const designationInput = isSuper
          ? `<input type="text" value="${escapeHtml(m.designation || '')}" data-member-designation="${m.id}" placeholder="Ex.: Desenvolvedor" class="cfg-field"/>`
          : `<span class="text-[11px] text-on-surface-variant">${escapeHtml(m.designation || '—')}</span>`;

        const designationChecks = activeCatalog.length
          ? `<div class="cfg-access">${activeCatalog.map((d) => {
              const checked = m.assignedIds.has(d.id);
              return isSuper
                ? `<label><input type="checkbox" data-member-des="${m.id}" data-des-id="${d.id}" ${checked ? 'checked' : ''} class="rounded border-outline-variant"/><span>${escapeHtml(d.label)}</span></label>`
                : (checked ? `<span class="cfg-access-tag">${escapeHtml(d.label)}</span>` : '');
            }).join('')}</div>`
          : '<span class="text-[11px] text-on-surface-variant">—</span>';

        const emailCell = isSuper
          ? `<input type="email" value="${escapeHtml(memberEmails.get(m.id) || '')}" data-member-email="${m.id}" placeholder="email@exemplo.com" class="cfg-field cfg-field--email cfg-member-email" autocomplete="off"/>`
          : '';

        return `
          <div class="cfg-member-row">
            <span class="cfg-member-name" title="${escapeHtml(m.full_name || '')}">
              <span class="material-symbols-outlined" aria-hidden="true">person</span>
              ${escapeHtml(m.full_name || '—')}
            </span>
            <span class="cfg-member-user" title="@${escapeHtml(m.username || '')}">@${escapeHtml(m.username || '—')}</span>
            ${isSuper ? `<span>${emailCell}</span>` : ''}
            <span>${roleSelect}</span>
            <span>${designationInput}</span>
            <span>${designationChecks}</span>
          </div>`;
      }).join('');

      if (!isSuper) return;

      root.querySelectorAll('[data-role]').forEach((sel) =>
        sel.addEventListener('change', async () => {
          const { error } = await client.from('profiles').update({ role: sel.value }).eq('id', sel.dataset.role);
          if (error) showToast(toast, error.message, true);
          else {
            showToast(toast, 'Cargo atualizado.');
            await reloadMembers();
          }
        })
      );

      root.querySelectorAll('[data-member-designation]').forEach((input) => {
        let timer;
        input.addEventListener('input', () => {
          clearTimeout(timer);
          timer = setTimeout(async () => {
            const { error } = await client.from('profiles')
              .update({ designation: input.value.trim() || null })
              .eq('id', input.dataset.memberDesignation);
            if (error) showToast(toast, error.message, true);
          }, 600);
        });
      });

      root.querySelectorAll('[data-member-email]').forEach((input) => {
        const saveEmail = async () => {
          const profileId = input.dataset.memberEmail;
          const nextEmail = input.value.trim().toLowerCase();
          const prevEmail = (memberEmails.get(profileId) || '').toLowerCase();
          if (nextEmail === prevEmail) return;
          if (!isValidEmail(nextEmail)) {
            showToast(toast, 'Informe um e-mail válido.', true);
            input.value = memberEmails.get(profileId) || '';
            return;
          }
          const { error } = await client.rpc('admin_update_user_email', {
            p_profile_id: profileId,
            p_new_email: nextEmail
          });
          if (error) {
            const msg = /duplicate|already registered|unique/i.test(error.message || '')
              ? 'Este e-mail já está em uso por outra conta.'
              : error.message;
            showToast(toast, msg, true);
            input.value = memberEmails.get(profileId) || '';
            return;
          }
          memberEmails.set(profileId, nextEmail);
          showToast(toast, 'E-mail atualizado.');
        };

        input.addEventListener('blur', saveEmail);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
          }
        });
      });

      root.querySelectorAll('[data-member-des]').forEach((cb) =>
        cb.addEventListener('change', async () => {
          const profileId = cb.dataset.memberDes;
          const designationId = cb.dataset.desId;
          if (cb.checked) {
            const { error } = await client.from('profile_access_designations').insert({
              profile_id: profileId,
              designation_id: designationId
            });
            if (error) showToast(toast, error.message, true);
            else showToast(toast, 'Designação atribuída.');
          } else {
            const { error } = await client.from('profile_access_designations').delete()
              .eq('profile_id', profileId)
              .eq('designation_id', designationId);
            if (error) showToast(toast, error.message, true);
            else showToast(toast, 'Designação removida.');
          }
          await reloadMembers();
        })
      );
    }

    document.getElementById('cfg-member-search')?.addEventListener('input', (e) => {
      memberSearch = e.target.value;
      renderMembers();
    });

    document.getElementById('cfg-add-designation')?.addEventListener('click', async () => {
      const label = await window.JEDialog.prompt({
        title: 'Nova designação',
        message: 'Informe o nome da designação.',
        placeholder: 'Coordenador do Quadro de Anúncios',
        confirmLabel: 'Criar'
      });
      if (!label?.trim()) return;
      let slug = slugify(label);
      const existing = catalog.some((d) => d.slug === slug);
      if (existing) slug = `${slug}_${Date.now().toString(36).slice(-4)}`;
      const { data: created, error } = await client.from('access_designations').insert({
        slug,
        label: label.trim(),
        permissions: ['hub'],
        sort_order: (catalog.length + 1) * 10
      }).select('id').single();
      if (error) showToast(toast, error.message, true);
      else {
        expandedDesignationId = created?.id || null;
        showToast(toast, 'Designação criada. Ajuste as permissões e salve.');
        await reloadCatalog();
      }
    });

    await reloadCatalog();
    await reloadMembers();
  }

  window.JEAdminConfiguracoes = { init };

  if (!window.JEHubRouter && document.getElementById('members-table')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})();
