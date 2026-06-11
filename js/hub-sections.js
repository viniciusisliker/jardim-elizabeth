(function () {
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
        'js/admin/weekend-discursos-sync.js?v=2026060527',
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
        'css/hub-sections/doc-entry-footer.css?v=2026060977',
        'css/hub-sections/discursos.css?v=2026060980'
      ],
      scripts: [
        'js/hub-doc-footer.js?v=2026060977',
        'js/admin/discursos-publicos.js?v=2026060980'
      ],
      initKey: 'JEAdminDiscursos',
      hero: {
        kicker: 'Publicação',
        title: 'Discursos Públicos',
        subtitle: 'Arranjo mensal de oradores recebidos e enviados.',
        showChangelog: false,
        showBack: true
      }
    },
    agendamentos: {
      id: 'agendamentos',
      hash: 'agendamentos',
      permission: 'agendamentos',
      viewId: 'hub-view-agendamentos',
      scripts: [
        'js/admin/agendamentos.js?v=2026060902'
      ],
      initKey: 'JEAdminAgendamentos',
      hero: {
        kicker: 'Organização e campo',
        title: 'Agendamentos',
        subtitle: 'Links de calendário Google — slugs carrinho-* e display-* nas páginas públicas.',
        showChangelog: false,
        showBack: true
      }
    },
    'carrinhos-displays': {
      id: 'carrinhos-displays',
      hash: 'carrinhos-displays',
      permission: 'agendamentos',
      viewId: 'hub-view-carrinhos-displays',
      partial: 'hub/sections/carrinhos-displays.html',
      styles: ['css/hub-sections/carrinhos-displays.css?v=2026061067'],
      scripts: [
        'js/week-input-helpers.js?v=2026060984',
        'js/equipment-schedule-helpers.js?v=2026060968',
        'js/admin/table-xlf.js?v=2026061060',
        'js/territory-column-resize.js?v=2026061066',
        'js/admin/hub-undo.js?v=2026060996',
        'js/admin/carrinhos-displays.js?v=2026061067'
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
    'audio-video': {
      id: 'audio-video',
      hash: 'audio-video',
      permission: 'audio_video',
      viewId: 'hub-view-audio-video',
      partial: 'hub/sections/audio-video.html',
      styles: ['css/hub-sections/audio-video.css?v=2026061048'],
      scripts: [
        'js/admin/audio-video.js?v=2026061048'
      ],
      initKey: 'JEAdminAudioVideo',
      hero: {
        kicker: 'Técnico e mídia',
        title: 'Áudio e Vídeo',
        subtitle: 'Mesa de som, projeção, Zoom, checklists e notas compartilhadas da equipe.',
        showChangelog: false,
        showBack: true
      }
    },
    territorios: {
      id: 'territorios',
      hash: 'territorios',
      permission: 'territorios',
      viewId: 'hub-view-territorios',
      partial: 'hub/sections/territorios.html',
      styles: ['css/hub-sections/territorios.css?v=2026061027'],
      scripts: [
        'js/territory-column-resize.js?v=2026061014',
        'js/admin/hub-undo.js?v=2026060996',
        'js/admin/territory-system.js?v=2026061054'
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
    donativos: {
      id: 'donativos',
      hash: 'donativos',
      permission: 'donativos',
      viewId: 'hub-view-donativos',
      scripts: [
        'js/admin/donativos.js?v=2026060902'
      ],
      initKey: 'JEAdminDonativos',
      hero: {
        kicker: 'Contribuições e sistema',
        title: 'Donativos',
        subtitle: 'Chave PIX, QR code e textos da página de donativos.',
        showChangelog: false,
        showBack: true
      }
    },
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
    configuracoes: {
      id: 'configuracoes',
      hash: 'configuracoes',
      permission: 'settings',
      viewId: 'hub-view-configuracoes',
      partial: 'hub/sections/configuracoes.html',
      styles: ['css/hub-sections/configuracoes.css?v=2026061065'],
      scripts: [
        'js/admin/table-xlf.js?v=2026061058',
        'js/admin/configuracoes.js?v=2026061065'
      ],
      initKey: 'JEAdminConfiguracoes',
      hero: {
        kicker: 'Contribuições e sistema',
        title: 'Equipe e Permissões',
        subtitle: 'Cargos congregacionais, designações de acesso e módulos do Hub.',
        showChangelog: false,
        showBack: true
      }
    }
  };
})();
