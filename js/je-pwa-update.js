(function () {
  let registration = null;
  let visible = false;

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

    document.getElementById('je-pwa-update-apply')?.addEventListener('click', applyUpdate);
    document.getElementById('je-pwa-update-later')?.addEventListener('click', () => {
      visible = false;
      render();
    });
  }

  function showBanner() {
    visible = true;
    render();
    document.getElementById('hub-pwa-apply-btn')?.classList.remove('hidden');
  }

  function applyUpdate() {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      return;
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

    applyBtn?.addEventListener('click', applyUpdate);
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
  }

  window.JEPwaUpdate = { init, showBanner, applyUpdate };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
