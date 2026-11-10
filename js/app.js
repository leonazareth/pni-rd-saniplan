/* Inicialização: dados, idioma, cenas por rolagem. */
const DATA = (() => {
  const cache = {};
  // os dados levam o mesmo número de versão dos scripts (?v=...), para o navegador não reaproveitar um arquivo antigo
  let v = '';
  try { v = new URL(document.currentScript.src).searchParams.get('v') || ''; } catch (e) { /* sem versão */ }
  const withV = url => (v ? `${url}${url.includes('?') ? '&' : '?'}v=${v}` : url);
  return { get: url => (cache[url] ||= fetch(withV(url)).then(r => r.json())) };
})();

/* Escada de níveis de agregação (ato 1). Nível: 0 construção … 5 país.
   kind: fine | coarse | partial */
const LADDER = [
  ['edif', 0, 'fine'], ['ruas', 0, 'fine'], ['ghs', 1, 'fine'], ['censo', 3, 'fine'],
  ['cad', 2, 'partial'], ['cob', 4, 'coarse'], ['trat', 5, 'coarse'], ['custos', 5, 'coarse']
];
const LADDER_SIZE = [8, 11, 14, 17, 21, 25];  // tamanho do hexágono em cada nível (construção → país)
function renderLadder() {
  const levels = I18N.t('esp.fontes.levels'), areas = I18N.t('esp.fontes.areas') || [];
  // cabeçalho: nome do nível e a área típica de uma unidade
  const head = `<tr><th></th>${levels.map((l, i) => `<th scope="col" data-lv="${i}" tabindex="0">${l}<small>${areas[i] || ''}</small></th>`).join('')}</tr>`;
  const body = LADDER.map(([k, lv, kind]) => {
    // hexágono cheio = nível em que o dado existe; à direita, hexágonos cada vez maiores = agregações possíveis
    const cells = levels.map((_, i) => {
      const cls = kind === 'fine' ? '' : kind, size = `style="--s:${LADDER_SIZE[i]}px"`;
      const dot = i === lv ? `<span class="lv ${cls}" ${size}></span>` : (i > lv && kind !== 'partial' ? `<span class="lv agg ${cls}" ${size}></span>` : '');
      const bar = i >= lv && i < levels.length - 1 && kind !== 'partial' ? '<span class="bar"></span>' : '';
      return `<td data-lv="${i}">${bar}${dot}</td>`;
    }).join('');
    return `<tr><td>${I18N.t(`esp.fontes.rows.${k}`)}</td>${cells}</tr>`;
  }).join('');
  const dir = `<div class="ladder-dir" aria-hidden="true"><span>${I18N.t('esp.fontes.dirFine')}</span><i></i><span>${I18N.t('esp.fontes.dirCoarse')}</span></div>`;
  document.getElementById('ladder').innerHTML = `${dir}<table>${head}${body}</table>`;
}
/* Passar o mouse (ou focar, ou tocar) numa coluna da tabela mostra aquele nível no mapa. */
function ladderLevels() {
  const el = document.getElementById('ladder');
  let pinned = null;
  const set = i => {
    el.querySelectorAll('[data-lv]').forEach(c => c.classList.toggle('is-lv', i !== null && +c.dataset.lv === i));
    MAPSTORY.setLevel(i);
  };
  const lvOf = e => { const c = e.target.closest('[data-lv]'); return c ? +c.dataset.lv : null; };
  el.addEventListener('mouseover', e => { const i = lvOf(e); if (i !== null) set(i); });
  el.addEventListener('mouseleave', () => set(pinned));
  el.addEventListener('focusin', e => { const i = lvOf(e); if (i !== null) set(i); });
  el.addEventListener('focusout', () => set(pinned));
  el.addEventListener('click', e => { const i = lvOf(e); if (i === null) return; pinned = pinned === i ? null : i; set(pinned); });
  I18N.onChange(() => set(pinned));
}

/* Cena ativa = passo que cruza o meio da tela. Calculado na rolagem (e não com
   IntersectionObserver), porque dentro de iframes de outro domínio o navegador
   ignora o rootMargin e as cenas saíam de sincronia com o texto. */
