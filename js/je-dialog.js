(function () {
  let active = null;

  function injectStyles() {
    if (document.getElementById('je-dialog-styles')) return;
    const style = document.createElement('style');
    style.id = 'je-dialog-styles';
    style.textContent = `
      .je-dialog-overlay {
        position: fixed;
        inset: 0;
        z-index: 10100;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
        background: rgba(10, 40, 71, 0.45);
        backdrop-filter: blur(4px);
        opacity: 0;
        transition: opacity 0.22s ease;
      }
      .je-dialog-overlay.je-dialog--visible { opacity: 1; }
      .je-dialog {
        width: min(24rem, 100%);
        background: #fff;
        border-radius: 1rem;
        border: 1px solid rgba(31, 73, 125, 0.18);
        box-shadow: 0 24px 64px rgba(0, 32, 96, 0.22), 0 8px 20px rgba(0, 0, 0, 0.08);
        font-family: Inter, system-ui, sans-serif;
        transform: translateY(12px) scale(0.98);
        transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
        overflow: hidden;
      }
      .je-dialog-overlay.je-dialog--visible .je-dialog {
        transform: translateY(0) scale(1);
      }
      .je-dialog__head {
        padding: 1.125rem 1.25rem 0.75rem;
        border-bottom: 1px solid #eef0f4;
        background: linear-gradient(180deg, #f5f8fc 0%, #fff 100%);
      }
      .je-dialog__title {
        margin: 0;
        font-size: 0.9375rem;
        font-weight: 800;
        color: #002060;
        line-height: 1.3;
      }
      .je-dialog__body {
        padding: 1rem 1.25rem 1.125rem;
      }
      .je-dialog__message {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 500;
        line-height: 1.5;
        color: #43474f;
        white-space: pre-line;
      }
      .je-dialog__input {
        width: 100%;
        margin-top: 0.875rem;
        border: 1px solid #c3c6d0;
        border-radius: 0.625rem;
        padding: 0.625rem 0.875rem;
        font-size: 0.9375rem;
        font-weight: 500;
        color: #1b1c1c;
        background: #fafafa;
      }
      .je-dialog__input:focus {
        outline: none;
        border-color: #002060;
        background: #fff;
        box-shadow: 0 0 0 3px rgba(0, 32, 96, 0.1);
      }
      .je-dialog__actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0.625rem;
        padding: 0 1.25rem 1.125rem;
      }
      .je-dialog__btn {
        min-height: 2.5rem;
        padding: 0.5rem 1rem;
        border-radius: 0.625rem;
        font-size: 0.875rem;
        font-weight: 700;
        cursor: pointer;
        border: 1px solid transparent;
        transition: background 0.15s, border-color 0.15s, opacity 0.15s;
      }
      .je-dialog__btn--cancel {
        background: #fff;
        border-color: #c3c6d0;
        color: #43474f;
      }
      .je-dialog__btn--cancel:hover {
        border-color: #1F497D;
        background: #f5f8fc;
      }
      .je-dialog__btn--confirm {
        background: #002060;
        color: #fff;
      }
      .je-dialog__btn--confirm:hover { opacity: 0.92; }
      .je-dialog__btn--danger {
        background: #c00000;
        color: #fff;
      }
      .je-dialog__btn--danger:hover { opacity: 0.92; }
      @media (max-width: 767px) {
        .je-dialog-overlay {
          align-items: flex-end;
          padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom));
        }
        .je-dialog__btn { min-height: 2.75rem; }
      }
      @media (max-width: 480px) {
        .je-dialog__actions { flex-direction: column-reverse; }
        .je-dialog__btn { width: 100%; }
      }
    `;
    document.head.appendChild(style);
  }

  function closeDialog(result) {
    if (!active) return;
    const { resolve, overlay, previousOverflow } = active;
    active = null;
    overlay.classList.remove('je-dialog--visible');
    document.body.style.overflow = previousOverflow;
    setTimeout(() => overlay.remove(), 220);
    resolve(result);
  }

  function normalizeOptions(input, defaults) {
    if (typeof input === 'string') return { ...defaults, message: input };
    return { ...defaults, ...(input || {}) };
  }

  function openDialog(options) {
    injectStyles();

    if (active) closeDialog(null);

    return new Promise((resolve) => {
      const {
        title = 'Confirmar',
        message = '',
        confirmLabel = 'Confirmar',
        cancelLabel = 'Cancelar',
        danger = false,
        type = 'confirm',
        placeholder = '',
        defaultValue = '',
        inputType = 'text'
      } = options;

      const overlay = document.createElement('div');
      overlay.className = 'je-dialog-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'je-dialog-title');

      const confirmClass = danger ? 'je-dialog__btn--danger' : 'je-dialog__btn--confirm';
      const safeInputType = inputType === 'password' ? 'password' : 'text';
      const inputHtml = type === 'prompt'
        ? `<input type="${safeInputType}" class="je-dialog__input" id="je-dialog-input" placeholder="${escapeAttr(placeholder)}" value="${escapeAttr(defaultValue)}" autocomplete="${safeInputType === 'password' ? 'new-password' : 'off'}"/>`
        : '';

      overlay.innerHTML = `
        <div class="je-dialog">
          <div class="je-dialog__head">
            <h2 class="je-dialog__title" id="je-dialog-title"></h2>
          </div>
          <div class="je-dialog__body">
            <p class="je-dialog__message"></p>
            ${inputHtml}
          </div>
          <div class="je-dialog__actions">
            <button type="button" class="je-dialog__btn je-dialog__btn--cancel" data-action="cancel"></button>
            <button type="button" class="je-dialog__btn ${confirmClass}" data-action="confirm"></button>
          </div>
        </div>
      `;

      overlay.querySelector('#je-dialog-title').textContent = title;
      overlay.querySelector('.je-dialog__message').textContent = message;
      overlay.querySelector('[data-action="cancel"]').textContent = cancelLabel;
      overlay.querySelector('[data-action="confirm"]').textContent = confirmLabel;

      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.appendChild(overlay);

      active = { resolve, overlay, previousOverflow };

      const input = overlay.querySelector('#je-dialog-input');

      function submitConfirm() {
        if (type === 'prompt') {
          const raw = input?.value ?? '';
          const value = safeInputType === 'password' ? raw : raw.trim();
          closeDialog(value || null);
          return;
        }
        closeDialog(true);
      }

      overlay.querySelector('[data-action="confirm"]').addEventListener('click', submitConfirm);
      overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => closeDialog(type === 'prompt' ? null : false));

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeDialog(type === 'prompt' ? null : false);
      });

      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeDialog(type === 'prompt' ? null : false);
        }
        if (e.key === 'Enter' && type === 'prompt' && document.activeElement === input) {
          e.preventDefault();
          submitConfirm();
        }
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => overlay.classList.add('je-dialog--visible'));
        if (input) {
          input.focus();
          input.select();
        } else {
          overlay.querySelector('[data-action="confirm"]')?.focus();
        }
      });
    });
  }

  function escapeAttr(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function confirm(options) {
    const opts = normalizeOptions(options, {
      title: 'Confirmar',
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      danger: false,
      type: 'confirm'
    });
    return openDialog(opts);
  }

  function prompt(options) {
    const opts = normalizeOptions(options, {
      title: 'Informe o valor',
      confirmLabel: 'Salvar',
      cancelLabel: 'Cancelar',
      type: 'prompt'
    });
    return openDialog(opts);
  }

  window.JEDialog = { confirm, prompt };
})();
