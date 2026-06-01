(function () {
  const { guardAdmin, getClient, showToast, escapeHtml } = window.JEAdmin;
  const { PERMISSION_LABELS, MODULE_PERMISSIONS } = window.JEAccess;

  const ROLES = [
    { value: 'superuser', label: 'SuperUser' },
    { value: 'anciao', label: 'Ancião' },
    { value: 'servo_ministerial', label: 'Servo Ministerial' },
    { value: 'publicador', label: 'Publicador' }
  ];

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
      .map((p) => `<span class="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-secondary/10 text-secondary mr-1 mb-1">${escapeHtml(PERMISSION_LABELS[p] || p)}</span>`)
      .join('');
  }

  function permissionSummary(permissions) {
    const perms = permissions || [];
    if (!perms.length) {
      return '<span class="text-xs text-on-surface-variant">Nenhum módulo — expanda para configurar</span>';
    }
    return perms
      .map((p) => `<span class="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary mr-1">${escapeHtml(PERMISSION_LABELS[p] || p)}</span>`)
      .join('');
  }

  async function init() {
    const profile = await guardAdmin();
    if (!profile) return;

    const toast = document.getElementById('admin-toast');
    const client = await getClient();
    const isSuper = window.JEAuth.isSuperUser(profile.role);
    let members = [];
    let catalog = [];
    let expandedDesignationId = null;

    document.getElementById('cfg-role-note').textContent = isSuper
      ? 'Como SuperUser, você gerencia designações de acesso, cargos e atribuições da equipe.'
      : 'Somente o SuperUser pode alterar designações e cargos. Você pode visualizar a equipe.';

    if (isSuper) {
      document.getElementById('cfg-designations-section').classList.remove('hidden');
    }

    async function reloadCatalog() {
      const { data, error } = await client
        .from('access_designations')
        .select('*')
        .order('sort_order');
      if (error) {
        document.getElementById('designations-catalog').innerHTML = `<p class="text-error text-sm">${escapeHtml(error.message)}</p>`;
        return;
      }
      catalog = data || [];
      renderCatalog();
    }

    async function reloadMembers() {
      const { data, error } = await client
        .from('profiles')
        .select('id, full_name, username, role, designation, profile_access_designations(designation_id)')
        .order('full_name');
      if (error) {
        document.getElementById('members-table').innerHTML = `<p class="text-error text-sm p-4">${escapeHtml(error.message)}</p>`;
        return;
      }
      members = (data || []).map((m) => ({
        ...m,
        assignedIds: new Set((m.profile_access_designations || []).map((r) => r.designation_id))
      }));
      renderMembers();
    }

    function renderCatalog() {
      const root = document.getElementById('designations-catalog');
      if (!catalog.length) {
        root.innerHTML = '<p class="text-sm text-on-surface-variant">Nenhuma designação cadastrada.</p>';
        return;
      }

      root.innerHTML = catalog.map((d) => {
        const expanded = expandedDesignationId === d.id;
        const permChecks = MODULE_PERMISSIONS.map((p) => {
          const checked = (d.permissions || []).includes(p);
          return isSuper
            ? `<label class="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" data-des-perm="${d.id}" data-perm="${p}" ${checked ? 'checked' : ''} class="rounded border-outline-variant"/><span>${escapeHtml(PERMISSION_LABELS[p])}</span></label>`
            : (checked ? `<span class="text-xs text-on-surface-variant">${escapeHtml(PERMISSION_LABELS[p])}</span>` : '');
        }).join('');

        const hubChecked = (d.permissions || []).includes('hub');
        const hubLabel = isSuper
          ? `<label class="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><input type="checkbox" data-des-perm="${d.id}" data-perm="hub" ${hubChecked ? 'checked' : ''} class="rounded border-outline-variant"/><span>Hub</span></label>`
          : (hubChecked ? '<span class="text-xs font-semibold text-primary">Hub</span>' : '');

        const panelContent = expanded
          ? `
            <div class="space-y-3">
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Nome</label>
                <input type="text" value="${escapeHtml(d.label)}" data-des-label="${d.id}" ${isSuper ? '' : 'readonly'}
                  class="w-full font-bold text-primary text-sm rounded-lg border border-outline-variant px-3 py-2 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"/>
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Descrição</label>
                <input type="text" value="${escapeHtml(d.description || '')}" placeholder="Descrição opcional" data-des-desc="${d.id}" ${isSuper ? '' : 'readonly'}
                  class="w-full text-sm text-on-surface-variant rounded-lg border border-outline-variant px-3 py-2 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"/>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">Módulos permitidos</p>
                <div class="cfg-des-perm-grid">${hubLabel}${permChecks}</div>
              </div>
              ${isSuper ? `
                <div class="flex flex-wrap gap-2 pt-1">
                  <button type="button" data-des-save="${d.id}" class="text-xs font-semibold px-4 py-2 rounded-lg bg-secondary text-white hover:opacity-90">Salvar</button>
                  <button type="button" data-des-toggle="${d.id}" class="text-xs font-semibold px-4 py-2 rounded-lg border border-outline-variant hover:bg-surface-container-low">${d.is_active ? 'Desativar' : 'Ativar'}</button>
                </div>
              ` : `<div class="text-xs pt-1">${permissionBadges(d.permissions)}</div>`}
            </div>`
          : '';

        return `
          <article class="cfg-des-card ${expanded ? 'cfg-des-card--open' : ''} ${d.is_active ? '' : 'opacity-60'}">
            <button type="button" class="cfg-des-header" data-des-select="${d.id}" aria-expanded="${expanded ? 'true' : 'false'}">
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-bold text-primary text-sm">${escapeHtml(d.label)}</span>
                  ${!d.is_active ? '<span class="text-[10px] uppercase font-bold text-error">Inativa</span>' : ''}
                </div>
                ${d.description ? `<p class="text-xs text-on-surface-variant mt-0.5 line-clamp-2">${escapeHtml(d.description)}</p>` : ''}
                ${!expanded ? `<div class="mt-2">${permissionSummary(d.permissions)}</div>` : ''}
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

      document.getElementById('members-table').innerHTML = members.map((m) => {
        const roleSelect = isSuper
          ? `<select data-role="${m.id}" class="text-xs rounded-lg border-outline-variant w-full">${ROLES.map((r) =>
              `<option value="${r.value}" ${m.role === r.value ? 'selected' : ''}>${r.label}</option>`
            ).join('')}</select>`
          : `<span class="text-xs font-semibold text-secondary">${escapeHtml(window.JEAuth.getRoleLabel({ role: m.role, designation: m.designation, designations: [] }))}</span>`;

        const designationInput = isSuper
          ? `<input type="text" value="${escapeHtml(m.designation || '')}" data-member-designation="${m.id}" placeholder="Ex.: Desenvolvedor" class="text-xs w-full rounded-lg border-outline-variant px-2 py-1"/>`
          : `<span class="text-xs text-on-surface-variant">${escapeHtml(m.designation || '—')}</span>`;

        const designationChecks = activeCatalog.length
          ? `<div class="flex flex-wrap gap-x-3 gap-y-1">${activeCatalog.map((d) => {
              const checked = m.assignedIds.has(d.id);
              return isSuper
                ? `<label class="inline-flex items-center gap-1.5 text-xs cursor-pointer"><input type="checkbox" data-member-des="${m.id}" data-des-id="${d.id}" ${checked ? 'checked' : ''} class="rounded border-outline-variant"/><span>${escapeHtml(d.label)}</span></label>`
                : (checked ? `<span class="text-xs font-semibold text-secondary">${escapeHtml(d.label)}</span>` : '');
            }).join('')}</div>`
          : '<span class="text-xs text-on-surface-variant">—</span>';

        return `
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 px-4 py-3 border-b border-outline-variant items-start text-sm">
            <span class="lg:col-span-2 font-semibold text-primary">${escapeHtml(m.full_name)}</span>
            <span class="lg:col-span-2 text-on-surface-variant text-xs">@${escapeHtml(m.username || '—')}</span>
            <span class="lg:col-span-2">${roleSelect}</span>
            <span class="lg:col-span-2">${designationInput}</span>
            <span class="lg:col-span-4">${designationChecks}</span>
          </div>`;
      }).join('');

      if (!isSuper) return;

      document.querySelectorAll('[data-role]').forEach((sel) =>
        sel.addEventListener('change', async () => {
          const { error } = await client.from('profiles').update({ role: sel.value }).eq('id', sel.dataset.role);
          if (error) showToast(toast, error.message, true);
          else showToast(toast, 'Cargo atualizado.');
        })
      );

      document.querySelectorAll('[data-member-designation]').forEach((input) => {
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

      document.querySelectorAll('[data-member-des]').forEach((cb) =>
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

    document.getElementById('cfg-add-designation')?.addEventListener('click', async () => {
      const label = window.prompt('Nome da designação (ex.: Coordenador do Quadro de Anúncios):');
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
