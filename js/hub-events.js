(function () {
  const H = window.JEAgendaHelpers;
  const esc = (t) => String(t ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function showToast(el, message, isError) {
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden', 'text-error', 'text-green-700');
    el.classList.add(isError ? 'text-error' : 'text-green-700');
    setTimeout(() => el.classList.add('hidden'), 3500);
  }

  function $(id) { return document.getElementById(id); }

  async function initHubEvents(client) {
    const list = $('hub-events-list');
    const form = $('hub-event-form');
    const toast = $('hub-events-toast');
    if (!list || !form || !client) return;

    let events = [];

    async function reload() {
      const { data, error } = await client
        .from('agenda_events')
        .select('*')
        .order('event_date', { ascending: false })
        .limit(20);
      if (error) {
        list.innerHTML = `<p class="px-4 py-6 text-sm text-error">${esc(error.message)}</p>`;
        return;
      }
      events = data || [];
      renderList();
      renderTemplateSelect();
    }

    function renderList() {
      if (!events.length) {
        list.innerHTML = '<p class="px-4 py-6 text-sm text-on-surface-variant">Nenhum evento cadastrado.</p>';
        return;
      }
      list.innerHTML = events.map((ev) => `
        <div class="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-outline-variant last:border-0">
          <div class="flex items-start gap-3 flex-1 min-w-0">
            <div class="text-center shrink-0 w-12">
              <p class="text-lg font-extrabold text-primary leading-none">${esc(ev.date_display)}</p>
              <p class="text-[10px] font-bold text-on-surface-variant uppercase">${esc(ev.date_label)}</p>
            </div>
            <div class="min-w-0">
              <span class="inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded mb-1 ${H.categoryBadgeClass(ev.category)}">${esc(ev.category)}</span>
              <p class="font-bold text-primary text-sm truncate">${esc(ev.title)}</p>
              <p class="text-xs text-on-surface-variant">${esc(ev.month_label)}${ev.event_time ? ` · ${esc(ev.event_time)}` : ''}${ev.is_highlight ? ' · ★ destaque' : ''}</p>
            </div>
          </div>
          <div class="flex gap-2 shrink-0">
            <button type="button" data-copy="${ev.id}" class="text-xs font-semibold text-on-surface-variant hover:underline">Copiar</button>
            <button type="button" data-edit="${ev.id}" class="text-xs font-semibold text-secondary hover:underline">Editar</button>
            <button type="button" data-del="${ev.id}" class="text-xs font-semibold text-error hover:underline">Excluir</button>
          </div>
        </div>`).join('');

      list.querySelectorAll('[data-edit]').forEach((btn) => {
        btn.addEventListener('click', () => openForm(events.find((e) => e.id === btn.dataset.edit)));
      });
      list.querySelectorAll('[data-copy]').forEach((btn) => {
        btn.addEventListener('click', () => openForm(null, events.find((e) => e.id === btn.dataset.copy)));
      });
      list.querySelectorAll('[data-del]').forEach((btn) => {
        btn.addEventListener('click', () => removeEvent(btn.dataset.del));
      });
    }

    function renderTemplateSelect() {
      const sel = $('hub-ev-template');
      if (!sel) return;
      const current = sel.value;
      sel.innerHTML = '<option value="">— Escolher evento existente como modelo —</option>'
        + events.map((ev) => `<option value="${ev.id}">${esc(ev.title)} (${esc(ev.month_label)})</option>`).join('');
      if (current && events.some((e) => e.id === current)) sel.value = current;
    }

    function syncDerivedFields() {
      const iso = $('hub-ev-date').value;
      const future = $('hub-ev-future').checked;
      const derived = H.deriveFieldsFromDate(iso, { futureGroup: future });
      if (!derived) return;
      $('hub-ev-date-display').value = derived.date_display;
      $('hub-ev-date-label').value = derived.date_label;
      $('hub-ev-month-key').value = derived.month_key;
      $('hub-ev-month-label').value = derived.month_label;
    }

    function openForm(ev, templateEv) {
      form.classList.remove('hidden');
      const base = ev || (templateEv ? { ...templateEv, id: null, title: '' } : null);
      const tpl = templateEv && !ev ? H.templateFromEvent(templateEv) : null;

      $('hub-ev-id').value = ev?.id || '';
      $('hub-ev-title').value = base?.title || '';
      $('hub-ev-description').value = base?.description || '';
      $('hub-ev-category').value = base?.category || tpl?.category || 'Especial';
      $('hub-ev-date').value = base?.event_date || '';
      $('hub-ev-future').checked = base?.month_key === 'futuros' || !!tpl?.futureGroup;
      $('hub-ev-time').value = base?.event_time ?? tpl?.event_time ?? H.DEFAULTS.event_time;
      $('hub-ev-location').value = base?.location ?? tpl?.location ?? H.DEFAULTS.location;
      $('hub-ev-badge').value = base?.badge_variant || tpl?.badge_variant || 'default';
      $('hub-ev-highlight').checked = !!(base?.is_highlight ?? tpl?.is_highlight);
      $('hub-ev-sort').value = base?.sort_order ?? tpl?.sort_order ?? 0;

      if (base?.event_date) syncDerivedFields();
      else if (base?.date_display) {
        $('hub-ev-date-display').value = base.date_display;
        $('hub-ev-date-label').value = base.date_label;
        $('hub-ev-month-key').value = base.month_key;
        $('hub-ev-month-label').value = base.month_label;
      }

      $('hub-event-form-title').textContent = ev ? 'Editar evento' : (templateEv ? 'Novo evento (a partir de modelo)' : 'Novo evento');
      form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function closeForm() {
      form.classList.add('hidden');
      $('hub-ev-template').value = '';
    }

    async function removeEvent(id) {
      if (!confirm('Excluir este evento?')) return;
      const { error } = await client.from('agenda_events').delete().eq('id', id);
      if (error) showToast(toast, error.message, true);
      else { showToast(toast, 'Evento excluído.'); await reload(); }
    }

    $('hub-btn-new-event')?.addEventListener('click', () => openForm(null));
    $('hub-btn-cancel-event')?.addEventListener('click', closeForm);
    $('hub-ev-date')?.addEventListener('change', syncDerivedFields);
    $('hub-ev-future')?.addEventListener('change', syncDerivedFields);
    $('hub-ev-template')?.addEventListener('change', (e) => {
      const ev = events.find((x) => x.id === e.target.value);
      if (ev) openForm(null, ev);
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      syncDerivedFields();
      const id = $('hub-ev-id').value;
      const payload = {
        title: $('hub-ev-title').value.trim(),
        description: $('hub-ev-description').value.trim() || null,
        category: $('hub-ev-category').value,
        event_date: $('hub-ev-date').value || null,
        date_display: $('hub-ev-date-display').value.trim(),
        date_label: $('hub-ev-date-label').value.trim(),
        month_key: $('hub-ev-month-key').value.trim(),
        month_label: $('hub-ev-month-label').value.trim(),
        event_time: $('hub-ev-time').value.trim() || null,
        location: $('hub-ev-location').value.trim() || null,
        badge_variant: $('hub-ev-badge').value,
        is_highlight: $('hub-ev-highlight').checked,
        sort_order: parseInt($('hub-ev-sort').value, 10) || 0,
        published: true
      };
      if (!payload.title || !payload.event_date) {
        showToast(toast, 'Preencha título e data.', true);
        return;
      }
      const q = id
        ? client.from('agenda_events').update(payload).eq('id', id)
        : client.from('agenda_events').insert(payload);
      const { error } = await q;
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, id ? 'Evento atualizado.' : 'Evento publicado no site.');
        closeForm();
        await reload();
      }
    });

    await reload();
  }

  window.JEHubEvents = { initHubEvents };
})();
