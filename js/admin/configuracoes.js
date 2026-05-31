(function () {
  const { guardAdmin, getClient, showToast, escapeHtml } = window.JEAdmin;

  const ROLES = [
    { value: 'superuser', label: 'SuperUser' },
    { value: 'anciao', label: 'Ancião' },
    { value: 'servo_ministerial', label: 'Servo Ministerial' },
    { value: 'publicador', label: 'Publicador' }
  ];

  async function init() {
    const profile = await guardAdmin();
    if (!profile) return;
    const toast = document.getElementById('admin-toast');
    const client = await getClient();
    const isSuper = window.JEAuth.isSuperUser(profile.role);
    let members = [];

    document.getElementById('cfg-role-note').textContent = isSuper
      ? 'Como SuperUser, você pode alterar cargos dos membros.'
      : 'Somente o SuperUser pode alterar cargos. Você pode visualizar a equipe.';

    async function reload() {
      const { data, error } = await client.from('profiles').select('id, full_name, username, role, designation').order('full_name');
      if (error) {
        document.getElementById('members-table').innerHTML = `<p class="text-error text-sm p-4">${escapeHtml(error.message)}</p>`;
        return;
      }
      members = data || [];
      render();
    }

    function render() {
      document.getElementById('members-table').innerHTML = members.map((m) => {
        const roleSelect = isSuper
          ? `<select data-role="${m.id}" class="text-xs rounded-lg border-outline-variant">${ROLES.map((r) =>
              `<option value="${r.value}" ${m.role === r.value ? 'selected' : ''}>${r.label}</option>`
            ).join('')}</select>`
          : `<span class="text-xs font-semibold text-secondary">${escapeHtml(window.JEAuth.getRoleLabel(m))}</span>`;
        return `
          <div class="grid grid-cols-1 md:grid-cols-4 gap-2 px-4 py-3 border-b border-outline-variant items-center text-sm">
            <span class="font-semibold text-primary">${escapeHtml(m.full_name)}</span>
            <span class="text-on-surface-variant text-xs">${escapeHtml(m.username || '—')}</span>
            <span>${roleSelect}</span>
            <span class="text-xs text-on-surface-variant">${escapeHtml(m.designation || '—')}</span>
          </div>`;
      }).join('');

      if (isSuper) {
        document.querySelectorAll('[data-role]').forEach((sel) =>
          sel.addEventListener('change', async () => {
            const { error } = await client.from('profiles').update({ role: sel.value }).eq('id', sel.dataset.role);
            if (error) showToast(toast, error.message, true);
            else showToast(toast, 'Cargo atualizado.');
          })
        );
      }
    }

    await reload();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
