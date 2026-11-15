/* Projects page: project tabs, the interactive map, plot details, plot list. */
window.AP.ready.then(function () {
  'use strict';
  var AP = window.AP;
  var params = new URLSearchParams(location.search);
  var edit = params.get('edit') === '1';
  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage'), panel = $('panel'), tabs = $('ptabs'), list = $('plotlist'), facts = $('pfacts');
  var search = $('plot-search'), chips = $('chips'), title = $('map-title');
  var keys = AP.projects.map(function (p) { return p.key; }).filter(function (k) { return AP.maps[k]; });
  var current = null;

  var map = new AP.Map(stage, { edit: edit, onSelect: onSelect, onChange: function () { renderCounts(); renderList(); renderTabs(); } });

  var PROPS = 'properties';   // the extra tab: other properties listed with the firm
  var props = AP.properties, propFilter = 'all';
  var propAvail = props.filter(function (p) { return p.status !== 'sold'; }).length;

  function renderTabs() {
    tabs.innerHTML = keys.map(function (k) {
      var p = AP.project(k), s = AP.stats(k);
      return '<button type="button" class="ptab" role="tab" data-key="' + k + '" aria-selected="' + (k === current) + '">' +
        '<b>' + p.name + '</b><span>' + p.type + ' &middot; <em>' + s.available + ' of ' + s.total + ' available</em>' +
        (s.resale ? ' &middot; <em class="y">' + s.resale + ' for resale</em>' : '') + '</span></button>';
    }).join('') +
      '<button type="button" class="ptab ptab-props" role="tab" data-key="' + PROPS + '" aria-selected="' + (current === PROPS) + '">' +
      '<b>Properties with us</b><span>Plots, houses, shops &amp; land &middot; <em>' +
      (props.length ? propAvail + ' available' : 'ask us') + '</em></span></button>';
  }

  /* ── "Properties with us" tab ── */
  var houseArt = '<svg viewBox="0 0 120 90" fill="none" aria-hidden="true"><circle cx="92" cy="26" r="14" fill="#FFD23F"/><path d="M14 78h92" stroke="#F25A05" stroke-width="4" stroke-linecap="round"/><path d="M26 78V46l26-20 26 20v32z" fill="#fff" stroke="#F25A05" stroke-width="4" stroke-linejoin="round"/><path d="M45 78V58h14v20" stroke="#F25A05" stroke-width="4" stroke-linejoin="round"/></svg>';
  function src(path) { return String(path || '').replace(/^\/+/, ''); }
  function propCard(p, i) {
    var e = AP.esc, sold = p.status === 'sold';
    var photos = (Array.isArray(p.photos) ? p.photos : p.photos ? [p.photos] : []).map(src).filter(Boolean);
    var kind = [p.type, p.purpose].filter(Boolean).join(' · ');
    var msg = sold
      ? 'Hi Aggarwal Properties, "' + p.title + '" shows as sold on your website. Please suggest something similar.'
      : 'Hi Aggarwal Properties, I am interested in "' + p.title + '"' + (p.location ? ' (' + p.location + ')' : '') + ' listed on your website. Please share the details.';
    var facts = '';
    if (p.size) facts += '<span><b>' + e(p.size) + '</b>Size</span>';
    facts += '<span><b>' + e(p.price || 'On request') + '</b>Price</span>';
    if (p.facing) facts += '<span><b>' + e(p.facing) + '</b>Facing</span>';
    return '<article class="card prop' + (sold ? ' is-sold' : '') + '" data-i="' + i + '">' +
      '<div class="prop-img" data-n="0">' +
      (photos.length ? '<img src="' + e(photos[0]) + '" alt="' + e(p.title) + '" loading="lazy">' : houseArt) +
      '<span class="badge ' + (sold ? 'no' : 'ok') + '">' + (sold ? 'Sold' : 'Available') + '</span>' +
      (photos.length > 1 ? '<button type="button" class="prop-nav prev" aria-label="Previous photo">&lsaquo;</button><button type="button" class="prop-nav next" aria-label="Next photo">&rsaquo;</button><span class="prop-count">1 / ' + photos.length + '</span>' : '') +
      '</div><div class="pcard-body">' +
      (kind ? '<span class="pcard-type">' + e(kind) + '</span>' : '') +
      '<h3>' + e(p.title) + '</h3>' +
      (p.location ? '<span class="pcard-loc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>' + e(p.location) + '</span>' : '') +
      (p.description ? '<p>' + e(p.description) + '</p>' : '') +
      '<div class="pcard-facts">' + facts + '</div>' +
      '<a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="' + e(AP.wa(msg)) + '">' + AP.icons.wa + (sold ? 'Ask for something similar' : 'Enquire on WhatsApp') + '</a>' +
      '</div></article>';
  }
  function renderProps() {
    var grid = $('prop-grid'), bar = $('prop-chips');
    if (!props.length) {
      bar.innerHTML = '';
      grid.innerHTML = '<div class="prop-empty">' + houseArt + '<b>New properties are being added</b>' +
        '<p>Tell us what you are looking for (plot, house, shop or land, your area and budget) and we will share what we have.</p>' +
        '<a class="btn btn-wa" target="_blank" rel="noopener" href="' + AP.esc(AP.wa('Hi Aggarwal Properties, I am looking for a property. Please share what you have available.')) + '">' + AP.icons.wa + 'Ask on WhatsApp</a></div>';
      return;
    }
    var types = [];
    props.forEach(function (p) { if (p.type && types.indexOf(p.type) < 0) types.push(p.type); });
    bar.innerHTML = '<button type="button" class="chip" data-t="all" aria-pressed="' + (propFilter === 'all') + '">All <b>' + props.length + '</b></button>' +
      (types.length > 1 ? types.map(function (t) {
        return '<button type="button" class="chip" data-t="' + AP.esc(t) + '" aria-pressed="' + (propFilter === t) + '">' + AP.esc(t) + ' <b>' +
          props.filter(function (p) { return p.type === t; }).length + '</b></button>';
      }).join('') : '');
    // available first, sold last
    var shown = props.map(function (p, i) { return { p: p, i: i }; })
      .filter(function (x) { return propFilter === 'all' || x.p.type === propFilter; })
      .sort(function (a, b) { return (a.p.status === 'sold') - (b.p.status === 'sold') || a.i - b.i; });
    grid.innerHTML = shown.map(function (x) { return propCard(x.p, x.i); }).join('');
  }
  $('prop-chips').addEventListener('click', function (e) {
    var c = e.target.closest('.chip'); if (!c) return;
    propFilter = c.getAttribute('data-t'); renderProps();
  });
  $('prop-grid').addEventListener('click', function (e) {
    var b = e.target.closest('.prop-nav'); if (!b) return;
    var box = b.closest('.prop-img'), p = props[+b.closest('.prop').getAttribute('data-i')];
    var photos = (Array.isArray(p.photos) ? p.photos : [p.photos]).map(src).filter(Boolean);
    var n = (+box.getAttribute('data-n') + (b.classList.contains('next') ? 1 : photos.length - 1)) % photos.length;
    box.setAttribute('data-n', n);
    box.querySelector('img').src = photos[n];
    box.querySelector('.prop-count').textContent = (n + 1) + ' / ' + photos.length;
  });
  function showView(isProps) {
    $('propview').hidden = !isProps; $('mapview').hidden = isProps;
    $('lead-props').hidden = !isProps; $('lead-map').hidden = isProps;
    document.querySelector('.page-hero h1').textContent = isProps ? 'Properties with Aggarwal Properties.' : 'Pick your plot on the map.';
  }
  tabs.addEventListener('click', function (e) {
    var b = e.target.closest('.ptab'); if (b) load(b.getAttribute('data-key'));
  });

  function emptyPanel() {
    panel.innerHTML = '<div class="panel-empty">' +
      '<svg viewBox="0 0 80 80" fill="none" aria-hidden="true"><circle cx="40" cy="40" r="38" fill="#FFF4D2"/><path d="M22 28h16v14H22zM42 28h16v14H42zM22 46h16v10H22z" fill="#1FA85A"/><path d="M42 28h16v14H42z" fill="#FFD60A"/><path d="M42 46h16v10H42z" fill="#E5484D"/><path d="M50 50l4 14 3-5 5-1z" fill="#2A1605" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>' +
      '<b>Tap any plot on the map</b>Its area, dimensions, facing and availability show up here, with a one-tap WhatsApp booking button.</div>';
  }

  function renderCounts() {
    var s = AP.stats(current), p = AP.project(current);
    chips.querySelector('[data-f="all"] b').textContent = s.total;
    chips.querySelector('[data-f="avail"] b').textContent = s.available;
    chips.querySelector('[data-f="sold"] b').textContent = s.sold;
    chips.querySelector('[data-f="resale"] b').textContent = s.resale;
    facts.innerHTML =
      '<div class="pfact"><b>' + s.total + '</b><span>Total plots</span></div>' +
      '<div class="pfact g"><b>' + s.available + '</b><span>Available</span></div>' +
      '<div class="pfact y"><b>' + s.resale + '</b><span>For resale</span></div>' +
      '<div class="pfact r"><b>' + s.sold + '</b><span>Sold</span></div>' +
      '<div class="pfact"><b>' + AP.num(s.min) + '&ndash;' + AP.num(s.max) + '</b><span>Plot sizes, sq yd</span></div>';
    title.textContent = p.name + ' — ' + p.type + (p.location ? ', ' + p.location : '');
  }

  function renderList() {
    list.innerHTML = AP.maps[current].plots.map(function (p) {
      var st = AP.status(current, p.id);
      return '<button type="button" class="pl ' + st + (map.sel === p.id ? ' on' : '') +
        '" data-id="' + p.id + '" title="Plot ' + p.n + ' · ' + p.a + ' sq yd · ' + AP.STATUS[st].label + '">' + p.n + '</button>';
    }).join('');
  }
  list.addEventListener('click', function (e) {
    var b = e.target.closest('.pl'); if (!b) return;
    pick(b.getAttribute('data-id'));
    stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  function pick(id) {
    if (map.select(id, false)) { map.focus(id); return true; }
    return false;
  }

  function onSelect(p, key, fromClick) {
    panel.innerHTML = AP.panelHTML(p, key);
    list.querySelectorAll('.pl.on').forEach(function (n) { n.classList.remove('on'); });
    var b = list.querySelector('.pl[data-id="' + (window.CSS && CSS.escape ? CSS.escape(p.id) : p.id) + '"]');
    if (b) b.classList.add('on');
    history.replaceState(null, '', location.pathname + location.search + '#' + key + '/' + encodeURIComponent(p.id));
    if (fromClick && window.matchMedia('(max-width: 1020px)').matches) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function load(key, plotId) {
    if (key === PROPS) {
      current = PROPS;
      showView(true); renderTabs(); renderProps();
      history.replaceState(null, '', location.pathname + location.search + '#' + PROPS);
      return;
    }
    if (!AP.maps[key]) key = keys[0];
    current = key;
    showView(false);
    map.load(key);
    renderTabs(); renderCounts(); renderList(); emptyPanel();
    search.value = '';
    if (plotId && pick(plotId)) return;
    history.replaceState(null, '', location.pathname + location.search + '#' + key);
  }

  /* find a plot by number */
  function find() {
    var q = search.value.trim().toLowerCase().replace(/^plot\s*/, '');
    if (!q) return;
    var hit = AP.maps[current].plots.filter(function (p) { return p.n.toLowerCase() === q || p.id.toLowerCase() === q; })[0];
    search.setCustomValidity(hit ? '' : 'No plot with that number in this project');
    if (hit) pick(hit.id); else search.reportValidity();
  }
  search.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); find(); } });
  search.addEventListener('input', function () {
    search.setCustomValidity('');
    var q = search.value.trim().toLowerCase();
    var hit = q && AP.maps[current].plots.filter(function (p) { return p.n.toLowerCase() === q; })[0];
    if (hit) pick(hit.id);
  });

  chips.addEventListener('click', function (e) {
    var c = e.target.closest('.chip'); if (!c) return;
    chips.querySelectorAll('.chip').forEach(function (n) { n.setAttribute('aria-pressed', n === c ? 'true' : 'false'); });
    map.setFilter(c.getAttribute('data-f'));
  });

  /* Preview mode: projects.html?edit=1 - try out sold/available on the map without saving.
     The real, saved list is edited in the CMS (see admin.html). */
  if (edit) {
    var bar = document.createElement('div');
    bar.className = 'editbar';
    bar.innerHTML = '<div class="wrap"><span>Preview mode &mdash; each click on a plot steps it through available (green) &rarr; sold (red) &rarr; for resale (yellow). This is only a preview: to save, pick the same plots in the <a href="admin.html" style="color:#FFD75A">website editor</a>.</span>' +
      '<button type="button" class="btn btn-sun" id="copy-status">Copy as status.json</button></div>';
    document.querySelector('main').prepend(bar);
    $('copy-status').addEventListener('click', function () {
      var o = {};
      keys.forEach(function (k) { o[k] = AP.listOf(k, 'sold'); o[k + '_resale'] = AP.listOf(k, 'resale'); });
      var text = JSON.stringify(o, null, 2) + '\n';
      var btn = this;
      function done(ok) { btn.textContent = ok ? 'Copied' : 'Copy failed — see console'; if (!ok) console.log(text); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      else done(false);
    });
  }

  var h = decodeURIComponent(location.hash.slice(1)).split('/');
  load(h[0] || keys[0], h[1]);
  window.addEventListener('hashchange', function () {
    var n = decodeURIComponent(location.hash.slice(1)).split('/');
    if (n[0] && n[0] !== current) load(n[0], n[1]);
  });
});
