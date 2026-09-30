// Aba "Rodízio" do Quadro de Anúncios no Hub: listas de nomes em ordem
// (Leitor, Presidente, Oração...), salvas em announcement_rotations.
(function () {
  const { showToast, escapeHtml } = window.JEAdmin;

  let client = null;
  let toastEl = null;
  let lists = [];
  let loaded = false;
  let dirty = false;

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
    showToast(toastEl, 'Rodízio salvo.');
  }

  function init(opts) {
    client = opts.client;
    toastEl = opts.toastEl;
    const container = $('editor-rodizio');
    container?.addEventListener('click', onClick);
    container?.addEventListener('input', (e) => {
      if (e.target.matches('input[data-rod-item], input[data-rod-title]')) setDirty(true);
    });
    $('btn-save-rodizio')?.addEventListener('click', save);
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

  window.JEAnnouncementRotation = { init, load };
})();
