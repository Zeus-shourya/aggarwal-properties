/* Aggarwal Properties — shared page behaviour.
   Runs once the sold list (data/status.json) has been fetched - see AP.ready in plotmap.js. */
window.AP.ready.then(function () {
  'use strict';
  var AP = window.AP;
  var root = document.documentElement;
  root.classList.remove('no-js');

  /* mobile nav */
  var toggle = document.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* WhatsApp links carry a pre-filled message */
  document.querySelectorAll('[data-wa]').forEach(function (a) {
    a.href = AP.wa(a.getAttribute('data-wa') || 'Hi Aggarwal Properties, I would like to know more about your plots.');
    a.target = '_blank'; a.rel = 'noopener';
  });

  document.querySelectorAll('[data-icon]').forEach(function (n) {
    n.outerHTML = AP.icons[n.getAttribute('data-icon')] || '';
  });

  var y = document.querySelector('[data-year]');
  if (y) y.textContent = new Date().getFullYear();

  /* numbers that come from the map data */
  var keys = AP.projects.map(function (p) { return p.key; }).filter(function (k) { return AP.maps[k]; });
  var all = keys.map(AP.stats);
  var totals = {
    plots: all.reduce(function (s, a) { return s + a.total; }, 0),
    available: all.reduce(function (s, a) { return s + a.available; }, 0),
    projects: keys.length
  };
  document.querySelectorAll('[data-ap]').forEach(function (n) {
    var v = totals[n.getAttribute('data-ap')];
    if (v != null) { n.textContent = v; if (n.hasAttribute('data-count')) n.setAttribute('data-count', v); }
  });

  /* thumbnails */
  document.querySelectorAll('svg[data-thumb]').forEach(function (svg) {
    AP.thumb(svg, svg.getAttribute('data-thumb'), { tint: svg.hasAttribute('data-tint') });
  });

  var pin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.500C5 14.800 12 21 12 21Z"/><circle cx="12" cy="9.500" r="2.500"/></svg>';
  var arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  /* project cards (home) */
  var cards = document.querySelector('[data-project-cards]');
  if (cards) {
    cards.innerHTML = keys.map(function (k) {
      var p = AP.project(k), s = AP.stats(k);
      return '<a class="card pcard reveal" href="projects.html#' + k + '">' +
        '<div class="pcard-map"><span class="pill"><i></i>' + s.available + ' available' + (s.resale ? ' &middot; ' + s.resale + ' resale' : '') + '</span><svg data-thumb="' + k + '" aria-hidden="true"></svg></div>' +
        '<div class="pcard-body"><span class="pcard-type">' + p.type + '</span><h3>' + p.name + '</h3>' +
        (p.location ? '<span class="pcard-loc">' + pin + p.location + '</span>' : '') +
        '<p>' + p.blurb + '</p>' +
        '<div class="pcard-facts"><span><b>' + s.total + '</b>plots</span><span><b>' + AP.num(s.min) + '&ndash;' + AP.num(s.max) + '</b>sq yd</span><span class="ok"><b>' + s.available + '</b>available</span>' +
        (s.resale ? '<span class="re"><b>' + s.resale + '</b>for resale</span>' : '') + '</div>' +
        '<span class="pcard-go">Open the interactive map ' + arrow + '</span></div></a>';
    }).join('');
    cards.querySelectorAll('svg[data-thumb]').forEach(function (svg) { AP.thumb(svg, svg.getAttribute('data-thumb')); });
  }

  /* inventory table (investors) */
  var inv = document.querySelector('[data-inventory]');
  if (inv) {
    inv.innerHTML = keys.map(function (k) {
      var p = AP.project(k), s = AP.stats(k);
      return '<tr><td><b>' + p.name + '</b><small>' + p.type + (p.location ? ' &middot; ' + p.location : '') + '</small></td>' +
        '<td>' + s.total + '</td><td>' + AP.num(s.min) + ' &ndash; ' + AP.num(s.max) + ' sq yd</td>' +
        '<td><span class="g">' + s.available + ' available</span> &middot; <span class="y">' + s.resale + ' for resale</span> &middot; <span class="r">' + s.sold + ' sold</span>' +
        '<div class="bar"><i style="width:' + (100 * s.available / s.total).toFixed(1) + '%"></i><i class="y" style="width:' + (100 * s.resale / s.total).toFixed(1) + '%"></i></div></td>' +
        '<td><a href="projects.html#' + k + '">View map &rarr;</a></td></tr>';
    }).join('');
  }
  var range = document.querySelector('[data-size-range]');
  if (range && all.length) {
    range.textContent = AP.num(Math.min.apply(null, all.map(function (a) { return a.min; }))) + ' to ' +
      AP.num(Math.max.apply(null, all.map(function (a) { return a.max; }))) + ' sq yd';
  }

  /* reveal on scroll + count-up */
  function countUp(n) {
    var target = parseFloat(n.getAttribute('data-count')), suffix = n.getAttribute('data-suffix') || '', t0 = null;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { n.textContent = target + suffix; return; }
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - p, 3);
      n.textContent = Math.round(target * e) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var items = document.querySelectorAll('.reveal, [data-count]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        if (e.target.classList.contains('reveal')) e.target.classList.add('in');
        if (e.target.hasAttribute('data-count')) countUp(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (n) { io.observe(n); });
  } else {
    items.forEach(function (n) { n.classList.add('in'); });
  }
});
