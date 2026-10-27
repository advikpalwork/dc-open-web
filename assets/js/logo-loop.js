/* LogoLoop: vanilla seamless logo marquee.
   Usage: LogoLoop.mount(element, { logos:[{src,alt,href,title}|{text,title}], speed, direction, logoHeight, gap, hoverSpeed, scaleOnHover, fadeOut, fadeOutWidth, draggable, ariaLabel }) */
(function (global) {
  'use strict';

  /* Square logo files often carry wide transparent margins; crop them so every mark reads at the same height. */
  const trimCache = new Map();
  function trimImage(img) {
    const src = img.getAttribute('src');
    if (trimCache.has(src)) { trimCache.get(src).then(u => { if (u) img.src = u; }); return; }
    const job = new Promise(resolve => {
      const probe = new Image();
      probe.onload = () => {
        try {
          const k = Math.min(1, 480 / Math.max(probe.naturalWidth, probe.naturalHeight));
          const w = Math.max(1, Math.round(probe.naturalWidth * k)), h = Math.max(1, Math.round(probe.naturalHeight * k));
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(probe, 0, 0, w, h);
          const d = x.getImageData(0, 0, w, h).data;
          let minX = w, minY = h, maxX = -1, maxY = -1;
          for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) {
            if (d[(y * w + i) * 4 + 3] > 10) { if (i < minX) minX = i; if (i > maxX) maxX = i; if (y < minY) minY = y; if (y > maxY) maxY = y; }
          }
          if (maxX < 0 || (maxX - minX + 1) * (maxY - minY + 1) > w * h * 0.92) return resolve(null);
          const out = document.createElement('canvas'); out.width = maxX - minX + 1; out.height = maxY - minY + 1;
          out.getContext('2d').drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
          resolve(out.toDataURL('image/png'));
        } catch (e) { resolve(null); }
      };
      probe.onerror = () => resolve(null);
      probe.src = src;
    });
    trimCache.set(src, job);
    job.then(u => { if (u) img.src = u; });
  }

  function itemNode(logo, o) {
    const tag = logo.href ? 'a' : 'span';
    const item = document.createElement(tag);
    item.className = 'logoloop__item' + (o.scaleOnHover ? ' logoloop__item--scale' : '');
    if (logo.href) { item.href = logo.href; item.target = '_blank'; item.rel = 'noopener noreferrer'; }
    if (logo.title) item.title = logo.title;
    if (logo.src) {
      const img = document.createElement('img');
      img.src = logo.src; img.alt = logo.alt || logo.title || '';
      img.loading = 'lazy'; img.decoding = 'async'; img.draggable = false;
      img.style.height = (logo.height || o.logoHeight) + 'px';
      item.appendChild(img);
      if (o.trim && !/\.svg(\?|$)/i.test(logo.src)) trimImage(img);
    } else {
      item.classList.add('logoloop__item--text');
      item.textContent = logo.text || logo.title || '';
      item.style.height = o.logoHeight + 'px';
    }
    if (o.labels && logo.title && logo.src) {
      const l = document.createElement('span'); l.className = 'logoloop__label'; l.textContent = logo.title; item.appendChild(l);
    }
    return item;
  }

  function mount(container, opts) {
    if (!container) return null;
    const o = Object.assign({
      logos: [], speed: 60, direction: 'left', logoHeight: 40, gap: 56, hoverSpeed: 12,
      scaleOnHover: true, fadeOut: true, fadeOutWidth: 0.1, draggable: true, labels: false, trim: true, tiles: true, ariaLabel: 'Logos'
    }, opts || {});

    container.classList.add('logoloop');
    if (o.tiles) container.classList.add('logoloop--tiles');
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', o.ariaLabel);
    if (o.fadeOut) {
      const w = (o.fadeOutWidth * 100).toFixed(1);
      const m = `linear-gradient(to right, transparent, #000 ${w}%, #000 ${100 - w}%, transparent)`;
      container.style.maskImage = m; container.style.webkitMaskImage = m;
    }
    const track = document.createElement('div');
    track.className = 'logoloop__track';
    container.appendChild(track);

    const makeSet = () => {
      const set = document.createElement('div');
      set.className = 'logoloop__set';
      set.style.gap = o.gap + 'px';
      set.style.paddingRight = o.gap + 'px';
      o.logos.forEach(l => set.appendChild(itemNode(l, o)));
      return set;
    };
    track.appendChild(makeSet());

    let setW = 0;
    const fill = () => {
      const first = track.firstElementChild;
      if (!first) return;
      setW = first.getBoundingClientRect().width;
      let guard = 0;
      while (setW > 0 && track.children.length * setW < container.clientWidth + setW * 2 && guard++ < 8) {
        const clone = makeSet(); clone.setAttribute('aria-hidden', 'true'); track.appendChild(clone);
      }
    };
    fill();
    window.addEventListener('load', fill);
    let refit = 0;
    track.addEventListener('load', () => { cancelAnimationFrame(refit); refit = requestAnimationFrame(() => { setW = track.firstElementChild.getBoundingClientRect().width; fill(); }); }, true);
    const ro = new ResizeObserver(fill); ro.observe(container);

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const sign = o.direction === 'right' ? 1 : -1;
    let off = 0, cur = reduced ? 0 : o.speed, last = 0, hover = false, dragging = false, lx = 0, raf = 0, visible = true;

    const tick = now => {
      raf = 0;
      if (!visible) return;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      const target = reduced ? 0 : (hover ? o.hoverSpeed : o.speed);
      cur += (target - cur) * (1 - Math.exp(-dt * 6));
      if (!dragging && setW > 0) off += sign * cur * dt;
      if (setW > 0) off = ((off % setW) + setW) % setW;
      track.style.transform = `translate3d(${-off}px,0,0)`;
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) { last = 0; raf = requestAnimationFrame(tick); }
    });
    io.observe(container);
    raf = requestAnimationFrame(tick);

    container.addEventListener('pointerenter', () => { hover = true; });
    container.addEventListener('pointerleave', () => { hover = false; dragging = false; });
    if (o.draggable) {
      container.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; container.classList.add('is-dragging'); });
      container.addEventListener('pointermove', e => { if (!dragging) return; off -= e.clientX - lx; lx = e.clientX; });
      const stop = () => { dragging = false; container.classList.remove('is-dragging'); };
      ['pointerup', 'pointercancel'].forEach(t => container.addEventListener(t, stop));
    }
    return { destroy() { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); track.remove(); } };
  }

  global.LogoLoop = { mount };
})(window);
