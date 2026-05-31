(function () {
  const ROLE_LABELS = {
    superuser: 'SuperUser',
    anciao: 'Ancião',
    servo_ministerial: 'Servo Ministerial',
    publicador: 'Publicador'
  };

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

  const PROFILE_SELECT = `id, full_name, role, designation, username, can_announcements,
    profile_access_designations (
      access_designations ( id, slug, label, permissions, is_active )
    )`;

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
        designation: profile.designation,
        username: profile.username,
        can_announcements: !!profile.can_announcements,
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

  /** Mostra hub/ícone de perfil antes do Supabase CDN carregar (sync). */
  function applyHeaderAuthFast() {
    const profile = readCachedProfile();
    if (!profile || !hasLocalSession()) return false;

    const hubBtn = document.getElementById('hub-nav-btn');
    if (hubBtn && canAccessHub(profile)) {
      hubBtn.classList.remove('hidden');
      hubBtn.classList.add('flex');
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
      supabaseLoadPromise = new Promise((resolve, reject) => {
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
    const extra = profile
      ? (profile.designation || (profile.designations || []).map((d) => d.label).join(', ') || '')
      : (designation || '');
    const base = ROLE_LABELS[role] || role;
    return extra ? `${base} (${extra})` : base;
  }

  function isSuperUser(role) {
    return role === 'superuser';
  }

  function isAdminRole(role) {
    return window.JE_CONFIG?.adminRoles?.includes(role);
  }

  function hasPermission(profile, permission) {
    if (!profile || !permission) return false;
    if (isSuperUser(profile.role)) return true;
    if (permission !== 'settings' && isAdminRole(profile.role)) return true;
    if ((profile.permissions || []).includes(permission)) return true;
    if (permission === 'announcements' && profile.can_announcements) return true;
    return false;
  }

  function canManageAnnouncements(profile) {
    return hasPermission(profile, 'announcements');
  }

  function canAccessHub(profile) {
    if (!profile) return false;
    if (isSuperUser(profile.role) || isAdminRole(profile.role)) return true;
    if ((profile.permissions || []).includes('hub')) return true;
    if (window.JEAccess?.MODULE_PERMISSIONS?.some((p) => hasPermission(profile, p))) return true;
    return !!profile.can_announcements;
  }

  async function fetchProfile(userId) {
    const client = await getClient();
    if (!client || !userId) return null;

    const { data, error } = await withTimeout(
      client.from('profiles').select(PROFILE_SELECT).eq('id', userId).maybeSingle()
    );

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

    currentProfile = await fetchProfile(data.user.id);
    if (currentProfile) writeProfileCache(currentProfile);
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

  window.JEAuth = {
    getClient,
    getSession,
    getCurrentProfile,
    getCachedProfile: readCachedProfile,
    hasLocalSession,
    applyHeaderAuthFast,
    signIn,
    signOut,
    onAuthStateChange,
    getRoleLabel,
    isAdminRole,
    isSuperUser,
    hasPermission,
    canManageAnnouncements,
    canAccessHub
  };

  if (window.JE_CONFIG) {
    ensureSupabaseLoaded().catch(() => {});
  }
})();
