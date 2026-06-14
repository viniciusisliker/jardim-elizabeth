(function () {
  const TABLE = 'hub_push_subscriptions';
  let publicKeyCache = null;

  function unavailable(err) {
    const msg = String(err?.message || err || '');
    return /hub_push_subscriptions|could not find|schema cache|PGRST205/i.test(msg);
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  async function fetchPublicKey() {
    if (publicKeyCache) return publicKeyCache;
    const res = await fetch('/api/push/vapid-public-key', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    publicKeyCache = data.publicKey || null;
    return publicKeyCache;
  }

  function subscriptionPayload(sub) {
    const json = sub.toJSON();
    return {
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth_key: json.keys?.auth,
      user_agent: navigator.userAgent.slice(0, 240)
    };
  }

  async function saveSubscription(client, sub) {
    const payload = subscriptionPayload(sub);
    if (!payload.endpoint || !payload.p256dh || !payload.auth_key) {
      throw new Error('Assinatura push inválida.');
    }

    const { data: { user } } = await client.auth.getUser();
    if (!user?.id) throw new Error('Faça login para ativar avisos push.');

    const { error } = await client.from(TABLE).upsert(
      { ...payload, user_id: user.id, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,endpoint' }
    );

    if (error) {
      if (unavailable(error)) {
        throw new Error('Push não configurado no Supabase. Rode a migration 20260615120000_hub_push_subscriptions.sql.');
      }
      throw error;
    }
  }

  async function subscribe(client) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Seu navegador não suporta notificações push.');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Permissão de notificação negada.');
    }

    const publicKey = await fetchPublicKey();
    if (!publicKey) {
      throw new Error('Push ainda não configurado no servidor (VAPID).');
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }

    await saveSubscription(client, sub);
    return sub;
  }

  async function unsubscribe(client) {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      if (client) {
        await client.from(TABLE).delete().eq('endpoint', endpoint);
      }
    }
  }

  async function isSubscribed() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  }

  async function dispatchAfterSend(client, { title, body, recipientId }) {
    try {
      const session = await window.JEAuth?.getSession?.();
      if (!session?.access_token) return;

      await fetch('/api/push/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title,
          body,
          recipientUserId: recipientId || null
        })
      });
    } catch (err) {
      console.warn('Push dispatch:', err);
    }
  }

  window.JEPush = {
    unavailable,
    subscribe,
    unsubscribe,
    isSubscribed,
    dispatchAfterSend
  };
})();
