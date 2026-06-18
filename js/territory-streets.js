(function () {
  /** Ruas e referência de mapa por território (cartões físicos T01–T19). */
  const BY_NUM = {
    '01': {
      streets: [
        'Av. Carlos Lacerda',
        'Estr. Pirajussara',
        'R. Américo Trabulsi',
        'Trav. Carlino C.',
        'Trav. Nair R. Perez',
        'R. Francisco H.',
        'R. dos Milagres',
        'R. Louis Brea',
        'R. Paul Gauguim'
      ],
      mapsQuery: 'Av. Carlos Lacerda e Estr. Pirajussara, Campo Limpo, São Paulo, SP'
    },
    '02': {
      streets: [
        'R. Hermes Ribeiro de Freitas',
        'R. José Cabral',
        'R. Zamitti Mammana',
        'R. Nelson Spilman',
        'R. Januário da C. Barbosa',
        'Viela 2'
      ],
      mapsQuery: 'Rua Hermes Ribeiro de Freitas e Zamitti Mammana, Jardim Elizabeth, São Paulo, SP'
    },
    '03': {
      streets: [
        'R. Hermes Ribeiro de Freitas',
        'R. Aristides de Britto',
        'R. Humberto Benemeritti',
        'R. Januário da Cunha Barbosa',
        'R. José Cabral',
        'Viela'
      ],
      mapsQuery: 'Rua Humberto Benemeritti e Aristides de Britto, Jardim Elizabeth, São Paulo, SP'
    },
    '04': {
      streets: [
        'R. Hermes Ribeiro de Freitas',
        'R. Humberto Benemeritti',
        'Estr. do Campo Limpo',
        'R. Aristides de Brito',
        'R. Benedito de Oliveira',
        'R. Alípio Benedito',
        'R. Antonio Alves Júnior'
      ],
      mapsQuery: 'Rua Aristides de Brito e Benedito de Oliveira, Jardim Elizabeth, São Paulo, SP'
    },
    '05': {
      streets: [
        'R. Januário da Cunha Barbosa',
        'R. Piaga',
        'R. Atucupe',
        'R. Taunã',
        'R. Cabaxi',
        'Viela 3',
        'Viela 4'
      ],
      mapsQuery: 'Rua Piaga e Rua Atucupe, Jardim Elizabeth, São Paulo, SP'
    },
    '06': {
      streets: [
        'R. Martim da Costa Vilela',
        'R. Hermes Ribeiro de Freitas',
        'R. Luis Gonzaga Freire',
        'R. João Correia',
        'Passarela 1',
        'Passagem 1',
        'Passagem 2'
      ],
      mapsQuery: 'Rua Martim da Costa Vilela e Rua Hermes Ribeiro de Freitas, Vila Pirajussara, São Paulo, SP'
    },
    '07': {
      streets: [
        'R. Ramona B. Fernandes',
        'R. da Praia de Miramar',
        'Cel. José Hipólito Trigueirinho',
        'R. Henrique Moreira',
        'R. Gustavo Doré'
      ],
      mapsQuery: 'Rua Ramona B. Fernandes e R. Gustavo Doré, Jardim Iracema, São Paulo, SP'
    },
    '08': {
      streets: [
        'Av. Augusto B. Tavares',
        'R. Ramona B. Fernandes',
        'R. Dr. Dib Gebara',
        'R. Gustave Doré',
        'R. Coronel José Hypolito'
      ],
      mapsQuery: 'Av. Augusto B. Tavares e R. Dr. Dib Gebara, Jardim Iracema, São Paulo, SP'
    },
    '09': {
      streets: [
        'R. Luis Gonzaga Freire',
        'Viela Quatro',
        'R. Nelson Lomanto',
        'R. Osvado de Arruda Reis'
      ],
      mapsQuery: 'Rua Luis Gonzaga Freire e R. Nelson Lomanto, Jardim Elizabeth, São Paulo, SP'
    },
    '10': {
      streets: [
        'Rua Atucupê',
        'R. Cabaxi',
        'Piaga',
        'Taunã',
        'Mitim'
      ],
      mapsQuery: 'Rua Atucupê e Rua Cabaxi, Jardim Elizabeth, São Paulo, SP'
    },
    '11': {
      streets: [
        'Av. Carlos Lacerda',
        'Rua Cabaxi',
        'Rua Tabimã',
        'Rua Ajuruetê',
        'R. Amacás',
        'Apeaçú'
      ],
      mapsQuery: 'Rua Amacás e Av. Carlos Lacerda, Campo Limpo, São Paulo, SP'
    },
    '12': {
      streets: [
        'Av. Carlos Lacerda',
        'Rua Ajuruetê',
        'Rua Tabimã',
        'Rua Crestins'
      ],
      mapsQuery: 'Rua Tabimã e Av. Carlos Lacerda, Campo Limpo, São Paulo, SP'
    },
    '13': {
      streets: ['Conjunto Habitacional CDHU', 'R. Martim da Costa Vilela (entrada)'],
      notes: 'Blocos numerados 01 a 29.',
      mapsQuery: 'CDHU Rua Martim da Costa Vilela, Campo Limpo, São Paulo, SP'
    },
    '14': {
      streets: ['Conjunto Habitacional CDHU', 'R. Martim da Costa Vilela (entrada)'],
      notes: 'Blocos numerados 01 a 29.',
      mapsQuery: 'CDHU Rua Martim da Costa Vilela, Campo Limpo, São Paulo, SP'
    },
    '15': {
      streets: ['Conjunto Habitacional CDHU', 'R. Martim da Costa Vilela (entrada)'],
      notes: 'Blocos numerados 01 a 29.',
      mapsQuery: 'CDHU Rua Martim da Costa Vilela, Campo Limpo, São Paulo, SP'
    },
    '16': {
      streets: [
        'R. Luis Gonzaga Freire',
        'R. Augusto de Moraes',
        'Passagem 1',
        'Passagem 2',
        'CDHU'
      ],
      mapsQuery: 'Rua Augusto de Moraes e Passagem 1, Jardim Helga, São Paulo, SP'
    },
    '17': {
      streets: [
        'R. Augusto de Moraes',
        'R. Thomaz de Araújo',
        'R. Luís Gonzaga Freire'
      ],
      mapsQuery: 'Rua Augusto de Moraes e Rua Thomaz de Araújo, Jardim Helga, São Paulo, SP'
    },
    '18': {
      streets: [
        'R. Guerreiro',
        'R. Luisa Damon',
        'R. Luis Maria Ridel',
        'R. Thomaz de Araújo'
      ],
      mapsQuery: 'Rua Guerreiro e Rua Thomaz de Araújo, Jardim Helga, São Paulo, SP'
    },
    '19': {
      streets: [
        'R. Mitim',
        'R. Ibi',
        'R. Guerreiro',
        'R. Luisa Damon'
      ],
      mapsQuery: 'Rua Mitim e Rua Guerreiro, Jardim Helga, São Paulo, SP'
    }
  };

  function normalizeNum(num) {
    if (num == null || num === '') return '';
    const digits = String(num).replace(/\D/g, '');
    if (!digits) return '';
    return digits.padStart(2, '0');
  }

  function byNum(num) {
    return BY_NUM[normalizeNum(num)] || null;
  }

  function mapsUrl(num) {
    const entry = byNum(num);
    if (!entry?.mapsQuery) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entry.mapsQuery)}`;
  }

  function streetsText(num) {
    const entry = byNum(num);
    if (!entry) return '';
    const parts = [...(entry.streets || [])];
    if (entry.notes) parts.push(entry.notes);
    return parts.join(' · ');
  }

  function formatExtraHtml(num) {
    const entry = byNum(num);
    if (!entry?.streets?.length) return '';
    const items = entry.streets.map((s) => `<li>${s}</li>`).join('');
    const notes = entry.notes
      ? `<p class="je-ter-extra-notes">${entry.notes}</p>`
      : '';
    return `<ul class="je-ter-extra-list">${items}</ul>${notes}`;
  }

  window.JETerritoryStreets = {
    BY_NUM,
    byNum,
    mapsUrl,
    streetsText,
    formatExtraHtml,
    normalizeNum
  };
})();
