(function () {
  const SECTIONS = window.JEHubSections || {};
  const loadedSections = new Set(['home', 'agenda']);
  let currentProfile = null;

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

  function sectionByHash(hash) {
    const key = (hash || '').replace(/^#/, '').trim().toLowerCase();
    if (!key) return SECTIONS.home;
    return Object.values(SECTIONS).find((s) => s.hash === key) || null;
  }

  const INIT_FLAGS = {
    anuncios: '__JEAdminAnunciosInit',
    discursos: '__JEAdminDiscursosInit',
    agendamentos: '__JEAdminAgendamentosInit',
    territorios: '__JEAdminTerritoriosInit',
    donativos: '__JEAdminDonativosInit',
    configuracoes: '__JEAdminConfigInit'
  };

  function resetSectionState(sectionId) {
    const section = SECTIONS[sectionId];
    if (!section) return;
    loadedSections.delete(sectionId);
    const flag = INIT_FLAGS[sectionId];
    if (flag) delete window[flag];
    if (section.initKey) delete window[section.initKey];
    section.scripts?.forEach((src) => {
      document.querySelector(`script[src="${src}"]`)?.remove();
    });
    if (!section.partial) return;
    const el = document.getElementById(section.viewId);
    if (!el) return;
    el.innerHTML = '';
    el.dataset.mounted = '0';
  }

  function unmountPartialSections(keepId) {
    Object.values(SECTIONS).forEach((s) => {
      if (!s.partial || s.id === keepId) return;
      resetSectionState(s.id);
    });
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
        } else {
          existing.addEventListener('load', () => finish(), { once: true });
          existing.addEventListener('error', () => reject(new Error(`Falha ao carregar ${src}`)), { once: true });
          return;
        }
      }

      const el = document.createElement('script');
      el.src = src;
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

    if (kicker) kicker.textContent = meta.kicker;
    if (title) title.textContent = meta.title;
    if (subtitle) subtitle.textContent = meta.subtitle;

    crumbHub?.classList.toggle('text-accent-gold', isHome);
    crumbHub?.classList.toggle('text-white/60', !isHome);
    crumbSection?.classList.toggle('hidden', isHome);
    document.getElementById('hub-hero-crumb-sep')?.classList.toggle('hidden', isHome);
    if (crumbSection && !isHome) crumbSection.textContent = meta.title;

    backBtn?.classList.toggle('hidden', !meta.showBack);
    changelogBtn?.classList.toggle('hidden', !meta.showChangelog);

    document.title = isHome
      ? 'Hub Administrativo – Jardim Elizabeth'
      : `${meta.title} – Hub | Jardim Elizabeth`;
  }

  function showViews(sectionId) {
    Object.values(SECTIONS).forEach((s) => {
      const el = document.getElementById(s.viewId);
      if (el) el.classList.toggle('hidden', s.id !== sectionId);
    });
  }

  async function ensureSectionReady(section) {
    if (!section || loadedSections.has(section.id)) return;

    if (section.styles?.length) {
      for (const href of section.styles) await loadCss(href);
    }

    if (section.partial) {
      const el = document.getElementById(section.viewId);
      if (el && el.dataset.mounted !== '1') {
        const res = await fetch(section.partial);
        if (!res.ok) throw new Error(`Partial ${section.partial}`);
        el.innerHTML = await res.text();
        el.dataset.mounted = '1';
      }
    }

    if (section.scripts?.length) {
      const scriptGlobals = {
        'js/admin-core.js?v=2026060902': 'JEAdmin',
        'js/territory-assignment-helpers.js?v=2026060624': 'JETerritoryAssignment',
        'js/admin/territory-system.js?v=2026060904': 'JEAdminTerritorios'
      };
      for (const src of section.scripts) {
        await loadScript(src, { requiredGlobal: scriptGlobals[src] || null });
      }
    }

    const mod = section.initKey ? window[section.initKey] : null;
    if (section.initKey && !mod?.init) {
      throw new Error(`Module ${section.initKey} not found`);
    }
    if (mod?.init) {
      const ready = await mod.init();
      if (ready === false) throw new Error(`Init ${section.id}`);
    }

    loadedSections.add(section.id);
  }

  async function navigateTo(sectionId, { replaceHash = true } = {}) {
    const section = SECTIONS[sectionId] || SECTIONS.home;
    const targetId = section.id;

    if (section.permission && currentProfile && !window.JEAuth.hasPermission(currentProfile, section.permission)) {
      window.JEToast?.show('Você não tem permissão para acessar esta área.', { error: true });
      if (targetId !== 'home') return navigateTo('home', { replaceHash: true });
    }

    unmountPartialSections(targetId);
    if (section.partial) resetSectionState(targetId);

    try {
      await ensureSectionReady(section);
    } catch (err) {
      console.error('Hub section load:', err);
      window.JEToast?.show('Erro ao carregar esta seção.', { error: true });
      return navigateTo('home', { replaceHash: true });
    }

    showViews(targetId);
    updateHero(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (replaceHash) {
      if (section.hash) {
        if (location.hash !== `#${section.hash}`) history.replaceState(null, '', `#${section.hash}`);
      } else if (location.hash) {
        history.replaceState(null, '', location.pathname + location.search);
      }
    }

    window.dispatchEvent(new CustomEvent('hub:section', { detail: { section: targetId } }));
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
      const section = sectionByHash(location.hash);
      navigateTo(section?.id || 'home', { replaceHash: false });
    });
  }

  async function initHub() {
    try {
      const access = await guardHubAccess();
      if (!access) return;

      currentProfile = access.profile;

      document.getElementById('hub-user-name').textContent = currentProfile.full_name;
      document.getElementById('hub-user-role').textContent = window.JEAuth.getRoleLabel(currentProfile);

      if (window.JEAuth.isSuperUser(currentProfile.role)) {
        document.getElementById('hub-user-role').classList.add('text-primary', 'font-semibold');
      }
      document.getElementById('hub-user-username').textContent = currentProfile.username ? `@${currentProfile.username}` : '';

      setupHubRouter();
      applyHubModuleVisibility(currentProfile);
      window.JEHubChangelog?.init();
      document.body.classList.remove('hub-auth-pending');

      const client = await window.JEAuth.getClient();
      await window.JEHubTerritoryAssignment?.init(client, currentProfile);
      await window.JEHubEvents?.initHubEvents(client);
      loadedSections.add('agenda');

      const fromHash = sectionByHash(location.hash);
      await navigateTo(fromHash?.id || 'home', { replaceHash: false });
    } catch (err) {
      console.warn('Hub init:', err);
      window.location.href = 'index.html';
    }
  }

  window.JEHubRouter = { navigateTo, SECTIONS };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHub);
  } else {
    initHub();
  }
})();
