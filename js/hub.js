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
    if (!profile || !window.JEAuth.isAdminRole(profile.role)) {
      window.location.href = 'index.html';
      return null;
    }

    return { session, profile };
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

      const client = await window.JEAuth.getClient();
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
    const tabButtons = document.querySelectorAll('[data-hub-tab]');

    function showTab(tab) {
      const name = tab === 'agenda' ? 'agenda' : 'home';
      Object.entries(views).forEach(([key, el]) => {
        if (el) el.classList.toggle('hidden', key !== name);
      });
      tabButtons.forEach((btn) => {
        const active = btn.dataset.hubTab === name;
        btn.classList.toggle('hub-tab-active', active);
        btn.classList.toggle('text-on-surface-variant', !active);
      });
      if (name === 'agenda') {
        history.replaceState(null, '', '#agenda');
      } else if (location.hash === '#agenda') {
        history.replaceState(null, '', location.pathname + location.search);
      }
    }

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => showTab(btn.dataset.hubTab));
    });

    if (location.hash === '#agenda') showTab('agenda');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHub);
  } else {
    initHub();
  }
})();
