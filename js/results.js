/* Ato 4: resultados por província (data/resultados.json, exportado de Resultados.xlsx). */
(function () {
  const RD = [[-72.05, 17.45], [-68.3, 19.98]];
  // sequencial legível sobre fundo escuro (roxo → azul → verde → amarelo), 5 classes
  const SEQ = ['#3c2f73', '#2f5d9c', '#2690a0', '#4fb98c', '#d8e45a'];
  const AMBER = SEQ, TEALS = SEQ;
  const state = { meta: '90', tipo: 'AE', indic: 'capex', sel: null, hover: null };
  let map, R, prov, ready = false;

  const lc = () => ({ pt: 'pt-BR', es: 'es-DO', en: 'en-US' }[I18N.lang] || 'pt-BR');
  const n = (v, d = 0) => v == null || isNaN(v) ? '–' : Number(v).toLocaleString(lc(), { maximumFractionDigits: d, minimumFractionDigits: d });
  const usdM = v => `${n(v / 1e6, 0)} ${I18N.t('ato4.u.mi')}`;
  const t = k => I18N.t(`ato4.${k}`);

  /* indicadores: valor por província, formato e paleta */
  const IND = {
    capex: { get: (s, i) => s.capex, fmt: usdM, pal: AMBER },
    capex_hab: { get: (s, i) => s.capex / s.inc_tar, fmt: v => `${n(v)} ${t('u.usdhab')}`, pal: AMBER },
    capex_alc: { get: s => s.capex_alc, fmt: usdM, pal: AMBER },
    capex_tar: { get: s => s.capex_tar, fmt: usdM, pal: AMBER },
    inc_alc: { get: s => s.inc_alc, fmt: v => `${n(v)} hab`, pal: TEALS },
    cov_alc: { get: (s, i) => i.cov_alc, fmt: v => `${n(v * 100)}%`, pal: TEALS },
    cov_tar: { get: (s, i) => i.cov_tar, fmt: v => `${n(v * 100)}%`, pal: TEALS },
    pob24: { get: (s, i) => i.pob24, fmt: v => `${n(v)} hab`, pal: TEALS },
    pob40: { get: (s, i) => i.pob40, fmt: v => `${n(v)} hab`, pal: TEALS },
    n_dm: { get: s => s.n_dm, fmt: v => n(v), pal: TEALS },
    m_conex: { get: (s, i) => i.m_conex, fmt: v => `${n(v, 1)} m`, pal: TEALS }
  };

  const scen = () => R.cenarios[`${state.tipo}${state.meta}`];
  const value = (code, k = state.indic) => IND[k].get(scen().prov[code], R.indicadores[code]);
  const pname = code => (prov.features.find(f => f.properties.cod_geogra === code) || {}).properties?.nice || code;

  function quantiles(vals, k = 5) {
    const s = [...vals].sort((a, b) => a - b);
    return Array.from({ length: k - 1 }, (_, i) => s[Math.floor((i + 1) * s.length / k)]);
  }

  function paint() {
    const codes = Object.keys(scen().prov);
    const vals = codes.map(c => value(c));
    const br = quantiles(vals);
    const pal = IND[state.indic].pal;
    const step = ['step', ['get', 'v'], pal[0]];
    br.forEach((b, i) => step.push(b, pal[i + 1]));
    prov.features.forEach(f => { f.properties.v = value(f.properties.cod_geogra); });
    if (ready) {
      map.getSource('rs').setData(prov);
      map.setPaintProperty('rs-fill', 'fill-color', step);
    }
    // legenda
    const lo = Math.min(...vals), hi = Math.max(...vals), f = IND[state.indic].fmt;
    const edges = [lo, ...br, hi];
    document.getElementById('rs-legend').innerHTML = `<div class="lg-title">${t(`ind.${state.indic}`)}</div>` +
      pal.map((c, i) => `<div class="lg-row"><span class="sw" style="background:${c}"></span>${f(edges[i])} – ${f(edges[i + 1])}</div>`).join('');
  }

  function kpis() {
    const s = scen(), T = s.total;
    const items = [
      ['k.total', usdM(T.capex), true],
      ['k.hab', `${n(T.capex / T.inc_tar)} ${t('u.usdhab')}`],
      ['k.alc', usdM(T.capex_alc)],
      ['k.tar', usdM(T.capex_tar)],
      ['k.pop', `${n(T.inc_tar / 1e6, 2)} ${t('u.mihab')}`]
    ];
    document.getElementById('rs-kpis').innerHTML = items.map(([k, v, big]) =>
      `<div class="kpi${big ? ' kpi--main' : ''}"><span class="kpi-lbl">${t(k)}</span><span class="kpi-val num">${v}</span></div>`).join('') +
      `<p class="kpi-note">${t('k.ism')} ${usdM(s.ism)}.</p>`;
  }

  function rank() {
    const codes = Object.keys(scen().prov).sort((a, b) => value(b) - value(a));
    const max = Math.max(...codes.map(c => value(c)));
    const f = IND[state.indic].fmt;
    document.getElementById('rs-rank').innerHTML = codes.map(c =>
      `<li><button type="button" data-prov="${c}" class="${c === state.sel ? 'on' : ''}">
        <span class="rk-name">${pname(c)}</span><span class="rk-val num">${f(value(c))}</span>
        <span class="rk-bar" style="width:${(100 * value(c) / max).toFixed(1)}%"></span></button></li>`).join('');
  }

  function detail() {
    const el = document.getElementById('rs-detail');
    if (!state.sel) { el.innerHTML = `<p class="rs-hint">${t('hint')}</p>`; return; }
    const c = state.sel, s = scen().prov[c], i = R.indicadores[c];
    const share = s.capex_alc / s.capex;
    const rows = [
      [t('d.reg'), s.reg], [t('d.ndm'), n(s.n_dm)],
      [t('ind.pob24'), n(i.pob24)], [t('ind.pob40'), n(i.pob40)],
      [t('ind.cov_alc'), `${n(i.cov_alc * 100)}%`], [t('ind.cov_tar'), `${n(i.cov_tar * 100)}%`],
      [t('ind.m_conex'), `${n(i.m_conex, 1)} m`], [t('ind.inc_alc'), n(s.inc_alc)],
      [t('ind.capex_hab'), `${n(s.capex / s.inc_tar)} ${t('u.usdhab')}`]
    ];
    el.innerHTML = `<h4>${pname(c)}</h4>
      <p class="rs-capex num">${usdM(s.capex)}</p>
      <div class="rs-split" aria-hidden="true"><span style="width:${(share * 100).toFixed(1)}%"></span></div>
      <p class="rs-split-lbl"><span>${t('k.alc')} ${usdM(s.capex_alc)}</span><span>${t('k.tar')} ${usdM(s.capex_tar)}</span></p>
      <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  }

  function select(code) {
    state.sel = code === state.sel ? null : code;
    if (ready) map.setFilter('rs-sel', ['==', ['get', 'cod_geogra'], state.sel || '']);
    detail(); rank();
  }

  function refresh() { paint(); kpis(); rank(); detail(); }

  function controls() {
    const sel = document.getElementById('rs-indic');
    const fill = () => {
      sel.innerHTML = Object.keys(IND).map(k => `<option value="${k}"${k === state.indic ? ' selected' : ''}>${t(`ind.${k}`)}</option>`).join('');
    };
    fill();
    sel.addEventListener('change', () => { state.indic = sel.value; refresh(); });
    document.querySelector('.rs-controls').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.meta) state.meta = b.dataset.meta;
      if (b.dataset.tipo) state.tipo = b.dataset.tipo;
      document.querySelectorAll('[data-meta]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.meta === state.meta)));
      document.querySelectorAll('[data-tipo]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.tipo === state.tipo)));
      refresh();
    });
    document.getElementById('rs-rank').addEventListener('click', e => { const b = e.target.closest('[data-prov]'); if (b) select(b.dataset.prov); });
    document.getElementById('rs-rank').addEventListener('mouseover', e => {
      const b = e.target.closest('[data-prov]'); if (b && ready) map.setFilter('rs-hover', ['==', ['get', 'cod_geogra'], b.dataset.prov]);
    });
    document.getElementById('rs-rank').addEventListener('mouseleave', () => { if (ready) map.setFilter('rs-hover', ['==', ['get', 'cod_geogra'], '']); });
    I18N.onChange(() => { fill(); refresh(); });
  }

  async function init() {
    [R, prov] = await Promise.all([DATA.get('data/resultados.json'), DATA.get('data/provincias.geojson')]);
    prov = JSON.parse(JSON.stringify(prov));
    prov.features.forEach(f => {
      f.properties.nice = f.properties.name_es.toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\bDe\b/g, 'de');
    });
    controls();
    refresh();

    map = new maplibregl.Map({
      container: 'rs-map',
      style: {
        version: 8,
        sources: { carto: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 16, attribution: 'Base © Esri, HERE, Garmin, © OpenStreetMap' } },
        layers: [{ id: 'bg', type: 'background', paint: { 'background-color': getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() } },
          { id: 'carto', type: 'raster', source: 'carto', paint: { 'raster-opacity': 0.55 } }]
      },
      bounds: RD, fitBoundsOptions: { padding: 24 }, scrollZoom: false, dragRotate: false, attributionControl: { compact: true }
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('error', () => {});
    map.on('load', () => {
      map.addSource('rs', { type: 'geojson', data: prov });
      map.addLayer({ id: 'rs-fill', type: 'fill', source: 'rs', paint: { 'fill-color': SEQ[2], 'fill-opacity': 0.92 } });
      map.addLayer({ id: 'rs-line', type: 'line', source: 'rs', paint: { 'line-color': '#0b1620', 'line-width': 1 } });
      map.addLayer({ id: 'rs-hover', type: 'line', source: 'rs', filter: ['==', ['get', 'cod_geogra'], ''], paint: { 'line-color': '#dfe9ef', 'line-width': 2 } });
      map.addLayer({ id: 'rs-sel', type: 'line', source: 'rs', filter: ['==', ['get', 'cod_geogra'], ''], paint: { 'line-color': '#fff', 'line-width': 3 } });
      ready = true;
      paint();
      map.on('click', 'rs-fill', e => select(e.features[0].properties.cod_geogra));
      map.on('mousemove', 'rs-fill', e => { map.getCanvas().style.cursor = 'pointer'; map.setFilter('rs-hover', ['==', ['get', 'cod_geogra'], e.features[0].properties.cod_geogra]); });
      map.on('mouseleave', 'rs-fill', () => { map.getCanvas().style.cursor = ''; map.setFilter('rs-hover', ['==', ['get', 'cod_geogra'], '']); });
    });
  }

  window.RESULTS = { init };
})();
