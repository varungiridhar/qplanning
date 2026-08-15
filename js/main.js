(() => {
  // ================= Copy BibTeX =================
  const btn = document.getElementById('copy-bibtex');
  const block = document.getElementById('bibtex-block');
  if (btn && block) {
    btn.addEventListener('click', async () => {
      const text = block.innerText;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      const prev = btn.textContent;
      btn.textContent = 'Copied';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = prev;
        btn.classList.remove('copied');
      }, 1500);
    });
  }

  // ================= Active section highlight =================
  const links = Array.from(document.querySelectorAll('.toc a'));
  const sections = links
    .map(l => document.querySelector(l.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    const bySection = new Map(sections.map((s, i) => [s, links[i]]));
    const seen = new Set();

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) seen.add(e.target);
        else seen.delete(e.target);
      });
      let top = null;
      let topY = Infinity;
      seen.forEach(s => {
        const y = s.getBoundingClientRect().top;
        if (y < topY) { topY = y; top = s; }
      });
      links.forEach(l => l.classList.remove('active'));
      if (top) {
        const link = bySection.get(top);
        if (link) link.classList.add('active');
      }
    }, {
      rootMargin: '-72px 0px -60% 0px',
      threshold: [0, 0.1, 0.5],
    });

    sections.forEach(s => observer.observe(s));
  }

  // The old left/right + slider rollout comparison lived here. The LIBERO-10
  // rollouts now use the same iteration strip as the real-robot section, built
  // by initLibero10() below, so the two self-improvement figures read the same.

  // ================= Real-robot sections =================
  // Data-driven: everything below reads assets/data/real_world.json so the
  // numbers live in exactly one place.
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}, text) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  };
  const VID_DIR = 'assets/videos/real/';

  // ================= Margin notes =================
  // Definitions that would bloat a caption live out here instead: a marked term
  // in the text, and the note itself parked in the right-hand gutter when the
  // window has one, or as a card under the marker when it does not — a phone
  // has no gutter, and a note that only exists in the margin is a note phone
  // readers never get. The marker is a filled numeral rather than a bare
  // superscript because a footnote nobody notices is worse than no footnote.
  const NOTES = new Map();
  const NOTE_IDS = new Map();
  let noteUid = 0;
  const stripTags = (h) => h.replace(/<[^>]*>/g, '');
  const note = (n, term, body) => {
    // Keyed by body so a redraw (resize, task switch) reuses the same entry
    // instead of growing the map on every render.
    let id = NOTE_IDS.get(body);
    if (!id) {
      id = 'sn-' + (++noteUid);
      NOTE_IDS.set(body, id);
      NOTES.set(id, body);
    }
    return '<span class="sn"><button type="button" class="sn-ref" data-note="' + id + '" ' +
      'aria-expanded="false">' + term +
      '<span class="sn-mark" aria-hidden="true">' + n + '</span>' +
      // read out inline for assistive tech, so the note never depends on hover
      '<span class="sr-only"> (note: ' + stripTags(body) + ')</span>' +
      '</button></span>';
  };

  (() => {
    const card = document.createElement('div');
    card.className = 'sn-card';
    card.setAttribute('role', 'note');
    document.body.appendChild(card);

    let openRef = null, pinned = false, hideT = 0;
    const stopHide = () => { if (hideT) { clearTimeout(hideT); hideT = 0; } };

    const place = (btn) => {
      const r = btn.getBoundingClientRect();
      const main = document.querySelector('main');
      const m = main ? main.getBoundingClientRect() : { right: window.innerWidth };
      const gutter = window.innerWidth - m.right;
      if (gutter >= 250) {
        // true sidenote: out in the empty right gutter, aligned to its marker
        card.classList.add('is-margin');
        card.style.width = Math.min(270, gutter - 34) + 'px';
        card.style.left = (window.scrollX + m.right + 26) + 'px';
        card.style.top = (window.scrollY + r.top - 3) + 'px';
      } else {
        card.classList.remove('is-margin');
        const w = Math.min(330, window.innerWidth - 28);
        card.style.width = w + 'px';
        const left = Math.min(Math.max(14, r.left - 24), window.innerWidth - w - 14);
        card.style.left = (window.scrollX + left) + 'px';
        card.style.top = (window.scrollY + r.bottom + 9) + 'px';
      }
    };

    const show = (btn, pin) => {
      stopHide();
      if (openRef && openRef !== btn) {
        openRef.setAttribute('aria-expanded', 'false');
        pinned = false;               // moving to another note drops the pin
      }
      openRef = btn;
      if (pin) pinned = true;
      card.innerHTML = NOTES.get(btn.dataset.note) || '';
      card.classList.add('is-on');
      btn.setAttribute('aria-expanded', 'true');
      place(btn);
    };
    const hide = () => {
      stopHide();
      card.classList.remove('is-on');
      if (openRef) openRef.setAttribute('aria-expanded', 'false');
      openRef = null;
      pinned = false;
    };
    // Schedule once and let it run: re-arming on every pointerover would push
    // the deadline forward for as long as the mouse kept moving, so the note
    // would never close.
    const hideSoon = () => {
      if (pinned || hideT) return;
      hideT = setTimeout(() => { hideT = 0; hide(); }, 160);
    };

    const refOf = (t) => (t && t.closest ? t.closest('.sn-ref') : null);

    document.addEventListener('pointerover', (e) => {
      const btn = refOf(e.target);
      if (btn) { if (e.pointerType !== 'touch') show(btn, false); return; }
      if (card.contains(e.target)) { stopHide(); return; }   // reaching for the card
      if (openRef) hideSoon();
    });
    // Keyboard activation arrives as a click on a <button>, so this covers
    // Enter/Space too. No focusin handler: focus lands before click on a mouse
    // press, and pinning there made the click read as a second tap and close it.
    document.addEventListener('click', (e) => {
      const btn = refOf(e.target);
      if (btn) {
        e.preventDefault();
        if (openRef === btn && pinned) hide(); else show(btn, true);
        return;
      }
      if (!card.contains(e.target)) hide();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !openRef) return;
      const ref = openRef;
      hide();
      ref.focus();
    });
    // The card is positioned in page coordinates, so it rides along with the
    // content on scroll; only a resize can invalidate which side it sits on.
    window.addEventListener('resize', () => { if (openRef) place(openRef); });
  })();

  // Shared registry of clips whose status ring the RAF loop drives.
  const tracked = [];

  // One RAF loop for every tracked clip on the page.
  // Visibility gating. Decoding every clip on the page at once is what makes
  // this feel heavy, so each group of clips only plays while its section is
  // actually on screen; offscreen clips are paused and skipped by the status
  // loop. Group ids: 'si' (real robot), 'cs' (recovery), 'l10' (LIBERO-10).
  const GROUPS = {
    si:  { section: 'real-robot', visible: true, clock: null },
    cs:  { section: 'recovery',   visible: true, clock: null },
    l10: { section: 'l10-stage',  visible: true, clock: null },
  };
  const anyVisible = () => Object.values(GROUPS).some(g => g.visible);
  const setSectionActive = (which, on) => {
    const g = GROUPS[which];
    if (!g) return;
    g.visible = on;
    // Only the pause side acts on the clips directly. Coming back into view we
    // just resume the group clock and let its tick restart whichever clips
    // still have time left: play() on a clip that already reached its end
    // rewinds it to 0, which would break the lockstep on the way back.
    if (!on) for (const c of tracked) { if (c.group === which) c.video.pause(); }
    if (g.clock) (on ? g.clock.resume() : g.clock.pause());
    schedule();
  };

  if ('IntersectionObserver' in window) {
    const byEl = new Map();
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        const which = byEl.get(e.target);
        if (which) setSectionActive(which, e.isIntersecting);
      });
    }, { rootMargin: '150px 0px' });
    Object.entries(GROUPS).forEach(([key, g]) => {
      const el = document.getElementById(g.section);
      if (!el) return;
      byEl.set(el, key);
      io.observe(el);
    });
  }

  let rafPending = false;
  const tickStatus = () => {
    for (const g of Object.values(GROUPS)) {
      if (g.clock && g.visible) g.clock.tick();
    }
    for (const c of tracked) {
      if (!GROUPS[c.group] || !GROUPS[c.group].visible) continue;
      const t = c.video.currentTime || 0;
      const dur = c.video.duration || 0;
      // Latch completion for the rest of the cycle. Chrome reclaims the decoder
      // of a clip that has finished — readyState drops to HAVE_METADATA and
      // currentTime resets to 0 — which without the latch un-flips the ring
      // back to amber and sends the readout to zero. The latch is cleared when
      // the group restarts.
      if (c.successAt != null && t >= c.successAt) c._latched = true;
      const done = !!c._latched;

      // Every write below is guarded: this runs at 60fps across every clip, and
      // unconditional style/text writes here were causing layout on each frame.
      if (done !== c._done) {
        c._done = done;
        c.frame.classList.toggle('is-done', done);
        c.frame.classList.toggle('is-failed', c.successAt == null);
        if (c.timeEl) c.timeEl.classList.toggle('is-done', done);
        if (c.onStatus) c.onStatus(done);
      }
      if (c.bar) {
        const denom = c.successAt != null ? c.successAt : (dur || 1);
        const f = done ? 1 : Math.min(1, t / denom);
        if (c._f === undefined || Math.abs(f - c._f) > 0.004) {
          c._f = f;
          // scaleX composites; animating width would relayout the frame.
          c.bar.style.transform = 'scaleX(' + f.toFixed(3) + ')';
        }
      }
      if (c.timeEl) {
        // Real-robot clips read out wall-clock seconds; the LIBERO clips read
        // out environment steps, which is the unit the paper reports.
        const label = c.fmt
          ? c.fmt(done ? c.successAt : t, done)
          : (done ? c.successAt.toFixed(1) + 's ✓' : t.toFixed(1) + 's');
        if (label !== c._label) { c._label = label; c.timeEl.textContent = label; }
      }
    }
    rafPending = false;
    schedule();
  };
  const schedule = () => {
    if (rafPending || document.hidden || !tracked.length) return;
    if (!anyVisible()) return;   // nothing on screen — stop the loop
    rafPending = true;
    requestAnimationFrame(tickStatus);
  };

  // Lockstep sync driven by one virtual clock rather than by any single
  // video's own clock. A clip that stalls on decode gets pulled back onto the
  // shared timeline instead of drifting, which matters here because the whole
  // point is comparing which rollout finishes first. Clips shorter than the
  // group freeze on their last frame; everything restarts together after a
  // short hold so the finish order stays readable.
  const syncGroup = (videos, groupKey, holdSec = 1.4) => {
    if (!videos.length) return null;
    const isVisible = () => GROUPS[groupKey].visible;
    videos.forEach(v => { v.muted = true; v.loop = false; });
    const g = { videos, t0: 0, span: 0, hold: holdSec, started: false, pausedAt: 0 };

    // Scrolling the section out of view pauses playback; hold the virtual
    // clock too, so coming back resumes mid-rollout instead of jumping.
    g.pause = () => { if (!g.pausedAt) g.pausedAt = performance.now(); };
    g.resume = () => {
      if (g.pausedAt) { g.t0 += performance.now() - g.pausedAt; g.pausedAt = 0; }
    };

    const kick = () => {
      g.span = videos.reduce((m, v) => Math.max(m, v.duration || 0), 0);
      g.t0 = performance.now();
      g.started = true;
      // new cycle: every clip is unfinished again
      for (const c of tracked) { if (c.group === groupKey) c._latched = false; }
      videos.forEach(v => {
        try { v.currentTime = 0; } catch {}
        // Only actually decode if the section is on screen — metadata can land
        // long after the visibility observer has already run.
        if (isVisible()) {
          const p = v.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        }
      });
      if (!isVisible()) g.pause();
      schedule();
    };

    let ready = 0;
    videos.forEach(v => {
      const onMeta = () => { if (++ready === videos.length) kick(); };
      if (v.readyState >= 1) onMeta();
      else v.addEventListener('loadedmetadata', onMeta, { once: true });
    });

    g.tick = () => {
      if (!g.started) return;
      const elapsed = (performance.now() - g.t0) / 1000;
      if (elapsed > g.span + g.hold) { kick(); return; }
      for (const v of g.videos) {
        const dur = v.duration || 0;
        const target = Math.min(elapsed, Math.max(0, dur - 0.05));
        // Only correct real drift — seeking every frame would thrash decode.
        if (Math.abs((v.currentTime || 0) - target) > 0.35) {
          try { v.currentTime = target; } catch {}
        }
        // Only (re)start a clip that genuinely has time left. play() on a clip
        // sitting at its end rewinds it to 0, so the margins here matter.
        const left = dur && elapsed < dur - 0.1 && (v.currentTime || 0) < dur - 0.1;
        if (isVisible() && v.paused && left) {
          const p = v.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        }
      }
    };
    return g;
  };

  const mkClip = (src, opts = {}) => {
    const fig = document.createElement('figure');
    fig.className = opts.cellClass || 'si-cell';
    const frame = document.createElement('div');
    frame.className = 'video-frame status-frame';
    const video = document.createElement('video');
    const dir = opts.dir || VID_DIR;
    video.src = dir + src + '.mp4';
    video.poster = dir + src + '.jpg';
    video.muted = true;
    video.playsInline = true;
    // 'metadata', not 'auto'. There are 11 clips across the two strips; with
    // preload="auto" every one of them fetches in full on load (~2.5 MB) and
    // asks for a decoder up front, and mobile Safari caps how many video
    // elements can hold one at once — past the cap the extras simply render
    // black. syncGroup only needs loadedmetadata, which 'metadata' still fires.
    video.preload = 'metadata';
    video.setAttribute('playsinline', '');
    video.setAttribute('disablepictureinpicture', '');
    video.setAttribute('controlslist', 'nodownload nofullscreen noremoteplayback');
    const ring = document.createElement('span');
    ring.className = 'status-ring';
    ring.setAttribute('aria-hidden', 'true');
    const bar = document.createElement('span');
    bar.className = 'status-bar';
    bar.setAttribute('aria-hidden', 'true');
    frame.append(video, ring, bar);

    const cap = document.createElement('figcaption');
    cap.className = 'rollout-meta';
    const label = document.createElement('span');
    label.className = 'rollout-label';
    label.innerHTML = opts.label || '';
    cap.appendChild(label);
    let timeEl = null;
    if (opts.showTime) {
      timeEl = document.createElement('span');
      timeEl.className = 'si-time';
      cap.appendChild(timeEl);
    }
    fig.append(frame, cap);
    return { fig, frame, video, bar, timeEl };
  };

  // Draw at 1:1 CSS pixels. A fixed viewBox scales all text with the
  // container, so a 13px label became ~9px on a narrow window; here the
  // coordinate system *is* pixels, so font sizes match the body copy exactly.
  function responsiveSVG(fig, draw) {
    let lastW = 0;
    const render = () => {
      const w = Math.round(fig.clientWidth || fig.parentElement.clientWidth || 0);
      if (w < 80) { requestAnimationFrame(render); return; }   // not laid out yet
      if (Math.abs(w - lastW) < 8) return;
      lastW = w;
      draw(w);
    };
    render();
    if ('ResizeObserver' in window) {
      let pending = false;
      new ResizeObserver(() => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => { pending = false; render(); });
      }).observe(fig);
    } else {
      window.addEventListener('resize', render);
    }
    return render;
  }

  // Versioned like the css/js: this file names the clip files, so a cached
  // copy can point at a filename that no longer exists. Bump with ?v= in
  // index.html whenever real_world.json or a clip filename changes.
  fetch('assets/data/real_world.json?v=20')
    .then(r => r.json())
    .then(RW => {
      initSelfImprovement(RW);
      initFailureModes(RW);
      initLibero10(RW);
      initBreadthChart(RW);
    })
    .catch(() => {
      // Served from file:// or the JSON is missing — leave the static markup be.
      const s = document.getElementById('si-caption');
      if (s) s.textContent = 'Interactive rollouts require the page to be served over HTTP.';
    });

  // ---------- iteration strip, shared by the real-robot and LIBERO figures ----------
  // Both self-improvement figures are the same object: one clip per iteration,
  // all restarting together, above a success-vs-iteration curve whose markers
  // turn green as the clips finish.
  const mountStrip = ({ strip, group, clips, dir, labelFor, fmtFor, onStatus, onHover }) => {
    for (let i = tracked.length - 1; i >= 0; i--) {
      if (tracked[i].group === group) tracked.splice(i, 1);
    }
    strip.innerHTML = '';
    const cells = [];
    clips.forEach((c, idx) => {
      const clip = mkClip(c.src, { dir, label: labelFor(c, idx), showTime: true });
      if (c.iter === 0) clip.fig.classList.add('is-baseline');
      strip.appendChild(clip.fig);
      tracked.push({
        video: clip.video, frame: clip.frame, bar: clip.bar, timeEl: clip.timeEl,
        successAt: c.successAt, group,
        fmt: fmtFor ? fmtFor(c) : null,
        onStatus: (done) => onStatus(idx, done),
      });
      cells.push({ clip, iter: c.iter, idx });
      if (onHover) {
        clip.fig.addEventListener('mouseenter', () => onHover(idx, true));
        clip.fig.addEventListener('mouseleave', () => onHover(idx, false));
      }
    });
    GROUPS[group].clock = syncGroup(cells.map(c => c.clip.video), group);
    schedule();
    return cells;
  };

  // ---------- one line-chart renderer for every figure on the page ----------
  // The real-robot curve and the two simulation curves go through this same
  // function, so they share margins, tick typography, the shaded gap between a
  // method and its closest baseline, direct end-of-line labels and the hover
  // readout. A chart is one or more stacked panels sharing an x-axis: splitting
  // lets tightly-clustered leaders get a zoomed band of their own while the
  // unstable baselines keep a full-range band, since one shared axis would
  // squash the 93.5 / 95 / 99 gaps that are the actual result.
  function makeChart(fig, cfg) {
    // `state` outlives each redraw: the status loop and the strip hover hold on
    // to it, while `dots` and `show`/`clear` are replaced every time the figure
    // is re-rendered at a new width.
    const state = { dots: [], show: () => {}, clear: () => {} };
    responsiveSVG(fig, (W) => drawChart(fig, cfg, state, W));
    return state;
  }

  function drawChart(fig, cfg, state, W) {
    const mL = 58, mR = 20, mT = 48, mB = 56, gapPx = 28;
    const panels = cfg.panels || [{ ymin: cfg.ymin, ymax: cfg.ymax, ticks: cfg.ticks, h: 1 }];
    const bodyH = cfg.height || 430;
    const totalH = bodyH * panels.reduce((a, p) => a + p.h, 0) + gapPx * (panels.length - 1);
    const H = totalH + mT + mB;
    const pw = W - mL - mR;
    const its = cfg.iterations;
    const n = its.length;
    const x = i => mL + (pw * i) / (n - 1);

    let top = mT;
    const scale = cfg.scale || 'linear';
    panels.forEach(p => {
      p.top = top; p.h_px = bodyH * p.h;
      if (scale === 'log-error') {
        // log on the distance from 100%: expands the near-saturated region
        const e = v => Math.max(100 - v, 0.05);
        const l0 = Math.log10(e(p.ymin)), l1 = Math.log10(e(p.ymax));
        p.y = v => p.top + p.h_px * ((Math.log10(e(v)) - l1) / (l0 - l1));
      } else {
        p.y = v => p.top + p.h_px * (1 - (v - p.ymin) / (p.ymax - p.ymin));
      }
      top += p.h_px + gapPx;
    });
    const lastPanel = panels[panels.length - 1];

    const svg = svgEl('svg', {
      width: W, height: H, viewBox: `0 0 ${W} ${H}`,
      class: 'lc-svg', role: 'img', 'aria-label': cfg.aria || '',
    });
    // Attach before drawing: getComputedTextLength only reports on a rendered
    // element, and label widths guessed from character counts were off by
    // enough to let two labels collide or leave a backing rect too short.
    fig.innerHTML = '';
    fig.appendChild(svg);
    const measure = (txt, cls) => {
      const t = svgEl('text', { x: -9999, y: -9999, class: cls }, txt);
      svg.appendChild(t);
      const w = t.getComputedTextLength ? t.getComputedTextLength() : 0;
      t.remove();
      return w || txt.length * 7.6;
    };

    panels.forEach(p => {
      p.ticks.forEach(t => {
        svg.appendChild(svgEl('line', { x1: mL, x2: mL + pw, y1: p.y(t), y2: p.y(t), class: 'chart-grid' }));
        svg.appendChild(svgEl('text', {
          x: mL - 10, y: p.y(t) + 5, class: 'lc-tick', 'text-anchor': 'end',
        }, (Number.isInteger(t) ? t : t.toFixed(1)) + '%'));
      });
      svg.appendChild(svgEl('line', {
        x1: mL, x2: mL + pw, y1: p.top + p.h_px, y2: p.top + p.h_px, class: 'chart-baseline',
      }));
      if (p.title) svg.appendChild(svgEl('text', { x: mL, y: p.top - 6, class: 'lc-panel-title' }, p.title));
    });

    its.forEach(i => svg.appendChild(svgEl('text', {
      x: x(i), y: lastPanel.top + lastPanel.h_px + 24, class: 'lc-tick', 'text-anchor': 'middle',
    }, String(i))));
    svg.appendChild(svgEl('text', {
      x: mL + pw / 2, y: H - 10, class: 'lc-axis', 'text-anchor': 'middle',
    }, 'Self-improvement iteration'));

    // Shade the gap between the method and its closest baseline — that gap is
    // the result, and it is the same visual device in every figure.
    const byKey = new Map(cfg.series.map(s => [s.key, s]));
    if (cfg.band) {
      const p = panels[0];
      const A = byKey.get(cfg.band[0]), B = byKey.get(cfg.band[1]);
      if (A && B) {
        const clamp = v => Math.max(p.ymin, Math.min(p.ymax, v));
        let d = A.values.map((v, i) => (i ? 'L' : 'M') + x(i) + ' ' + p.y(clamp(v))).join(' ');
        for (let i = B.values.length - 1; i >= 0; i--) d += ' L' + x(i) + ' ' + p.y(clamp(B.values[i]));
        svg.appendChild(svgEl('path', { d: d + ' Z', fill: A.color, opacity: 0.07 }));
      }
    }

    // Draw only the in-range part of each series. A series that drops below the
    // axis floor exits the plot and stops, rather than running flat along the
    // bottom where it would read as sitting at the floor value.
    const seriesPath = (vals, p) => {
      let d = '', pen = false;
      for (let i = 0; i < vals.length; i++) {
        const v = vals[i], inRange = v >= p.ymin;
        if (inRange) {
          d += (pen ? 'L' : 'M') + x(i) + ' ' + p.y(Math.min(v, p.ymax)) + ' ';
          pen = true;
        } else {
          if (pen) {
            const pv = vals[i - 1];
            const f = (pv - p.ymin) / (pv - v);
            d += 'L' + (x(i - 1) + (x(i) - x(i - 1)) * f) + ' ' + p.y(p.ymin) + ' ';
          }
          pen = false;
        }
      }
      return d.trim();
    };

    const lead = byKey.get(cfg.markers) || cfg.series[0];
    const halos = [];
    state.dots = [];

    panels.forEach(p => {
      const mine = cfg.series.filter(s => !p.keys || p.keys.includes(s.key));
      mine.forEach(s => {
        const attrs = {
          d: seriesPath(s.values, p), fill: 'none', stroke: s.color, 'stroke-width': s.width,
          'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        };
        if (s.dash) attrs['stroke-dasharray'] = s.dash;
        svg.appendChild(svgEl('path', attrs));
      });

      // Secondary series get small plain markers; the emphasised series gets
      // the markers the status loop turns green as each clip finishes.
      mine.filter(s => s !== lead && cfg.plainMarkers).forEach(s => {
        s.values.forEach((v, i) => {
          if (v >= p.ymin && v <= p.ymax) {
            svg.appendChild(svgEl('circle', { cx: x(i), cy: p.y(v), r: 3.5, fill: s.color }));
          }
        });
      });
      if (mine.includes(lead)) {
        lead.values.forEach((v, i) => {
          if (v < p.ymin) return;
          const c = svgEl('circle', {
            cx: x(i), cy: p.y(Math.min(v, p.ymax)), r: cfg.markerR || 4,
            fill: lead.color, class: 'si-dot-active',
          });
          svg.appendChild(c);
          state.dots[i] = c;
        });
      }

      const placed = [];
      const LH = 20;   // line height at 17px

      // Value labels on the emphasised series. 'all' suits a five-point curve;
      // 'ends' keeps an eleven-point curve from turning into a wall of numbers.
      if (cfg.valueLabels && mine.includes(lead)) {
        const idxs = cfg.valueLabels === 'all'
          ? lead.values.map((_, i) => i)
          : [0, lead.values.length - 1];
        idxs.forEach(i => {
          const v = lead.values[i];
          if (v < p.ymin) return;
          const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
          const cx = x(i) + (i === 0 ? 10 : i === n - 1 ? -2 : 0);
          const cy = p.y(Math.min(v, p.ymax)) - 15;
          svg.appendChild(svgEl('text', { x: cx, y: cy, class: 'lc-value', 'text-anchor': anchor }, v + '%'));
          const w = measure(v + '%', 'lc-value');
          const x0 = anchor === 'end' ? cx - w : anchor === 'start' ? cx : cx - w / 2;
          placed.push({ x0, x1: x0 + w, y0: cy - LH * 0.75, y1: cy + LH * 0.25 });
        });
      }

      // Every drawn segment in this panel, so a label can be placed where it
      // crosses no line at all and needs no halo behind it.
      const segs = [];
      mine.forEach(s => {
        for (let i = 1; i < n; i++) {
          const a = s.values[i - 1], b = s.values[i];
          if (a < p.ymin || b < p.ymin || a > p.ymax || b > p.ymax) continue;
          segs.push({ ax: x(i - 1), ay: p.y(a), bx: x(i), by: p.y(b) });
        }
      });
      const segHitsBox = (g, b) => {
        // trivial accept: an endpoint inside the box
        if ((g.ax >= b.x0 && g.ax <= b.x1 && g.ay >= b.y0 && g.ay <= b.y1) ||
            (g.bx >= b.x0 && g.bx <= b.x1 && g.by >= b.y0 && g.by <= b.y1)) return true;
        // otherwise test the segment against each edge of the box
        const cross = (x1, y1, x2, y2, x3, y3, x4, y4) => {
          const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
          if (!d) return false;
          const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
          const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
          return t >= 0 && t <= 1 && u >= 0 && u <= 1;
        };
        return cross(g.ax, g.ay, g.bx, g.by, b.x0, b.y0, b.x1, b.y0) ||
               cross(g.ax, g.ay, g.bx, g.by, b.x1, b.y0, b.x1, b.y1) ||
               cross(g.ax, g.ay, g.bx, g.by, b.x1, b.y1, b.x0, b.y1) ||
               cross(g.ax, g.ay, g.bx, g.by, b.x0, b.y1, b.x0, b.y0);
      };
      const overLine = (b) => segs.some(g => segHitsBox(g, b));

      // Name each line directly beneath itself — no legend. Anchor on the last
      // point still on the axis, then walk backwards along the line until the
      // label clears everything already placed; a fixed stagger is not enough
      // when two long names sit at nearly the same height.
      const mineOrdered = mine.slice().sort((a, b) => (a === lead ? -1 : b === lead ? 1 : 0));
      mineOrdered.forEach(s => {
        let lastIn = -1;
        for (let i = 0; i < n; i++) if (s.values[i] >= p.ymin && s.values[i] <= p.ymax) lastIn = i;
        if (lastIn < 0) return;

        const cls = s === lead ? 'lc-end lc-end-strong' : 'lc-end';
        const w = measure(s.label, cls);
        // Three tiers, best first: clear of both labels and lines; clear of
        // labels only; anything on the panel. Only the middle tier needs a halo
        // behind the text, so most labels end up sitting on bare background.
        let box = null, noLineHit = null, fallback = null;
        outer:
        for (let tries = 0; tries <= lastIn; tries++) {
          const cand = lastIn - tries;
          for (const side of [26, -16]) {
            const anchor = cand === n - 1 ? 'end' : cand === 0 ? 'start' : 'middle';
            const cx = x(cand);
            const x0 = anchor === 'end' ? cx - w : anchor === 'start' ? cx : cx - w / 2;
            const cy = p.y(s.values[cand]) + side;
            let b = { x0, x1: x0 + w, y0: cy - LH * 0.75, y1: cy + LH * 0.25, anchor, cx, cy };
            if (b.x1 > mL + pw) {
              b = { ...b, anchor: 'end', cx: mL + pw, x0: mL + pw - w, x1: mL + pw };
            } else if (b.x0 < mL) {
              b = { ...b, anchor: 'start', cx: mL, x0: mL, x1: mL + w };
            }
            if (b.y0 < p.top || b.y1 > p.top + p.h_px) continue;   // stay in the panel
            if (!fallback) fallback = b;
            const hitsLabel = placed.some(q => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0);
            if (hitsLabel) continue;
            if (!noLineHit) noLineHit = b;
            if (!overLine(b)) { box = b; break outer; }
          }
        }
        const clean = !!box;
        if (!box) box = noLineHit || fallback;
        if (!box) return;
        placed.push(box);
        // A halo only where the label had to sit on a line — on the breadth
        // chart three suites live within ~1.5pp of each other and no placement
        // avoids every series. Everywhere else the text is plain, with nothing
        // painted behind it.
        svg.appendChild(svgEl('text', {
          x: box.cx, y: box.cy, fill: s.color, 'text-anchor': box.anchor,
          class: cls + (clean ? '' : ' has-halo'),
        }, s.label));
      });

      // one hover halo per series per panel, parked off-screen until needed
      mine.forEach(s => {
        const h = svgEl('circle', { cx: -99, cy: -99, r: 6.5, class: 'lc-halo', stroke: s.color });
        svg.appendChild(h);
        halos.push({ el: h, s, p });
      });
    });

    // ---- hover readout ----
    const guide = svgEl('line', {
      x1: -99, x2: -99, y1: panels[0].top, y2: lastPanel.top + lastPanel.h_px, class: 'lc-guide',
    });
    svg.appendChild(guide);

    // The y-axis title sits horizontally above the axis rather than rotated
    // beside it, so it costs no plot width — and it is HTML rather than SVG
    // text so it can carry a margin note saying what a success rate actually
    // counts. Absolutely positioned over the figure, which is `position:
    // relative`; the SVG is drawn at 1:1 so these are the same coordinates.
    const yTitle = document.createElement('div');
    yTitle.className = 'lc-ytitle';
    yTitle.style.top = '0px';
    yTitle.innerHTML = cfg.yNote
      ? note(1, 'Success rate (%)', cfg.yNote)
      : 'Success rate (%)';
    fig.appendChild(yTitle);
    // Sit the title just above the topmost tick label, not at a fixed offset
    // from the plot top. On the log-error chart the first gridline is ~74px
    // below the plot top, which left the title stranded well above the numbers
    // it labels; on a linear 0-100 chart the two coincide.
    const p0 = panels[0];
    const topTickY = p0.y(Math.max.apply(null, p0.ticks)) - 7;   // approx label top
    const titleH = yTitle.offsetHeight || 20;
    const titleTop = Math.max(2, topTickY - 6 - titleH);
    yTitle.style.top = titleTop + 'px';
    const titleBottom = titleTop + titleH;

    const tip = document.createElement('div');
    tip.className = 'lc-tip';
    fig.appendChild(tip);

    if (cfg.caption) {
      const cap = document.createElement('figcaption');
      cap.innerHTML = cfg.caption;
      fig.appendChild(cap);
    }

    let shown = -1;
    const clear = () => {
      if (shown < 0) return;
      shown = -1;
      guide.setAttribute('x1', -99); guide.setAttribute('x2', -99);
      halos.forEach(h => { h.el.setAttribute('cx', -99); h.el.setAttribute('cy', -99); });
      tip.classList.remove('is-on');
      if (cfg.onHover) cfg.onHover(-1);
    };
    const show = (i) => {
      if (i < 0) { clear(); return; }
      if (i === shown) return;
      shown = i;
      guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i));
      let topY = Infinity;
      halos.forEach(h => {
        const v = h.s.values[i];
        if (v == null || v < h.p.ymin || v > h.p.ymax) {
          h.el.setAttribute('cx', -99); h.el.setAttribute('cy', -99);
        } else {
          const cy = h.p.y(v);
          h.el.setAttribute('cx', x(i)); h.el.setAttribute('cy', cy);
          if (cy < topY) topY = cy;
        }
      });
      tip.innerHTML =
        '<b>Iteration ' + its[i] + '</b>' +
        cfg.series.map(s =>
          '<span><i style="background:' + s.color + '"></i>' + s.label +
          '<em>' + s.values[i] + '%</em></span>').join('');
      // Anchor the card to the data, not to the top of the plot. Parked at the
      // top it overhung the figure and sat on the y-axis title — the one thing
      // up there the reader needs to be able to click.
      const half = (tip.offsetWidth || 184) / 2;
      tip.style.left = Math.max(half + 2, Math.min(W - half - 2, x(i))) + 'px';
      // Prefer sitting above the point; when there is not room without running
      // into the y-axis title band, flip under it instead of stacking on top.
      const th = tip.offsetHeight || 70;
      const anchor = topY === Infinity ? panels[0].top + 40 : topY;
      const topLimit = titleBottom + 6;
      let ty = anchor - 16;
      if (ty - th < topLimit) ty = anchor + 16 + th;
      tip.style.top = Math.min(ty, H - 6) + 'px';
      tip.classList.add('is-on');
      if (cfg.onHover) cfg.onHover(i);
    };
    state.show = show;
    state.clear = clear;

    // One listener on the svg beats eleven hit-rects, and the svg is drawn at
    // 1:1 CSS pixels so clientX maps straight onto the plot coordinates.
    svg.addEventListener('pointermove', (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ev.clientX - r.left;
      const py = ev.clientY - r.top;
      // Bounded to the plot body, not the whole SVG. The band above the first
      // gridline belongs to the y-axis title and its note; firing the readout
      // up there put a card over the very control being reached for.
      if (py < panels[0].top - 8) { clear(); return; }
      if (py > lastPanel.top + lastPanel.h_px + 32) { clear(); return; }
      if (px < mL - 24 || px > mL + pw + 24) { clear(); return; }
      show(Math.max(0, Math.min(n - 1, Math.round(((px - mL) / pw) * (n - 1)))));
    });
    svg.addEventListener('pointerleave', clear);
  }

  // ---------- (1) real-robot self-improvement strip ----------
  function initSelfImprovement(RW) {
    const strip = document.getElementById('si-strip');
    const chartFig = document.getElementById('si-chart');
    const capEl = document.getElementById('si-caption');
    if (!strip) return;

    let cells = [];
    let chart = null;

    const render = (taskKey) => {
      const task = RW.tasks[taskKey];

      chart = makeChart(chartFig, {
        iterations: RW.iterations,
        series: [
          { key: 'qp',  label: 'Q-Planning',       color: '#4338ca', width: 3, dash: '',    values: task.qplanning },
          { key: 'sft', label: 'SFT on successes', color: '#9ca3af', width: 2, dash: '4 3', values: task.sft },
        ],
        height: 300,
        ymin: 0, ymax: 100, ticks: [0, 20, 40, 60, 80, 100],
        band: ['qp', 'sft'],
        markers: 'qp', markerR: 5.5, plainMarkers: true,
        valueLabels: 'all',
        yNote: 'Fraction of 20 evaluation seeds in which the task is completed.',
        aria: 'Success rate against self-improvement iteration for ' + task.label,
        onHover: (i) => cells.forEach(c => c.clip.fig.classList.toggle('is-hi', c.idx === i)),
      });

      cells = mountStrip({
        strip, group: 'si', clips: task.clips, dir: VID_DIR,
        labelFor: (c) => c.iter === 0
          ? '<span class="si-iter">Iteration&nbsp;0</span><br/>frozen BC'
          : '<span class="si-iter">Iteration&nbsp;' + c.iter + '</span>',
        onStatus: (idx, done) => {
          const d = chart.dots[idx];
          if (d) d.setAttribute('fill', done ? '#22c55e' : '#4338ca');
        },
        onHover: (idx, on) => (on ? chart.show(idx) : chart.clear()),
      });

      // No KaTeX delimiters in here: auto-render already ran before this is injected.
      capEl.innerHTML =
        '<strong>' + task.label + ': ' + task.headline +
        ' over five iterations of the self-improvement loop.</strong> ' +
        'Each iteration fine-tunes only <em>Q</em>, both on successes and failures. The grey line is ' +
        note(2, 'SFT on successes',
          'Supervised finetuning on successful autonomously collected episodes.') +
        '. Clips restart together and turn green on completion, so the order they turn green is the ' +
        'order they finished.';
    };

    const chips = Array.from(document.querySelectorAll('.task-chip'));
    const select = (taskKey) => {
      chips.forEach(c => {
        const on = c.dataset.task === taskKey;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      render(taskKey);
    };
    chips.forEach(ch => ch.addEventListener('click', () => select(ch.dataset.task)));

    // ?task=cups deep-links straight to a task
    const wanted = new URLSearchParams(location.search).get('task');
    select(RW.tasks[wanted] ? wanted : 'wallet');
  }

  // ---------- (2) failure modes: one BC rollout vs the Q-Planning recovery ----------
  function initFailureModes(RW) {
    const switchEl = document.getElementById('mode-switch');
    const failVideo = document.getElementById('cs-fail-video');
    const failFrame = document.getElementById('cs-fail-frame');
    const failCap = document.getElementById('cs-fail-caption');
    const recVideo = document.getElementById('cs-recovery-video');
    const recFrame = document.getElementById('cs-recovery-frame');
    const recCap = document.getElementById('cs-recovery-caption');
    if (!switchEl || !failVideo) return;

    const failRec = {
      video: failVideo, frame: failFrame, bar: failFrame.querySelector('.status-bar'),
      timeEl: null, successAt: null, group: 'cs',
    };
    const recRec = {
      video: recVideo, frame: recFrame, bar: recFrame.querySelector('.status-bar'),
      timeEl: null, successAt: 0, group: 'cs',
    };
    tracked.push(failRec, recRec);

    const showMode = (mode) => {
      failVideo.src = VID_DIR + mode.clip + '.mp4';
      failVideo.poster = VID_DIR + mode.clip + '.jpg';
      failCap.innerHTML = mode.label;

      const rec = RW.recovery[mode.task];
      recVideo.src = VID_DIR + rec.src + '.mp4';
      recVideo.poster = VID_DIR + rec.src + '.jpg';
      recCap.innerHTML = rec.caption + ' &middot; ' + RW.tasks[mode.task].label;
      recRec.successAt = rec.successAt;

      // Force a reload so readyState drops to 0. Without this, switching mode
      // can leave the previous clip's readyState (and duration) briefly in
      // place, and the group would size its cycle from the wrong clip.
      failVideo.load();
      recVideo.load();

      // Both clips run off one clock and restart together: a side-by-side
      // comparison is only meaningful if the two rollouts start at the same
      // moment. The shorter clip freezes on its last frame until the wrap.
      GROUPS.cs.clock = syncGroup([failVideo, recVideo], 'cs');
      schedule();
    };

    const wanted = new URLSearchParams(location.search).get('mode');
    const startIdx = Math.max(0, RW.failureModes.findIndex(m => m.id === wanted));
    RW.failureModes.forEach((mode, i) => {
      const b = document.createElement('button');
      b.className = 'mode-chip' + (i === startIdx ? ' is-active' : '');
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', i === startIdx ? 'true' : 'false');
      b.textContent = mode.label;
      b.addEventListener('click', () => {
        switchEl.querySelectorAll('.mode-chip').forEach(c => {
          c.classList.remove('is-active');
          c.setAttribute('aria-selected', 'false');
        });
        b.classList.add('is-active');
        b.setAttribute('aria-selected', 'true');
        showMode(mode);
      });
      switchEl.appendChild(b);
    });
    showMode(RW.failureModes[startIdx]);
  }

  // ---------- (3) LIBERO-10: the same strip-over-curve figure, in simulation ----------
  function initLibero10(RW) {
    const strip = document.getElementById('l10-strip');
    const chartFig = document.getElementById('baselines-chart');
    if (!chartFig) return;

    const L = RW.libero10;
    let cells = [];

    const chart = makeChart(chartFig, {
      iterations: L.iterations,
      series: L.series,
      height: 470,
      scale: 'log-error',
      ymin: 60, ymax: 99.5,
      ticks: [60, 80, 90, 95, 98, 99],
      band: ['qp', 'sft'],
      markers: 'qp', markerR: 5,
      valueLabels: 'ends',
      yNote: 'Fraction of evaluation seeds completed, over 10 tasks &times; 20 seeds.',
      aria: 'Q-Planning against five other self-improvement methods over ten online iterations on LIBERO-10.',
      // Caption the curve, not the clips: this sits directly under the plot, so
      // a caption about the videos above read as if it described the axes.
      caption: '<strong>Q-Planning against five other self-improvement methods on LIBERO-10, ' +
        'identical online budget.</strong> Only Q-Planning keeps climbing.',
      onHover: (i) => cells.forEach(c => c.clip.fig.classList.toggle('is-hi', c.idx === i)),
    });

    if (!strip || !L.clips) return;
    const sps = L.stepsPerSec || 80;

    cells = mountStrip({
      strip, group: 'l10', clips: L.clips, dir: L.dir || 'assets/videos/',
      labelFor: (c) => c.iter === 0
        ? '<span class="si-iter">Iteration&nbsp;0</span><br/>offline <em>Q</em>'
        : '<span class="si-iter">Iteration&nbsp;' + c.iter + '</span>',
      // These clips read out environment steps, the unit the paper reports,
      // rather than the wall-clock seconds the real-robot clips show.
      fmtFor: (c) => (t, done) =>
        (done ? c.steps + ' steps ✓' : Math.min(c.steps, Math.round(t * sps)) + ' steps'),
      onStatus: (idx, done) => {
        const d = chart.dots[idx];
        if (d) d.setAttribute('fill', done ? '#22c55e' : '#4338ca');
      },
      onHover: (idx, on) => (on ? chart.show(idx) : chart.clear()),
    });
  }

  // ---------- (4) breadth across suites ----------
  function initBreadthChart(RW) {
    const fig = document.getElementById('breadth-chart');
    if (!fig) return;
    makeChart(fig, {
      iterations: RW.breadth.iterations,
      series: RW.breadth.series,
      height: 360,
      ymin: 80, ymax: 101,
      ticks: [80, 85, 90, 95, 100],
      markers: 'robotwin', markerR: 4,
      yNote: 'Fraction of evaluation seeds completed, 20 seeds per task, averaged over each suite.',
      aria: 'Success rate against self-improvement iteration for four LIBERO suites and RoboTwin.',
      caption: '<strong>The online column of the table above, iteration by iteration.</strong>',
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) schedule();
  });

})();