function observeSteps() {
  const handlers = { ato0: id => DIAGRAM.setStep(id), mapstory: id => MAPSTORY.setStep(id) };
  const groups = [...document.querySelectorAll('.scrolly')].map(sec => ({ id: sec.id, steps: [...sec.querySelectorAll('.step')], active: null }));
  const nav = [...document.querySelectorAll('.acts a')];
  const acts = ['intro', 'ato0', 'ato1', 'ato3', 'ato4'].map(id => document.getElementById(id)).filter(Boolean);
  const navOf = { ato0: 'intro' }; // abertura e diagrama formam a "Visão geral"
  let queued = false;

  function update() {
    queued = false;
    const mid = window.innerHeight / 2;
    groups.forEach(g => {
      let hit = g.steps.find(s => { const r = s.getBoundingClientRect(); return r.top <= mid && r.bottom > mid; });
      if (!hit) {  // antes do primeiro / depois do último passo: fica no mais próximo
        const first = g.steps[0].getBoundingClientRect(), last = g.steps[g.steps.length - 1].getBoundingClientRect();
        if (first.top > mid && first.top < window.innerHeight * 1.5) hit = g.steps[0];
        else if (last.bottom <= mid && last.bottom > -window.innerHeight) hit = g.steps[g.steps.length - 1];
      }
      if (hit && hit !== g.active) {
        g.active = hit;
        g.steps.forEach(s => s.classList.toggle('is-active', s === hit));
        handlers[g.id]?.(hit.dataset.step);
      }
    });
    // ato atual na barra superior: o último cujo topo já passou do meio da tela
    let cur = null;
    acts.forEach(el => { if (el.getBoundingClientRect().top <= mid) cur = el.id; });
    nav.forEach(a => a.classList.toggle('on', a.getAttribute('href') === `#${navOf[cur] || cur}`));
  }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
}

/* Botões ‹ › da barra superior: percorrem os "slides" (capa, abertura, cada passo
   das cenas com mapa/diagrama, cada bloco do Ato 3, resultados e créditos). */
function pager() {
  const targets = [...document.querySelectorAll('#capa, #intro .sp-scene, .scrolly .step, #ato3 .sp-head, #ato3 .sp-submod-head, #ato3 .sp-scene, #ato4, .credits')];
  const prev = document.getElementById('pg-prev'), next = document.getElementById('pg-next'), pos = document.getElementById('pg-pos');
  const isStep = el => el.classList.contains('step');
  const topbar = () => document.querySelector('.topbar').offsetHeight;
  // ponto de referência de cada alvo na tela: passos pelo centro, blocos pelo topo
  const refY = el => { const r = el.getBoundingClientRect(); return isStep(el) ? (r.top + r.bottom) / 2 : r.top + 8; };
  function currentIndex() {
    const mid = window.innerHeight / 2, limit = topbar() + window.innerHeight * 0.35;
    let idx = 0;
    targets.forEach((el, i) => { const y = refY(el); if ((isStep(el) ? y <= mid + 40 : y <= limit)) idx = i; });
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) idx = targets.length - 1;
    return idx;
  }
  // cliques seguidos durante a rolagem suave: parte do destino anterior, não da posição atual
  let pending = null, pendingAt = 0;
  const base = () => (pending !== null && performance.now() - pendingAt < 1500) ? pending : currentIndex();
  function goTo(i) {
    i = Math.max(0, Math.min(targets.length - 1, i));
    pending = i; pendingAt = performance.now();
    const el = targets[i];
    const y = window.scrollY + (isStep(el) ? el.getBoundingClientRect().top + el.offsetHeight / 2 - window.innerHeight / 2 : el.getBoundingClientRect().top - topbar());
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }
  function refresh() {
    const i = currentIndex();
    pos.textContent = `${i + 1}/${targets.length}`;
    prev.disabled = i === 0; next.disabled = i === targets.length - 1;
  }
  prev.addEventListener('click', () => goTo(base() - 1));
  next.addEventListener('click', () => goTo(base() + 1));
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, select, textarea, [contenteditable]')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goTo(base() + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goTo(base() - 1); }
  });
  let q = false;
  window.addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(() => { q = false; refresh(); }); } }, { passive: true });
  window.addEventListener('resize', refresh);
  refresh();
}

/* Slide "O que é": as palavras acendem conforme a rolagem; destaques (cor, sublinhado,
   marca-texto) entram quando a rolagem chega neles. */
