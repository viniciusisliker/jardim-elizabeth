(function () {
  const QUERY_TIMEOUT_MS = 8000;

  function withTimeout(promise, ms = QUERY_TIMEOUT_MS) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), ms);
      })
    ]);
  }

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

  function renderMembersError(list, message) {
    list.innerHTML = `<p class="px-4 py-6 text-sm text-error">${message}</p>`;
  }

  async function loadMembers() {
    const list = document.getElementById('members-list');
    if (!list) return;

    try {
      const client = await window.JEAuth.getClient();
      if (!client) {
        renderMembersError(list, 'Não foi possível conectar ao serviço de autenticação.');
        return;
      }

      const { data, error } = await withTimeout(
        client
          .from('profiles')
          .select('full_name, role, designation, username')
          .order('role')
          .order('full_name')
      );

      if (error) {
        renderMembersError(list, 'Não foi possível carregar os membros.');
        console.warn('Hub membros:', error.message);
        return;
      }

      if (!data?.length) {
        list.innerHTML = '<p class="px-4 py-6 text-sm text-on-surface-variant">Nenhum membro encontrado.</p>';
        return;
      }

      list.innerHTML = data.map((member) => `
        <div class="flex items-center justify-between px-4 py-3 border-b border-outline-variant last:border-0">
          <div>
            <span class="font-medium text-primary text-sm">${member.full_name}</span>
            ${member.username ? `<p class="text-xs text-outline">@${member.username}</p>` : ''}
          </div>
          <span class="text-xs font-semibold uppercase tracking-wider text-secondary">${window.JEAuth.getRoleLabel(member)}</span>
        </div>
      `).join('');
    } catch (err) {
      renderMembersError(list, 'Tempo esgotado ao carregar membros. Recarregue a página.');
      console.warn('Hub membros:', err);
    }
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
      await Promise.all([
        loadMembers(),
        window.JEHubEvents?.initHubEvents(client)
      ]);
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
