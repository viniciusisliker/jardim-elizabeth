(function () {
  const BUCKET = 'profile-avatars';
  const MAX_BYTES = 2 * 1024 * 1024;

  function showMsg(el, text, ok) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden', 'perf-status--ok', 'perf-status--err');
    el.classList.add(ok ? 'perf-status--ok' : 'perf-status--err');
  }

  function hideMsg(el) {
    el?.classList.add('hidden');
  }

  function renderAvatar(profile) {
    const wrap = document.getElementById('perf-avatar');
    const removeBtn = document.getElementById('perf-avatar-remove');
    if (!wrap) return;

    if (profile?.avatar_url) {
      wrap.innerHTML = `<img src="${escapeAttr(profile.avatar_url)}" alt="Foto de ${escapeAttr(profile.full_name || 'perfil')}"/>`;
      removeBtn?.classList.remove('hidden');
    } else {
      wrap.innerHTML = '<span class="material-symbols-outlined perf-avatar__fallback" aria-hidden="true">person</span>';
      removeBtn?.classList.add('hidden');
    }
  }

  function escapeAttr(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function renderInfo(profile) {
    document.getElementById('perf-info-name').textContent = profile.full_name || '—';
    document.getElementById('perf-info-username').textContent = profile.username ? `@${profile.username}` : '—';
    window.JEAuth.applyRoleLabelEl(document.getElementById('perf-info-role'), profile);

    const desWrap = document.getElementById('perf-info-des-wrap');
    const desText = profile.designation
      || (profile.designations || []).map((d) => d.label).filter(Boolean).join(', ')
      || '';
    if (desText && desWrap) {
      desWrap.classList.remove('hidden');
      document.getElementById('perf-info-des').textContent = desText;
    } else if (desWrap) {
      desWrap.classList.add('hidden');
    }
  }

  function formatAvatarError(err) {
    const msg = String(err?.message || err || '').toLowerCase();
    if (msg.includes('bucket not found')) {
      return 'O armazenamento de fotos ainda não está configurado. Avise quem cuida do sistema.';
    }
    if (msg.includes('update_my_profile_avatar') || msg.includes('avatar_url')) {
      return 'Seu perfil ainda não está pronto para foto. Avise quem cuida do sistema.';
    }
    if (msg.includes('row-level security') || msg.includes('permission') || msg.includes('policy')) {
      return 'Sem permissão para alterar a foto. Tente sair e entrar de novo.';
    }
    if (msg.includes('payload too large') || msg.includes('entity too large')) {
      return 'A imagem é grande demais. Use até 2 MB.';
    }
    return err?.message || 'Erro ao processar a foto.';
  }

  function fileExtension(file) {
    if (file.type === 'image/png') return 'png';
    if (file.type === 'image/webp') return 'webp';
    return 'jpg';
  }

  function formatPasswordError(err) {
    const msg = String(err?.message || err || '').toLowerCase();
    if (msg.includes('at least') || msg.includes('characters') || msg.includes('caracteres')) {
      return 'A senha deve ter pelo menos 8 caracteres.';
    }
    if (msg.includes('same') || msg.includes('different') || msg.includes('igual')) {
      return 'A nova senha precisa ser diferente da senha atual.';
    }
    if (msg.includes('session') || msg.includes('login') || msg.includes('jwt')) {
      return 'Sua sessão expirou. Saia e entre de novo para alterar a senha.';
    }
    if (msg.includes('rate limit') || msg.includes('too many')) {
      return 'Muitas tentativas seguidas. Aguarde um minuto e tente novamente.';
    }
    return err?.message || 'Não foi possível alterar a senha.';
  }

  function bindPasswordForm() {
    const form = document.getElementById('perf-password-form');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';

    const statusEl = document.getElementById('perf-password-status');
    const submitBtn = document.getElementById('perf-password-submit');
    const newInput = document.getElementById('perf-password-new');
    const confirmInput = document.getElementById('perf-password-confirm');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideMsg(statusEl);

      const next = newInput?.value || '';
      const confirm = confirmInput?.value || '';

      if (next.length < 8) {
        showMsg(statusEl, 'A senha deve ter pelo menos 8 caracteres.', false);
        newInput?.focus();
        return;
      }
      if (next !== confirm) {
        showMsg(statusEl, 'As senhas não coincidem.', false);
        confirmInput?.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.classList.add('perf-btn--loading');
      showMsg(statusEl, 'Salvando nova senha…', true);

      try {
        await window.JEAuth.updatePassword(next);
        form.reset();
        showMsg(statusEl, 'Senha alterada com sucesso.', true);
        window.JEToast?.show('Senha alterada com sucesso.');
      } catch (err) {
        console.error('Password update:', err);
        const friendly = formatPasswordError(err);
        showMsg(statusEl, friendly, false);
        window.JEToast?.show(friendly, { error: true });
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('perf-btn--loading');
      }
    });
  }

  async function removeAvatarFiles(client, userId) {
    const { data: files } = await client.storage.from(BUCKET).list(userId, { limit: 20 });
    if (!files?.length) return;
    const paths = files.map((f) => `${userId}/${f.name}`);
    await client.storage.from(BUCKET).remove(paths);
  }

  async function syncProfileUi(profile) {
    renderAvatar(profile);
    renderInfo(profile);
    window.JEHubRouter?.renderUser?.(profile);
    window.dispatchEvent(new CustomEvent('je:profile-updated', { detail: { profile } }));
  }

  async function init() {
    if (window.__JEMeuPerfilInit) {
      const profile = window.JEHubRouter?.getProfile?.() || await window.JEAuth.getCurrentProfile();
      if (profile) {
        renderAvatar(profile);
        renderInfo(profile);
      }
      bindPasswordForm();
      return true;
    }

    const profile = window.JEHubRouter?.getProfile?.() || await window.JEAuth.getCurrentProfile();
    if (!profile) return false;

    window.__JEMeuPerfilInit = true;
    const client = await window.JEAuth.getClient();
    const statusEl = document.getElementById('perf-upload-status');
    const input = document.getElementById('perf-avatar-input');
    const removeBtn = document.getElementById('perf-avatar-remove');

    renderAvatar(profile);
    renderInfo(profile);
    bindPasswordForm();

    input?.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;

      hideMsg(statusEl);
      if (!file.type.startsWith('image/')) {
        showMsg(statusEl, 'Use uma imagem JPG, PNG ou WebP.', false);
        return;
      }
      if (file.size > MAX_BYTES) {
        showMsg(statusEl, 'A imagem deve ter no máximo 2 MB.', false);
        return;
      }

      const uploadBtn = input.closest('label');
      if (uploadBtn) uploadBtn.classList.add('perf-btn--loading');
      showMsg(statusEl, 'Enviando foto…', true);

      try {
        await removeAvatarFiles(client, profile.id);
        const ext = fileExtension(file);
        const path = `${profile.id}/avatar.${ext}`;
        const { error: upErr } = await client.storage.from(BUCKET).upload(path, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: '3600'
        });
        if (upErr) throw upErr;

        const { data: pub } = client.storage.from(BUCKET).getPublicUrl(path);
        const avatarUrl = `${pub.publicUrl}?v=${Date.now()}`;
        const { error: rpcErr } = await client.rpc('update_my_profile_avatar', { p_avatar_url: avatarUrl });
        if (rpcErr) throw rpcErr;

        const fresh = await window.JEAuth.refreshCurrentProfile();
        await syncProfileUi(fresh || { ...profile, avatar_url: avatarUrl });
        showMsg(statusEl, 'Foto atualizada.', true);
        window.JEToast?.show('Foto de perfil atualizada.');
      } catch (err) {
        console.error('Avatar upload:', err);
        const friendly = formatAvatarError(err);
        showMsg(statusEl, friendly, false);
        window.JEToast?.show(friendly, { error: true });
      } finally {
        uploadBtn?.classList.remove('perf-btn--loading');
      }
    });

    removeBtn?.addEventListener('click', async () => {
      if (!window.confirm('Remover sua foto de perfil?')) return;
      hideMsg(statusEl);
      removeBtn.disabled = true;
      showMsg(statusEl, 'Removendo…', true);

      try {
        await removeAvatarFiles(client, profile.id);
        const { error: rpcErr } = await client.rpc('update_my_profile_avatar', { p_avatar_url: null });
        if (rpcErr) throw rpcErr;

        const fresh = await window.JEAuth.refreshCurrentProfile();
        await syncProfileUi(fresh || { ...profile, avatar_url: null });
        showMsg(statusEl, 'Foto removida.', true);
        window.JEToast?.show('Foto removida.');
      } catch (err) {
        console.error('Avatar remove:', err);
        const friendly = formatAvatarError(err);
        showMsg(statusEl, friendly, false);
        window.JEToast?.show(friendly, { error: true });
      } finally {
        removeBtn.disabled = false;
      }
    });

    return true;
  }

  window.JEMeuPerfil = { init };
})();
