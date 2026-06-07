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
      styles: ['css/hub-sections/anuncios.css?v=2026060902'],
      scripts: [
        'js/admin-core.js?v=2026060902',
        'js/admin/announcement-theme.js',
        'js/admin/announcement-dates.js',
        'js/admin/weekend-discursos-sync.js?v=2026060527',
        'js/admin/announcement-schemas.js?v=2026060526',
        'js/admin/anuncios-export.js?v=2026060526',
        'js/admin/anuncios-pdf.js?v=2026060526',
        'js/admin/anuncios.js?v=2026060902'
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
      styles: ['css/hub-sections/discursos.css?v=2026060902'],
      scripts: [
        'js/admin-core.js?v=2026060902',
        'js/admin/discursos-publicos.js?v=2026060902'
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
        'js/admin-core.js?v=2026060902',
        'js/admin/agendamentos.js?v=2026060902'
      ],
      initKey: 'JEAdminAgendamentos',
      hero: {
        kicker: 'Organização e campo',
        title: 'Agendamentos',
        subtitle: 'Calendários Google em Carrinhos e Displays — slugs carrinho-* e display-*.',
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
      styles: ['css/hub-sections/territorios.css?v=2026060902'],
      scripts: [
        'js/admin-core.js?v=2026060902',
        'js/territory-assignment-helpers.js?v=2026060624',
        'js/admin/territory-system.js?v=2026060904'
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
        'js/admin-core.js?v=2026060902',
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
    configuracoes: {
      id: 'configuracoes',
      hash: 'configuracoes',
      permission: 'settings',
      viewId: 'hub-view-configuracoes',
      partial: 'hub/sections/configuracoes.html',
      styles: ['css/hub-sections/configuracoes.css?v=2026060902'],
      scripts: [
        'js/admin-core.js?v=2026060902',
        'js/admin/configuracoes.js?v=2026060902'
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
