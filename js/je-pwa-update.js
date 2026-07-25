(function () {
  let registration = null;
  let visible = false;
  let updateAvailable = false;

  function isStandalone() {
    return window.JEPwaInstall?.isStandalone?.()
      || window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
      || window.navigator.standalone === true;
  }

  function mountSlot() {
    let slot = document.getElementById('je-pwa-update-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.id = 'je-pwa-update-slot';
      const host = document.querySelector('.hub-main') || document.querySelector('main') || document.body;
      host.insertBefore(slot, host.firstChild);
    }
    return slot;
  }

  function syncUpdateButtons() {
    const show = 'serviceWorker' in navigator;
    document.querySelectorAll('[data-update-trigger]').forEach((btn) => {
      btn.hidden = !show;
      btn.classList.toggle('je-update-trigger--hidden', !show);
      btn.classList.toggle('je-site-update-btn--pending', updateAvailable);
      btn.setAttribute('aria-hidden', show ? 'false' : 'true');
    });
  }

  function bindUpdateTriggers() {
    document.querySelectorAll('[data-update-trigger]').forEach((btn) => {
      if (btn.dataset.updateBound === '1') return;
      btn.dataset.updateBound = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleUpdateClick();
      });
    });
    syncUpdateButtons();
  }

  function render() {
    const slot = mountSlot();
    if (!visible) {
      slot.innerHTML = '';
      return;
    }
    slot.innerHTML =
      '<div class="je-pwa-update" role="status" aria-live="polite">' +
      '<div class="je-pwa-update__card">' +
      '<div class="je-pwa-update__text">' +
      '<strong>Atualização disponível</strong>' +
      '<span>Recarregue para usar a versão mais nova.</span>' +
      '</div>' +
      '<div class="je-pwa-update__actions">' +
      '<button type="button" class="je-pwa-update__primary" id="je-pwa-update-apply">Atualizar agora</button>' +
      '<button type="button" class="je-pwa-update__ghost" id="je-pwa-update-later">Depois</button>' +
      '</div></div></div>';

    document.getElementById('je-pwa-update-apply')?.addEventListener('click', handleUpdateClick);
    document.getElementById('je-pwa-update-later')?.addEventListener('click', () => {
      visible = false;
      render();
    });
  }

  function showBanner() {
    updateAvailable = true;
    visible = true;
    render();
    syncUpdateButtons();
    document.getElementById('hub-pwa-apply-btn')?.classList.remove('hidden');
  }

  function applyUpdate() {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      return;
    }
    window.location.reload();
  }

  async function handleUpdateClick() {
    if (registration?.waiting) {
      applyUpdate();
      return;
    }
    if (registration) {
      try {
        await registration.update();
        if (registration.waiting) {
          applyUpdate();
          return;
        }
      } catch { /* ignore */ }
    }
    window.location.reload();
  }

  function watchRegistration(reg) {
    if (!reg) return;
    registration = reg;

    if (reg.waiting) showBanner();

    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          showBanner();
        }
      });
    });
  }

  function initHubControls() {
    const checkBtn = document.getElementById('hub-pwa-check-btn');
    const applyBtn = document.getElementById('hub-pwa-apply-btn');
    const statusEl = document.getElementById('hub-pwa-update-status');

    checkBtn?.addEventListener('click', async () => {
      if (!registration) {
        if (statusEl) statusEl.textContent = 'Service worker não disponível neste ambiente.';
        return;
      }
      checkBtn.disabled = true;
      if (statusEl) statusEl.textContent = 'Verificando…';
      try {
        await registration.update();
        if (registration.waiting) {
          showBanner();
          if (statusEl) statusEl.textContent = 'Nova versão encontrada.';
          applyBtn?.classList.remove('hidden');
        } else if (statusEl) {
          statusEl.textContent = 'Você já está na versão mais recente.';
        }
      } catch {
        if (statusEl) statusEl.textContent = 'Não foi possível verificar agora.';
      } finally {
        checkBtn.disabled = false;
      }
    });

    applyBtn?.addEventListener('click', handleUpdateClick);
  }

  function init() {
    navigator.serviceWorker?.addEventListener('controllerchange', () => {
      window.location.reload();
    });

    const existing = window.JEPwaInstall?.getRegistration?.();
    if (existing) watchRegistration(existing);

    window.addEventListener('je-pwa-registered', (e) => {
      watchRegistration(e.detail?.registration);
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(watchRegistration).catch(() => {});
    }

    initHubControls();
    bindUpdateTriggers();
    syncUpdateButtons();
  }

  window.JEPwaUpdate = { init, showBanner, applyUpdate, bindUpdateTriggers, syncUpdateButtons };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
