/* Atos 1 e 2: mapa fixo controlado pela rolagem (cenas).
   Todas as camadas ficam carregadas; cada cena só muda a opacidade, então as
   transições são suaves (nada some de repente). Mapas base (CARTO escuro e
   imagem de satélite) carregam da internet; as camadas do estudo vêm de data/. */
(function () {
  /* Imagem de satélite para as cenas aproximadas.
     'google' = Google Satellite (tiles públicos, como nos plugins do QGIS)
     'esri'   = Esri World Imagery (alternativa, uso livre com atribuição) */
  const SAT_BASEMAP = 'google';
  const SAT_SOURCES = {
    google: { tiles: ['https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', 'https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', 'https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'], attribution: 'Imagem © Google' },
    esri: { tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], attribution: 'Imagem © Esri, Maxar, Earthstar Geographics' }
  };

  const RD = [[-72.05, 17.45], [-68.3, 19.98]];
  const SDE = [[-69.8965, 18.4546], [-69.7038, 18.5669]];
  const SAT = [[-69.8169, 18.4515], [-69.6951, 18.5321]];
  const SD_PROV = [[-70.2, 18.33], [-69.42, 18.78]];
  const SD_CODE = '1032';
  const RECLASS = [[-69.8124, 18.4597], [-69.7096, 18.5317]]; // área dos hexágonos reclassificados
  const YEARS = [2010, 2022]; // extremos da linha do tempo
  const css = getComputedStyle(document.documentElement);
  const C = n => css.getPropertyValue(`--${n}`).trim();

  const DENS = [0, '#142636', 10, '#1d4466', 40, '#2a6ea8', 100, '#5aa9e6', 200, '#a8d6fb', 320, '#eaf6ff'];
  const rampDens = expr => ['interpolate', ['linear'], expr, ...DENS];
  const TEAL = ['#123230', '#2f8f84', '#bff0e8'];
  const rampTeal = (expr, a, b) => ['interpolate', ['linear'], expr, a, TEAL[0], (a + b) / 2, TEAL[1], b, TEAL[2]];

  const OPA = { raster: 'raster-opacity', fill: 'fill-opacity', line: 'line-opacity', circle: 'circle-opacity' };
  const FADE = { duration: 700, delay: 0 };
  let map, ready = false, current = null, aggMode = 'dm', timer, swipeVal = 0, markers = [], lastApplied = null;
  const layerType = {};

  const fmtN = (v, d = 0) => v == null || isNaN(v) ? '–' : Number(v).toLocaleString({ pt: 'pt-BR', es: 'es-DO', en: 'en-US' }[I18N.lang] || 'pt-BR', { maximumFractionDigits: d, minimumFractionDigits: d });
  const fmtP = v => v == null ? '–' : `${fmtN(v * 100, 0)}%`;
  const t = k => I18N.t(`map.${k}`);
  const isDesktop = () => window.innerWidth > 760;
  function pad() {
    if (!isDesktop()) return { top: 30, bottom: window.innerHeight * 0.45, left: 10, right: 10 };
    const band = document.querySelector('#map-sticky .band').getBoundingClientRect().width;
    return { top: 50, bottom: 50, left: band + 20, right: 50 };
  }

  /* ---- camadas ---- */
  function add(def) {
    const type = def.type;
    layerType[def.id] = type;
    def.paint = { ...(def.paint || {}), [OPA[type]]: 0, [`${OPA[type]}-transition`]: FADE };
    map.addLayer(def);
  }

  function init() {
    const sat = SAT_SOURCES[SAT_BASEMAP];
    map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        sources: {
          carto: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 16, attribution: 'Base © Esri, HERE, Garmin, © OpenStreetMap' },
          sat: { type: 'raster', tiles: sat.tiles, tileSize: 256, maxzoom: 19, attribution: sat.attribution }
        },
        layers: [{ id: 'bg', type: 'background', paint: { 'background-color': C('ink') } }]
      },
      bounds: RD, fitBoundsOptions: { padding: 40 },
      attributionControl: { compact: true },
      scrollZoom: false, dragRotate: false, pitchWithRotate: false
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('error', () => { /* tiles bloqueados (prévia sem internet): segue sem mapa base */ });

    map.on('load', async () => {
      const [prov, dm, hexrd, sdehex, sdelim, sdeurb, sderur] = await Promise.all(
        ['provincias', 'dm', 'hex_urbanos_rd', 'sde_hex', 'sde_limite', 'sde_urbana_oficial', 'sde_rural'].map(n => DATA.get(`data/${n}.geojson`)));
      dm.features.forEach(f => { const p = f.properties; p.dens = p.area_ha ? p.pob_total_one / p.area_ha : 0; });
      const sdePop = sdehex.features.reduce((a, f) => a + (f.properties.pop || 0), 0);
      sdelim.features[0].properties.dens = sdePop / (sdehex.features.length * 10);
      const corners = [[SAT[0][0], SAT[1][1]], [SAT[1][0], SAT[1][1]], [SAT[1][0], SAT[0][1]], [SAT[0][0], SAT[0][1]]];

      map.addSource('prov', { type: 'geojson', data: prov });
      map.addSource('dm', { type: 'geojson', data: dm });
      map.addSource('hexrd', { type: 'geojson', data: hexrd });
      map.addSource('sdehex', { type: 'geojson', data: sdehex });
      map.addSource('sdelim', { type: 'geojson', data: sdelim });
      map.addSource('sdeurb', { type: 'geojson', data: sdeurb });
      map.addSource('sderur', { type: 'geojson', data: sderur });
      map.addSource('sat2010', { type: 'image', url: 'data/sat_sde_2010.jpg', coordinates: corners });
      map.addSource('sat2022', { type: 'image', url: 'data/sat_sde_2022.jpg', coordinates: corners });
      map.addSource('sel', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      const sdProv = ['==', ['get', 'cod_geogra'], SD_CODE];
      const sdDms = ['==', ['slice', ['get', 'cod'], 0, 2], SD_CODE.slice(2)];
      add({ id: 'carto', type: 'raster', source: 'carto' });
      add({ id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-saturation': -0.25 } });
      add({ id: 'prov-fill', type: 'fill', source: 'prov', paint: { 'fill-color': rampTeal(['get', 'cov_alc'], 0, 0.6) } });
      add({ id: 'prov-hl', type: 'fill', source: 'prov', filter: sdProv, paint: { 'fill-color': rampTeal(['get', 'cov_alc'], 0, 0.6) } });
      add({ id: 'dm-dens', type: 'fill', source: 'dm', paint: { 'fill-color': rampDens(['get', 'dens']) } });
      add({ id: 'dm-mconex', type: 'fill', source: 'dm', paint: { 'fill-color': ['case', ['==', ['get', 'm_conex'], null], C('ink-3'), rampTeal(['get', 'm_conex'], 6, 20)] } });
      add({ id: 'dm-cov', type: 'fill', source: 'dm', paint: { 'fill-color': ['case', ['==', ['get', 'cov_alc'], null], C('ink-3'), rampTeal(['get', 'cov_alc'], 0, 0.8)] } });
      add({ id: 'dm-line', type: 'line', source: 'dm', paint: { 'line-color': C('ink'), 'line-width': 0.5 } });
      add({ id: 'dm-line-sd', type: 'line', source: 'dm', filter: sdDms, paint: { 'line-color': '#dfe9ef', 'line-width': 0.8 } });
      add({ id: 'prov-line', type: 'line', source: 'prov', paint: { 'line-color': '#4b6276', 'line-width': 0.9 } });
      add({ id: 'prov-sd', type: 'line', source: 'prov', filter: sdProv, paint: { 'line-color': '#fff', 'line-width': 2.2 } });
      add({ id: 'sat2010', type: 'raster', source: 'sat2010', paint: { 'raster-fade-duration': 0 } });
      add({ id: 'sat2022', type: 'raster', source: 'sat2022', paint: { 'raster-fade-duration': 0 } });
      add({ id: 'hexrd', type: 'circle', source: 'hexrd', paint: {
        'circle-color': ['case', ['==', ['get', 'r'], 1], C('reclass'), C('urban')],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, ['interpolate', ['linear'], ['get', 'p'], 0, 0.6, 2000, 1.6], 10, 4, 13, 12] } });
      add({ id: 'sde-agg', type: 'fill', source: 'sdelim', paint: { 'fill-color': rampDens(['get', 'dens']) } });
      add({ id: 'hex-pop', type: 'fill', source: 'sdehex', paint: { 'fill-color': rampDens(['/', ['get', 'pop'], 10]) } });
      add({ id: 'hex-ghs', type: 'fill', source: 'sdehex', paint: { 'fill-color': ['case',
        ['all', ['get', 'ajustado'], ['<', ['get', 'ghs_adj'], ['get', 'ghs']]], C('alert'),
        ['all', ['get', 'ajustado'], ['>', ['get', 'ghs_adj'], ['get', 'ghs']]], C('urban'),
        'rgba(12,24,34,0.45)'] } });
      add({ id: 'hex-cls', type: 'fill', source: 'sdehex', paint: { 'fill-color': ['match', ['get', 'cls'], 'oficial', C('urban'), 'reclass', C('reclass'), 'rgba(0,0,0,0)'] } });
      add({ id: 'hex-line', type: 'line', source: 'sdehex', paint: { 'line-color': C('ink'), 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.2, 14, 1] } });
      add({ id: 'hex-reclass-line', type: 'line', source: 'sdehex', filter: ['==', ['get', 'cls'], 'reclass'], paint: { 'line-color': C('reclass'), 'line-width': 1.6 } });
      add({ id: 'sdeurb-fill', type: 'fill', source: 'sdeurb', paint: { 'fill-color': C('urban') } });
      add({ id: 'sderur-fill', type: 'fill', source: 'sderur', paint: { 'fill-color': C('reclass') } });
      add({ id: 'sdeurb-line', type: 'line', source: 'sdeurb', paint: { 'line-color': C('urban'), 'line-width': 2.6 } });
      add({ id: 'sderur-line', type: 'line', source: 'sderur', paint: { 'line-color': C('reclass'), 'line-width': 2.6 } });
      add({ id: 'sdelim-line', type: 'line', source: 'sdelim', paint: { 'line-color': '#fff', 'line-width': 1.8 } });
      map.addLayer({ id: 'sel-line', type: 'line', source: 'sel', paint: { 'line-color': C('reclass'), 'line-width': 2.5 } });

      const centroid = fc => { const b = bbox(fc); return [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]; };
      labelAt([-69.803, 18.489], 'urbanLabel', 'urban');
      labelAt([-69.735, 18.512], 'ruralLabel', 'reclass');
      bindClicks();
      ready = true;
      if (current) apply(current);
    });

    const tl = document.getElementById('swipe');
    const ticks = document.getElementById('tl-ticks');
    const n = YEARS[1] - YEARS[0];
    ticks.innerHTML = Array.from({ length: n + 1 }, (_, i) => `<i style="left:${(100 * i / n).toFixed(2)}%" class="${i % 4 === 0 ? 'big' : ''}"></i>`).join('');
    const setYear = () => {
      const y = YEARS[0] + swipeVal;
      const lbl = document.getElementById('tl-year');
      lbl.textContent = y; lbl.style.left = `${100 * swipeVal / n}%`;
      if (ready && current === 'a2-censo') map.setPaintProperty('sat2022', 'raster-opacity', swipeVal / n);
    };
    tl.addEventListener('input', e => { swipeVal = +e.target.value; setYear(); });
    setYear();
    document.getElementById('map-toggle').addEventListener('click', e => {
      const b = e.target.closest('[data-agg]'); if (!b) return;
      aggMode = b.dataset.agg;
      document.querySelectorAll('[data-agg]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      if (current === 'a1-grid') apply('a1-grid', { keepCamera: true });
    });
    document.getElementById('info-close').addEventListener('click', closeInfo);
    I18N.onChange(() => { if (current) legend(current); closeInfo(); markers.forEach(m => { const el = labelEl(m); el.textContent = I18N.t(`map.${el.dataset.key}`); }); });
  }

  function bbox(fc) {
    let w = 180, s = 90, e = -180, n = -90;
    const walk = c => Array.isArray(c[0]) ? c.forEach(walk) : (w = Math.min(w, c[0]), e = Math.max(e, c[0]), s = Math.min(s, c[1]), n = Math.max(n, c[1]));
    fc.features.forEach(f => walk(f.geometry.coordinates));
    return [[w, s], [e, n]];
  }
  function labelAt(lngLat, key, color) {
    // o MapLibre controla a opacidade do elemento do marcador; por isso o rótulo fica num filho
    const wrap = document.createElement('div');
    const el = document.createElement('span');
    el.className = `map-label map-label--${color}`;
    el.dataset.key = key;
    el.textContent = I18N.t(`map.${key}`);
    wrap.appendChild(el);
    markers.push(new maplibregl.Marker({ element: wrap, anchor: 'center' }).setLngLat(lngLat).addTo(map));
  }
  const labelEl = m => m.getElement().firstChild;
  function showLabels(on) { markers.forEach(m => labelEl(m).classList.toggle('is-on', !!on)); }

  /* ---- cenas: opacidade de cada camada (as não listadas vão a 0) ---- */
  const BASE_RD = { carto: 0.55, 'prov-line': 0.8 };
  // cenas aproximadas: satélite + vizinhança (distritos e província) sempre ao fundo
  const BASE_SAT = { sat: 0.95, carto: 0, 'dm-line': 0.45, 'prov-line': 0.6 };
  const SCENES = {
    'ato1': { layers: { ...BASE_RD, hexrd: 0.85 }, bounds: RD },
    'a1-problema': { layers: { ...BASE_RD, 'dm-dens': 0.85, 'dm-line': 0.6 }, bounds: RD },
    'a1-grid': {
      layers: () => aggMode === 'dm'
        ? { ...BASE_SAT, 'dm-dens': 0.35, 'dm-line': 0.7, 'sde-agg': 0.9, 'sdelim-line': 1 }
        : { ...BASE_SAT, 'dm-dens': 0.2, 'dm-line': 0.6, 'hex-pop': 0.85, 'hex-line': 0.6, 'sdelim-line': 1 },
      bounds: SDE, ui: { toggle: true }, interactive: ['hex-pop']
    },
    'a1-fontes': { layers: { ...BASE_RD, 'prov-line': 0.5, hexrd: 0.35 }, bounds: RD, wide: true },
    'ato2': { layers: { ...BASE_RD, hexrd: 0.85 }, bounds: RD },
    'a2-niveis': {
      layers: { ...BASE_RD, 'prov-fill': 0.85, 'prov-hl': 0.9 }, bounds: RD, duration: 1200,
      then: { delay: 1500, layers: { ...BASE_RD, 'prov-fill': 0.22, 'prov-hl': 0.9, 'dm-line-sd': 0.7, 'prov-sd': 1, 'sdelim-line': 1 }, bounds: SD_PROV, duration: 3000 }
    },
    'a2-hex': { layers: { ...BASE_SAT, 'hex-pop': 0.65, 'hex-line': 0.7, 'sdelim-line': 1 }, bounds: SDE, interactive: ['hex-pop'] },
    'a2-ghs': { layers: { ...BASE_SAT, 'hex-ghs': 0.85, 'hex-line': 0.4, 'sdelim-line': 1 }, bounds: SDE, interactive: ['hex-ghs'] },
    'a2-censo': {
      layers: () => ({ ...BASE_SAT, sat: 0.6, sat2010: 1, sat2022: swipeVal / (YEARS[1] - YEARS[0]), 'sdeurb-fill': 0.14, 'sderur-fill': 0.16, 'sdeurb-line': 1, 'sderur-line': 1, 'sdelim-line': 0.9 }),
      bounds: SAT, ui: { swipe: true }, labels: true
    },
    'a2-hexsat': { layers: { ...BASE_SAT, 'hex-cls': 0.22, 'hex-line': 0.35, 'hex-reclass-line': 1, 'sdeurb-line': 1, 'sderur-line': 0.5, 'sdelim-line': 0.8 }, bounds: RECLASS, interactive: ['hex-cls'] },
    'a2-reclass': { layers: { ...BASE_SAT, 'hex-cls': 0.7, 'hex-line': 0.4, 'sdeurb-line': 1, 'sdelim-line': 1 }, bounds: SDE, interactive: ['hex-cls'] },
    'a2-indic': { layers: { ...BASE_RD, 'dm-mconex': 0.9, 'dm-line': 0.6 }, bounds: RD, interactive: ['dm-mconex'] },
    'a2-cobertura': { layers: { ...BASE_RD, 'dm-cov': 0.9, 'dm-line': 0.6 }, bounds: RD, interactive: ['dm-cov'] }
  };

  function setLayers(spec) {
    const on = typeof spec === 'function' ? spec() : spec;
    Object.keys(layerType).forEach(id => map.setPaintProperty(id, OPA[layerType[id]], on[id] || 0));
  }
  function fly(b, duration = 2200) { map.fitBounds(b, { padding: pad(), duration, essential: true }); }

  function apply(id, { keepCamera = false } = {}) {
    const sc = SCENES[id]; if (!sc) return;
    clearTimeout(timer);
    if (id === 'a2-censo' && current !== lastApplied) { swipeVal = 0; document.getElementById('swipe').value = 0; document.getElementById('swipe').dispatchEvent(new Event('input')); }
    lastApplied = id;
    setLayers(sc.layers);
    if (!keepCamera) fly(sc.bounds, sc.duration);
    if (sc.then) timer = setTimeout(() => {
      if (current !== id) return;
      setLayers(sc.then.layers); fly(sc.then.bounds, sc.then.duration);
    }, sc.then.delay);
    document.getElementById('map-swipe').hidden = !(sc.ui && sc.ui.swipe);
    showLabels(sc.labels);
    document.getElementById('map-toggle').hidden = !(sc.ui && sc.ui.toggle);
    document.getElementById('map-sticky').dataset.wide = sc.wide ? '1' : '0';
    legend(id);
    closeInfo();
  }

  function setStep(id) {
    if (id === current) return;
    current = id;
    if (ready) apply(id);
    else document.getElementById('map-sticky').dataset.wide = SCENES[id] && SCENES[id].wide ? '1' : '0';
  }

  /* ---- legenda ---- */
  function ramp(title, stops, lo, hi) {
    return `<div class="lg-title">${title}</div><div class="ramp" style="background:linear-gradient(90deg,${stops.join(',')})"></div><div class="ramp-lbl"><span>${lo}</span><span>${hi}</span></div>`;
  }
  const row = (color, label, outline) => `<div class="lg-row"><span class="sw" style="${outline ? `background:none;box-shadow:inset 0 0 0 2px ${color}` : `background:${color}`}"></span>${label}</div>`;
  const densStops = DENS.filter((_, i) => i % 2);
  function legend(id) {
    const el = document.getElementById('map-legend');
    const hexes = () => row(C('urban'), t('clsOficial')) + row(C('reclass'), t('clsReclass'));
    const L = {
      'ato1': hexes, 'ato2': hexes, 'a1-fontes': hexes, 'a2-reclass': hexes,
      'a1-problema': () => ramp('hab/ha', densStops, '0', '320+'),
      'a1-grid': () => ramp('hab/ha', densStops, '0', '320+'),
      'a2-hex': () => ramp('hab/ha', densStops, '0', '320+'),
      'a2-niveis': () => ramp(t('provCov'), TEAL, '0%', '60%'),
      'a2-ghs': () => row(C('alert'), t('flagPop')) + row(C('urban'), t('flagEdif')),
      'a2-censo': () => row(C('urban'), `${t('clsOficial')} (ONE)`, true) + row(C('reclass'), t('clsRuralOficial'), true),
      'a2-hexsat': () => row(C('reclass'), t('clsReclass'), true) + row(C('urban'), `${t('clsOficial')} (ONE)`, true),
      'a2-indic': () => ramp(`${t('dmMconex')} (m)`, TEAL, '6', '20'),
      'a2-cobertura': () => ramp(t('dmCov'), TEAL, '0%', '80%')
    };
    el.innerHTML = L[id] ? L[id]() : '';
    el.hidden = !L[id];
  }

  /* ---- clique e painel de informação ---- */
  function openInfo(title, rows, geom) {
    document.getElementById('info-title').textContent = title;
    document.getElementById('info-body').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    document.getElementById('info').hidden = false;
    map.getSource('sel').setData({ type: 'Feature', geometry: geom, properties: {} });
  }
  function closeInfo() {
    document.getElementById('info').hidden = true;
    if (ready) map.getSource('sel').setData({ type: 'FeatureCollection', features: [] });
  }
  const active = l => (SCENES[current] && SCENES[current].interactive || []).includes(l);
  function bindClicks() {
    ['hex-pop', 'hex-ghs', 'hex-cls'].forEach(l => map.on('click', l, e => {
      if (!active(l)) return;
      const p = e.features[0].properties;
      const cls = { oficial: t('clsOficial'), reclass: t('clsReclass'), rural: t('clsRural') }[p.cls];
      openInfo(`Hex ${p.id}`, [
        [t('cls'), cls], [t('pop'), fmtN(p.pop)], [t('ghs'), fmtN(p.ghs)], [t('ghsAdj'), fmtN(p.ghs_adj)],
        [t('edif'), fmtN(p.edif)], [t('ruas'), `${fmtN(p.ruas_m)} m`], [t('mEdif'), fmtN(p.m_edif, 1)], [t('habEdif'), fmtN(p.hab_edif, 1)]
      ], e.features[0].geometry);
    }));
    ['dm-mconex', 'dm-cov'].forEach(l => map.on('click', l, e => {
      if (!active(l)) return;
      const p = e.features[0].properties;
      openInfo(p.nom_dist, [
        [t('prov'), p.prov || '–'],
        [t('dmPopOne'), fmtN(p.pob_urbana_one)], [t('dmPop'), fmtN(p.pop_urb_adj)], [t('dmPob40'), fmtN(p.pob40)],
        [t('dmMconex'), `${fmtN(p.m_conex, 1)} m`], [t('dmDomconex'), fmtN(p.dom_conex, 2)], [t('dmCov'), fmtP(p.cov_alc)]
      ], e.features[0].geometry);
    }));
    ['hex-pop', 'hex-ghs', 'hex-cls', 'dm-mconex', 'dm-cov'].forEach(l => {
      map.on('mousemove', l, () => { if (active(l)) map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', l, () => { map.getCanvas().style.cursor = ''; });
    });
  }

  window.MAPSTORY = { init, setStep };
})();
