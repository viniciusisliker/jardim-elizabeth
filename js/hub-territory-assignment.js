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

  function renderFieldCard(a) {
    const t = a.territories || {};
    const url = mapLink(t);
    const mapUrl = t.map_image_url || '';
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

  function renderScheduleCard(a) {
    const t = a.territories || {};
    const url = mapLink(t);
    const mapUrl = t.map_image_url || '';
    const obs = (a.observation_override || '').trim();
    const title = obs || `T${t.num || '?'} · ${t.display_name || 'Território'}`;
    const timeLine = a.schedule_times || a.work_time
      ? `<p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>${escapeHtml(a.schedule_times || H.formatTime(a.work_time))}</p>`
      : '';
    const meetLine = a.location_name || a.meeting_point
      ? `<p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">location_on</span>${escapeHtml(a.location_name || a.meeting_point)}</p>`
      : '';
    const notesLine = a.notes ? `<p class="hub-terr-notes">${escapeHtml(a.notes)}</p>` : '';

    return `
      <article class="hub-terr-card hub-terr-card--schedule">
        <div class="hub-terr-card-main">
          <p class="hub-terr-kicker">Cronograma da semana</p>
          <h2 class="hub-terr-title">${escapeHtml(title)}</h2>
          <div class="hub-terr-details">
            <p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">date_range</span>Semana de ${escapeHtml(H.formatWeekRange(a.week_start))}</p>
            <p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">event</span>${escapeHtml(H.formatWeekday(a.work_date))}, ${escapeHtml(H.formatDisplayDate(a.work_date))}</p>
            ${timeLine}
            ${meetLine}
          </div>
          ${notesLine}
          ${!obs && t.num ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="hub-terr-link">Ver mapa <span class="material-symbols-outlined" aria-hidden="true">open_in_new</span></a>` : ''}
        </div>
        ${!obs && mapUrl ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="hub-terr-map"><img src="${escapeHtml(mapUrl)}" alt="" loading="lazy"/></a>` : ''}
      </article>`;
  }

  function isRelevantSchedule(workDateIso, weekStartIso) {
    const today = H.toISODate(new Date());
    const monday = H.toISODate(H.getMonday(new Date()));
    if (workDateIso >= today) return true;
    return weekStartIso === monday;
  }

  async function init(client, profileId) {
    const section = document.getElementById('hub-territory-assignment');
    const content = document.getElementById('hub-territory-assignment-content');
    if (!section || !content || !client || !profileId || !H) return;

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

    const { data: scheduleRows, error: schedErr } = await client
      .from('territory_assignments')
      .select(`
        id, week_start, work_date, work_time, meeting_point, notes,
        location_name, schedule_times, observation_override,
        territories ( num, display_name, map_image_url, slug )
      `)
      .eq('profile_id', profileId)
      .or(`work_date.gte.${today},week_start.eq.${monday}`)
      .order('work_date', { ascending: true })
      .limit(8);

    if (schedErr) console.warn('Hub schedule:', schedErr.message);
    else {
      (scheduleRows || [])
        .filter((a) => isRelevantSchedule(a.work_date, a.week_start))
        .forEach((a) => cards.push(renderScheduleCard(a)));
    }

    if (!cards.length) return;
    content.innerHTML = cards.join('');
    section.classList.remove('hidden');
  }

  window.JEHubTerritoryAssignment = { init };
})();
