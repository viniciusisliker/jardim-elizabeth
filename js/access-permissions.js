(function () {
  const PERMISSION_LABELS = {
    hub: 'Hub',
    agenda: 'Agenda',
    announcements: 'Quadro de Anúncios',
    agendamentos: 'Agendamentos',
    territorios: 'Territórios',
    donativos: 'Donativos',
    settings: 'Configurações'
  };

  const MODULE_PERMISSIONS = ['agenda', 'announcements', 'agendamentos', 'territorios', 'donativos'];

  window.JEAccess = {
    PERMISSION_LABELS,
    MODULE_PERMISSIONS
  };
})();
