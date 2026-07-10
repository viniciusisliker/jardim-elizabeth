(function () {
  const DISCURSOS_WEEKEND_KEYS = ['orador', 'tema_discurso', 'congregacao_orador', 'evento_especial'];

  function trim(v) {
    return String(v ?? '').trim();
  }

  function formatSpeechTheme(entry) {
    const theme = trim(entry.theme);
    const outline = trim(entry.outline_number);
    if (outline && theme) return `Esboço ${outline} — ${theme}`;
    if (outline) return `Esboço ${outline}`;
    return theme;
  }

  function speechToWeekendFields(entry) {
    if (!entry) return {};
    if (entry.entry_type === 'convention') {
      const label = trim(entry.theme) || 'Congresso';
      return { evento_especial: label };
    }
    if (entry.entry_type === 'special_visit') {
      const name = trim(entry.speaker_name);
      return { evento_especial: name ? `Visita SC — ${name}` : 'Visita do superintendente de circuito' };
    }
    if (entry.entry_type === 'note') {
      const text = trim(entry.note_text);
      return text ? { evento_especial: text } : {};
    }
    if (entry.entry_type !== 'speech') return {};
    const out = {};
    const orador = trim(entry.speaker_name);
    const tema = formatSpeechTheme(entry);
    const cong = trim(entry.observation);
    if (orador) out.orador = orador;
    if (tema) out.tema_discurso = tema;
    if (cong) out.congregacao_orador = cong;
    return out;
  }

  function mergeWeekendDisplayData(announcementData, speechEntry) {
    const base = { ...(announcementData || {}) };
    const fromSpeech = speechToWeekendFields(speechEntry);
    const discursosKeys = Object.keys(fromSpeech).filter((k) => fromSpeech[k]);
    if (!discursosKeys.length) {
      return { data: base, fromDiscursos: false, discursosKeys: [] };
    }
    const merged = { ...base };
    discursosKeys.forEach((k) => { merged[k] = fromSpeech[k]; });
    return { data: merged, fromDiscursos: true, discursosKeys };
  }

  async function fetchReceiveSpeechesByDate(client, referenceMonth) {
    const byDate = {};
    if (!client || !referenceMonth) return byDate;

    // Prefer CRM assignments (receive) for the month
    const monthStart = String(referenceMonth).slice(0, 10);
    const d = new Date(`${monthStart}T12:00:00`);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const endIso = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`;

    const { data: crmRows, error: crmErr } = await client
      .from('speech_assignments')
      .select('event_date, speaker_name, outline_number, theme_title, congregation_name, confirmation_status')
      .eq('direction', 'receive')
      .neq('confirmation_status', 'cancelado')
      .gte('event_date', monthStart)
      .lte('event_date', endIso);

    if (!crmErr && crmRows?.length) {
      crmRows.forEach((row) => {
        if (!row.event_date) return;
        byDate[row.event_date] = {
          entry_type: 'speech',
          speaker_name: row.speaker_name,
          outline_number: row.outline_number != null ? String(row.outline_number) : '',
          theme: row.theme_title || '',
          observation: row.congregation_name || ''
        };
      });
      return byDate;
    }

    // Fallback: legado public_speech_boards / entries
    const { data: boards, error: bErr } = await client
      .from('public_speech_boards')
      .select('id')
      .eq('reference_month', referenceMonth)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(1);
    if (bErr || !boards?.length) return byDate;
    const { data: rows, error: eErr } = await client
      .from('public_speech_entries')
      .select('event_date, entry_type, speaker_name, outline_number, theme, observation, note_text')
      .eq('board_id', boards[0].id)
      .eq('direction', 'receive');
    if (eErr) return byDate;
    (rows || []).forEach((row) => {
      if (row.event_date) byDate[row.event_date] = row;
    });
    return byDate;
  }

  function mergeWeekendEntries(entries, speechesByDate) {
    return (entries || []).map((entry) => {
      if (entry.block !== 'weekend') return entry;
      const speech = speechesByDate?.[entry.event_date];
      const { data } = mergeWeekendDisplayData(entry.data, speech);
      return { ...entry, data };
    });
  }

  window.JEWeekendDiscursosSync = {
    DISCURSOS_WEEKEND_KEYS,
    speechToWeekendFields,
    mergeWeekendDisplayData,
    fetchReceiveSpeechesByDate,
    mergeWeekendEntries
  };
})();
