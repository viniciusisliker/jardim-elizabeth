// "Quadro de hoje": designações do dia (ou da próxima reunião) lidas dos quadros publicados.
(function () {
  const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const BLOCK_ORDER = ['mecanicas', 'midweek', 'weekend'];
  const LOOKAHEAD_DAYS = 14;
  const HTML2CANVAS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function val(v) {
    return String(v ?? '').trim();
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function toIso(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function dateOf(iso) {
    return new Date(`${iso}T12:00:00`);
  }

  function longDate(iso) {
    const d = dateOf(iso);
    return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())} de ${MONTHS[d.getMonth()]}`;
  }

  // ---------- dados ----------

  async function fetchUpcomingEntries() {
    const client = await window.JEAuth?.getClient?.();
    if (!client) return null;
    const today = new Date();
    const until = new Date(today);
    until.setDate(until.getDate() + LOOKAHEAD_DAYS);
    const { data, error } = await client
      .from('announcement_entries')
      .select('block, event_date, sort_order, data, announcement_boards!inner(status, published_at)')
      .eq('announcement_boards.status', 'published')
      .in('block', BLOCK_ORDER)
      .gte('event_date', toIso(today))
      .lte('event_date', toIso(until))
      .order('event_date');
    if (error) {
      console.warn('quadro-hoje:', error.message);
      return null;
    }
    return data || [];
  }

  // Primeira data com designação; se houver dois quadros publicados, vale o mais recente.
  function pickDay(entries) {
    if (!entries.length) return null;
    const date = entries[0].event_date;
    const byBlock = {};
    entries.filter((e) => e.event_date === date).forEach((e) => {
      const cur = byBlock[e.block];
      const pub = e.announcement_boards?.published_at || '';
      if (!cur || pub > (cur.announcement_boards?.published_at || '')) byBlock[e.block] = e;
    });
    return { date, entries: BLOCK_ORDER.map((b) => byBlock[b]).filter(Boolean) };
  }

  // ---------- render ----------

  function sheet(mod, kicker, title, iso, body, meta) {
    return `
      <article class="je-qh-sheet je-qh-sheet--${mod}">
        <div class="je-qh-sheet__paper" data-je-qh-capture>
          <header class="je-qh-sheet__banner">
            <div>
              <p class="je-qh-sheet__kicker">${esc(kicker)}</p>
              <h3 class="je-qh-sheet__title">${esc(title)}</h3>
            </div>
            <p class="je-qh-sheet__date">${esc(longDate(iso))}</p>
          </header>
          ${meta ? `<div class="je-qh-sheet__meta">${meta}</div>` : ''}
          <div class="je-qh-sheet__body">${body}</div>
          <footer class="je-qh-sheet__foot">Congregação Jardim Elizabeth</footer>
        </div>
        <button type="button" class="je-qh-save" data-je-qh-save="${esc(`${mod}-${iso}`)}">
          <span class="material-symbols-outlined" aria-hidden="true">download</span>
          Salvar imagem
        </button>
      </article>`;
  }

  function renderMecanicas(entry) {
    const d = entry.data || {};
    const r = (label, v) => row(null, label, val(v) || '—');
    const body = [
      section('indicadores', 'badge', 'Indicadores', [r('Portão', d.portao), r('Auditório', d.indicador)]),
      section('audio', 'mic', 'Som e microfones', [
        r('Som', d.som), r('Mic. volante 1', d.microf_volantes_1), r('Mic. volante 2', d.microf_volantes_2)
      ]),
      section('limpeza', 'cleaning_services', 'Limpeza', [r('Grupo', d.limpeza_grupo)])
    ].join('');
    return sheet('org', 'Organização', 'Designações Mecânicas', entry.event_date, body);
  }

  function row(num, label, name, extra) {
    if (!val(label) && !val(name) && !extra) return '';
    return `
      <li class="je-qh-row">
        <span class="je-qh-row__num">${num ? `${num}.` : ''}</span>
        <span class="je-qh-row__label">${esc(label)}</span>
        <span class="je-qh-row__name">${esc(val(name))}${extra || ''}</span>
      </li>`;
  }

  function extra(label, v) {
    return val(v) ? `<span class="je-qh-row__extra"><b>${esc(label)}</b> ${esc(val(v))}</span>` : '';
  }

  function section(theme, icon, title, rows) {
    const content = rows.filter(Boolean).join('');
    if (!content) return '';
    return `
      <section class="je-qh-sec je-qh-sec--${theme}">
        <h4 class="je-qh-sec__title"><span class="material-symbols-outlined" aria-hidden="true">${icon}</span>${esc(title)}</h4>
        <ul class="je-qh-sec__rows">${content}</ul>
      </section>`;
  }

  // Mesma numeração do PDF (js/admin/anuncios-pdf.js → pmMidweekMeeting).
  function renderMidweek(entry) {
    const d = entry.data || {};
    const ministerio = [1, 2, 3, 4].map((i) => {
      const tipo = val(d[`ministerio_${i}_tipo`]);
      const people = d[`ministerio_${i}_designados`];
      const salaB = d[`ministerio_${i}_sala_b`];
      if (!tipo && !val(people) && !val(salaB)) return '';
      return row(i + 3, tipo || `Parte ${i}`, people, extra('Sala B', salaB));
    });
    const lastMin = ministerio.reduce((last, r, idx) => (r ? idx + 1 : last), 0);
    const vidaNum = 4 + Math.max(3, lastMin);

    const meta = [
      val(d.leitura_biblica) ? `<span><b>Leitura</b> ${esc(val(d.leitura_biblica))}</span>` : '',
      val(d.cantico) ? `<span><b>Cântico</b> ${esc(val(d.cantico))}</span>` : '',
      val(d.presidente) ? `<span><b>Presidente</b> ${esc(val(d.presidente))}</span>` : ''
    ].join('');

    const body = [
      section('tesouros', 'diamond', 'Tesouros da Palavra de Deus', [
        row(1, val(d.tesouros_titulo) || 'Tesouros da Palavra de Deus', d.tesouros_designado),
        row(2, 'Joias espirituais', d.joias_designado, extra('Dirigente Sala B', d.dirigente_sala_b)),
        row(3, 'Leitura da Bíblia', d.leitura_biblia, extra('Sala B', d.leitura_biblia_sala_b))
      ]),
      section('ministerio', 'grass', 'Faça seu melhor no ministério', ministerio),
      section('vida', 'groups', 'Nossa vida cristã', [
        row(vidaNum, val(d.vida_crista_titulo) || 'Nossa vida cristã', d.vida_crista_designado),
        row(vidaNum + 1, 'Estudo bíblico de congregação', d.estudo_dirigente, extra('Leitor', d.leitor_sentinela)),
        val(d.oracao_final) ? row(null, 'Oração final', d.oracao_final) : ''
      ])
    ].join('');

    return sheet('midweek', 'Meio de semana', 'Nossa Vida e Ministério Cristão', entry.event_date, body, meta);
  }

  function renderWeekend(entry) {
    const d = entry.data || {};
    const title = 'Discurso Público e Estudo de A Sentinela';
    const special = val(d.evento_especial);
    if (special) {
      return sheet('weekend', 'Final de semana', title, entry.event_date, `
        <div class="je-qh-special">
          <span class="je-qh-special__kicker">Programa alternativo</span>
          <strong>${esc(special)}</strong>
        </div>`);
    }

    const enviados = String(d.oradores_enviados || '').split(/\r?\n/).map(val).filter(Boolean).map((line) => {
      const [name, ...rest] = line.split(/\s+[—–-]\s+/);
      return row(null, 'Orador', name, extra('Congregação', rest.join(' — ')));
    });

    const body = [
      section('territorio', 'map', 'Trabalho de campo', [row(null, 'Dirigente', d.dirigente_sabado)]),
      section('discurso', 'mic', 'Discurso público', [
        val(d.presidente) ? row(null, 'Presidente', d.presidente) : '',
        val(d.tema_discurso) ? row(null, 'Tema', d.tema_discurso) : '',
        val(d.orador) ? row(null, 'Orador', d.orador, extra('Congregação', d.congregacao_orador)) : ''
      ]),
      section('sentinela', 'menu_book', 'Estudo de A Sentinela', [
        val(d.estudo_sentinela_tema) ? row(null, 'Tema', d.estudo_sentinela_tema) : '',
        val(d.cantico_sentinela) ? row(null, 'Cântico', d.cantico_sentinela) : '',
        val(d.leitor_sentinela) ? row(null, 'Leitor', d.leitor_sentinela) : '',
        val(d.cantico_final) ? row(null, 'Cântico final', d.cantico_final) : '',
        val(d.oracao_final) ? row(null, 'Oração final', d.oracao_final) : ''
      ]),
      section('enviados', 'outbound', 'Oradores enviados', enviados)
    ].join('') || '<p class="je-qh-empty-line">Sem designações preenchidas.</p>';

    return sheet('weekend', 'Final de semana', title, entry.event_date, body);
  }

  const RENDERERS = { mecanicas: renderMecanicas, midweek: renderMidweek, weekend: renderWeekend };

  // ---------- salvar imagem ----------

  let html2canvasPromise = null;
  function loadHtml2Canvas() {
    if (window.html2canvas) return Promise.resolve();
    if (!html2canvasPromise) {
      html2canvasPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = HTML2CANVAS_SRC;
        s.onload = resolve;
        s.onerror = () => {
          html2canvasPromise = null;
          reject(new Error('Não foi possível carregar o gerador de imagem.'));
        };
        document.head.appendChild(s);
      });
    }
    return html2canvasPromise;
  }

  async function saveImage(btn) {
    const paper = btn.closest('.je-qh-sheet')?.querySelector('[data-je-qh-capture]');
    if (!paper || btn.disabled) return;
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">hourglass_top</span> Gerando…';
    try {
      await loadHtml2Canvas();
      await document.fonts?.ready;
      const canvas = await window.html2canvas(paper, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('Falha ao gerar a imagem.');
      const filename = `quadro-${btn.dataset.jeQhSave}.png`;
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Quadro de hoje' });
          return;
        } catch (err) {
          if (err?.name === 'AbortError') return;
        }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (err) {
      console.warn('quadro-hoje:', err);
      alert(err?.message || 'Não foi possível gerar a imagem.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = label;
    }
  }

  // ---------- init ----------

  async function init() {
    const root = document.getElementById('je-quadro-hoje');
    if (!root) return;
    const list = root.querySelector('[data-je-qh-list]');
    const pill = root.querySelector('[data-je-qh-pill]');

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-je-qh-save]');
      if (btn) saveImage(btn);
    });

    const entries = await fetchUpcomingEntries();
    const day = entries ? pickDay(entries) : null;
    if (!day) {
      root.classList.add('hidden');
      return;
    }

    const isToday = day.date === toIso(new Date());
    root.querySelector('[data-je-qh-title]').textContent = isToday ? 'Quadro de hoje' : 'Próxima reunião';
    if (pill) pill.textContent = isToday ? 'Hoje' : longDate(day.date);
    list.innerHTML = day.entries.map((e) => RENDERERS[e.block](e)).join('');
    list.classList.toggle('je-qh-list--single', day.entries.length === 1);
    root.classList.remove('hidden');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
