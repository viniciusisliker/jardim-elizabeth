(function () {
  const BRAND = 'Jardim Elizabeth';
  const MAPS = { lat: -23.647024, lng: -46.77835 };
  const ADDRESS_LINES = [
    'Rua Professor Orestes Rosólia, 164',
    'Jardim Rosana, São Paulo – SP',
    'CEP 05795-300'
  ];

  const NAV = [
    { id: 'home', label: 'Início', href: 'index.html', emoji: '🏡', iconOnly: true, visible: true },
    { id: 'agenda', label: 'Agenda', href: 'agenda.html', emoji: '🗓️', visible: true },
    { id: 'agendamentos', label: 'Agendamentos', href: 'agendamentos.html', emoji: '📋', visible: true },
    { id: 'quadrodeanuncios', label: 'Quadro de Anúncios', href: 'quadrodeanuncios.html', emoji: '🔔', visible: true },
    { id: 'territorios', label: 'Territórios', href: 'territorios.html', emoji: '🗺️', visible: true },
    { id: 'donativos', label: 'Donativos', href: 'donativos.html', emoji: '🤲', visible: true }
  ];

  const SHORTCUTS = [
    { href: 'agenda.html', emoji: '🗓️', title: 'Agenda', desc: 'Eventos e reuniões', variant: 'agenda' },
    { href: 'agendamentos.html', emoji: '📋', title: 'Agendamentos', desc: 'Carrinhos e displays', variant: 'agendamentos' },
    { href: 'quadrodeanuncios.html', emoji: '🔔', title: 'Quadro de Anúncios', desc: 'Avisos da congregação', variant: 'anuncios' },
    { href: 'territorios.html', emoji: '🗺️', title: 'Territórios', desc: 'Mapas do serviço de campo', variant: 'territorios' },
    { href: 'donativos.html', emoji: '🤲', title: 'Donativos', desc: 'Contribuições via PIX', variant: 'donativos' }
  ];

  const NEWS = [
    { icon: 'tune', text: 'Home mais simples e direta' },
    { icon: 'search', text: 'Busca rápida na Agenda' },
    { icon: 'smartphone', text: 'Melhor uso no celular' },
    { icon: 'label', text: 'Nomes T01–T19 corrigidos' }
  ];

  function pageHero(title, subtitle, crumb, pill) {
    return {
      crumb: crumb || title,
      title,
      subtitle,
      statusPill: pill || ''
    };
  }

  function defaults() {
    return {
      version: 1,
      global: {
        brandName: BRAND,
        logoUrl: 'img/icon.png?v=2026060937',
        nav: NAV.map((n) => ({ ...n })),
        footer: {
          kicker: 'Encontre-nos',
          headline: 'Estamos prontos para recebê-lo',
          location: { lines: [...ADDRESS_LINES], maps: { ...MAPS } },
          meetings: [
            { day: 'Qua', detail: 'Quartas-feiras às 19h30' },
            { day: 'Sáb', detail: 'Sábados às 19h30' }
          ],
          email: 'elizabeth49577@gmail.com',
          copyright: `© ${new Date().getFullYear()} ${BRAND}. Todos os direitos reservados.`,
          mobileLocation: 'Jardim Rosana · São Paulo'
        }
      },
      home: {
        hero: {
          eyebrow: 'Salão do Reino',
          eyebrowIcon: 'meeting_room',
          title: `Congregação ${BRAND}`,
          imageUrl: 'img/cong.jpg',
          imageAlt: `Salão do Reino da Congregação ${BRAND}`
        },
        shortcuts: {
          kicker: 'Navegação',
          title: 'Acesso rápido',
          items: SHORTCUTS.map((s) => ({ ...s }))
        },
        week: {
          kicker: 'Resumo',
          title: 'Esta semana'
        },
        meeting: {
          label: 'Próxima reunião',
          time: 'Início às 19h30',
          placeName: 'Salão do Reino',
          addressLines: ADDRESS_LINES.slice(0, 2),
          maps: { ...MAPS }
        },
        news: {
          title: 'Novidades',
          items: NEWS.map((n) => ({ ...n }))
        }
      },
      pages: {
        agenda: pageHero(
          'Agenda da Congregação',
          'Reuniões, eventos especiais e datas importantes organizados por mês.',
          'Agenda',
          'Atualizado — 2026'
        ),
        agendamentos: {
          ...pageHero(
            'Agendamentos',
            'Organize sua participação no testemunho público de forma simples e harmoniosa.',
            'Agendamentos',
            'Calendários online'
          ),
          intro: { bold: 'Escolha o equipamento', text: 'abaixo para abrir o calendário e reservar seu turno.' },
          steps: [
            'Selecione Carrinhos ou Displays',
            'Consulte as datas disponíveis no calendário',
            'Confirme seu agendamento no Google Calendar'
          ]
        },
        quadrodeanuncios: {
          ...pageHero(
            'Quadro de Anúncios',
            'Designações, programações e informações importantes da congregação — sempre atualizadas para o mês corrente.',
            'Quadro de Anúncios',
            'Atualizado — 2026'
          ),
          intro: { bold: 'Escolha uma seção', text: 'abaixo para abrir o PDF do mês corrente no Google Drive.' }
        },
        territorios: pageHero(
          'Territórios',
          'Mapas das áreas de pregação da congregação — busque e amplie cada território.',
          'Territórios',
          '19 territórios · 2026'
        ),
        donativos: {
          ...pageHero(
            'Donativos',
            'Contribua com a congregação de forma simples e segura via PIX.',
            'Donativos',
            ''
          ),
          steps: [
            'Copie a chave ou escaneie o QR Code',
            'Abra o app do seu banco e escolha PIX',
            'Confirme o valor e finalize o pagamento'
          ]
        },
        carrinhos: {
          ...pageHero(
            'Carrinhos',
            'Testemunho público móvel — escolha o horário e reserve seu turno no calendário abaixo.',
            'Carrinhos',
            'Google Calendar'
          ),
          introText: 'Selecione o equipamento e o horário, depois preencha o formulário com seu <strong>nome</strong>, <strong>sobrenome</strong>, <strong>e-mail</strong> e o nome dos <strong>três irmãos</strong> que participarão do arranjo.'
        },
        displays: {
          ...pageHero(
            'Displays',
            'Expositores de mesa em locais fixos — escolha o horário e confirme sua reserva.',
            'Displays',
            'Google Calendar'
          ),
          introText: 'Selecione o equipamento e o horário, depois preencha o formulário com seu <strong>nome</strong>, <strong>sobrenome</strong>, <strong>e-mail</strong> e o nome dos <strong>três irmãos</strong> que participarão do arranjo.'
        }
      }
    };
  }

  const PAGE_META = {
    global: { label: 'Site (global)', preview: 'index.html', group: 'site' },
    home: { label: 'Início', preview: 'index.html', group: 'site' },
    agenda: { label: 'Agenda', preview: 'agenda.html', group: 'site' },
    agendamentos: { label: 'Agendamentos', preview: 'agendamentos.html', group: 'site' },
    quadrodeanuncios: { label: 'Quadro de Anúncios', preview: 'quadrodeanuncios.html', group: 'site' },
    territorios: { label: 'Territórios', preview: 'territorios.html', group: 'site' },
    donativos: { label: 'Donativos', preview: 'donativos.html', group: 'site' },
    carrinhos: { label: 'Carrinhos', preview: 'carrinhos.html', group: 'site' },
    displays: { label: 'Displays', preview: 'displays.html', group: 'site' }
  };

  const SITE_PAGE_IDS = Object.keys(PAGE_META).filter((k) => k !== 'global');

  window.JESiteConfigSchema = {
    defaults,
    PAGE_META,
    SITE_PAGE_IDS,
    deepMerge(base, patch) {
      if (!patch || typeof patch !== 'object') return base;
      const out = Array.isArray(base) ? [...base] : { ...base };
      Object.keys(patch).forEach((key) => {
        const pv = patch[key];
        const bv = out[key];
        if (pv && typeof pv === 'object' && !Array.isArray(pv) && bv && typeof bv === 'object' && !Array.isArray(bv)) {
          out[key] = window.JESiteConfigSchema.deepMerge(bv, pv);
        } else {
          out[key] = pv;
        }
      });
      return out;
    },
    normalize(raw) {
      return window.JESiteConfigSchema.deepMerge(defaults(), raw || {});
    }
  };
})();
