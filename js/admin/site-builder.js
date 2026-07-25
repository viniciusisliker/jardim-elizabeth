(function () {
  const { guardPermission, getClient, showToast, escapeHtml } = window.JEAdmin;
  const Schema = () => window.JESiteConfigSchema;

  let client;
  let config = null;
  let currentSection = 'global';
  let customPages = [];
  let currentCustomId = null;
  let saveTimer = null;
  let saving = false;
  let bound = false;

  function $(id) { return document.getElementById(id); }

  function setStatus(text) {
    const el = $('sb-save-status');
    if (el) el.textContent = text;
  }

  function markDirty() {
    setStatus('Alterações não salvas…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 1200);
  }

  function previewUrl(section) {
    const meta = Schema()?.PAGE_META?.[section] || Schema()?.PAGE_META?.home;
    const file = meta?.preview || 'index.html';
    const base = `${location.origin}${location.pathname.replace(/hub\.html.*$/, '')}`;
    return `${base}${file}?site_preview=1`;
  }

  function refreshPreview() {
    const frame = $('sb-preview-frame');
    if (!frame) return;
    if (currentCustomId) {
      const page = customPages.find((p) => p.id === currentCustomId);
      if (page) frame.src = `${location.origin}${location.pathname.replace(/hub\.html.*$/, '')}pagina.html?slug=${encodeURIComponent(page.slug)}&site_preview=1`;
      return;
    }
    frame.src = previewUrl(currentSection);
  }

  async function loadDraft() {
    const { data } = await client.from('site_settings').select('value').eq('key', 'site_config_draft').maybeSingle();
    if (data?.value) return Schema().normalize(data.value);
    const { data: pub } = await client.from('site_settings').select('value').eq('key', 'site_config').maybeSingle();
    if (pub?.value) return Schema().normalize(pub.value);
    return Schema().defaults();
  }

  async function saveDraft() {
    if (!config || saving) return;
    saving = true;
    setStatus('Salvando…');
    const { error } = await client.from('site_settings').upsert({ key: 'site_config_draft', value: config });
    saving = false;
    if (error) {
      setStatus('Erro ao salvar');
      showToast($('hub-admin-toast'), error.message, true);
      return;
    }
    setStatus('Rascunho salvo');
    refreshPreview();
  }

  async function publishSite() {
    clearTimeout(saveTimer);
    await saveDraft();
    const { error } = await client.from('site_settings').upsert({ key: 'site_config', value: config });
    if (error) {
      showToast($('hub-admin-toast'), error.message, true);
      return;
    }
    window.JESiteConfig?.invalidateCache?.();
    setStatus('Site publicado');
    showToast($('hub-admin-toast'), 'Site publicado com sucesso.');
  }

  async function loadCustomPages() {
    const { data, error } = await client.from('site_pages').select('*').order('sort_order').order('title');
    if (error) throw error;
    customPages = data || [];
  }

  function field(label, path, value, type = 'text', extra = '') {
    const id = path.replace(/[^\w]/g, '_');
    if (type === 'textarea') {
      return `<label class="sb-field">${escapeHtml(label)}<textarea data-path="${escapeHtml(path)}" rows="3">${escapeHtml(value)}</textarea></label>`;
    }
    if (type === 'checkbox') {
      return `<label class="sb-field sb-field--row"><input type="checkbox" data-path="${escapeHtml(path)}" ${value ? 'checked' : ''}/> ${escapeHtml(label)}</label>`;
    }
    if (type === 'select') {
      return `<label class="sb-field">${escapeHtml(label)}<select data-path="${escapeHtml(path)}">${extra}</select></label>`;
    }
    return `<label class="sb-field">${escapeHtml(label)}<input type="${escapeHtml(type)}" data-path="${escapeHtml(path)}" value="${escapeHtml(value)}"/></label>`;
  }

  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  function setPath(obj, path, value) {
    const keys = path.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i += 1) {
      const k = keys[i];
      const next = keys[i + 1];
      if (cur[k] == null) cur[k] = /^\d+$/.test(next) ? [] : {};
      cur = cur[k];
    }
    cur[keys[keys.length - 1]] = value;
  }

  function bindForm(root) {
    root.querySelectorAll('[data-path]').forEach((input) => {
      const handler = () => {
        let val;
        if (input.type === 'checkbox') val = input.checked;
        else if (input.type === 'number') val = Number(input.value) || 0;
        else val = input.value;
        setPath(config, input.dataset.path, val);
        markDirty();
      };
      input.addEventListener('input', handler);
      input.addEventListener('change', handler);
    });
    root.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'add-nav') {
          config.global.nav.push({ id: `link-${Date.now()}`, label: 'Novo link', href: '#', emoji: '🔗', visible: true });
          renderEditor();
          markDirty();
        }
        if (action === 'add-shortcut') {
          config.home.shortcuts.items.push({ href: '#', emoji: '🔗', title: 'Novo', desc: '', variant: 'agenda' });
          renderEditor();
          markDirty();
        }
        if (action === 'add-news') {
          config.home.news.items.push({ icon: 'new_releases', text: 'Nova novidade' });
          renderEditor();
          markDirty();
        }
        if (action === 'add-meeting') {
          config.global.footer.meetings.push({ day: '—', detail: 'Horário' });
          renderEditor();
          markDirty();
        }
        if (action === 'add-step' && btn.dataset.page) {
          const page = config.pages[btn.dataset.page];
          if (!page.steps) page.steps = [];
          page.steps.push('Novo passo');
          renderEditor();
          markDirty();
        }
        if (action === 'remove-nav' && btn.dataset.index != null) {
          config.global.nav.splice(Number(btn.dataset.index), 1);
          renderEditor();
          markDirty();
        }
        if (action === 'remove-shortcut' && btn.dataset.index != null) {
          config.home.shortcuts.items.splice(Number(btn.dataset.index), 1);
          renderEditor();
          markDirty();
        }
        if (action === 'remove-news' && btn.dataset.index != null) {
          config.home.news.items.splice(Number(btn.dataset.index), 1);
          renderEditor();
          markDirty();
        }
      });
    });
  }

  function renderGlobalForm() {
    const g = config.global;
    const f = g.footer;
    let navHtml = (g.nav || []).map((item, i) => `
      <div class="sb-repeat">
        ${field('Rótulo', `global.nav.${i}.label`, item.label)}
        ${field('Link', `global.nav.${i}.href`, item.href)}
        ${field('Emoji', `global.nav.${i}.emoji`, item.emoji)}
        ${field('Visível', `global.nav.${i}.visible`, item.visible !== false, 'checkbox')}
        <button type="button" class="sb-mini-btn sb-mini-btn--danger" data-action="remove-nav" data-index="${i}">Remover</button>
      </div>`).join('');
    let meetingsHtml = (f.meetings || []).map((m, i) => `
      <div class="sb-repeat">
        ${field('Dia', `global.footer.meetings.${i}.day`, m.day)}
        ${field('Detalhe', `global.footer.meetings.${i}.detail`, m.detail)}
      </div>`).join('');

    return `
      <section class="sb-editor-section">
        <h3>Identidade</h3>
        ${field('Nome da congregação', 'global.brandName', g.brandName)}
        ${field('URL do logo', 'global.logoUrl', g.logoUrl)}
      </section>
      <section class="sb-editor-section">
        <h3>Menu principal</h3>
        ${navHtml}
        <button type="button" class="sb-mini-btn" data-action="add-nav">+ Item de menu</button>
      </section>
      <section class="sb-editor-section">
        <h3>Rodapé</h3>
        ${field('Chamada', 'global.footer.kicker', f.kicker)}
        ${field('Título', 'global.footer.headline', f.headline)}
        ${field('Endereço (linha 1)', 'global.footer.location.lines.0', f.location?.lines?.[0] || '')}
        ${field('Endereço (linha 2)', 'global.footer.location.lines.1', f.location?.lines?.[1] || '')}
        ${field('Endereço (linha 3)', 'global.footer.location.lines.2', f.location?.lines?.[2] || '')}
        ${field('E-mail', 'global.footer.email', f.email)}
        ${field('Copyright', 'global.footer.copyright', f.copyright)}
        ${field('Local mobile', 'global.footer.mobileLocation', f.mobileLocation)}
        <h4>Reuniões</h4>
        ${meetingsHtml}
        <button type="button" class="sb-mini-btn" data-action="add-meeting">+ Reunião</button>
      </section>`;
  }

  function renderHomeForm() {
    const h = config.home;
    let shortcuts = (h.shortcuts?.items || []).map((item, i) => `
      <div class="sb-repeat">
        ${field('Título', `home.shortcuts.items.${i}.title`, item.title)}
        ${field('Descrição', `home.shortcuts.items.${i}.desc`, item.desc)}
        ${field('Link', `home.shortcuts.items.${i}.href`, item.href)}
        ${field('Emoji', `home.shortcuts.items.${i}.emoji`, item.emoji)}
        <button type="button" class="sb-mini-btn sb-mini-btn--danger" data-action="remove-shortcut" data-index="${i}">Remover</button>
      </div>`).join('');
    let news = (h.news?.items || []).map((item, i) => `
      <div class="sb-repeat">
        ${field('Ícone Material', `home.news.items.${i}.icon`, item.icon)}
        ${field('Texto', `home.news.items.${i}.text`, item.text)}
        <button type="button" class="sb-mini-btn sb-mini-btn--danger" data-action="remove-news" data-index="${i}">Remover</button>
      </div>`).join('');

    return `
      <section class="sb-editor-section">
        <h3>Hero</h3>
        ${field('Selo', 'home.hero.eyebrow', h.hero?.eyebrow)}
        ${field('Ícone selo', 'home.hero.eyebrowIcon', h.hero?.eyebrowIcon)}
        ${field('Título', 'home.hero.title', h.hero?.title)}
        ${field('Imagem URL', 'home.hero.imageUrl', h.hero?.imageUrl)}
        ${field('Alt da imagem', 'home.hero.imageAlt', h.hero?.imageAlt)}
      </section>
      <section class="sb-editor-section">
        <h3>Atalhos</h3>
        ${field('Kicker', 'home.shortcuts.kicker', h.shortcuts?.kicker)}
        ${field('Título', 'home.shortcuts.title', h.shortcuts?.title)}
        ${shortcuts}
        <button type="button" class="sb-mini-btn" data-action="add-shortcut">+ Atalho</button>
      </section>
      <section class="sb-editor-section">
        <h3>Esta semana</h3>
        ${field('Kicker', 'home.week.kicker', h.week?.kicker)}
        ${field('Título', 'home.week.title', h.week?.title)}
        ${field('Rótulo reunião', 'home.meeting.label', h.meeting?.label)}
        ${field('Horário', 'home.meeting.time', h.meeting?.time)}
        ${field('Local', 'home.meeting.placeName', h.meeting?.placeName)}
        ${field('Endereço linha 1', 'home.meeting.addressLines.0', h.meeting?.addressLines?.[0] || '')}
        ${field('Endereço linha 2', 'home.meeting.addressLines.1', h.meeting?.addressLines?.[1] || '')}
      </section>
      <section class="sb-editor-section">
        <h3>Novidades</h3>
        ${field('Título', 'home.news.title', h.news?.title)}
        ${news}
        <button type="button" class="sb-mini-btn" data-action="add-news">+ Novidade</button>
      </section>`;
  }

  function renderPageForm(pageId) {
    const p = config.pages[pageId] || {};
    let stepsHtml = '';
    if (Array.isArray(p.steps)) {
      stepsHtml = `<h4>Passos</h4>${p.steps.map((s, i) => field(`Passo ${i + 1}`, `pages.${pageId}.steps.${i}`, s)).join('')}
        <button type="button" class="sb-mini-btn" data-action="add-step" data-page="${pageId}">+ Passo</button>`;
    }
    const introFields = p.introText != null
      ? field('Introdução (HTML)', `pages.${pageId}.introText`, p.introText, 'textarea')
      : `${field('Intro — destaque', `pages.${pageId}.intro.bold`, p.intro?.bold || '')}${field('Intro — texto', `pages.${pageId}.intro.text`, p.intro?.text || '')}`;

    return `
      <section class="sb-editor-section">
        <h3>Cabeçalho da página</h3>
        ${field('Breadcrumb', `pages.${pageId}.crumb`, p.crumb || '')}
        ${field('Título', `pages.${pageId}.title`, p.title || '')}
        ${field('Subtítulo', `pages.${pageId}.subtitle`, p.subtitle || '', 'textarea')}
        ${field('Selo de status', `pages.${pageId}.statusPill`, p.statusPill || '')}
      </section>
      ${introFields ? `<section class="sb-editor-section"><h3>Introdução</h3>${introFields}${stepsHtml}</section>` : stepsHtml ? `<section class="sb-editor-section">${stepsHtml}</section>` : ''}`;
  }

  function renderCustomPageForm(page) {
    return `
      <section class="sb-editor-section">
        <h3>Página extra</h3>
        <label class="sb-field">Título<input id="sb-custom-title" type="text" value="${escapeHtml(page.title)}"/></label>
        <label class="sb-field">Slug (URL)<input id="sb-custom-slug" type="text" value="${escapeHtml(page.slug)}"/></label>
        <p class="sb-hint">Link: pagina.html?slug=${escapeHtml(page.slug)}</p>
        <p class="sb-hint">Status: ${page.status === 'published' ? 'Publicada' : 'Rascunho'}</p>
        <div class="sb-row-actions">
          <button type="button" id="sb-custom-publish" class="sb-mini-btn">${page.status === 'published' ? 'Despublicar' : 'Publicar'}</button>
          <button type="button" id="sb-custom-delete" class="sb-mini-btn sb-mini-btn--danger">Excluir página</button>
        </div>
      </section>`;
  }

  function renderEditor() {
    const form = $('sb-editor-form');
    const title = $('sb-editor-title');
    if (!form) return;

    document.querySelector('.sb-workspace--site')?.classList.toggle('hidden', !!currentCustomId);
    $('sb-custom-editor')?.classList.toggle('hidden', !currentCustomId);

    if (currentCustomId) {
      const page = customPages.find((p) => p.id === currentCustomId);
      if (!page) return;
      title.textContent = page.title;
      form.innerHTML = renderCustomPageForm(page);
      bindCustomForm(page);
      return;
    }

    const meta = Schema()?.PAGE_META?.[currentSection];
    title.textContent = meta?.label || 'Propriedades';

    if (currentSection === 'global') form.innerHTML = renderGlobalForm();
    else if (currentSection === 'home') form.innerHTML = renderHomeForm();
    else form.innerHTML = renderPageForm(currentSection);

    bindForm(form);
  }

  function bindCustomForm(page) {
    const form = $('sb-editor-form');
    const titleInput = form.querySelector('#sb-custom-title');
    const slugInput = form.querySelector('#sb-custom-slug');
    const saveCustom = async () => {
      page.title = titleInput?.value?.trim() || page.title;
      page.slug = slugInput?.value?.trim() || page.slug;
      await client.from('site_pages').update({ title: page.title, slug: page.slug }).eq('id', page.id);
      renderPagesList();
      refreshPreview();
    };
    titleInput?.addEventListener('input', () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveCustom, 800); });
    slugInput?.addEventListener('input', () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveCustom, 800); });
    $('sb-custom-publish')?.addEventListener('click', async () => {
      page.status = page.status === 'published' ? 'draft' : 'published';
      await client.from('site_pages').update({ status: page.status }).eq('id', page.id);
      renderPagesList();
      showToast($('hub-admin-toast'), page.status === 'published' ? 'Página publicada.' : 'Página em rascunho.');
    });
    $('sb-custom-delete')?.addEventListener('click', async () => {
      await client.from('site_pages').delete().eq('id', page.id);
      customPages = customPages.filter((p) => p.id !== page.id);
      currentCustomId = null;
      currentSection = 'home';
      renderPagesList();
      renderEditor();
      refreshPreview();
    });
  }

  function renderPagesList() {
    const list = $('sb-pages-list');
    const customList = $('sb-custom-pages-list');
    if (!list) return;

    const items = [
      { id: 'global', label: 'Site (global)' },
      { id: 'home', label: 'Início' },
      ...Schema().SITE_PAGE_IDS.filter((id) => id !== 'home').map((id) => ({
        id,
        label: Schema().PAGE_META[id]?.label || id
      }))
    ];

    list.innerHTML = items.map((item) => `
      <li><button type="button" class="${!currentCustomId && currentSection === item.id ? 'active' : ''}" data-section="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button></li>`).join('');

    list.querySelectorAll('[data-section]').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentCustomId = null;
        currentSection = btn.dataset.section;
        renderPagesList();
        renderEditor();
        refreshPreview();
      });
    });

    if (customList) {
      customList.innerHTML = customPages.map((p) => `
        <li><button type="button" class="${currentCustomId === p.id ? 'active' : ''}" data-custom-id="${escapeHtml(p.id)}">${escapeHtml(p.title)}</button></li>`).join('');
      customList.querySelectorAll('[data-custom-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentCustomId = btn.dataset.customId;
          currentSection = '';
          renderPagesList();
          renderEditor();
          refreshPreview();
        });
      });
    }
  }

  async function createCustomPage() {
    const title = 'Nova página';
    const slug = `pagina-${Date.now().toString(36).slice(-4)}`;
    const { data, error } = await client.from('site_pages').insert({
      title,
      slug,
      status: 'draft',
      layout: { blocks: [window.JESitePageRenderer?.newBlock?.('hero') || { id: 'h', type: 'hero', data: { title: 'Nova página', align: 'center' } }] },
      theme: window.JESitePageRenderer?.defaultTheme?.() || {}
    }).select('*').single();
    if (error) throw error;
    customPages.push(data);
    currentCustomId = data.id;
    renderPagesList();
    renderEditor();
    refreshPreview();
  }

  function bindUi() {
    if (bound) return;
    bound = true;

    $('sb-back')?.addEventListener('click', () => {
      clearTimeout(saveTimer);
      saveDraft().finally(() => window.JEHubRouter?.navigateTo?.('home'));
    });
    $('sb-publish')?.addEventListener('click', publishSite);
    $('sb-preview')?.addEventListener('click', () => window.open(previewUrl(currentCustomId ? 'home' : currentSection), '_blank', 'noopener'));
    $('sb-refresh-preview')?.addEventListener('click', refreshPreview);
    $('sb-new-custom-page')?.addEventListener('click', () => createCustomPage().catch((e) => showToast($('hub-admin-toast'), e.message, true)));
  }

  async function init() {
    const profile = await guardPermission('site_builder');
    if (!profile) return false;

    if (!window.JESiteConfigSchema) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'js/site-config-schema.js?v=20260725200000';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    client = await getClient();
    bindUi();
    try {
      config = await loadDraft();
      await loadCustomPages();
      renderPagesList();
      renderEditor();
      refreshPreview();
      setStatus('Rascunho carregado');
    } catch (err) {
      console.error('Site editor:', err);
      showToast($('hub-admin-toast'), err.message || 'Erro ao carregar editor.', true);
      return false;
    }
    return true;
  }

  window.JEAdminSiteBuilder = { init };
})();
