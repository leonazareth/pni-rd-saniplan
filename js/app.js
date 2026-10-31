/* Inicialização: dados, idioma, cenas por rolagem. */
const DATA = (() => {
  const cache = {};
  return { get: url => (cache[url] ||= fetch(url).then(r => r.json())) };
})();

/* Escada de níveis de agregação (ato 1). Nível: 0 construção … 5 país.
   kind: fine | coarse | partial */
const LADDER = [
  ['edif', 0, 'fine'], ['ruas', 0, 'fine'], ['ghs', 1, 'fine'], ['censo', 3, 'fine'],
  ['cad', 2, 'partial'], ['cob', 4, 'coarse'], ['trat', 5, 'coarse'], ['custos', 5, 'coarse']
];
function renderLadder() {
  const levels = I18N.t('ato1.fontes.levels');
  const head = `<tr><th></th>${levels.map(l => `<th scope="col">${l}</th>`).join('')}</tr>`;
  const body = LADDER.map(([k, lv, kind]) => {
    const cells = levels.map((_, i) => {
      const dot = i === lv ? `<span class="lv ${kind === 'fine' ? '' : kind}"></span>` : '';
      const bar = i >= lv && i < levels.length - 1 && kind !== 'partial' ? '<span class="bar"></span>' : '';
      return `<td>${bar}${dot}</td>`;
    }).join('');
    return `<tr><td>${I18N.t(`ato1.fontes.rows.${k}`)}</td>${cells}</tr>`;
  }).join('');
  const dir = `<div class="ladder-dir" aria-hidden="true"><span>${I18N.t('ato1.fontes.dirFine')}</span><i></i><span>${I18N.t('ato1.fontes.dirCoarse')}</span></div>`;
  document.getElementById('ladder').innerHTML = `${dir}<table>${head}${body}</table>`;
}

/* Cena ativa = passo que cruza o meio da tela. Calculado na rolagem (e não com
   IntersectionObserver), porque dentro de iframes de outro domínio o navegador
   ignora o rootMargin e as cenas saíam de sincronia com o texto. */
function observeSteps() {
  const handlers = { ato0: id => DIAGRAM.setStep(id), mapstory: id => MAPSTORY.setStep(id) };
  const groups = [...document.querySelectorAll('.scrolly')].map(sec => ({ id: sec.id, steps: [...sec.querySelectorAll('.step')], active: null }));
  const nav = [...document.querySelectorAll('.acts a')];
  const acts = ['intro', 'ato0', 'ato1', 'ato2', 'ato3', 'ato4'].map(id => document.getElementById(id)).filter(Boolean);
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

(async function main() {
  await I18N.set(I18N.initial());
  renderLadder();
  I18N.onChange(renderLadder);  CAPA.draw();
  DIAGRAM.init();
  MAPSTORY.init();
  RESULTS.init();
  SANIPLAN.init();
  observeSteps();
  pager();
})();
