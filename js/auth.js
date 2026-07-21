(function () {
  const ROLE_LABELS = {
    superuser: 'SuperUser',
    anciao: 'Ancião',
    servo_ministerial: 'Servo Ministerial',
    superintendente: 'Superintendente',
    secretario: 'Secretário',
    publicador: 'Publicador'
  };

  const SUB_ROLE_LABELS = {
    secretario: 'Secretário',
    coordenador: 'Coordenador',
    superintendente_servico: 'Superintendente de Serviço'
  };

  const SUB_ROLES = Object.entries(SUB_ROLE_LABELS).map(([value, label]) => ({ value, label }));

  const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  const SESSION_TIMEOUT_MS = 4000;
  const PROFILE_CACHE_KEY = 'je_profile_cache';

  let supabaseClient = null;
  let supabaseLoadPromise = null;
  let currentProfile = null;

  function getStorageKey() {
    const ref = window.JE_CONFIG?.supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
    return ref ? `sb-${ref}-auth-token` : null;
  }

  function readCachedProfile() {
    try {
      const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  const PROFILE_SELECT_BASE = 'id, full_name, role, sub_role, designation, username, can_announcements, avatar_url';
  const PROFILE_DESIGNATIONS = `profile_access_designations (
      access_designations ( id, slug, label, permissions, is_active )
    )`;
  const PROFILE_SELECT = `${PROFILE_SELECT_BASE}, display_role, ${PROFILE_DESIGNATIONS}`;
  const PROFILE_SELECT_FALLBACK = `${PROFILE_SELECT_BASE}, ${PROFILE_DESIGNATIONS}`;

  function enrichProfile(data) {
    if (!data) return null;
    const designations = [];
    const permissionSet = new Set();
    (data.profile_access_designations || []).forEach((row) => {
      const d = row?.access_designations;
      if (!d || d.is_active === false) return;
      designations.push({
        id: d.id,
        slug: d.slug,
        label: d.label,
        permissions: d.permissions || []
      });
      (d.permissions || []).forEach((p) => permissionSet.add(p));
    });
    const { profile_access_designations: _pad, ...rest } = data;
    return {
      ...rest,
      designations,
      permissions: [...permissionSet]
    };
  }

  function writeProfileCache(profile) {
    if (!profile?.id) return;
    try {
      sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
        id: profile.id,
        full_name: profile.full_name,
        role: profile.role,
        display_role: profile.display_role || null,
        sub_role: profile.sub_role || null,
        designation: profile.designation,
        username: profile.username,
        can_announcements: !!profile.can_announcements,
        avatar_url: profile.avatar_url || null,
        designations: profile.designations || [],
        permissions: profile.permissions || []
      }));
    } catch {
      /* ignore quota errors */
    }
  }

  function clearProfileCache() {
    try {
      sessionStorage.removeItem(PROFILE_CACHE_KEY);
    } catch {
      /* ignore */
    }
  }

  function hasLocalSession() {
    try {
      const key = getStorageKey();
      if (!key) return false;
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const data = JSON.parse(raw);
      const expiresAt = data?.expires_at;
      if (typeof expiresAt === 'number') return expiresAt * 1000 > Date.now() + 5000;
      return !!(data?.access_token || data?.currentSession?.access_token);
    } catch {
      return false;
    }
  }

  /** Mostra hub só com sessão local válida e perfil autorizado (sync). */
  function applyHeaderAuthFast() {
    const profile = readCachedProfile();
    const hubBtn = document.getElementById('hub-nav-btn');
    if (!profile || !hasLocalSession()) {
      if (hubBtn) {
        hubBtn.classList.remove('is-auth-visible');
        hubBtn.setAttribute('hidden', '');
        hubBtn.setAttribute('aria-hidden', 'true');
        hubBtn.setAttribute('tabindex', '-1');
      }
      return false;
    }

    if (hubBtn && canAccessHub(profile)) {
      hubBtn.classList.add('is-auth-visible');
      hubBtn.removeAttribute('hidden');
      hubBtn.setAttribute('aria-hidden', 'false');
      hubBtn.removeAttribute('tabindex');
    } else if (hubBtn) {
      hubBtn.classList.remove('is-auth-visible');
      hubBtn.setAttribute('hidden', '');
      hubBtn.setAttribute('aria-hidden', 'true');
      hubBtn.setAttribute('tabindex', '-1');
    }

    const icon = document.getElementById('profile-icon');
    if (icon) icon.textContent = 'person';

    currentProfile = profile;
    return true;
  }

  function withTimeout(promise, ms = SESSION_TIMEOUT_MS) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), ms);
      })
    ]);
  }

  async function ensureSupabaseLoaded() {
    if (window.supabase) return;
    if (!supabaseLoadPromise) {
      supabaseLoadPromise = Promise.race([
        new Promise((resolve, reject) => {
          const existing = document.querySelector(`script[src="${SUPABASE_CDN}"]`);
          if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('Supabase CDN')), { once: true });
            return;
          }
          const script = document.createElement('script');
          script.src = SUPABASE_CDN;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Supabase CDN'));
          document.head.appendChild(script);
        }),
        new Promise((_, reject) => {
          window.setTimeout(() => reject(new Error('Supabase CDN timeout')), 12000);
        })
      ]).catch((err) => {
        supabaseLoadPromise = null;
        throw err;
      });
    }
    await supabaseLoadPromise;
  }

  async function getClient() {
    if (!window.JE_CONFIG) return null;
    await ensureSupabaseLoaded();
    if (!window.supabase) return null;
    if (!supabaseClient) {
      supabaseClient = window.supabase.createClient(
        window.JE_CONFIG.supabaseUrl,
        window.JE_CONFIG.supabaseAnonKey
      );
    }
    return supabaseClient;
  }

  function getRoleLabel(roleOrProfile, designation) {
    const role = typeof roleOrProfile === 'object' ? roleOrProfile?.role : roleOrProfile;
    const profile = typeof roleOrProfile === 'object' ? roleOrProfile : null;
    const extraParts = [];
    if (profile?.sub_role) extraParts.push(SUB_ROLE_LABELS[profile.sub_role] || profile.sub_role);
    if (profile) {
      if (profile.designation) extraParts.push(profile.designation);
      (profile.designations || []).forEach((d) => {
        if (d.label) extraParts.push(d.label);
      });
    } else if (designation) {
      extraParts.push(designation);
    }
    const extra = extraParts.join(', ');
    const labelRole = profile?.display_role || role;
    const base = ROLE_LABELS[labelRole] || labelRole;
    return extra ? `${base} (${extra})` : base;
  }

  function hasDeveloperDesignation(profile) {
    if (!profile) return false;
    if (/desenvolvedor/i.test(profile.designation || '')) return true;
    return (profile.designations || []).some(
      (d) => /desenvolvedor/i.test(d.slug || '') || /desenvolvedor/i.test(d.label || '')
    );
  }

  function getRoleLabelClasses(profile, { onDark = false } = {}) {
    if (hasDeveloperDesignation(profile)) {
      return onDark
        ? 'je-role-emblem je-role-emblem--on-dark text-xs font-semibold mt-0.5'
        : 'je-role-emblem text-xs font-semibold mt-0.5';
    }
    if (onDark) return 'text-xs text-accent-gold font-semibold mt-0.5';
    return 'text-xs text-on-surface-variant mt-0.5';
  }

  function applyRoleLabelEl(el, profile, options = {}) {
    if (!el || !profile) return;
    el.textContent = getRoleLabel(profile);
    el.className = getRoleLabelClasses(profile, options);
  }

  function isSuperUser(role) {
    return role === 'superuser';
  }

  function isAdminRole(role) {
    return window.JE_CONFIG?.adminRoles?.includes(role);
  }

  /** Designações ativas no perfil — quando existem, só elas definem o acesso (exceto superuser). */
  function hasAssignedDesignations(profile) {
    return (profile.designations || []).length > 0;
  }

  function hasPermission(profile, permission) {
    if (!profile || !permission) return false;
    if (isSuperUser(profile.role)) return true;

    if (permission === 'secretario' && isSecretario(profile)) return true;

    if (hasAssignedDesignations(profile)) {
      if ((profile.permissions || []).includes(permission)) return true;
      if (permission === 'announcements' && profile.can_announcements) return true;
      return false;
    }

    if (permission !== 'settings' && isAdminRole(profile.role)) return true;
    if ((profile.permissions || []).includes(permission)) return true;
    if (permission === 'announcements' && profile.can_announcements) return true;
    return false;
  }

  function canManageAnnouncements(profile) {
    return hasPermission(profile, 'announcements');
  }

  function isSuperintendente(roleOrProfile) {
    const role = typeof roleOrProfile === 'object' ? roleOrProfile?.role : roleOrProfile;
    return role === 'superintendente';
  }

  function isSecretario(roleOrProfile) {
    const profile = typeof roleOrProfile === 'object' ? roleOrProfile : null;
    const role = profile?.role ?? roleOrProfile;
    if (role === 'secretario') return true;
    if (profile?.sub_role === 'secretario') return true;
    if ((profile?.permissions || []).includes('secretario')) return true;
    return false;
  }

  /** URL de entrada no Hub após login. */
  function getHubEntryUrl(profile) {
    if (isSecretario(profile)) return 'hub.html#secretario';
    return 'hub.html';
  }

  function getHubEntryLabel(profile) {
    if (isSecretario(profile)) return 'Secretário';
    if (isSuperintendente(profile)) return 'Visão Geral';
    return 'Hub Administrativo';
  }

  function canAccessHub(profile) {
    if (!profile) return false;
    if (isSuperUser(profile.role)) return true;
    if (isSuperintendente(profile)) return true;

    if (!hasAssignedDesignations(profile) && isAdminRole(profile.role)) return true;

    if ((profile.permissions || []).includes('hub')) return true;
    if (window.JEAccess?.MODULE_PERMISSIONS?.some((p) => hasPermission(profile, p))) return true;
    return !!profile.can_announcements;
  }

  async function queryProfile(client, userId, select, timeoutMs = SESSION_TIMEOUT_MS) {
    try {
      return await withTimeout(
        client.from('profiles').select(select).eq('id', userId).maybeSingle(),
        timeoutMs
      );
    } catch (err) {
      const message = err?.message === 'timeout' ? 'timeout' : (err?.message || 'unknown');
      return { data: null, error: { message } };
    }
  }

  async function fetchProfile(userId, options = {}) {
    const client = await getClient();
    if (!client || !userId) return null;

    const timeoutMs = options.timeoutMs || SESSION_TIMEOUT_MS;
    let { data, error } = await queryProfile(client, userId, PROFILE_SELECT, timeoutMs);

    if (error && /display_role|avatar_url|column profiles\./i.test(error.message || '')) {
      ({ data, error } = await queryProfile(client, userId, PROFILE_SELECT_FALLBACK, timeoutMs));
    }

    if (error) {
      console.warn('Erro ao carregar perfil:', error.message);
      return null;
    }
    const profile = enrichProfile(data);
    if (profile) writeProfileCache(profile);
    return profile;
  }

  async function getSession() {
    try {
      const client = await getClient();
      if (!client) return null;
      const timeoutMs = hasLocalSession() ? 10000 : SESSION_TIMEOUT_MS;
      const { data } = await withTimeout(client.auth.getSession(), timeoutMs);
      return data.session;
    } catch {
      if (!hasLocalSession()) return null;
      try {
        const client = await getClient();
        if (!client) return null;
        const { data } = await client.auth.getSession();
        return data.session;
      } catch {
        return null;
      }
    }
  }

  async function getCurrentProfile() {
    const session = await getSession();
    if (!session?.user) {
      currentProfile = null;
      return null;
    }
    if (currentProfile?.id === session.user.id) return currentProfile;
    const cached = readCachedProfile();
    if (cached?.id === session.user.id && cached.role) {
      currentProfile = cached;
    }
    currentProfile = await fetchProfile(session.user.id) || currentProfile;
    return currentProfile;
  }

  async function signIn(username, password) {
    const client = await getClient();
    if (!client) throw new Error('Supabase não configurado.');

    const normalizedUsername = username?.trim();
    if (!normalizedUsername) throw new Error('Usuário inválido.');

    const { data: email, error: lookupError } = await client.rpc('get_login_email', {
      p_username: normalizedUsername
    });

    if (lookupError || !email) throw new Error('Credenciais inválidas.');

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;

    currentProfile = await fetchProfile(data.user.id, { timeoutMs: 12000 });
    if (!currentProfile) {
      currentProfile = await fetchProfile(data.user.id, { timeoutMs: 12000 });
    }
    return { user: data.user, profile: currentProfile };
  }

  async function signOut() {
    const client = await getClient();
    if (!client) return;
    await client.auth.signOut();
    currentProfile = null;
    clearProfileCache();
  }

  function onAuthStateChange(callback) {
    getClient().then((client) => {
      if (!client) return;
      client.auth.onAuthStateChange(async (_event, session) => {
        if (!session?.user) {
          currentProfile = null;
          clearProfileCache();
          callback(session, null);
          return;
        }
        currentProfile = await fetchProfile(session.user.id);
        callback(session, currentProfile);
      });
    });
  }

  async function refreshCurrentProfile() {
    const session = await getSession();
    if (!session?.user) {
      currentProfile = null;
      clearProfileCache();
      return null;
    }
    currentProfile = await fetchProfile(session.user.id, { timeoutMs: 12000 });
    return currentProfile;
  }

  async function updatePassword(newPassword) {
    const client = await getClient();
    if (!client) throw new Error('Supabase não configurado.');

    const session = await getSession();
    if (!session?.user) throw new Error('Faça login novamente para alterar a senha.');

    const password = String(newPassword || '');
    if (password.length < 8) throw new Error('A senha deve ter pelo menos 8 caracteres.');

    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
    return true;
  }

  function getPasswordResetRedirectUrl() {
    const origin = window.location.origin.replace(/\/$/, '');
    return `${origin}/redefinir-senha.html`;
  }

  /** Envia link de redefinição ao e-mail do usuário (se existir). Resposta sempre genérica. */
  async function requestPasswordReset(username) {
    const client = await getClient();
    if (!client) throw new Error('Supabase não configurado.');

    const normalizedUsername = String(username || '').trim();
    if (!normalizedUsername) throw new Error('Informe seu usuário.');

    let email = null;
    try {
      const { data, error } = await client.rpc('get_login_email', { p_username: normalizedUsername });
      if (!error && data) email = data;
    } catch {
      /* não expor se o usuário existe */
    }

    if (email) {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordResetRedirectUrl()
      });
      if (error) console.warn('requestPasswordReset:', error.message);
    }

    return true;
  }

  function renderAvatarHtml(profile, { size = 40, className = '' } = {}) {
    const url = profile?.avatar_url;
    const cls = className ? ` ${className}` : '';
    if (url) {
      const safe = String(url).replace(/"/g, '&quot;');
      return `<img src="${safe}" alt="" class="je-profile-avatar${cls}" width="${size}" height="${size}" loading="lazy"/>`;
    }
    return `<span class="material-symbols-outlined je-profile-avatar-fallback${cls}" aria-hidden="true" style="font-size:${Math.round(size * 0.72)}px">person</span>`;
  }

  window.JEAuth = {
    getClient,
    getSession,
    getCurrentProfile,
    refreshCurrentProfile,
    getCachedProfile: readCachedProfile,
    hasLocalSession,
    applyHeaderAuthFast,
    signIn,
    signOut,
    updatePassword,
    requestPasswordReset,
    getPasswordResetRedirectUrl,
    onAuthStateChange,
    getRoleLabel,
    getRoleLabelClasses,
    applyRoleLabelEl,
    SUB_ROLE_LABELS,
    SUB_ROLES,
    hasDeveloperDesignation,
    renderAvatarHtml,
    isAdminRole,
    isSuperUser,
    isSuperintendente,
    isSecretario,
    getHubEntryUrl,
    getHubEntryLabel,
    hasPermission,
    canManageAnnouncements,
    canAccessHub
  };

  if (window.JE_CONFIG) {
    ensureSupabaseLoaded().catch(() => {});
  }
})();
