(function () {
  const CLEANING_GROUPS = [
    'Grupo Pirajussara',
    'Grupo Leonidas',
    'Grupo Elizabeth',
    'Grupo Helga',
    'Grupo Campo Limpo',
    'Grupo Iracema'
  ];

  const MECANICAS_FIELDS = [
    { key: 'portao', label: 'Portão', type: 'text' },
    { key: 'indicador', label: 'Indicador', type: 'text' },
    { key: 'som', label: 'Som', type: 'text' },
    { key: 'microf_volantes_1', label: 'Microf. volante 1', type: 'text' },
    { key: 'microf_volantes_2', label: 'Microf. volante 2', type: 'text' },
    { key: 'limpeza_grupo', label: 'Limpeza (grupo)', type: 'select', options: CLEANING_GROUPS }
  ];

  const MIDWEEK_FIELDS = [
    { key: 'leitura_biblica', label: 'Leitura bíblica', type: 'text', section: 'header' },
    { key: 'cantico', label: 'Cântico', type: 'text', section: 'header' },
    { key: 'presidente', label: 'Presidente', type: 'text', section: 'header' },
    { key: 'tesouros_titulo', label: 'Tesouros — título', type: 'text', section: 'tesouros' },
    { key: 'tesouros_designado', label: 'Tesouros — designado', type: 'text', section: 'tesouros' },
    { key: 'joias_designado', label: 'Joias espirituais', type: 'text', section: 'tesouros' },
    { key: 'dirigente_sala_b', label: 'Dirigente Sala B', type: 'text', section: 'tesouros' },
    { key: 'leitura_biblia', label: 'Leitura da Bíblia', type: 'text', section: 'tesouros' },
    { key: 'leitura_biblia_sala_b', label: 'Leitura Bíblia Sala B', type: 'text', section: 'tesouros' },
    { key: 'ministerio_1_tipo', label: 'Ministério 1 — tipo', type: 'text', section: 'ministerio' },
    { key: 'ministerio_1_designados', label: 'Ministério 1 — designados', type: 'text', section: 'ministerio' },
    { key: 'ministerio_1_sala_b', label: 'Ministério 1 — Sala B', type: 'text', section: 'ministerio' },
    { key: 'ministerio_2_tipo', label: 'Ministério 2 — tipo', type: 'text', section: 'ministerio' },
    { key: 'ministerio_2_designados', label: 'Ministério 2 — designados', type: 'text', section: 'ministerio' },
    { key: 'ministerio_2_sala_b', label: 'Ministério 2 — Sala B', type: 'text', section: 'ministerio' },
    { key: 'ministerio_3_tipo', label: 'Ministério 3 — tipo', type: 'text', section: 'ministerio' },
    { key: 'ministerio_3_designados', label: 'Ministério 3 — designados', type: 'text', section: 'ministerio' },
    { key: 'ministerio_3_sala_b', label: 'Ministério 3 — Sala B', type: 'text', section: 'ministerio' },
    { key: 'vida_crista_titulo', label: 'Nossa vida cristã — título', type: 'text', section: 'vida' },
    { key: 'vida_crista_designado', label: 'Nossa vida cristã — designado', type: 'text', section: 'vida' },
    { key: 'leitor_sentinela', label: 'Leitor', type: 'text', section: 'vida' },
    { key: 'oracao_final', label: 'Oração final', type: 'text', section: 'vida' }
  ];

  const WEEKEND_FIELDS = [
    { key: 'presidente', label: 'Presidente', type: 'text', group: 'discurso' },
    { key: 'tema_discurso', label: 'Tema do discurso', type: 'text', group: 'discurso' },
    { key: 'orador', label: 'Orador', type: 'text', group: 'discurso' },
    { key: 'congregacao_orador', label: 'Congregação do orador', type: 'text', group: 'discurso', hint: 'Se orador visitante' },
    { key: 'estudo_sentinela_tema', label: 'Tema do estudo', type: 'text', group: 'sentinela' },
    { key: 'leitor_sentinela', label: 'Leitor', type: 'text', group: 'sentinela' },
    { key: 'oracao_final', label: 'Oração final', type: 'text', group: 'sentinela' },
    { key: 'presidente_sala_b', label: 'Presidente Sala B', type: 'text', group: 'sala_b' },
    { key: 'evento_especial', label: 'Evento especial', type: 'text', group: 'especial', optional: true, placeholder: 'Ex.: Assembleia de Circuito', hint: 'Quando preenchido, substitui o programa normal desta data' }
  ];

  const WEEKEND_GROUPS = {
    discurso: { title: 'Discurso público', icon: 'record_voice_over' },
    sentinela: { title: 'Estudo da Sentinela', icon: 'menu_book' },
    sala_b: { title: 'Sala B', icon: 'groups' },
    especial: { title: 'Programa alternativo', icon: 'event' }
  };

  const SECTION_SLUGS = {
    mecanicas: 'designacoes-mecanicas',
    midweek: 'meio-de-semana',
    weekend: 'final-de-semana'
  };

  const SECTION_TITLES = {
    mecanicas: 'Designações Mecânicas',
    midweek: 'Reunião de Meio de Semana',
    weekend: 'Reunião de Final de Semana'
  };

  function emptyData(block) {
    const fields = block === 'mecanicas' ? MECANICAS_FIELDS
      : block === 'midweek' ? MIDWEEK_FIELDS : WEEKEND_FIELDS;
    const data = {};
    fields.forEach((f) => { data[f.key] = ''; });
    if (block === 'limpeza_mensal') return { fim_de_semana: '', grupo: '' };
    return data;
  }

  function fieldsForBlock(block) {
    if (block === 'mecanicas') return MECANICAS_FIELDS;
    if (block === 'midweek') return MIDWEEK_FIELDS;
    if (block === 'weekend') return WEEKEND_FIELDS;
    return [];
  }

  window.JEAnnouncementSchemas = {
    CLEANING_GROUPS,
    MECANICAS_FIELDS,
    MIDWEEK_FIELDS,
    WEEKEND_FIELDS,
    WEEKEND_GROUPS,
    SECTION_SLUGS,
    SECTION_TITLES,
    emptyData,
    fieldsForBlock
  };
})();
