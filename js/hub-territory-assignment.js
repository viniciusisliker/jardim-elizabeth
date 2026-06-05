(function () {
  const H = window.JETerritoryAssignment;

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isRelevantAssignment(workDateIso, weekStartIso) {
    const today = H.toISODate(new Date());
    const monday = H.toISODate(H.getMonday(new Date()));
    if (workDateIso >= today) return true;
    return weekStartIso === monday;
  }

  function renderAssignmentCard(a) {
    const t = a.territories || {};
    const mapUrl = t.map_image_url || '';
    const slug = t.slug || t.display_name || '';
    const publicUrl = slug ? `territorios.html#${encodeURIComponent(slug)}` : 'territorios.html';
    const timeLine = a.work_time ? `<p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">schedule</span>${escapeHtml(H.formatTime(a.work_time))}</p>` : '';
    const meetLine = a.meeting_point
      ? `<p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">location_on</span>${escapeHtml(a.meeting_point)}</p>`
      : '';
    const notesLine = a.notes
      ? `<p class="hub-terr-notes">${escapeHtml(a.notes)}</p>`
      : '';

    return `
      <article class="hub-terr-card">
        <div class="hub-terr-card-main">
          <p class="hub-terr-kicker">Sua designação de território</p>
          <h2 class="hub-terr-title">T${escapeHtml(t.num)} · ${escapeHtml(t.display_name || 'Território')}</h2>
          <div class="hub-terr-details">
            <p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">date_range</span>Semana de ${escapeHtml(H.formatWeekRange(a.week_start))}</p>
            <p class="hub-terr-meta"><span class="material-symbols-outlined" aria-hidden="true">event</span>${escapeHtml(H.formatWeekday(a.work_date))}, ${escapeHtml(H.formatDisplayDate(a.work_date))}</p>
            ${timeLine}
            ${meetLine}
          </div>
          ${notesLine}
          <a href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener" class="hub-terr-link">
            Ver mapa do território
            <span class="material-symbols-outlined" aria-hidden="true">open_in_new</span>
          </a>
        </div>
        ${mapUrl ? `<a href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener" class="hub-terr-map" aria-label="Abrir mapa do território T${escapeHtml(t.num)}"><img src="${escapeHtml(mapUrl)}" alt="" loading="lazy"/></a>` : ''}
      </article>`;
  }

  async function init(client, profileId) {
    const section = document.getElementById('hub-territory-assignment');
    const content = document.getElementById('hub-territory-assignment-content');
    if (!section || !content || !client || !profileId || !H) return;

    const today = H.toISODate(new Date());
    const monday = H.toISODate(H.getMonday(new Date()));
    const { data, error } = await client
      .from('territory_assignments')
      .select(`
        id, week_start, work_date, work_time, meeting_point, notes,
        territories ( num, display_name, map_image_url, slug )
      `)
      .eq('profile_id', profileId)
      .or(`work_date.gte.${today},week_start.eq.${monday}`)
      .order('work_date', { ascending: true })
      .limit(8);

    if (error) {
      console.warn('Hub territory assignment:', error.message);
      return;
    }

    const items = (data || []).filter((a) => isRelevantAssignment(a.work_date, a.week_start));
    if (!items.length) return;

    content.innerHTML = items.map(renderAssignmentCard).join('');
    section.classList.remove('hidden');
  }

  window.JEHubTerritoryAssignment = { init };
})();
