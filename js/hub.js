(function () {
  async function guardHubAccess() {
    if (!window.JEAuth?.hasLocalSession?.()) {
      window.location.replace('index.html');
      return null;
    }

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
      const access = await guardHubAccess();
      if (!access) return;

      const { profile } = access;

      document.getElementById('hub-user-name').textContent = profile.full_name;
      document.getElementById('hub-user-role').textContent = window.JEAuth.getRoleLabel(profile);

      if (window.JEAuth.isSuperUser(profile.role)) {
        document.getElementById('hub-user-role').classList.add('text-primary', 'font-semibold');
      }
      document.getElementById('hub-user-username').textContent = profile.username ? `@${profile.username}` : '';

      setupHubTabs();
      applyHubModuleVisibility(profile);
      window.JEHubChangelog?.init();
      document.body.classList.remove('hub-auth-pending');

      const client = await window.JEAuth.getClient();
      await window.JEHubTerritoryAssignment?.init(client, profile);
      await window.JEHubEvents?.initHubEvents(client);
    } catch (err) {
      console.warn('Hub init:', err);
      window.location.href = 'index.html';
    }
  }

  function setupHubTabs() {
    const views = {
      home: document.getElementById('hub-view-home'),
      agenda: document.getElementById('hub-view-agenda')
    };
    const tabTriggers = document.querySelectorAll('[data-hub-tab]');

    function showTab(tab) {
      const name = tab === 'agenda' ? 'agenda' : 'home';
      Object.entries(views).forEach(([key, el]) => {
        if (el) el.classList.toggle('hidden', key !== name);
      });
      if (name === 'agenda') {
        history.replaceState(null, '', '#agenda');
      } else if (location.hash === '#agenda') {
        history.replaceState(null, '', location.pathname + location.search);
      }
    }

    tabTriggers.forEach((el) => {
      el.addEventListener('click', () => showTab(el.dataset.hubTab));
    });

    if (location.hash === '#agenda') showTab('agenda');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHub);
  } else {
    initHub();
  }
})();
