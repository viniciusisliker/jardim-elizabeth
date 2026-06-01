(function () {
  const SYMBOLS_HREF = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block';
  const SYMBOLS_CSS = `
    .material-symbols-outlined {
      font-family: 'Material Symbols Outlined', sans-serif;
      font-weight: normal;
      font-style: normal;
      font-size: 24px;
      line-height: 1;
      letter-spacing: normal;
      text-transform: none;
      display: inline-block;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
      font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
      -webkit-font-smoothing: antialiased;
      font-feature-settings: 'liga';
    }
  `;

  const CHROME_CSS = `
    .je-footer-info { background-color: #eae8e7; }
    .je-footer-icon {
      font-family: 'Material Symbols Outlined', sans-serif;
      font-size: 2.25rem;
      line-height: 1;
      color: #3b5e97;
      display: block;
      margin-bottom: 1rem;
      font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 48;
      font-feature-settings: 'liga';
    }
    .je-footer-title {
      font-size: 1.125rem;
      font-weight: 700;
      color: #0f3462;
      margin: 0 0 0.5rem;
    }
    .je-footer-text {
      font-size: 0.875rem;
      line-height: 1.5;
      color: #43474f;
      margin: 0;
    }
    .je-footer-link {
      color: #43474f;
      text-decoration: none;
    }
    .je-footer-link:hover { text-decoration: underline; }
    .je-footer-map-links {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    .je-footer-map-btn {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 0.625rem;
      width: 100%;
      background: #fff;
      border: 1px solid #e2e6ef;
      border-radius: 0.625rem;
      padding: 0.625rem 0.875rem;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #0f3462;
      text-decoration: none;
      transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    }
    .je-footer-map-btn svg { flex-shrink: 0; width: 1.125rem; height: 1.125rem; }
    .je-footer-map-btn:hover {
      border-color: #3b5e97;
      background: #f5f8fc;
      box-shadow: 0 2px 8px rgba(15, 52, 98, 0.08);
    }
    .je-footer-map-btn-label { flex: 1; min-width: 0; }
    @media (min-width: 640px) {
      .je-footer-map-links {
        flex-direction: row;
        flex-wrap: wrap;
        gap: 0.625rem;
      }
      .je-footer-map-btn {
        width: auto;
        flex: 1 1 calc(33.333% - 0.5rem);
        min-width: 8.5rem;
        max-width: 100%;
      }
    }
    .je-footer-bar {
      background: #eae8e7;
      width: 100%;
      border-top: 1px solid rgba(15, 52, 98, 0.1);
    }
    .je-footer-brand {
      font-size: 1.125rem;
      font-weight: 700;
      color: #0f3462;
    }
    .je-footer-copy {
      font-size: 0.875rem;
      color: rgba(15, 52, 98, 0.6);
    }

    /* Menu mobile — drawer lateral (oculto no desktop via lg:hidden no HTML) */
    body.je-menu-open { overflow: hidden; }
    .je-mobile-menu-trigger-icon--close { display: none; }
    .je-mobile-menu-trigger.is-open .je-mobile-menu-trigger-icon--open { display: none; }
    .je-mobile-menu-trigger.is-open .je-mobile-menu-trigger-icon--close { display: inline-flex; }
    .je-mobile-menu-backdrop {
      position: fixed;
      inset: 0;
      z-index: 60;
      background: rgba(10, 40, 71, 0.5);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 0.28s ease, visibility 0.28s ease;
    }
    .je-mobile-menu-backdrop.is-open {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }
    .je-mobile-menu {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 70;
      width: min(20.5rem, 92vw);
      max-width: 100%;
      display: flex;
      flex-direction: column;
      background: linear-gradient(165deg, #0f3462 0%, #1a4a7a 38%, #fbf9f8 38.1%);
      box-shadow: -12px 0 48px rgba(15, 52, 98, 0.22);
      transform: translateX(105%);
      transition: transform 0.34s cubic-bezier(0.32, 0.72, 0, 1);
      padding-top: env(safe-area-inset-top, 0);
      padding-bottom: env(safe-area-inset-bottom, 0);
    }
    .je-mobile-menu.is-open { transform: translateX(0); }
    .je-mobile-menu-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.25rem 1.25rem 1rem;
      color: #fff;
    }
    .je-mobile-menu-eyebrow {
      display: block;
      font-size: 0.625rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: rgba(200, 169, 110, 0.95);
      margin-bottom: 0.25rem;
    }
    .je-mobile-menu-title {
      display: block;
      font-size: 1.25rem;
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }
    .je-mobile-menu-close {
      flex-shrink: 0;
      width: 2.75rem;
      height: 2.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.22);
      color: #fff;
      cursor: pointer;
      transition: background 0.15s;
    }
    .je-mobile-menu-close:hover { background: rgba(255, 255, 255, 0.2); }
    .je-mobile-menu-close .material-symbols-outlined { font-size: 1.375rem; }
    .je-mobile-menu-body {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding: 0.5rem 1rem 1rem;
      background: #fbf9f8;
      border-radius: 1.25rem 0 0 0;
      margin-top: 0.25rem;
    }
    .je-mobile-menu-hub-slot:empty { display: none; }
    .je-mobile-menu-hub-slot:not(:empty) { margin-bottom: 0.75rem; }
    .je-mobile-menu-group {
      font-size: 0.625rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #3b5e97;
      margin: 1rem 0 0.5rem 0.35rem;
    }
    .je-mobile-menu-group:first-child { margin-top: 0.25rem; }
    .je-mobile-menu-nav { display: flex; flex-direction: column; gap: 0.375rem; }
    .je-mobile-nav-item {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      padding: 0.8125rem 1rem;
      border-radius: 0.875rem;
      background: #fff;
      border: 1px solid #e2e6ef;
      color: #0f3462;
      text-decoration: none;
      font-size: 0.9375rem;
      font-weight: 600;
      min-height: 3.25rem;
      transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
    }
    .je-mobile-nav-item:hover,
    .je-mobile-nav-item:focus-visible {
      border-color: #3b5e97;
      box-shadow: 0 4px 14px rgba(15, 52, 98, 0.1);
    }
    .je-mobile-nav-item--active {
      border-color: #0f3462;
      background: linear-gradient(135deg, #eff6ff 0%, #fff 100%);
      box-shadow: 0 2px 10px rgba(15, 52, 98, 0.08);
    }
    .je-mobile-nav-item--active .je-mobile-nav-icon {
      background: #0f3462;
      color: #fff;
    }
    .je-mobile-nav-item--hub {
      background: linear-gradient(135deg, #0f3462 0%, #2b4b7a 100%);
      border-color: transparent;
      color: #fff;
    }
    .je-mobile-nav-item--hub .je-mobile-nav-icon--hub {
      background: rgba(255, 255, 255, 0.15);
      color: #c8a96e;
    }
    .je-mobile-nav-item--hub .je-mobile-nav-chevron { color: rgba(255, 255, 255, 0.7); }
    .je-mobile-nav-item--hub .je-mobile-nav-hub-tag {
      display: block;
      font-size: 0.5625rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #c8a96e;
      margin-bottom: 0.125rem;
    }
    .je-mobile-nav-icon {
      flex-shrink: 0;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.625rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #eef2f8;
      color: #3b5e97;
    }
    .je-mobile-nav-icon .material-symbols-outlined { font-size: 1.25rem; }
    .je-mobile-nav-label { flex: 1; min-width: 0; line-height: 1.25; }
    .je-mobile-nav-chevron {
      flex-shrink: 0;
      font-size: 1.125rem !important;
      color: #c3c6d0;
      opacity: 0.9;
    }
    .je-mobile-menu-foot {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.875rem 1.25rem;
      background: #f5f3f3;
      border-top: 1px solid #e2e6ef;
      font-size: 0.75rem;
      color: #43474f;
    }
    .je-mobile-menu-foot-icon { font-size: 1rem !important; color: #3b5e97; }

    /* Tablet + mobile only — desktop (>=1024px) unchanged */
    @media (max-width: 1023px) {
      html, body { overflow-x: clip; }
      body {
        padding-left: env(safe-area-inset-left, 0);
        padding-right: env(safe-area-inset-right, 0);
      }
      #header nav > .max-w-7xl { padding-left: 1rem; padding-right: 1rem; }
      #mobile-menu-btn,
      #profile-btn,
      #hub-nav-btn.flex { width: 2.75rem; height: 2.75rem; min-width: 2.75rem; min-height: 2.75rem; }
      #profile-dropdown { max-width: min(18rem, calc(100vw - 2rem)); }
      .je-footer-info { padding-top: 2.5rem; padding-bottom: 2.5rem; }
      .je-footer-info > .max-w-7xl { padding-left: 1rem; padding-right: 1rem; }
      .je-footer-info .grid { gap: 2rem; }
      .je-footer-bar > .max-w-7xl { padding-left: 1rem; padding-right: 1rem; padding-top: 2rem; padding-bottom: 2rem; }
      .je-footer-map-btn { min-height: 2.75rem; }
      main[class*="max-w-"] { padding-left: 1rem !important; padding-right: 1rem !important; }
      .je-page-shell { padding-left: 1rem !important; padding-right: 1rem !important; }
    }
    @media (max-width: 767px) {
      #header nav a.flex-shrink-0 > span {
        font-size: 1rem;
        max-width: 10rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: block;
      }
      #login-modal { padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom)); align-items: flex-end; }
      #login-modal > .relative { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
      .je-footer-copy { text-align: center; line-height: 1.5; }
    }
  `;

  function ensureMaterialSymbolsLoaded() {
    if (!document.querySelector('link[rel="preconnect"][href="https://fonts.googleapis.com"]')) {
      const pre1 = document.createElement('link');
      pre1.rel = 'preconnect';
      pre1.href = 'https://fonts.googleapis.com';
      document.head.appendChild(pre1);
      const pre2 = document.createElement('link');
      pre2.rel = 'preconnect';
      pre2.href = 'https://fonts.gstatic.com';
      pre2.crossOrigin = 'anonymous';
      document.head.appendChild(pre2);
    }
    if (!document.querySelector('link[href*="Material+Symbols+Outlined"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = SYMBOLS_HREF;
      document.head.appendChild(link);
    }
    if (!document.getElementById('je-material-symbols-style')) {
      const style = document.createElement('style');
      style.id = 'je-material-symbols-style';
      style.textContent = SYMBOLS_CSS + CHROME_CSS;
      document.head.appendChild(style);
    }
  }

  function materialSymbolsReady() {
    ensureMaterialSymbolsLoaded();
    if (!document.fonts?.load) return Promise.resolve();
    return document.fonts.load("400 24px 'Material Symbols Outlined'").catch(() => {});
  }

  const isAdminPath = /\/admin(\/|$)/.test(window.location.pathname);
  const assetBase = isAdminPath ? '..' : '.';

  function ensureMaterialSymbols() {
    ensureMaterialSymbolsLoaded();
  }

  async function boot() {
    ensureMaterialSymbols();
    await materialSymbolsReady();

    loadComponent(`${assetBase}/components/header.html`, 'header', () => {
      highlightActiveNav();
      if (window.initSiteHeader) window.initSiteHeader();
    });

    loadComponent(`${assetBase}/components/footer.html`, 'footer', () => {
      if (isAdminPath) {
        const footer = document.getElementById('footer');
        if (footer) fixRelativeLinks(footer, '../');
      }
    });
  }

  function loadComponent(url, targetId, afterLoad) {
    const target = document.getElementById(targetId);
    if (!target) return;

    fetch(url)
      .then((res) => res.text())
      .then((html) => {
        target.innerHTML = html;
        if (isAdminPath) fixRelativeLinks(target, '../');
        if (window.JEAuth?.applyHeaderAuthFast) window.JEAuth.applyHeaderAuthFast();
        if (afterLoad) afterLoad();
      })
      .catch((err) => console.warn(`Erro ao carregar ${url}:`, err));
  }

  function fixRelativeLinks(container, prefix) {
    container.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('../') || href.startsWith('/')) return;
      link.setAttribute('href', prefix + href);
    });
  }

  function navSlugFromHref(href) {
    if (!href) return '';
    const file = href.split('/').pop().replace(/\.html$/i, '').toLowerCase();
    return file === 'index' ? 'home' : file;
  }

  function navSlugFromPath(pathname) {
    const segments = pathname.replace(/\/$/, '').split('/').filter(Boolean);
    const last = (segments.length ? segments[segments.length - 1] : 'index')
      .replace(/\.html$/i, '')
      .toLowerCase();
    return last === 'index' ? 'home' : last;
  }

  function highlightActiveNav() {
    const current = navSlugFromPath(window.location.pathname);
    const activeClasses = ['border-b-2', 'border-[#0f3462]', 'pb-1', 'font-semibold', 'text-[#0f3462]'];

    document.querySelectorAll('.nav-link').forEach((link) => {
      const isActive = navSlugFromHref(link.getAttribute('href')) === current;
      if (link.classList.contains('je-mobile-nav-item')) {
        link.classList.toggle('je-mobile-nav-item--active', isActive);
        if (isActive) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
        return;
      }
      if (isActive) {
        link.classList.add(...activeClasses);
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  boot();
})();
