(function () {
  const ICONS = {
    success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 12.5l2 2 4-4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/></svg>',
    error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 11v5M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  const LABELS = {
    success: 'Tudo certo',
    error: 'Atenção',
    info: 'Aguarde'
  };

  let hideTimer = null;

  function injectStyles() {
    if (document.getElementById('je-toast-styles')) return;
    const style = document.createElement('style');
    style.id = 'je-toast-styles';
    style.textContent = `
      .je-toast-viewport {
        position: fixed;
        z-index: 10050;
        top: 1.25rem;
        right: 1.25rem;
        width: min(22rem, calc(100vw - 2.5rem));
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        pointer-events: none;
      }
      .je-toast {
        pointer-events: auto;
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.9rem 1rem;
        background: #fff;
        border-radius: 0.875rem;
        border: 1px solid rgba(31, 73, 125, 0.14);
        border-left-width: 4px;
        border-left-color: var(--je-toast-accent, #002060);
        box-shadow: 0 16px 48px rgba(0, 32, 96, 0.16), 0 4px 12px rgba(0, 0, 0, 0.06);
        font-family: Inter, system-ui, sans-serif;
        transform: translateX(110%);
        opacity: 0;
        transition: transform 0.38s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s ease;
      }
      .je-toast.je-toast--visible {
        transform: translateX(0);
        opacity: 1;
      }
      .je-toast.je-toast--leaving {
        transform: translateX(110%);
        opacity: 0;
      }
      .je-toast--success { --je-toast-accent: #1a7f4b; --je-toast-icon-bg: #e8f5ee; --je-toast-icon: #1a7f4b; }
      .je-toast--error { --je-toast-accent: #c00000; --je-toast-icon-bg: #fdecec; --je-toast-icon: #c00000; }
      .je-toast--info { --je-toast-accent: #002060; --je-toast-icon-bg: #eef3fa; --je-toast-icon: #002060; }
      .je-toast__icon {
        flex-shrink: 0;
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--je-toast-icon-bg);
        color: var(--je-toast-icon);
      }
      .je-toast__body { flex: 1; min-width: 0; padding-top: 0.1rem; }
      .je-toast__title {
        margin: 0 0 0.2rem;
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--je-toast-accent);
      }
      .je-toast__message {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 600;
        line-height: 1.4;
        color: #1b1c1c;
      }
      .je-toast__close {
        flex-shrink: 0;
        width: 1.75rem;
        height: 1.75rem;
        margin: -0.15rem -0.25rem 0 0;
        border: none;
        border-radius: 0.5rem;
        background: transparent;
        color: #6b7280;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s, color 0.15s;
      }
      .je-toast__close:hover {
        background: rgba(0, 32, 96, 0.08);
        color: #002060;
      }
      .je-toast__progress {
        position: absolute;
        left: 4px;
        right: 0;
        bottom: 0;
        height: 3px;
        border-radius: 0 0 0.875rem 0.875rem;
        overflow: hidden;
        background: rgba(0, 0, 0, 0.04);
      }
      .je-toast__progress > span {
        display: block;
        height: 100%;
        width: 100%;
        background: var(--je-toast-accent);
        transform-origin: left;
        animation: je-toast-progress var(--je-toast-duration, 4.5s) linear forwards;
      }
      @keyframes je-toast-progress {
        from { transform: scaleX(1); }
        to { transform: scaleX(0); }
      }
      @media (max-width: 640px) {
        .je-toast-viewport {
          top: auto;
          bottom: 1rem;
          left: 1rem;
          right: 1rem;
          width: auto;
        }
        .je-toast {
          transform: translateY(110%);
        }
        .je-toast.je-toast--visible { transform: translateY(0); }
        .je-toast.je-toast--leaving { transform: translateY(110%); }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureViewport() {
    injectStyles();
    let vp = document.getElementById('je-toast-viewport');
    if (!vp) {
      vp = document.createElement('div');
      vp.id = 'je-toast-viewport';
      vp.className = 'je-toast-viewport';
      vp.setAttribute('aria-live', 'polite');
      vp.setAttribute('aria-relevant', 'additions');
      document.body.appendChild(vp);
    }
    return vp;
  }

  function inferType(message, isError) {
    if (isError) return 'error';
    if (/…|\.\.\./.test(String(message || ''))) return 'info';
    return 'success';
  }

  function dismissToast(toast) {
    if (!toast || toast.classList.contains('je-toast--leaving')) return;
    toast.classList.remove('je-toast--visible');
    toast.classList.add('je-toast--leaving');
    setTimeout(() => toast.remove(), 320);
  }

  function show(message, options) {
    const opts = typeof options === 'boolean' ? { error: options } : (options || {});
    const type = opts.type || inferType(message, opts.error);
    const duration = opts.duration ?? (type === 'info' ? 6000 : 4500);
    const title = opts.title || LABELS[type] || LABELS.success;

    const viewport = ensureViewport();
    const existing = viewport.querySelector('.je-toast');
    if (existing) dismissToast(existing);

    clearTimeout(hideTimer);

    const toast = document.createElement('div');
    toast.className = `je-toast je-toast--${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.style.position = 'relative';
    toast.style.setProperty('--je-toast-duration', `${duration}ms`);
    toast.innerHTML = `
      <div class="je-toast__icon">${ICONS[type] || ICONS.success}</div>
      <div class="je-toast__body">
        <p class="je-toast__title">${title}</p>
        <p class="je-toast__message"></p>
      </div>
      <button type="button" class="je-toast__close" aria-label="Fechar notificação">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      <div class="je-toast__progress" aria-hidden="true"><span></span></div>
    `;
    toast.querySelector('.je-toast__message').textContent = String(message ?? '');

    viewport.appendChild(toast);
    toast.querySelector('.je-toast__close').addEventListener('click', () => {
      clearTimeout(hideTimer);
      dismissToast(toast);
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('je-toast--visible'));
    });

    hideTimer = setTimeout(() => dismissToast(toast), duration);
  }

  window.JEToast = { show };
})();
