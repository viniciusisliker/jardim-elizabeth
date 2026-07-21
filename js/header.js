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
    showLoginPanel();
    const form = qs('login-form');
    if (form) form.reset();
    qs('login-forgot-form')?.reset();
    qs('login-forgot-status')?.classList.add('hidden');
  }

  function showLoginPanel() {
    qs('login-form')?.classList.remove('hidden');
    qs('login-forgot-panel')?.classList.add('hidden');
    const title = qs('login-modal')?.querySelector('h2');
    if (title) title.textContent = 'Entrar';
  }

  function showForgotPanel() {
    const username = qs('login-username')?.value?.trim();
    qs('login-form')?.classList.add('hidden');
    qs('login-forgot-panel')?.classList.remove('hidden');
    qs('login-error')?.classList.add('hidden');
    qs('login-forgot-status')?.classList.add('hidden');
    const forgotUser = qs('login-forgot-username');
    if (forgotUser && username) forgotUser.value = username;
    const title = qs('login-modal')?.querySelector('h2');
    if (title) title.textContent = 'Recuperar senha';
    forgotUser?.focus();
  }

  function isMobileMenuOpen() {
    return qs('mobile-menu')?.classList.contains('is-open');
  }

  function openMobileMenu() {
    const menu = qs('mobile-menu');
    const backdrop = qs('mobile-menu-backdrop');
    const btn = qs('mobile-menu-btn');
    if (!menu || !backdrop) return;

    closeDropdown();
    menu.classList.add('is-open');
    backdrop.classList.add('is-open');
    menu.removeAttribute('inert');
    menu.setAttribute('aria-hidden', 'false');
    backdrop.setAttribute('aria-hidden', 'false');
    document.body.classList.add('je-menu-open');
    if (btn) {
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Fechar menu');
      btn.classList.add('is-open');
    }
    qs('mobile-menu-close')?.focus();
  }

  function closeMobileMenu() {
    const menu = qs('mobile-menu');
    const backdrop = qs('mobile-menu-backdrop');
    const btn = qs('mobile-menu-btn');
    if (!menu || !backdrop) return;

    menu.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    menu.setAttribute('inert', '');
    menu.setAttribute('aria-hidden', 'true');
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('je-menu-open');
    if (btn) {
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Abrir menu');
      btn.classList.remove('is-open');
    }
  }

  function toggleMobileMenu() {
    if (isMobileMenuOpen()) closeMobileMenu();
    else openMobileMenu();
  }

  function setHubNavVisible(visible) {
    const hubBtn = qs('hub-nav-btn');
    if (!hubBtn) return;
    hubBtn.classList.toggle('is-auth-visible', visible);
    hubBtn.toggleAttribute('hidden', !visible);
    hubBtn.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (visible) hubBtn.removeAttribute('tabindex');
    else hubBtn.setAttribute('tabindex', '-1');
  }

  function buildMobilePromoLink({ id, href, icon, tag, label }) {
    const link = document.createElement('a');
    link.id = id;
    link.href = siteUrl(href);
    link.className = 'je-mobile-nav-item je-mobile-nav-item--promo nav-link';
    link.innerHTML = `
      <span class="je-mobile-nav-icon je-mobile-nav-icon--promo" aria-hidden="true">
        <span class="material-symbols-outlined">${icon}</span>
      </span>
      <span class="je-mobile-nav-label">
        <span class="je-mobile-nav-promo-tag">${tag}</span>
        ${label}
      </span>
      <span class="material-symbols-outlined je-mobile-nav-chevron" aria-hidden="true">arrow_forward</span>
    `;
    return link;
  }

  function updateMobilePromoLinks(profile) {
    const loggedIn = !!(profile && window.JEAuth?.hasLocalSession?.());
    const canHub = loggedIn && window.JEAuth?.canAccessHub(profile);

    setHubNavVisible(canHub);

    const slot = qs('mobile-menu-promo-slot');
    if (!slot) return;

    slot.replaceChildren();

    if (loggedIn) {
      slot.appendChild(buildMobilePromoLink({
        id: 'mobile-profile-link',
        href: 'hub.html#perfil',
        icon: 'account_circle',
        tag: 'Minha conta',
        label: 'Meu Perfil'
      }));
    }

    if (canHub) {
      slot.appendChild(buildMobilePromoLink({
        id: 'mobile-hub-link',
        href: window.JEAuth?.getHubEntryUrl?.(profile) || 'hub.html',
        icon: 'dashboard',
        tag: window.JEAuth?.isSecretario?.(profile) ? 'Secretário' : (window.JEAuth?.isSuperintendente?.(profile) ? 'Superintendente' : 'Administrativo'),
        label: window.JEAuth?.getHubEntryLabel?.(profile) || 'Hub Administrativo'
      }));
    }
  }

  function renderGuestMenu() {
    const content = qs('profile-dropdown-content');
    if (!content) return;

    updateMobilePromoLinks(null);

    content.innerHTML = `
      <div class="text-center py-2">
        <span class="material-symbols-outlined text-secondary mb-2" style="font-size:40px">account_circle</span>
        <p class="text-sm text-on-surface-variant mb-4">Entre com seu usuário e senha de responsável.</p>
        <button id="open-login-btn" type="button" class="w-full flex items-center justify-center bg-primary text-white font-semibold rounded-lg py-2 text-sm hover:bg-primary-container transition-colors">
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

    updateMobilePromoLinks(profile);

    const roleLabel = window.JEAuth.getRoleLabel(profile);
    const roleClass = window.JEAuth.getRoleLabelClasses(profile);
    const canHub = window.JEAuth.canAccessHub(profile);
    const icon = qs('profile-icon');
    if (icon) {
      if (profile.avatar_url) {
        icon.innerHTML = window.JEAuth.renderAvatarHtml(profile, { size: 24, className: 'je-profile-btn-avatar' });
      } else {
        icon.textContent = 'person';
      }
    }

    const avatarBlock = window.JEAuth.renderAvatarHtml(profile, { size: 48, className: 'je-profile-menu-avatar__img' });

    content.innerHTML = `
      <div class="border-b border-outline-variant pb-3 mb-3 flex items-start gap-3">
        <span class="je-profile-menu-avatar shrink-0">${avatarBlock}</span>
        <div class="min-w-0">
          <p class="font-bold text-primary">${profile.full_name}</p>
          <p class="${roleClass}">${roleLabel}</p>
          ${profile.username ? `<p class="text-xs text-outline mt-1 truncate">@${profile.username}</p>` : ''}
        </div>
      </div>
      <a href="${siteUrl('hub.html#perfil')}" class="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-surface-container-low text-primary font-medium">
        <span class="material-symbols-outlined" style="font-size:20px">account_circle</span>
        Meu Perfil
      </a>
      ${canHub ? `
        <a href="${siteUrl(window.JEAuth.getHubEntryUrl(profile))}" class="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-surface-container-low text-primary font-medium">
          <span class="material-symbols-outlined" style="font-size:20px">dashboard</span>
          ${window.JEAuth.getHubEntryLabel(profile)}
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

  function onProfileUpdated(e) {
    const profile = e.detail?.profile;
    if (profile) renderUserMenu(profile);
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
    if (profile) renderUserMenu(profile);
  }

  function bindEvents() {
    qs('hub-nav-btn')?.addEventListener('click', async (e) => {
      e.preventDefault();
      const btn = qs('hub-nav-btn');
      if (!btn?.classList.contains('is-auth-visible')) {
        showLoginModal();
        return;
      }
      const cached = window.JEAuth?.getCachedProfile?.();
      if (cached && window.JEAuth.canAccessHub(cached)) {
        window.location.href = siteUrl(window.JEAuth.getHubEntryUrl(cached));
        return;
      }
      const profile = await window.JEAuth?.getCurrentProfile?.();
      if (!profile || !window.JEAuth.canAccessHub(profile)) {
        setHubNavVisible(false);
        renderGuestMenu();
        showLoginModal();
        return;
      }
      window.location.href = siteUrl(window.JEAuth.getHubEntryUrl(profile));
    });

    qs('profile-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown();
    });

    qs('mobile-menu-btn')?.addEventListener('click', () => toggleMobileMenu());
    qs('mobile-menu-close')?.addEventListener('click', () => closeMobileMenu());
    qs('mobile-menu-backdrop')?.addEventListener('click', () => closeMobileMenu());
    qs('mobile-menu')?.addEventListener('click', (e) => {
      if (e.target.closest('.je-mobile-nav-item')) closeMobileMenu();
    });

    qs('login-modal-close')?.addEventListener('click', hideLoginModal);
    qs('login-modal-backdrop')?.addEventListener('click', hideLoginModal);
    qs('login-forgot-toggle')?.addEventListener('click', showForgotPanel);
    qs('login-forgot-back')?.addEventListener('click', showLoginPanel);

    qs('login-forgot-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = qs('login-forgot-username')?.value?.trim();
      const statusEl = qs('login-forgot-status');
      const submitBtn = e.target.querySelector('button[type="submit"]');

      if (statusEl) {
        statusEl.className = 'text-sm text-on-surface-variant';
        statusEl.textContent = '';
        statusEl.classList.remove('hidden');
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.jeLabel = submitBtn.textContent;
        submitBtn.textContent = 'Enviando…';
      }

      try {
        await window.JEAuth.requestPasswordReset(username);
        if (statusEl) {
          statusEl.className = 'text-sm text-primary font-medium';
          statusEl.textContent = 'Se o usuário tiver e-mail cadastrado, você receberá um link em instantes. Verifique também a pasta de spam.';
        }
      } catch (err) {
        if (statusEl) {
          statusEl.className = 'text-sm text-error';
          statusEl.textContent = err?.message || 'Não foi possível enviar o link. Tente de novo.';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtn.dataset.jeLabel || 'Enviar link';
        }
      }
    });

    qs('login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = qs('login-username')?.value?.trim();
      const password = qs('login-password')?.value;
      const errorEl = qs('login-error');
      const submitBtn = e.target.querySelector('button[type="submit"]');

      if (errorEl) {
        errorEl.classList.add('hidden');
        errorEl.textContent = '';
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.jeLabel = submitBtn.textContent;
        submitBtn.textContent = 'Entrando…';
      }

      try {
        const { profile } = await window.JEAuth.signIn(username, password);
        const resolvedProfile = profile || await window.JEAuth.getCurrentProfile();

        if (!resolvedProfile) {
          if (errorEl) {
            errorEl.textContent = 'Login realizado, mas não foi possível carregar seu perfil. Tente novamente em instantes.';
            errorEl.classList.remove('hidden');
          }
          return;
        }

        hideLoginModal();

        if (window.JEAuth.canAccessHub(resolvedProfile)) {
          window.location.replace(siteUrl(window.JEAuth.getHubEntryUrl(resolvedProfile)));
          return;
        }

        await refreshProfileUI();
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = 'Usuário ou senha incorretos.';
          errorEl.classList.remove('hidden');
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtn.dataset.jeLabel || 'Entrar';
        }
      }
    });

    document.addEventListener('click', (e) => {
      const container = qs('profile-menu-container');
      if (container && !container.contains(e.target)) closeDropdown();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isMobileMenuOpen()) closeMobileMenu();
        closeDropdown();
        hideLoginModal();
      }
    });

    const desktopNavMq = window.matchMedia('(min-width: 1024px)');
    const onDesktopNavChange = (e) => {
      if (e.matches) closeMobileMenu();
    };
    if (typeof desktopNavMq.addEventListener === 'function') {
      desktopNavMq.addEventListener('change', onDesktopNavChange);
    } else if (typeof desktopNavMq.addListener === 'function') {
      desktopNavMq.addListener(onDesktopNavChange);
    }
  }

  window.initSiteHeader = function initSiteHeader() {
    setHubNavVisible(false);
    bindEvents();

    const hasFastAuth = window.JEAuth?.applyHeaderAuthFast?.();
    if (!hasFastAuth) renderGuestMenu();

    refreshProfileUI();

    if (window.JEAuth) {
      window.JEAuth.onAuthStateChange(() => refreshProfileUI());
    }

    window.addEventListener('je:profile-updated', onProfileUpdated);

    window.JEPwaInstall?.bindTriggers?.();
  };
})();
