(function () {
  const ROLE_LABELS = {
    superuser: 'SuperUser',
    anciao: 'Ancião',
    servo_ministerial: 'Servo Ministerial',
    publicador: 'Publicador'
  };

  const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  const SESSION_TIMEOUT_MS = 4000;

  let supabaseClient = null;
  let supabaseLoadPromise = null;
  let currentProfile = null;

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
    const extra = typeof roleOrProfile === 'object' ? roleOrProfile?.designation : designation;
    const base = ROLE_LABELS[role] || role;
    return extra ? `${base} (${extra})` : base;
  }

  function isSuperUser(role) {
    return role === 'superuser';
  }

  function isAdminRole(role) {
    return window.JE_CONFIG?.adminRoles?.includes(role);
  }

  async function fetchProfile(userId) {
    const client = await getClient();
    if (!client || !userId) return null;

    const { data, error } = await withTimeout(
      client.from('profiles').select('id, full_name, role, designation, username').eq('id', userId).maybeSingle()
    );

    if (error) {
      console.warn('Erro ao carregar perfil:', error.message);
      return null;
    }
    return data;
  }

  async function getSession() {
    try {
      const client = await getClient();
      if (!client) return null;
      const { data } = await withTimeout(client.auth.getSession());
      return data.session;
    } catch {
      return null;
    }
  }

  async function getCurrentProfile() {
    const session = await getSession();
    if (!session?.user) {
      currentProfile = null;
      return null;
    }
    if (currentProfile?.id === session.user.id) return currentProfile;
    currentProfile = await fetchProfile(session.user.id);
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
    return { user: data.user, profile: currentProfile };
  }

  async function signOut() {
    const client = await getClient();
    if (!client) return;
    await client.auth.signOut();
    currentProfile = null;
  }

  function onAuthStateChange(callback) {
    getClient().then((client) => {
      if (!client) return;
      client.auth.onAuthStateChange(async (_event, session) => {
        currentProfile = session?.user ? await fetchProfile(session.user.id) : null;
        callback(session, currentProfile);
      });
    });
  }

  window.JEAuth = {
    getClient,
    getSession,
    getCurrentProfile,
    signIn,
    signOut,
    onAuthStateChange,
    getRoleLabel,
    isAdminRole,
    isSuperUser
  };
})();
