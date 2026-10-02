// Aba "Rodízio" do Quadro de Anúncios no Hub: listas de nomes em ordem
// (Leitor, Presidente, Oração...), salvas em announcement_rotations.
(function () {
  const { showToast, escapeHtml } = window.JEAdmin;

  let client = null;
  let toastEl = null;
  let lists = [];
  let loaded = false;
  let dirty = false;
  let onChange = null;
  // Itens como estão salvos no banco (as edições em andamento não contam).
  let savedItems = {};

  function $(id) { return document.getElementById(id); }

  function setDirty(value) {
    dirty = value;
    const btn = $('btn-save-rodizio');
    if (btn) btn.disabled = !dirty;
  }

  function readForm() {
    document.querySelectorAll('#editor-rodizio [data-rod-slug]').forEach((card) => {
      const list = lists.find((l) => l.slug === card.dataset.rodSlug);
      if (!list) return;
      const title = card.querySelector('input[data-rod-title]');
      if (title) list.title = title.value;
      list.items = [...card.querySelectorAll('input[data-rod-item]')].map((input) => input.value);
    });
  }

  function itemRow(item, i, total) {
    return `
      <li class="qa-rod-item" data-rod-index="${i}">
        <span class="qa-rod-num" aria-hidden="true">${i + 1}</span>
        <input type="text" data-rod-item value="${escapeHtml(item)}" aria-label="Nome ${i + 1}" placeholder="Nome"/>
        <button type="button" class="qa-rod-btn" data-rod-move="-1" ${i === 0 ? 'disabled' : ''} title="Subir" aria-label="Subir">
          <span class="material-symbols-outlined">arrow_upward</span>
        </button>
        <button type="button" class="qa-rod-btn" data-rod-move="1" ${i === total - 1 ? 'disabled' : ''} title="Descer" aria-label="Descer">
          <span class="material-symbols-outlined">arrow_downward</span>
        </button>
        <button type="button" class="qa-rod-btn qa-rod-btn--remove" data-rod-remove title="Remover" aria-label="Remover">
          <span class="material-symbols-outlined">close</span>
        </button>
      </li>`;
  }

  function render() {
    const container = $('editor-rodizio');
    if (!container) return;
    if (!lists.length) {
      container.innerHTML = '<p class="qa-limpeza-empty">Nenhuma lista de rodízio cadastrada.</p>';
      return;
    }
    container.innerHTML = lists.map((list) => `
      <article class="qa-rod-card" data-rod-slug="${escapeHtml(list.slug)}">
        <h3 class="qa-rod-title">
          <input type="text" data-rod-title value="${escapeHtml(list.title)}" aria-label="Nome da lista" placeholder="Nome da lista" maxlength="60"/>
          <span class="material-symbols-outlined" aria-hidden="true">edit</span>
        </h3>
        <ol class="qa-rod-list">${list.items.map((item, i) => itemRow(item, i, list.items.length)).join('')}</ol>
        <button type="button" class="qa-rod-add" data-rod-add>
          <span class="material-symbols-outlined" aria-hidden="true">add</span>
          Adicionar
        </button>
      </article>`).join('');
  }

  function onClick(e) {
    const card = e.target.closest('[data-rod-slug]');
    if (!card) return;
    const list = lists.find((l) => l.slug === card.dataset.rodSlug);
    if (!list) return;
    const row = e.target.closest('[data-rod-index]');
    const idx = row ? Number(row.dataset.rodIndex) : -1;

    let focusIndex = null;
    if (e.target.closest('[data-rod-add]')) {
      readForm();
      list.items.push('');
      focusIndex = list.items.length - 1;
    } else if (e.target.closest('[data-rod-remove]') && idx >= 0) {
      readForm();
      list.items.splice(idx, 1);
    } else if (e.target.closest('[data-rod-move]') && idx >= 0) {
      readForm();
      const to = idx + Number(e.target.closest('[data-rod-move]').dataset.rodMove);
      if (to < 0 || to >= list.items.length) return;
      [list.items[idx], list.items[to]] = [list.items[to], list.items[idx]];
      focusIndex = to;
    } else {
      return;
    }

    setDirty(true);
    render();
    if (focusIndex !== null) {
      document.querySelector(`#editor-rodizio [data-rod-slug="${CSS.escape(list.slug)}"] [data-rod-index="${focusIndex}"] input`)?.focus();
    }
  }

  async function load(force) {
    if (loaded && !force) return;
    const container = $('editor-rodizio');
    const { data, error } = await client
      .from('announcement_rotations')
      .select('slug,title,sort_order,items')
      .order('sort_order');
    if (error) {
      console.error(error);
      if (container) container.innerHTML = '<p class="qa-limpeza-empty">Não foi possível carregar o rodízio. Tente de novo mais tarde.</p>';
      return;
    }
    lists = (data || []).map((row) => ({
      ...row,
      items: Array.isArray(row.items) ? row.items.map((v) => String(v ?? '')) : []
    }));
    loaded = true;
    setDirty(false);
    render();
    snapshotSaved();
  }

  function snapshotSaved() {
    savedItems = Object.fromEntries(lists.map((l) => [l.slug, l.items.map((v) => v.trim()).filter(Boolean)]));
    onChange?.();
  }

  function getItems(slug) {
    return savedItems[slug] || null;
  }

  async function save() {
    readForm();
    const untitled = lists.find((list) => !list.title.trim());
    if (untitled) {
      showToast(toastEl, 'Toda lista precisa de um nome.', true);
      document.querySelector(`#editor-rodizio [data-rod-slug="${CSS.escape(untitled.slug)}"] input[data-rod-title]`)?.focus();
      return;
    }
    const now = new Date().toISOString();
    const payload = lists.map((list) => ({
      slug: list.slug,
      title: list.title.trim(),
      sort_order: list.sort_order,
      items: list.items.map((v) => v.trim()).filter(Boolean),
      updated_at: now
    }));
    const btn = $('btn-save-rodizio');
    if (btn) btn.disabled = true;
    const { error } = await client.from('announcement_rotations').upsert(payload, { onConflict: 'slug' });
    if (error) {
      console.error(error);
      showToast(toastEl, 'Não foi possível salvar o rodízio. Tente de novo.', true);
      if (btn) btn.disabled = false;
      return;
    }
    lists = payload.map(({ updated_at, ...rest }) => rest);
    setDirty(false);
    render();
    snapshotSaved();
    showToast(toastEl, 'Rodízio salvo.');
  }

  // Pop-up somente leitura aberto pelo ícone ao lado dos campos do quadro
  // (Presidente, Leitor, Oração final, Dirigente de campo, Limpeza, mecânicas).
  let popup = null;

  function closePopup() {
    if (!popup) return;
    const { overlay, previousOverflow, opener } = popup;
    popup = null;
    overlay.remove();
    document.body.style.overflow = previousOverflow;
    opener?.focus();
  }

  async function openPopup(slug, opener) {
    if (loaded) readForm();
    else await load();
    if (!loaded) {
      showToast(toastEl, 'Não foi possível carregar o rodízio. Tente de novo mais tarde.', true);
      return;
    }
    const list = lists.find((l) => l.slug === slug);
    if (!list) {
      showToast(toastEl, 'Lista de rodízio não encontrada.', true);
      return;
    }
    closePopup();

    const names = list.items.map((v) => v.trim()).filter(Boolean);
    // Aberto de um campo das mecânicas: marca quem já tem parte nesse dia e quem quebra
    // a regra de folga/repetição entre semanas.
    const date = opener?.dataset.rotationDate;
    const ownKey = opener?.dataset.rotationKey;
    const assignmentsFor = date ? window.JEAnnouncementAssignments?.assignmentsFor : null;
    const tagsFor = (name) => {
      const list = assignmentsFor ? assignmentsFor(name, date, ownKey) : [];
      return list.length
        ? `<span class="qa-assign-tags">${list.map((a) => `
            <span class="qa-assign-tag${a.conflict ? ' qa-assign-tag--conflict' : ''}"><span class="material-symbols-outlined" aria-hidden="true">event_busy</span><span><strong>${escapeHtml(a.quadro)}:</strong> ${escapeHtml(a.parte)}</span></span>`).join('')}</span>`
        : '';
    };
    const body = names.length
      ? `<ol class="qa-rod-popup__list">${names.map((name, i) => `
          <li><span class="qa-rod-num" aria-hidden="true">${i + 1}</span><span class="qa-rod-popup__name">${escapeHtml(name)}${tagsFor(name)}</span></li>`).join('')}</ol>`
      : '<p class="qa-limpeza-empty">Lista vazia. Adicione nomes na aba Rodízio.</p>';

    const overlay = document.createElement('div');
    overlay.className = 'qa-rod-popup-overlay';
    overlay.innerHTML = `
      <div class="qa-rod-popup" role="dialog" aria-modal="true" aria-labelledby="qa-rod-popup-title">
        <div class="qa-rod-popup__head">
          <span class="material-symbols-outlined" aria-hidden="true">autorenew</span>
          <h2 id="qa-rod-popup-title">${escapeHtml(list.title)}</h2>
          <button type="button" class="qa-rod-btn" data-rod-popup-close title="Fechar" aria-label="Fechar">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="qa-rod-popup__body">${body}</div>
        <div class="qa-rod-popup__actions">
          ${dirty ? '<span class="qa-rod-popup__note">Com alterações não salvas</span>' : ''}
          <button type="button" class="qa-rod-popup__edit" data-rod-popup-edit>
            <span class="material-symbols-outlined" aria-hidden="true">edit</span>
            Editar lista
          </button>
        </div>
      </div>`;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-rod-popup-close]')) {
        closePopup();
      } else if (e.target.closest('[data-rod-popup-edit]')) {
        closePopup();
        document.querySelector('[data-tab="rodizio"]')?.click();
        document.querySelector(`#editor-rodizio [data-rod-slug="${CSS.escape(slug)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePopup();
      }
    });

    popup = { overlay, previousOverflow: document.body.style.overflow, opener };
    document.body.style.overflow = 'hidden';
    document.body.appendChild(overlay);
    overlay.querySelector('[data-rod-popup-close]')?.focus();
  }

  function init(opts) {
    client = opts.client;
    toastEl = opts.toastEl;
    onChange = opts.onChange || null;
    const container = $('editor-rodizio');
    container?.addEventListener('click', onClick);
    container?.addEventListener('input', (e) => {
      if (e.target.matches('input[data-rod-item], input[data-rod-title]')) setDirty(true);
    });
    $('btn-save-rodizio')?.addEventListener('click', save);
    // Os campos do quadro são re-renderizados a cada troca de data: delegação no document.
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-rotation-slug]');
      if (btn) openPopup(btn.dataset.rotationSlug, btn);
    });
    $('btn-reload-rodizio')?.addEventListener('click', async () => {
      if (dirty && !await window.JEDialog.confirm({
        title: 'Descartar alterações',
        message: 'Há alterações no rodízio que ainda não foram salvas. Descartar e recarregar?',
        confirmLabel: 'Descartar'
      })) return;
      await load(true);
    });
    window.addEventListener('beforeunload', (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    });
  }

  window.JEAnnouncementRotation = { init, load, openPopup, getItems };
})();
