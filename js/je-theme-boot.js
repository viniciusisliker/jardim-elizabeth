(function () {
  var KEY = 'je-site-theme';
  var root = document.documentElement;
  var mode = 'light';
  try {
    mode = localStorage.getItem(KEY) || 'light';
  } catch (e) { /* ignore */ }
  if (mode !== 'dark' && mode !== 'light') {
    mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  root.classList.toggle('dark', mode === 'dark');
  root.classList.toggle('light', mode !== 'dark');
  root.dataset.theme = mode;
})();
