(function () {
  /** Metadados das seções do Hub (fase 1: home, agenda, donativos, agendamentos). */
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
    donativos: {
      id: 'donativos',
      hash: 'donativos',
      permission: 'donativos',
      viewId: 'hub-view-donativos',
      scripts: ['js/admin-core.js?v=2026060301', 'js/admin/donativos.js?v=2026060901'],
      initKey: 'JEAdminDonativos',
      hero: {
        kicker: 'Contribuições e sistema',
        title: 'Donativos',
        subtitle: 'Chave PIX, QR code e textos da página de donativos.',
        showChangelog: false,
        showBack: true
      }
    },
    agendamentos: {
      id: 'agendamentos',
      hash: 'agendamentos',
      permission: 'agendamentos',
      viewId: 'hub-view-agendamentos',
      scripts: ['js/admin-core.js?v=2026060301', 'js/admin/agendamentos.js?v=2026060901'],
      initKey: 'JEAdminAgendamentos',
      hero: {
        kicker: 'Organização e campo',
        title: 'Agendamentos',
        subtitle: 'Calendários Google em Carrinhos e Displays — slugs carrinho-* e display-*.',
        showChangelog: false,
        showBack: true
      }
    }
  };
})();
