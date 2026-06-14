(function () {
  function unavailable(err) {
    const msg = String(err?.message || err || '');
    return /hub_notifications|could not find|schema cache|PGRST205/i.test(msg);
  }

  function canSend(profile) {
    if (!profile) return false;
    if (window.JEAuth?.isSuperUser?.(profile.role)) return true;
    if (['anciao', 'servo_ministerial'].includes(profile.role)) return true;
    return window.JEAuth?.hasPermission?.(profile, 'settings');
  }

  async function list(client, limit = 50) {
    const { data: { user } } = await client.auth.getUser();
    if (!user?.id) return [];

    const { data, error } = await client
      .from('hub_notifications')
      .select('id, recipient_user_id, sender_user_id, title, body, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (unavailable(error)) {
        throw new Error('Notificações não configuradas no Supabase. Rode a migration 20260624120000_hub_notifications.sql.');
      }
      throw error;
    }

    const rows = data || [];
    if (!rows.length) return [];

    const senderIds = [...new Set(rows.map((r) => r.sender_user_id))];
    const { data: senders } = await client
      .from('profiles')
      .select('id, full_name, role, display_role')
      .in('id', senderIds);

    const senderMap = new Map((senders || []).map((s) => [s.id, s]));
    return rows.map((row) => ({
      ...row,
      sender: senderMap.get(row.sender_user_id) || null
    }));
  }

  async function countUnread(client) {
    const { data: { user } } = await client.auth.getUser();
    if (!user?.id) return 0;

    const { count, error } = await client
      .from('hub_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_user_id', user.id)
      .is('read_at', null);

    if (error) {
      if (unavailable(error)) return 0;
      return 0;
    }
    return count || 0;
  }

  async function markRead(client, id) {
    const { data: { user } } = await client.auth.getUser();
    if (!user?.id) return;

    const { error } = await client
      .from('hub_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('recipient_user_id', user.id)
      .is('read_at', null);

    if (error) throw error;
  }

  async function markAllRead(client) {
    const { data: { user } } = await client.auth.getUser();
    if (!user?.id) return;

    const { error } = await client
      .from('hub_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_user_id', user.id)
      .is('read_at', null);

    if (error) throw error;
  }

  async function send(client, title, body, recipientId) {
    const t = String(title || '').trim();
    const b = String(body || '').trim();
    if (!t || !b) throw new Error('Título e mensagem são obrigatórios.');

    const { data, error } = await client.rpc('hub_notifications_send', {
      p_title: t,
      p_body: b,
      p_recipient: recipientId || null
    });

    if (error) {
      if (unavailable(error)) {
        throw new Error('Notificações não configuradas no Supabase. Rode a migration 20260624120000_hub_notifications.sql.');
      }
      const msg = String(error.message || '');
      if (/forbidden|42501/i.test(msg)) throw new Error('Sem permissão para enviar notificações.');
      throw error;
    }
    return Number(data || 0);
  }

  async function listRecipients(client) {
    const { data, error } = await client
      .from('profiles')
      .select('id, full_name, role, display_role, username')
      .order('full_name');

    if (error) throw error;
    return data || [];
  }

  window.JEHubNotifications = {
    unavailable,
    canSend,
    list,
    countUnread,
    markRead,
    markAllRead,
    send,
    listRecipients
  };
})();
