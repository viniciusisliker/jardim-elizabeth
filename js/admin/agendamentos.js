(function () {
  const { guardPermission, getClient, showToast, escapeHtml } = window.JEAdmin;

  function toastEl() {
    return document.getElementById('hub-admin-toast') || document.getElementById('admin-toast');
  }

  async function init() {
    const profile = await guardPermission('agendamentos');
    if (!profile) return;
    const toast = toastEl();
    const client = await getClient();
    let items = [];

    async function reload() {
      const { data } = await client.from('equipment_schedules').select('*').order('sort_order');
      items = data || [];
      renderList();
    }

    function renderList() {
      document.getElementById('schedule-list').innerHTML = items.map((item) => `
        <div class="px-4 py-3 border-b border-outline-variant flex flex-col sm:flex-row sm:items-center gap-2">
          <div class="flex-1 min-w-0">
            <p class="font-bold text-primary text-sm">${escapeHtml(item.title)} <span class="text-xs font-normal text-on-surface-variant">(${escapeHtml(item.slug)})</span></p>
            <p class="text-xs text-on-surface-variant truncate">${escapeHtml(item.calendar_embed_url)}</p>
          </div>
          <button type="button" data-edit="${item.id}" class="text-xs font-semibold text-secondary shrink-0">Editar</button>
        </div>`).join('');
      document.querySelectorAll('#hub-view-agendamentos [data-edit], #schedule-list [data-edit]').forEach((btn) =>
        btn.addEventListener('click', () => openForm(items.find((i) => i.id === btn.dataset.edit)))
      );
    }

    function openForm(item) {
      document.getElementById('sched-form').classList.remove('hidden');
      document.getElementById('sched-id').value = item?.id || '';
      document.getElementById('sched-slug').value = item?.slug || '';
      document.getElementById('sched-title').value = item?.title || '';
      document.getElementById('sched-url').value = item?.calendar_embed_url || '';
      document.getElementById('sched-sort').value = item?.sort_order ?? 0;
    }

    const root = document.getElementById('hub-view-agendamentos') || document.body;
    if (root.dataset.bound === '1') {
      await reload();
      return;
    }
    root.dataset.bound = '1';

    document.getElementById('btn-new').addEventListener('click', () => openForm(null));
    document.getElementById('btn-cancel').addEventListener('click', () => document.getElementById('sched-form').classList.add('hidden'));

    document.getElementById('sched-form').addEventListener('submit', async (e) => {
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
      else { showToast(toast, 'Calendário salvo.'); document.getElementById('sched-form').classList.add('hidden'); await reload(); }
    });

    await reload();
  }

  window.JEAdminAgendamentos = { init };

  if (!window.JEHubRouter && document.getElementById('schedule-list')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})();
