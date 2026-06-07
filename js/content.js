(function () {
  const esc = (t) => String(t ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  async function getClient() {
    return window.JEAuth?.getClient?.();
  }

  async function fetchAgendaEvents() {
    const client = await getClient();
    if (!client) return null;
    const { data, error } = await client
      .from('agenda_events')
      .select('*')
      .eq('published', true)
      .order('event_date', { ascending: false });
    if (error || !data?.length) return null;
    return data;
  }

  function badgeClass(variant) {
    if (variant === 'primary') return 'je-ag-date--primary';
    if (variant === 'gold') return 'je-ag-date--gold';
    return 'je-ag-date--default';
  }

  function isLongDate(display) {
    return display && (display.includes('/') || display.includes('–') && display.length > 4);
  }

  function categoryClass(category) {
    return category === 'Reuniões' || category === 'Escola' ? 'je-ag-cat--meetings' : 'je-ag-cat--special';
  }

  function eventChip(ev) {
    const H = window.JEAgendaHelpers;
    if (H?.eventDateChip) return H.eventDateChip(ev);
    return { display: ev.date_display || '—', label: ev.date_label || '—' };
  }

  function renderEventRow(ev) {
    const chip = eventChip(ev);
    const longCls = isLongDate(chip.display) || isLongDate(chip.label) ? ' is-long' : '';
    const meta = [];
    if (ev.event_time) meta.push(`<span class="je-ag-meta-item"><span class="material-symbols-outlined">schedule</span>${esc(ev.event_time)}</span>`);
    if (ev.location) meta.push(`<span class="je-ag-meta-item"><span class="material-symbols-outlined">location_on</span>${esc(ev.location)}</span>`);
    return `
      <div class="je-ag-event">
        <div class="je-ag-date ${badgeClass(ev.badge_variant)}${longCls}">
          <span class="je-ag-date-num">${esc(chip.display)}</span>
          <span class="je-ag-date-lbl">${esc(chip.label)}</span>
        </div>
        <div class="je-ag-event-body">
          <span class="je-ag-cat ${categoryClass(ev.category)}">${esc(ev.category)}</span>
          <h3 class="je-ag-event-title">${esc(ev.title)}</h3>
          ${ev.description ? `<p class="je-ag-event-desc">${esc(ev.description)}</p>` : ''}
          ${meta.length ? `<div class="je-ag-event-meta">${meta.join('')}</div>` : ''}
        </div>
      </div>`;
  }

  function groupAgendaByMonth(events) {
    const groups = new Map();
    events.forEach((ev) => {
      const key = ev.month_key || 'outros';
      if (!groups.has(key)) groups.set(key, { label: ev.month_label, events: [] });
      groups.get(key).events.push(ev);
    });
    groups.forEach((g) => g.events.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    const order = ['2026-04', '2026-03', '2026-02', '2026-01', 'futuros'];
    const sorted = [];
    order.forEach((k) => { if (groups.has(k)) sorted.push([k, groups.get(k)]); });
    groups.forEach((v, k) => { if (!order.includes(k)) sorted.push([k, v]); });
    return sorted;
  }

  function renderAgendaMonths(events, openFirst) {
    const groups = groupAgendaByMonth(events);
    return groups.map(([key, group], idx) => {
      const dotGold = key === 'futuros' ? ' je-ag-month-dot--gold' : '';
      const openCls = openFirst && idx === 0 ? ' open' : '';
      return `
        <div class="je-ag-month${openCls}">
          <button type="button" class="je-ag-month-head" onclick="toggleMonth(this)" aria-expanded="${openFirst && idx === 0 ? 'true' : 'false'}">
            <span class="je-ag-month-head-left">
              <span class="je-ag-month-dot${dotGold}" aria-hidden="true"></span>
              <span class="je-ag-month-label">${esc(group.label)}</span>
              <span class="je-ag-month-count">${group.events.length} evento${group.events.length === 1 ? '' : 's'}</span>
            </span>
            <span class="material-symbols-outlined je-ag-month-chevron">expand_more</span>
          </button>
          <div class="je-ag-month-body">
            ${group.events.map(renderEventRow).join('')}
          </div>
        </div>`;
    }).join('');
  }

  function renderHighlights(events) {
    const highlights = events.filter((e) => e.is_highlight).slice(0, 6);
    if (!highlights.length) return '';
    return highlights.map((ev) => {
      const d = ev.event_date ? new Date(ev.event_date + 'T12:00:00') : null;
      const dateStr = d
        ? `${String(d.getDate()).padStart(2, '0')} ${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][d.getMonth()]} ${d.getFullYear()}`
        : `${ev.date_display} ${ev.date_label}`;
      return `
        <div class="je-ag-highlight">
          <span class="je-ag-highlight-dot" aria-hidden="true"></span>
          <div>
            <div class="je-ag-highlight-date">${esc(dateStr)}</div>
            <div class="je-ag-highlight-title">${esc(ev.title)}</div>
          </div>
        </div>`;
    }).join('');
  }

  function initAgendaPage() {
    const search = document.getElementById('je-ag-search');
    const clearBtn = document.getElementById('je-ag-search-clear');
    const countEl = document.getElementById('je-ag-count');
    const emptyEl = document.getElementById('je-ag-empty');
    const root = document.getElementById('je-agenda-months');
    if (!search || !root) return;

    function events() {
      return [...root.querySelectorAll('.je-ag-event')];
    }

    function updateClearBtn() {
      clearBtn?.classList.toggle('hidden', !(search?.value || '').trim());
    }

    function formatCount(visible, total) {
      if (visible === total) {
        return total === 1 ? '1 evento' : `${total} eventos`;
      }
      return visible === 1 ? `1 de ${total}` : `${visible} de ${total}`;
    }

    function applySearch() {
      const query = (search?.value || '').trim().toLowerCase();
      const total = events().length;
      let visible = 0;
      root.querySelectorAll('.je-ag-month').forEach((month) => {
        let monthVisible = 0;
        month.querySelectorAll('.je-ag-event').forEach((row) => {
          const show = !query || row.textContent.toLowerCase().includes(query);
          row.classList.toggle('is-hidden', !show);
          if (show) {
            visible += 1;
            monthVisible += 1;
          }
        });
        month.classList.toggle('is-filtered-empty', monthVisible === 0 && !!query);
        if (query && monthVisible > 0) month.classList.add('open');
      });
      if (countEl) countEl.textContent = formatCount(visible, total);
      emptyEl?.classList.toggle('is-visible', visible === 0 && !!query);
      updateClearBtn();
    }

    search.addEventListener('input', applySearch);
    clearBtn?.addEventListener('click', () => {
      search.value = '';
      applySearch();
      search.focus();
    });

    applySearch();
    window.JEAgendaRefresh = applySearch;
  }

  async function loadAgenda() {
    const root = document.getElementById('je-agenda-months');
    const highlightsEl = document.getElementById('je-agenda-highlights');
    if (!root) return;
    const events = await fetchAgendaEvents();
    if (!events) return;
    root.innerHTML = renderAgendaMonths(events, true);
    if (highlightsEl) highlightsEl.innerHTML = renderHighlights(events);
    if (window.JEAgendaRefresh) window.JEAgendaRefresh();
  }

  async function fetchAnnouncements() {
    const client = await getClient();
    if (!client) return null;
    const [{ data: sections }, { data: settings }] = await Promise.all([
      client.from('announcement_sections')
        .select('slug, title, description, document_url, icon, category_tag, sort_order')
        .eq('published', true)
        .order('sort_order'),
      client.from('announcement_settings')
        .select('history_folder_url, history_description')
        .eq('id', 1)
        .maybeSingle()
    ]);
    if (!sections?.length) return null;
    return { sections, settings };
  }

  function announcementCardModifier(slug) {
    if (slug === 'designacoes-mecanicas') return 'org';
    if (slug === 'meio-de-semana') return 'midweek';
    if (slug === 'final-de-semana') return 'weekend';
    return 'default';
  }

  function renderAnnouncementCard(s) {
    const mod = announcementCardModifier(s.slug);
    return `
      <a href="${esc(s.document_url)}" target="_blank" rel="noopener"
         class="je-qa-card je-qa-card--${mod} group">
        <div class="je-qa-card-top">
          <div class="je-qa-card-icon">
            <span class="material-symbols-outlined">${esc(s.icon || 'description')}</span>
          </div>
          <span class="je-qa-card-tag">${esc(s.category_tag)}</span>
        </div>
        <div>
          <h2 class="je-qa-card-title">${esc(s.title)}</h2>
          ${s.description ? `<p class="je-qa-card-desc">${esc(s.description)}</p>` : ''}
        </div>
        <span class="je-qa-card-cta">
          Abrir PDF
          <span class="material-symbols-outlined" style="font-size:16px">open_in_new</span>
        </span>
      </a>`;
  }

  async function loadAnnouncements() {
    const cardsEl = document.getElementById('je-announcement-cards');
    const historyEl = document.getElementById('je-announcement-history');
    if (!cardsEl) return;
    const data = await fetchAnnouncements();
    if (!data) return;
    cardsEl.innerHTML = data.sections.map(renderAnnouncementCard).join('');
    if (historyEl && data.settings?.history_folder_url) {
      historyEl.href = data.settings.history_folder_url;
      if (data.settings.history_description) {
        const desc = document.querySelector('[data-je-history-desc]');
        if (desc) desc.textContent = data.settings.history_description;
      }
    }
  }

  async function fetchTerritories() {
    const client = await getClient();
    if (!client) return null;
    const { data, error } = await client.from('territories').select('*').order('sort_order');
    if (error || !data?.length) return null;
    return data;
  }

  function initTerritoriesPage() {
    const grid = document.getElementById('cardsGrid');
    if (!grid) return;

    const search = document.getElementById('je-ter-search');
    const clearBtn = document.getElementById('je-ter-search-clear');
    const countEl = document.getElementById('je-ter-count');
    const emptyEl = document.getElementById('je-ter-empty');
    const lightbox = document.getElementById('je-ter-lightbox');
    const lightboxImg = document.getElementById('je-ter-lightbox-img');
    const lightboxTitle = document.getElementById('je-ter-lightbox-title');
    const lightboxClose = document.getElementById('je-ter-lightbox-close');

    function cards() {
      return [...grid.querySelectorAll('.territory-card')];
    }

    const total = cards().length;

    function updateClearBtn() {
      clearBtn?.classList.toggle('hidden', !(search?.value || '').trim());
    }

    function formatCount(visible) {
      if (visible === total) {
        return total === 1 ? '1 território' : `${total} territórios`;
      }
      return visible === 1 ? '1 de ' + total : `${visible} de ${total}`;
    }

    function applySearch() {
      const query = (search?.value || '').trim().toLowerCase();
      let visible = 0;
      cards().forEach((card) => {
        const nome = (card.dataset.nome || '').toLowerCase();
        const num = (card.dataset.num || '').toLowerCase();
        const title = (card.querySelector('.je-ter-card-title')?.textContent || '').toLowerCase();
        const show = !query || nome.includes(query) || num.includes(query) || title.includes(query);
        card.classList.toggle('is-hidden', !show);
        if (show) visible += 1;
      });
      if (countEl) countEl.textContent = formatCount(visible);
      emptyEl?.classList.toggle('is-visible', visible === 0);
      updateClearBtn();
    }

    search?.addEventListener('input', applySearch);
    clearBtn?.addEventListener('click', () => {
      if (!search) return;
      search.value = '';
      applySearch();
      search.focus();
    });

    function openLightbox(img, title) {
      if (!lightbox || !lightboxImg || !lightboxTitle) return;
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightboxTitle.textContent = title;
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      if (!lightbox) return;
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-je-map-open]');
      if (!btn) return;
      const card = btn.closest('.territory-card');
      const img = btn.querySelector('img');
      const title = card?.querySelector('.je-ter-card-title')?.textContent || 'Território';
      if (img) openLightbox(img, title);
    });

    lightboxClose?.addEventListener('click', closeLightbox);
    lightbox?.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox?.classList.contains('is-open')) closeLightbox();
    });

    applySearch();
    window.JETerritoriesRefresh = applySearch;
  }

  async function loadTerritories() {
    const items = await fetchTerritories();
    if (!items) return;
    items.forEach((t) => {
      const card = document.querySelector(`.territory-card[data-num="${t.num}"], article[data-num="${t.num}"]`);
      if (!card) return;
      if (t.display_name) {
        const titleEl = card.querySelector('.je-ter-card-title, h3');
        if (titleEl) titleEl.textContent = t.display_name;
      }
      if (t.map_image_url || t.num) {
        const img = card.querySelector('img');
        if (img) {
          const src = window.JETerritoryAssignment?.resolveTerritoryMapUrl(t.map_image_url, t.num);
          if (src) {
            img.src = src;
            img.alt = `Mapa Território ${t.num} – ${t.display_name || card.querySelector('.je-ter-card-title, h3')?.textContent || 'Território'}`;
          }
        }
      }
      if (t.slug) card.dataset.nome = t.slug;
    });
    if (window.JETerritoriesRefresh) window.JETerritoriesRefresh();
  }

  async function loadProximosEventos() {
    const lista = document.getElementById('proxeventos-lista');
    const mesEl = document.getElementById('proxeventos-mes');
    if (!lista) return;

    const events = await fetchAgendaEvents();
    if (!events?.length) return;

    const groups = groupAgendaByMonth(events);
    const firstGroup = groups[0]?.[1];
    if (!firstGroup) return;

    if (mesEl) mesEl.textContent = '— ' + firstGroup.label;

    const variantStyle = {
      gold: { bg: 'rgba(200,169,110,0.12)', border: '1px solid #c8a96e', numColor: '#8a6a2a', lblColor: '#a07c35' },
      primary: { bg: '#0f3462', border: 'none', numColor: '#ffffff', lblColor: 'rgba(255,255,255,0.7)' },
      default: { bg: '#f5f3f3', border: '1px solid #c3c6d0', numColor: '#0f3462', lblColor: '#3b5e97' }
    };

    lista.innerHTML = firstGroup.events.map((ev) => {
      const chip = eventChip(ev);
      const vs = variantStyle[ev.badge_variant] || variantStyle.default;
      const isLong = isLongDate(chip.display) || isLongDate(chip.label);
      const numSize = isLong ? '0.625rem' : '0.8125rem';
      const extras = [ev.event_time, ev.location].filter(Boolean).join(' · ');
      const catCls = ev.category === 'Reuniões' || ev.category === 'Escola'
        ? 'color:#274d85;background:#d6e3ff80'
        : 'color:#7a5200;background:rgba(200,169,110,0.15)';
      return `
        <div class="flex gap-4 px-5 py-4 hover:bg-surface-container-low transition-colors">
          <div style="flex-shrink:0;width:3rem;text-align:center;border-radius:0.5rem;padding:0.5rem 0.25rem;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:${vs.bg};border:${vs.border}">
            <span style="font-size:${numSize};font-weight:800;line-height:1.2;color:${vs.numColor}">${esc(chip.display)}</span>
            <span style="font-size:0.5625rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${vs.lblColor}">${esc(chip.label)}</span>
          </div>
          <div style="flex:1;min-width:0">
            <span class="je-home-ev-cat" style="display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;${catCls};padding:1px 6px;border-radius:4px;margin-bottom:4px">${esc(ev.category)}</span>
            <h3 style="font-weight:700;font-size:0.875rem;color:#1b1c1c;line-height:1.4">${esc(ev.title)}</h3>
            ${ev.description ? `<p style="font-size:0.75rem;color:#43474f;margin-top:2px">${esc(ev.description)}</p>` : ''}
            ${extras ? `<p style="font-size:0.75rem;color:#43474f;margin-top:4px">${esc(extras)}</p>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  async function fetchDonations() {
    const client = await getClient();
    if (!client) return null;
    const { data } = await client.from('site_settings').select('value').eq('key', 'donations').maybeSingle();
    return data?.value || null;
  }

  async function loadDonations() {
    const root = document.getElementById('je-donations-root');
    if (!root) return;
    const d = await fetchDonations();
    if (!d) return;
    const pixEl = root.querySelector('[data-je-pix-key]');
    const holderEl = root.querySelector('[data-je-pix-holder]');
    const typeEl = root.querySelector('[data-je-pix-type]');
    const qrEl = root.querySelector('[data-je-qr]');
    const disclaimerEl = root.querySelector('[data-je-disclaimer]');
    const subtitleEl = root.querySelector('[data-je-subtitle]');
    if (pixEl) pixEl.textContent = d.pix_key || '';
    if (typeEl) typeEl.textContent = `Chave PIX — ${d.pix_key_type || 'E-mail'}`;
    if (holderEl) holderEl.textContent = `${d.account_holder || ''}${d.bank ? ' · ' + d.bank : ''}`;
    if (qrEl && d.qr_image_url) qrEl.src = d.qr_image_url;
    if (disclaimerEl && d.disclaimer) disclaimerEl.innerHTML = d.disclaimer.replace(/voluntárias/i, '<strong class="text-primary">voluntárias</strong>');
    if (subtitleEl && d.account_holder) subtitleEl.textContent = `Em nome do Irmão ${d.account_holder.split(' ').slice(-1)[0] === 'Almeida' ? d.account_holder : d.account_holder}`;
  }

  async function fetchEquipment(slugPrefix) {
    const client = await getClient();
    if (!client) return null;
    let q = client.from('equipment_schedules').select('*').eq('published', true).order('sort_order');
    if (slugPrefix) q = q.like('slug', slugPrefix + '%');
    const { data, error } = await q;
    if (error || !data?.length) return null;
    return data;
  }

  function renderEquipmentCalendar(item, variant) {
    const icon = variant === 'display' ? 'grid_view' : 'shopping_cart';
    const title = item.title || 'Agendamento';
    return `
      <article class="je-eq-cal-card">
        <header class="je-eq-cal-head">
          <span class="material-symbols-outlined">${icon}</span>
          <h2>${esc(title)}</h2>
        </header>
        <div class="je-eq-cal-frame">
          <iframe class="je-cal-iframe" src="${esc(item.calendar_embed_url)}" title="${esc(title)}"></iframe>
        </div>
      </article>`;
  }

  async function loadEquipmentCalendars(containerId, slugPrefix) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const items = await fetchEquipment(slugPrefix);
    if (!items) return;
    const variant = slugPrefix === 'display' ? 'display' : 'carrinho';
    el.innerHTML = items.map((item) => renderEquipmentCalendar(item, variant)).join('');
  }

  function boot() {
    initTerritoriesPage();
    initAgendaPage();
    const run = () => {
      loadAgenda();
      loadAnnouncements();
      loadTerritories();
      loadDonations();
      loadEquipmentCalendars('je-carrinhos-calendars', 'carrinho');
      loadEquipmentCalendars('je-displays-calendars', 'display');
      loadProximosEventos();
    };
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 2000 });
    else setTimeout(run, 100);
  }

  window.JEContent = {
    fetchAgendaEvents,
    fetchAnnouncements,
    fetchTerritories,
    fetchDonations,
    fetchEquipment,
    loadAgenda,
    boot
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
