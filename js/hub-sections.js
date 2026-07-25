(function () {
  const SECRETARIO_SHARED = {
    permission: 'secretario',
    moduleKey: 'secretario',
    viewId: 'hub-view-secretario',
    partial: 'hub/sections/secretario.html',
    styles: ['css/hub-sections/secretario.css?v=20260725210000'],
    scripts: [
      'js/admin/secretario-service.js?v=20260725240000',
      'js/admin/secretario-visit.js?v=20260724234500',
      'js/admin/secretario.js?v=20260724234500'
    ],
    initKey: 'JEAdminSecretario'
  };

  function secSection(id, hash, tab, title, subtitle) {
    return {
      ...SECRETARIO_SHARED,
      id,
      hash,
      secretarioTab: tab,
      hero: {
        kicker: 'Secretário',
        title,
        subtitle,
        showChangelog: false,
        showBack: true
      }
    };
  }

  const AV_SHARED = {
    permission: 'audio_video',
    moduleKey: 'audio-video',
    viewId: 'hub-view-audio-video',
    partial: 'hub/sections/audio-video.html',
    styles: ['css/hub-sections/audio-video.css?v=20260725350000'],
    scripts: [
      'js/admin/audio-video.js?v=20260725350000'
    ],
    initKey: 'JEAdminAudioVideo'
  };

  function avSection(id, hash, tab, title, subtitle) {
    return {
      ...AV_SHARED,
      id,
      hash,
      audioVideoTab: tab,
      hero: {
        kicker: 'Áudio e Vídeo',
        title,
        subtitle,
        showChangelog: false,
        showBack: true
      }
    };
  }

  const CONFIG_SHARED = {
    permission: 'settings',
    moduleKey: 'configuracoes',
    viewId: 'hub-view-configuracoes',
    partial: 'hub/sections/configuracoes.html',
    styles: ['css/hub-sections/configuracoes.css?v=20260725340000'],
    scripts: [
      'js/admin/table-xlf.js?v=2026061058',
      'js/admin/agendamentos.js?v=20260725310000',
      'js/admin/donativos.js?v=20260725330000',
      'js/admin/configuracoes.js?v=20260725340000'
    ],
    initKey: 'JEAdminConfiguracoes'
  };

  function cfgSection(id, hash, tab, title, subtitle) {
    return {
      ...CONFIG_SHARED,
      id,
      hash,
      configuracoesTab: tab,
      hero: {
        kicker: 'Sistema',
        title,
        subtitle,
        showChangelog: false,
        showBack: true
      }
    };
  }

  window.JEHubSections = {
    home: {
      id: 'home',
      hash: '',
      permission: null,
      viewId: 'hub-view-home',
      hero: {
        kicker: 'Central administrativa',
        title: 'Hub Administrativo',
        subtitle: 'Gestão do site da congregação — publicações, campo, agenda e configurações em um só lugar.',
        showChangelog: true,
        showBack: false
      }
    },
    agenda: {
      id: 'agenda',
      hash: 'agenda',
      permission: 'agenda',
      viewId: 'hub-view-agenda',
      hero: {
        kicker: 'Publicação',
        title: 'Agenda',
        subtitle: 'Criar, editar e publicar eventos na home e na página Agenda.',
        showChangelog: false,
        showBack: true
      }
    },
    anuncios: {
      id: 'anuncios',
      hash: 'anuncios',
      permission: 'announcements',
      viewId: 'hub-view-anuncios',
      partial: 'hub/sections/anuncios.html',
      styles: [
        'css/hub-sections/doc-entry-footer.css?v=2026060977',
        'css/hub-sections/anuncios.css?v=2026060977'
      ],
      scripts: [
        'js/hub-doc-footer.js?v=2026060977',
        'js/admin/announcement-theme.js',
        'js/admin/announcement-dates.js',
        'js/admin/weekend-discursos-sync.js?v=20260710220000',
        'js/admin/announcement-schemas.js?v=2026060526',
        'js/admin/anuncios-export.js?v=2026060526',
        'js/admin/anuncios-pdf.js?v=2026061051',
        'js/admin/anuncios.js?v=2026061051'
      ],
      initKey: 'JEAdminAnuncios',
      hero: {
        kicker: 'Publicação',
        title: 'Quadro de Anúncios',
        subtitle: 'Preencha, gere o PDF, revise e publique no site — uma seção por vez.',
        showChangelog: false,
        showBack: true
      }
    },
    discursos: {
      id: 'discursos',
      hash: 'discursos',
      permission: 'public_speeches',
      viewId: 'hub-view-discursos',
      partial: 'hub/sections/discursos.html',
      styles: [
        'css/hub-sections/discursos.css?v=20260725173000'
      ],
      scripts: [
        'js/admin/discursos-publicos.js?v=20260725174500'
      ],
      initKey: 'JEAdminDiscursos',
      hero: {
        kicker: 'Publicação',
        title: 'Discursos Públicos',
        subtitle: 'Agenda, oradores e temas S-34 — com WhatsApp e sync no Quadro.',
        showChangelog: false,
        showBack: true
      }
    },
    agendamentos: cfgSection(
      'agendamentos',
      'agendamentos',
      'links',
      'Links de calendário',
      'URLs do Google Calendar — slugs carrinho-* e display-* nas páginas públicas.'
    ),
    'carrinhos-displays': {
      id: 'carrinhos-displays',
      hash: 'carrinhos-displays',
      permission: 'agendamentos',
      viewId: 'hub-view-carrinhos-displays',
      partial: 'hub/sections/carrinhos-displays.html',
      styles: ['css/hub-sections/carrinhos-displays.css?v=20260618140000'],
      scripts: [
        'js/week-input-helpers.js?v=2026060984',
        'js/equipment-schedule-helpers.js?v=2026061312',
        'js/admin/table-xlf.js?v=2026061060',
        'js/territory-column-resize.js?v=2026061066',
        'js/admin/hub-undo.js?v=2026060996',
        'js/admin/equipment-history.js?v=20260618140000',
        'js/admin/carrinhos-displays.js?v=20260618140000'
      ],
      initKey: 'JEAdminCarrinhosDisplays',
      hero: {
        kicker: 'Organização e campo',
        title: 'Carrinhos e Displays',
        subtitle: 'Publicadores, equipamentos, locais, cronograma semanal e mensagem pronta para WhatsApp.',
        showChangelog: false,
        showBack: true
      }
    },
    'audio-video': avSection(
      'audio-video',
      'audio-video',
      'inicio',
      'Início',
      'Referência rápida para mesa de som, projeção e transmissão Zoom.'
    ),
    'audio-video-checklists': avSection(
      'audio-video-checklists',
      'audio-video-checklists',
      'checklists',
      'Checklists',
      'Listas de verificação antes e durante as reuniões.'
    ),
    'audio-video-assistencia': avSection(
      'audio-video-assistencia',
      'audio-video-assistencia',
      'assistencia',
      'Assistência',
      'Registro de assistência às reuniões para o secretário.'
    ),
    'audio-video-notas': avSection(
      'audio-video-notas',
      'audio-video-notas',
      'notas',
      'Notas',
      'Notas compartilhadas e imagens da equipe de Áudio e Vídeo.'
    ),
    territorios: {
      id: 'territorios',
      hash: 'territorios',
      permission: 'territorios',
      viewId: 'hub-view-territorios',
      partial: 'hub/sections/territorios.html',
      styles: ['css/hub-sections/territorios.css?v=20260618120000'],
      scripts: [
        'js/territory-column-resize.js?v=2026061014',
        'js/admin/hub-undo.js?v=2026060996',
        'js/admin/territory-campaigns.js?v=20260618120000',
        'js/admin/territory-system.js?v=20260710120000'
      ],
      initKey: 'JEAdminTerritorios',
      hero: {
        kicker: 'Organização e campo',
        title: 'Territórios',
        subtitle: 'Designação, devolução, cronograma semanal e histórico de campo.',
        showChangelog: false,
        showBack: true
      }
    },
    donativos: cfgSection(
      'donativos',
      'donativos',
      'donativos',
      'Donativos',
      'Chave PIX, QR code e textos da página de donativos.'
    ),
    secretario: secSection(
      'secretario',
      'secretario',
      'publicadores',
      'Publicadores',
      'Cadastro, grupos, petições e estatísticas da congregação.'
    ),
    'secretario-relatorios': secSection(
      'secretario-relatorios',
      'secretario-relatorios',
      'relatorios',
      'Relatórios',
      'Relatórios de campo do mês, lembretes e publicadores pendentes.'
    ),
    'secretario-assistencia': secSection(
      'secretario-assistencia',
      'secretario-assistencia',
      'assistencia',
      'Assistência',
      'Contagem de assistência às reuniões enviada pela equipe de Áudio e Vídeo.'
    ),
    'secretario-s1': secSection(
      'secretario-s1',
      'secretario-s1',
      'formularios',
      'Formulários',
      'Formulário S-1 — resumo mensal, ajustes, fechamento e exportação CSV.'
    ),
    'secretario-visita': secSection(
      'secretario-visita',
      'secretario-visita',
      'visita',
      'Visita do Superintendente',
      'Informações, documentos e publicação para a Visão Geral do Superintendente.'
    ),
    perfil: {
      id: 'perfil',
      hash: 'perfil',
      permission: null,
      viewId: 'hub-view-perfil',
      partial: 'hub/sections/perfil.html',
      styles: ['css/hub-sections/perfil.css?v=2026061065'],
      scripts: ['js/admin/meu-perfil.js?v=2026061065'],
      initKey: 'JEMeuPerfil',
      hero: {
        kicker: 'Minha conta',
        title: 'Meu Perfil',
        subtitle: 'Foto, senha e informações da sua conta no site.',
        showChangelog: false,
        showBack: true
      }
    },
    configuracoes: cfgSection(
      'configuracoes',
      'configuracoes',
      null,
      'Equipe e permissões',
      'Visão geral de membros, designações e ferramentas do Hub.'
    ),
    'sistema-membros': cfgSection(
      'sistema-membros',
      'sistema-membros',
      'membros',
      'Membros da equipe',
      'Cargo, usuário, e-mail, foto e acesso a módulos.'
    ),
    'sistema-designacoes': cfgSection(
      'sistema-designacoes',
      'sistema-designacoes',
      'designacoes',
      'Designações de acesso',
      'Funções com permissões de módulo — atribua aos membros.'
    ),
    'sistema-notificacoes': cfgSection(
      'sistema-notificacoes',
      'sistema-notificacoes',
      'notificacoes',
      'Notificações da equipe',
      'Envie aviso para um membro ou para toda a equipe.'
    ),
    'sistema-app': cfgSection(
      'sistema-app',
      'sistema-app',
      'app',
      'App no celular',
      'Instale na tela inicial e gerencie atualizações.'
    ),
    'sistema-links': cfgSection(
      'sistema-links',
      'sistema-links',
      'links',
      'Links de calendário',
      'URLs do Google Calendar — slugs carrinho-* e display-* nas páginas públicas.'
    ),
    'sistema-donativos': cfgSection(
      'sistema-donativos',
      'sistema-donativos',
      'donativos',
      'Donativos',
      'Chave PIX, QR code e textos da página de donativos.'
    )
  };
})();
