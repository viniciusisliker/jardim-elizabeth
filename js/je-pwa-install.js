(function () {
  const DISMISS_KEY = 'je-pwa-install-dismissed';
  const INSTALLED_KEY = 'je-pwa-installed';
  const INTRO_KEY = 'je-pwa-install-intro-seen';
  const DISMISS_DAYS = 14;

  const BRAND = {
    name: 'Jardim Elizabeth',
    shortSub: 'Congregação · site oficial',
    shareText: 'Site oficial da Congregação Jardim Elizabeth — agenda, territórios e avisos.',
    icon: 'img/icon.png'
  };

  let deferredPrompt = null;
  let swRegistration = null;

  function asset(path) {
    const base = document.body?.dataset?.assetBase || '';
    if (!path) return path;
    if (/^https?:\/\//.test(path) || path.startsWith('/')) return path;
    return `${base}${path}`;
  }

  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.navigator.standalone === true
    );
  }

  function markInstalled() {
    try {
      localStorage.setItem(INSTALLED_KEY, '1');
    } catch { /* ignore */ }
  }

  function hasInstalledApp() {
    if (isStandalone()) return true;
    try {
      return localStorage.getItem(INSTALLED_KEY) === '1';
    } catch {
      return false;
    }
  }

  function isIos() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent);
  }

  function isMobile() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  function isBannerDismissed() {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return false;
      const elapsed = Date.now() - Number(raw);
      return Number.isFinite(elapsed) && elapsed < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }

  function dismissBanner() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch { /* ignore */ }
  }

  function getShareUrl() {
    const base = document.body?.dataset?.assetBase || '';
    const origin = window.location.origin.replace(/\/$/, '');
    if (base && base !== '.' && base !== './') {
      try {
        return new URL(base.replace(/^\.\//, ''), origin + '/').href.replace(/\/$/, '') + '/';
      } catch { /* fall through */ }
    }
    return origin + '/';
  }

  function getModalMode() {
    if (hasInstalledApp()) return 'share';
    if (deferredPrompt) return 'native';
    if (isIos()) return 'ios';
    if (isAndroid()) return 'android';
    return 'desktop';
  }

  async function shareApp() {
    const url = getShareUrl();
    const shareData = {
      title: BRAND.name,
      text: BRAND.shareText,
      url
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return 'shared';
      } catch (err) {
        if (err && err.name === 'AbortError') return 'cancelled';
      }
    }

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        return 'copied';
      } catch { /* ignore */ }
    }

    return 'failed';
  }

  function stepsHtml(mode, shareFeedback) {
    if (mode === 'share') {
      return (
        '<p class="je-install-modal__hint">O site já está na sua tela inicial ou área de trabalho. Envie o link para outros publicadores instalarem também.</p>' +
        (shareFeedback ? `<p class="je-install-modal__ok">${shareFeedback}</p>` : '')
      );
    }
    if (mode === 'ios') {
      return (
        '<ol class="je-install-modal__steps">' +
        '<li><span class="je-install-modal__num">1</span><span>Toque em <strong>Compartilhar</strong> no Safari</span></li>' +
        '<li><span class="je-install-modal__num">2</span><span>Escolha <strong>Adicionar à Tela de Início</strong></span></li>' +
        '<li><span class="je-install-modal__num">3</span><span>Confirme em <strong>Adicionar</strong></span></li>' +
        '</ol>'
      );
    }
    if (mode === 'android') {
      return (
        '<ol class="je-install-modal__steps">' +
        '<li><span class="je-install-modal__num">1</span><span>Toque nos <strong>três pontos</strong> (⋮) no Chrome</span></li>' +
        '<li><span class="je-install-modal__num">2</span><span>Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong></span></li>' +
        '<li><span class="je-install-modal__num">3</span><span>Confirme em <strong>Instalar</strong></span></li>' +
        '</ol>'
      );
    }
    if (mode === 'native') {
      return '<p class="je-install-modal__hint">Toque em instalar — o app vai para sua tela inicial em segundos.</p>';
    }
    if (mode === 'desktop') {
      return (
        '<ol class="je-install-modal__steps">' +
        '<li><span class="je-install-modal__num">1</span><span>No <strong>Chrome</strong> ou <strong>Edge</strong>, procure o ícone de instalar (⊕ ou monitor) na barra de endereço</span></li>' +
        '<li><span class="je-install-modal__num">2</span><span>Ou abra o menu (⋮) e escolha <strong>Instalar Jardim Elizabeth</strong> / <strong>Instalar aplicativo</strong></span></li>' +
        '<li><span class="je-install-modal__num">3</span><span>Confirme — o site abre como app na sua área de trabalho ou menu Iniciar</span></li>' +
        '</ol>'
      );
    }
    return '<p class="je-install-modal__hint">Use Chrome, Edge ou Safari para instalar o site.</p>';
  }

  function closeModal() {
    const overlay = document.getElementById('je-install-modal');
    if (overlay) overlay.remove();
    document.body.classList.remove('je-install-open');
    document.removeEventListener('keydown', onEscape);
  }

  function onEscape(event) {
    if (event.key === 'Escape') closeModal();
  }

  function openModal() {
    renderModal();
  }

  function renderModal(shareFeedback) {
    const existing = document.getElementById('je-install-modal');
    if (existing) existing.remove();

    const mode = getModalMode();
    const overlay = document.createElement('div');
    overlay.className = 'je-install-modal';
    overlay.id = 'je-install-modal';
    overlay.innerHTML =
      '<div class="je-install-modal__backdrop" data-install-close aria-hidden="true"></div>' +
      '<div class="je-install-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="je-install-title">' +
      '<div class="je-install-modal__head">' +
      '<div><h2 id="je-install-title" class="je-install-modal__title">' +
      (mode === 'share' ? 'Compartilhar o app' : 'Baixar o app') +
      '</h2>' +
      '<p class="je-install-modal__sub">' +
      (mode === 'share'
        ? 'Indique o site da congregação para outros publicadores.'
        : `Instale o site ${BRAND.name} — acesso rápido como app nativo.`) +
      '</p></div>' +
      '<button type="button" class="je-install-modal__close" data-install-close aria-label="Fechar">' +
      '<span class="material-symbols-outlined" aria-hidden="true">close</span></button></div>' +
      '<div class="je-install-modal__preview">' +
      `<img src="${asset(BRAND.icon)}" alt="" width="48" height="48" />` +
      `<div><p class="je-install-modal__app">${BRAND.name}</p><p class="je-install-modal__meta">${BRAND.shortSub}</p></div></div>` +
      stepsHtml(mode, shareFeedback) +
      '<div class="je-install-modal__actions">' +
      (mode === 'native'
        ? '<button type="button" class="je-install-modal__primary" id="je-install-confirm">Instalar app</button>'
        : mode === 'share'
          ? '<button type="button" class="je-install-modal__primary" id="je-install-share">Compartilhar</button>'
          : mode === 'ios' || mode === 'android' || mode === 'desktop'
            ? '<button type="button" class="je-install-modal__primary" data-install-close>Entendi</button>'
            : '') +
      (mode !== 'share'
        ? '<button type="button" class="je-install-modal__ghost" data-install-close>Agora não</button>'
        : '<button type="button" class="je-install-modal__ghost" data-install-close>Fechar</button>') +
      '</div></div>';

    document.body.appendChild(overlay);
    document.body.classList.add('je-install-open');

    overlay.querySelectorAll('[data-install-close]').forEach((el) => {
      el.addEventListener('click', closeModal);
    });

    const confirm = document.getElementById('je-install-confirm');
    if (confirm) {
      confirm.addEventListener('click', () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choice) => {
          if (choice.outcome === 'accepted') {
            deferredPrompt = null;
            markInstalled();
          }
          closeModal();
          updateInstallButtons();
        });
      });
    }

    const shareBtn = document.getElementById('je-install-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        shareBtn.disabled = true;
        shareBtn.textContent = 'Compartilhando…';
        shareApp().then((outcome) => {
          if (outcome === 'shared') {
            closeModal();
            return;
          }
          shareBtn.disabled = false;
          shareBtn.textContent = 'Compartilhar';
          if (outcome === 'copied') {
            renderModal('Link copiado para a área de transferência.');
            return;
          }
          if (outcome === 'cancelled') return;
          renderModal('Não foi possível compartilhar. Copie o link manualmente.');
        });
      });
    }

    document.addEventListener('keydown', onEscape);
  }

  function injectBanner(slotSelector) {
    if (hasInstalledApp() || !isMobile() || isBannerDismissed()) return;
    const slot = typeof slotSelector === 'string' ? document.querySelector(slotSelector) : slotSelector;
    const host = slot || document.querySelector('main');
    if (!host || host.querySelector('.je-install-banner')) return;

    const banner = document.createElement('div');
    banner.className = 'je-install-banner';
    banner.innerHTML =
      '<div class="je-install-banner__copy">' +
      `<img src="${asset(BRAND.icon)}" alt="" width="36" height="36" />` +
      '<div><p class="je-install-banner__title">Baixar o app</p>' +
      `<p class="je-install-banner__sub">${BRAND.name} na sua tela inicial</p></div></div>` +
      '<div class="je-install-banner__actions">' +
      '<button type="button" class="je-install-banner__btn">Baixar</button>' +
      '<button type="button" class="je-install-banner__dismiss" aria-label="Dispensar">×</button></div>';

    host.insertBefore(banner, host.firstChild);
    banner.querySelector('.je-install-banner__btn')?.addEventListener('click', openModal);
    banner.querySelector('.je-install-banner__dismiss')?.addEventListener('click', () => {
      dismissBanner();
      banner.remove();
    });
  }

  function injectIntroHint() {
    if (hasInstalledApp()) return;
    try {
      if (localStorage.getItem(INTRO_KEY) === '1') return;
    } catch { return; }

    if (!document.querySelector('[data-install-trigger]')) return;

    const toast = document.createElement('div');
    toast.className = 'je-install-intro';
    toast.innerHTML =
      '<p class="je-install-intro__text">Instale o site como app — toque em <strong>Baixar app</strong> no menu.</p>' +
      '<button type="button" class="je-install-intro__action" data-install-trigger>Ver como</button>' +
      '<button type="button" class="je-install-intro__close" aria-label="Fechar">×</button>';

    document.body.appendChild(toast);

    const dismiss = () => {
      toast.remove();
      try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* ignore */ }
    };

    toast.querySelector('.je-install-intro__close')?.addEventListener('click', dismiss);
    toast.querySelector('.je-install-intro__action')?.addEventListener('click', () => {
      dismiss();
      openModal();
    });

    window.setTimeout(dismiss, 12000);
  }

  function updateInstallButtons() {
    const installed = hasInstalledApp();
    const label = installed ? 'Compartilhar app' : 'Baixar app';

    document.querySelectorAll('[data-install-trigger]').forEach((btn) => {
      btn.hidden = false;
      btn.classList.remove('je-install-trigger--hidden');
      btn.setAttribute('aria-hidden', 'false');
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);

      btn.querySelectorAll('.je-install-trigger-icon').forEach((icon) => {
        icon.textContent = installed ? 'share' : 'install_mobile';
      });

      btn.querySelectorAll('.je-install-trigger-label').forEach((el) => {
        el.textContent = label;
      });
    });
  }

  function bindTriggers() {
    document.querySelectorAll('[data-install-trigger]').forEach((btn) => {
      if (btn.dataset.installBound === '1') return;
      btn.dataset.installBound = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    });
    updateInstallButtons();
  }

  function registerSw() {
    if (!('serviceWorker' in navigator)) return;

    let swUrl = '/sw.js';
    const manifest = document.querySelector('link[rel="manifest"]');
    if (manifest?.href) {
      try {
        swUrl = new URL('sw.js', manifest.href).href;
      } catch { /* keep default */ }
    }

    void navigator.serviceWorker.register(swUrl).then((reg) => {
      swRegistration = reg;
      window.dispatchEvent(new CustomEvent('je-pwa-registered', { detail: { registration: reg } }));
    }).catch(() => {});
  }

  function init(options = {}) {
    registerSw();
    injectBanner(options.bannerSlot || null);
    bindTriggers();
    window.setTimeout(injectIntroHint, 800);

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredPrompt = event;
      updateInstallButtons();
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      markInstalled();
      document.querySelector('.je-install-banner')?.remove();
      updateInstallButtons();
    });
  }

  window.JEPwaInstall = {
    init,
    open: openModal,
    share: shareApp,
    isStandalone,
    hasInstalledApp,
    bindTriggers,
    updateInstallButtons,
    getRegistration: () => swRegistration
  };

  if (document.body && !document.body.classList.contains('hub-page')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => init());
    } else {
      init();
    }
  }
})();
