/* Datic: shared site behaviour */
(function () {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- nav: theme follows the section underneath ---------------- */
  const nav = document.querySelector('.nav');
  if (nav) {
    const darks = () => Array.from(document.querySelectorAll('[data-theme="dark"]'));
    let lastY = window.scrollY, ticking = false;
    const update = () => {
      ticking = false;
      const probe = 46;
      const overDark = darks().some(s => { const r = s.getBoundingClientRect(); return r.top <= probe && r.bottom >= probe; });
      nav.classList.toggle('nav--light', !overDark);
      const y = window.scrollY;
      if (!nav.classList.contains('is-open')) {
        if (y > 140 && y > lastY + 6) nav.classList.add('is-hidden');
        else if (y < lastY - 6 || y < 140) nav.classList.remove('is-hidden');
      }
      lastY = y;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();

    const toggle = nav.querySelector('.nav__toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) nav.classList.add('nav--light');
        else update();
      });
      nav.querySelectorAll('.nav__sheet a').forEach(a => a.addEventListener('click', () => {
        nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); update();
      }));
    }
  }

  /* ---------------- reveal on scroll ---------------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window)) {
    revealEls.forEach(el => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => io.observe(el));
  }

  /* ---------------- fixed-width visuals scaled to fit their container ---------------- */
  document.querySelectorAll('[data-fit]').forEach(box => {
    const W = parseFloat(box.dataset.fit), inner = box.firstElementChild;
    if (!inner) return;
    inner.style.width = W + 'px';
    const fit = () => {
      const s = Math.min(1.3, box.clientWidth / W);
      inner.style.transform = `scale(${s})`;
      box.style.height = inner.offsetHeight * s + 'px';
    };
    new ResizeObserver(fit).observe(box);
    new ResizeObserver(fit).observe(inner);
  });

  /* ---------------- app replica player ("screen recordings") ---------------- */
  function player(app) {
    const steps = parseInt(app.dataset.steps || '5', 10);
    const interval = parseInt(app.dataset.interval || '1400', 10);
    const hold = parseInt(app.dataset.hold || '3', 10);
    const cursor = app.querySelector('.app-cursor');
    const path = cursor ? JSON.parse(cursor.dataset.path || '[]') : [];
    let state = -1, timer = 0, running = false;

    const render = () => {
      app.querySelectorAll('[data-at]').forEach(el => el.classList.toggle('on', state >= +el.dataset.at));
      app.querySelectorAll('[data-from]').forEach(el => { el.hidden = state < +el.dataset.from; });
      app.querySelectorAll('[data-until]').forEach(el => { el.hidden = state >= +el.dataset.until; });
      app.querySelectorAll('[data-chart]').forEach(el => el.classList.toggle('on', state >= +el.dataset.chart));
      app.querySelectorAll('[data-cls]').forEach(el => {
        el.dataset.cls.split(' ').forEach(rule => { const [at, cls] = rule.split(':'); el.classList.toggle(cls, state >= +at); });
      });
      app.querySelectorAll('[data-bar]').forEach(el => {
        const [at, w] = el.dataset.bar.split(':'); el.style.width = state >= +at ? w + '%' : '0%';
      });
      app.querySelectorAll('[data-count]').forEach(el => {
        const [at, to] = el.dataset.count.split(':');
        if (state < +at) { el.textContent = el.dataset.zero || '0'; return; }
        if (el.dataset.done === String(state)) return;
        el.dataset.done = String(state);
        const target = +to, start = performance.now(), dur = 900;
        const fmt = n => Math.round(n).toLocaleString('en-IN');
        const step = now => { const k = Math.min(1, (now - start) / dur); el.textContent = fmt(target * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      });
      app.querySelectorAll('[data-flash]').forEach(el => {
        if (state === +el.dataset.flash) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
      });
      if (cursor) {
        const p = path.filter(q => q[0] <= state).pop();
        cursor.style.opacity = p ? '1' : '0';
        if (p) {
          cursor.style.left = p[1] + '%'; cursor.style.top = p[2] + '%';
          if (p[3] && p[0] === state) { setTimeout(() => cursor.classList.add('click'), 700); setTimeout(() => cursor.classList.remove('click'), 900); }
        }
      }
    };
    const next = () => {
      state = state + 1 > steps + hold - 1 ? 0 : state + 1;
      if (state === 0) app.querySelectorAll('[data-count]').forEach(el => { delete el.dataset.done; });
      render();
      timer = setTimeout(next, interval);
    };
    const start = () => { if (running) return; running = true; next(); };
    const stop = () => { running = false; clearTimeout(timer); };

    if (reduced) { state = steps - 1; render(); return; }
    new IntersectionObserver(([e]) => { e.isIntersecting ? start() : stop(); }, { threshold: 0.25 }).observe(app);
  }
  document.querySelectorAll('.app[data-play]').forEach(player);

  /* ---------------- process: sticky snapshot follows the active step ---------------- */
  const steps = Array.from(document.querySelectorAll('.pstep'));
  const screens = Array.from(document.querySelectorAll('.process__screen'));
  const rails = Array.from(document.querySelectorAll('.progress-rail i'));
  if (steps.length && screens.length) {
    const setActive = i => {
      steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
      screens.forEach((s, k) => s.classList.toggle('is-active', k === i));
      rails.forEach((r, k) => r.classList.toggle('on', k <= i));
    };
    let current = -1, queued = false;
    const pick = () => {
      queued = false;
      const mid = window.innerHeight / 2;
      let best = 0, bestD = Infinity;
      steps.forEach((s, k) => {
        const r = s.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) { bestD = d; best = k; }
      });
      if (best !== current) { current = best; setActive(best); }
    };
    window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(pick); } }, { passive: true });
    window.addEventListener('resize', pick);
    pick();
  }

  /* ---------------- legal pages: active section in the table of contents ---------------- */
  const tocLinks = Array.from(document.querySelectorAll('.toc a[href^="#"]'));
  if (tocLinks.length) {
    const map = new Map(tocLinks.map(a => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        tocLinks.forEach(a => a.classList.remove('is-active'));
        const a = map.get(e.target.id); if (a) a.classList.add('is-active');
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    map.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

  /* ---------------- book-a-demo modal shell (submission lives in booking.js) ---------------- */
  const modal = document.getElementById('demoModal');
  window.openDemoModal = function () {
    if (!modal) { window.location.href = 'index.html#book-a-demo'; return; }
    modal.querySelector('#demoForm').style.display = '';
    modal.querySelector('#demoSuccess').style.display = 'none';
    const err = modal.querySelector('#demoError'); if (err) err.style.display = 'none';
    const btn = modal.querySelector('#demoSubmit'); if (btn) { btn.disabled = false; btn.textContent = 'Request my demo'; }
    const d = modal.querySelector('#demoDate'); if (d) d.min = new Date().toISOString().split('T')[0];
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => modal.querySelector('#demoName')?.focus(), 250);
  };
  const closeModal = () => { if (!modal) return; modal.classList.remove('open'); document.body.style.overflow = ''; };
  if (modal) {
    modal.querySelector('.modal__close').addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  }
  document.querySelectorAll('[data-open-demo]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); window.openDemoModal(); }));
  if (location.hash === '#book') window.openDemoModal();

  /* ---------------- footer year ---------------- */
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
})();
