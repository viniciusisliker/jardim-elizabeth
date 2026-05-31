(function () {
  async function guardHubAccess() {
    await window.JEAuth.getClient();
    let session = await window.JEAuth.getSession();
    if (!session) {
      await new Promise((r) => setTimeout(r, 400));
      session = await window.JEAuth.getSession();
    }
    if (!session) {
      window.location.href = 'index.html';
      return null;
    }

    const profile = await window.JEAuth.getCurrentProfile();
    if (!profile || !window.JEAuth.canAccessHub(profile)) {
      window.location.href = 'index.html';
      return null;
    }

    return { session, profile };
  }

  function applyHubModuleVisibility(profile) {
    document.querySelectorAll('[data-hub-requires-permission]').forEach((el) => {
      const perm = el.dataset.hubRequiresPermission;
      el.classList.toggle('hidden', !window.JEAuth.hasPermission(profile, perm));
    });

    document.querySelectorAll('.hub-module-group').forEach((group) => {
      const visibleCards = group.querySelectorAll('.hub-module-card:not(.hidden)');
      group.classList.toggle('hidden', visibleCards.length === 0);
    });
  }

  async function initHub() {
    try {
      if (location.hash === '#agenda') {
        window.location.replace('admin/agenda.html');
        return;
      }

      const access = await guardHubAccess();
      if (!access) return;

      const { profile } = access;

      document.getElementById('hub-user-name').textContent = profile.full_name;
      document.getElementById('hub-user-role').textContent = window.JEAuth.getRoleLabel(profile);

      if (window.JEAuth.isSuperUser(profile.role)) {
        document.getElementById('hub-user-role').classList.add('text-primary', 'font-semibold');
      }
      document.getElementById('hub-user-username').textContent = profile.username ? `@${profile.username}` : '';

      applyHubModuleVisibility(profile);
      window.JEHubChangelog?.init();
    } catch (err) {
      console.warn('Hub init:', err);
      window.location.href = 'index.html';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHub);
  } else {
    initHub();
  }
})();
