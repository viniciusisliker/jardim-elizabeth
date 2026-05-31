(function () {
  const { guardAdmin, getClient, showToast, escapeHtml } = window.JEAdmin;
  const H = window.JEAgendaHelpers;

  async function init() {
    const profile = await guardAdmin();
    if (!profile) return;

    const toast = document.getElementById('admin-toast');
    const client = await getClient();
    let events = [];

    async function reload() {
      const { data } = await client.from('agenda_events').select('*').order('event_date', { ascending: false });
      events = data || [];
      renderList();
    }

    function syncDerivedFields() {
      const iso = document.getElementById('ev-event-date').value;
      const future = document.getElementById('ev-future')?.checked;
      const derived = H.deriveFieldsFromDate(iso, { futureGroup: future });
      if (!derived) return;
      document.getElementById('ev-date-display').value = derived.date_display;
      document.getElementById('ev-date-label').value = derived.date_label;
      document.getElementById('ev-month-key').value = derived.month_key;
      document.getElementById('ev-month-label').value = derived.month_label;
    }

    function renderList() {
      const list = document.getElementById('event-list');
      if (!events.length) {
        list.innerHTML = '<p class="text-sm text-on-surface-variant py-4 px-4">Nenhum evento cadastrado.</p>';
        return;
      }
      list.innerHTML = events.map((ev) => `
        <div class="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-outline-variant last:border-0">
          <div class="flex-1 min-w-0">
            <p class="font-bold text-primary text-sm">${escapeHtml(ev.title)}</p>
            <p class="text-xs text-on-surface-variant">${escapeHtml(ev.month_label)} · ${escapeHtml(ev.date_display)} ${escapeHtml(ev.date_label)} · ${escapeHtml(ev.category)}</p>
          </div>
          <div class="flex gap-2 shrink-0">
            <button type="button" data-edit="${ev.id}" class="text-xs font-semibold text-secondary hover:underline">Editar</button>
            <button type="button" data-del="${ev.id}" class="text-xs font-semibold text-error hover:underline">Excluir</button>
          </div>
        </div>`).join('');

      list.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => openForm(events.find((e) => e.id === btn.dataset.edit))));
      list.querySelectorAll('[data-del]').forEach((btn) => btn.addEventListener('click', () => removeEvent(btn.dataset.del)));
    }

    function openForm(ev) {
      const form = document.getElementById('event-form');
      form.classList.remove('hidden');
      document.getElementById('ev-id').value = ev?.id || '';
      document.getElementById('ev-title').value = ev?.title || '';
      document.getElementById('ev-description').value = ev?.description || '';
      document.getElementById('ev-category').value = ev?.category || 'Especial';
      document.getElementById('ev-date-display').value = ev?.date_display || '';
      document.getElementById('ev-date-label').value = ev?.date_label || '';
      document.getElementById('ev-event-date').value = ev?.event_date || '';
      document.getElementById('ev-month-key').value = ev?.month_key || '';
      document.getElementById('ev-month-label').value = ev?.month_label || '';
      document.getElementById('ev-time').value = ev?.event_time || H.DEFAULTS.event_time;
      document.getElementById('ev-location').value = ev?.location || H.DEFAULTS.location;
      document.getElementById('ev-badge').value = ev?.badge_variant || 'default';
      document.getElementById('ev-highlight').checked = !!ev?.is_highlight;
      document.getElementById('ev-sort').value = ev?.sort_order ?? 0;
      if (document.getElementById('ev-future')) {
        document.getElementById('ev-future').checked = ev?.month_key === 'futuros';
      }
      document.getElementById('form-title').textContent = ev ? 'Editar evento' : 'Novo evento';
    }

    async function removeEvent(id) {
      if (!confirm('Excluir este evento?')) return;
      const { error } = await client.from('agenda_events').delete().eq('id', id);
      if (error) showToast(toast, error.message, true);
      else { showToast(toast, 'Evento excluído.'); await reload(); }
    }

    document.getElementById('btn-new').addEventListener('click', () => openForm(null));
    document.getElementById('btn-cancel').addEventListener('click', () => document.getElementById('event-form').classList.add('hidden'));
    document.getElementById('ev-event-date').addEventListener('change', syncDerivedFields);
    document.getElementById('ev-future')?.addEventListener('change', syncDerivedFields);

    document.getElementById('event-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      syncDerivedFields();
      const id = document.getElementById('ev-id').value;
      const payload = {
        title: document.getElementById('ev-title').value.trim(),
        description: document.getElementById('ev-description').value.trim() || null,
        category: document.getElementById('ev-category').value.trim(),
        date_display: document.getElementById('ev-date-display').value.trim(),
        date_label: document.getElementById('ev-date-label').value.trim(),
        event_date: document.getElementById('ev-event-date').value || null,
        month_key: document.getElementById('ev-month-key').value.trim(),
        month_label: document.getElementById('ev-month-label').value.trim(),
        event_time: document.getElementById('ev-time').value.trim() || null,
        location: document.getElementById('ev-location').value.trim() || null,
        badge_variant: document.getElementById('ev-badge').value,
        is_highlight: document.getElementById('ev-highlight').checked,
        sort_order: parseInt(document.getElementById('ev-sort').value, 10) || 0,
        published: true
      };
      const q = id
        ? client.from('agenda_events').update(payload).eq('id', id)
        : client.from('agenda_events').insert(payload);
      const { error } = await q;
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, id ? 'Evento atualizado.' : 'Evento criado.');
        document.getElementById('event-form').classList.add('hidden');
        await reload();
      }
    });

    await reload();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
