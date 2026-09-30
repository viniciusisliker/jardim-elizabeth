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

  // Chaves que o usuário editou à mão no quadro de fim de semana: nelas o valor
  // salvo no anúncio prevalece sobre o que vem de Discursos Públicos.
  const MANUAL_KEYS_FIELD = '_manual_keys';

  function manualKeysOf(data) {
    const list = data && data[MANUAL_KEYS_FIELD];
    return Array.isArray(list) ? list : [];
  }

  function mergeWeekendDisplayData(announcementData, speechEntry) {
    const base = { ...(announcementData || {}) };
    const fromSpeech = speechToWeekendFields(speechEntry);
    const manual = manualKeysOf(base);
    const speechKeys = Object.keys(fromSpeech).filter((k) => fromSpeech[k]);
    const overriddenKeys = speechKeys.filter((k) => manual.includes(k) && trim(base[k]));
    const discursosKeys = speechKeys.filter((k) => !overriddenKeys.includes(k));
    if (!discursosKeys.length) {
      return { data: base, fromDiscursos: false, discursosKeys: [], overriddenKeys, speechFields: fromSpeech };
    }
    const merged = { ...base };
    discursosKeys.forEach((k) => { merged[k] = fromSpeech[k]; });
    return { data: merged, fromDiscursos: true, discursosKeys, overriddenKeys, speechFields: fromSpeech };
  }

  // Grava o valor digitado num campo do fim de semana. Se igual ao que vem de
  // Discursos Públicos (ou vazio), volta a seguir a sincronização automática.
  function setWeekendFieldValue(data, key, value, speechEntry) {
    const fromSpeech = speechToWeekendFields(speechEntry);
    const speechVal = trim(fromSpeech[key]);
    let manual = manualKeysOf(data).filter((k) => k !== key);
    if (!speechVal) {
      data[key] = value;
    } else if (!trim(value) || trim(value) === speechVal) {
      delete data[key];
    } else {
      data[key] = value;
      manual = [...manual, key];
    }
    if (manual.length) data[MANUAL_KEYS_FIELD] = manual;
    else delete data[MANUAL_KEYS_FIELD];
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
    MANUAL_KEYS_FIELD,
    setWeekendFieldValue,
    speechToWeekendFields,
    mergeWeekendDisplayData,
    fetchReceiveSpeechesByDate,
    mergeWeekendEntries
  };
})();
