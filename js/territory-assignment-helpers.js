(function () {
  const WEEKDAY_FULL_PT = [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
    'Quinta-feira', 'Sexta-feira', 'Sábado'
  ];
  const WEEKDAY_SHORT_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const CRONOGRAMA_DAYS = ['Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const MONTHS_PT = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const PREFERENCE_LABELS = {
    meio_de_semana: 'Meio de semana',
    final_de_semana: 'Final de semana',
    ambos: 'Ambos'
  };
  const MIDWEEK_DAYS = ['Terça', 'Quarta', 'Quinta', 'Sexta'];
  const WEEKEND_DAYS = ['Sábado', 'Domingo'];
  const DOMINGO_FIXED_DIRIGENTES = [
    { territory_num: '12', dirigente_name: 'Marcelo Freire e Edvan' },
    { territory_num: '18', dirigente_name: 'Marcelo Almeida e João' },
    { territory_num: '07', dirigente_name: 'Denison e Arnaldo' }
  ];
  const SITE_TERRITORIES_URL = 'https://jardimelizabeth.vercel.app/territorios.html';

  function daysFromPreference(preference) {
    if (preference === 'final_de_semana') return [...WEEKEND_DAYS];
    if (preference === 'ambos') return [...CRONOGRAMA_DAYS];
    return [...MIDWEEK_DAYS];
  }

  function preferenceFromDays(days) {
    const set = new Set(days || []);
    const hasMid = MIDWEEK_DAYS.some((d) => set.has(d));
    const hasWeekend = WEEKEND_DAYS.some((d) => set.has(d));
    if (hasMid && hasWeekend) return 'ambos';
    if (hasWeekend) return 'final_de_semana';
    return 'meio_de_semana';
  }

  function overseerDays(overseer) {
    if (overseer?.available_days?.length) return overseer.available_days;
    return daysFromPreference(overseer?.preference);
  }

  function formatOverseerDays(overseer) {
    const days = overseerDays(overseer);
    if (days.length >= CRONOGRAMA_DAYS.length) return 'Todos os dias';
    return days.map((d) => d.slice(0, 3)).join(', ');
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function parseISODate(iso) {
    if (!iso) return null;
    return new Date(`${iso}T12:00:00`);
  }

  function toISODate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function getMonday(d) {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  }

  function formatDisplayDate(iso) {
    const d = parseISODate(iso);
    if (!d) return '';
    return `${pad(d.getDate())} de ${MONTHS_PT[d.getMonth()]}`;
  }

  function formatShortDate(iso) {
    const d = parseISODate(iso);
    if (!d) return '';
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  }

  function formatWeekday(iso) {
    const d = parseISODate(iso);
    if (!d) return '';
    return WEEKDAY_FULL_PT[d.getDay()];
  }

  function weekdayLabelFromDate(iso) {
    const d = parseISODate(iso);
    if (!d) return '';
    return WEEKDAY_FULL_PT[d.getDay()];
  }

  function weekdayMatchesCronograma(cronogramaDay, isoOrLabel) {
    const label = isoOrLabel?.includes('-') ? weekdayLabelFromDate(isoOrLabel) : isoOrLabel;
    if (!label) return false;
    const norm = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const target = cronogramaDay.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return norm.startsWith(target);
  }

  function formatWeekRange(weekStartIso) {
    const start = parseISODate(weekStartIso);
    if (!start) return '';
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${pad(start.getDate())} a ${pad(end.getDate())} de ${MONTHS_PT[start.getMonth()]}`;
    }
    return `${pad(start.getDate())} de ${MONTHS_PT[start.getMonth()]} a ${pad(end.getDate())} de ${MONTHS_PT[end.getMonth()]}`;
  }

  function formatTime(value) {
    if (!value) return '';
    const parts = String(value).slice(0, 5).split(':');
    if (parts.length < 2) return value;
    return `${parts[0]}:${parts[1]}`;
  }

  function snapToMonday(iso) {
    const d = parseISODate(iso);
    if (!d) return iso;
    return toISODate(getMonday(d));
  }

  function daysSince(iso) {
    if (!iso) return null;
    const start = parseISODate(iso);
    const today = parseISODate(toISODate(new Date()));
    return Math.floor((today - start) / 86400000);
  }

  function computePriority(territory) {
    if (territory.status === 'designado') return { label: 'Trabalhando', tone: 'working' };
    const days = daysSince(territory.last_worked_at);
    if (days === null) return { label: 'Alta', tone: 'high' };
    if (days >= 28) return { label: 'Alta', tone: 'high' };
    if (days >= 14) return { label: 'Média', tone: 'medium' };
    return { label: 'Normal', tone: 'normal' };
  }

  function territoryLabel(t) {
    if (!t) return '—';
    return `T${t.num} · ${t.display_name || 'Território'}`;
  }

  function territoryMapFileName(num) {
    const n = String(num ?? '').replace(/^0+/, '') || '0';
    return `t${n.padStart(2, '0')}.jpg`;
  }

  function siteRootPrefix() {
    const path = window.location.pathname || '/';
    return path.includes('/admin/') ? '../' : '';
  }

  function resolveTerritoryMapUrl(url, num) {
    let raw = String(url || '').trim();
    if (!raw && num != null && num !== '') {
      raw = `img/territorios/${territoryMapFileName(num)}`;
    }
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) return raw;
    if (raw.startsWith('/')) return raw;
    return `${siteRootPrefix()}${raw.replace(/^\.\//, '')}`;
  }

  function sortByPriority(territories) {
    const toneOrder = { high: 0, medium: 1, normal: 2, working: 3 };
    return [...territories].sort((a, b) => {
      const pa = computePriority(a);
      const pb = computePriority(b);
      const diff = (toneOrder[pa.tone] ?? 9) - (toneOrder[pb.tone] ?? 9);
      if (diff !== 0) return diff;
      const da = daysSince(a.last_worked_at) ?? 9999;
      const db = daysSince(b.last_worked_at) ?? 9999;
      return db - da;
    });
  }

  function dateForWeekdayInWeek(weekStartIso, weekdayLabel) {
    if (!weekStartIso || !weekdayLabel) return null;
    const start = parseISODate(weekStartIso);
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = toISODate(d);
      if (weekdayMatchesCronograma(weekdayLabel, iso)) return iso;
    }
    return null;
  }

  function normalizeName(name) {
    return String(name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function resolveProfileByName(name, profiles) {
    if (!name || !profiles?.length) return null;
    const n = normalizeName(name);
    const exact = profiles.find((p) => normalizeName(p.full_name) === n);
    if (exact) return exact;
    const first = n.split(/\s+/)[0];
    if (!first) return null;
    return profiles.find((p) => {
      const full = normalizeName(p.full_name);
      return full === first || full.startsWith(`${first} `);
    }) || null;
  }

  function isSaturdayCronogramaDay(label) {
    return weekdayMatchesCronograma('Sábado', label);
  }

  async function fetchWeekendAnnouncements(client, weekStartIso) {
    const byDate = {};
    if (!client || !weekStartIso) return byDate;
    const saturday = dateForWeekdayInWeek(weekStartIso, 'Sábado');
    if (!saturday) return byDate;
    const refMonth = `${saturday.slice(0, 7)}-01`;
    const { data: boards, error: bErr } = await client
      .from('announcement_boards')
      .select('id')
      .eq('reference_month', refMonth)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1);
    if (bErr || !boards?.length) return byDate;
    const { data: entries, error: eErr } = await client
      .from('announcement_entries')
      .select('event_date, data')
      .eq('board_id', boards[0].id)
      .eq('block', 'weekend');
    if (eErr) return byDate;
    (entries || []).forEach((e) => {
      if (e.event_date) byDate[e.event_date] = e.data || {};
    });
    return byDate;
  }

  function isSundayCronogramaDay(label) {
    return weekdayMatchesCronograma('Domingo', label);
  }

  function territoryNumFromScheduleRow(row) {
    const fromTerr = row?.territories?.num;
    if (fromTerr != null && fromTerr !== '') {
      return String(fromTerr).replace(/^0+/, '') || '0';
    }
    const code = String(row?.territory_code || '').match(/T(\d+)/i);
    if (code) return String(parseInt(code[1], 10));
    return '';
  }

  function domingoFixedIndex(row) {
    const num = territoryNumFromScheduleRow(row);
    if (!num) return -1;
    return DOMINGO_FIXED_DIRIGENTES.findIndex(
      (f) => f.territory_num.replace(/^0+/, '') === num
    );
  }

  function domingoDirigenteName(row) {
    if (!isSundayCronogramaDay(row?.weekday_label)) return '';
    const idx = domingoFixedIndex(row);
    if (idx < 0) return String(row.dirigente_name || '').trim();
    return DOMINGO_FIXED_DIRIGENTES[idx].dirigente_name;
  }

  function compareDomingoRows(a, b) {
    const ia = domingoFixedIndex(a);
    const ib = domingoFixedIndex(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  }

  function primaryDirigenteFromPair(name) {
    const raw = String(name || '').trim();
    if (!raw) return '';
    const parts = raw.split(/\s+e\s+/i);
    return parts[0].trim();
  }

  function normalizeTerritoryNum(num) {
    return String(num ?? '').replace(/^0+/, '') || '0';
  }

  function listDomingoPairs() {
    return DOMINGO_FIXED_DIRIGENTES.map((p) => ({ ...p }));
  }

  function domingoPairForTerritoryNum(num) {
    const n = normalizeTerritoryNum(num);
    return DOMINGO_FIXED_DIRIGENTES.find(
      (f) => normalizeTerritoryNum(f.territory_num) === n
    ) || null;
  }

  function domingoPairOptionValue(num) {
    return `pair:${normalizeTerritoryNum(num)}`;
  }

  function parseDomingoPairOptionValue(value) {
    const m = String(value || '').match(/^pair:(\d+)$/);
    return m ? m[1] : null;
  }

  function profilesInDomingoPair(pairName, profiles) {
    return String(pairName || '')
      .split(/\s+e\s+/i)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => resolveProfileByName(name, profiles))
      .filter(Boolean);
  }

  function profileInDomingoPair(profileId, pairName, profiles) {
    if (!profileId) return false;
    return profilesInDomingoPair(pairName, profiles).some((p) => p.id === profileId);
  }

  function domingoPairAssigneeLabel(territoryNum, assignment, profiles) {
    const pair = domingoPairForTerritoryNum(territoryNum);
    if (!pair || !assignment?.profile_id) return null;
    if (profileInDomingoPair(assignment.profile_id, pair.dirigente_name, profiles)) {
      return pair.dirigente_name;
    }
    return null;
  }

  function isDomingoPairTerritoryNum(num) {
    return !!domingoPairForTerritoryNum(num);
  }

  function assignmentTerritoryNum(assignment) {
    if (assignment?.territories?.num != null && assignment.territories.num !== '') {
      return normalizeTerritoryNum(assignment.territories.num);
    }
    return null;
  }

  function isDomingoPairContextAssignment(assignment, profiles) {
    if (!assignment?.profile_id) return false;
    if (assignment.is_domingo_pair === true) return true;
    const num = assignmentTerritoryNum(assignment);
    if (!num) return false;
    const pair = domingoPairForTerritoryNum(num);
    if (!pair) return false;
    return profileInDomingoPair(assignment.profile_id, pair.dirigente_name, profiles);
  }

  function assignmentBlocksIndividualDesignation(assignment, profiles) {
    if (!assignment?.profile_id) return false;
    return !isDomingoPairContextAssignment(assignment, profiles);
  }

  function profilesWithIndividualAssignment(activeAssignments, profiles) {
    const ids = new Set();
    for (const a of activeAssignments) {
      if (assignmentBlocksIndividualDesignation(a, profiles)) ids.add(a.profile_id);
    }
    return ids;
  }

  function profileHasDomingoElsewhere(profileId, territoryId, activeAssignments) {
    return activeAssignments.some(
      (a) => a.profile_id === profileId
        && a.status === 'active'
        && a.is_domingo_pair === true
        && a.territory_id !== territoryId
    );
  }

  function domingoPairSelectable(pair, territoryId, activeAssignments, profiles, currentProfileId, homeTerritoryId) {
    if (homeTerritoryId && territoryId && homeTerritoryId === territoryId) return true;
    const members = profilesInDomingoPair(pair.dirigente_name, profiles);
    if (!members.length) return true;
    if (currentProfileId && members.some((m) => m.id === currentProfileId)) return true;
    return members.some(
      (m) => !profileHasDomingoElsewhere(m.id, territoryId, activeAssignments)
    );
  }

  function resolveProfileIdForDomingoPair(pairNum, territoryId, profiles, activeAssignments, preferProfileId) {
    const pair = domingoPairForTerritoryNum(pairNum);
    if (!pair) return null;
    const members = profilesInDomingoPair(pair.dirigente_name, profiles);
    if (!members.length) return null;
    if (preferProfileId && members.some((m) => m.id === preferProfileId)) {
      if (!profileHasDomingoElsewhere(preferProfileId, territoryId, activeAssignments)) {
        return preferProfileId;
      }
    }
    const onTerritory = activeAssignments.find((a) => a.territory_id === territoryId && a.status === 'active');
    if (onTerritory && members.some((m) => m.id === onTerritory.profile_id)) {
      return onTerritory.profile_id;
    }
    const free = members.find(
      (m) => !profileHasDomingoElsewhere(m.id, territoryId, activeAssignments)
    );
    return free?.id || null;
  }

  function domingoPairNameForSchedule(weekdayLabel, territoryId, territoryCode, territoriesById) {
    if (!isSundayCronogramaDay(weekdayLabel)) return '';
    const fakeRow = { weekday_label: weekdayLabel, territory_id: territoryId, territory_code: territoryCode };
    if (territoriesById && territoryId && territoriesById[territoryId]) {
      fakeRow.territories = territoriesById[territoryId];
    }
    const fixed = domingoDirigenteName(fakeRow);
    if (fixed) return fixed;
    return '';
  }

  function applyDomingoFixedDirigentes(rows) {
    if (!rows?.length) return rows;

    const patched = rows.map((row) => {
      if (!isSundayCronogramaDay(row.weekday_label)) return row;
      const idx = domingoFixedIndex(row);
      const fixedName = idx >= 0 ? DOMINGO_FIXED_DIRIGENTES[idx].dirigente_name : '';
      const pairName = fixedName || String(row.dirigente_name || '').trim();
      return {
        ...row,
        dirigente_name: pairName || row.dirigente_name,
        profile_id: null,
        profiles: null,
        domingo_pair: true,
        sort_order: idx >= 0 ? 6 + idx : row.sort_order
      };
    });

    const domingoSlots = [];
    patched.forEach((row, i) => {
      if (isSundayCronogramaDay(row.weekday_label)) domingoSlots.push(i);
    });
    if (domingoSlots.length < 2) return patched;

    const ordered = domingoSlots
      .map((i) => patched[i])
      .sort(compareDomingoRows);

    const result = [...patched];
    domingoSlots.forEach((slot, j) => {
      result[slot] = ordered[j];
    });
    return result;
  }

  function applyWeekendDirigenteManual(row, sat, name, profiles) {
    const profile = resolveProfileByName(name, profiles);
    return {
      ...row,
      announcement_sat_date: sat,
      announcement_missing: false,
      from_schedule_manual: true,
      dirigente_name: name,
      profile_id: profile?.id || row.profile_id || null,
      profiles: profile ? { full_name: profile.full_name } : row.profiles || null
    };
  }

  function applyWeekendDirigente(row, weekStartIso, weekendByDate, profiles) {
    if (!isSaturdayCronogramaDay(row?.weekday_label)) return row;
    const sat = dateForWeekdayInWeek(weekStartIso, row.weekday_label);
    if (!sat) return row;
    const manualName = String(row.dirigente_name || '').trim();
    const data = weekendByDate?.[sat];
    if (!data) {
      if (manualName) return applyWeekendDirigenteManual(row, sat, manualName, profiles);
      return { ...row, announcement_sat_date: sat, announcement_missing: true };
    }
    if (String(data.evento_especial || '').trim()) {
      return { ...row, announcement_sat_date: sat, announcement_special: true };
    }
    const name = String(data.dirigente_sabado || '').trim();
    if (!name) {
      if (manualName) return applyWeekendDirigenteManual(row, sat, manualName, profiles);
      return { ...row, announcement_sat_date: sat, announcement_missing: true };
    }
    const profile = resolveProfileByName(name, profiles);
    return {
      ...row,
      announcement_sat_date: sat,
      announcement_dirigente: name,
      dirigente_name: name,
      profile_id: profile?.id || null,
      profiles: profile ? { full_name: profile.full_name } : null,
      from_announcement: true
    };
  }

  function generateWhatsAppSchedule(weekStartIso, scheduleRows, territoriesById) {
    const start = parseISODate(weekStartIso);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    let msg = '🗓 *TERRITÓRIOS - CRONOGRAMA SEMANAL*\n';
    msg += `*_Semana: ${formatShortDate(weekStartIso)} → ${formatShortDate(toISODate(end))}_*\n\n`;

    CRONOGRAMA_DAYS.forEach((day) => {
      const rows = (scheduleRows || []).filter((r) =>
        weekdayMatchesCronograma(day, r.work_date) ||
        weekdayMatchesCronograma(day, r.weekday_label)
      );
      if (!rows.length) return;

      msg += `🔹*${day.toUpperCase()}*\n`;
      rows.forEach((r) => {
        const name = domingoDirigenteName(r)
          || r.dirigente_name
          || r.profiles?.full_name
          || '—';
        msg += `*Dirigente:* _${name}_\n`;

        const obs = (r.observation_override || '').trim();
        if (obs) {
          msg += `*Território:* _${obs}_\n\n`;
          return;
        }

        const t = r.territories || territoriesById?.[r.territory_id];
        let text = r.territory_code || '—';
        if (t) {
          text = `T${t.num}`;
          if (t.display_name) text += ` - ${t.display_name}`;
        }
        msg += `*Território:* _${text}_\n\n`;
      });
    });

    msg += `📸 *Imagens dos Territórios*: ${SITE_TERRITORIES_URL}`;
    return msg;
  }

  window.JETerritoryAssignment = {
    WEEKDAY_FULL_PT,
    WEEKDAY_SHORT_PT,
    CRONOGRAMA_DAYS,
    MONTHS_PT,
    PREFERENCE_LABELS,
    MIDWEEK_DAYS,
    WEEKEND_DAYS,
    SITE_TERRITORIES_URL,
    daysFromPreference,
    preferenceFromDays,
    overseerDays,
    formatOverseerDays,
    toISODate,
    parseISODate,
    getMonday,
    snapToMonday,
    formatDisplayDate,
    formatShortDate,
    formatWeekday,
    formatWeekRange,
    formatTime,
    weekdayLabelFromDate,
    weekdayMatchesCronograma,
    dateForWeekdayInWeek,
    normalizeName,
    resolveProfileByName,
    isSaturdayCronogramaDay,
    isSundayCronogramaDay,
    domingoFixedIndex,
    domingoDirigenteName,
    domingoPairNameForSchedule,
    compareDomingoRows,
    primaryDirigenteFromPair,
    listDomingoPairs,
    domingoPairForTerritoryNum,
    normalizeTerritoryNum,
    domingoPairOptionValue,
    parseDomingoPairOptionValue,
    profilesInDomingoPair,
    profileInDomingoPair,
    domingoPairAssigneeLabel,
    isDomingoPairTerritoryNum,
    isDomingoPairContextAssignment,
    assignmentBlocksIndividualDesignation,
    profilesWithIndividualAssignment,
    domingoPairSelectable,
    resolveProfileIdForDomingoPair,
    applyDomingoFixedDirigentes,
    fetchWeekendAnnouncements,
    applyWeekendDirigente,
    daysSince,
    computePriority,
    territoryLabel,
    territoryMapFileName,
    siteRootPrefix,
    resolveTerritoryMapUrl,
    sortByPriority,
    generateWhatsAppSchedule
  };
})();
