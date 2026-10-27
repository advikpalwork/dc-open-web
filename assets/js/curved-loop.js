/* CurvedLoop: vanilla SVG port of the React component.
   Usage: CurvedLoop.mount(element, { marqueeText, speed, curveAmount, shape, ... }) */
(function (global) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const VIEW_WIDTH = 1440;
  const VIEW_HEIGHT = 120;
  const MAX_FLING = 4000;
  const WAVE_LENGTH = 960;
  const RING_RADIUS = 2.2;
  const TAU = Math.PI * 2;
  let uid = 0;

  const wrapOffset = (value, length) => (length > 0 ? (((value % length) + length) % length) - length : value);
  const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

  const edgeMask = (amount, span) => {
    const size = Math.min(Math.max(amount, 0), 1) * 50 * span;
    if (size <= 0) return '';
    const start = 50 - span * 50;
    const steps = 10;
    const left = [];
    const right = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const alpha = (t * t * t * (t * (t * 6 - 15) + 10)).toFixed(3);
      left.push(`rgba(0, 0, 0, ${alpha}) ${(start + t * size).toFixed(2)}%`);
      right.unshift(`rgba(0, 0, 0, ${alpha}) ${(100 - start - t * size).toFixed(2)}%`);
    }
    return `linear-gradient(to right, ${[...left, ...right].join(', ')})`;
  };

  const wavePath = (amplitude, baseline) => {
    const from = -100;
    const to = VIEW_WIDTH + 100;
    const k = TAU / WAVE_LENGTH;
    const y = x => baseline + amplitude * Math.cos(k * (x - VIEW_WIDTH / 2));
    const slope = x => -amplitude * k * Math.sin(k * (x - VIEW_WIDTH / 2));
    const count = Math.ceil((to - from) / (WAVE_LENGTH / 8));
    const step = (to - from) / count;
    const f = n => n.toFixed(2);
    let d = `M${f(from)},${f(y(from))}`;
    for (let i = 0; i < count; i++) {
      const x0 = from + i * step;
      const x1 = x0 + step;
      d += ` C${f(x0 + step / 3)},${f(y(x0) + (slope(x0) * step) / 3)} ${f(x1 - step / 3)},${f(y(x1) - (slope(x1) * step) / 3)} ${f(x1)},${f(y(x1))}`;
    }
    return d;
  };

  const getGeometry = (shape, curveAmount, fontSize, spacing) => {
    if (shape === 'circle') {
      const repeats = spacing > 0 ? Math.max(1, Math.round((TAU * fontSize * RING_RADIUS) / spacing)) : 1;
      const radius = spacing > 0 ? (repeats * spacing) / TAU : fontSize * RING_RADIUS;
      const half = radius + fontSize;
      return {
        d: `M${-radius},0 A${radius},${radius} 0 1,1 ${radius},0 A${radius},${radius} 0 1,1 ${-radius},0`,
        viewBox: `${-half} ${-half} ${half * 2} ${half * 2}`,
        radius, repeats,
        span: Math.min(1, (fontSize * (RING_RADIUS + 1) * 2) / VIEW_WIDTH)
      };
    }
    const flat = { viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`, radius: 0, repeats: 0, span: 1 };
    const baseline = VIEW_HEIGHT / 2 + fontSize * 0.36;
    if (shape === 'line') return Object.assign({}, flat, { d: `M-100,${baseline} L${VIEW_WIDTH + 100},${baseline}` });
    if (shape === 'wave') return Object.assign({}, flat, { d: wavePath(curveAmount * 0.25, baseline) });
    return Object.assign({}, flat, { d: `M-100,40 Q500,${40 + curveAmount} 1540,40` });
  };

  const el = (tag, attrs) => {
    const n = document.createElementNS(SVG_NS, tag);
    if (attrs) Object.keys(attrs).forEach(k => attrs[k] != null && n.setAttribute(k, attrs[k]));
    return n;
  };

  function mount(container, opts) {
    if (!container) return null;
    const o = Object.assign({
      marqueeText: '', speed: 2, className: '', curveAmount: 400, direction: 'left',
      interactive: true, pauseOnHover: false, color: 'currentColor', edgeFade: 0, shape: 'arc',
      fontSize: 96, fontWeight: 700, letterSpacing: 0, separator: '', separatorColor: null, scrollBoost: 0
    }, opts || {});

    const body = o.marqueeText.replace(/\s+$/, '');
    const mark = String(o.separator ?? '').trim();
    const text = mark ? `${body} ${mark} ` : `${body} `;
    const pathId = `curve-${++uid}`;
    const ring = o.shape === 'circle';

    container.classList.add('curved-loop-jacket');
    container.style.visibility = 'hidden';
    container.style.cursor = o.interactive ? 'grab' : 'auto';
    container.style.touchAction = o.interactive ? 'pan-y' : 'auto';

    const svg = el('svg', { class: 'curved-loop-svg', role: 'img', 'aria-label': o.marqueeText });
    svg.style.fontSize = o.fontSize + 'px';
    svg.style.fontWeight = o.fontWeight;
    svg.style.letterSpacing = typeof o.letterSpacing === 'number' ? o.letterSpacing + 'px' : o.letterSpacing;
    const measure = el('text', { 'xml:space': 'preserve', class: o.className });
    measure.style.visibility = 'hidden'; measure.style.opacity = '0';
    measure.textContent = text;
    const defs = el('defs');
    const path = el('path', { id: pathId, fill: 'none', stroke: 'transparent' });
    defs.appendChild(path);
    const visibleText = el('text', { 'xml:space': 'preserve', class: o.className, fill: o.color });
    const textPath = el('textPath', { href: `#${pathId}`, 'xml:space': 'preserve' });
    visibleText.appendChild(textPath);
    svg.append(measure, defs, visibleText);
    container.appendChild(svg);

    let spacing = 0, offset = 0, velocity = 0, direction = o.direction, hover = false, geometry = null;
    const scroll = { distance: 0, level: 0 };
    const drag = { active: false, x: 0, time: 0, scale: 1, velocity: 0, ring: false, radius: 0, angle: 0, cx: 0, cy: 0 };

    const fill = () => {
      geometry = getGeometry(o.shape, o.curveAmount, o.fontSize, spacing);
      svg.setAttribute('viewBox', geometry.viewBox);
      path.setAttribute('d', geometry.d);
      if (ring) { svg.style.width = `${(geometry.span * 100).toFixed(3)}%`; svg.style.aspectRatio = '1'; }
      const mask = edgeMask(o.edgeFade, geometry.span);
      container.style.maskImage = mask; container.style.webkitMaskImage = mask;
      const pathLength = path.getTotalLength ? path.getTotalLength() : 1800;
      const copies = spacing > 0 ? (ring ? geometry.repeats + 1 : Math.ceil((pathLength || 1800) / spacing) + 2) : 1;
      textPath.textContent = '';
      if (mark && o.separatorColor) {
        for (let i = 0; i < copies; i++) {
          textPath.appendChild(document.createTextNode(`${body} `));
          const t = el('tspan', { fill: o.separatorColor }); t.textContent = mark; textPath.appendChild(t);
          textPath.appendChild(document.createTextNode(' '));
        }
      } else {
        textPath.textContent = text.repeat(copies);
      }
      offset = wrapOffset(offset, spacing);
      textPath.setAttribute('startOffset', `${offset}px`);
      container.style.visibility = spacing > 0 ? 'visible' : 'hidden';
    };

    const remeasure = () => {
      const next = measure.getComputedTextLength();
      if (next > 0 && Math.abs(next - spacing) > 0.5) { spacing = next; fill(); }
      else if (!geometry) fill();
    };
    remeasure();
    document.fonts?.ready.then(remeasure);
    const ro = new ResizeObserver(remeasure); ro.observe(svg);

    const onScroll = () => {
      const y = window.scrollY;
      if (onScroll.prev !== undefined) scroll.distance += Math.abs(y - onScroll.prev);
      onScroll.prev = y;
    };
    if (o.scrollBoost) window.addEventListener('scroll', onScroll, { passive: true });

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let frame = 0, last = 0, visible = true;
    const tick = now => {
      frame = 0;
      if (!visible) return;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      const rate = dt > 0 ? scroll.distance / dt : 0;
      scroll.distance = 0;
      scroll.level += (rate - scroll.level) * (1 - Math.exp(-dt * (rate > scroll.level ? 10 : 2.4)));
      if (!drag.active && spacing > 0) {
        const sign = direction === 'right' ? 1 : -1;
        const halted = reduceMotion || (o.pauseOnHover && hover);
        const target = halted ? 0 : sign * o.speed * 60;
        const extra = halted ? 0 : sign * scroll.level * o.scrollBoost * 0.3;
        velocity += (target - velocity) * (1 - Math.exp(-dt * 3));
        const step = (velocity + extra) * dt;
        if (Math.abs(step) > 0.0001) {
          offset = wrapOffset(offset + step, spacing);
          textPath.setAttribute('startOffset', `${offset}px`);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) { last = 0; scroll.level = 0; frame = requestAnimationFrame(tick); }
    });
    io.observe(container);
    frame = requestAnimationFrame(tick);

    const endDrag = () => {
      if (!drag.active) return;
      drag.active = false;
      container.style.cursor = o.interactive ? 'grab' : 'auto';
      const fling = performance.now() - drag.time > 100 ? 0 : Math.max(-MAX_FLING, Math.min(MAX_FLING, drag.velocity));
      velocity = fling;
      if (Math.abs(fling) > 60) direction = fling > 0 ? 'right' : 'left';
    };
    if (o.interactive) {
      container.addEventListener('pointerdown', e => {
        if (spacing <= 0) return;
        const rect = svg.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        Object.assign(drag, {
          active: true, x: e.clientX, time: performance.now(), scale: VIEW_WIDTH / (rect.width || VIEW_WIDTH),
          velocity: 0, ring, radius: geometry.radius, angle: Math.atan2(e.clientY - cy, e.clientX - cx), cx, cy
        });
        velocity = 0;
        container.style.cursor = 'grabbing';
        container.setPointerCapture?.(e.pointerId);
      });
      container.addEventListener('pointermove', e => {
        if (!drag.active) return;
        const now = performance.now();
        let delta = (e.clientX - drag.x) * drag.scale;
        if (drag.ring) {
          const angle = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx);
          delta = wrapAngle(angle - drag.angle) * drag.radius;
          drag.angle = angle;
        }
        const dt = Math.max(now - drag.time, 1) / 1000;
        drag.x = e.clientX; drag.time = now;
        drag.velocity = drag.velocity * 0.5 + (delta / dt) * 0.5;
        offset = wrapOffset(offset + delta, spacing);
        textPath.setAttribute('startOffset', `${offset}px`);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => container.addEventListener(t, endDrag));
    }
    container.addEventListener('pointerenter', () => { hover = true; });
    container.addEventListener('pointerleave', () => { hover = false; endDrag(); });

    return {
      destroy() {
        cancelAnimationFrame(frame); io.disconnect(); ro.disconnect();
        window.removeEventListener('scroll', onScroll); svg.remove();
      }
    };
  }

  global.CurvedLoop = { mount };
})(window);
