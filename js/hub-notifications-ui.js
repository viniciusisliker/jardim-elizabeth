(function () {
  const api = () => window.JEHubNotifications;
  const esc = (v) => window.JEAdmin?.escapeHtml?.(v) ?? String(v ?? '');

  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function senderLabel(sender) {
    if (!sender) return '';
    if (sender.display_role) return sender.display_role;
    return window.JEAuth?.getRoleLabel?.(sender) || sender.full_name || '';
  }

  function mountBell(root, client, userId) {
    if (!root || root.dataset.mounted === '1') return;
    root.dataset.mounted = '1';
    root.innerHTML = `
      <div class="hub-notif" id="hub-notif-root">
        <button type="button" class="hub-notif__bell" id="hub-notif-toggle" aria-expanded="false" aria-haspopup="dialog" aria-label="Notificações" title="Notificações">
          <span class="material-symbols-outlined" aria-hidden="true">notifications</span>
          <span class="hub-notif__badge hidden" id="hub-notif-badge" aria-hidden="true">0</span>
        </button>
        <div class="hub-notif__panel hidden" id="hub-notif-panel" role="dialog" aria-label="Notificações">
          <div class="hub-notif__head">
            <span class="hub-notif__title">Notificações</span>
            <button type="button" class="hub-notif__mark-all" id="hub-notif-mark-all" disabled>Marcar todas</button>
          </div>
          <div class="hub-notif__push">
            <p class="hub-notif__push-text">Receba avisos mesmo com o Hub fechado.</p>
            <button type="button" class="hub-notif__push-btn" id="hub-notif-push-btn">Ativar no celular</button>
          </div>
          <p class="hub-notif__error hidden" id="hub-notif-error" role="alert"></p>
          <div class="hub-notif__list" id="hub-notif-list"></div>
        </div>
      </div>`;

    const toggle = document.getElementById('hub-notif-toggle');
    const panel = document.getElementById('hub-notif-panel');
    const badge = document.getElementById('hub-notif-badge');
    const listEl = document.getElementById('hub-notif-list');
    const errEl = document.getElementById('hub-notif-error');
    const markAllBtn = document.getElementById('hub-notif-mark-all');
    let open = false;
    let unread = 0;
    let channel = null;

    function setOpen(next) {
      open = next;
      panel.classList.toggle('hidden', !open);
      toggle.classList.toggle('hub-notif__bell--open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) loadList();
    }

    function setBadge(count) {
      unread = count;
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.classList.remove('hidden');
        toggle.setAttribute('aria-label', `Notificações — ${count} não lidas`);
      } else {
        badge.classList.add('hidden');
        toggle.setAttribute('aria-label', 'Notificações');
      }
      markAllBtn.disabled = count === 0;
    }

    async function refreshBadge() {
      try {
        setBadge(await api().countUnread(client));
      } catch (e) {
        if (!api().unavailable(e)) console.warn(e);
        setBadge(0);
      }
    }

    function renderList(items, loading) {
      if (loading && !items.length) {
        listEl.innerHTML = '<p class="hub-notif__empty">Carregando…</p>';
        return;
      }
      if (!items.length) {
        listEl.innerHTML = '<p class="hub-notif__empty">Nenhuma notificação.</p>';
        return;
      }
      listEl.innerHTML = items.map((item) => {
        const unreadCls = item.read_at ? '' : ' hub-notif__item--unread';
        const meta = senderLabel(item.sender);
        return `
          <button type="button" class="hub-notif__item${unreadCls}" data-notif-id="${esc(item.id)}" data-unread="${item.read_at ? '0' : '1'}">
            <div class="hub-notif__item-head">
              <span class="hub-notif__item-title">${esc(item.title)}</span>
              <time class="hub-notif__item-time" datetime="${esc(item.created_at)}">${esc(formatDateTime(item.created_at))}</time>
            </div>
            <p class="hub-notif__item-body">${esc(item.body)}</p>
            ${meta ? `<div class="hub-notif__item-meta">${esc(meta)}</div>` : ''}
          </button>`;
      }).join('');
    }

    async function loadList() {
      errEl.classList.add('hidden');
      renderList([], true);
      try {
        const items = await api().list(client);
        renderList(items, false);
        await refreshBadge();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro ao carregar notificações.';
        errEl.textContent = msg;
        errEl.classList.remove('hidden');
        renderList([], false);
      }
    }

    toggle.addEventListener('click', () => setOpen(!open));

    markAllBtn.addEventListener('click', async () => {
      try {
        await api().markAllRead(client);
        await loadList();
      } catch (e) {
        console.warn(e);
      }
    });

    listEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-notif-id]');
      if (!btn || btn.dataset.unread !== '1') return;
      try {
        await api().markRead(client, btn.dataset.notifId);
        btn.dataset.unread = '0';
        btn.classList.remove('hub-notif__item--unread');
        await refreshBadge();
      } catch (err) {
        console.warn(err);
      }
    });

    document.addEventListener('click', (e) => {
      if (!open) return;
      if (document.getElementById('hub-notif-root')?.contains(e.target)) return;
      setOpen(false);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) setOpen(false);
    });

    if (client && userId) {
      channel = client
        .channel(`je-hub-notifications-${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'hub_notifications',
          filter: `recipient_user_id=eq.${userId}`
        }, () => {
          refreshBadge();
          if (open) loadList();
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'hub_notifications',
          filter: `recipient_user_id=eq.${userId}`
        }, () => {
          refreshBadge();
          if (open) loadList();
        })
        .subscribe();
    }

    refreshBadge();

    const pushBtn = document.getElementById('hub-notif-push-btn');
    async function syncPushBtn() {
      if (!pushBtn || !window.JEPush) return;
      const on = await window.JEPush.isSubscribed().catch(() => false);
      pushBtn.textContent = on ? 'Avisos push ativos' : 'Ativar no celular';
      pushBtn.disabled = on;
    }

    pushBtn?.addEventListener('click', async () => {
      if (!window.JEPush) return;
      pushBtn.disabled = true;
      pushBtn.textContent = 'Ativando…';
      try {
        await window.JEPush.subscribe(client);
        pushBtn.textContent = 'Avisos push ativos';
      } catch (err) {
        pushBtn.disabled = false;
        pushBtn.textContent = 'Ativar no celular';
        if (errEl) {
          errEl.textContent = err?.message || 'Não foi possível ativar push.';
          errEl.classList.remove('hidden');
        }
      }
    });

    syncPushBtn();

    return () => {
      if (channel) client.removeChannel(channel);
    };
  }

  function mountSendForm(root, client, profile) {
    if (!root || !api().canSend(profile)) {
      if (root) root.classList.add('hidden');
      return;
    }
    root.classList.remove('hidden');
    if (root.dataset.mounted === '1') return;
    root.dataset.mounted = '1';

    root.innerHTML = `
      <section class="cfg-card hub-notif-send">
        <div class="cfg-section-head">
          <div>
            <p class="cfg-section-title"><span class="material-symbols-outlined" aria-hidden="true">notifications_active</span>Notificações da equipe</p>
            <p class="cfg-section-desc">Envie aviso para um membro ou para toda a equipe com acesso ao Hub.</p>
          </div>
        </div>
        <form id="hub-notif-send-form" class="hub-notif-send__form">
          <fieldset class="hub-notif-send__dest">
            <legend>Destino</legend>
            <label class="hub-notif-send__radio"><input type="radio" name="hub-notif-dest" value="todos" checked/> Toda a equipe</label>
            <label class="hub-notif-send__radio"><input type="radio" name="hub-notif-dest" value="usuario"/> Membro específico</label>
          </fieldset>
          <label class="hub-notif-send__field hidden" id="hub-notif-recipient-wrap">
            <span>Destinatário</span>
            <select id="hub-notif-recipient" class="cfg-search"></select>
          </label>
          <label class="hub-notif-send__field">
            <span>Título</span>
            <input id="hub-notif-title" type="text" maxlength="120" required placeholder="Ex.: Manutenção programada"/>
          </label>
          <label class="hub-notif-send__field">
            <span>Mensagem</span>
            <textarea id="hub-notif-body" rows="4" maxlength="2000" required placeholder="Texto da notificação…"></textarea>
          </label>
          <p class="hub-notif-send__feedback hidden" id="hub-notif-send-feedback" role="status"></p>
          <button type="submit" class="cfg-btn cfg-btn--primary" id="hub-notif-send-btn">Enviar notificação</button>
        </form>
      </section>`;

    const form = document.getElementById('hub-notif-send-form');
    const recipientWrap = document.getElementById('hub-notif-recipient-wrap');
    const recipientSel = document.getElementById('hub-notif-recipient');
    const feedback = document.getElementById('hub-notif-send-feedback');
    const sendBtn = document.getElementById('hub-notif-send-btn');
    let users = [];

    function setFeedback(ok, msg) {
      feedback.textContent = msg;
      feedback.classList.remove('hidden', 'hub-notif-send__feedback--ok', 'hub-notif-send__feedback--err');
      feedback.classList.add(ok ? 'hub-notif-send__feedback--ok' : 'hub-notif-send__feedback--err');
    }

    function syncDestUi() {
      const dest = form.querySelector('input[name="hub-notif-dest"]:checked')?.value;
      recipientWrap.classList.toggle('hidden', dest !== 'usuario');
    }

    form.querySelectorAll('input[name="hub-notif-dest"]').forEach((el) => {
      el.addEventListener('change', syncDestUi);
    });

    api().listRecipients(client).then((list) => {
      users = list;
      recipientSel.innerHTML = '<option value="">Selecione…</option>' + users.map((u) =>
        `<option value="${esc(u.id)}">${esc(u.full_name)}${u.username ? ` (@${esc(u.username)})` : ''}</option>`
      ).join('');
    }).catch((e) => setFeedback(false, e?.message || 'Erro ao carregar equipe.'));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      feedback.classList.add('hidden');
      const dest = form.querySelector('input[name="hub-notif-dest"]:checked')?.value;
      const title = document.getElementById('hub-notif-title').value;
      const body = document.getElementById('hub-notif-body').value;
      const recipientId = dest === 'usuario' ? recipientSel.value : null;
      if (dest === 'usuario' && !recipientId) {
        setFeedback(false, 'Selecione um destinatário.');
        return;
      }
      sendBtn.disabled = true;
      sendBtn.textContent = 'Enviando…';
      try {
        const count = await api().send(client, title, body, recipientId);
        setFeedback(true, dest === 'usuario' ? 'Notificação enviada.' : `Notificação enviada para ${count} membro(s).`);
        await window.JEPush?.dispatchAfterSend?.(client, { title, body, recipientId });
        document.getElementById('hub-notif-title').value = '';
        document.getElementById('hub-notif-body').value = '';
      } catch (err) {
        setFeedback(false, err?.message || 'Falha ao enviar.');
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Enviar notificação';
      }
    });
  }

  function initBell(client, userId) {
    const root = document.getElementById('hub-notifications-root');
    if (!root || !client || !userId) return null;
    return mountBell(root, client, userId);
  }

  function initSendForm(client, profile) {
    mountSendForm(document.getElementById('hub-notif-send-root'), client, profile);
  }

  window.JEHubNotificationsUi = { initBell, initSendForm, formatDateTime };
})();
