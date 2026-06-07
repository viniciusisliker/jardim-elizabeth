(function () {
  const { guardPermission, getClient, showToast } = window.JEAdmin;

  const CHECKLISTS = [
    {
      id: 'midweek',
      title: 'Reunião do meio de semana',
      items: [
        'Chegar com antecedência para preparar o salão',
        'Ligar mesa de som, projetor/TV e notebook',
        'Testar microfone de púlpito e auxiliar',
        'Ajustar níveis de volume no mixer',
        'Confirmar projeção da mídia (JW Library / vídeos)',
        'Verificar gravação ou transmissão, se aplicável',
        'Acompanhar entradas e saídas de microfone durante a reunião',
        'Desligar equipamentos e organizar cabos ao final'
      ]
    },
    {
      id: 'weekend',
      title: 'Reunião de fim de semana',
      items: [
        'Preparar áudio e vídeo antes do discurso público',
        'Testar microfones para orador e presidentes',
        'Confirmar projeção de imagens e vídeos da reunião',
        'Ajustar volume para música e partes da reunião',
        'Verificar transmissão ao vivo, se houver',
        'Apoiar entradas de visitantes no microfone auxiliar',
        'Guardar equipamentos após a reunião'
      ]
    },
    {
      id: 'special',
      title: 'Assembleia / evento especial',
      items: [
        'Revisar programação e horários com antecedência',
        'Testar todos os microfones e entradas do mixer',
        'Confirmar câmeras, gravação e transmissão',
        'Verificar backup de cabos e adaptadores',
        'Combinar sinalização com o responsável do evento',
        'Manter contato com o ancião de apoio durante o evento',
        'Fazer checklist final ao encerrar'
      ]
    }
  ];

  const STORAGE_PREFIX = 'je-av-check-';

  function toastEl() {
    return document.getElementById('hub-admin-toast') || document.getElementById('admin-toast');
  }

  function moveNavIndicator(tab) {
    const nav = document.querySelector('.av-nav');
    const indicator = nav?.querySelector('.av-nav-indicator');
    if (!nav || !indicator || !tab) return;
    indicator.style.width = `${tab.offsetWidth}px`;
    indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
  }

  function setupTabs() {
    const tabs = document.querySelectorAll('[data-av-tab]');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.av-panel').forEach((panel) => {
          panel.classList.toggle('active', panel.id === `av-panel-${tab.dataset.avTab}`);
        });
        moveNavIndicator(tab);
      });
    });
    moveNavIndicator(document.querySelector('[data-av-tab].active'));
    window.addEventListener('resize', () => {
      moveNavIndicator(document.querySelector('[data-av-tab].active'));
    });
  }

  function readChecklistState(id) {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function writeChecklistState(id, state) {
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(state));
  }

  function updateChecklistProgress(card, checklist) {
    const progress = card.querySelector('.av-checklist__progress');
    if (!progress) return;
    const total = checklist.items.length;
    const done = checklist.items.filter((_, idx) => readChecklistState(checklist.id)[idx]).length;
    progress.textContent = `${done} de ${total} concluído${done === 1 ? '' : 's'}`;
  }

  function renderChecklists() {
    const root = document.getElementById('av-checklists');
    if (!root) return;

    root.innerHTML = CHECKLISTS.map((checklist) => {
      const state = readChecklistState(checklist.id);
      const itemsHtml = checklist.items.map((label, idx) => `
        <li>
          <label class="av-check-item">
            <input type="checkbox" data-av-check="${checklist.id}" data-av-check-idx="${idx}" ${state[idx] ? 'checked' : ''}/>
            <span>${label}</span>
          </label>
        </li>`).join('');

      return `
        <article class="av-checklist" data-av-checklist="${checklist.id}">
          <div class="av-checklist__head">
            <h3>${checklist.title}</h3>
            <p class="av-checklist__progress">—</p>
          </div>
          <ul class="av-checklist__list">${itemsHtml}</ul>
        </article>`;
    }).join('');

    CHECKLISTS.forEach((checklist) => {
      const card = root.querySelector(`[data-av-checklist="${checklist.id}"]`);
      if (card) updateChecklistProgress(card, checklist);
    });
  }

  function bindChecklistEvents() {
    const root = document.getElementById('av-checklists');
    if (!root || root.dataset.bound === '1') return;
    root.dataset.bound = '1';

    root.addEventListener('change', (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || !input.dataset.avCheck) return;
      const id = input.dataset.avCheck;
      const idx = Number(input.dataset.avCheckIdx);
      const state = readChecklistState(id);
      state[idx] = input.checked;
      writeChecklistState(id, state);
      const card = root.querySelector(`[data-av-checklist="${id}"]`);
      const checklist = CHECKLISTS.find((c) => c.id === id);
      if (card && checklist) updateChecklistProgress(card, checklist);
    });
  }

  function resetChecklists() {
    if (!confirm('Limpar todas as marcações dos checklists neste navegador?')) return;
    CHECKLISTS.forEach((checklist) => localStorage.removeItem(`${STORAGE_PREFIX}${checklist.id}`));
    renderChecklists();
    showToast(toastEl(), 'Checklists limpos.');
  }

  async function loadNotes(client) {
    const { data } = await client.from('site_settings').select('value').eq('key', 'audio_video').maybeSingle();
    const value = data?.value || {};
    document.getElementById('av-team-notes').value = value.team_notes || '';
    document.getElementById('av-contacts').value = value.contacts || '';
  }

  function bindNotesForm(client) {
    const form = document.getElementById('av-notes-form');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const value = {
        team_notes: document.getElementById('av-team-notes').value.trim(),
        contacts: document.getElementById('av-contacts').value.trim()
      };
      const { error } = await client.from('site_settings').upsert({ key: 'audio_video', value });
      if (error) showToast(toastEl(), error.message, true);
      else showToast(toastEl(), 'Notas salvas.');
    });
  }

  async function init() {
    if (window.__JEAdminAudioVideoInit) return;
    window.__JEAdminAudioVideoInit = true;

    const profile = await guardPermission('audio_video');
    if (!profile) return false;

    setupTabs();
    renderChecklists();
    bindChecklistEvents();
    document.getElementById('av-btn-reset-checklists')?.addEventListener('click', resetChecklists);

    const client = await getClient();
    await loadNotes(client);
    bindNotesForm(client);
    return true;
  }

  window.JEAdminAudioVideo = { init };
})();
