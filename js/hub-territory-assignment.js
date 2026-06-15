(function () {
  const H = window.JETerritoryAssignment;
  let mapLightboxReady = false;

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function territoryTitle(t) {
    return `T${t.num} · ${t.display_name || 'Território'}`;
  }

  function territoryPageUrl(t) {
    const num = String(t?.num ?? '').replace(/^0+/, '') || '';
    return num ? `territorios.html#t${encodeURIComponent(num)}` : 'territorios.html';
  }

  function renderMapLink(mapUrl, title) {
    if (!mapUrl) return '';
    return `
      <button type="button" class="hub-terr-link" data-hub-terr-map="${escapeHtml(mapUrl)}" data-hub-terr-title="${escapeHtml(title)}">
        Ver mapa
        <span class="material-symbols-outlined" aria-hidden="true">map</span>
      </button>`;
  }

  function renderMapThumb(mapUrl, title) {
    if (!mapUrl) return '';
    return `
      <button type="button" class="hub-terr-map" data-hub-terr-map="${escapeHtml(mapUrl)}" data-hub-terr-title="${escapeHtml(title)}" aria-label="Ver mapa · ${escapeHtml(title)}">
        <img src="${escapeHtml(mapUrl)}" alt="" loading="lazy"/>
      </button>`;
  }

  function openHubTerritoryMapLightbox(title, mapUrl) {
    const box = document.getElementById('hub-terr-map-lightbox');
    const img = document.getElementById('hub-terr-map-lightbox-img');
    const titleEl = document.getElementById('hub-terr-map-lightbox-title');
    const body = box?.querySelector('.hub-terr-map-lightbox__body');
    if (!box || !img || !mapUrl) return;
    titleEl.textContent = title || 'Território';
    img.classList.remove('hidden');
    img.src = mapUrl;
    img.alt = title || 'Mapa do território';
    body?.querySelector('.hub-terr-map-lightbox__fallback')?.remove();
    img.onerror = () => {
      img.classList.add('hidden');
      if (body && !body.querySelector('.hub-terr-map-lightbox__fallback')) {
        const msg = document.createElement('p');
        msg.className = 'hub-terr-map-lightbox__fallback';
        msg.textContent = 'Mapa não encontrado.';
        body.appendChild(msg);
      }
    };
    box.classList.add('is-open');
    box.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeHubTerritoryMapLightbox() {
    const box = document.getElementById('hub-terr-map-lightbox');
    const img = document.getElementById('hub-terr-map-lightbox-img');
    if (!box) return;
    box.classList.remove('is-open');
    box.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (img) {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      img.alt = '';
      img.classList.remove('hidden');
    }
    box.querySelector('.hub-terr-map-lightbox__fallback')?.remove();
  }

  function setupHubTerritoryMapLightbox() {
    if (mapLightboxReady) return;
    mapLightboxReady = true;
    document.getElementById('hub-terr-map-lightbox-close')?.addEventListener('click', closeHubTerritoryMapLightbox);
    document.getElementById('hub-terr-map-lightbox')?.addEventListener('click', (e) => {
      if (e.target.id === 'hub-terr-map-lightbox') closeHubTerritoryMapLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('hub-terr-map-lightbox')?.classList.contains('is-open')) {
        closeHubTerritoryMapLightbox();
      }
    });
    document.getElementById('hub-territory-assignment-content')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-hub-terr-map]');
      if (!btn) return;
      openHubTerritoryMapLightbox(btn.dataset.hubTerrTitle, btn.dataset.hubTerrMap);
    });
  }

  function matchesDirigente(row, profileId, profileName) {
    if (row.profile_id === profileId) return true;
    if (!row.dirigente_name || !profileName) return false;
    const hay = row.dirigente_name.toLowerCase();
    const needle = profileName.toLowerCase();
    const first = needle.split(/\s+/)[0];
    return hay.includes(needle) || hay.includes(first);
  }

  function territoryKeyFromRow(row) {
    if (row?.territory_id) return `id:${row.territory_id}`;
    const t = row?.territories;
    if (t?.id) return `id:${t.id}`;
    if (t?.num != null) {
      const n = String(t.num).replace(/^0+/, '') || '0';
      return `num:${n}`;
    }
    return null;
  }

  function buildFieldMeta(a) {
    const parts = [];
    if (a.assigned_at) {
      parts.push(
        `<p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">assignment_ind</span>Designado em ${escapeHtml(H.formatDisplayDate(a.assigned_at))}</p>`
      );
    }
    const t = a.territories || {};
    if (t.last_worked_at) {
      parts.push(
        `<p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">history</span>Último trabalho em ${escapeHtml(H.formatDisplayDate(t.last_worked_at))}</p>`
      );
    }
    return parts.join('');
  }

  function buildScheduleMeta(scheduleRows) {
    if (!scheduleRows.length) return '';
    const sameWeek = scheduleRows.every((r) => r.week_start === scheduleRows[0].week_start);
    const parts = [];
    if (sameWeek) {
      parts.push(
        `<p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">date_range</span>Semana de ${escapeHtml(H.formatWeekRange(scheduleRows[0].week_start))}</p>`
      );
    }
    scheduleRows.forEach((row) => {
      if (!sameWeek) {
        parts.push(
          `<p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">date_range</span>Semana de ${escapeHtml(H.formatWeekRange(row.week_start))}</p>`
        );
      }
      parts.push(
        `<p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">event</span>${escapeHtml(H.formatWeekday(row.work_date))}, ${escapeHtml(H.formatDisplayDate(row.work_date))}</p>`
      );
      if (row.schedule_times) {
        parts.push(
          `<p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>${escapeHtml(row.schedule_times)}</p>`
        );
      }
      if (row.location_name) {
        parts.push(
          `<p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">location_on</span>${escapeHtml(row.location_name)}</p>`
        );
      }
    });
    return parts.join('');
  }

  function renderMergedCard(fieldAssignment, scheduleRows) {
    const t = fieldAssignment.territories || scheduleRows[0]?.territories || {};
    const title = territoryTitle(t);
    const mapUrl = H.resolveTerritoryMapUrl(t.map_image_url, t.num) || '';
    const dayLabels = scheduleRows.map((r) => r.weekday_label).filter(Boolean);
    const kicker =
      dayLabels.length === 1
        ? `Seu território · ${dayLabels[0]}`
        : 'Seu território de campo';
    const notesBlocks = scheduleRows
      .filter((r) => r.observations)
      .map((r) => `<p class="hub-terr-notes">${escapeHtml(r.observations)}</p>`)
      .join('');
    const scheduleMeta = buildScheduleMeta(scheduleRows);
    const fieldMeta = buildFieldMeta(fieldAssignment);

    return `
      <article class="hub-terr-card hub-terr-card--merged">
        <div class="hub-terr-card-main">
          <p class="hub-terr-kicker">${escapeHtml(kicker)}</p>
          <h2 class="hub-terr-title">${escapeHtml(title)}</h2>
          <div class="hub-terr-details">
            ${scheduleMeta || fieldMeta}
            ${scheduleMeta && fieldMeta ? fieldMeta : ''}
          </div>
          ${notesBlocks}
          ${renderMapLink(mapUrl, title)}
        </div>
        ${renderMapThumb(mapUrl, title)}
      </article>`;
  }

  function renderFieldCard(a) {
    const t = a.territories || {};
    const title = territoryTitle(t);
    const mapUrl = H.resolveTerritoryMapUrl(t.map_image_url, t.num) || '';
    const fieldMeta = buildFieldMeta(a);
    return `
      <article class="hub-terr-card hub-terr-card--field">
        <div class="hub-terr-card-main">
          <p class="hub-terr-kicker">Seu território de campo</p>
          <h2 class="hub-terr-title">${escapeHtml(title)}</h2>
          ${fieldMeta ? `<div class="hub-terr-details">${fieldMeta}</div>` : ''}
          ${renderMapLink(mapUrl, title) || `<a href="${escapeHtml(territoryPageUrl(t))}" class="hub-terr-link">Ver território <span class="material-symbols-outlined" aria-hidden="true">open_in_new</span></a>`}
        </div>
        ${renderMapThumb(mapUrl, title)}
      </article>`;
  }

  function renderScheduleCard(row) {
    const t = row.territories || {};
    const title = t.num
      ? territoryTitle(t)
      : (row.territory_code || 'Cronograma da semana');
    const mapUrl = H.resolveTerritoryMapUrl(t.map_image_url, t.num) || '';
    const timeLine = row.schedule_times
      ? `<p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>${escapeHtml(row.schedule_times)}</p>`
      : '';
    const meetLine = row.location_name
      ? `<p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">location_on</span>${escapeHtml(row.location_name)}</p>`
      : '';
    const notesLine = row.observations
      ? `<p class="hub-terr-notes">${escapeHtml(row.observations)}</p>`
      : '';
    const mapTitle = t.num ? territoryTitle(t) : title;

    return `
      <article class="hub-terr-card hub-terr-card--schedule">
        <div class="hub-terr-card-main">
          <p class="hub-terr-kicker">${escapeHtml(row.weekday_label || 'Cronograma')}</p>
          <h2 class="hub-terr-title">${escapeHtml(title)}</h2>
          <div class="hub-terr-details">
            <p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">date_range</span>Semana de ${escapeHtml(H.formatWeekRange(row.week_start))}</p>
            <p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">event</span>${escapeHtml(H.formatWeekday(row.work_date))}, ${escapeHtml(H.formatDisplayDate(row.work_date))}</p>
            ${timeLine}
            ${meetLine}
          </div>
          ${notesLine}
          ${t.num ? renderMapLink(mapUrl, mapTitle) : ''}
        </div>
        ${t.num && mapUrl ? renderMapThumb(mapUrl, mapTitle) : ''}
      </article>`;
  }

  async function init(client, profile) {
    const section = document.getElementById('hub-territory-assignment');
    const content = document.getElementById('hub-territory-assignment-content');
    if (!section || !content || !client || !profile?.id || !H) return;

    setupHubTerritoryMapLightbox();

    const profileId = profile.id;
    const profileName = profile.full_name || '';
    const today = H.toISODate(new Date());
    const monday = H.toISODate(H.getMonday(new Date()));
    const cards = [];
    const mergedScheduleIds = new Set();

    const { data: fieldRows, error: fieldErr } = await client
      .from('territory_active_assignments')
      .select(`
        id, assigned_at,
        territories ( id, num, display_name, map_image_url, slug, last_worked_at )
      `)
      .eq('profile_id', profileId)
      .eq('status', 'active')
      .limit(1);

    if (fieldErr) console.warn('Hub field assignment:', fieldErr.message);

    const fieldRow = fieldRows?.[0] || null;
    let scheduleRows = [];
    let scheduleRowsAllWeek = [];

    const { data: templateRows, error: schedErr } = await client
      .from('territory_week_schedule')
      .select(`
        id, weekday_label, dirigente_name, territory_code, location_name, schedule_times, observations,
        profile_id, territory_id,
        territories ( id, num, display_name, map_image_url, slug )
      `)
      .order('sort_order', { ascending: true });

    if (schedErr) console.warn('Hub schedule:', schedErr.message);
    else {
      const weekendByDate = await H.fetchWeekendAnnouncements(client, monday);
      scheduleRowsAllWeek = (templateRows || [])
        .map((row) => H.applyWeekendDirigente(row, monday, weekendByDate, []))
        .map((row) => H.applyDomingoFixedDirigentes([row])[0])
        .filter((row) => matchesDirigente(row, profileId, profileName))
        .map((row) => {
          const workDate = H.dateForWeekdayInWeek(monday, row.weekday_label);
          return { ...row, week_start: monday, work_date: workDate };
        })
        .filter((row) => row.work_date);
      scheduleRows = scheduleRowsAllWeek.filter((row) => row.work_date >= today);
    }

    if (fieldRow) {
      const fieldKey = territoryKeyFromRow(fieldRow);
      const matchingSchedules = scheduleRowsAllWeek.filter(
        (row) => territoryKeyFromRow(row) === fieldKey
      );
      if (matchingSchedules.length) {
        matchingSchedules.forEach((row) => mergedScheduleIds.add(row.id));
        cards.push(renderMergedCard(fieldRow, matchingSchedules));
      } else {
        cards.push(renderFieldCard(fieldRow));
      }
    }

    scheduleRows
      .filter((row) => !mergedScheduleIds.has(row.id))
      .forEach((row) => cards.push(renderScheduleCard(row)));

    if (!cards.length) return;
    content.innerHTML = cards.join('');
    section.classList.remove('hidden');
  }

  window.JEHubTerritoryAssignment = { init };
})();
