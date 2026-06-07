(function () {
  function el(id) {
    return document.getElementById(id);
  }

  function show(id) {
    el(id)?.classList.remove('hidden');
  }

  function hide(id) {
    el(id)?.classList.add('hidden');
  }

  function setStatus(msg, isError) {
    const statusEl = el('reset-status');
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = `text-sm ${isError ? 'text-error' : 'text-[#43474f]'}`;
    statusEl.classList.remove('hidden');
  }

  async function waitForRecoverySession(client, timeoutMs = 8000) {
    const { data: { session } } = await client.auth.getSession();
    if (session) return session;

    return new Promise((resolve) => {
      let done = false;
      const finish = (session) => {
        if (done) return;
        done = true;
        resolve(session || null);
      };

      const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') finish(session);
      });

      setTimeout(async () => {
        const { data: { session: late } } = await client.auth.getSession();
        subscription?.unsubscribe();
        finish(late);
      }, timeoutMs);
    });
  }

  async function init() {
    const loading = el('reset-loading');
    const form = el('reset-form');
    const invalid = el('reset-invalid');

    try {
      const client = await window.JEAuth.getClient();
      if (!client) throw new Error('Supabase não configurado.');

      const session = await waitForRecoverySession(client);
      hide('reset-loading');

      if (!session) {
        show('reset-invalid');
        return;
      }

      show('reset-form');
      el('reset-password')?.focus();

      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = el('reset-password')?.value || '';
        const confirm = el('reset-password-confirm')?.value || '';
        const submitBtn = form.querySelector('button[type="submit"]');

        if (password.length < 8) {
          setStatus('A senha deve ter pelo menos 8 caracteres.', true);
          return;
        }
        if (password !== confirm) {
          setStatus('As senhas não coincidem.', true);
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Salvando…';
        }
        setStatus('Salvando nova senha…', false);

        try {
          await window.JEAuth.updatePassword(password);
          hide('reset-form');
          show('reset-done');
        } catch (err) {
          setStatus(err?.message || 'Não foi possível salvar a senha.', true);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Salvar nova senha';
          }
        }
      });
    } catch (err) {
      hide('reset-loading');
      if (invalid) {
        invalid.querySelector('p').textContent = err?.message || 'Não foi possível validar o link.';
        show('reset-invalid');
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
