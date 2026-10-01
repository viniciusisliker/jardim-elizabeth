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
    { key: 'portao', label: 'Indicador (Portão)', type: 'select', rotation: 'indicadores' },
    { key: 'indicador', label: 'Indicador (Auditório)', type: 'select', rotation: 'indicadores' },
    { key: 'som', label: 'Som', type: 'select', rotation: 'som' },
    { key: 'microf_volantes_1', label: 'Microf. volante 1', type: 'select', rotation: 'microfone_volante' },
    { key: 'microf_volantes_2', label: 'Microf. volante 2', type: 'select', rotation: 'microfone_volante' },
    { key: 'limpeza_grupo', label: 'Limpeza (grupo)', type: 'select', options: CLEANING_GROUPS, rotation: 'grupos' }
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
    { key: 'ministerio_4_tipo', label: 'Ministério 4 — tipo', type: 'text', section: 'ministerio' },
    { key: 'ministerio_4_designados', label: 'Ministério 4 — designados', type: 'text', section: 'ministerio' },
    { key: 'ministerio_4_sala_b', label: 'Ministério 4 — Sala B', type: 'text', section: 'ministerio' },
    { key: 'vida_crista_titulo', label: 'Nossa vida cristã — título', type: 'text', section: 'vida' },
    { key: 'vida_crista_designado', label: 'Nossa vida cristã — designado', type: 'text', section: 'vida' },
    { key: 'estudo_dirigente', label: 'Estudo bíblico — dirigente', type: 'text', section: 'vida' },
    { key: 'leitor_sentinela', label: 'Leitor', type: 'text', section: 'vida' },
    { key: 'oracao_final', label: 'Oração final', type: 'text', section: 'vida' }
  ];

  const WEEKEND_FIELDS = [
    { key: 'dirigente_sabado', label: 'Dirigente de sábado (território)', type: 'text', group: 'territorio', rotation: 'campo', hint: 'Dirige o trabalho de campo no sábado — usado no cronograma de territórios' },
    { key: 'presidente', label: 'Presidente', type: 'text', group: 'discurso', rotation: 'presidente' },
    { key: 'tema_discurso', label: 'Tema do discurso', type: 'text', group: 'discurso' },
    { key: 'orador', label: 'Orador', type: 'text', group: 'discurso' },
    { key: 'congregacao_orador', label: 'Congregação do orador', type: 'text', group: 'discurso', hint: 'Se orador visitante' },
    { key: 'estudo_sentinela_tema', label: 'Tema do estudo', type: 'text', group: 'sentinela' },
    { key: 'cantico_sentinela', label: 'Cântico', type: 'text', group: 'sentinela' },
    { key: 'leitor_sentinela', label: 'Leitor', type: 'text', group: 'sentinela', rotation: 'leitor' },
    { key: 'cantico_final', label: 'Cântico final', type: 'text', group: 'sentinela' },
    { key: 'oracao_final', label: 'Oração final', type: 'text', group: 'sentinela', rotation: 'oracao' },
    { key: 'oradores_enviados', label: 'Irmãos enviados', type: 'textarea', group: 'enviados', optional: true, placeholder: 'Um por linha — Ex.: João Silva — Cong. Vila Sônia', hint: 'Irmãos da congregação que fazem discurso em outras congregações neste fim de semana' },
    { key: 'evento_especial', label: 'Evento especial', type: 'text', group: 'especial', optional: true, placeholder: 'Ex.: Assembleia de Circuito', hint: 'Quando preenchido, substitui o programa normal desta data' }
  ];

  const WEEKEND_GROUPS = {
    territorio: { title: 'Trabalho de campo (sábado)', icon: 'hiking' },
    discurso: { title: 'Discurso público', icon: 'record_voice_over' },
    sentinela: { title: 'Estudo da Sentinela', icon: 'menu_book' },
    enviados: { title: 'Oradores enviados', icon: 'outbound' },
    especial: { title: 'Programa alternativo', icon: 'event' }
  };

  const SECTION_SLUGS = {
    mecanicas: 'designacoes-mecanicas',
    midweek: 'meio-de-semana',
    weekend: 'final-de-semana'
  };

  const SECTION_TITLES = {
    mecanicas: 'Designações Mecânicas',
    midweek: 'Nossa Vida e Ministério Cristão',
    weekend: 'Discurso Público e Estudo de A Sentinela'
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
