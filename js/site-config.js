(function () {
  const Schema = () => window.JESiteConfigSchema;
  let cachedConfig = null;
  let cachedKey = null;

  function esc(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pageIdFromPath() {
    const file = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/i, '').toLowerCase();
    if (file === 'index' || file === '') return 'home';
    return file.replace(/-/g, '');
  }

  function isPreviewMode() {
    return new URLSearchParams(location.search).get('site_preview') === '1';
  }

  async function fetchConfigKey(key) {
    const client = await window.JEAuth?.getClient?.();
    if (!client) return null;
    const { data, error } = await client.from('site_settings').select('value').eq('key', key).maybeSingle();
    if (error) {
      console.warn('site_config load:', error.message);
      return null;
    }
    return data?.value || null;
  }

  async function loadConfig({ draft = false } = {}) {
    const useDraft = draft || (isPreviewMode() && await canPreviewDraft());
    const key = useDraft ? 'site_config_draft' : 'site_config';
    if (cachedConfig && cachedKey === key) return cachedConfig;

    let raw = await fetchConfigKey(key);
    if (useDraft && !raw) raw = await fetchConfigKey('site_config');
    cachedConfig = Schema()?.normalize(raw) || Schema()?.defaults();
    cachedKey = key;
    return cachedConfig;
  }

  async function canPreviewDraft() {
    try {
      const profile = await window.JEAuth?.getCurrentProfile?.();
      return profile && window.JEAuth?.hasPermission?.(profile, 'site_builder');
    } catch {
      return false;
    }
  }

  function mapLinks(lat, lng) {
    return {
      google: `https://www.google.com/maps?q=${lat},${lng}`,
      apple: `https://maps.apple.com/?daddr=${lat},${lng}`,
      waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
    };
  }

  function applyGlobal(global) {
    if (!global) return;
    document.querySelectorAll('.je-site-brand-name, .je-mobile-menu-title').forEach((el) => {
      el.textContent = global.brandName || '';
    });
    document.querySelectorAll('.je-footer-brand').forEach((el) => {
      el.textContent = global.brandName || '';
    });

    const logo = global.logoUrl;
    if (logo) {
      document.querySelectorAll('.je-site-brand-mark, .je-mobile-menu-mark').forEach((img) => {
        img.src = logo;
      });
    }

    const navRoot = document.getElementById('je-site-nav');
    const indicator = document.getElementById('je-site-nav-indicator');
    if (navRoot && Array.isArray(global.nav)) {
      const items = global.nav.filter((n) => n.visible !== false);
      navRoot.innerHTML = (indicator ? '<span id="je-site-nav-indicator" class="je-site-nav-indicator" aria-hidden="true"></span>' : '')
        + items.map((item) => {
          const iconOnly = item.iconOnly ? ' je-site-nav-link--icon' : '';
          const aria = item.iconOnly ? ` aria-label="${esc(item.label)}" title="${esc(item.label)}"` : '';
          const label = item.iconOnly ? '' : `<span>${esc(item.label)}</span>`;
          return `<a href="${esc(item.href)}" class="je-site-nav-link${iconOnly} nav-link"${aria}><span class="je-site-nav-emoji" aria-hidden="true">${esc(item.emoji || '')}</span>${label}</a>`;
        }).join('');
    }

    const mobileNav = document.querySelector('.je-mobile-menu-nav');
    if (mobileNav && Array.isArray(global.nav)) {
      const items = global.nav.filter((n) => n.visible !== false && !n.iconOnly);
      mobileNav.innerHTML = `
        <p class="je-mobile-menu-group">Início</p>
        ${items.map((item) => `
          <a href="${esc(item.href)}" class="je-mobile-nav-item nav-link" data-nav="${esc(item.id || '')}">
            <span class="je-mobile-nav-icon je-mobile-nav-icon--emoji" aria-hidden="true">${esc(item.emoji || '')}</span>
            <span class="je-mobile-nav-label">${esc(item.label)}</span>
            <span class="material-symbols-outlined je-mobile-nav-chevron" aria-hidden="true">north_east</span>
          </a>`).join('')}`;
    }

    const foot = global.footer || {};
    const setText = (sel, val) => document.querySelectorAll(sel).forEach((el) => { if (val != null) el.textContent = val; });
    setText('.je-footer-kicker', foot.kicker);
    setText('.je-footer-headline', foot.headline);
    setText('.je-footer-copy', foot.copyright);
    setText('.je-mobile-menu-foot p', foot.mobileLocation);

    const loc = foot.location || {};
    const locEl = document.querySelector('.je-footer-card--location .je-footer-text');
    if (locEl && Array.isArray(loc.lines)) {
      locEl.innerHTML = loc.lines.map((line) => esc(line)).join('<br>');
    }
    const maps = mapLinks(loc.maps?.lat ?? -23.647024, loc.maps?.lng ?? -46.77835);
    const mapRoot = document.querySelector('.je-footer-map-links');
    if (mapRoot) {
      mapRoot.querySelectorAll('a').forEach((a) => {
        const label = a.querySelector('.je-footer-map-btn-label')?.textContent?.trim().toLowerCase();
        if (label?.includes('google')) a.href = maps.google;
        if (label?.includes('apple')) a.href = maps.apple;
        if (label?.includes('waze')) a.href = maps.waze;
      });
    }

    const schedule = document.querySelector('.je-footer-schedule');
    if (schedule && Array.isArray(foot.meetings)) {
      schedule.innerHTML = foot.meetings.map((m) => `
        <li class="je-footer-schedule-item">
          <span class="je-footer-schedule-day">${esc(m.day)}</span>
          <span class="je-footer-schedule-detail">${esc(m.detail)}</span>
        </li>`).join('');
    }

    const emailLink = document.querySelector('.je-footer-email');
    if (emailLink && foot.email) {
      emailLink.href = `mailto:${foot.email}`;
      const span = emailLink.querySelector('span:last-child');
      if (span) span.textContent = foot.email;
    }
  }

  function applyHome(home) {
    if (!home || pageIdFromPath() !== 'home') return;

    const hero = home.hero || {};
    const eyebrowText = document.getElementById('je-site-home-hero-eyebrow-text');
    if (eyebrowText) eyebrowText.textContent = hero.eyebrow || '';
    const eyebrow = document.getElementById('je-site-home-hero-eyebrow');
    if (eyebrow) {
      const icon = eyebrow.querySelector('.material-symbols-outlined');
      if (icon && hero.eyebrowIcon) icon.textContent = hero.eyebrowIcon;
    }
    const title = document.getElementById('je-site-home-hero-title');
    if (title) title.textContent = hero.title || '';
    const img = document.getElementById('je-site-home-hero-img');
    if (img) {
      if (hero.imageUrl) img.src = hero.imageUrl;
      if (hero.imageAlt) img.alt = hero.imageAlt;
    }

    const sc = home.shortcuts || {};
    setText('#je-site-home-shortcuts-kicker', sc.kicker);
    setText('#je-site-home-shortcuts-title', sc.title);
    const shortcuts = document.getElementById('je-site-home-shortcuts');
    if (shortcuts && Array.isArray(sc.items)) {
      shortcuts.innerHTML = sc.items.map((item) => `
        <a class="je-home-shortcut je-home-shortcut--${esc(item.variant || 'default')}" href="${esc(item.href)}" aria-label="${esc(item.title)}">
          <span class="je-home-shortcut-icon" aria-hidden="true">${esc(item.emoji || '')}</span>
          <span class="je-home-shortcut-body">
            <span class="je-home-shortcut-title">${esc(item.title)}</span>
            <span class="je-home-shortcut-desc">${esc(item.desc || '')}</span>
          </span>
        </a>`).join('');
    }

    const week = home.week || {};
    setText('#je-site-home-week-kicker', week.kicker);
    setText('#je-site-home-week-title', week.title);

    const meeting = home.meeting || {};
    setText('#je-site-home-meeting-label', meeting.label);
    setText('#je-site-home-meeting-time', meeting.time);
    setText('#je-site-home-meeting-place', meeting.placeName);
    const addr = document.getElementById('je-site-home-meeting-address');
    if (addr && Array.isArray(meeting.addressLines)) {
      addr.innerHTML = meeting.addressLines.map((line) =>
        `<span class="je-home-meeting-address-line">${esc(line)}</span>`).join('');
    }
    const mmaps = mapLinks(meeting.maps?.lat ?? -23.647024, meeting.maps?.lng ?? -46.77835);
    document.querySelectorAll('.je-home-meeting-map-btn').forEach((a) => {
      const aria = (a.getAttribute('aria-label') || '').toLowerCase();
      if (aria.includes('google')) a.href = mmaps.google;
      if (aria.includes('apple')) a.href = mmaps.apple;
      if (aria.includes('waze')) a.href = mmaps.waze;
    });

    const news = home.news || {};
    setText('#je-site-home-news-title', news.title);
    const newsList = document.getElementById('je-site-home-news-list');
    if (newsList && Array.isArray(news.items)) {
      newsList.innerHTML = news.items.map((item) => `
        <li class="je-home-news-item">
          <span class="je-home-news-icon" aria-hidden="true"><span class="material-symbols-outlined">${esc(item.icon || 'new_releases')}</span></span>
          <p class="je-home-news-text">${esc(item.text)}</p>
        </li>`).join('');
    }
  }

  function setText(sel, val) {
    if (val == null) return;
    document.querySelectorAll(sel).forEach((el) => { el.textContent = val; });
  }

  function applyPage(pageId, pageCfg, brandName) {
    if (!pageCfg || pageId === 'home') return;
    const root = document.querySelector(`[data-je-page="${pageId}"]`) || document.querySelector('main');
    if (!root) return;

    const title = root.querySelector('[data-je-hero="title"]');
    const subtitle = root.querySelector('[data-je-hero="subtitle"]');
    const pill = root.querySelector('[data-je-hero="pill"]');
    const crumb = root.querySelector('[data-je-hero="crumb"]');
    if (title && pageCfg.title) title.textContent = pageCfg.title;
    if (subtitle && pageCfg.subtitle != null) subtitle.textContent = pageCfg.subtitle;
    if (pill) {
      pill.textContent = pageCfg.statusPill || '';
      pill.closest('[data-je-hero="pill-wrap"]')?.classList.toggle('hidden', !pageCfg.statusPill);
    }
    if (crumb && pageCfg.crumb) crumb.textContent = pageCfg.crumb;

    root.querySelectorAll('[data-je-brand="name"]').forEach((el) => {
      el.textContent = brandName || '';
    });

    const intro = root.querySelector('[data-je-page-intro="text"]');
    if (intro) {
      if (pageCfg.introText) intro.innerHTML = pageCfg.introText;
      else if (pageCfg.intro) {
        if (typeof pageCfg.intro === 'string') intro.textContent = pageCfg.intro;
        else intro.innerHTML = `<strong class="text-primary">${esc(pageCfg.intro.bold || '')}</strong> ${esc(pageCfg.intro.text || '')}`;
      }
    }

    const stepsRoot = root.querySelector('[data-je-page-steps]');
    if (stepsRoot && Array.isArray(pageCfg.steps)) {
      const stepClass = stepsRoot.dataset.jePageStepsClass || 'je-sch-step';
      const numClass = stepsRoot.dataset.jePageStepsNumClass || 'je-sch-step-num';
      stepsRoot.innerHTML = pageCfg.steps.map((text, i) => `
        <div class="${esc(stepClass)}"><span class="${esc(numClass)}">${i + 1}</span><span>${esc(text)}</span></div>`).join('');
    }
  }

  async function apply(options = {}) {
    const config = options.config || await loadConfig({ draft: options.draft });
    applyGlobal(config.global);
    applyHome(config.home);
    applyPage(pageIdFromPath(), config.pages?.[pageIdFromPath()], config.global?.brandName);

    if (isPreviewMode() && await canPreviewDraft()) {
      let banner = document.getElementById('je-site-preview-banner');
      if (!banner) {
        banner = document.createElement('p');
        banner.id = 'je-site-preview-banner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;margin:0;padding:.5rem 1rem;text-align:center;font-size:.75rem;font-weight:700;background:#fef7e0;color:#b06000;';
        document.body.prepend(banner);
      }
      banner.textContent = 'Pré-visualização do rascunho — alterações ainda não publicadas';
    }

    window.dispatchEvent(new CustomEvent('je:site-config-applied', { detail: { config } }));
    window.JESiteNav?.refresh?.();

    return config;
  }

  function invalidateCache() {
    cachedConfig = null;
    cachedKey = null;
  }

  window.JESiteConfig = {
    loadConfig,
    apply,
    invalidateCache,
    pageIdFromPath,
    isPreviewMode,
    getDefaults: () => Schema()?.defaults()
  };
})();
