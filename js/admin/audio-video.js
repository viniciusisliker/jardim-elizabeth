(function () {
  const { guardPermission, getClient, showToast, escapeHtml } = window.JEAdmin;

  const MEETING_LABELS = {
    midweek: 'Meio de semana',
    weekend: 'Final de semana'
  };

  let attendanceLogs = [];
  let extraAttendanceEnabled = false;
  let editingAttendanceId = null;

  const CHECKLISTS = [
    {
      id: 'midweek',
      title: 'Reunião do meio de semana',
      icon: 'calendar_today',
      sections: [
        {
          id: 'prep',
          label: 'Pré-reunião',
          icon: 'schedule',
          items: [
            'Chegar com antecedência para preparar o salão',
            'Ligar mesa de som, projetor/TV e notebook',
            'Testar microfone de púlpito e auxiliar',
            'Ajustar níveis de volume no mixer'
          ]
        },
        {
          id: 'zoom',
          label: 'Zoom',
          icon: 'videocam',
          items: [
            'Abrir a reunião Zoom com 15–30 min de antecedência',
            'Testar microfone, câmera e áudio do computador no Zoom',
            'Ativar transmissão quando o salão estiver pronto',
            'Compartilhar tela ou mídia (JW Library / vídeos)',
            'Monitorar participantes remotos e chat durante a reunião'
          ]
        },
        {
          id: 'during',
          label: 'Durante',
          icon: 'play_circle',
          items: [
            'Confirmar projeção da mídia no salão',
            'Acompanhar entradas e saídas de microfone',
            'Verificar gravação na nuvem, se aplicável'
          ]
        },
        {
          id: 'close',
          label: 'Encerramento',
          icon: 'power_settings_new',
          items: [
            'Encerrar compartilhamento de tela e transmissão Zoom',
            'Desligar equipamentos e organizar cabos'
          ]
        }
      ]
    },
    {
      id: 'weekend',
      title: 'Reunião de fim de semana',
      icon: 'event',
      sections: [
        {
          id: 'prep',
          label: 'Pré-reunião',
          icon: 'schedule',
          items: [
            'Preparar áudio e vídeo antes do discurso público',
            'Testar microfones para orador e presidentes',
            'Confirmar projeção de imagens e vídeos no salão'
          ]
        },
        {
          id: 'zoom',
          label: 'Zoom',
          icon: 'videocam',
          items: [
            'Abrir Zoom cedo e testar microfone e câmera',
            'Conferir qualidade de áudio para participantes remotos',
            'Ativar transmissão ao vivo antes do discurso',
            'Compartilhar tela ou vídeos da reunião quando necessário',
            'Destacar orador ou vídeo para quem assiste online'
          ]
        },
        {
          id: 'during',
          label: 'Durante',
          icon: 'play_circle',
          items: [
            'Ajustar volume para música e partes da reunião',
            'Apoiar visitantes no microfone auxiliar'
          ]
        },
        {
          id: 'close',
          label: 'Encerramento',
          icon: 'power_settings_new',
          items: [
            'Encerrar transmissão Zoom e gravação na nuvem',
            'Guardar equipamentos após a reunião'
          ]
        }
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

  function checklistItems(checklist) {
    return checklist.sections.flatMap((section) => section.items);
  }

  function checklistProgress(checklist) {
    const state = readChecklistState(checklist.id);
    const items = checklistItems(checklist);
    const done = items.filter((_, idx) => state[idx]).length;
    return { done, total: items.length };
  }

  function updateChecklistProgress(card, checklist) {
    const progress = card.querySelector('.av-checklist__progress');
    const bar = card.querySelector('.av-checklist__bar-fill');
    const { done, total } = checklistProgress(checklist);
    const pct = total ? Math.round((done / total) * 100) : 0;
    if (progress) {
      progress.textContent = `${done} de ${total} concluído${done === 1 ? '' : 's'}`;
    }
    if (bar) {
      bar.style.width = `${pct}%`;
    }
    const barWrap = card.querySelector('.av-checklist__bar');
    if (barWrap) barWrap.setAttribute('aria-valuenow', String(pct));
    card.classList.toggle('av-checklist--done', total > 0 && done === total);
    card.dataset.progress = String(pct);
  }

  function renderChecklistSections(checklist, state) {
    let idx = 0;
    return checklist.sections.map((section) => {
      const itemsHtml = section.items.map((label) => {
        const currentIdx = idx;
        idx += 1;
        const checked = !!state[currentIdx];
        return `
          <li>
            <label class="av-check-item${checked ? ' av-check-item--done' : ''}">
              <input type="checkbox" data-av-check="${checklist.id}" data-av-check-idx="${currentIdx}" ${checked ? 'checked' : ''}/>
              <span class="av-check-item__box" aria-hidden="true"></span>
              <span class="av-check-item__text">${label}</span>
            </label>
          </li>`;
      }).join('');
      return `
        <div class="av-checklist__section">
          <h4 class="av-checklist__section-title">
            <span class="material-symbols-outlined" aria-hidden="true">${section.icon}</span>
            ${section.label}
          </h4>
          <ul class="av-checklist__list">${itemsHtml}</ul>
        </div>`;
    }).join('');
  }

  function renderChecklists() {
    const root = document.getElementById('av-checklists');
    if (!root) return;

    root.innerHTML = CHECKLISTS.map((checklist) => {
      const state = readChecklistState(checklist.id);
      return `
        <article class="av-checklist" data-av-checklist="${checklist.id}">
          <div class="av-checklist__head">
            <div class="av-checklist__title-row">
              <span class="av-checklist__icon" aria-hidden="true">
                <span class="material-symbols-outlined">${checklist.icon}</span>
              </span>
              <div class="av-checklist__title-wrap">
                <h3>${checklist.title}</h3>
                <p class="av-checklist__progress">—</p>
              </div>
              <button type="button" class="av-checklist__reset" data-av-reset-checklist="${checklist.id}" title="Limpar este checklist">
                <span class="material-symbols-outlined" aria-hidden="true">restart_alt</span>
              </button>
            </div>
            <div class="av-checklist__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
              <span class="av-checklist__bar-fill"></span>
            </div>
          </div>
          <div class="av-checklist__body">${renderChecklistSections(checklist, state)}</div>
        </article>`;
    }).join('');

    CHECKLISTS.forEach((checklist) => {
      const card = root.querySelector(`[data-av-checklist="${checklist.id}"]`);
      if (card) updateChecklistProgress(card, checklist);
    });

    updateChecklistSummary();
  }

  function updateChecklistSummary() {
    const summary = document.getElementById('av-checklist-summary');
    if (!summary) return;
    const totals = CHECKLISTS.reduce((acc, checklist) => {
      const { done, total } = checklistProgress(checklist);
      acc.done += done;
      acc.total += total;
      return acc;
    }, { done: 0, total: 0 });
    if (!totals.total) {
      summary.textContent = '';
      return;
    }
    summary.textContent = `${totals.done} de ${totals.total} itens marcados no total`;
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
      const label = input.closest('.av-check-item');
      label?.classList.toggle('av-check-item--done', input.checked);
      const card = root.querySelector(`[data-av-checklist="${id}"]`);
      const checklist = CHECKLISTS.find((c) => c.id === id);
      if (card && checklist) updateChecklistProgress(card, checklist);
      updateChecklistSummary();
    });

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-av-reset-checklist]');
      if (!btn) return;
      resetChecklist(btn.dataset.avResetChecklist);
    });
  }

  function resetChecklist(id) {
    const checklist = CHECKLISTS.find((c) => c.id === id);
    if (!checklist) return;
    if (!confirm(`Limpar as marcações de "${checklist.title}"?`)) return;
    localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
    renderChecklists();
    showToast(toastEl(), 'Checklist limpo.');
  }

  function resetChecklists() {
    if (!confirm('Limpar todas as marcações dos checklists neste navegador?')) return;
    CHECKLISTS.forEach((checklist) => localStorage.removeItem(`${STORAGE_PREFIX}${checklist.id}`));
    renderChecklists();
    showToast(toastEl(), 'Checklists limpos.');
  }

  function todayIsoDate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function fmtDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function resetAttendanceForm() {
    editingAttendanceId = null;
    document.getElementById('av-attendance-id').value = '';
    document.getElementById('av-attendance-date').value = todayIsoDate();
    document.getElementById('av-attendance-kind').value = 'midweek';
    document.getElementById('av-attendance-count').value = '';
    document.getElementById('av-attendance-extra').value = '';
    document.getElementById('av-attendance-remarks').value = '';
    document.getElementById('av-attendance-submit-label').textContent = 'Registrar assistência';
    document.getElementById('av-attendance-cancel-edit')?.classList.add('hidden');
  }

  function fillAttendanceForm(row) {
    editingAttendanceId = row.id;
    document.getElementById('av-attendance-id').value = row.id;
    document.getElementById('av-attendance-date').value = row.meeting_date;
    document.getElementById('av-attendance-kind').value = row.meeting_kind;
    document.getElementById('av-attendance-count').value = row.attendance_count;
    document.getElementById('av-attendance-extra').value = row.extra_count ?? '';
    document.getElementById('av-attendance-remarks').value = row.remarks || '';
    document.getElementById('av-attendance-submit-label').textContent = 'Salvar alterações';
    document.getElementById('av-attendance-cancel-edit')?.classList.remove('hidden');
    document.getElementById('av-attendance-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function loadAttendanceSettings(client) {
    const { data } = await client.from('secretary_settings').select('extra_attendance_count').eq('id', true).maybeSingle();
    extraAttendanceEnabled = !!data?.extra_attendance_count;
    document.getElementById('av-attendance-extra-wrap')?.classList.toggle('hidden', !extraAttendanceEnabled);
  }

  async function loadAttendanceLogs(client) {
    const { data, error } = await client
      .from('secretary_attendance_logs')
      .select(`
        id, meeting_date, meeting_kind, attendance_count, extra_count, remarks, created_at,
        profiles:submitted_by ( full_name )
      `)
      .order('meeting_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(24);
    if (error) throw error;
    attendanceLogs = data || [];
    renderAttendanceList();
  }

  function renderAttendanceList() {
    const root = document.getElementById('av-attendance-list');
    if (!root) return;
    if (!attendanceLogs.length) {
      root.innerHTML = '<p class="av-hint">Nenhum registro ainda. Preencha o formulário acima após a reunião.</p>';
      return;
    }
    root.innerHTML = attendanceLogs.map((row) => `
      <article class="av-attendance-item">
        <div class="av-attendance-item__main">
          <p class="av-attendance-item__date">${escapeHtml(fmtDate(row.meeting_date))}</p>
          <p class="av-attendance-item__kind">${escapeHtml(MEETING_LABELS[row.meeting_kind] || row.meeting_kind)}</p>
        </div>
        <div class="av-attendance-item__counts">
          <span class="av-attendance-item__count">${escapeHtml(String(row.attendance_count))}</span>
          ${row.extra_count != null ? `<span class="av-attendance-item__extra">+${escapeHtml(String(row.extra_count))}</span>` : ''}
        </div>
        <div class="av-attendance-item__meta">
          ${row.remarks ? `<p class="av-attendance-item__remarks">${escapeHtml(row.remarks)}</p>` : ''}
          <p class="av-attendance-item__by">${escapeHtml(row.profiles?.full_name || 'Equipe A/V')}</p>
        </div>
        <div class="av-attendance-item__actions">
          <button type="button" class="av-attendance-item__btn" data-av-att-edit="${row.id}" title="Editar">
            <span class="material-symbols-outlined" aria-hidden="true">edit</span>
          </button>
          <button type="button" class="av-attendance-item__btn av-attendance-item__btn--danger" data-av-att-del="${row.id}" title="Excluir">
            <span class="material-symbols-outlined" aria-hidden="true">delete</span>
          </button>
        </div>
      </article>`).join('');
  }

  function bindAttendanceForm(client, profile) {
    const form = document.getElementById('av-attendance-form');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';

    resetAttendanceForm();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        meeting_date: document.getElementById('av-attendance-date').value,
        meeting_kind: document.getElementById('av-attendance-kind').value,
        attendance_count: Number(document.getElementById('av-attendance-count').value) || 0,
        extra_count: extraAttendanceEnabled && document.getElementById('av-attendance-extra').value !== ''
          ? Number(document.getElementById('av-attendance-extra').value)
          : null,
        remarks: document.getElementById('av-attendance-remarks').value.trim(),
        submitted_by: profile.id,
        updated_at: new Date().toISOString()
      };

      let error;
      if (editingAttendanceId) {
        ({ error } = await client.from('secretary_attendance_logs').update(payload).eq('id', editingAttendanceId));
      } else {
        ({ error } = await client.from('secretary_attendance_logs').insert(payload));
      }

      if (error) {
        showToast(toastEl(), error.message, true);
        return;
      }

      showToast(toastEl(), editingAttendanceId ? 'Registro atualizado.' : 'Assistência registrada.');
      resetAttendanceForm();
      await loadAttendanceLogs(client);
    });

    document.getElementById('av-attendance-cancel-edit')?.addEventListener('click', resetAttendanceForm);

    document.getElementById('av-attendance-list')?.addEventListener('click', async (e) => {
      const editId = e.target.closest('[data-av-att-edit]')?.dataset.avAttEdit;
      const delId = e.target.closest('[data-av-att-del]')?.dataset.avAttDel;
      if (editId) {
        const row = attendanceLogs.find((item) => item.id === editId);
        if (row) fillAttendanceForm(row);
        return;
      }
      if (delId) {
        const row = attendanceLogs.find((item) => item.id === delId);
        const label = row ? `${fmtDate(row.meeting_date)} · ${MEETING_LABELS[row.meeting_kind]}` : 'este registro';
        if (!window.confirm(`Excluir ${label}?`)) return;
        const { error } = await client.from('secretary_attendance_logs').delete().eq('id', delId);
        if (error) {
          showToast(toastEl(), error.message, true);
          return;
        }
        showToast(toastEl(), 'Registro excluído.');
        if (editingAttendanceId === delId) resetAttendanceForm();
        await loadAttendanceLogs(client);
      }
    });
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
    localStorage.removeItem(`${STORAGE_PREFIX}special`);
    renderChecklists();
    bindChecklistEvents();
    document.getElementById('av-btn-reset-checklists')?.addEventListener('click', resetChecklists);

    const client = await getClient();
    await loadAttendanceSettings(client);
    await loadAttendanceLogs(client);
    bindAttendanceForm(client, profile);
    await loadNotes(client);
    bindNotesForm(client);
    return true;
  }

  window.JEAdminAudioVideo = { init };
})();