function revealText() {
  const p = document.querySelector('.in-oque-text'), box = document.querySelector('.in-oque');
  if (!p || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let words = [], marks = [];
  function split() {
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(t => {
        if (!t) return;
        if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(t)); return; }
        const w = document.createElement('span'); w.className = 'w'; w.textContent = t; frag.appendChild(w);
      });
      n.replaceWith(frag);
    });
    words = [...p.querySelectorAll('.w')];
    // cada destaque acende junto com a sua última palavra
    marks = [...p.querySelectorAll('.hl-brand, .hl-line, .hl')].map(m => ({ m, last: words.indexOf([...m.querySelectorAll('.w')].pop()) }));
    p.classList.add('reveal'); box.classList.add('reveal-box');
    update();
  }
  function update() {
    const r = p.getBoundingClientRect(), vh = innerHeight;
    // começa quando o parágrafo entra pela base; termina com o topo dele a 45% da tela
    const t = Math.min(1, Math.max(0, (vh * 0.95 - r.top) / (vh * 0.5)));
    const n = Math.round(t * words.length);
    words.forEach((w, i) => w.classList.toggle('on', i < n));
    marks.forEach(({ m, last }) => m.classList.toggle('on', last < n));
    box.classList.toggle('done', n >= words.length);
  }
  let q = false;
  addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(() => { q = false; update(); }); } }, { passive: true });
  addEventListener('resize', update);
  split();
  I18N.onChange(() => requestAnimationFrame(split));  // texto novo do idioma: reparte em palavras
}

/* Cartões da abertura: entram em sequência (sobem e aparecem) quando a cena chega na tela. */
function revealCards() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const groups = [
    ['#in-faz', '.in-outs > .in-out'],
    ['#in-tipo', '.in-split > .in-half, .in-split > .in-or'],
    ['#in-fatores', '.in-factors > .in-card'],
    ['#in-rd', '.in-rd-stat']
  ].map(([sc, sel]) => {
    const scene = document.querySelector(sc);
    if (!scene) return null;
    scene.classList.add('rv-ready');  // estado inicial das animações só existe com JS
    scene.querySelectorAll(sel).forEach((el, i) => { el.classList.add('rv'); el.style.setProperty('--i', i); });
    return scene;
  }).filter(Boolean);
  function update() {
    const vh = innerHeight;
    groups.forEach(sc => { if (!sc.classList.contains('rv-in') && sc.getBoundingClientRect().top < vh * 0.6) sc.classList.add('rv-in'); });
  }
  let q = false;
  addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(() => { q = false; update(); }); } }, { passive: true });
  update();
}

/* Slide "Na República Dominicana": favo de hexágonos ao lado do nº de hexágonos e
   mapa dos distritos que se desenha (de oeste para leste) ao lado do nº de distritos. */
