(function () {
  const REDUCED_MOTION = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animateIndicator({ nav, indicator, activeBtn, pulse = true }) {
    if (!nav || !indicator || !activeBtn || activeBtn.classList.contains('hidden')) return;

    const navRect = nav.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    if (!navRect.width || !btnRect.width) {
      indicator.style.opacity = '0';
      return;
    }

    indicator.style.opacity = '1';
    indicator.style.width = `${btnRect.width}px`;
    indicator.style.transform = `translate3d(${btnRect.left - navRect.left}px, 0, 0)`;

    if (REDUCED_MOTION()) return;

    indicator.classList.add('hub-nav-indicator--moving');
    indicator.addEventListener('transitionend', function onMove(e) {
      if (e.propertyName !== 'transform') return;
      indicator.classList.remove('hub-nav-indicator--moving');
      indicator.removeEventListener('transitionend', onMove);
    });

    if (!pulse) return;
    indicator.classList.remove('hub-nav-indicator--pulse');
    void indicator.offsetWidth;
    indicator.classList.add('hub-nav-indicator--pulse');
    indicator.addEventListener('animationend', function onPulse() {
      indicator.classList.remove('hub-nav-indicator--pulse');
      indicator.removeEventListener('animationend', onPulse);
    });
  }

  function queueIndicatorRefresh(getActiveBtn, nav, indicator) {
    const active = getActiveBtn();
    if (!active || !nav || !indicator) return;
    const run = () => animateIndicator({ nav, indicator, activeBtn: active, pulse: false });
    run();
    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
  }

  function activatePanels(panels, isActive, { animate = true } = {}) {
    const list = Array.from(panels || []);
    const next = list.find((panel) => isActive(panel));
    const prev = list.find((panel) => panel.classList.contains('active'));
    if (prev === next) return next;

    if (prev) {
      prev.classList.remove('active', 'hub-panel--enter');
      prev.hidden = true;
    }

    if (!next) return null;

    next.hidden = false;
    next.classList.add('active');

    if (animate && !REDUCED_MOTION()) {
      next.classList.remove('hub-panel--enter');
      void next.offsetWidth;
      next.classList.add('hub-panel--enter');
      next.addEventListener('animationend', function onEnter() {
        next.classList.remove('hub-panel--enter');
        next.removeEventListener('animationend', onEnter);
      });
    }

    return next;
  }

  window.JEHuNav = {
    animateIndicator,
    queueIndicatorRefresh,
    activatePanels
  };
})();
