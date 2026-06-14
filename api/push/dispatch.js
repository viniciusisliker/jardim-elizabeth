import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function canSend(token) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon || !token) return false;

  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data: { user }, error } = await userClient.auth.getUser(token);
  if (error || !user) return false;

  const { data, error: rpcErr } = await userClient.rpc('je_can_send_hub_notifications');
  if (rpcErr) return false;
  return !!data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:contato@jardimelizabeth.org';

  if (!publicKey || !privateKey) {
    return res.status(503).json({ error: 'push_not_configured' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: 'supabase_not_configured' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || !(await canSend(token))) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const { title, body, recipientUserId } = req.body || {};
  const safeTitle = String(title || '').trim();
  const safeBody = String(body || '').trim();
  if (!safeTitle || !safeBody) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  let query = supabase.from('hub_push_subscriptions').select('endpoint, p256dh, auth_key, user_id');
  if (recipientUserId) {
    query = query.eq('user_id', recipientUserId);
  }

  const { data: subs, error } = await query;
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!subs?.length) {
    return res.status(200).json({ sent: 0, skipped: true });
  }

  const payload = JSON.stringify({
    title: safeTitle,
    body: safeBody,
    url: '/hub.html',
    tag: `je-hub-${Date.now()}`
  });

  let sent = 0;
  const stale = [];

  await Promise.all(subs.map(async (row) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth_key }
        },
        payload
      );
      sent += 1;
    } catch (err) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        stale.push(row.endpoint);
      }
    }
  }));

  if (stale.length) {
    await supabase.from('hub_push_subscriptions').delete().in('endpoint', stale);
  }

  return res.status(200).json({ sent, stale: stale.length });
}
