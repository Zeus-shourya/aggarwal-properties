/* Aggarwal Properties — interactive plot maps.
   Data:  assets/js/plots-data.js (geometry, generated from the plan PDFs)
          data/status.json        (which plots are sold - edited through the CMS)
          data/projects.js        (project names) */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var MAPS = window.AP_MAPS || {};
  var PROJECTS = window.AP_PROJECTS || [];
  var SOLD = {};
  function loadSold(data) {
    Object.keys(MAPS).forEach(function (k) {
      var v = data && data[k];
      if (v == null || v === '') v = [];
      if (!Array.isArray(v)) v = [v];
      SOLD[k] = new Set(v.map(String));
    });
  }
  loadSold({});

  var AP = (window.AP = window.AP || {});
  /* Pages wait for AP.ready before drawing. The sold list is fetched fresh on every visit
     ('no-cache' = always re-check with the server), so a save in the CMS shows up as soon
     as GitHub has republished. If the file can't be read, everything shows as available. */
  AP.ready = new Promise(function (resolve) {
    var done = false;
    function finish(data) { if (done) return; done = true; if (data) loadSold(data); resolve(); }
    setTimeout(function () { finish(null); }, 4000);
    try {
      fetch('data/status.json', { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(finish, function () { finish(null); });
    } catch (e) { finish(null); }
  });
  AP.PHONE = '917015070104';
  AP.PHONE_DISPLAY = '+91 70150 70104';
  AP.maps = MAPS;
  AP.projects = PROJECTS;
  AP.wa = function (msg) { return 'https://wa.me/' + AP.PHONE + '?text=' + encodeURIComponent(msg); };
  AP.project = function (key) { return PROJECTS.filter(function (p) { return p.key === key; })[0]; };
  AP.isSold = function (key, id) { return SOLD[key].has(String(id)); };
  AP.setSold = function (key, id, sold) { SOLD[key][sold ? 'add' : 'delete'](String(id)); };
  AP.soldList = function (key) {
    return MAPS[key].plots.filter(function (p) { return AP.isSold(key, p.id); }).map(function (p) { return p.id; });
  };
  AP.stats = function (key) {
    var min = Infinity, max = 0, sold = 0, pl = MAPS[key].plots;
    pl.forEach(function (p) {
      if (AP.isSold(key, p.id)) sold++;
      if (p.a) { min = Math.min(min, p.a); max = Math.max(max, p.a); }
    });
    return { total: pl.length, sold: sold, available: pl.length - sold, min: min, max: max };
  };
  AP.num = function (n) { return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }); };

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function widthText(w, key) {
    if (!w) return '';
    if (w === 'main') return 'Main Kami Road';
    var ft = Math.floor(w), inch = Math.round((w - ft) * 12);
    return ft + "'" + (inch ? inch + '"' : '') + ' wide ' + ((AP.project(key) || {}).roadWord || 'road');
  }
  AP.facingText = function (p, key, withRoad) {
    if (!p.f.length) return '';
    return p.f.map(function (f) {
      var w = withRoad && widthText(f[1], key);
      return f[0] + (w ? ' (' + w + ')' : '');
    }).join(' & ');
  };

  /* ── static drawing shared by thumbnails and the full map ── */
  function draw(svg, key, opt) {
    var m = MAPS[key];
    svg.setAttribute('viewBox', '0 0 ' + m.w + ' ' + m.h);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    if (opt.hatch) {
      var defs = el('defs', {}, svg);
      var pat = el('pattern', { id: 'hatch-sold', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
      el('rect', { width: 7, height: 7, fill: '#E5484D' }, pat);
      el('rect', { width: 2, height: 7, fill: '#C2333A' }, pat);
    }
    var vp = el('g', { 'class': 'vp' }, svg);
    el('path', { d: m.roads, 'class': 'road', 'fill-rule': 'evenodd' }, vp);
    if (opt.labels) {
      var lf = key === 'p2' ? 13 : 10;
      m.labels.forEach(function (l) {
        var t = el('text', { 'class': 'road-label', x: l.x, y: l.y, transform: 'rotate(' + l.a + ' ' + l.x + ' ' + l.y + ')', style: 'font-size:' + lf + 'px' }, vp);
        t.textContent = l.t;
      });
    }
    var gp = el('g', {}, vp), polys = {};
    m.plots.forEach(function (p, i) {
      var cls = 'plot ' + (opt.tint ? 't' + ((i * 7 + (i % 3) * 3) % 5) : AP.isSold(key, p.id) ? 'sold' : 'avail');
      polys[p.id] = el('polygon', { points: p.p, 'class': cls, 'data-id': p.id }, gp);
      // set inline: a url(#id) inside an external stylesheet is resolved against the CSS file, not the page
      if (opt.hatch && !opt.tint && AP.isSold(key, p.id)) polys[p.id].style.fill = 'url(#hatch-sold)';
    });
    var nums = {};
    if (opt.nums) {
      var gn = el('g', {}, vp);
      m.plots.forEach(function (p) {
        var fs = Math.max(4.5, Math.min(20, p.r * (p.n.length > 3 ? 0.62 : p.n.length > 2 ? 0.8 : 0.95)));
        var t = el('text', { 'class': 'num ' + (AP.isSold(key, p.id) ? 's' : 'a'), x: p.c[0], y: p.c[1], style: 'font-size:' + fs.toFixed(1) + 'px' }, gn);
        var a = el('tspan', { x: p.c[0], dy: '-0.28em' }, t); a.textContent = p.n;
        var b = el('tspan', { 'class': 'ar', x: p.c[0], dy: '1.25em', style: 'font-size:' + (fs * 0.5).toFixed(1) + 'px' }, t);
        b.textContent = p.a + ' sq yd';
        nums[p.id] = t;
      });
    }
    return { vp: vp, polys: polys, nums: nums };
  }

  /* small non-interactive map (project cards, hero) */
  AP.thumb = function (svg, key, opt) {
    if (!MAPS[key]) return;
    draw(svg, key, { hatch: false, labels: false, nums: false, tint: opt && opt.tint });
  };

  /* ── full interactive map ── */
  AP.Map = function (stage, o) {
    var self = this;
    this.stage = stage; this.o = o || {};
    this.k = 1; this.tx = 0; this.ty = 0; this.key = null; this.sel = null;
    stage.innerHTML =
      '<svg role="img" aria-label="Interactive plot layout"></svg>' +
      '<div class="compass" aria-hidden="true"></div>' +
      '<div class="legend"><span><i class="g"></i>Available</span><span><i class="r"></i>Sold</span></div>' +
      '<div class="zoomer"><button type="button" data-z="in" aria-label="Zoom in">+</button><button type="button" data-z="out" aria-label="Zoom out">&minus;</button>' +
      '<button type="button" data-z="fit" aria-label="Reset view"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button></div>' +
      '<div class="tip"></div><div class="hint">Hold Ctrl and scroll to zoom the map</div>';
    this.svg = stage.querySelector('svg');
    this.tip = stage.querySelector('.tip');
    this.hint = stage.querySelector('.hint');

    stage.querySelector('.zoomer').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var z = b.getAttribute('data-z'), m = MAPS[self.key];
      if (z === 'fit') self.view(1, 0, 0);
      else self.zoomAt(m.w / 2, m.h / 2, z === 'in' ? 1.6 : 1 / 1.6, true);
    });

    /* pointer: pan, pinch, click */
    var pts = new Map(), moved = false, start = null, pinch = null;
    function pt(e) { var c = self.svg.getScreenCTM(); if (!c) return { x: 0, y: 0 }; var p = new DOMPoint(e.clientX, e.clientY).matrixTransform(c.inverse()); return { x: p.x, y: p.y }; }
    stage.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.zoomer')) return;
      pts.set(e.pointerId, e);
      if (pts.size === 1) { moved = false; start = { cx: e.clientX, cy: e.clientY, p: pt(e), tx: self.tx, ty: self.ty, target: e.target }; }
      if (pts.size === 2) {
        var a = Array.from(pts.values());
        pinch = { d: Math.hypot(a[0].clientX - a[1].clientX, a[0].clientY - a[1].clientY), k: self.k };
        moved = true; stage.classList.add('dragging');
      }
    });
    stage.addEventListener('pointermove', function (e) {
      if (!pts.has(e.pointerId)) { if (e.pointerType === 'mouse') self.hover(e); return; }
      pts.set(e.pointerId, e);
      if (pts.size === 2 && pinch) {
        var a = Array.from(pts.values());
        var d = Math.hypot(a[0].clientX - a[1].clientX, a[0].clientY - a[1].clientY);
        var mid = pt({ clientX: (a[0].clientX + a[1].clientX) / 2, clientY: (a[0].clientY + a[1].clientY) / 2 });
        self.zoomAt(mid.x, mid.y, (pinch.k * d / pinch.d) / self.k, false);
        return;
      }
      if (!start) return;
      var dx = e.clientX - start.cx, dy = e.clientY - start.cy;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      if (!moved) {
        // at base zoom a mostly-vertical touch drag is the page scrolling, leave it alone
        if (self.k === 1 && e.pointerType !== 'mouse' && Math.abs(dy) > Math.abs(dx)) { pts.delete(e.pointerId); start = null; return; }
        moved = true; stage.classList.add('dragging'); self.tip.classList.remove('on');
        try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      }
      var c = self.svg.getScreenCTM(), u = c ? 1 / c.a : 1;
      self.view(self.k, start.tx + dx * u, start.ty + dy * u);
    });
    function up(e) {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) {
        stage.classList.remove('dragging');
        if (!moved && start && e.type === 'pointerup') {
          var poly = start.target.closest && start.target.closest('.plot');
          if (poly) self.select(poly.getAttribute('data-id'), true);
        }
        start = null;
      } else {
        var rest = Array.from(pts.values())[0];
        start = { cx: rest.clientX, cy: rest.clientY, p: pt(rest), tx: self.tx, ty: self.ty, target: rest.target };
      }
    }
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('pointerleave', function () { self.tip.classList.remove('on'); });
    stage.addEventListener('dblclick', function (e) { if (e.target.closest('.zoomer')) return; var p = pt(e); self.zoomAt(p.x, p.y, 1.8, true); });
    window.addEventListener('resize', function () { if (self.key) self.fit(); });
    var hintT;
    stage.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        var p = pt(e);
        self.zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.01), false);
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        self.hint.classList.add('on'); clearTimeout(hintT);
        hintT = setTimeout(function () { self.hint.classList.remove('on'); }, 900);
      }
    }, { passive: false });
  };

  AP.Map.prototype.load = function (key) {
    var m = MAPS[key]; if (!m) return;
    this.key = key; this.sel = null;
    this.svg.innerHTML = '';
    var d = draw(this.svg, key, { hatch: true, labels: true, nums: true });
    this.vp = d.vp; this.polys = d.polys; this.nums = d.nums;
    this.stage.querySelector('.compass').innerHTML =
      '<svg viewBox="-32 -32 64 64"><g transform="rotate(' + m.north + ')"><path d="M0-15 6 3H-6Z" fill="#F26A0F"/><path d="M0 19 6 3H-6Z" fill="#E7D9B8"/>' +
      '<circle cy="3" r="2.6" fill="#2A1605"/></g><text x="' + (Math.sin(m.north * Math.PI / 180) * 23).toFixed(1) + '" y="' + (-Math.cos(m.north * Math.PI / 180) * 23).toFixed(1) +
      '" text-anchor="middle" dominant-baseline="central" style="font:800 11px Figtree,sans-serif;fill:#2A1605;paint-order:stroke;stroke:#fff;stroke-width:3px">N</text></svg>';
    this.fit();
    this.view(1, 0, 0);
    this.setFilter(this.filter || 'all');
  };

  /* size the stage to the layout's own proportions so there is no dead space around it */
  AP.Map.prototype.fit = function () {
    var m = MAPS[this.key]; if (!m) return;
    var ideal = this.stage.clientWidth * m.h / m.w;
    var cap = Math.min(window.innerHeight * 0.74, 760);
    this.stage.style.height = Math.round(Math.max(300, Math.min(cap, ideal))) + 'px';
  };

  AP.Map.prototype.view = function (k, tx, ty) {
    var m = MAPS[this.key];
    k = Math.max(1, Math.min(9, k));
    var pad = k === 1 ? 0 : Math.min(160, (k - 1) * 60);
    tx = Math.max(m.w * (1 - k) - pad, Math.min(pad, tx));
    ty = Math.max(m.h * (1 - k) - pad, Math.min(pad, ty));
    this.k = k; this.tx = tx; this.ty = ty;
    this.vp.style.transform = 'translate(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px) scale(' + k.toFixed(4) + ')';
    this.stage.classList.toggle('zoomed', k > 1.01);
    this.svg.classList.toggle('z2', k >= 1.9);
  };

  AP.Map.prototype.zoomAt = function (x, y, f, smooth) {
    var k2 = Math.max(1, Math.min(9, this.k * f)), r = k2 / this.k;
    if (!smooth) this.stage.classList.add('dragging');
    this.view(k2, x - (x - this.tx) * r, y - (y - this.ty) * r);
    if (!smooth) { var s = this.stage; clearTimeout(this._zt); this._zt = setTimeout(function () { s.classList.remove('dragging'); }, 120); }
  };

  AP.Map.prototype.plot = function (id) {
    return MAPS[this.key].plots.filter(function (p) { return p.id === id; })[0];
  };

  AP.Map.prototype.focus = function (id) {
    var p = this.plot(id); if (!p) return;
    var m = MAPS[this.key], k = Math.max(this.k, Math.min(5, 60 / Math.max(p.r, 6)));
    this.view(k, m.w / 2 - p.c[0] * k, m.h / 2 - p.c[1] * k);
  };

  AP.Map.prototype.select = function (id, fromClick) {
    var p = this.plot(id); if (!p) return false;
    if (this.o.edit && fromClick) {
      AP.setSold(this.key, id, !AP.isSold(this.key, id));
      this.refresh(id);
    }
    if (this.sel && this.polys[this.sel]) this.polys[this.sel].classList.remove('sel');
    this.sel = id;
    var poly = this.polys[id];
    poly.classList.add('sel');
    poly.parentNode.appendChild(poly); // draw the selected outline above its neighbours
    if (this.o.onSelect) this.o.onSelect(p, this.key, fromClick);
    return true;
  };

  AP.Map.prototype.refresh = function (id) {
    var sold = AP.isSold(this.key, id);
    this.polys[id].classList.toggle('sold', sold); this.polys[id].classList.toggle('avail', !sold);
    this.polys[id].style.fill = sold ? 'url(#hatch-sold)' : '';
    this.nums[id].classList.toggle('s', sold); this.nums[id].classList.toggle('a', !sold);
    if (this.o.onChange) this.o.onChange(this.key);
  };

  AP.Map.prototype.setFilter = function (f) {
    this.filter = f;
    this.svg.classList.toggle('f-avail', f === 'avail');
    this.svg.classList.toggle('f-sold', f === 'sold');
  };

  AP.Map.prototype.hover = function (e) {
    var poly = e.target.closest && e.target.closest('.plot');
    if (!poly) { this.tip.classList.remove('on'); return; }
    var p = this.plot(poly.getAttribute('data-id')), r = this.stage.getBoundingClientRect();
    var sold = AP.isSold(this.key, p.id);
    this.tip.innerHTML = 'Plot ' + esc(p.n) + ' &middot; ' + esc(p.a) + ' sq yd<small>' + (sold ? 'Sold' : 'Available') + (p.f.length ? ' &middot; ' + esc(AP.facingText(p, this.key)) + ' facing' : '') + '</small>';
    this.tip.style.left = (e.clientX - r.left) + 'px';
    this.tip.style.top = Math.max(58, e.clientY - r.top) + 'px';
    this.tip.classList.add('on');
  };

  /* ── detail panel markup ── */
  AP.panelHTML = function (p, key) {
    var proj = AP.project(key) || { name: key, type: '' };
    var sold = AP.isSold(key, p.id);
    var sqft = p.a * 9, sqm = p.a * 0.836127;
    var facing = AP.facingText(p, key, true);
    var rows = '';
    function row(k, v) { rows += '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>'; }
    row('Area', esc(AP.num(p.a)) + ' sq yd<small>' + AP.num(Math.round(sqft)) + ' sq ft &middot; ' + sqm.toFixed(1) + ' sq m</small>');
    if (p.reg) row('Size', esc(p.sides[0]) + ' &times; ' + esc(p.sides[1]) + '<small>front &times; depth</small>');
    else row('Sides', p.sides.map(esc).join(' &middot; ') + '<small>' + p.sides.length + ' sides, starting from the road side</small>');
    if (facing) row('Facing', esc(facing));
    if (p.tag) row('Position', esc(p.tag));
    row('Project', esc(proj.name) + '<small>' + esc(proj.type) + (proj.location ? ' &middot; ' + esc(proj.location) : '') + '</small>');
    var msg = sold
      ? 'Hi Aggarwal Properties, Plot ' + p.n + ' in ' + proj.name + ' shows as sold. Please suggest similar available plots (around ' + p.a + ' sq yd).'
      : 'Hi Aggarwal Properties, I am interested in Plot ' + p.n + ' (' + p.a + ' sq yd' + (p.f.length ? ', ' + AP.facingText(p, key) + ' facing' : '') + ') in ' + proj.name + '. Please share the price and booking details.';
    return '<div class="panel-top"><div><small>' + esc(proj.name) + '</small><h2>Plot ' + esc(p.n) + '</h2></div>' +
      '<span class="badge ' + (sold ? 'no' : 'ok') + '">' + (sold ? 'Sold' : 'Available') + '</span></div>' +
      '<dl class="specs">' + rows + '</dl>' +
      '<a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="' + esc(AP.wa(msg)) + '">' + AP.icons.wa +
      (sold ? 'Ask for similar plots' : 'Book this plot on WhatsApp') + '</a>' +
      '<p class="panel-note">Area and dimensions are taken from the layout plan. Availability is confirmed on WhatsApp before booking.</p>';
  };

  AP.icons = {
    wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M8.53 7.33C8.37 7.33 8.1 7.39 7.87 7.64C7.65 7.89 7 8.5 7 9.71C7 10.93 7.89 12.1 8 12.27C8.14 12.44 9.76 14.94 12.25 16C12.84 16.27 13.3 16.42 13.66 16.53C14.25 16.72 14.79 16.69 15.22 16.63C15.7 16.56 16.68 16.03 16.89 15.45C17.1 14.87 17.1 14.38 17.04 14.27C16.97 14.17 16.81 14.11 16.56 14C16.31 13.86 15.09 13.26 14.87 13.18C14.64 13.1 14.5 13.06 14.31 13.3C14.15 13.55 13.67 14.11 13.53 14.27C13.38 14.44 13.24 14.46 13 14.34C12.74 14.21 11.94 13.95 11 13.11C10.26 12.45 9.77 11.64 9.62 11.39C9.5 11.15 9.61 11 9.73 10.89C9.84 10.78 10 10.6 10.1 10.45C10.23 10.31 10.27 10.2 10.35 10.04C10.43 9.87 10.39 9.73 10.33 9.61C10.27 9.5 9.77 8.26 9.56 7.77C9.36 7.29 9.16 7.35 9 7.34C8.86 7.34 8.7 7.33 8.53 7.33Z"/></svg>'
  };
})();
