(function () {
  const H = window.JETerritoryAssignment;

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mapLink(t) {
    const slug = t?.slug || t?.display_name || '';
    return slug ? `territorios.html#${encodeURIComponent(slug)}` : 'territorios.html';
  }

  function matchesDirigente(row, profileId, profileName) {
    if (row.profile_id === profileId) return true;
    if (!row.dirigente_name || !profileName) return false;
    const hay = row.dirigente_name.toLowerCase();
    const needle = profileName.toLowerCase();
    const first = needle.split(/\s+/)[0];
    return hay.includes(needle) || hay.includes(first);
  }

  function renderFieldCard(a) {
    const t = a.territories || {};
    const url = mapLink(t);
    const mapUrl = H.resolveTerritoryMapUrl(t.map_image_url, t.num) || '';
    return `
      <article class="hub-terr-card hub-terr-card--field">
        <div class="hub-terr-card-main">
          <p class="hub-terr-kicker">Seu território de campo</p>
          <h2 class="hub-terr-title">T${escapeHtml(t.num)} · ${escapeHtml(t.display_name || 'Território')}</h2>
          <div class="hub-terr-details">
            <p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">assignment_ind</span>Designado em ${escapeHtml(H.formatDisplayDate(a.assigned_at))}</p>
          </div>
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="hub-terr-link">
            Ver mapa do território
            <span class="material-symbols-outlined" aria-hidden="true">open_in_new</span>
          </a>
        </div>
        ${mapUrl ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="hub-terr-map"><img src="${escapeHtml(mapUrl)}" alt="" loading="lazy"/></a>` : ''}
      </article>`;
  }

  function renderScheduleCard(row) {
    const t = row.territories || {};
    const url = mapLink(t);
    const mapUrl = H.resolveTerritoryMapUrl(t.map_image_url, t.num) || '';
    const title = t.num
      ? `T${t.num} · ${t.display_name || 'Território'}`
      : (row.territory_code || 'Cronograma da semana');
    const timeLine = row.schedule_times
      ? `<p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>${escapeHtml(row.schedule_times)}</p>`
      : '';
    const meetLine = row.location_name
      ? `<p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">location_on</span>${escapeHtml(row.location_name)}</p>`
      : '';
    const notesLine = row.observations
      ? `<p class="hub-terr-notes">${escapeHtml(row.observations)}</p>`
      : '';

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
          ${t.num ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="hub-terr-link">Ver mapa <span class="material-symbols-outlined" aria-hidden="true">open_in_new</span></a>` : ''}
        </div>
        ${t.num && mapUrl ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="hub-terr-map"><img src="${escapeHtml(mapUrl)}" alt="" loading="lazy"/></a>` : ''}
      </article>`;
  }

  async function init(client, profile) {
    const section = document.getElementById('hub-territory-assignment');
    const content = document.getElementById('hub-territory-assignment-content');
    if (!section || !content || !client || !profile?.id || !H) return;

    const profileId = profile.id;
    const profileName = profile.full_name || '';
    const today = H.toISODate(new Date());
    const monday = H.toISODate(H.getMonday(new Date()));
    const cards = [];

    const { data: fieldRows, error: fieldErr } = await client
      .from('territory_active_assignments')
      .select(`
        id, assigned_at,
        territories ( num, display_name, map_image_url, slug )
      `)
      .eq('profile_id', profileId)
      .eq('status', 'active')
      .limit(1);

    if (fieldErr) console.warn('Hub field assignment:', fieldErr.message);
    else if (fieldRows?.length) cards.push(renderFieldCard(fieldRows[0]));

    const { data: templateRows, error: schedErr } = await client
      .from('territory_week_schedule')
      .select(`
        id, weekday_label, dirigente_name, territory_code, location_name, schedule_times, observations,
        profile_id, territory_id,
        territories ( num, display_name, map_image_url, slug )
      `)
      .order('sort_order', { ascending: true });

    if (schedErr) console.warn('Hub schedule:', schedErr.message);
    else {
      const weekendByDate = await H.fetchWeekendAnnouncements(client, monday);
      (templateRows || [])
        .map((row) => H.applyWeekendDirigente(row, monday, weekendByDate, []))
        .filter((row) => matchesDirigente(row, profileId, profileName))
        .map((row) => {
          const workDate = H.dateForWeekdayInWeek(monday, row.weekday_label);
          return { ...row, week_start: monday, work_date: workDate };
        })
        .filter((row) => row.work_date && row.work_date >= today)
        .forEach((row) => cards.push(renderScheduleCard(row)));
    }

    if (!cards.length) return;
    content.innerHTML = cards.join('');
    section.classList.remove('hidden');
  }

  window.JEHubTerritoryAssignment = { init };
})();
