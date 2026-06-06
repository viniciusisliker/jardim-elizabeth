(function () {
  const STORAGE_KEY = 'je_hub_changelog_seen';

  const CHANGELOG = {
    version: '2026-06-06',
    items: [
      {
        date: '6 jun 2026',
        tag: 'Territórios',
        icon: 'history',
        title: 'Histórico mais legível',
        body: 'Tabela realinhada e, ao clicar no território, abre o mapa cadastrado no catálogo — direto do histórico.'
      },
      {
        date: '6 jun 2026',
        tag: 'Territórios',
        icon: 'groups',
        title: 'Aba Dirigentes repaginada',
        body: 'Lista compacta com preferência, dias disponíveis, status em campo e formulário rápido para adicionar irmãos.'
      },
      {
        date: '6 jun 2026',
        tag: 'Territórios',
        icon: 'undo',
        title: 'Devolução no estilo cronograma',
        body: 'Cada designação ativa vira uma linha: último dia trabalhado, observação e devolução com um clique.'
      },
      {
        date: '6 jun 2026',
        tag: 'Territórios',
        icon: 'assignment_ind',
        title: 'Designar com resumo ao vivo',
        body: 'Indicadores de disponíveis, dirigentes livres e painel de resumo antes de confirmar a designação.'
      },
      {
        date: '5 jun 2026',
        tag: 'Site',
        icon: 'home',
        title: 'Navbar do site com emojis',
        body: 'Menu público mais visual: ícones em Agenda, Agendamentos, Donativos, Anúncios e Territórios.'
      },
      {
        date: '5 jun 2026',
        tag: 'Discursos Públicos',
        icon: 'sync',
        title: 'Sync com Quadro de Anúncios',
        body: 'Ao salvar o arranjo em Recebemos, o bloco Final de Semana do quadro do mesmo mês é atualizado automaticamente.'
      },
      {
        date: '5 jun 2026',
        tag: 'Quadro de Anúncios',
        icon: 'person',
        title: 'Dirigente de sábado no quadro',
        body: 'Campo no Final de Semana alimenta o cronograma de territórios após publicar o quadro — sábado fica sincronizado.'
      },
      {
        date: '4 jun 2026',
        tag: 'Territórios',
        icon: 'dashboard',
        title: 'Painel e catálogo renovados',
        body: 'Visão geral com estatísticas, prioridades e catálogo compacto com edição em modal; navbar admin centralizada.'
      },
      {
        date: '31 mai 2026',
        tag: 'Acesso',
        icon: 'badge',
        title: 'Designações de acesso',
        body: 'Em Configurações você cria designações (Quadro de Anúncios, Agenda, Territórios…) e atribui aos membros quando quiser — sem depender só do cargo.'
      },
      {
        date: '31 mai 2026',
        tag: 'Quadro de Anúncios',
        icon: 'campaign',
        title: 'Gerenciar quadros salvos',
        body: 'Na aba Quadros: filtre rascunhos e publicados, edite qualquer período com um clique ou exclua rascunhos que não for mais usar.'
      },
      {
        date: '31 mai 2026',
        tag: 'Quadro de Anúncios',
        icon: 'calendar_month',
        title: 'Exportação Google Agenda',
        body: 'Baixe CSV por bloco (Mecânicas, VMC ou Final de semana) e importe direto no Google Calendar da congregação.'
      },
      {
        date: '30 mai 2026',
        tag: 'Hub',
        icon: 'dashboard',
        title: 'Novo layout do Hub',
        body: 'Painel inicial em blocos (bento): cada módulo aparece só se você tiver permissão. Agenda integrada na aba dedicada.'
      },
      {
        date: '30 mai 2026',
        tag: 'Agenda',
        icon: 'event',
        title: 'Formulário de eventos simplificado',
        body: 'Criar eventos ficou mais direto: prévia ao vivo, categorias visuais e campos técnicos ocultos para quem não precisa deles.'
      },
      {
        date: '30 mai 2026',
        tag: 'Correções',
        icon: 'build',
        title: 'Estabilidade e ícones',
        body: 'Correção ao trocar mês no quadro, rodapé com ícones nas páginas admin e navegação do editor mais confiável.'
      }
    ]
  };

  function hasUnseenUpdates() {
    try {
      return localStorage.getItem(STORAGE_KEY) !== CHANGELOG.version;
    } catch {
      return true;
    }
  }

  function markAsSeen() {
    try {
      localStorage.setItem(STORAGE_KEY, CHANGELOG.version);
    } catch {
      /* ignore */
    }
    updateBadge();
  }

  function updateBadge() {
    const badge = document.getElementById('hub-changelog-badge');
    if (!badge) return;
    badge.classList.toggle('hidden', !hasUnseenUpdates());
  }

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderChangelog() {
    const list = document.getElementById('hub-changelog-list');
    if (!list) return;
    list.innerHTML = CHANGELOG.items.map((item) => `
      <article class="hub-changelog-item">
        <div class="hub-changelog-item-icon" aria-hidden="true">
          <span class="material-symbols-outlined">${escapeHtml(item.icon)}</span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2 mb-1">
            <span class="hub-changelog-tag">${escapeHtml(item.tag)}</span>
            <time class="text-[11px] text-on-surface-variant font-medium">${escapeHtml(item.date)}</time>
          </div>
          <h3 class="font-bold text-primary text-sm">${escapeHtml(item.title)}</h3>
          <p class="text-sm text-on-surface-variant mt-1 leading-relaxed">${escapeHtml(item.body)}</p>
        </div>
      </article>
    `).join('');
  }

  function openModal() {
    renderChangelog();
    document.getElementById('hub-changelog-modal')?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    markAsSeen();
  }

  function closeModal() {
    document.getElementById('hub-changelog-modal')?.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function init() {
    updateBadge();
    document.getElementById('hub-changelog-btn')?.addEventListener('click', openModal);
    document.getElementById('hub-changelog-close')?.addEventListener('click', closeModal);
    document.getElementById('hub-changelog-backdrop')?.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('hub-changelog-modal')?.classList.contains('hidden')) {
        closeModal();
      }
    });
  }

  window.JEHubChangelog = {
    init,
    open: openModal,
    version: CHANGELOG.version
  };
})();
