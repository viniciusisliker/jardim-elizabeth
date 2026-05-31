(function () {
  const ROLE_LABELS = {
    anciao: 'Ancião',
    servo_ministerial: 'Servo Ministerial',
    publicador: 'Publicador'
  };

  async function guardHubAccess() {
    const session = await window.JEAuth.getSession();
    if (!session) {
      window.location.href = 'index.html';
      return null;
    }

    const profile = await window.JEAuth.getCurrentProfile();
    if (!profile || !window.JEAuth.isAdminRole(profile.role)) {
      window.location.href = 'index.html';
      return null;
    }

    return { session, profile };
  }

  async function loadMembers() {
    const client = window.JEAuth.getClient();
    const list = document.getElementById('members-list');
    if (!client || !list) return;

    const { data, error } = await client
      .from('profiles')
      .select('full_name, role, designation')
      .order('role')
      .order('full_name');

    if (error) {
      list.innerHTML = `<p class="text-sm text-error">Não foi possível carregar os membros.</p>`;
      return;
    }

    list.innerHTML = data.map((member) => `
      <div class="flex items-center justify-between px-4 py-3 border-b border-outline-variant last:border-0">
        <span class="font-medium text-primary text-sm">${member.full_name}</span>
        <span class="text-xs font-semibold uppercase tracking-wider text-secondary">${window.JEAuth.getRoleLabel(member)}</span>
      </div>
    `).join('');
  }

  async function initHub() {
    const access = await guardHubAccess();
    if (!access) return;

    const { profile, session } = access;

    document.getElementById('hub-user-name').textContent = profile.full_name;
    document.getElementById('hub-user-role').textContent = window.JEAuth.getRoleLabel(profile);

    if (window.JEAuth.isSuperUser(profile.role)) {
      document.getElementById('hub-user-role').classList.add('text-primary', 'font-semibold');
    }
    document.getElementById('hub-user-email').textContent = session.user.email || '';

    await loadMembers();
  }

  document.addEventListener('DOMContentLoaded', initHub);
})();
