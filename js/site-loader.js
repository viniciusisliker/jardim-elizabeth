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
    .je-footer-map-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      flex-shrink: 0;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 0.375rem;
      padding: 0.25rem 0.375rem;
      font-size: 10px;
      font-weight: 500;
      color: #374151;
      text-decoration: none;
      white-space: nowrap;
      transition: box-shadow 0.15s;
    }
    .je-footer-map-btn:hover { box-shadow: 0 1px 3px rgba(0,0,0,.08); }
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
      if (isActive) {
        link.classList.add(...activeClasses);
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  boot();
})();
