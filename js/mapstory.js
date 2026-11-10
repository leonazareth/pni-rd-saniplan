/* Dados espaciais: mapa fixo controlado pela rolagem (cenas).
   Todas as camadas ficam carregadas; cada cena só muda a opacidade, então as
   transições são suaves (nada some de repente). Mapas base (Esri cinza escuro e
   imagem de satélite) carregam da internet; as camadas do estudo vêm de data/.
   Sequência da câmera: país → Santo Domingo Este → país. */
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
  const SD_CODE = '1032';
  const YEARS = [2010, 2022]; // extremos da linha do tempo
  const EX = { dense: 352592, sparse: 365908 }; // hexágonos de exemplo em SDE (mesma extensão de rua, nº de construções bem diferente)
  const css = getComputedStyle(document.documentElement);
  const C = n => css.getPropertyValue(`--${n}`).trim();

  const DENS = [0, '#142636', 10, '#1d4466', 40, '#2a6ea8', 100, '#5aa9e6', 200, '#a8d6fb', 320, '#eaf6ff'];
  const rampDens = expr => ['interpolate', ['linear'], expr, ...DENS];
  // viridis: escuro = valor menor, claro = valor maior
  const VIR = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'];
  // uma escala por indicador no mapa de fecho (todas do escuro para o claro)
  const MAGMA = ['#231151', '#721f81', '#cd4071', '#fd9668', '#fcfdbf'];
  const CIVIDIS = ['#00224e', '#434e6c', '#7d7c78', '#bcaf6f', '#fee838'];
  const BLUES = ['#142636', '#1d4466', '#2a6ea8', '#5aa9e6', '#eaf6ff'];
  const TEALS = ['#0d2b2a', '#1b6660', '#2f9e90', '#7fd6c8', '#e3fbf6'];
  const rampOf = (cols, expr, a, b) => ['interpolate', ['linear'], expr, ...cols.flatMap((c, i) => [a + (b - a) * i / (cols.length - 1), c])];
  const rampVir = (expr, a, b) => rampOf(VIR, expr, a, b);
  const NEUTRAL = '#9fb0bd', PALE = '#f2f6f8';

  const OPA = { raster: 'raster-opacity', fill: 'fill-opacity', line: 'line-opacity', circle: 'circle-opacity' };
  const FADE = { duration: 700, delay: 0 };
  let map, ready = false, current = null, timer, swipeVal = 0, lastApplied = null, lastCam = null;
  let view = 'dm';        // cenas de SDE: 'dm' | 'hex' | 'ruas'
  let ind = 'm_conex';    // indicador do mapa de fecho
  let level = null;       // nível destacado pela tabela de fontes (índice da coluna) ou null
  const markers = [];     // { marker, group, el, render }
  const layerType = {};

  const fmtN = (v, d = 0) => v == null || isNaN(v) ? '–' : Number(v).toLocaleString({ pt: 'pt-BR', es: 'es-DO', en: 'en-US' }[I18N.lang] || 'pt-BR', { maximumFractionDigits: d, minimumFractionDigits: d });
  const fmtP = v => v == null ? '–' : `${fmtN(v * 100, 0)}%`;
  const t = k => I18N.t(`map.${k}`);
  const isDesktop = () => window.innerWidth > 760;

  /* Indicadores por distrito (fecho). dom = extremos da escala; origin = nível de origem do dado. */
  const INDS = {
    m_conex: { dom: [6, 20], cols: VIR, fmt: v => `${fmtN(v, 1)} m`, origin: 'hex' },
    dom_conex: { dom: [1, 2.2], cols: MAGMA, fmt: v => fmtN(v, 2), origin: 'hex' },
    hab_per_hogar: { dom: [2.4, 3.6], cols: CIVIDIS, fmt: v => fmtN(v, 2), origin: 'censo' },
    pop_urb_adj: { dom: [500, 1e6], cols: BLUES, log: true, fmt: v => fmtN(v), origin: 'hex' },
    cov_alc: { dom: [0, 0.6], cols: TEALS, fmt: fmtP, origin: 'prov' }
  };
  function indColor(k) {
    const d = INDS[k];
    const x = d.log ? ['log10', ['max', ['to-number', ['get', k], 1], 1]] : ['to-number', ['get', k], 0];
    const [a, b] = d.log ? d.dom.map(Math.log10) : d.dom;
    return ['case', ['==', ['get', k], null], C('ink-3'), rampOf(d.cols, x, a, b)];
  }

  // margem do mapa: à direita da coluna de texto do passo atual
  function pad(id) {
    if (!isDesktop()) return { top: 30, bottom: window.innerHeight * 0.45, left: 10, right: 10 };
    const st = document.querySelector(`.step[data-step="${id}"]`);
    const left = st ? st.getBoundingClientRect().right + 70 : 480;
    return { top: 60, bottom: 50, left, right: 50 };
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
      const [prov, dm, hexrd, sdehex, sdelim, sdeurb, sderur, pais] = await Promise.all(
        ['provincias', 'dm', 'hex_urbanos_rd', 'sde_hex', 'sde_limite', 'sde_urbana_oficial', 'sde_rural', 'pais'].map(n => DATA.get(`data/${n}.geojson`)));
      // hexágonos urbanos do país: geometria real (polígonos). Na escala do país cada hexágono tem menos de 1 pixel,
      // então ali se desenha um ponto no centro de cada um; ao aproximar, os pontos dão lugar aos hexágonos.
      const hexpt = { type: 'FeatureCollection', features: hexrd.features.map(f => {
        const g = f.geometry, c = g.coordinates[0];
        const xy = g.type === 'Point' ? g.coordinates : [(c[0][0] + c[3][0]) / 2, (c[0][1] + c[3][1]) / 2];
        return { type: 'Feature', properties: f.properties, geometry: { type: 'Point', coordinates: xy } };
      }) };
      dm.features.forEach(f => { const p = f.properties; p.dens = p.area_ha ? p.pob_total_one / p.area_ha : 0; });
      const sdePop = sdehex.features.reduce((a, f) => a + (f.properties.pop || 0), 0);
      sdelim.features[0].properties.dens = sdePop / (sdehex.features.length * 10);
      const corners = [[SAT[0][0], SAT[1][1]], [SAT[1][0], SAT[1][1]], [SAT[1][0], SAT[0][1]], [SAT[0][0], SAT[0][1]]];

      map.addSource('prov', { type: 'geojson', data: prov });
      map.addSource('dm', { type: 'geojson', data: dm });
      map.addSource('hexrd', { type: 'geojson', data: hexrd });
      map.addSource('hexpt', { type: 'geojson', data: hexpt });
      map.addSource('pais', { type: 'geojson', data: pais });
      map.addSource('sdehex', { type: 'geojson', data: sdehex });
      map.addSource('sdelim', { type: 'geojson', data: sdelim });
      map.addSource('sdeurb', { type: 'geojson', data: sdeurb });
      map.addSource('sderur', { type: 'geojson', data: sderur });
      map.addSource('sat2010', { type: 'image', url: 'data/sat_sde_2010.jpg', coordinates: corners });
      map.addSource('sat2022', { type: 'image', url: 'data/sat_sde_2022.jpg', coordinates: corners });
      map.addSource('sel', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      const sdProv = ['==', ['get', 'cod_geogra'], SD_CODE];
      const urbHex = ['all', ['!=', ['get', 'cls'], 'rural'], ['>=', ['get', 'edif'], 5]];
      const ptRadius = k => ['interpolate', ['linear'], ['zoom'], 6, 1.1 * k, 8, 1.9 * k, 10, 2.5 * k];
      const clsColor = ['case', ['==', ['get', 'r'], 1], C('reclass'), C('urban')];
      // terra em cinza: aparece mesmo quando o mapa base (tiles) não carrega
      add({ id: 'land', type: 'fill', source: 'pais', paint: { 'fill-color': '#252a30' } });
      add({ id: 'carto', type: 'raster', source: 'carto' });
      add({ id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-saturation': -0.25 } });
      // níveis de agregação (tabela de fontes): província e distrito de exemplo, em tons neutros
      add({ id: 'lvl-prov', type: 'fill', source: 'prov', filter: sdProv, paint: { 'fill-color': NEUTRAL } });
      add({ id: 'dm-dens', type: 'fill', source: 'dm', paint: { 'fill-color': rampDens(['get', 'dens']) } });
      add({ id: 'dm-ind', type: 'fill', source: 'dm', paint: { 'fill-color': indColor(ind) } });
      add({ id: 'dm-line', type: 'line', source: 'dm', paint: { 'line-color': C('ink'), 'line-width': 0.5 } });
      add({ id: 'dm-line-lt', type: 'line', source: 'dm', paint: { 'line-color': NEUTRAL, 'line-width': 0.5 } });
      add({ id: 'prov-line', type: 'line', source: 'prov', paint: { 'line-color': '#4b6276', 'line-width': 0.9 } });
      add({ id: 'prov-line-lt', type: 'line', source: 'prov', paint: { 'line-color': NEUTRAL, 'line-width': 1.1 } });
      add({ id: 'prov-sd', type: 'line', source: 'prov', filter: sdProv, paint: { 'line-color': '#fff', 'line-width': 1.6 } });
      add({ id: 'lvl-dm', type: 'fill', source: 'sdelim', paint: { 'fill-color': PALE } });
      add({ id: 'sat2010', type: 'raster', source: 'sat2010', paint: { 'raster-fade-duration': 0 } });
      add({ id: 'sat2022', type: 'raster', source: 'sat2022', paint: { 'raster-fade-duration': 0 } });
      // satélite de alta resolução por cima da imagem de 2022 (que fica de reserva se os tiles não carregarem)
      add({ id: 'sat-top', type: 'raster', source: 'sat', paint: { 'raster-saturation': -0.25 } });
      add({ id: 'pais-line', type: 'line', source: 'pais', paint: { 'line-color': PALE, 'line-width': 1.6 } });
      add({ id: 'hexrd', type: 'circle', source: 'hexpt', paint: { 'circle-color': clsColor,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, ['interpolate', ['linear'], ['get', 'p'], 0, 0.6, 2000, 1.6], 10, 2.6] } });
      add({ id: 'hexrd-f', type: 'fill', source: 'hexrd', paint: { 'fill-color': clsColor } });
      add({ id: 'hexrd-n', type: 'circle', source: 'hexpt', paint: { 'circle-color': PALE, 'circle-radius': ptRadius(0.75) } });
      add({ id: 'hexrd-nf', type: 'fill', source: 'hexrd', paint: { 'fill-color': PALE } });
      // metros de rua por construção em cada hexágono urbano (só onde há pelo menos 5 construções)
      add({ id: 'hexrd-m', type: 'circle', source: 'hexpt', filter: ['>=', ['get', 'e'], 5], paint: { 'circle-color': rampVir(['get', 'm'], 5, 30), 'circle-radius': ptRadius(1.15) } });
      add({ id: 'hexrd-mf', type: 'fill', source: 'hexrd', filter: ['>=', ['get', 'e'], 5], paint: { 'fill-color': rampVir(['get', 'm'], 5, 30), 'fill-outline-color': 'rgba(11,22,32,.55)' } });
      add({ id: 'sde-agg', type: 'fill', source: 'sdelim', paint: { 'fill-color': rampDens(['get', 'dens']) } });
      add({ id: 'hex-pop', type: 'fill', source: 'sdehex', paint: { 'fill-color': rampDens(['/', ['get', 'pop'], 10]) } });
      add({ id: 'hex-m', type: 'fill', source: 'sdehex', filter: urbHex, paint: { 'fill-color': rampVir(['get', 'm_edif'], 5, 30) } });
      add({ id: 'hex-cls', type: 'fill', source: 'sdehex', paint: { 'fill-color': ['match', ['get', 'cls'], 'oficial', C('urban'), 'reclass', C('reclass'), 'rgba(0,0,0,0)'] } });
      add({ id: 'hex-line', type: 'line', source: 'sdehex', paint: { 'line-color': C('ink'), 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.2, 14, 1] } });
      add({ id: 'hex-reclass-line', type: 'line', source: 'sdehex', filter: ['==', ['get', 'cls'], 'reclass'], paint: { 'line-color': C('reclass'), 'line-width': 1.6 } });
      add({ id: 'hex-two', type: 'line', source: 'sdehex', filter: ['in', ['get', 'id'], ['literal', Object.values(EX)]], paint: { 'line-color': '#fff', 'line-width': 3.5 } });
      add({ id: 'sdeurb-fill', type: 'fill', source: 'sdeurb', paint: { 'fill-color': C('urban') } });
      add({ id: 'sderur-fill', type: 'fill', source: 'sderur', paint: { 'fill-color': C('reclass') } });
      add({ id: 'sdeurb-line', type: 'line', source: 'sdeurb', paint: { 'line-color': C('urban'), 'line-width': 2.6 } });
      add({ id: 'sderur-line', type: 'line', source: 'sderur', paint: { 'line-color': C('reclass'), 'line-width': 2.6 } });
      add({ id: 'sdelim-line', type: 'line', source: 'sdelim', paint: { 'line-color': '#fff', 'line-width': 1.8 } });
      map.addLayer({ id: 'sel-line', type: 'line', source: 'sel', paint: { 'line-color': C('reclass'), 'line-width': 2.5 } });
      map.addLayer({ id: 'sel-pt', type: 'circle', source: 'sel', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 8, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': C('reclass'), 'circle-stroke-width': 2.5 } });

      labelAt([-69.803, 18.489], 'urbanLabel', 'urban');
      labelAt([-69.735, 18.512], 'ruralLabel', 'reclass');
      // os dois cartões abrem para cima, um pouco à direita da haste (o do adensado fica fora do painel de texto e os dois não se cobrem)
      calloutAt(sdehex.features.find(f => f.properties.id === EX.dense), 'hexDense', 'up', '15%');
      calloutAt(sdehex.features.find(f => f.properties.id === EX.sparse), 'hexSparse', 'up', '14%');
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
      if (ready && current === 'd-censo') map.setPaintProperty('sat2022', 'raster-opacity', swipeVal / n);
    };
    tl.addEventListener('input', e => { swipeVal = +e.target.value; setYear(); });
    setYear();
    // visualização em SDE: a rolagem troca sozinha; os botões permitem trocar à mão
    document.getElementById('map-toggle').addEventListener('click', e => {
      const b = e.target.closest('[data-agg]'); if (!b) return;
      setView(b.dataset.agg);
      if (SCENES[current] && SCENES[current].view) apply(current, { keepCamera: true });
    });
    // indicador do mapa de fecho
    document.getElementById('map-indic').addEventListener('click', e => {
      const b = e.target.closest('[data-ind]'); if (!b) return;
      ind = b.dataset.ind;
      document.querySelectorAll('#map-indic [data-ind]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      if (ready) map.setPaintProperty('dm-ind', 'fill-color', indColor(ind));
      closeInfo();
      if (current) legend(current);
    });
    document.getElementById('info-close').addEventListener('click', closeInfo);
    const aria = () => { document.getElementById('map-toggle').setAttribute('aria-label', t('viewGroup')); document.getElementById('map-indic').setAttribute('aria-label', t('indGroup')); };
    aria();
    I18N.onChange(() => { aria(); if (current) legend(current); closeInfo(); markers.forEach(m => m.render()); });
  }

  function setView(v) {
    view = v;
    document.querySelectorAll('#map-toggle [data-agg]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.agg === v)));
  }

  /* ---- rótulos e cartões sobre o mapa ---- */
  // o MapLibre controla a opacidade do elemento do marcador; por isso o conteúdo fica num filho
  function markerAt(lngLat, group, el, render, anchor = 'center') {
    const wrap = document.createElement('div');
    wrap.appendChild(el);
    markers.push({ marker: new maplibregl.Marker({ element: wrap, anchor }).setLngLat(lngLat).addTo(map), group, el, render });
    render();
  }
  function labelAt(lngLat, key, color) {
    const el = document.createElement('span');
    el.className = `map-label map-label--${color}`;
    markerAt(lngLat, 'censo', el, () => { el.textContent = t(key); });
  }
  // miniatura de satélite centrada no hexágono (mosaico de tiles, sem outro mapa), com o contorno por cima
  function thumb(f, size = 208, z = 17, k = 0.5) {
    const ring = f.geometry.coordinates[0], n = 2 ** z;
    const X = lng => (lng + 180) / 360 * n, Y = lat => (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n;
    const pts = ring.slice(0, -1);
    const tx = X(pts.reduce((a, c) => a + c[0], 0) / pts.length), ty = Y(pts.reduce((a, c) => a + c[1], 0) / pts.length);
    const ix = Math.floor(tx), iy = Math.floor(ty), s = 256 * k;
    const url = (src, x, y) => SAT_SOURCES[src].tiles[0].replace('{x}', x).replace('{y}', y).replace('{z}', z);
    const other = SAT_BASEMAP === 'google' ? 'esri' : 'google';
    let imgs = '';
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
      imgs += `<img alt="" referrerpolicy="no-referrer" src="${url(SAT_BASEMAP, ix + dx, iy + dy)}" data-alt="${url(other, ix + dx, iy + dy)}" style="left:${((ix + dx - tx) * s + size / 2).toFixed(1)}px;top:${((iy + dy - ty) * s + size / 2).toFixed(1)}px;width:${s.toFixed(1)}px;height:${s.toFixed(1)}px">`;
    const poly = ring.map(c => `${((X(c[0]) - tx) * s + size / 2).toFixed(1)},${((Y(c[1]) - ty) * s + size / 2).toFixed(1)}`).join(' ');
    return `<div class="cl-thumb" style="width:${size}px;height:${size}px">${imgs}<svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><polygon points="${poly}"/></svg></div>`;
  }
  function calloutAt(f, key, dir = 'up', dx = '0px') {
    if (!f) return;
    const p = f.properties, ring = f.geometry.coordinates[0];
    const tip = ring.reduce((a, c) => ((dir === 'up' ? c[1] > a[1] : c[1] < a[1]) ? c : a));  // vértice de cima ou de baixo do hexágono
    const el = document.createElement('div');
    el.className = 'map-callout';
    el.style.setProperty('--dx', dx);  // desloca o cartão em relação à haste
    let built = false;
    const render = () => {
      if (!built && !el.classList.contains('is-on')) return;  // os tiles da miniatura só carregam quando o cartão aparece
      built = true;
      // miniatura de 166 px, reduzida em telas baixas ou estreitas para os dois cartões caberem
      const size = Math.round(Math.max(110, Math.min(166, (window.innerHeight - 200) * 0.33, window.innerWidth * 0.12)));
      const card = `<div class="cl-card">${thumb(f, size, 17, size / 416)}<div class="cl-txt"><span class="cl-k">${t(key)}</span><span>${fmtN(p.ruas_m)} ${t('ruasM')}</span><span>÷ ${fmtN(p.edif)} ${t('edifN')}</span><strong>${fmtN(p.m_edif, 1)} m <small>${t('porEdif')}</small></strong></div></div>`, stem = '<i class="cl-stem"></i>';
      el.innerHTML = dir === 'up' ? card + stem : stem + card;
    };
    // tile que não carrega: tenta a outra fonte; se também falhar, esconde só a miniatura
    el.addEventListener('error', e => {
      const img = e.target; if (!img.matches || !img.matches('.cl-thumb img')) return;
      if (img.dataset.alt) { const alt = img.dataset.alt; img.removeAttribute('data-alt'); img.src = alt; }
      else img.closest('.cl-thumb').classList.add('is-off');
    }, true);
    markerAt(tip, 'ruas', el, render, dir === 'up' ? 'bottom' : 'top');
  }
  function showLabels(group) {
    markers.forEach(m => { m.el.classList.toggle('is-on', !!group && m.group === group); m.render(); });
  }

  /* ---- cenas: opacidade de cada camada (as não listadas vão a 0) ---- */
  const BASE_RD = { land: 1, carto: 0.55, 'prov-line': 0.8 };
  // cenas aproximadas: satélite + vizinhança (distritos e província) sempre ao fundo
  const BASE_SAT = { sat: 0.95, carto: 0, 'dm-line': 0.45, 'prov-line': 0.6 };
  // tabela de fontes: sem seleção, os níveis aninhados na mesma escala; com um nível destacado, as unidades dele no país todo
  function levelLayers() {
    const base = { land: 1, carto: 0.55 };
    if (level === 5) return { ...base, 'pais-line': 1 };                                   // país: só o contorno
    if (level === 4) return { ...base, 'prov-line-lt': 1, 'lvl-prov': 0.5, 'prov-sd': 1 };
    if (level === 3) return { ...base, 'prov-line': 0.4, 'dm-line-lt': 0.9, 'lvl-dm': 0.95 };
    if (level !== null && level <= 2) return { ...base, 'prov-line': 0.4, 'hexrd-n': 0.95 };
    return { ...base, 'pais-line': 0.7, 'prov-line': 0.5, 'lvl-prov': 0.45, 'prov-sd': 0.9, 'lvl-dm': 0.95, 'sdelim-line': 0.9, 'hexrd-n': 0.28 };
  }
  function sdeLayers() {
    if (view === 'hex') return { ...BASE_SAT, 'prov-sd': 0.5, 'dm-dens': 0.2, 'dm-line': 0.6, 'hex-pop': 0.6, 'hex-line': 0.6, 'sdelim-line': 1 };
    if (view === 'ruas') return { ...BASE_SAT, 'prov-sd': 0.5, 'dm-dens': 0.12, 'dm-line': 0.5, 'hex-m': 0.68, 'hex-line': 0.55, 'hex-two': 1, 'sdelim-line': 1 };
    // o contorno da província e o do distrito vêm da cena anterior (níveis) e continuam durante a aproximação
    return { ...BASE_SAT, 'prov-sd': 0.5, 'dm-dens': 0.35, 'dm-line': 0.7, 'sde-agg': 0.45, 'sdelim-line': 1 };
  }
  // os botões (por distrito / por hexágono) só aparecem nessas duas vistas; ruas ÷ construções é uma cena própria, sem botões
  const sdeScene = v => ({ layers: sdeLayers, bounds: SDE, ui: { toggle: v !== 'ruas' }, interactive: ['hex-pop', 'hex-m'], view: v });
  const SCENES = {
    'ato1': { layers: { ...BASE_RD, hexrd: 0.85 }, bounds: RD },
    'd-fontes': { layers: levelLayers, bounds: RD, wide: true },
    'd-sde-dm': sdeScene('dm'),
    'd-sde-hex': sdeScene('hex'),
    'd-censo': {
      layers: () => ({ ...BASE_SAT, sat: 0.6, sat2010: 1, sat2022: swipeVal / (YEARS[1] - YEARS[0]), 'sdeurb-fill': 0.14, 'sderur-fill': 0.16, 'sdeurb-line': 1, 'sderur-line': 1, 'sdelim-line': 0.9 }),
      bounds: SAT, ui: { swipe: true }, labels: 'censo'
    },
    'd-reclass': { layers: { ...BASE_SAT, sat2022: 1, 'sat-top': 1, 'hex-cls': 0.22, 'hex-line': 0.35, 'hex-reclass-line': 1, 'sdeurb-line': 1, 'sderur-line': 0.5, 'sdelim-line': 0.8 }, bounds: SAT, interactive: ['hex-cls'] },
    'd-sde-ruas': sdeScene('ruas'),
    // resultado para o país: sem mapa base, só os contornos (país, províncias, distritos) e os hexágonos
    'd-media': { layers: { 'pais-line': 0.85, 'prov-line-lt': 0.4, 'dm-line-lt': 0.22, 'hexrd-m': 1 }, bounds: RD, interactive: ['hexrd-m', 'hexrd-mf'] },
    'd-indic': { layers: { ...BASE_RD, 'dm-ind': 0.92, 'dm-line': 0.6 }, bounds: RD, ui: { indic: true }, interactive: ['dm-ind'] }
  };

  // pontos (escala do país) e hexágonos reais (ao aproximar) são um par: a cena define uma opacidade só,
  // e o zoom decide qual dos dois aparece
  const PAIR = { hexrd: 'hexrd-f', 'hexrd-n': 'hexrd-nf', 'hexrd-m': 'hexrd-mf' };
  const PAIRED = new Set(Object.values(PAIR));
  const Z_PT = 9.4, Z_HEX = 10.4;
  function setLayers(spec) {
    const on = typeof spec === 'function' ? spec() : spec;
    Object.keys(layerType).forEach(id => {
      if (PAIRED.has(id)) return;
      const v = on[id] || 0;
      if (PAIR[id]) {
        map.setPaintProperty(id, 'circle-opacity', ['interpolate', ['linear'], ['zoom'], Z_PT, v, Z_HEX, 0]);
        map.setPaintProperty(PAIR[id], 'fill-opacity', ['interpolate', ['linear'], ['zoom'], Z_PT, 0, Z_HEX, v]);
      } else map.setPaintProperty(id, OPA[layerType[id]], v);
    });
  }
  function fly(b, id, duration = 2200) { map.fitBounds(b, { padding: pad(id), duration, essential: true }); }

  function apply(id, { keepCamera = false } = {}) {
    const sc = SCENES[id]; if (!sc) return;
    clearTimeout(timer);
    if (id === 'd-censo' && id !== lastApplied) { swipeVal = 0; document.getElementById('swipe').value = 0; document.getElementById('swipe').dispatchEvent(new Event('input')); }
    if (sc.view && id !== lastApplied) setView(sc.view);
    lastApplied = id;
    document.getElementById('map-sticky').dataset.wide = sc.wide ? '1' : '0';
    setLayers(sc.layers);
    // a câmera só se move quando o enquadramento muda (cenas seguidas no mesmo lugar não "voam" de novo)
    const cam = `${sc.bounds}|${sc.wide ? 1 : 0}`;
    if (!keepCamera && cam !== lastCam) { fly(sc.bounds, id, sc.duration); lastCam = cam; }
    document.getElementById('map-swipe').hidden = !(sc.ui && sc.ui.swipe);
    document.getElementById('map-toggle').hidden = !(sc.ui && sc.ui.toggle);
    document.getElementById('map-indic').hidden = !(sc.ui && sc.ui.indic);
    showLabels(sc.labels || (sc.view && view === 'ruas' ? 'ruas' : null));
    legend(id);
    closeInfo();
  }

  function setStep(id) {
    if (id === current) return;
    current = id;
    if (ready) apply(id);
    else document.getElementById('map-sticky').dataset.wide = SCENES[id] && SCENES[id].wide ? '1' : '0';
  }
  // chamado pela tabela de fontes (app.js) ao passar o mouse ou focar uma coluna
  function setLevel(i) {
    level = i;
    if (ready && current === 'd-fontes') setLayers(SCENES['d-fontes'].layers);
  }

  /* ---- legenda ---- */
  function ramp(title, stops, lo, hi, note) {
    return `<div class="lg-title">${title}</div><div class="ramp" style="background:linear-gradient(90deg,${stops.join(',')})"></div><div class="ramp-lbl"><span>${lo}</span><span>${hi}</span></div>${note ? `<div class="lg-note">${note}</div>` : ''}`;
  }
  const row = (color, label, outline) => `<div class="lg-row"><span class="sw" style="${outline ? `background:none;box-shadow:inset 0 0 0 2px ${color}` : `background:${color}`}"></span>${label}</div>`;
  const densStops = DENS.filter((_, i) => i % 2);
  function legend(id) {
    const el = document.getElementById('map-legend');
    const dens = () => ramp('hab/ha', densStops, '0', '320+');
    const mEdif = () => ramp(t('mEdifLeg'), VIR, `5 · ${t('dense')}`, `30+ · ${t('sparse')}`);
    const sde = () => (view === 'ruas' ? mEdif() : dens());
    const L = {
      'ato1': () => row(C('urban'), t('clsOficial')) + row(C('reclass'), t('clsReclass')),
      'd-media': mEdif,
      'd-fontes': () => `<div class="lg-title">${t('lvlTitle')}</div>` + row(NEUTRAL, t('lvl.pais'), true) + row(NEUTRAL, t('lvl.prov')) + row(PALE, t('lvl.dm')) + `<div class="lg-row"><span class="sw sw--dot" style="background:${PALE}"></span>${t('lvl.hex')}</div>`,
      'd-sde-dm': sde, 'd-sde-hex': sde, 'd-sde-ruas': sde,
      'd-censo': () => row(C('urban'), `${t('clsOficial')} (ONE)`, true) + row(C('reclass'), t('clsRuralOficial'), true),
      'd-reclass': () => row(C('reclass'), t('clsReclass'), true) + row(C('urban'), `${t('clsOficial')} (ONE)`, true),
      'd-indic': () => {
        const d = INDS[ind], u = t(`indUnit.${ind}`);
        const end = v => (ind === 'cov_alc' ? fmtP(v) : fmtN(v, d.dom[1] < 10 ? 1 : 0));
        return ramp(`${t(`ind.${ind}`)}${u ? ` (${u})` : ''}`, d.cols, end(d.dom[0]), `${end(d.dom[1])}+`, t(`origin.${d.origin}`));
      }
    };
    el.innerHTML = L[id] ? L[id]() : '';
    el.hidden = !L[id];
  }

  /* ---- clique e painel de informação ---- */
  function openInfo(title, rows, geom, hl = -1) {
    document.getElementById('info-title').textContent = title;
    document.getElementById('info-body').innerHTML = rows.map(([k, v], i) => `<dt${i === hl ? ' class="hl"' : ''}>${k}</dt><dd${i === hl ? ' class="hl"' : ''}>${v}</dd>`).join('');
    document.getElementById('info').hidden = false;
    map.getSource('sel').setData({ type: 'Feature', geometry: geom, properties: {} });
  }
  function closeInfo() {
    document.getElementById('info').hidden = true;
    if (ready) map.getSource('sel').setData({ type: 'FeatureCollection', features: [] });
  }
  const active = l => (SCENES[current] && SCENES[current].interactive || []).includes(l);
  function bindClicks() {
    const clsName = c => ({ oficial: t('clsOficial'), reclass: t('clsReclass'), rural: t('clsRural') }[c]);
    // hexágono de Santo Domingo Este
    ['hex-pop', 'hex-m', 'hex-cls'].forEach(l => map.on('click', l, e => {
      if (!active(l)) return;
      const p = e.features[0].properties;
      openInfo(`Hex ${p.id}`, [
        [t('cls'), clsName(p.cls)], [t('pop'), fmtN(p.pop)], [t('edif'), fmtN(p.edif)], [t('ruas'), `${fmtN(p.ruas_m)} m`],
        [t('mEdif'), p.edif ? fmtN(p.m_edif, 1) : '–'], [t('habEdif'), p.edif ? fmtN(p.hab_edif, 1) : '–']
      ], e.features[0].geometry);
    }));
    // hexágono urbano do país (ponto na escala do país, polígono ao aproximar)
    ['hexrd-m', 'hexrd-mf'].forEach(l => map.on('click', l, e => {
      if (!active(l)) return;
      const p = e.features[0].properties;
      openInfo(t('hexUrb'), [
        [t('cls'), clsName(p.r ? 'reclass' : 'oficial')], [t('pop'), fmtN(p.p)], [t('edif'), fmtN(p.e)], [t('ruas'), `${fmtN(p.s)} m`], [t('mEdif'), fmtN(p.m, 1)]
      ], e.features[0].geometry, 4);
    }));
    // distrito (fecho): o indicador escolhido vem primeiro, em destaque
    map.on('click', 'dm-ind', e => {
      if (!active('dm-ind')) return;
      const p = e.features[0].properties;
      const order = [ind, ...Object.keys(INDS).filter(k => k !== ind)];
      openInfo(p.nom_dist, [[t('prov'), p.prov || '–'], ...order.map(k => [t(`ind.${k}`), p[k] == null ? '–' : INDS[k].fmt(p[k])])], e.features[0].geometry, 1);
    });
    ['hex-pop', 'hex-m', 'hex-cls', 'hexrd-m', 'hexrd-mf', 'dm-ind'].forEach(l => {
      map.on('mousemove', l, () => { if (active(l)) map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', l, () => { map.getCanvas().style.cursor = ''; });
    });
  }

  window.MAPSTORY = { init, setStep, setLevel };
})();
