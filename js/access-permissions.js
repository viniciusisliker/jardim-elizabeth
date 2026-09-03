(function () {
  const PERMISSION_LABELS = {
    hub: 'Hub',
    agenda: 'Agenda',
    announcements: 'Quadro de Anúncios',
    public_speeches: 'Discursos Públicos',
    agendamentos: 'Agendamentos',
    carrinhos_displays: 'Carrinhos e Displays',
    audio_video: 'Áudio e Vídeo',
    territorios: 'Territórios',
    donativos: 'Donativos',
    secretario: 'Secretário',
    settings: 'Configurações'
  };

  const MODULE_PERMISSIONS = ['agenda', 'announcements', 'public_speeches', 'agendamentos', 'carrinhos_displays', 'audio_video', 'territorios', 'donativos', 'secretario'];

  window.JEAccess = {
    PERMISSION_LABELS,
    MODULE_PERMISSIONS
  };
})();
