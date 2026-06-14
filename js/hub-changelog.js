(function () {
  const STORAGE_KEY = 'je_hub_changelog_seen';

  const CHANGELOG = {
    version: '2026-06-15',
    items: [
      {
        date: '15 jun 2026',
        tag: 'Hub',
        icon: 'share',
        title: 'Compartilhar app e melhorias',
        body: 'Após instalar, o botão vira Compartilhar app (como no Nexus). Busca de módulos, recentes, push no celular, cache offline leve e link Google Maps nos territórios.'
      },
      {
        date: '24 jun 2026',
        tag: 'Hub',
        icon: 'notifications',
        title: 'Notificações e app no celular',
        body: 'Sino no Hub para avisos da equipe. Instale o site na tela inicial pelo botão Baixar app — no celular aparece um banner de sugestão.'
      },
      {
        date: '9 jun 2026',
        tag: 'Meu Perfil',
        icon: 'account_circle',
        title: 'Sua foto no site',
        body: 'No menu do seu usuário, abra Meu Perfil para colocar ou trocar sua foto. Ela aparece no menu e no Hub.'
      },
      {
        date: '9 jun 2026',
        tag: 'Territórios',
        icon: 'filter_list',
        title: 'Filtros em todas as colunas',
        body: 'Nas tabelas de Territórios dá para filtrar e ordenar cada coluna, como numa planilha, para achar informações mais rápido.'
      },
      {
        date: '9 jun 2026',
        tag: 'Territórios',
        icon: 'priority_high',
        title: 'Prioridade no cronograma',
        body: 'O botão vermelho Disponíveis no cronograma mostra quais territórios precisam de atenção, em uma lista fácil de consultar.'
      },
      {
        date: '7 jun 2026',
        tag: 'Agenda',
        icon: 'search',
        title: 'Busca na Agenda',
        body: 'Pesquise eventos pelo nome, veja quantos resultados apareceram e limpe a busca com um clique.'
      },
      {
        date: '7 jun 2026',
        tag: 'Site',
        icon: 'smartphone',
        title: 'Melhor no celular',
        body: 'Botões maiores, textos mais legíveis e telas que se adaptam melhor ao celular e ao tablet.'
      },
      {
        date: '7 jun 2026',
        tag: 'Territórios',
        icon: 'label',
        title: 'Nomes dos territórios corrigidos',
        body: 'Os nomes dos 19 territórios (T01 a T19) foram ajustados para ficar iguais aos que aparecem nos mapas.'
      },
      {
        date: '7 jun 2026',
        tag: 'Territórios',
        icon: 'search',
        title: 'Busca no site de Territórios',
        body: 'Barra de busca no site público de territórios, com contador de resultados e botão para limpar.'
      },
      {
        date: '6 jun 2026',
        tag: 'Equipe',
        icon: 'group',
        title: 'Tela de Equipe e Permissões',
        body: 'Lista de membros mais clara, com busca por nome e forma simples de ver quem pode acessar cada área.'
      },
      {
        date: '6 jun 2026',
        tag: 'Territórios',
        icon: 'image',
        title: 'Mapas voltaram a aparecer',
        body: 'As imagens dos mapas no histórico carregam de novo. Toque no território para ver o mapa em tela cheia.'
      },
      {
        date: '6 jun 2026',
        tag: 'Territórios',
        icon: 'history',
        title: 'Histórico mais fácil de ler',
        body: 'Tabela reorganizada. Ao tocar em um território no histórico, o mapa cadastrado abre na hora.'
      },
      {
        date: '6 jun 2026',
        tag: 'Territórios',
        icon: 'groups',
        title: 'Aba Dirigentes',
        body: 'Lista dos irmãos aptos a receber território, com dias disponíveis e formulário rápido para incluir alguém novo.'
      },
      {
        date: '6 jun 2026',
        tag: 'Territórios',
        icon: 'undo',
        title: 'Devolver território',
        body: 'Cada designação aparece em uma linha com data do último trabalho. Dá para devolver o território com um clique.'
      },
      {
        date: '6 jun 2026',
        tag: 'Territórios',
        icon: 'assignment_ind',
        title: 'Designar território',
        body: 'Antes de confirmar, você vê um resumo: quantos estão disponíveis, quem está livre e o que será designado.'
      },
      {
        date: '5 jun 2026',
        tag: 'Site',
        icon: 'home',
        title: 'Menu do site mais visual',
        body: 'Ícones nas opções Agenda, Agendamentos, Donativos, Anúncios e Territórios para facilitar a navegação.'
      },
      {
        date: '5 jun 2026',
        tag: 'Discursos',
        icon: 'sync',
        title: 'Discursos e Quadro de Anúncios',
        body: 'Ao salvar os discursos recebidos, a parte de Final de Semana do quadro do mesmo mês é atualizada sozinha.'
      },
      {
        date: '5 jun 2026',
        tag: 'Quadro de Anúncios',
        icon: 'person',
        title: 'Dirigente de sábado',
        body: 'O nome do dirigente de sábado no quadro passa automaticamente para o cronograma de territórios.'
      },
      {
        date: '4 jun 2026',
        tag: 'Territórios',
        icon: 'dashboard',
        title: 'Painel de territórios',
        body: 'Visão geral com totais, prioridades e lista completa. Editar um território ficou mais simples.'
      },
      {
        date: '31 mai 2026',
        tag: 'Equipe',
        icon: 'badge',
        title: 'Quem pode acessar o quê',
        body: 'Em Equipe e Permissões você define funções (Quadro, Agenda, Territórios…) e escolhe quem pode usar cada uma.'
      },
      {
        date: '31 mai 2026',
        tag: 'Quadro de Anúncios',
        icon: 'campaign',
        title: 'Gerenciar quadros',
        body: 'Veja rascunhos e publicados, edite qualquer período ou apague rascunhos que não for mais usar.'
      },
      {
        date: '31 mai 2026',
        tag: 'Quadro de Anúncios',
        icon: 'calendar_month',
        title: 'Enviar para o Google Agenda',
        body: 'Baixe um arquivo por bloco (Mecânicas, VMC ou Final de semana) e importe no calendário da congregação.'
      },
      {
        date: '30 mai 2026',
        tag: 'Hub',
        icon: 'dashboard',
        title: 'Novo painel do Hub',
        body: 'Página inicial reorganizada: cada área aparece só se você tiver permissão para usá-la.'
      },
      {
        date: '30 mai 2026',
        tag: 'Agenda',
        icon: 'event',
        title: 'Criar eventos mais fácil',
        body: 'Formulário mais direto, com prévia do evento enquanto você preenche e categorias visuais.'
      },
      {
        date: '30 mai 2026',
        tag: 'Melhorias',
        icon: 'build',
        title: 'Ajustes gerais',
        body: 'Correções ao trocar o mês no quadro, ícones no rodapé e navegação mais estável no editor.'
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
