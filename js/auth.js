(function () {
  const ROLE_LABELS = {
    superuser: 'SuperUser',
    anciao: 'Ancião',
    servo_ministerial: 'Servo Ministerial',
    publicador: 'Publicador'
  };

  let supabaseClient = null;
  let currentProfile = null;

  function getClient() {
    if (!window.JE_CONFIG || !window.supabase) return null;
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
    const client = getClient();
    if (!client || !userId) return null;

    const { data, error } = await client
      .from('profiles')
      .select('id, full_name, role, designation, username')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Erro ao carregar perfil:', error.message);
      return null;
    }
    return data;
  }

  async function getSession() {
    const client = getClient();
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data.session;
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
    const client = getClient();
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
    const client = getClient();
    if (!client) return;
    await client.auth.signOut();
    currentProfile = null;
  }

  function onAuthStateChange(callback) {
    const client = getClient();
    if (!client) return () => {};
    return client.auth.onAuthStateChange(async (_event, session) => {
      currentProfile = session?.user ? await fetchProfile(session.user.id) : null;
      callback(session, currentProfile);
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
