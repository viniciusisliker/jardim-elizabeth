(function () {
  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function sanitizeUrl(url) {
    const s = String(url || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s) || s.startsWith('/') || s.startsWith('#')) return s;
    return '';
  }

  function defaultTheme() {
    return {
      bgColor: '#141414',
      textColor: '#f5f5f5',
      accentColor: '#c9a227',
      headingFont: 'Georgia, "Times New Roman", serif',
      bodyFont: 'Inter, system-ui, sans-serif'
    };
  }

  function normalizeTheme(theme) {
    const d = defaultTheme();
    return { ...d, ...(theme && typeof theme === 'object' ? theme : {}) };
  }

  function blockAlignClass(align) {
    if (align === 'left') return 'je-sp-align-left';
    if (align === 'right') return 'je-sp-align-right';
    return 'je-sp-align-center';
  }

  function renderBlock(block, theme, { editMode = false, selectedId = null } = {}) {
    if (!block || !block.type) return '';
    const t = normalizeTheme(theme);
    const sel = editMode && block.id === selectedId ? ' je-sp-block--selected' : '';
    const wrap = (inner, extraClass = '') =>
      `<div class="je-sp-block je-sp-block--${escapeHtml(block.type)}${sel}${extraClass ? ` ${extraClass}` : ''}" data-block-id="${escapeHtml(block.id)}" draggable="${editMode ? 'true' : 'false'}">${inner}${editMode ? '<div class="je-sp-block__handles" aria-hidden="true"><span></span><span></span></div>' : ''}</div>`;

    const data = block.data || {};

    switch (block.type) {
      case 'hero': {
        const img = data.imageUrl
          ? `<div class="je-sp-hero__img"><img src="${escapeHtml(sanitizeUrl(data.imageUrl))}" alt="" loading="lazy"/></div>`
          : '';
        return wrap(`
          <div class="je-sp-hero ${blockAlignClass(data.align)}">
            ${img}
            <h1 class="je-sp-hero__title" style="font-family:${escapeHtml(t.headingFont)}">${escapeHtml(data.title || '')}</h1>
            ${data.subtitle ? `<p class="je-sp-hero__subtitle" style="color:${escapeHtml(t.accentColor)}">${escapeHtml(data.subtitle)}</p>` : ''}
          </div>`);
      }
      case 'heading':
        return wrap(`
          <div class="${blockAlignClass(data.align)}">
            <h2 class="je-sp-heading" style="font-family:${escapeHtml(t.headingFont)}">${escapeHtml(data.text || '')}</h2>
          </div>`);
      case 'text':
        return wrap(`
          <div class="je-sp-text ${blockAlignClass(data.align)}">
            <div class="je-sp-text__body" style="font-family:${escapeHtml(t.bodyFont)}">${escapeHtml(data.text || '').replace(/\n/g, '<br>')}</div>
          </div>`);
      case 'image': {
        const url = sanitizeUrl(data.url);
        if (!url) return wrap('<div class="je-sp-image je-sp-image--empty">Imagem</div>');
        const w = data.width === 'full' ? ' je-sp-image--full' : '';
        return wrap(`
          <figure class="je-sp-image${w} ${blockAlignClass(data.align)}">
            <img src="${escapeHtml(url)}" alt="${escapeHtml(data.alt || '')}" loading="lazy"/>
            ${data.caption ? `<figcaption>${escapeHtml(data.caption)}</figcaption>` : ''}
          </figure>`);
      }
      case 'button': {
        const href = sanitizeUrl(data.url) || '#';
        return wrap(`
          <div class="${blockAlignClass(data.align)}">
            <a class="je-sp-btn${data.style === 'outline' ? ' je-sp-btn--outline' : ''}" href="${escapeHtml(href)}" style="${data.style === 'outline' ? `border-color:${escapeHtml(t.accentColor)};color:${escapeHtml(t.accentColor)}` : `background:${escapeHtml(t.accentColor)}`}">${escapeHtml(data.label || 'Botão')}</a>
          </div>`, 'je-sp-block--button');
      }
      case 'spacer':
        return wrap(`<div class="je-sp-spacer" style="height:${Math.max(8, Math.min(240, Number(data.height) || 32))}px"></div>`);
      case 'divider':
        return wrap(`<hr class="je-sp-divider" style="border-color:${escapeHtml(t.accentColor)}33"/>`);
      case 'embed': {
        const url = sanitizeUrl(data.url);
        const h = Math.max(120, Math.min(800, Number(data.height) || 360));
        if (!url) return wrap('<div class="je-sp-embed je-sp-embed--empty">Incorporar URL</div>');
        return wrap(`<div class="je-sp-embed"><iframe src="${escapeHtml(url)}" title="Conteúdo incorporado" loading="lazy" style="height:${h}px" sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe></div>`);
      }
      default:
        return '';
    }
  }

  function renderPage(container, page, options = {}) {
    if (!container) return;
    const theme = normalizeTheme(page?.theme);
    const blocks = Array.isArray(page?.layout?.blocks) ? page.layout.blocks : [];
    container.style.setProperty('--je-sp-bg', theme.bgColor);
    container.style.setProperty('--je-sp-text', theme.textColor);
    container.style.setProperty('--je-sp-accent', theme.accentColor);
    container.className = `je-sp-page${options.editMode ? ' je-sp-page--edit' : ''}`;
    container.innerHTML = blocks.map((b) => renderBlock(b, theme, options)).join('');
  }

  function newBlock(type) {
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const base = { id, type, data: { align: 'center' } };
    switch (type) {
      case 'hero':
        base.data = { title: 'Título', subtitle: '', imageUrl: '', align: 'center' };
        break;
      case 'heading':
        base.data = { text: 'Subtítulo', align: 'center' };
        break;
      case 'text':
        base.data = { text: 'Digite o texto aqui…', align: 'left' };
        break;
      case 'image':
        base.data = { url: '', alt: '', caption: '', width: 'normal', align: 'center' };
        break;
      case 'button':
        base.data = { label: 'Saiba mais', url: '', style: 'filled', align: 'center' };
        break;
      case 'spacer':
        base.data = { height: 48 };
        break;
      case 'divider':
        base.data = {};
        break;
      case 'embed':
        base.data = { url: '', height: 360 };
        break;
      default:
        break;
    }
    return base;
  }

  window.JESitePageRenderer = {
    defaultTheme,
    normalizeTheme,
    newBlock,
    renderBlock,
    renderPage,
    escapeHtml,
    sanitizeUrl
  };
})();
