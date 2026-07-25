(function () {
  const { getClient, showToast, escapeHtml } = window.JEAdmin;

  function toastEl() {
    return document.getElementById('hub-admin-toast') || document.getElementById('admin-toast');
  }

  function canManageLinks(profile) {
    return window.JEAuth.hasPermission(profile, 'settings')
      || window.JEAuth.hasPermission(profile, 'agendamentos');
  }

  async function init() {
    const root = document.getElementById('cfg-calendar-links');
    if (!root) return;

    const profile = window.JEHubRouter?.getProfile?.() || await window.JEAuth.getCurrentProfile();
    if (!profile || !canManageLinks(profile)) {
      root.classList.add('hidden');
      return;
    }

    if (window.__JEAdminAgendamentosInit) {
      await reloadIfBound(root);
      return;
    }
    window.__JEAdminAgendamentosInit = true;

    const toast = toastEl();
    const client = await getClient();
    let items = [];

    async function reloadIfBound(el) {
      if (el.dataset.bound !== '1') return;
      const { data } = await client.from('equipment_schedules').select('*').order('sort_order');
      items = data || [];
      renderList();
    }

    async function reload() {
      const { data } = await client.from('equipment_schedules').select('*').order('sort_order');
      items = data || [];
      renderList();
    }

    function renderList() {
      const list = document.getElementById('schedule-list');
      if (!list) return;
      if (!items.length) {
        list.innerHTML = '<p class="cfg-calendar-empty">Nenhum calendário cadastrado.</p>';
        return;
      }
      list.innerHTML = items.map((item) => `
        <div class="cfg-calendar-row">
          <div class="cfg-calendar-row__body">
            <p class="cfg-calendar-row__title">${escapeHtml(item.title)} <span class="cfg-calendar-row__slug">(${escapeHtml(item.slug)})</span></p>
            <p class="cfg-calendar-row__url">${escapeHtml(item.calendar_embed_url)}</p>
          </div>
          <button type="button" data-edit="${item.id}" class="cfg-calendar-row__edit">Editar</button>
        </div>`).join('');
      list.querySelectorAll('[data-edit]').forEach((btn) =>
        btn.addEventListener('click', () => openForm(items.find((i) => i.id === btn.dataset.edit)))
      );
    }

    function openForm(item) {
      document.getElementById('sched-form')?.classList.remove('hidden');
      document.getElementById('sched-id').value = item?.id || '';
      document.getElementById('sched-slug').value = item?.slug || '';
      document.getElementById('sched-title').value = item?.title || '';
      document.getElementById('sched-url').value = item?.calendar_embed_url || '';
      document.getElementById('sched-sort').value = item?.sort_order ?? 0;
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (root.dataset.bound === '1') {
      await reload();
      return;
    }
    root.dataset.bound = '1';

    document.getElementById('btn-new')?.addEventListener('click', () => openForm(null));
    document.getElementById('btn-cancel')?.addEventListener('click', () => document.getElementById('sched-form')?.classList.add('hidden'));

    document.getElementById('sched-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('sched-id').value;
      const payload = {
        slug: document.getElementById('sched-slug').value.trim(),
        title: document.getElementById('sched-title').value.trim(),
        calendar_embed_url: document.getElementById('sched-url').value.trim(),
        sort_order: parseInt(document.getElementById('sched-sort').value, 10) || 0,
        published: true
      };
      const { error } = id
        ? await client.from('equipment_schedules').update(payload).eq('id', id)
        : await client.from('equipment_schedules').insert(payload);
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, 'Calendário salvo.');
        document.getElementById('sched-form')?.classList.add('hidden');
        await reload();
      }
    });

    await reload();
  }

  window.JEAdminAgendamentos = { init };
})();
