(() => {
  function initArchiveUI() {
    window.__osArchiveController?.abort();
    const controller = new AbortController();
    window.__osArchiveController = controller;
    const { signal } = controller;
    const menuButton = document.querySelector('.menu-button');
    const archiveNav = document.querySelector('#archive-nav');
    const backdrop = document.querySelector('[data-nav-backdrop]');
    const closeButton = document.querySelector('[data-nav-close]');

    document.documentElement.classList.add('motion-ready');

    const closeMenu = () => {
      archiveNav?.classList.remove('open');
      if (backdrop) backdrop.hidden = true;
      document.body.classList.remove('nav-open');
      menuButton?.setAttribute('aria-expanded', 'false');
      menuButton?.setAttribute('aria-label', '打开文章目录');
    };
    const openMenu = () => {
      if (!archiveNav) return;
      archiveNav.classList.add('open');
      if (backdrop) backdrop.hidden = false;
      document.body.classList.add('nav-open');
      menuButton?.setAttribute('aria-expanded', 'true');
      menuButton?.setAttribute('aria-label', '关闭文章目录');
      archiveNav.focus({ preventScroll: true });
    };

    menuButton?.addEventListener('click', () => archiveNav?.classList.contains('open') ? closeMenu() : openMenu(), { signal });
    closeButton?.addEventListener('click', closeMenu, { signal });
    backdrop?.addEventListener('click', closeMenu, { signal });
    archiveNav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu, { signal }));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
      if (event.key === 'Tab' && archiveNav?.classList.contains('open')) {
        const focusable = [...archiveNav.querySelectorAll('a,button,input,[tabindex]:not([tabindex="-1"])')].filter((element) => !element.hidden);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }, { signal });

    const revealItems = [...document.querySelectorAll('.reveal')];
    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
      }), { rootMargin: '120px 0px', threshold: 0.01 });
      revealItems.forEach((item) => observer.observe(item));
      signal.addEventListener('abort', () => observer.disconnect(), { once: true });
    } else revealItems.forEach((item) => item.classList.add('is-visible'));

    document.querySelectorAll('[data-gallery-shell]').forEach((shell) => {
      const image = shell.querySelector('img');
      const ready = () => shell.classList.add('loaded');
      if (!image || (image.complete && image.naturalWidth > 0)) ready();
      else {
        image.addEventListener('load', ready, { signal, once: true });
        image.addEventListener('error', ready, { signal, once: true });
      }
    });

    window.addEventListener('message', (event) => {
      if (event.data?.type !== 'os-archive:resize' || !event.data.id) return;
      const frame = [...document.querySelectorAll('[data-compat-frame]')].find((item) => item.dataset.compatId === event.data.id && item.contentWindow === event.source);
      if (!frame) return;
      const height = Math.min(60000, Math.max(520, Number(event.data.height) || 620));
      frame.style.height = `${height}px`;
      frame.closest('[data-compat-shell]')?.classList.add('loaded');
    }, { signal });

    document.querySelectorAll('video').forEach((video) => {
      const observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting && !video.paused) video.pause(); }, { threshold: 0.05 });
      observer.observe(video);
      signal.addEventListener('abort', () => observer.disconnect(), { once: true });
    });

    const routeMapElement = document.querySelector('#legacy-route-map');
    if (routeMapElement && location.hash.length > 1) {
      try {
        const routes = JSON.parse(routeMapElement.textContent);
        const key = decodeURIComponent(location.hash.slice(1));
        if (routes[key] && location.pathname !== routes[key]) location.replace(routes[key]);
      } catch { /* invalid historic hash remains on the archive index */ }
    }
  }

  if (!window.__osArchivePageLoadBound) {
    document.addEventListener('astro:page-load', initArchiveUI);
    window.__osArchivePageLoadBound = true;
  }
  initArchiveUI();
})();
