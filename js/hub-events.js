(function () {
  const H = window.JEAgendaHelpers;
  const esc = (t) => String(t ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function showToast(el, message, isError) {
    if (el) el.classList.add('hidden');
    if (window.JEToast?.show) {
      window.JEToast.show(message, { error: !!isError });
      return;
    }
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
    const modal = $('hub-event-modal');
    const toast = $('hub-events-toast');
    if (!list || !form || !modal || !client) return;

    let events = [];

    function getCategory() {
      const checked = form.querySelector('input[name="hub-ev-category"]:checked');
      return checked?.value || 'Especial';
    }

    function setCategory(value) {
      const cat = value || 'Especial';
      form.querySelectorAll('input[name="hub-ev-category"]').forEach((input) => {
        input.checked = input.value === cat;
      });
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

    function updatePreview() {
      syncDerivedFields();
      const title = $('hub-ev-title').value.trim() || 'Nome do evento';
      const category = getCategory();
      const time = $('hub-ev-time').value.trim();
      const future = $('hub-ev-future').checked;
      const highlight = $('hub-ev-highlight').checked;

      $('hub-ev-preview-title').textContent = title;
      $('hub-ev-preview-cat').textContent = category;
      $('hub-ev-preview-cat').className = `inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded mb-1 ${H.categoryBadgeClass(category)}`;

      const day = $('hub-ev-date-display').value || '—';
      const label = $('hub-ev-date-label').value || '—';
      const month = $('hub-ev-month-label').value || '—';

      $('hub-ev-preview-day').textContent = day;
      $('hub-ev-preview-label-d').textContent = label;

      let meta;
      if (future) {
        meta = evDateLabel() || 'Eventos futuros';
      } else {
        meta = month;
      }
      if (time) meta += ` · ${time}`;
      if (highlight) meta += ' · Destaque';
      $('hub-ev-preview-meta').textContent = meta;
    }

    function evDateLabel() {
      const iso = $('hub-ev-date').value;
      if (!iso) return '';
      const derived = H.deriveFieldsFromDate(iso, { futureGroup: $('hub-ev-future').checked });
      if (!derived) return '';
      if ($('hub-ev-future').checked) {
        const d = new Date(iso + 'T12:00:00');
        return `${d.getDate()} de ${H.MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`;
      }
      return derived.month_label;
    }

    async function repairBrokenFutureLabels() {
      const broken = events.filter((ev) => H.needsFutureLabelRepair(ev));
      if (!broken.length) return false;
      for (const ev of broken) {
        const derived = H.deriveFieldsFromDate(ev.event_date, { futureGroup: true });
        if (!derived) continue;
        await client.from('agenda_events').update({
          date_display: derived.date_display,
          date_label: derived.date_label
        }).eq('id', ev.id);
      }
      return true;
    }

    async function reload() {
      const { data, error } = await client
        .from('agenda_events')
        .select('*')
        .order('event_date', { ascending: false });
      if (error) {
        list.innerHTML = `<p class="px-4 py-6 text-sm text-error">${esc(error.message)}</p>`;
        return;
      }
      events = data || [];
      if (await repairBrokenFutureLabels()) {
        const { data: refreshed } = await client
          .from('agenda_events')
          .select('*')
          .order('event_date', { ascending: false });
        events = refreshed || [];
      }
      renderList();
      renderTemplateSelect();
    }

    function updateEventsCount() {
      const countEl = $('hub-events-count');
      if (!countEl) return;
      const n = events.length;
      countEl.textContent = n === 1 ? '1 evento publicado' : `${n} eventos publicados`;
    }

    function renderList() {
      updateEventsCount();
      if (!events.length) {
        list.innerHTML = '<p class="px-5 py-8 text-sm text-on-surface-variant">Nenhum evento cadastrado. Use <strong>Novo evento</strong> para começar.</p>';
        return;
      }
      list.innerHTML = events.map((ev) => {
        const chip = H.eventDateChip(ev);
        const tags = [];
        if (ev.month_key === 'futuros') tags.push('<span class="hub-ev-tag hub-ev-tag--future">Futuro</span>');
        if (ev.is_highlight) tags.push('<span class="hub-ev-tag hub-ev-tag--highlight">Destaque</span>');
        return `
        <div class="hub-ev-row">
          <div class="hub-ev-row-main">
            <div class="hub-ev-row-date">
              <p class="hub-ev-row-date-num">${esc(chip.display)}</p>
              <p class="hub-ev-row-date-lbl">${esc(chip.label)}</p>
            </div>
            <div class="hub-ev-row-body">
              <span class="hub-ev-cat-badge ${H.categoryBadgeClass(ev.category)}">${esc(ev.category)}</span>
              <p class="hub-ev-row-title">${esc(ev.title)}</p>
              <p class="hub-ev-row-meta">${esc(H.formatAdminListMeta(ev))}</p>
              ${tags.length ? `<div class="hub-ev-row-tags">${tags.join('')}</div>` : ''}
            </div>
          </div>
          <div class="hub-ev-row-actions">
            <button type="button" data-copy="${ev.id}" class="hub-ev-action hub-ev-action--copy">Copiar</button>
            <button type="button" data-edit="${ev.id}" class="hub-ev-action hub-ev-action--edit">Editar</button>
            <button type="button" data-del="${ev.id}" class="hub-ev-action hub-ev-action--del">Excluir</button>
          </div>
        </div>`;
      }).join('');

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
      sel.innerHTML = '<option value="">— Nenhum —</option>'
        + events.map((ev) => `<option value="${ev.id}">${esc(ev.title)} (${esc(ev.month_label)})</option>`).join('');
      if (current && events.some((e) => e.id === current)) sel.value = current;
    }

    function openForm(ev, templateEv) {
      const base = ev || (templateEv ? { ...templateEv, id: null, title: '' } : null);
      const tpl = templateEv && !ev ? H.templateFromEvent(templateEv) : null;

      $('hub-ev-id').value = ev?.id || '';
      $('hub-ev-title').value = base?.title || '';
      $('hub-ev-description').value = base?.description || '';
      setCategory(base?.category || tpl?.category || 'Especial');
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

      $('hub-event-form-title').textContent = ev ? 'Editar evento' : (templateEv ? 'Novo evento (copiado)' : 'Novo evento');
      updatePreview();
      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
      $('hub-ev-title')?.focus();
    }

    function closeForm() {
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
      $('hub-ev-template').value = '';
    }

    async function removeEvent(id) {
      if (!await window.JEDialog.confirm({
        title: 'Excluir evento',
        message: 'Excluir este evento?',
        confirmLabel: 'Excluir',
        danger: true
      })) return;
      const { error } = await client.from('agenda_events').delete().eq('id', id);
      if (error) showToast(toast, error.message, true);
      else { showToast(toast, 'Evento excluído.'); await reload(); }
    }

    $('hub-btn-new-event')?.addEventListener('click', () => openForm(null));
    $('hub-btn-cancel-event')?.addEventListener('click', closeForm);
    $('hub-event-modal-close')?.addEventListener('click', closeForm);
    $('hub-event-modal-backdrop')?.addEventListener('click', closeForm);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeForm();
    });
    $('hub-ev-date')?.addEventListener('change', updatePreview);
    $('hub-ev-future')?.addEventListener('change', updatePreview);
    $('hub-ev-title')?.addEventListener('input', updatePreview);
    $('hub-ev-time')?.addEventListener('input', updatePreview);
    $('hub-ev-highlight')?.addEventListener('change', updatePreview);
    form.querySelectorAll('input[name="hub-ev-category"]').forEach((input) => {
      input.addEventListener('change', updatePreview);
    });
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
        category: getCategory(),
        event_date: $('hub-ev-date').value || null,
        date_display: $('hub-ev-date-display').value.trim(),
        date_label: $('hub-ev-date-label').value.trim(),
        month_key: $('hub-ev-month-key').value.trim(),
        month_label: $('hub-ev-month-label').value.trim(),
        event_time: $('hub-ev-time').value.trim() || null,
        location: $('hub-ev-location').value.trim() || null,
        badge_variant: $('hub-ev-badge').value || 'default',
        is_highlight: $('hub-ev-highlight').checked,
        sort_order: parseInt($('hub-ev-sort').value, 10) || 0,
        published: true
      };
      if (!payload.title || !payload.event_date) {
        showToast(toast, 'Preencha o nome e a data do evento.', true);
        return;
      }
      const q = id
        ? client.from('agenda_events').update(payload).eq('id', id)
        : client.from('agenda_events').insert(payload);
      const { error } = await q;
      if (error) showToast(toast, error.message, true);
      else {
        showToast(toast, id ? 'Evento atualizado no site.' : 'Evento publicado no site.');
        closeForm();
        await reload();
      }
    });

    await reload();
  }

  window.JEHubEvents = { initHubEvents };
})();