async function rdViz() {
  const hex = document.getElementById('rd-hex'), map = document.getElementById('rd-map');
  if (!hex || !map) return;
  // mesma projeção e mesmo tamanho nos dois desenhos
  const bb = [-72.05, 17.45, -68.3, 19.98], k = Math.cos(18.7 * Math.PI / 180), s = 200 / ((bb[2] - bb[0]) * k), H = (bb[3] - bb[1]) * s;
  const X = x => (x - bb[0]) * k * s, Y = y => (bb[3] - y) * s;
  const P = ([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`;
  const [dm, prov] = await Promise.all([DATA.get('data/dm.geojson'), DATA.get('data/provincias.geojson')]);

  // hexágonos dentro do contorno do país; ~1/4 laranja (reclassificados), o resto azul
  const rings = [];
  prov.features.forEach(f => {
    if (!f.geometry) return;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    polys.forEach(p => rings.push(p[0].filter((_, i) => i % 3 === 0).map(([x, y]) => [X(x), Y(y)])));
  });
  const inside = (px, py) => rings.some(r => {
    let c = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  });
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const r = 4.6, w = Math.sqrt(3) * r, cells = [], hexAt = [], dmAt = [];
  for (let j = 0; r + j * 1.5 * r < H; j++) for (let i = 0; i * w < 200; i++) {
    const cx = w / 2 + i * w + (j % 2 ? w / 2 : 0), cy = r + j * 1.5 * r;
    if (!inside(cx, cy)) continue;
    const pts = [...Array(6)].map((_, q) => { const a = Math.PI / 180 * (60 * q - 30); return `${(cx + (r - .6) * Math.cos(a)).toFixed(1)},${(cy + (r - .6) * Math.sin(a)).toFixed(1)}`; }).join(' ');
    const hd = rnd() * 2; hexAt.push(.4 + hd + .2);   // mesmo início (.4 s) e mesma duração (2 s) do mapa de distritos
    cells.push(`<polygon class="hx${rnd() < .27 ? ' hx--o' : ''}" style="--d:${hd.toFixed(2)}s" points="${pts}"/>`);
  }
  hex.setAttribute('viewBox', `0 0 200 ${H.toFixed(0)}`);
  hex.innerHTML = cells.join('');

  // contornos dos distritos municipais, desenhados de oeste para leste
  const shapes = dm.features.filter(f => f.geometry).map(f => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    let minx = 999;
    const d = polys.map(p => { const ring = p[0].filter((_, i, a) => i % 2 === 0 || i === a.length - 1); ring.forEach(c => { minx = Math.min(minx, c[0]); }); return 'M' + ring.map(P).join('L') + 'Z'; }).join('');
    return { d, minx };
  });
  const x0 = Math.min(...shapes.map(o => o.minx)), x1 = Math.max(...shapes.map(o => o.minx));
  const paths = shapes.map(({ d, minx }) => {
    const dd = (minx - x0) / (x1 - x0) * 2;   // 0 s no extremo oeste, 2 s no extremo leste
    dmAt.push(.4 + dd + .2);
    return `<path pathLength="1" style="--d:${dd.toFixed(2)}s" d="${d}"/>`;
  }).join('');
  map.setAttribute('viewBox', `0 0 200 ${H.toFixed(0)}`);
  // .dm: contornos que ficam; .burn: a ponta acesa que percorre cada contorno enquanto ele é desenhado
  map.innerHTML = `<g class="dm">${paths}</g><g class="burn">${paths}</g>`;

  // contadores sobem junto com os desenhos (só quando há animação: a cena tem .rv-ready)
  const scene = document.getElementById('in-rd');
  const dts = scene ? [...scene.querySelectorAll('.in-rd-stats dt[data-count]')] : [];
  if (!scene || !scene.classList.contains('rv-ready') || dts.length < 2) return;
  const fmt = v => Math.round(v).toLocaleString(statLocale());
  const tot = dts.map(el => +el.dataset.count);
  // trava a coluna dos números na largura final exata (com fração de pixel): os desenhos não se mexem durante a contagem
  const dl = scene.querySelector('.in-rd-stats');
  const lock = () => { dl.style.gridTemplateColumns = ''; const w = Math.max(...[...dl.children].map(c => c.firstElementChild.getBoundingClientRect().width)); dl.style.gridTemplateColumns = `${w}px minmax(0, 1fr)`; };
  lock();
  dts.forEach(el => { el.dataset.hold = '1'; el.textContent = '0'; });
  function run() {
    const t0 = performance.now();
    let hexShown = 0, last = t0;
    (function tick(now) {
      const t = (now - t0) / 1000, dt = Math.max(0, (now - last) / 1000); last = now;
      const nh = hexAt.filter(x => x <= t).length, nd = dmAt.filter(x => x <= t).length;
      const done = nh === hexAt.length && nd === dmAt.length;
      hexShown += (tot[0] * nh / hexAt.length - hexShown) * (1 - Math.exp(-dt * 9));   // suaviza os saltos entre hexágonos
      dts[0].textContent = fmt(nh === hexAt.length && tot[0] - hexShown < 60 ? tot[0] : hexShown);
      dts[1].textContent = fmt(tot[1] * nd / dmAt.length);
      if (!done) return requestAnimationFrame(tick);
      dts.forEach(el => { delete el.dataset.hold; });
      formatStats();
      dl.style.gridTemplateColumns = '';
    })(t0);
  }
  if (scene.classList.contains('rv-in')) run();
  else { const mo = new MutationObserver(() => { if (scene.classList.contains('rv-in')) { mo.disconnect(); run(); } }); mo.observe(scene, { attributes: true, attributeFilter: ['class'] }); }
}

/* números da capa no formato do idioma */
const statLocale = () => ({ pt: 'pt-BR', es: 'es-DO', en: 'en-US' }[I18N.lang] || 'pt-BR');
function formatStats() {
  const loc = statLocale();
  const suf = { pt: 'mi', es: 'M', en: 'M' }[I18N.lang] || 'mi';
  document.querySelectorAll('.capa-stats [data-count], .in-rd-stats [data-count]').forEach(el => {
    if (el.dataset.hold) return;  // contador em andamento
    const v = +el.dataset.count;
    el.textContent = el.dataset.format === 'mi'
      ? `${(v / 1e6).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${suf}`
      : v.toLocaleString(loc);
  });
}

(async function main() {
  await I18N.set(I18N.initial());
  renderLadder();
  formatStats();
  I18N.onChange(renderLadder);
  ladderLevels();
  I18N.onChange(formatStats);
  revealText();
  revealCards();
  rdViz();
  CAPA.draw();
  DIAGRAM.init();
  MAPSTORY.init();
  RESULTS.init();
  SANIPLAN.init();
  observeSteps();
  pager();
})();
