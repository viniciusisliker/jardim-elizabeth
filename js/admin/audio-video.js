(function () {
  const { guardPermission, getClient, showToast, escapeHtml } = window.JEAdmin;

  const MEETING_LABELS = {
    midweek: 'Meio de semana',
    weekend: 'Final de semana'
  };

  let attendanceLogs = [];
  let editingAttendanceId = null;
  let pendingAttendanceWhatsApp = '';
  let avImages = [];

  const IMAGE_BUCKET = 'audio-video';
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

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

  function moveNavIndicator(tab, pulse = true) {
    const nav = document.querySelector('.av-nav');
    window.JEHuNav?.animateIndicator({
      nav,
      indicator: nav?.querySelector('.av-nav-indicator'),
      activeBtn: tab,
      pulse
    });
  }

  function switchTab(tabId, { animate = true } = {}) {
    if (!tabId) return;
    document.querySelectorAll('[data-av-tab]').forEach((tab) => {
      const on = tab.dataset.avTab === tabId;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    window.JEHuNav?.activatePanels(
      document.querySelectorAll('.av-panel'),
      (panel) => panel.id === `av-panel-${tabId}`,
      { animate }
    );
    moveNavIndicator(document.querySelector(`[data-av-tab="${tabId}"]`), animate);
  }

  function setupTabs() {
    document.querySelectorAll('[data-av-tab]').forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.avTab));
    });
    switchTab('inicio', { animate: false });
    window.JEHuNav?.queueIndicatorRefresh(
      () => document.querySelector('[data-av-tab].active'),
      document.querySelector('.av-nav'),
      document.querySelector('.av-nav-indicator')
    );
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

  function buildAttendanceWhatsAppMessage(row, submitterName) {
    const kind = MEETING_LABELS[row.meeting_kind] || row.meeting_kind;
    const lines = [
      '📊 *Assistência — Jardim Elizabeth*',
      '',
      `📅 Data: ${fmtDate(row.meeting_date)}`,
      `🏛 Reunião: ${kind}`,
      `👥 Presencial: ${row.attendance_count}`
    ];
    if (row.zoom_attendance_count != null && row.zoom_attendance_count !== '') {
      lines.push(`💻 Zoom: ${row.zoom_attendance_count}`);
    }
    if (row.remarks) {
      lines.push(`📝 Obs.: ${row.remarks}`);
    }
    if (submitterName) {
      lines.push('', `Registrado por ${submitterName} (Áudio e Vídeo)`);
    }
    return lines.join('\n');
  }

  function hideAttendanceWhatsAppPrompt() {
    pendingAttendanceWhatsApp = '';
    document.getElementById('av-attendance-whatsapp-wrap')?.classList.add('hidden');
  }

  function showAttendanceWhatsAppPrompt(message) {
    pendingAttendanceWhatsApp = message;
    document.getElementById('av-attendance-whatsapp-wrap')?.classList.remove('hidden');
  }

  function openAttendanceWhatsApp(message) {
    const msg = message || pendingAttendanceWhatsApp;
    if (!msg) return;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(msg)
        .then(() => showToast(toastEl(), 'WhatsApp aberto — mensagem também copiada.'))
        .catch(() => showToast(toastEl(), 'WhatsApp aberto com a mensagem pronta.'));
    } else {
      showToast(toastEl(), 'WhatsApp aberto com a mensagem pronta.');
    }
  }

  function setAttendanceModalCopy({ heading, subtitle, submit }) {
    const headingEl = document.getElementById('av-attendance-modal-heading');
    const subEl = document.getElementById('av-attendance-modal-sub');
    const submitEl = document.getElementById('av-attendance-submit-label');
    if (headingEl) headingEl.textContent = heading;
    if (subEl) subEl.textContent = subtitle;
    if (submitEl) submitEl.textContent = submit;
  }

  function mountAttendanceModal() {
    const modal = document.getElementById('av-attendance-modal');
    if (!modal) return null;
    if (modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
    return modal;
  }

  function openAttendanceModal() {
    const modal = mountAttendanceModal();
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('av-modal-open');
    window.setTimeout(() => {
      const dateEl = document.getElementById('av-attendance-date');
      const countEl = document.getElementById('av-attendance-count');
      (window.matchMedia('(max-width: 639px)').matches ? dateEl : countEl)?.focus({ preventScroll: true });
    }, 60);
  }

  function closeAttendanceModal() {
    const modal = document.getElementById('av-attendance-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('av-modal-open');
  }

  function resetAttendanceForm() {
    editingAttendanceId = null;
    const idEl = document.getElementById('av-attendance-id');
    const dateEl = document.getElementById('av-attendance-date');
    const kindEl = document.getElementById('av-attendance-kind');
    const countEl = document.getElementById('av-attendance-count');
    const zoomEl = document.getElementById('av-attendance-zoom');
    const remarksEl = document.getElementById('av-attendance-remarks');
    if (idEl) idEl.value = '';
    if (dateEl) dateEl.value = todayIsoDate();
    if (kindEl) kindEl.value = 'midweek';
    if (countEl) countEl.value = '';
    if (zoomEl) zoomEl.value = '';
    if (remarksEl) remarksEl.value = '';
    setAttendanceModalCopy({
      heading: 'Novo registro',
      subtitle: 'Preencha a assistência da reunião.',
      submit: 'Registrar'
    });
  }

  function fillAttendanceForm(row) {
    editingAttendanceId = row.id;
    document.getElementById('av-attendance-id').value = row.id;
    document.getElementById('av-attendance-date').value = row.meeting_date;
    document.getElementById('av-attendance-kind').value = row.meeting_kind;
    document.getElementById('av-attendance-count').value = row.attendance_count;
    document.getElementById('av-attendance-zoom').value = row.zoom_attendance_count ?? '';
    document.getElementById('av-attendance-remarks').value = row.remarks || '';
    setAttendanceModalCopy({
      heading: 'Editar registro',
      subtitle: `${fmtDate(row.meeting_date)} · ${MEETING_LABELS[row.meeting_kind] || row.meeting_kind}`,
      submit: 'Salvar'
    });
    hideAttendanceWhatsAppPrompt();
    openAttendanceModal();
  }

  function openNewAttendanceModal() {
    resetAttendanceForm();
    hideAttendanceWhatsAppPrompt();
    openAttendanceModal();
  }

  async function loadAttendanceLogs(client) {
    const { data, error } = await client
      .from('secretary_attendance_logs')
      .select(`
        id, meeting_date, meeting_kind, attendance_count, zoom_attendance_count, remarks, created_at,
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
      root.innerHTML = '<p class="av-hint">Nenhum registro ainda. Toque em <strong>Novo registro</strong> após a reunião.</p>';
      return;
    }
    root.innerHTML = attendanceLogs.map((row) => `
      <article class="av-attendance-item" data-av-att-open="${row.id}" tabindex="0" role="button" aria-label="Abrir registro de ${escapeHtml(fmtDate(row.meeting_date))}">
        <div class="av-attendance-item__top">
          <div class="av-attendance-item__main">
            <p class="av-attendance-item__date">${escapeHtml(fmtDate(row.meeting_date))}</p>
            <p class="av-attendance-item__kind">${escapeHtml(MEETING_LABELS[row.meeting_kind] || row.meeting_kind)}</p>
          </div>
          <div class="av-attendance-item__counts">
            <span class="av-attendance-item__count">${escapeHtml(String(row.attendance_count))}</span>
            ${row.zoom_attendance_count != null ? `<span class="av-attendance-item__zoom">Zoom ${escapeHtml(String(row.zoom_attendance_count))}</span>` : ''}
          </div>
        </div>
        <div class="av-attendance-item__meta">
          ${row.remarks ? `<p class="av-attendance-item__remarks">${escapeHtml(row.remarks)}</p>` : ''}
          <p class="av-attendance-item__by">${escapeHtml(row.profiles?.full_name || 'Equipe A/V')}</p>
        </div>
        <div class="av-attendance-item__actions" role="group" aria-label="Ações do registro">
          <button type="button" class="av-attendance-item__btn av-attendance-item__btn--wa" data-av-att-wa="${row.id}" aria-label="Enviar no WhatsApp" title="Enviar no WhatsApp">
            <span class="material-symbols-outlined" aria-hidden="true">chat</span>
          </button>
          <button type="button" class="av-attendance-item__btn av-attendance-item__btn--edit" data-av-att-edit="${row.id}" aria-label="Editar registro" title="Editar">
            <span class="material-symbols-outlined" aria-hidden="true">edit_square</span>
          </button>
          <button type="button" class="av-attendance-item__btn av-attendance-item__btn--danger" data-av-att-del="${row.id}" aria-label="Excluir registro" title="Excluir">
            <span class="material-symbols-outlined" aria-hidden="true">delete</span>
          </button>
        </div>
      </article>`).join('');
  }

  function bindAttendanceForm(client, profile) {
    mountAttendanceModal();
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
        zoom_attendance_count: document.getElementById('av-attendance-zoom').value !== ''
          ? Number(document.getElementById('av-attendance-zoom').value)
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

      const wasEdit = !!editingAttendanceId;
      const message = buildAttendanceWhatsAppMessage(payload, profile.full_name || profile.username);
      showToast(toastEl(), wasEdit ? 'Registro atualizado.' : 'Assistência registrada.');
      closeAttendanceModal();
      resetAttendanceForm();
      showAttendanceWhatsAppPrompt(message);
      await loadAttendanceLogs(client);
    });

    document.getElementById('av-attendance-open-new')?.addEventListener('click', openNewAttendanceModal);

    document.getElementById('av-attendance-modal')?.querySelectorAll('[data-av-attendance-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        closeAttendanceModal();
        resetAttendanceForm();
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const modal = document.getElementById('av-attendance-modal');
      if (!modal || modal.classList.contains('hidden')) return;
      closeAttendanceModal();
      resetAttendanceForm();
    });

    document.getElementById('av-attendance-whatsapp-btn')?.addEventListener('click', () => {
      openAttendanceWhatsApp();
    });

    const openRow = (id) => {
      const row = attendanceLogs.find((item) => item.id === id);
      if (row) fillAttendanceForm(row);
    };

    document.getElementById('av-attendance-list')?.addEventListener('click', async (e) => {
      const waId = e.target.closest('[data-av-att-wa]')?.dataset.avAttWa;
      const editId = e.target.closest('[data-av-att-edit]')?.dataset.avAttEdit;
      const delId = e.target.closest('[data-av-att-del]')?.dataset.avAttDel;
      const openId = e.target.closest('[data-av-att-open]')?.dataset.avAttOpen;
      if (waId) {
        e.stopPropagation();
        const row = attendanceLogs.find((item) => item.id === waId);
        if (row) {
          openAttendanceWhatsApp(buildAttendanceWhatsAppMessage(row, row.profiles?.full_name || 'Equipe A/V'));
        }
        return;
      }
      if (editId) {
        e.stopPropagation();
        openRow(editId);
        return;
      }
      if (delId) {
        e.stopPropagation();
        const row = attendanceLogs.find((item) => item.id === delId);
        const label = row ? `${fmtDate(row.meeting_date)} · ${MEETING_LABELS[row.meeting_kind]}` : 'este registro';
        if (!window.confirm(`Excluir ${label}?`)) return;
        const { error } = await client.from('secretary_attendance_logs').delete().eq('id', delId);
        if (error) {
          showToast(toastEl(), error.message, true);
          return;
        }
        showToast(toastEl(), 'Registro excluído.');
        if (editingAttendanceId === delId) {
          closeAttendanceModal();
          resetAttendanceForm();
        }
        await loadAttendanceLogs(client);
        return;
      }
      if (openId && !e.target.closest('.av-attendance-item__actions')) {
        openRow(openId);
      }
    });

    document.getElementById('av-attendance-list')?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const openId = e.target.closest('[data-av-att-open]')?.dataset.avAttOpen;
      if (!openId || e.target.closest('.av-attendance-item__actions')) return;
      e.preventDefault();
      openRow(openId);
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

  function setImageUploadStatus(message, isError = false) {
    const el = document.getElementById('av-image-upload-status');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('hidden', !message);
    el.style.color = isError ? '#dc2626' : '';
  }

  async function loadImages(client) {
    const { data, error } = await client
      .from('audio_video_images')
      .select('id, file_name, storage_path, caption, mime_type, size_bytes, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    avImages = data || [];
    await renderImages(client);
  }

  async function signedImageUrl(client, storagePath) {
    const { data, error } = await client.storage.from(IMAGE_BUCKET).createSignedUrl(storagePath, 3600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }

  async function renderImages(client) {
    const root = document.getElementById('av-images-grid');
    if (!root) return;

    if (!avImages.length) {
      root.className = 'av-images-grid av-images-grid--empty';
      root.innerHTML = '<p class="av-hint">Nenhuma imagem ainda. Envie fotos ou diagramas para a equipe consultar.</p>';
      return;
    }

    root.className = 'av-images-grid';
    const cards = await Promise.all(avImages.map(async (row) => {
      const url = await signedImageUrl(client, row.storage_path);
      const cap = row.caption || row.file_name;
      const hasCap = !!row.caption;
      return `
        <article class="av-image-card${hasCap ? ' av-image-card--has-cap' : ''}" data-av-image-id="${row.id}">
          ${url
            ? `<a class="av-image-card__link" href="${url}" target="_blank" rel="noopener" title="Abrir imagem"><img class="av-image-card__img" src="${url}" alt="${escapeHtml(cap)}" loading="lazy"/></a>`
            : '<div class="av-image-card__link av-hint" style="display:flex;align-items:center;justify-content:center;padding:.5rem">Indisponível</div>'}
          ${hasCap ? `<p class="av-image-card__cap" title="${escapeHtml(cap)}">${escapeHtml(cap)}</p>` : ''}
          <div class="av-image-card__actions">
            <button type="button" class="av-image-card__btn av-image-card__btn--danger" data-av-image-del="${row.id}" title="Excluir">
              <span class="material-symbols-outlined" aria-hidden="true">delete</span>
            </button>
          </div>
        </article>`;
    }));
    root.innerHTML = cards.join('');
  }

  async function uploadImage(client, profile, file) {
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type)) {
      setImageUploadStatus('Use JPG, PNG, WebP ou GIF.', true);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageUploadStatus('Imagem muito grande (máx. 5 MB).', true);
      return;
    }

    setImageUploadStatus('Enviando…');
    const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'jpg';
    const path = `${profile.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const caption = document.getElementById('av-image-caption')?.value.trim() || '';

    const { error: upErr } = await client.storage.from(IMAGE_BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type
    });
    if (upErr) {
      setImageUploadStatus(upErr.message, true);
      return;
    }

    const { error: insErr } = await client.from('audio_video_images').insert({
      file_name: file.name,
      storage_path: path,
      caption,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: profile.id
    });
    if (insErr) {
      await client.storage.from(IMAGE_BUCKET).remove([path]);
      setImageUploadStatus(insErr.message, true);
      return;
    }

    document.getElementById('av-image-caption').value = '';
    document.getElementById('av-image-upload').value = '';
    setImageUploadStatus('');
    showToast(toastEl(), 'Imagem enviada.');
    await loadImages(client);
  }

  async function deleteImage(client, imageId) {
    const row = avImages.find((item) => item.id === imageId);
    if (!row) return;
    const label = row.caption || row.file_name;
    if (!window.confirm(`Excluir a imagem "${label}"?`)) return;

    if (row.storage_path) {
      await client.storage.from(IMAGE_BUCKET).remove([row.storage_path]);
    }
    const { error } = await client.from('audio_video_images').delete().eq('id', imageId);
    if (error) {
      showToast(toastEl(), error.message, true);
      return;
    }
    showToast(toastEl(), 'Imagem excluída.');
    await loadImages(client);
  }

  function bindImageUpload(client, profile) {
    const input = document.getElementById('av-image-upload');
    if (!input || input.dataset.bound === '1') return;
    input.dataset.bound = '1';

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      await uploadImage(client, profile, file);
    });

    document.getElementById('av-images-grid')?.addEventListener('click', async (e) => {
      const delId = e.target.closest('[data-av-image-del]')?.dataset.avImageDel;
      if (delId) await deleteImage(client, delId);
    });
  }

  async function init() {
    if (window.__JEAdminAudioVideoInit) return true;
    window.__JEAdminAudioVideoInit = true;

    const profile = await guardPermission('audio_video');
    if (!profile) return false;

    setupTabs();
    localStorage.removeItem(`${STORAGE_PREFIX}special`);
    renderChecklists();
    bindChecklistEvents();
    document.getElementById('av-btn-reset-checklists')?.addEventListener('click', resetChecklists);

    const client = await getClient();
    await loadAttendanceLogs(client);
    bindAttendanceForm(client, profile);
    await loadNotes(client);
    bindNotesForm(client);
    try {
      await loadImages(client);
    } catch (err) {
      showToast(toastEl(), err.message || 'Erro ao carregar imagens.', true);
    }
    bindImageUpload(client, profile);
    return true;
  }

  window.JEAdminAudioVideo = { init, switchTab };
})();
