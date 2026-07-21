(function () {
  const SECTIONS = window.JEHubSections || {};
  const loadedSections = new Set(['home']);
  const mountedSections = new Set(['home']);
  const initInFlight = new Set();
  const partialCache = new Map();
  let currentProfile = null;
  let hubClient = null;
  let agendaDataReady = false;
  let homeExtrasReady = false;

  const HUB_RECENT_KEY = 'je-hub-recent-sections';
  const HUB_RECENT_MAX = 4;

  function releaseAuthPending() {
    document.body.classList.remove('hub-auth-pending');
  }

  function showBootError(message) {
    releaseAuthPending();
    let el = document.getElementById('hub-boot-error');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hub-boot-error';
      el.className = 'hub-boot-error';
      const host = document.querySelector('.hub-main') || document.querySelector('main');
      if (host) host.prepend(el);
    }
    el.innerHTML =
      `<p class="hub-boot-error__text">${String(message || 'Erro ao carregar o Hub.').replace(/</g, '&lt;')}</p>` +
      '<div class="hub-boot-error__actions">' +
      '<button type="button" class="hub-boot-error__btn" id="hub-boot-retry">Tentar novamente</button>' +
      '<a class="hub-boot-error__link" href="index.html">Ir para o site</a>' +
      '</div>';
    el.hidden = false;
    document.getElementById('hub-boot-retry')?.addEventListener('click', () => window.location.reload(), { once: true });
  }

  function safeHubInit(fn) {
    try {
      fn?.();
    } catch (err) {
      console.warn('Hub init partial:', err);
    }
  }

  function recordRecentSection(sectionId) {
    if (!sectionId || sectionId === 'home') return;
    try {
      const raw = localStorage.getItem(HUB_RECENT_KEY);
      let list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      list = list.filter((id) => id !== sectionId);
      list.unshift(sectionId);
      localStorage.setItem(HUB_RECENT_KEY, JSON.stringify(list.slice(0, HUB_RECENT_MAX)));
    } catch { /* ignore */ }
  }

  function renderRecentModules() {
    const root = document.getElementById('hub-recent-modules');
    if (!root) return;
    const listEl = root.querySelector('.hub-recent-modules__list');
    if (!listEl) return;

    let list = [];
    try {
      list = JSON.parse(localStorage.getItem(HUB_RECENT_KEY) || '[]');
    } catch { list = []; }
    if (!Array.isArray(list)) list = [];

    const chips = list
      .map((id) => SECTIONS[id])
      .filter(Boolean)
      .map((section) => {
        const title = section.hero?.title || section.id;
        return `<button type="button" class="hub-recent-chip" data-hub-tab="${section.id}">${title}</button>`;
      });

    if (!chips.length) {
      root.classList.add('hidden');
      listEl.innerHTML = '';
      return;
    }

    root.classList.remove('hidden');
    listEl.innerHTML = chips.join('');
  }

  function isSuperintendenteProfile(profile) {
    return window.JEAuth?.isSuperintendente?.(profile) ?? profile?.role === 'superintendente';
  }

  function isSecretarioProfile(profile) {
    return window.JEAuth?.isSecretario?.(profile) ?? profile?.role === 'secretario';
  }

  function resolveBootSection(profile) {
    const fromHash = sectionByHash(location.hash);
    if (isSuperintendenteProfile(profile)) {
      return fromHash?.id === 'perfil' ? 'perfil' : 'home';
    }
    if (isSecretarioProfile(profile)) {
      if (fromHash?.id === 'perfil') return 'perfil';
      if (fromHash?.id === 'secretario') return 'secretario';
      return 'secretario';
    }
    return fromHash?.id || 'home';
  }

  async function navigateToBoot(profile) {
    const sectionId = resolveBootSection(profile);
    const replaceHash = (isSuperintendenteProfile(profile) && sectionId === 'home')
      || (isSecretarioProfile(profile) && sectionId === 'secretario');
    await navigateTo(sectionId, { replaceHash });
  }

  function applySuperintendenteHome(profile) {
    const isSuper = isSuperintendenteProfile(profile);
    const overview = document.getElementById('hub-super-overview');
    const modulesPanel = document.querySelector('.hub-modules-panel');
    const intro = document.querySelector('.hub-home-intro p');

    overview?.classList.toggle('hidden', !isSuper);
    modulesPanel?.classList.toggle('hidden', isSuper);

    if (intro) {
      intro.textContent = isSuper
        ? 'Panorama da congregação — leitura apenas.'
        : 'Selecione um módulo abaixo.';
    }

    if (isSuper) {
      Promise.resolve(window.JEHubSuperOverview?.init?.(profile)).catch((err) => {
        console.warn('Super overview:', err);
      });
    }
  }

  function initHubHomeTools() {
    renderRecentModules();

    const search = document.getElementById('hub-module-search');
    if (!search || search.dataset.bound === '1') return;
    search.dataset.bound = '1';

    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      document.querySelectorAll('.hub-module-card').forEach((card) => {
        const text = (card.textContent || '').toLowerCase();
        card.classList.toggle('is-filtered-out', !!q && !text.includes(q));
      });
      document.querySelectorAll('.hub-module-group').forEach((group) => {
        const visible = group.querySelectorAll('.hub-module-card:not(.is-filtered-out)').length;
        group.classList.toggle('is-filtered-out', !!q && visible === 0);
      });
    });
  }

  const SCRIPT_GLOBALS = {
    'js/admin-core.js?v=2026060902': 'JEAdmin',
    'js/territory-assignment-helpers.js?v=2026061724': 'JETerritoryAssignment',
    'js/admin/territory-system.js?v=2026061522': 'JEAdminTerritorios',
    'js/equipment-schedule-helpers.js?v=2026061312': 'JEEquipmentSchedule',
    'js/admin/carrinhos-displays.js?v=2026061312': 'JEAdminCarrinhosDisplays'
  };

  function scriptGlobalFor(src) {
    if (SCRIPT_GLOBALS[src]) return SCRIPT_GLOBALS[src];
    const base = src.replace(/\?v=.*$/, '');
    const match = Object.entries(SCRIPT_GLOBALS).find(([k]) => k.replace(/\?v=.*$/, '') === base);
    return match?.[1] || null;
  }

  function renderHubUser(profile) {
    const nameEl = document.getElementById('hub-user-name');
    const roleEl = document.getElementById('hub-user-role');
    const userEl = document.getElementById('hub-user-username');
    const avatarEl = document.getElementById('hub-user-avatar');
    if (nameEl) nameEl.textContent = profile.full_name;
    if (roleEl) window.JEAuth.applyRoleLabelEl(roleEl, profile, { onDark: true });
    if (userEl) userEl.textContent = profile.username ? `@${profile.username}` : '';
    if (avatarEl) avatarEl.innerHTML = window.JEAuth.renderAvatarHtml(profile, { size: 44, className: 'hub-user-avatar__img' });
  }

  function hubAllowsProfileOnly() {
    return sectionByHash(location.hash)?.id === 'perfil';
  }

  async function getHubClient() {
    if (!hubClient) hubClient = await window.JEAuth.getClient();
    return hubClient;
  }

  async function guardHubAccess({ redirect = true } = {}) {
    if (!window.JEAuth?.hasLocalSession?.()) {
      if (redirect) window.location.replace('index.html');
      return null;
    }

    await window.JEAuth.getClient();
    let session = await window.JEAuth.getSession();
    if (!session) {
      await new Promise((r) => setTimeout(r, 400));
      session = await window.JEAuth.getSession();
    }
    if (!session) {
      if (redirect) window.location.href = 'index.html';
      return null;
    }

    const profile = await window.JEAuth.getCurrentProfile();
    if (!profile) {
      if (redirect) window.location.href = 'index.html';
      return null;
    }

    if (!window.JEAuth.canAccessHub(profile) && !hubAllowsProfileOnly()) {
      if (redirect) window.location.href = 'index.html';
      return null;
    }

    return { session, profile };
  }

  function applyHubModuleVisibility(profile) {
    document.querySelectorAll('[data-hub-requires-permission]').forEach((el) => {
      const perm = el.dataset.hubRequiresPermission;
      let allowed = window.JEAuth.hasPermission(profile, perm);
      if (!allowed && perm === 'settings' && window.JEHubNotifications?.canSend?.(profile)) {
        allowed = true;
      }
      el.classList.toggle('hidden', !allowed);
    });

    document.querySelectorAll('.hub-module-group').forEach((group) => {
      const visibleCards = group.querySelectorAll('.hub-module-card:not(.hidden)');
      group.classList.toggle('hidden', visibleCards.length === 0);
    });

    applySuperintendenteHome(profile);
    applySecretarioHome(profile);
  }

  function applySecretarioHome(profile) {
    const isSec = isSecretarioProfile(profile);
    const modulesPanel = document.querySelector('.hub-modules-panel');
    const intro = document.querySelector('.hub-home-intro p');
    if (!isSec) return;
    modulesPanel?.classList.add('hidden');
    if (intro) intro.textContent = 'Área do Secretário — Visita do Superintendente.';
  }

  function sectionByHash(hash) {
    const key = (hash || '').replace(/^#/, '').trim().toLowerCase();
    if (!key) return SECTIONS.home;
    return Object.values(SECTIONS).find((s) => s.hash === key) || null;
  }

  async function loadSectionScripts(scripts) {
    if (!scripts?.length) return;
    for (let i = 0; i < scripts.length; i += 1) {
      const src = scripts[i];
      const isTerminal = i === scripts.length - 1;
      await loadScript(src, { requiredGlobal: isTerminal ? scriptGlobalFor(src) : null });
    }
  }

  function prefetchSection(sectionId) {
    const section = SECTIONS[sectionId];
    if (!section || mountedSections.has(sectionId)) return;
    section.styles?.forEach((href) => {
      loadCss(href).catch(() => {});
    });
    if (section.partial && !partialCache.has(section.partial)) {
      fetch(section.partial)
        .then((res) => (res.ok ? res.text() : null))
        .then((html) => { if (html) partialCache.set(section.partial, html); })
        .catch(() => {});
    }
    // Scripts are loaded on navigation — prefetching them competes with the active section.
  }

  function prefetchAllowedSections(profile) {
    if (!profile) return;
    Object.values(SECTIONS).forEach((section) => {
      if (section.id === 'home') return;
      if (section.permission && !window.JEAuth.hasPermission(profile, section.permission)) return;
      prefetchSection(section.id);
    });
  }

  async function ensureAgendaDataReady() {
    if (agendaDataReady) return;
    await window.JEHubEvents?.initHubEvents(await getHubClient());
    agendaDataReady = true;
    loadedSections.add('agenda');
  }

  async function ensureHomeExtras() {
    if (homeExtrasReady || !currentProfile) return;
    await window.JEHubTerritoryAssignment?.init(await getHubClient(), currentProfile);
    homeExtrasReady = true;
  }

  function loadScript(src, { requiredGlobal = null } = {}) {
    return new Promise((resolve, reject) => {
      const finish = () => {
        if (requiredGlobal && !window[requiredGlobal]) {
          reject(new Error(`Global ${requiredGlobal} ausente após ${src}`));
          return;
        }
        resolve();
      };

      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loadError === '1') {
          existing.remove();
        } else if (existing.dataset.loaded === '1') {
          finish();
          return;
        } else if (existing.dataset.hubDynamic !== '1') {
          existing.dataset.loaded = '1';
          finish();
          return;
        } else if (requiredGlobal && window[requiredGlobal]) {
          existing.dataset.loaded = '1';
          finish();
          return;
        } else {
          existing.addEventListener('load', () => finish(), { once: true });
          existing.addEventListener('error', () => reject(new Error(`Falha ao carregar ${src}`)), { once: true });
          return;
        }
      }

      const el = document.createElement('script');
      el.src = src;
      el.dataset.hubDynamic = '1';
      el.dataset.loaded = '0';
      el.onload = () => {
        el.dataset.loaded = '1';
        finish();
      };
      el.onerror = () => {
        el.dataset.loadError = '1';
        reject(new Error(`Falha ao carregar ${src}`));
      };
      document.body.appendChild(el);
    });
  }

  function loadCss(href) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`link[href="${href}"]`)) {
        resolve();
        return;
      }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Falha ao carregar ${href}`));
      document.head.appendChild(link);
    });
  }

  function updateHero(section) {
    const meta = section?.hero || SECTIONS.home.hero;
    const kicker = document.getElementById('hub-hero-kicker');
    const title = document.getElementById('hub-hero-title');
    const subtitle = document.getElementById('hub-hero-subtitle');
    const crumbHub = document.getElementById('hub-hero-crumb-hub');
    const crumbSection = document.getElementById('hub-hero-crumb-section');
    const backBtn = document.getElementById('hub-hero-back');
    const changelogBtn = document.getElementById('hub-changelog-btn');
    const isHome = !section || section.id === 'home';
    const isSuperHome = isHome && isSuperintendenteProfile(currentProfile);

    if (kicker) kicker.textContent = isSuperHome ? 'Superintendente' : meta.kicker;
    if (title) title.textContent = isSuperHome ? 'Visão Geral' : meta.title;
    if (subtitle) {
      subtitle.textContent = isSuperHome
        ? 'Panorama da congregação — territórios, agenda, discursos e campo.'
        : meta.subtitle;
    }

    crumbHub?.classList.toggle('text-accent-gold', isHome);
    crumbHub?.classList.toggle('text-white/60', !isHome);
    crumbSection?.classList.toggle('hidden', isHome);
    document.getElementById('hub-hero-crumb-sep')?.classList.toggle('hidden', isHome);
    if (crumbSection && !isHome) crumbSection.textContent = meta.title;

    backBtn?.classList.toggle('hidden', !meta.showBack);
    changelogBtn?.classList.toggle('hidden', !meta.showChangelog);

    document.title = isHome
      ? (isSuperHome ? 'Visão Geral – Hub | Jardim Elizabeth' : 'Hub Administrativo – Jardim Elizabeth')
      : `${meta.title} – Hub | Jardim Elizabeth`;
  }

  function showViews(sectionId) {
    Object.values(SECTIONS).forEach((s) => {
      const el = document.getElementById(s.viewId);
      if (el) el.classList.toggle('hidden', s.id !== sectionId);
    });
  }

  async function mountSectionShell(section) {
    if (!section) return;
    if (section.id === 'agenda') await ensureAgendaDataReady();
    if (mountedSections.has(section.id)) return;

    const loads = [];
    if (section.styles?.length) {
      loads.push(Promise.all(section.styles.map((href) => loadCss(href))));
    }
    if (section.partial) {
      loads.push((async () => {
        const el = document.getElementById(section.viewId);
        if (!el || el.dataset.mounted === '1') return;
        let html = partialCache.get(section.partial);
        if (!html) {
          const res = await fetch(section.partial);
          if (!res.ok) throw new Error(`Partial ${section.partial}`);
          html = await res.text();
          partialCache.set(section.partial, html);
        }
        el.innerHTML = html;
        el.dataset.mounted = '1';
      })());
    }
    if (loads.length) await Promise.all(loads);

    if (section.scripts?.length) {
      await loadSectionScripts(section.scripts);
    }

    mountedSections.add(section.id);
  }

  async function initSectionModule(section) {
    if (!section || loadedSections.has(section.id) || initInFlight.has(section.id)) return;
    initInFlight.add(section.id);

    try {
      const mod = section.initKey ? window[section.initKey] : null;
      if (section.initKey && !mod?.init) {
        throw new Error(`Module ${section.initKey} not found`);
      }
      if (mod?.init) {
        const ready = await mod.init();
        if (ready === false) throw new Error(`Init ${section.id}`);
      }

      loadedSections.add(section.id);
    } finally {
      initInFlight.delete(section.id);
    }
  }

  async function ensureSectionReady(section) {
    await mountSectionShell(section);
    await initSectionModule(section);
  }

  async function navigateTo(sectionId, { replaceHash = true } = {}) {
    const section = SECTIONS[sectionId] || SECTIONS.home;
    const targetId = section.id;

    if (section.permission && currentProfile) {
      let allowed = window.JEAuth.hasPermission(currentProfile, section.permission);
      if (!allowed && section.id === 'configuracoes' && window.JEHubNotifications?.canSend?.(currentProfile)) {
        allowed = true;
      }
      if (!allowed) {
        window.JEToast?.show('Você não tem permissão para acessar esta área.', { error: true });
        if (targetId !== 'home') return navigateTo('home', { replaceHash: true });
      }
    }

    try {
      await mountSectionShell(section);
    } catch (err) {
      console.error('Hub section load:', err);
      window.JEToast?.show('Erro ao carregar esta seção.', { error: true });
      return navigateTo('home', { replaceHash: true });
    }

    showViews(targetId);
    updateHero(section);
    if (targetId !== 'home') recordRecentSection(targetId);
    if (targetId === 'home') {
      initHubHomeTools();
      if (isSuperintendenteProfile(currentProfile)) {
        window.JEHubSuperOverview?.refresh?.();
      }
      ensureHomeExtras().catch((err) => console.warn('Hub home extras:', err));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (replaceHash) {
      if (section.hash) {
        if (location.hash !== `#${section.hash}`) history.replaceState(null, '', `#${section.hash}`);
      } else if (location.hash) {
        history.replaceState(null, '', location.pathname + location.search);
      }
    }

    window.dispatchEvent(new CustomEvent('hub:section', { detail: { section: targetId } }));
    if (targetId === 'configuracoes' && currentProfile && hubClient) {
      window.JEHubNotificationsUi?.initSendForm?.(hubClient, currentProfile);
      window.JEPwaInstall?.bindTriggers?.();
    }
    if (targetId === 'perfil') {
      window.JEPwaInstall?.bindTriggers?.();
    }

    if (!loadedSections.has(targetId)) {
      initSectionModule(section).catch((err) => {
        console.error('Hub section init:', err);
        const detail = err?.message ? ` ${err.message}` : '';
        window.JEToast?.show(`Erro ao carregar dados desta seção.${detail}`, { error: true });
      });
    }
  }

  function setupHubRouter() {
    document.querySelectorAll('[data-hub-tab]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(el.dataset.hubTab || 'home');
      });
    });

    document.getElementById('hub-hero-back')?.addEventListener('click', () => navigateTo('home'));

    window.addEventListener('hashchange', () => {
      if (isSuperintendenteProfile(currentProfile)) {
        navigateTo(resolveBootSection(currentProfile), { replaceHash: true });
        return;
      }
      if (isSecretarioProfile(currentProfile)) {
        navigateTo(resolveBootSection(currentProfile), { replaceHash: true });
        return;
      }
      const section = sectionByHash(location.hash);
      navigateTo(section?.id || 'home', { replaceHash: false });
    });
  }

  async function finishHubBoot(access) {
    currentProfile = access.profile;
    releaseAuthPending();
    renderHubUser(currentProfile);
    setupHubRouter();
    applyHubModuleVisibility(currentProfile);
    safeHubInit(() => window.JEHubChangelog?.init());
    initHubHomeTools();

    hubClient = await window.JEAuth.getClient();
    safeHubInit(() => window.JEPwaInstall?.init?.({ bannerSlot: '#hub-install-banner-slot' }));
    safeHubInit(() => window.JEPwaInstall?.bindTriggers?.());
    safeHubInit(() => window.JEHubNotificationsUi?.initBell?.(hubClient, currentProfile.id));
    safeHubInit(() => window.JEHubNotificationsUi?.initSendForm?.(hubClient, currentProfile));

    await navigateToBoot(currentProfile);
    prefetchAllowedSections(currentProfile);
  }

  async function bootHubServices(profile) {
    hubClient = await window.JEAuth.getClient();
    safeHubInit(() => window.JEPwaInstall?.init?.({ bannerSlot: '#hub-install-banner-slot' }));
    safeHubInit(() => window.JEPwaInstall?.bindTriggers?.());
    safeHubInit(() => window.JEHubNotificationsUi?.initBell?.(hubClient, profile.id));
    safeHubInit(() => window.JEHubNotificationsUi?.initSendForm?.(hubClient, profile));
    prefetchAllowedSections(profile);
  }

  async function initHub() {
    const bootError = document.getElementById('hub-boot-error');
    if (bootError) bootError.hidden = true;

    try {
      if (!window.JEAuth?.hasLocalSession?.()) {
        window.location.replace('index.html');
        return;
      }

      releaseAuthPending();

      const cached = window.JEAuth.getCachedProfile?.();
      if (cached && (window.JEAuth.canAccessHub(cached) || hubAllowsProfileOnly())) {
        currentProfile = cached;
        renderHubUser(cached);
        setupHubRouter();
        applyHubModuleVisibility(cached);
        initHubHomeTools();
        safeHubInit(() => window.JEHubChangelog?.init());

        await navigateToBoot(cached);

        guardHubAccess({ redirect: false })
          .then(async (access) => {
            if (!access) {
              showBootError('Sessão expirada ou sem permissão. Faça login novamente.');
              window.setTimeout(() => { window.location.href = 'index.html'; }, 3500);
              return;
            }
            currentProfile = access.profile;
            renderHubUser(currentProfile);
            applyHubModuleVisibility(currentProfile);
            await bootHubServices(access.profile);
            safeHubInit(() => window.JEHubNotificationsUi?.initSendForm?.(hubClient, currentProfile));
          })
          .catch((err) => {
            console.warn('Hub auth refresh:', err);
            showBootError('Não foi possível validar seu acesso. Verifique a conexão.');
          });
        return;
      }

      let access;
      try {
        access = await Promise.race([
          guardHubAccess({ redirect: false }),
          new Promise((_, reject) => {
            window.setTimeout(() => reject(new Error('auth_timeout')), 15000);
          })
        ]);
      } catch (err) {
        showBootError(
          err?.message === 'auth_timeout'
            ? 'Demorou para conectar. Verifique a internet e tente novamente.'
            : 'Erro ao validar acesso.'
        );
        return;
      }

      if (!access) {
        window.location.href = 'index.html';
        return;
      }

      await finishHubBoot(access);
    } catch (err) {
      console.warn('Hub init:', err);
      releaseAuthPending();
      showBootError('Erro ao iniciar o Hub. Recarregue a página.');
    }
  }

  window.JEHubRouter = { navigateTo, SECTIONS, getProfile: () => currentProfile, renderUser: renderHubUser };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHub);
  } else {
    initHub();
  }
})();
