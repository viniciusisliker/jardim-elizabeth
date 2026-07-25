(function () {
  const { guardPermission, getClient, showToast, escapeHtml } = window.JEAdmin;
  const R = window.JESitePageRenderer;

  let client;
  let pages = [];
  let currentId = null;
  let selectedBlockId = null;
  let saveTimer = null;
  let saving = false;
  let bound = false;

  function $(id) { return document.getElementById(id); }

  function currentPage() {
    return pages.find((p) => p.id === currentId) || null;
  }

  function blocksOf(page) {
    if (!page?.layout?.blocks || !Array.isArray(page.layout.blocks)) {
      page.layout = { blocks: [] };
    }
    return page.layout.blocks;
  }

  function setStatus(text) {
    const el = $('sb-save-status');
    if (el) el.textContent = text;
  }

  function slugify(text) {
    return String(text || 'pagina')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'pagina';
  }

  function uniqueSlug(base) {
    let slug = slugify(base);
    let n = 1;
    while (pages.some((p) => p.slug === slug && p.id !== currentId)) {
      slug = `${slugify(base)}-${n += 1}`;
    }
    return slug;
  }

  function markDirty() {
    setStatus('Alterações não salvas…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveCurrentPage(), 1400);
  }

  function renderCanvas() {
    const page = currentPage();
    const canvas = $('sb-canvas');
    if (!page || !canvas) return;
    R.renderPage(canvas, page, { editMode: true, selectedId: selectedBlockId });
    bindCanvasEvents(canvas);
  }

  function bindCanvasEvents(canvas) {
    canvas.querySelectorAll('.je-sp-block').forEach((el) => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        selectedBlockId = el.dataset.blockId;
        renderCanvas();
        renderBlockEditor();
        switchTab('block');
      });
    });
  }

  function renderPagesList() {
    const list = $('sb-pages-list');
    if (!list) return;
    list.innerHTML = pages.map((p) => `
      <li>
        <button type="button" class="${p.id === currentId ? 'active' : ''}" data-page-id="${escapeHtml(p.id)}">
          <span class="sb-pages-list__title">${escapeHtml(p.title)}</span>
          <span class="sb-pages-list__meta">/${escapeHtml(p.slug)} · ${p.status === 'published' ? 'Publicada' : 'Rascunho'}</span>
        </button>
      </li>`).join('');
    list.querySelectorAll('[data-page-id]').forEach((btn) => {
      btn.addEventListener('click', () => selectPage(btn.dataset.pageId));
    });
  }

  function syncTopbar() {
    const page = currentPage();
    const titleInput = $('sb-site-title');
    const pubBtn = $('sb-publish');
    if (!page) return;
    if (titleInput && document.activeElement !== titleInput) {
      titleInput.value = page.title || '';
    }
    if (pubBtn) {
      pubBtn.childNodes[0].textContent = page.status === 'published' ? 'Publicado' : 'Publicar';
    }
    setStatus(saving ? 'Salvando…' : 'Todas as alterações foram salvas');
  }

  function syncThemeInputs() {
    const page = currentPage();
    if (!page) return;
    const theme = R.normalizeTheme(page.theme);
    const bg = $('sb-theme-bg');
    const text = $('sb-theme-text');
    const accent = $('sb-theme-accent');
    const heading = $('sb-theme-heading-font');
    if (bg) bg.value = theme.bgColor;
    if (text) text.value = theme.textColor;
    if (accent) accent.value = theme.accentColor;
    if (heading) heading.value = theme.headingFont;
  }

  function field(label, id, value, type = 'text', extra = '') {
    if (type === 'textarea') {
      return `<label>${escapeHtml(label)}<textarea data-field="${escapeHtml(id)}">${escapeHtml(value)}</textarea></label>`;
    }
    if (type === 'select') {
      return `<label>${escapeHtml(label)}<select data-field="${escapeHtml(id)}">${extra}</select></label>`;
    }
    return `<label>${escapeHtml(label)}<input type="${escapeHtml(type)}" data-field="${escapeHtml(id)}" value="${escapeHtml(value)}"/></label>`;
  }

  function renderBlockEditor() {
    const page = currentPage();
    const editor = $('sb-block-editor');
    const empty = $('sb-block-empty');
    const actions = $('sb-block-actions');
    if (!page || !editor) return;

    const block = blocksOf(page).find((b) => b.id === selectedBlockId);
    if (!block) {
      editor.classList.add('hidden');
      actions?.classList.add('hidden');
      empty?.classList.remove('hidden');
      return;
    }

    empty?.classList.add('hidden');
    editor.classList.remove('hidden');
    actions?.classList.remove('hidden');

    const alignOpts = `
      <option value="left"${block.data.align === 'left' ? ' selected' : ''}>Esquerda</option>
      <option value="center"${block.data.align === 'center' ? ' selected' : ''}>Centro</option>
      <option value="right"${block.data.align === 'right' ? ' selected' : ''}>Direita</option>`;
    const alignField = field('Alinhamento', 'align', block.data.align, 'select', alignOpts);

    let html = '';
    switch (block.type) {
      case 'hero':
        html = field('Título', 'title', block.data.title)
          + field('Subtítulo', 'subtitle', block.data.subtitle)
          + field('URL da imagem', 'imageUrl', block.data.imageUrl)
          + alignField;
        break;
      case 'heading':
        html = field('Texto', 'text', block.data.text) + alignField;
        break;
      case 'text':
        html = field('Texto', 'text', block.data.text, 'textarea') + alignField;
        break;
      case 'image':
        html = field('URL da imagem', 'url', block.data.url)
          + field('Texto alternativo', 'alt', block.data.alt)
          + field('Legenda', 'caption', block.data.caption)
          + field('Largura', 'width', block.data.width, 'select',
            `<option value="normal"${block.data.width !== 'full' ? ' selected' : ''}>Normal</option><option value="full"${block.data.width === 'full' ? ' selected' : ''}>Largura total</option>`)
          + alignField;
        break;
      case 'button':
        html = field('Rótulo', 'label', block.data.label)
          + field('Link', 'url', block.data.url)
          + field('Estilo', 'style', block.data.style, 'select',
            `<option value="filled"${block.data.style !== 'outline' ? ' selected' : ''}>Preenchido</option><option value="outline"${block.data.style === 'outline' ? ' selected' : ''}>Contorno</option>`)
          + alignField;
        break;
      case 'spacer':
        html = field('Altura (px)', 'height', block.data.height, 'number');
        break;
      case 'embed':
        html = field('URL (https)', 'url', block.data.url)
          + field('Altura (px)', 'height', block.data.height, 'number');
        break;
      case 'divider':
        html = '<p class="sb-block-empty">Divisor visual — sem opções.</p>';
        break;
      default:
        html = '<p class="sb-block-empty">Tipo de bloco desconhecido.</p>';
    }

    editor.innerHTML = html;
    editor.querySelectorAll('[data-field]').forEach((input) => {
      const key = input.dataset.field;
      const handler = () => {
        if (input.type === 'number') {
          block.data[key] = Number(input.value) || 0;
        } else {
          block.data[key] = input.value;
        }
        renderCanvas();
        markDirty();
      };
      input.addEventListener('input', handler);
      input.addEventListener('change', handler);
    });
  }

  function switchTab(name) {
    document.querySelectorAll('.sb-panel-tab').forEach((tab) => {
      const active = tab.dataset.sbTab === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.sb-panel__body').forEach((panel) => {
      const id = panel.id.replace('sb-tab-', '');
      if (id === name) {
        panel.hidden = false;
        panel.classList.add('active');
      } else {
        panel.hidden = true;
        panel.classList.remove('active');
      }
    });
  }

  async function loadPages() {
    const { data, error } = await client
      .from('site_pages')
      .select('*')
      .order('sort_order')
      .order('title');
    if (error) throw error;
    pages = (data || []).map((p) => ({
      ...p,
      layout: p.layout || { blocks: [] },
      theme: R.normalizeTheme(p.theme)
    }));
    if (!pages.length) {
      await createPage({ title: 'Página inicial', slug: 'inicio' });
      return;
    }
    if (!currentId || !pages.some((p) => p.id === currentId)) {
      currentId = pages[0].id;
    }
    selectedBlockId = null;
    renderPagesList();
    renderCanvas();
    renderBlockEditor();
    syncTopbar();
    syncThemeInputs();
  }

  async function createPage({ title, slug } = {}) {
    const t = title || 'Nova página';
    const s = slug || uniqueSlug(t);
    const { data: { user } } = await client.auth.getUser();
    const payload = {
      title: t,
      slug: s,
      status: 'draft',
      layout: {
        blocks: [
          R.newBlock('hero')
        ]
      },
      theme: R.defaultTheme(),
      sort_order: pages.length,
      created_by: user?.id || null
    };
    const { data, error } = await client.from('site_pages').insert(payload).select('*').single();
    if (error) throw error;
    pages.push({ ...data, layout: data.layout || { blocks: [] }, theme: R.normalizeTheme(data.theme) });
    currentId = data.id;
    selectedBlockId = null;
    renderPagesList();
    renderCanvas();
    syncTopbar();
    syncThemeInputs();
    showToast($('hub-admin-toast'), 'Página criada.');
  }

  async function saveCurrentPage() {
    const page = currentPage();
    if (!page || saving) return;
    saving = true;
    setStatus('Salvando…');
    const payload = {
      title: page.title,
      slug: page.slug,
      status: page.status,
      layout: page.layout,
      theme: page.theme,
      updated_at: new Date().toISOString()
    };
    const { error } = await client.from('site_pages').update(payload).eq('id', page.id);
    saving = false;
    if (error) {
      setStatus('Erro ao salvar');
      showToast($('hub-admin-toast'), error.message, true);
      return;
    }
    setStatus('Todas as alterações foram salvas');
    renderPagesList();
  }

  function selectPage(id) {
    if (id === currentId) return;
    clearTimeout(saveTimer);
    saveCurrentPage().finally(() => {
      currentId = id;
      selectedBlockId = null;
      renderPagesList();
      renderCanvas();
      renderBlockEditor();
      syncTopbar();
      syncThemeInputs();
    });
  }

  function addBlock(type) {
    const page = currentPage();
    if (!page) return;
    const block = R.newBlock(type);
    blocksOf(page).push(block);
    selectedBlockId = block.id;
    renderCanvas();
    renderBlockEditor();
    switchTab('block');
    markDirty();
  }

  function moveBlock(dir) {
    const page = currentPage();
    if (!page || !selectedBlockId) return;
    const blocks = blocksOf(page);
    const idx = blocks.findIndex((b) => b.id === selectedBlockId);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= blocks.length) return;
    [blocks[idx], blocks[next]] = [blocks[next], blocks[idx]];
    renderCanvas();
    markDirty();
  }

  function deleteBlock() {
    const page = currentPage();
    if (!page || !selectedBlockId) return;
    page.layout.blocks = blocksOf(page).filter((b) => b.id !== selectedBlockId);
    selectedBlockId = null;
    renderCanvas();
    renderBlockEditor();
    markDirty();
  }

  async function setPageStatus(status) {
    const page = currentPage();
    if (!page) return;
    page.status = status;
    await saveCurrentPage();
    syncTopbar();
    showToast($('hub-admin-toast'), status === 'published' ? 'Página publicada.' : 'Página em rascunho.');
  }

  async function deleteCurrentPage() {
    const page = currentPage();
    if (!page) return;
    if (pages.length <= 1) {
      showToast($('hub-admin-toast'), 'Não é possível excluir a única página.', true);
      return;
    }
    const ok = await window.JEDialog?.confirm?.({
      title: 'Excluir página',
      message: `Excluir "${page.title}" permanentemente?`,
      confirmLabel: 'Excluir',
      danger: true
    });
    if (ok === false) return;
    const { error } = await client.from('site_pages').delete().eq('id', page.id);
    if (error) {
      showToast($('hub-admin-toast'), error.message, true);
      return;
    }
    pages = pages.filter((p) => p.id !== page.id);
    currentId = pages[0]?.id || null;
    selectedBlockId = null;
    renderPagesList();
    renderCanvas();
    syncTopbar();
    showToast($('hub-admin-toast'), 'Página excluída.');
  }

  function publicUrl(page) {
    const slug = page?.slug || '';
    const base = `${location.origin}${location.pathname.replace(/hub\.html.*$/, '')}`;
    return `${base}pagina.html?slug=${encodeURIComponent(slug)}`;
  }

  function bindUi() {
    if (bound) return;
    bound = true;

    $('sb-back')?.addEventListener('click', () => {
      clearTimeout(saveTimer);
      saveCurrentPage().finally(() => window.JEHubRouter?.navigateTo?.('home'));
    });

    $('sb-site-title')?.addEventListener('input', (ev) => {
      const page = currentPage();
      if (!page) return;
      page.title = ev.target.value;
      if (!page._slugManual) page.slug = uniqueSlug(page.title);
      markDirty();
      renderPagesList();
    });

    document.querySelectorAll('[data-sb-add]').forEach((btn) => {
      btn.addEventListener('click', () => addBlock(btn.dataset.sbAdd));
    });

    document.querySelectorAll('.sb-panel-tab').forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.sbTab));
    });

    $('sb-new-page')?.addEventListener('click', () => createPage({ title: 'Nova página' }));

    $('sb-block-up')?.addEventListener('click', () => moveBlock(-1));
    $('sb-block-down')?.addEventListener('click', () => moveBlock(1));
    $('sb-block-delete')?.addEventListener('click', () => deleteBlock());

    $('sb-preview')?.addEventListener('click', () => {
      const page = currentPage();
      if (!page) return;
      window.open(publicUrl(page), '_blank', 'noopener');
    });

    $('sb-copy-link')?.addEventListener('click', async () => {
      const page = currentPage();
      if (!page) return;
      const url = publicUrl(page);
      try {
        await navigator.clipboard.writeText(url);
        showToast($('hub-admin-toast'), 'Link copiado.');
      } catch {
        showToast($('hub-admin-toast'), url);
      }
    });

    const pubBtn = $('sb-publish');
    const pubMenu = $('sb-publish-menu');
    pubBtn?.addEventListener('click', (ev) => {
      if (!pubMenu) return;
      const rect = pubBtn.getBoundingClientRect();
      pubMenu.style.top = `${rect.bottom + 6}px`;
      pubMenu.style.left = `${rect.right - 180}px`;
      pubMenu.classList.toggle('hidden');
      ev.stopPropagation();
    });

    document.addEventListener('click', () => pubMenu?.classList.add('hidden'));

    pubMenu?.querySelectorAll('[data-sb-action]').forEach((btn) => {
      btn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        pubMenu.classList.add('hidden');
        const action = btn.dataset.sbAction;
        if (action === 'publish') await setPageStatus('published');
        if (action === 'unpublish') await setPageStatus('draft');
        if (action === 'delete-page') await deleteCurrentPage();
      });
    });

    ['sb-theme-bg', 'sb-theme-text', 'sb-theme-accent', 'sb-theme-heading-font'].forEach((id) => {
      $(id)?.addEventListener('input', () => {
        const page = currentPage();
        if (!page) return;
        page.theme = {
          ...R.normalizeTheme(page.theme),
          bgColor: $('sb-theme-bg')?.value || page.theme.bgColor,
          textColor: $('sb-theme-text')?.value || page.theme.textColor,
          accentColor: $('sb-theme-accent')?.value || page.theme.accentColor,
          headingFont: $('sb-theme-heading-font')?.value || page.theme.headingFont
        };
        renderCanvas();
        markDirty();
      });
    });
  }

  async function init() {
    const profile = await guardPermission('site_builder');
    if (!profile) return false;

    client = await getClient();
    bindUi();
    try {
      await loadPages();
    } catch (err) {
      console.error('Site builder:', err);
      showToast($('hub-admin-toast'), err.message || 'Erro ao carregar páginas.', true);
      return false;
    }
    return true;
  }

  window.JEAdminSiteBuilder = { init };
})();
