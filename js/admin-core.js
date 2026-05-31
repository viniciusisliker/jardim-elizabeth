(function () {
  const STATUS_LABELS = {
    disponivel: 'Disponível',
    designado: 'Designado',
    concluido: 'Concluído'
  };

  async function guardAdmin() {
    await window.JEAuth.getClient();
    let session = await window.JEAuth.getSession();
    if (!session) {
      await new Promise((r) => setTimeout(r, 400));
      session = await window.JEAuth.getSession();
    }
    if (!session) {
      window.location.href = '../index.html';
      return null;
    }
    const profile = await window.JEAuth.getCurrentProfile();
    if (!profile || !window.JEAuth.isAdminRole(profile.role)) {
      window.location.href = '../index.html';
      return null;
    }
    return profile;
  }

  async function getClient() {
    return window.JEAuth.getClient();
  }

  function showToast(el, message, isError) {
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden', 'text-error', 'text-green-700');
    el.classList.add(isError ? 'text-error' : 'text-green-700');
    setTimeout(() => el.classList.add('hidden'), 3500);
  }

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function adminBreadcrumb(section) {
    return `
      <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-4">
        <a href="../hub.html"><span class="material-symbols-outlined text-secondary" style="font-size:15px">dashboard</span></a>
        <a href="../hub.html" class="text-secondary">Hub</a>
        <span class="text-outline">/</span>
        <span class="text-primary">${escapeHtml(section)}</span>
      </div>`;
  }

  window.JEAdmin = {
    guardAdmin,
    getClient,
    showToast,
    escapeHtml,
    adminBreadcrumb,
    STATUS_LABELS
  };
})();
