(function () {
  function loadComponent(url, targetId, afterLoad) {
    const target = document.getElementById(targetId);
    if (!target) return;

    fetch(url)
      .then((res) => res.text())
      .then((html) => {
        target.innerHTML = html;
        if (afterLoad) afterLoad();
      })
      .catch((err) => console.warn(`Erro ao carregar ${url}:`, err));
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

  loadComponent('components/header.html', 'header', () => {
    highlightActiveNav();
    if (window.initSiteHeader) window.initSiteHeader();
  });

  loadComponent('components/footer.html', 'footer');
})();
