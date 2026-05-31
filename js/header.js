(function () {
  function siteBase() {
    return /\/admin(\/|$)/.test(window.location.pathname) ? '..' : '.';
  }

  function siteUrl(path) {
    const clean = path.replace(/^\.\//, '');
    return `${siteBase()}/${clean}`.replace(/\/+/g, '/').replace(/^\.\//, '');
  }

  function qs(id) {
    return document.getElementById(id);
  }

  function isHubPage() {
    const path = window.location.pathname.toLowerCase();
    return path.includes('/hub') || path.endsWith('hub.html') || path.includes('/admin/');
  }

  function closeDropdown() {
    const dropdown = qs('profile-dropdown');
    const btn = qs('profile-btn');
    if (dropdown) dropdown.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function openDropdown() {
    const dropdown = qs('profile-dropdown');
    const btn = qs('profile-btn');
    if (dropdown) dropdown.classList.remove('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }

  function toggleDropdown() {
    const dropdown = qs('profile-dropdown');
    if (!dropdown) return;
    if (dropdown.classList.contains('hidden')) openDropdown();
    else closeDropdown();
  }

  function showLoginModal() {
    qs('login-modal')?.classList.remove('hidden');
    qs('login-error')?.classList.add('hidden');
  }

  function hideLoginModal() {
    qs('login-modal')?.classList.add('hidden');
    const form = qs('login-form');
    if (form) form.reset();
  }

  function updateHubAccess(profile) {
    const hubBtn = qs('hub-nav-btn');
    const isAdmin = profile && window.JEAuth?.isAdminRole(profile.role);

    if (hubBtn) {
      hubBtn.classList.toggle('hidden', !isAdmin);
      hubBtn.classList.toggle('flex', !!isAdmin);
    }

    const mobileMenu = qs('mobile-menu');
    let mobileHub = qs('mobile-hub-link');

    if (isAdmin && mobileMenu && !mobileHub) {
      mobileHub = document.createElement('a');
      mobileHub.id = 'mobile-hub-link';
      mobileHub.href = siteUrl('hub.html');
      mobileHub.className = 'nav-link px-2 py-2 rounded-lg hover:bg-surface-container-low text-primary font-semibold flex items-center gap-2';
      mobileHub.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px">dashboard</span> Hub Administrativo';
      mobileMenu.querySelector('div')?.prepend(mobileHub);
    } else if (!isAdmin && mobileHub) {
      mobileHub.remove();
    }
  }

  function renderGuestMenu() {
    const content = qs('profile-dropdown-content');
    if (!content) return;

    updateHubAccess(null);

    content.innerHTML = `
      <div class="text-center py-2">
        <span class="material-symbols-outlined text-secondary mb-2" style="font-size:40px">account_circle</span>
        <p class="text-sm text-on-surface-variant mb-4">Faça login para acessar o hub administrativo.</p>
        <button id="open-login-btn" type="button" class="w-full bg-primary text-white font-semibold rounded-lg py-2 text-sm hover:bg-primary-container transition-colors">
          Entrar
        </button>
      </div>
    `;

    qs('open-login-btn')?.addEventListener('click', () => {
      closeDropdown();
      showLoginModal();
    });
  }

  function renderUserMenu(profile) {
    const content = qs('profile-dropdown-content');
    if (!content || !profile) return;

    updateHubAccess(profile);

    const roleLabel = window.JEAuth.getRoleLabel(profile);
    const isAdmin = window.JEAuth.isAdminRole(profile.role);
    const icon = qs('profile-icon');
    if (icon) icon.textContent = 'person';

    content.innerHTML = `
      <div class="border-b border-outline-variant pb-3 mb-3">
        <p class="font-bold text-primary">${profile.full_name}</p>
        <p class="text-xs text-on-surface-variant mt-0.5">${roleLabel}</p>
        ${profile.username ? `<p class="text-xs text-outline mt-1 truncate">@${profile.username}</p>` : ''}
      </div>
      ${isAdmin ? `
        <a href="${siteUrl('hub.html')}" class="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-surface-container-low text-primary font-medium">
          <span class="material-symbols-outlined" style="font-size:20px">dashboard</span>
          Hub Administrativo
        </a>
      ` : `
        <p class="text-xs text-on-surface-variant px-2 py-2">Seu perfil não possui acesso administrativo.</p>
      `}
      <button id="logout-btn" type="button" class="mt-2 w-full flex items-center justify-center gap-2 px-2 py-2 rounded-lg hover:bg-surface-container-low text-on-surface-variant text-sm">
        <span class="material-symbols-outlined" style="font-size:18px">logout</span>
        Sair
      </button>
    `;

    qs('logout-btn')?.addEventListener('click', async () => {
      await window.JEAuth.signOut();
      closeDropdown();
      renderGuestMenu();
      const iconEl = qs('profile-icon');
      if (iconEl) iconEl.textContent = 'account_circle';
      if (isHubPage()) {
        window.location.href = siteUrl('index.html');
      }
    });
  }

  async function refreshProfileUI() {
    if (!window.JEAuth) {
      renderGuestMenu();
      return;
    }

    const cached = window.JEAuth.getCachedProfile?.();
    if (cached && window.JEAuth.hasLocalSession?.()) {
      renderUserMenu(cached);
    }

    const session = await window.JEAuth.getSession();
    if (!session?.user) {
      renderGuestMenu();
      return;
    }

    const profile = await window.JEAuth.getCurrentProfile();
    renderUserMenu(profile);
  }

  function bindEvents() {
    qs('profile-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown();
    });

    qs('mobile-menu-btn')?.addEventListener('click', () => {
      qs('mobile-menu')?.classList.toggle('hidden');
    });

    qs('login-modal-close')?.addEventListener('click', hideLoginModal);
    qs('login-modal-backdrop')?.addEventListener('click', hideLoginModal);

    qs('login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = qs('login-username')?.value?.trim();
      const password = qs('login-password')?.value;
      const errorEl = qs('login-error');

      try {
        const { profile } = await window.JEAuth.signIn(username, password);
        hideLoginModal();

        if (window.JEAuth.isAdminRole(profile?.role)) {
          window.location.href = siteUrl('hub.html');
          return;
        }

        await refreshProfileUI();
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = 'Usuário ou senha incorretos.';
          errorEl.classList.remove('hidden');
        }
      }
    });

    document.addEventListener('click', (e) => {
      const container = qs('profile-menu-container');
      if (container && !container.contains(e.target)) closeDropdown();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDropdown();
        hideLoginModal();
      }
    });
  }

  window.initSiteHeader = function initSiteHeader() {
    bindEvents();

    const hasFastAuth = window.JEAuth?.applyHeaderAuthFast?.();
    if (!hasFastAuth) renderGuestMenu();

    refreshProfileUI();

    if (window.JEAuth) {
      window.JEAuth.onAuthStateChange(() => refreshProfileUI());
    }
  };
})();
