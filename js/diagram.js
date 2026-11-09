/* Ato 0: diagrama entradas -> análise espacial -> SaniPLAN -> resultados. */
(function () {
  const W = 1000, H = 560;
  const LINKS = [
    ['censo', 'spatial', 'feed'], ['sat', 'spatial', 'feed'], ['ruas', 'spatial', 'feed'],
    ['edif', 'spatial', 'feed'], ['cad', 'spatial', 'feed'],
    ['spatial', 'saniplan', 'flow'], ['custos', 'saniplan', 'flow'], ['censo', 'saniplan', 'base'],
    ['saniplan', 'capex', 'flow'], ['saniplan', 'charts', 'flow'], ['saniplan', 'map', 'flow'], ['saniplan', 'decide', 'flow']
  ];

  function pos(name) {
    const el = document.querySelector(`.dg-node[data-node="${name}"]`);
    return [parseFloat(el.style.getPropertyValue('--x')), parseFloat(el.style.getPropertyValue('--y'))];
  }

  function wires() {
    const svg = document.getElementById('dg-wires');
    svg.innerHTML = LINKS.map(([a, b, cls]) => {
      const [x1, y1] = pos(a), [x2, y2] = pos(b);
      const pad1 = a === 'saniplan' ? 120 : 34, pad2 = b === 'saniplan' ? 120 : b === 'spatial' ? 44 : 34;
      let sx = x1 + pad1, ex = x2 - pad2, sy = y1, ey = y2;
      if (a === 'custos') { sx = x1 + 30; sy = y1 - 10; ex = x2 - 60; ey = y2 + 70; }
      if (cls === 'base') { sx = x1 + 30; sy = y1 - 6; ex = x2 - 70; ey = y2 - 80; }
      const mx = (sx + ex) / 2;
      const d = `M${sx},${sy} C${mx},${sy} ${mx},${ey} ${ex},${ey}`;
      return `<path class="${cls === 'base' ? '' : cls}" d="${d}"/>`;
    }).join('');
  }

  function miniSheet(dm) {
    const pick = ['SANTO DOMINGO ESTE', 'SANTIAGO', 'LA ROMANA', 'HIGÜEY', 'MOCA', 'BANÍ'];
    const rows = pick.map(n => dm.features.find(f => (f.properties.nom_dist || '').toUpperCase() === n)).filter(Boolean);
    const fmt = n => Math.round(n).toLocaleString('es-DO');
    let html = '<span class="h">Distrito</span><span class="h">Pob 2024</span><span class="h">Cob. ALC</span><span class="h">m/conex</span>';
    rows.forEach(f => {
      const p = f.properties;
      const name = p.nom_dist.replace(/\b\w+/g, w => w[0] + w.slice(1).toLowerCase());
      html += `<span>${name}</span><span class="r">${fmt(p.pob24)}</span><span class="in">${Math.round(p.cov_alc * 100)}%</span><span class="in">${(p.m_conex || 0).toFixed(1)}</span>`;
    });
    html += '<span><b>Σ CAPEX</b></span><span></span><span></span><span class="tot">US$ ···</span>';
    document.getElementById('xl-mini').innerHTML = html;
  }

  function miniMap(prov) {
    const el = document.getElementById('ico-rd');
    const bb = [-72.05, 17.45, -68.3, 19.98], k = Math.cos(18.7 * Math.PI / 180);
    const sx = 100 / ((bb[2] - bb[0]) * k), s = sx, h = (bb[3] - bb[1]) * s;
    const P = ([x, y]) => `${((x - bb[0]) * k * s).toFixed(1)},${((bb[3] - y) * s).toFixed(1)}`;
    const ramp = v => `color-mix(in srgb, var(--flow) ${Math.round(25 + 75 * Math.min(1, v / 0.6))}%, var(--ink-3))`;
    const paths = prov.features.filter(f => f.geometry).map(f => {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      const d = polys.map(p => p.map(r => 'M' + r.filter((_, i) => i % 3 === 0).map(P).join('L') + 'Z').join('')).join('');
      return `<path d="${d}" style="fill:${ramp(f.properties.cov_alc || 0)}" stroke="var(--ink)" stroke-width=".4"/>`;
    }).join('');
    el.innerHTML = `<svg viewBox="0 0 100 ${h.toFixed(1)}" aria-hidden="true">${paths}</svg>`;
  }

  /* Explicação de cada ícone: tooltip que acompanha o mouse; no toque, abre perto do ícone. */
  function popover() {
    const pop = document.getElementById('dg-pop');
    document.body.appendChild(pop);  // fora do diagrama: posição fixa relativa à janela
    pop.classList.add('dg-tip');
    const fill = key => {
      const lbl = (I18N.t(`ato0.node.${key}`) || '').replace(/<br\s*\/?>/g, ' ');
      document.getElementById('dg-pop-title').textContent = key === 'saniplan' ? 'SaniPLAN' : lbl;
      document.getElementById('dg-pop-text').textContent = I18N.t(`ato0.detail.${key}`) || '';
      pop.dataset.key = key;
    };
    const place = (x, y) => {
      const w = pop.offsetWidth, h = pop.offsetHeight, m = 12;
      let left = x + 18, top = y + 18;
      if (left + w > innerWidth - m) left = x - w - 18;
      if (top + h > innerHeight - m) top = y - h - 18;
      pop.style.left = `${Math.max(m, left)}px`;
      pop.style.top = `${Math.max(m, top)}px`;
    };
    const hide = () => { pop.hidden = true; document.querySelectorAll('.dg-node.is-open').forEach(x => x.classList.remove('is-open')); };
    document.querySelectorAll('.dg-node').forEach(n => {
      n.addEventListener('pointerenter', e => { if (e.pointerType !== 'mouse') return; fill(n.dataset.node); pop.hidden = false; place(e.clientX, e.clientY); });
      n.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && !pop.hidden) place(e.clientX, e.clientY); });
      n.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
      n.addEventListener('click', e => {
        if (e.pointerType === 'mouse') return;  // no mouse o hover já mostra
        const open = n.classList.contains('is-open');
        hide();
        if (open) return;
        n.classList.add('is-open'); fill(n.dataset.node); pop.hidden = false;
        const r = n.getBoundingClientRect(); place(r.left + r.width / 2, r.top + r.height / 2);
      });
    });
    window.addEventListener('scroll', () => { if (!pop.hidden) hide(); }, { passive: true });
    I18N.onChange(() => { if (!pop.hidden && pop.dataset.key) fill(pop.dataset.key); });
  }

  function setStep(id) {
    document.getElementById('diagram').dataset.focus = id === 'a0-2' ? 'inputs' : 'all';
  }

  async function init() {
    renderIcons();
    wires();
    popover();
    const [dm, prov] = await Promise.all([DATA.get('data/dm.geojson'), DATA.get('data/provincias.geojson')]);
    miniSheet(dm); miniMap(prov);
  }
  window.DIAGRAM = { init, setStep };
})();
