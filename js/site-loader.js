(function () {
  const SYMBOLS_HREF = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block';
  const SYMBOLS_CSS = `
    .material-symbols-outlined {
      font-family: 'Material Symbols Outlined', sans-serif;
      font-weight: normal;
      font-style: normal;
      font-size: 24px;
      line-height: 1;
      letter-spacing: normal;
      text-transform: none;
      display: inline-block;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
      font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
      -webkit-font-smoothing: antialiased;
      font-feature-settings: 'liga';
    }
  `;

  const CHROME_CSS = `
    .je-footer-info {
      position: relative;
      overflow: hidden;
      padding: 3.5rem 0 2.5rem;
      background: linear-gradient(165deg, #f5f8fc 0%, #eae8e7 48%, #f0ece6 100%);
    }
    .je-footer-info::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0.45;
      background:
        radial-gradient(ellipse 70% 50% at 100% 0%, rgba(200, 169, 110, 0.18) 0%, transparent 55%),
        radial-gradient(ellipse 50% 40% at 0% 100%, rgba(59, 94, 151, 0.12) 0%, transparent 50%);
    }
    .je-footer-shell { position: relative; z-index: 1; }
    .je-footer-intro { margin-bottom: 1.75rem; max-width: 28rem; }
    .je-footer-kicker {
      margin: 0 0 0.375rem;
      font-size: 0.6875rem;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #3b5e97;
    }
    .je-footer-headline {
      margin: 0;
      font-size: clamp(1.375rem, 2.5vw, 1.75rem);
      font-weight: 800;
      line-height: 1.2;
      color: #0f3462;
    }
    .je-footer-grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: 1fr;
    }
    @media (min-width: 768px) {
      .je-footer-grid {
        grid-template-columns: 1.4fr 1fr 1fr;
        align-items: stretch;
      }
    }
    .je-footer-card {
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(15, 52, 98, 0.1);
      border-radius: 1rem;
      padding: 1.25rem 1.375rem;
      box-shadow: 0 4px 20px rgba(15, 52, 98, 0.06);
      transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
    }
    .je-footer-card:hover {
      border-color: rgba(59, 94, 151, 0.28);
      box-shadow: 0 8px 28px rgba(15, 52, 98, 0.1);
      transform: translateY(-2px);
    }
    .je-footer-card--location { border-top: 3px solid #3b5e97; }
    .je-footer-card--meetings { border-top: 3px solid #984806; }
    .je-footer-card--contact { border-top: 3px solid #c8a96e; }
    .je-footer-card-head {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.875rem;
    }
    .je-footer-card-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.75rem;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      color: #0f3462;
      flex-shrink: 0;
    }
    .je-footer-card-icon .material-symbols-outlined {
      font-size: 1.375rem;
      font-variation-settings: 'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24;
    }
    .je-footer-card--meetings .je-footer-card-icon {
      background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
      color: #984806;
    }
    .je-footer-card--contact .je-footer-card-icon {
      background: linear-gradient(135deg, #faf6ef 0%, #f3ead8 100%);
      color: #8a6d3b;
    }
    .je-footer-icon {
      font-family: 'Material Symbols Outlined', sans-serif;
      font-size: 2.25rem;
      line-height: 1;
      color: #3b5e97;
      display: block;
      margin-bottom: 1rem;
      font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 48;
      font-feature-settings: 'liga';
    }
    .je-footer-title {
      font-size: 1rem;
      font-weight: 800;
      color: #0f3462;
      margin: 0;
      line-height: 1.2;
    }
    .je-footer-text {
      font-size: 0.875rem;
      line-height: 1.6;
      color: #43474f;
      margin: 0 0 1rem;
    }
    .je-footer-link {
      color: #43474f;
      text-decoration: none;
    }
    .je-footer-link:hover { text-decoration: underline; }
    .je-footer-map-links {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .je-footer-map-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      flex: 1 1 calc(33.333% - 0.35rem);
      min-width: 7.5rem;
      background: #f8fafc;
      border: 1px solid #e2e6ef;
      border-radius: 9999px;
      padding: 0.5rem 0.875rem;
      font-size: 0.75rem;
      font-weight: 700;
      color: #0f3462;
      text-decoration: none;
      transition: border-color 0.15s, box-shadow 0.15s, background 0.15s, transform 0.15s;
    }
    .je-footer-map-btn svg,
    .je-footer-map-btn-icon { flex-shrink: 0; width: 1.125rem; height: 1.125rem; object-fit: contain; }
    .je-footer-map-btn:hover {
      border-color: #3b5e97;
      background: #fff;
      box-shadow: 0 4px 12px rgba(15, 52, 98, 0.12);
      transform: translateY(-1px);
    }
    .je-footer-map-btn-label { flex: 0 1 auto; min-width: 0; white-space: nowrap; }
    .je-footer-schedule {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
    }
    .je-footer-schedule-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0.75rem;
      border-radius: 0.75rem;
      background: #f8fafc;
      border: 1px solid #eef0f4;
    }
    .je-footer-schedule-day {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2.25rem;
      padding: 0.25rem 0.375rem;
      border-radius: 0.5rem;
      background: #0f3462;
      color: #fff;
      font-size: 0.6875rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .je-footer-schedule-detail {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #43474f;
      line-height: 1.35;
    }
    .je-footer-email {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      width: 100%;
      padding: 0.875rem 1rem;
      border-radius: 0.75rem;
      background: linear-gradient(135deg, #0f3462 0%, #1a4a7a 100%);
      color: #fff;
      font-size: 0.8125rem;
      font-weight: 700;
      text-decoration: none;
      word-break: break-all;
      transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
      box-shadow: 0 4px 14px rgba(15, 52, 98, 0.22);
    }
    .je-footer-email .material-symbols-outlined {
      font-size: 1.25rem;
      flex-shrink: 0;
      font-variation-settings: 'FILL' 0, 'wght' 500;
    }
    .je-footer-email:hover {
      opacity: 0.94;
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(15, 52, 98, 0.28);
    }
    .je-footer-bar {
      background: linear-gradient(135deg, #0a2847 0%, #0f3462 100%);
      width: 100%;
      border-top: 3px solid #c8a96e;
    }
    .je-footer-brand {
      font-size: 1.0625rem;
      font-weight: 800;
      color: #fff;
      letter-spacing: 0.02em;
    }
    .je-footer-copy {
      font-size: 0.8125rem;
      color: rgba(255, 255, 255, 0.72);
      text-align: center;
    }

    /* Site header — desktop nav em pills */
    .je-site-header {
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(15, 52, 98, 0.08);
      box-shadow: 0 4px 24px rgba(15, 52, 98, 0.06);
    }
    .je-site-header-accent {
      height: 3px;
      background: linear-gradient(90deg, #0a2847 0%, #0f3462 42%, #c8a96e 100%);
    }
    .je-site-header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      min-height: 4.25rem;
    }
    .je-site-brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      color: inherit;
      min-width: 0;
    }
    .je-site-brand-mark {
      display: block;
      width: 2.5rem;
      height: 2.5rem;
      flex-shrink: 0;
      border-radius: 0.75rem;
      box-shadow: 0 4px 14px rgba(15, 52, 98, 0.22);
    }
    .je-site-brand-name {
      font-size: 1.0625rem;
      font-weight: 800;
      color: #0f3462;
      letter-spacing: -0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }
    .je-site-nav-wrap {
      display: none;
      flex: 1;
      justify-content: center;
      min-width: 0;
      padding: 0 0.5rem;
    }
    .je-site-nav {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      padding: 0.3125rem;
      border-radius: 9999px;
      background: #f5f8fc;
      border: 1px solid rgba(15, 52, 98, 0.08);
      max-width: 100%;
    }
    .je-site-nav-link {
      display: inline-flex;
      align-items: center;
      gap: 0.3125rem;
      padding: 0.4375rem 0.875rem;
      border-radius: 9999px;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #43474f;
      text-decoration: none;
      white-space: nowrap;
      transition: background 0.15s, color 0.15s, box-shadow 0.15s, transform 0.15s;
    }
    .je-site-nav-emoji {
      font-size: 0.9375rem;
      line-height: 1;
      flex-shrink: 0;
      opacity: 0.88;
    }
    .je-site-nav-link:hover .je-site-nav-emoji,
    .je-site-nav-link--active .je-site-nav-emoji {
      opacity: 1;
    }
    .je-site-nav-link:hover {
      color: #0f3462;
      background: rgba(255, 255, 255, 0.85);
    }
    .je-site-nav-link--active {
      background: linear-gradient(135deg, #0f3462 0%, #1a4a7a 100%);
      color: #fff !important;
      box-shadow: 0 4px 12px rgba(15, 52, 98, 0.22);
    }
    .je-site-nav-link--icon {
      padding: 0.4375rem 0.625rem;
      justify-content: center;
    }
    .je-site-nav-link--icon .je-site-nav-emoji {
      font-size: 1.125rem;
    }
    .je-site-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }
    .je-site-icon-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 9999px;
      border: 1px solid #e2e6ef;
      background: #fff;
      color: #0f3462;
      text-decoration: none;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s, box-shadow 0.15s, transform 0.15s;
    }
    .je-site-icon-btn .material-symbols-outlined { font-size: 1.25rem; }
    .je-site-icon-btn:hover {
      border-color: #3b5e97;
      background: #f5f8fc;
      box-shadow: 0 2px 8px rgba(15, 52, 98, 0.1);
    }
    .je-site-icon-btn--hub.is-auth-visible {
      border-color: rgba(200, 169, 110, 0.45);
      background: linear-gradient(135deg, #fff 0%, #faf6ef 100%);
      color: #984806;
    }
    .je-site-icon-btn--hub.is-auth-visible:hover {
      border-color: #c8a96e;
      box-shadow: 0 4px 12px rgba(152, 72, 6, 0.15);
    }
    #hub-nav-btn {
      display: none !important;
    }
    #hub-nav-btn.is-auth-visible {
      display: flex !important;
    }

    .je-profile-menu-avatar{
      width:3rem;height:3rem;border-radius:9999px;overflow:hidden;display:flex;align-items:center;justify-content:center;
      background:#eef3fa;border:1px solid #e2e6ef;
    }
    .je-profile-menu-avatar .je-profile-avatar{width:100%;height:100%;object-fit:cover;display:block}
    .je-profile-menu-avatar .je-profile-avatar-fallback{color:#3b5e97}
    #profile-icon{display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:9999px}
    #profile-icon .je-profile-btn-avatar{width:1.5rem;height:1.5rem;border-radius:9999px;object-fit:cover;display:block}
    #profile-icon .je-profile-avatar-fallback{font-size:1.25rem!important}

    /* Menu hambúrguer: só mobile/tablet (<1024px). Nav pills no desktop. */
    @media (min-width: 1024px) {
      .je-site-menu-mobile-only,
      #mobile-menu-btn {
        display: none !important;
      }
      .je-site-nav-wrap {
        display: flex !important;
      }
      .je-mobile-menu-backdrop,
      .je-mobile-menu {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
      body.je-menu-open { overflow: auto; }
    }

    /* Menu mobile — drawer lateral */
    body.je-menu-open { overflow: hidden; }
    .je-mobile-menu-trigger-icon--close { display: none; }
    .je-mobile-menu-trigger.is-open .je-mobile-menu-trigger-icon--open { display: none; }
    .je-mobile-menu-trigger.is-open .je-mobile-menu-trigger-icon--close { display: inline-flex; }
    .je-mobile-menu-backdrop {
      position: fixed;
      inset: 0;
      z-index: 60;
      background: rgba(10, 40, 71, 0.5);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 0.28s ease, visibility 0.28s ease;
    }
    .je-mobile-menu-backdrop.is-open {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }
    .je-mobile-menu {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 70;
      width: min(20.5rem, 92vw);
      max-width: 100%;
      display: flex;
      flex-direction: column;
      background: linear-gradient(165deg, #0f3462 0%, #1a4a7a 38%, #fbf9f8 38.1%);
      box-shadow: -12px 0 48px rgba(15, 52, 98, 0.22);
      transform: translateX(105%);
      transition: transform 0.34s cubic-bezier(0.32, 0.72, 0, 1);
      padding-top: env(safe-area-inset-top, 0);
      padding-bottom: env(safe-area-inset-bottom, 0);
    }
    .je-mobile-menu.is-open { transform: translateX(0); }
    .je-mobile-menu-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.25rem 1.25rem 1rem;
      color: #fff;
    }
    .je-mobile-menu-brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
    }
    .je-mobile-menu-mark {
      display: block;
      width: 2.25rem;
      height: 2.25rem;
      flex-shrink: 0;
      border-radius: 0.625rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    .je-mobile-menu-title {
      display: block;
      font-size: 1.125rem;
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -0.02em;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .je-mobile-menu-close {
      flex-shrink: 0;
      width: 2.75rem;
      height: 2.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.22);
      color: #fff;
      cursor: pointer;
      transition: background 0.15s;
    }
    .je-mobile-menu-close:hover { background: rgba(255, 255, 255, 0.2); }
    .je-mobile-menu-close .material-symbols-outlined { font-size: 1.375rem; }
    .je-mobile-menu-body {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding: 0.5rem 1rem 1rem;
      background: #fbf9f8;
      border-radius: 1.25rem 0 0 0;
      margin-top: 0.25rem;
    }
    .je-mobile-menu-hub-slot:empty { display: none; }
    .je-mobile-menu-hub-slot:not(:empty) { margin-bottom: 0.75rem; }
    .je-mobile-menu-group {
      font-size: 0.625rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #3b5e97;
      margin: 1rem 0 0.5rem 0.35rem;
    }
    .je-mobile-menu-group:first-child { margin-top: 0.25rem; }
    .je-mobile-menu-nav { display: flex; flex-direction: column; gap: 0.375rem; }
    .je-mobile-nav-item {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      padding: 0.8125rem 1rem;
      border-radius: 0.875rem;
      background: #fff;
      border: 1px solid #e2e6ef;
      color: #0f3462;
      text-decoration: none;
      font-size: 0.9375rem;
      font-weight: 600;
      min-height: 3.25rem;
      transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
    }
    .je-mobile-nav-item:hover,
    .je-mobile-nav-item:focus-visible {
      border-color: #3b5e97;
      box-shadow: 0 4px 14px rgba(15, 52, 98, 0.1);
    }
    .je-mobile-nav-item--active {
      border-color: #0f3462;
      background: linear-gradient(135deg, #eff6ff 0%, #fff 100%);
      box-shadow: 0 2px 10px rgba(15, 52, 98, 0.08);
    }
    .je-mobile-nav-item--active .je-mobile-nav-icon {
      background: #0f3462;
      color: #fff;
    }
    .je-mobile-nav-item--hub {
      background: linear-gradient(135deg, #0f3462 0%, #2b4b7a 100%);
      border-color: transparent;
      color: #fff;
    }
    .je-mobile-nav-item--hub .je-mobile-nav-icon--hub {
      background: rgba(255, 255, 255, 0.15);
      color: #c8a96e;
    }
    .je-mobile-nav-item--hub .je-mobile-nav-chevron { color: rgba(255, 255, 255, 0.7); }
    .je-mobile-nav-item--hub .je-mobile-nav-hub-tag {
      display: block;
      font-size: 0.5625rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #c8a96e;
      margin-bottom: 0.125rem;
    }
    .je-mobile-nav-icon {
      flex-shrink: 0;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.625rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #eef2f8;
      color: #3b5e97;
    }
    .je-mobile-nav-icon .material-symbols-outlined { font-size: 1.25rem; }
    .je-mobile-nav-icon--emoji {
      font-size: 1.1875rem;
      line-height: 1;
      background: #fff;
      border: 1px solid #e8ecf2;
      opacity: 0.95;
    }
    .je-mobile-nav-item--active .je-mobile-nav-icon--emoji {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.25);
    }
    .je-mobile-nav-label { flex: 1; min-width: 0; line-height: 1.25; }
    .je-mobile-nav-chevron {
      flex-shrink: 0;
      font-size: 1.125rem !important;
      color: #c3c6d0;
      opacity: 0.9;
    }
    .je-mobile-menu-foot {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.875rem 1.25rem;
      background: #f5f3f3;
      border-top: 1px solid #e2e6ef;
      font-size: 0.75rem;
      color: #43474f;
    }
    .je-mobile-menu-foot-icon { font-size: 1rem !important; color: #3b5e97; }

    /* Tablet + mobile only — desktop (>=1024px) unchanged */
    @media (max-width: 1023px) {
      html, body { overflow-x: clip; }
      body {
        padding-left: env(safe-area-inset-left, 0);
        padding-right: env(safe-area-inset-right, 0);
      }
      #header nav > .max-w-7xl,
      #header .max-w-7xl { padding-left: 1rem; padding-right: 1rem; }
      .je-site-header-inner { min-height: 3.75rem; }
      .je-site-brand-name { font-size: 1rem; max-width: 12rem; }
      .je-site-brand-mark { width: 2.25rem; height: 2.25rem; }
      #mobile-menu-btn,
      #profile-btn,
      .je-site-icon-btn { width: 2.75rem; height: 2.75rem; min-width: 2.75rem; min-height: 2.75rem; }
      #hub-nav-btn.is-auth-visible { display: flex !important; }
      #profile-dropdown { max-width: min(18rem, calc(100vw - 2rem)); }
      .je-footer-info { padding-top: 2.5rem; padding-bottom: 2rem; }
      .je-footer-info > .je-footer-shell,
      .je-footer-info > .max-w-7xl { padding-left: 1rem; padding-right: 1rem; }
      .je-footer-grid { gap: 0.875rem; }
      .je-footer-bar > .max-w-7xl {
        padding-left: max(1rem, env(safe-area-inset-left));
        padding-right: max(1rem, env(safe-area-inset-right));
        padding-top: 1.5rem;
        padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
      }
      .je-footer-card { padding: 1.125rem 1.25rem; }
      .je-footer-card:hover { transform: none; }
      .je-footer-map-links { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
      .je-footer-map-btn {
        min-height: 2.75rem;
        flex: none;
        width: 100%;
        min-width: 0;
        padding: 0.625rem 0.75rem;
      }
      .je-footer-map-btn:last-child { grid-column: 1 / -1; }
      .je-footer-email { min-height: 2.75rem; font-size: 0.8125rem; }
      .je-footer-schedule-item { min-height: 2.75rem; }
      main[class*="max-w-"] { padding-left: 1rem !important; padding-right: 1rem !important; }
      .je-page-shell { padding-left: 1rem !important; padding-right: 1rem !important; }
    }
    @media (min-width: 768px) and (max-width: 1023px) {
      .je-footer-grid {
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      .je-footer-card--location { grid-column: 1 / -1; }
      .je-footer-map-links {
        display: flex;
        flex-wrap: wrap;
      }
      .je-footer-map-btn {
        flex: 1 1 calc(33.333% - 0.35rem);
        min-width: 7rem;
      }
      .je-footer-map-btn:last-child { grid-column: auto; }
      .je-footer-intro { max-width: none; }
      .je-footer-headline { font-size: 1.5rem; }
    }
    @media (max-width: 767px) {
      .je-site-brand-name {
        max-width: 11rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #login-modal { padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom)); align-items: flex-end; }
      #login-modal > .relative { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
      #login-modal-close {
        min-width: 2.75rem;
        min-height: 2.75rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .je-ag-hero h1,
      .je-ter-hero h1,
      .je-don-hero h1,
      .je-qa-hero h1,
      .je-sch-hero h1,
      .je-eq-hero h1 {
        font-size: 1.625rem;
        line-height: 1.2;
      }
      .je-ag-hero,
      .je-ter-hero,
      .je-don-hero,
      .je-qa-hero,
      .je-sch-hero,
      .je-eq-hero {
        padding-top: 2.5rem;
        padding-bottom: 2.5rem;
      }
      body.min-h-screen.flex.flex-col > main.flex-1 {
        padding-left: 1rem !important;
        padding-right: 1rem !important;
        padding-top: 1.5rem !important;
        padding-bottom: 2rem !important;
      }
      .je-footer-info {
        padding-top: 2rem;
        padding-bottom: 1.5rem;
        padding-left: env(safe-area-inset-left, 0);
        padding-right: env(safe-area-inset-right, 0);
      }
      .je-footer-intro {
        margin-bottom: 1.125rem;
        text-align: center;
        max-width: none;
      }
      .je-footer-headline { font-size: 1.25rem; }
      .je-footer-kicker { text-align: center; }
      .je-footer-card { border-radius: 0.875rem; padding: 1rem 1.125rem; }
      .je-footer-text { font-size: 0.8125rem; line-height: 1.55; margin-bottom: 0.875rem; }
      .je-footer-map-links { grid-template-columns: 1fr; }
      .je-footer-map-btn:last-child { grid-column: auto; }
      .je-footer-map-btn-label { white-space: normal; text-align: center; line-height: 1.2; }
      .je-footer-schedule { gap: 0.5rem; }
      .je-footer-schedule-detail { font-size: 0.8125rem; }
      .je-footer-email {
        justify-content: center;
        text-align: center;
        word-break: break-word;
        padding: 0.875rem 0.75rem;
      }
      .je-footer-bar > .max-w-7xl {
        flex-direction: column;
        align-items: center;
        gap: 0.625rem;
        text-align: center;
      }
      .je-footer-brand { font-size: 1rem; }
      .je-footer-copy { text-align: center; line-height: 1.5; font-size: 0.75rem; max-width: 20rem; }
    }
  `;

  function ensureMaterialSymbolsLoaded() {
    if (!document.querySelector('link[rel="preconnect"][href="https://fonts.googleapis.com"]')) {
      const pre1 = document.createElement('link');
      pre1.rel = 'preconnect';
      pre1.href = 'https://fonts.googleapis.com';
      document.head.appendChild(pre1);
      const pre2 = document.createElement('link');
      pre2.rel = 'preconnect';
      pre2.href = 'https://fonts.gstatic.com';
      pre2.crossOrigin = 'anonymous';
      document.head.appendChild(pre2);
    }
    if (!document.querySelector('link[href*="Material+Symbols+Outlined"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = SYMBOLS_HREF;
      document.head.appendChild(link);
    }
    if (!document.getElementById('je-material-symbols-style')) {
      const style = document.createElement('style');
      style.id = 'je-material-symbols-style';
      style.textContent = SYMBOLS_CSS + CHROME_CSS;
      document.head.appendChild(style);
    }
  }

  function materialSymbolsReady() {
    ensureMaterialSymbolsLoaded();
    if (!document.fonts?.load) return Promise.resolve();
    return document.fonts.load("400 24px 'Material Symbols Outlined'").catch(() => {});
  }

  const isAdminPath = /\/admin(\/|$)/.test(window.location.pathname);
  const assetBase = isAdminPath ? '..' : '.';

  function ensureFavicon() {
    const svgHref = `${assetBase}/img/icon.svg`;
    const png32Href = `${assetBase}/img/favicon-32.png`;
    const png180Href = `${assetBase}/img/favicon-180.png`;

    if (!document.querySelector('link[rel="icon"][type="image/svg+xml"]')) {
      const svgLink = document.createElement('link');
      svgLink.rel = 'icon';
      svgLink.type = 'image/svg+xml';
      svgLink.href = svgHref;
      document.head.appendChild(svgLink);
    }
    if (!document.querySelector('link[rel="icon"][type="image/png"]')) {
      const pngLink = document.createElement('link');
      pngLink.rel = 'icon';
      pngLink.type = 'image/png';
      pngLink.sizes = '32x32';
      pngLink.href = png32Href;
      document.head.appendChild(pngLink);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const touchLink = document.createElement('link');
      touchLink.rel = 'apple-touch-icon';
      touchLink.sizes = '180x180';
      touchLink.href = png180Href;
      document.head.appendChild(touchLink);
    }
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = `${assetBase}/site.webmanifest`;
      document.head.appendChild(link);
    }
  }

  function ensureMaterialSymbols() {
    ensureMaterialSymbolsLoaded();
  }

  async function boot() {
    ensureFavicon();
    ensureMaterialSymbols();
    const isHubPage = /hub\.html$/i.test(location.pathname) || /\/hub\/?$/i.test(location.pathname);
    if (isHubPage) {
      materialSymbolsReady();
    } else {
      await materialSymbolsReady();
    }

    loadComponent(`${assetBase}/components/header.html`, 'header', () => {
      highlightActiveNav();
      if (window.initSiteHeader) window.initSiteHeader();
    });

    loadComponent(`${assetBase}/components/footer.html`, 'footer', () => {
      if (isAdminPath) {
        const footer = document.getElementById('footer');
        if (footer) fixRelativeLinks(footer, '../');
      }
    });
  }

  function loadComponent(url, targetId, afterLoad) {
    const target = document.getElementById(targetId);
    if (!target) return;

    fetch(url)
      .then((res) => res.text())
      .then((html) => {
        target.innerHTML = html;
        if (isAdminPath) fixRelativeLinks(target, '../');
        if (window.JEAuth?.applyHeaderAuthFast) window.JEAuth.applyHeaderAuthFast();
        if (afterLoad) afterLoad();
      })
      .catch((err) => console.warn(`Erro ao carregar ${url}:`, err));
  }

  function fixRelativeLinks(container, prefix) {
    container.querySelectorAll('a[href], img[src]').forEach((el) => {
      const attr = el.hasAttribute('href') ? 'href' : 'src';
      const val = el.getAttribute(attr);
      if (!val || val.startsWith('http') || val.startsWith('#') || val.startsWith('../') || val.startsWith('/')) return;
      el.setAttribute(attr, prefix + val);
    });
  }

  function navSlugFromHref(href) {
    if (!href) return '';
    const file = href.split('/').pop().replace(/\.html$/i, '').toLowerCase();
    return file === 'index' ? 'home' : file;
  }

  function navSlugFromPath(pathname) {
    const segments = pathname.replace(/\/$/, '').split('/').filter(Boolean);
    const last = (segments.length ? segments[segments.length - 1] : 'index')
      .replace(/\.html$/i, '')
      .toLowerCase();
    return last === 'index' ? 'home' : last;
  }

  function highlightActiveNav() {
    const current = navSlugFromPath(window.location.pathname);

    document.querySelectorAll('.nav-link').forEach((link) => {
      const isActive = navSlugFromHref(link.getAttribute('href')) === current;

      if (link.classList.contains('je-mobile-nav-item')) {
        link.classList.toggle('je-mobile-nav-item--active', isActive);
        if (isActive) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
        return;
      }

      if (link.classList.contains('je-site-nav-link')) {
        link.classList.toggle('je-site-nav-link--active', isActive);
        if (isActive) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
    });
  }

  boot();
})();
