(function () {
  const { guardPermission, getClient, showToast, escapeHtml } = window.JEAdmin;
  const { PERMISSION_LABELS, MODULE_PERMISSIONS } = window.JEAccess;

  const ROLES = [
    { value: 'superuser', label: 'SuperUser' },
    { value: 'anciao', label: 'Ancião' },
    { value: 'servo_ministerial', label: 'Servo Ministerial' },
    { value: 'publicador', label: 'Publicador' }
  ];

  const ADMIN_ROLES = new Set(window.JE_CONFIG?.adminRoles || ['superuser', 'anciao', 'servo_ministerial']);
  const AVATAR_BUCKET = 'profile-avatars';
  const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
  const ACCESS_NONE = '__none__';
  const ROLE_FILTER_OPTIONS = ROLES.map((r) => ({ value: r.value, label: r.label }));

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

  function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isValidUsername(value) {
    return /^[a-z0-9._-]{3,32}$/.test(normalizeUsername(value));
  }

  function normalizeFullName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function isValidFullName(value) {
    const name = normalizeFullName(value);
    return name.length >= 2 && name.length <= 120;
  }

  function avatarFileExtension(file) {
    if (file.type === 'image/png') return 'png';
    if (file.type === 'image/webp') return 'webp';
    return 'jpg';
  }

  async function init() {
    if (window.__JEAdminConfigInit) return;
    window.__JEAdminConfigInit = true;
    const profile = await guardPermission('settings');
    if (!profile) return;
    const currentProfileId = profile.id;

    const toast = document.getElementById('hub-admin-toast') || document.getElementById('admin-toast');
    const client = await getClient();
    const isSuper = window.JEAuth.isSuperUser(profile.role);
    const xlf = window.JETableXlf;
    let members = [];
    let catalog = [];
    let expandedDesignationId = null;
    let memberSearch = '';
    let memberEmails = new Map();
    const memberSort = { col: 'name', dir: 'asc' };
    const memberFilter = {
      name: {},
      email: {},
      role: {},
      designation: {},
      access: {}
    };
    let memberFilterSig = '';

    document.getElementById('cfg-role-note').textContent = isSuper
      ? 'Como SuperUser, você gerencia designações, cargos, usuários, e-mails, fotos e atribuições da equipe.'
      : 'Somente o SuperUser pode alterar designações e cargos. Você pode visualizar a equipe.';

    if (isSuper) {
      document.getElementById('cfg-designations-section').classList.remove('hidden');
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

    function memberRoleLabel(m) {
      return window.JEAuth.getRoleLabel({
        role: m.role,
        display_role: m.display_role,
        designation: m.designation,
        designations: []
      });
    }

    function memberAccessSortKey(m) {
      const labels = catalog
        .filter((d) => d.is_active && m.assignedIds.has(d.id))
        .map((d) => d.label)
        .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
      return labels.length ? labels.join(', ') : '—';
    }

    function syncMemberFilterOptions() {
      if (!xlf) return false;
      xlf.xlfEnsureKeys(
        memberFilter.name,
        [...new Set(members.map((m) => m.full_name || '—'))].sort((a, b) =>
          a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
        )
      );
      if (isSuper) {
        xlf.xlfEnsureKeys(
          memberFilter.email,
          [...new Set(members.map((m) => memberEmails.get(m.id) || '—'))].sort((a, b) =>
            a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
          )
        );
      }
      xlf.xlfEnsureKeys(memberFilter.role, ROLES.map((r) => r.value));
      xlf.xlfEnsureKeys(
        memberFilter.designation,
        [...new Set(members.map((m) => m.designation || '—'))].sort((a, b) =>
          a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
        )
      );
      xlf.xlfEnsureKeys(memberFilter.access, [
        ACCESS_NONE,
        ...catalog.filter((d) => d.is_active).map((d) => d.id)
      ]);
      const sig = Object.entries(memberFilter)
        .map(([key, map]) => `${key}:${Object.keys(map).join('\0')}`)
        .join('::');
      const changed = sig !== memberFilterSig;
      memberFilterSig = sig;
      return changed;
    }

    function applyMemberAccessFilter(list) {
      if (!xlf) return list;
      const map = memberFilter.access;
      const total = Object.keys(map).length;
      const keys = xlf.xlfSelectedKeys(map);
      if (keys.length >= total) return list;
      if (!keys.length) return [];
      return list.filter((m) => {
        const assigned = catalog.filter((d) => d.is_active && m.assignedIds.has(d.id));
        if (!assigned.length) return keys.includes(ACCESS_NONE);
        return assigned.some((d) => keys.includes(d.id));
      });
    }

    function getSortedMembers(list) {
      const { col, dir } = memberSort;
      const mul = dir === 'asc' ? 1 : -1;
      return [...list].sort((a, b) => {
        let cmp = 0;
        switch (col) {
          case 'name':
            cmp = (a.full_name || '').localeCompare(b.full_name || '', 'pt-BR', { sensitivity: 'base' });
            break;
          case 'email':
            cmp = (memberEmails.get(a.id) || '').localeCompare(memberEmails.get(b.id) || '', 'pt-BR', { sensitivity: 'base' });
            break;
          case 'role':
            cmp = memberRoleLabel(a).localeCompare(memberRoleLabel(b), 'pt-BR', { sensitivity: 'base' });
            break;
          case 'designation':
            cmp = (a.designation || '').localeCompare(b.designation || '', 'pt-BR', { sensitivity: 'base' });
            break;
          case 'access':
            cmp = memberAccessSortKey(a).localeCompare(memberAccessSortKey(b), 'pt-BR', { sensitivity: 'base' });
            break;
          default:
            cmp = (a.full_name || '').localeCompare(b.full_name || '', 'pt-BR', { sensitivity: 'base' });
        }
        if (cmp === 0) {
          cmp = (a.full_name || '').localeCompare(b.full_name || '', 'pt-BR', { sensitivity: 'base' });
        }
        return cmp * mul;
      });
    }

    function getFilteredMembers() {
      let list = members;
      const q = memberSearch.trim().toLowerCase();
      if (q) {
        list = list.filter((m) => {
          const email = memberEmails.get(m.id) || '';
          const hay = `${m.full_name || ''} ${m.username || ''} ${m.designation || ''} ${email}`.toLowerCase();
          return hay.includes(q);
        });
      }
      if (!xlf) return getSortedMembers(list);
      list = xlf.xlfApplyMapFilter(list, memberFilter.name, (m) => m.full_name || '—');
      if (isSuper) {
        list = xlf.xlfApplyMapFilter(list, memberFilter.email, (m) => memberEmails.get(m.id) || '—');
      }
      list = xlf.xlfApplyMapFilter(list, memberFilter.role, (m) => m.role);
      list = xlf.xlfApplyMapFilter(list, memberFilter.designation, (m) => m.designation || '—');
      list = applyMemberAccessFilter(list);
      return getSortedMembers(list);
    }

    function memberHeaderRow() {
      syncMemberFilterOptions();
      const nameOpts = xlf.xlfOptionsFromKeys(Object.keys(memberFilter.name));
      const emailOpts = xlf.xlfOptionsFromKeys(Object.keys(memberFilter.email));
      const desOpts = xlf.xlfOptionsFromKeys(Object.keys(memberFilter.designation));
      const accessOpts = [
        { value: ACCESS_NONE, label: 'Sem designação' },
        ...catalog.filter((d) => d.is_active).map((d) => ({ value: d.id, label: d.label }))
      ];
      let html = xlf.xlfColumnHeader('member-sort', memberSort, memberFilter, {
        col: 'name',
        label: 'Membro',
        filterKey: 'name',
        options: nameOpts,
        wrap: 'span'
      });
      if (isSuper) {
        html += xlf.xlfColumnHeader('member-sort', memberSort, memberFilter, {
          col: 'email',
          label: 'E-mail',
          filterKey: 'email',
          options: emailOpts,
          wrap: 'span'
        });
      }
      html += xlf.xlfColumnHeader('member-sort', memberSort, memberFilter, {
        col: 'role',
        label: 'Cargo',
        filterKey: 'role',
        options: ROLE_FILTER_OPTIONS,
        wrap: 'span'
      });
      html += xlf.xlfColumnHeader('member-sort', memberSort, memberFilter, {
        col: 'designation',
        label: 'Design.',
        filterKey: 'designation',
        options: desOpts,
        wrap: 'span'
      });
      html += xlf.xlfColumnHeader('member-sort', memberSort, memberFilter, {
        col: 'access',
        label: 'Acesso',
        filterKey: 'access',
        options: accessOpts,
        wrap: 'span'
      });
      return html;
    }

    function ensureMemberTableHeader() {
      const head = document.getElementById('cfg-members-head');
      const scroll = document.querySelector('.cfg-members-scroll');
      if (!head) return;
      if (!xlf) {
        head.innerHTML = `<span>Membro</span>${isSuper ? '<span>E-mail</span>' : ''}<span>Cargo</span><span>Design.</span><span>Acesso</span>`;
        return;
      }
      if (scroll) scroll.dataset.xlfScope = 'cfg-members';
      head.innerHTML = memberHeaderRow();
      if (!scroll) return;
      delete scroll.dataset.xlfBound;
      xlf.bindXlfPanel(scroll, 'member-sort', memberFilter, memberSort, () => renderMembers({ updateUi: true }));
    }

    function bindMemberFilters() {
      ensureMemberTableHeader();
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
      if (members.length) renderMembers({ updateUi: true });
    }

    async function reloadMembers() {
      const { data, error } = await client
        .from('profiles')
        .select('id, full_name, username, role, display_role, designation, avatar_url, profile_access_designations(designation_id)')
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
      bindMemberFilters();
      renderMembers({ updateUi: true });
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

    function memberAvatarHtml(member) {
      if (window.JEAuth?.renderAvatarHtml) {
        return window.JEAuth.renderAvatarHtml(member, { size: 26, className: 'cfg-avatar-img' });
      }
      return '<span class="material-symbols-outlined je-profile-avatar-fallback" aria-hidden="true">person</span>';
    }

    function memberMainCell(m) {
      const avatarInner = memberAvatarHtml(m);
      const avatarControl = isSuper
        ? `<label class="cfg-avatar-btn" title="Alterar foto">
            <input type="file" accept="image/jpeg,image/png,image/webp" data-member-avatar="${m.id}" hidden/>
            ${avatarInner}
          </label>
          ${m.avatar_url ? `<button type="button" class="cfg-avatar-remove" data-member-avatar-remove="${m.id}" title="Remover foto" aria-label="Remover foto">×</button>` : ''}`
        : `<span class="cfg-avatar-btn" aria-hidden="true">${avatarInner}</span>`;

      const nameLine = isSuper
        ? `<input type="text" value="${escapeHtml(m.full_name || '')}" data-member-fullname="${m.id}" placeholder="Nome completo" class="cfg-field cfg-field--name" autocomplete="name" spellcheck="false" title="Nome exibido no site"/>`
        : `<span class="cfg-member-name" title="${escapeHtml(m.full_name || '')}">${escapeHtml(m.full_name || '—')}</span>`;

      const userLine = isSuper
        ? `<label class="cfg-member-user-edit" title="Usuário de login">
            <span class="cfg-member-user-prefix" aria-hidden="true">@</span>
            <input type="text" value="${escapeHtml(m.username || '')}" data-member-username="${m.id}" placeholder="usuario" class="cfg-field cfg-field--username" autocomplete="off" spellcheck="false"/>
          </label>`
        : `<span class="cfg-member-user" title="@${escapeHtml(m.username || '')}">@${escapeHtml(m.username || '—')}</span>`;

      return `
        <div class="cfg-member-main">
          ${avatarControl}
          <div class="cfg-member-text">
            ${nameLine}
            ${userLine}
          </div>
        </div>`;
    }

    async function removeAvatarFiles(profileId) {
      const { data: files } = await client.storage.from(AVATAR_BUCKET).list(profileId, { limit: 20 });
      if (!files?.length) return;
      const paths = files.map((f) => `${profileId}/${f.name}`);
      await client.storage.from(AVATAR_BUCKET).remove(paths);
    }

    function renderMembers(opts = {}) {
      const { updateUi = false } = opts;
      const scroll = document.querySelector('.cfg-members-scroll');
      if (xlf) {
        const filtersChanged = syncMemberFilterOptions();
        if (!document.getElementById('cfg-members-head')?.querySelector('[data-member-sort]')) {
          ensureMemberTableHeader();
        } else if (filtersChanged) {
          ensureMemberTableHeader();
        }
        if (updateUi) {
          xlf.xlfUpdateSortUI(scroll, 'member-sort', memberSort);
          xlf.xlfUpdateFilterUI(scroll, memberFilter);
        }
      } else if (!document.getElementById('cfg-members-head')?.innerHTML.trim()) {
        ensureMemberTableHeader();
      }

      const activeCatalog = catalog.filter((d) => d.is_active);
      const list = getFilteredMembers();
      const root = document.getElementById('members-table');

      if (!list.length) {
        root.innerHTML = `<p class="cfg-empty">${members.length ? 'Nenhum membro corresponde à busca ou filtros.' : 'Nenhum membro cadastrado.'}</p>`;
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
          ? `<input type="email" value="${escapeHtml(memberEmails.get(m.id) || '')}" data-member-email="${m.id}" placeholder="email@…" class="cfg-field cfg-field--email" autocomplete="off"/>`
          : '';

        return `
          <div class="cfg-member-row" data-member-row="${m.id}">
            <span>${memberMainCell(m)}</span>
            ${isSuper ? `<span>${emailCell}</span>` : ''}
            <span>${roleSelect}</span>
            <span>${designationInput}</span>
            <span>${designationChecks}</span>
          </div>`;
      }).join('');

      if (!isSuper) return;

      root.querySelectorAll('[data-member-avatar]').forEach((input) => {
        input.addEventListener('change', async () => {
          const file = input.files?.[0];
          input.value = '';
          const profileId = input.dataset.memberAvatar;
          const member = members.find((m) => m.id === profileId);
          const label = input.closest('.cfg-avatar-btn');
          if (!file || !member) return;

          if (!file.type.startsWith('image/')) {
            showToast(toast, 'Use JPG, PNG ou WebP.', true);
            return;
          }
          if (file.size > MAX_AVATAR_BYTES) {
            showToast(toast, 'Imagem até 2 MB.', true);
            return;
          }

          label?.classList.add('cfg-avatar-btn--busy');
          try {
            await removeAvatarFiles(profileId);
            const ext = avatarFileExtension(file);
            const path = `${profileId}/avatar.${ext}`;
            const { error: upErr } = await client.storage.from(AVATAR_BUCKET).upload(path, file, {
              upsert: true,
              contentType: file.type,
              cacheControl: '3600'
            });
            if (upErr) throw upErr;

            const { data: pub } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path);
            const avatarUrl = `${pub.publicUrl}?v=${Date.now()}`;
            const { error: rpcErr } = await client.rpc('admin_update_profile_avatar', {
              p_profile_id: profileId,
              p_avatar_url: avatarUrl
            });
            if (rpcErr) throw rpcErr;

            member.avatar_url = avatarUrl;
            showToast(toast, `Foto de ${member.full_name || 'membro'} atualizada.`);
            renderMembers();
          } catch (err) {
            console.error('Avatar upload:', err);
            showToast(toast, err?.message || 'Erro ao enviar foto.', true);
          } finally {
            label?.classList.remove('cfg-avatar-btn--busy');
          }
        });
      });

      root.querySelectorAll('[data-member-avatar-remove]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const profileId = btn.dataset.memberAvatarRemove;
          const member = members.find((m) => m.id === profileId);
          if (!member || !window.confirm(`Remover foto de ${member.full_name || 'membro'}?`)) return;

          btn.disabled = true;
          try {
            await removeAvatarFiles(profileId);
            const { error: rpcErr } = await client.rpc('admin_update_profile_avatar', {
              p_profile_id: profileId,
              p_avatar_url: null
            });
            if (rpcErr) throw rpcErr;
            member.avatar_url = null;
            showToast(toast, 'Foto removida.');
            renderMembers();
          } catch (err) {
            showToast(toast, err?.message || 'Erro ao remover foto.', true);
          } finally {
            btn.disabled = false;
          }
        });
      });

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

      root.querySelectorAll('[data-member-fullname]').forEach((input) => {
        const saveFullName = async () => {
          const profileId = input.dataset.memberFullname;
          const member = members.find((m) => m.id === profileId);
          const nextName = normalizeFullName(input.value);
          const prevName = normalizeFullName(member?.full_name || '');
          if (nextName === prevName) return;
          if (!isValidFullName(nextName)) {
            showToast(toast, 'Informe um nome entre 2 e 120 caracteres.', true);
            input.value = member?.full_name || '';
            return;
          }
          const { error } = await client.rpc('admin_update_profile_full_name', {
            p_profile_id: profileId,
            p_full_name: nextName
          });
          if (error) {
            showToast(toast, error.message, true);
            input.value = member?.full_name || '';
            return;
          }
          if (member) member.full_name = nextName;
          showToast(toast, 'Nome atualizado.');
          if (profileId === currentProfileId) {
            const fresh = await window.JEAuth.refreshCurrentProfile();
            if (fresh) {
              window.dispatchEvent(new CustomEvent('je:profile-updated', { detail: { profile: fresh } }));
            }
          }
          renderMembers({ updateUi: true });
        };

        input.addEventListener('blur', saveFullName);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
          }
        });
      });

      root.querySelectorAll('[data-member-username]').forEach((input) => {
        const saveUsername = async () => {
          const profileId = input.dataset.memberUsername;
          const member = members.find((m) => m.id === profileId);
          const nextUsername = normalizeUsername(input.value);
          const prevUsername = normalizeUsername(member?.username || '');
          if (nextUsername === prevUsername) return;
          if (!isValidUsername(nextUsername)) {
            showToast(toast, 'Usuário inválido (3–32 caracteres: letras, números, ponto, hífen ou underline).', true);
            input.value = member?.username || '';
            return;
          }
          const { error } = await client.rpc('admin_update_user_username', {
            p_profile_id: profileId,
            p_new_username: nextUsername
          });
          if (error) {
            const msg = /ja esta em uso|duplicate|unique/i.test(error.message || '')
              ? 'Este usuário já está em uso.'
              : error.message;
            showToast(toast, msg, true);
            input.value = member?.username || '';
            return;
          }
          if (member) member.username = nextUsername;
          showToast(toast, 'Usuário atualizado.');
          renderMembers({ updateUi: true });
        };

        input.addEventListener('blur', saveUsername);
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
      renderMembers({ updateUi: true });
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
