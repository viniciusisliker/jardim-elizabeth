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

  function highlightActiveNav() {
    const pagina = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach((link) => {
      const href = link.getAttribute('href');
      if (href && pagina.includes(href.replace('./', ''))) {
        link.classList.add('border-b-2', 'border-[#0f3462]', 'pb-1', 'font-semibold', 'text-[#0f3462]');
      }
    });
  }

  loadComponent('components/header.html', 'header', () => {
    highlightActiveNav();
    if (window.initSiteHeader) window.initSiteHeader();
  });

  loadComponent('components/footer.html', 'footer');
})();
