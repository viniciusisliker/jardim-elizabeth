(function () {
  const KEY = 'je-site-theme';
  const META_SELECTOR = 'meta[name="theme-color"]';

  function getTheme() {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === 'dark' || stored === 'light') return stored;
    } catch { /* ignore */ }
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }

  function updateThemeColor(dark) {
    let meta = document.querySelector(META_SELECTOR);
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = dark ? '#12141c' : '#0f3462';
  }

  function syncCheckboxes(dark) {
    document.querySelectorAll('[data-je-theme-toggle]').forEach((input) => {
      input.checked = dark;
    });
  }

  function applyTheme(mode) {
    const dark = mode === 'dark';
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.classList.toggle('light', !dark);
    root.dataset.theme = mode;
    try {
      localStorage.setItem(KEY, mode);
    } catch { /* ignore */ }
    syncCheckboxes(dark);
    updateThemeColor(dark);
  }

  function bindToggles() {
    document.querySelectorAll('[data-je-theme-toggle]').forEach((input) => {
      if (input.dataset.jeThemeBound === '1') return;
      input.dataset.jeThemeBound = '1';
      input.addEventListener('change', () => {
        applyTheme(input.checked ? 'dark' : 'light');
      });
    });
    syncCheckboxes(getTheme() === 'dark');
  }

  function init() {
    applyTheme(getTheme());
    bindToggles();
  }

  window.JETheme = { init, applyTheme, getTheme, bindToggles };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
