/* Ato 3 · SaniPLAN: fluxo, projeção de população, custos unitários e simulador.
   Depende dos globais do site: DATA.get, I18N, SaniSim (js/sanisim.js).
   window.SANIPLAN.init() é chamado depois de I18N estar pronto. */
(function () {
  'use strict';
  const SIM_URL = 'data/saniplan_sim.json';
  const HIST_URL = 'data/saniplan_pob_hist.json';
  const BASE_YEAR = 2024;
  const DEFAULT_DMS = ['10320101', '01250101', '08120101', '08110101', '01090101', '05170101']; // SDE, Santiago, La Romana, Higüey, Moca, Baní
  const CHART_DMS = ['10320101', '01250101', '08120101', '08110101', '01090101', '05170101', '08110104', '10320401', '01180101', '09230101'];
  const MAX_ROWS = 8;
  const COLORS = { alc: 'var(--urban)', tar: 'var(--reclass)', flow: 'var(--flow)', lvl: ['#b48ef2', '#5aa9e6', '#46b8a8', '#f2a541'] };

  let data = null, hist = null, byCod = {}, byCod6 = {};
  let T = (k) => (window.I18N ? I18N.t(k) : undefined);
  const t = (k) => { const v = T(k); return v === undefined ? k : v; };
  const $ = (id) => document.getElementById(id);
  const num = (v, d) => (v === undefined || v === null || v === '' || Number.isNaN(+v) ? d : +v);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const locale = () => ({ pt: 'pt-BR', es: 'es-DO', en: 'en-US' }[(window.I18N && I18N.lang) || 'pt'] || 'pt-BR');
  const fmtInt = (v) => (v === null || v === undefined || !isFinite(v)) ? '–' : new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(v);
  const fmtDec = (v, d) => (v === null || v === undefined || !isFinite(v)) ? '–' : new Intl.NumberFormat(locale(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  const fmtPct = (v) => (v === null || v === undefined || !isFinite(v)) ? '–' : Math.round(v * 100) + '%';
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const svgEl = (w, h) => `<svg viewBox="0 0 ${w} ${h}" role="img">`;
  // largura do gráfico segue o contêiner (o texto do SVG mantém ~11 px em qualquer tela)
  const chartW = (wrap, max) => Math.round(Math.min(max || 720, Math.max(320, (wrap && wrap.clientWidth) || 640)));

  /* ---------------------------------------------------------------- lightbox */
  function initLightbox() {
    const box = $('sp-lightbox'), img = $('sp-lightbox-img'), cap = $('sp-lightbox-cap');
    if (!box) return;
    const open = (btn) => { img.src = btn.dataset.full; cap.textContent = t(btn.dataset.cap); box.hidden = false; document.body.style.overflow = 'hidden'; };
    const close = () => { box.hidden = true; img.src = ''; document.body.style.overflow = ''; };
    document.querySelectorAll('#ato3 .sp-thumb').forEach(b => b.addEventListener('click', () => open(b)));
    box.addEventListener('click', e => { if (e.target !== img) close(); });
    $('sp-lightbox-close').addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) close(); });
  }

  /* ---------------------------------------------------------- tabelas (cena 12/13) */
  function renderMatrix() {
    const el = $('sp-matrix'); if (!el) return;
    const head = T('ato3.pob.matrix.head') || [], rows = T('ato3.pob.matrix.rows') || [];
    el.innerHTML = `<thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i >= 5 ? 'sp-wrap' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  }
  function renderRedeTable() {
    const el = $('sp-redetable'); if (!el || !data) return;
    const uc = data.tables.alcUnitCosts.DOM, head = T('ato3.custos.rede.head') || [];
    const idx = { Bajo: 0, Medio: 3, Alto: 5 }, lbl = { Bajo: ['Baixo', 'sp-lo'], Medio: ['Médio', 'sp-mid'], Alto: ['Alto', 'sp-hi'] };
    const rows = Object.keys(idx).map(k => `<tr><td class="${lbl[k][1]}">${lbl[k][0]}</td><td>${fmtDec(uc['Rd.AC'][idx[k]], 2)}</td><td>${fmtDec(uc['Rd.AE'][idx[k]], 2)}</td><td>${fmtDec(uc['Rm.AC'][idx[k]], 2)}</td><td>${fmtDec(uc['Rm.AE'][idx[k]], 2)}</td></tr>`).join('');
    el.innerHTML = `<thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody>`;
  }
  function renderSizeTable() {
    const el = $('sp-sizetable'); if (!el || !data) return;
    const tb = data.tables, head = T('ato3.custos.size.head') || [];
    const counts = {}; data.dms.forEach(d => { counts[d.rng] = (counts[d.rng] || 0) + 1; });
    const lbl = { Bajo: ['Baixo', 'sp-lo'], Medio: ['Médio', 'sp-mid'], Alto: ['Alto', 'sp-hi'] };
    const rows = tb.popRanges.map((r, i) => {
      const dif = tb.alcUnitCosts.DOM.difficulty[i];
      const g = r.max <= 20000 ? 40 : r.max <= 100000 ? 50 : 60;
      const rem = r.max <= 1000 ? '85% / 67%' : r.max <= 5000 ? '85% / 67%' : r.max <= 20000 ? '85–88% / 67–77%' : '88% / 77%';
      const pop = `${fmtInt(i === 0 ? 0 : tb.popRanges[i - 1].max)} – ${fmtInt(r.max)}`;
      return `<tr><td class="sp-em">${r.rng}</td><td>${pop}</td><td class="${lbl[dif][1]}">${lbl[dif][0]}</td><td>${fmtDec(tb.alcUnitCosts.DOM['Rd.AC'][i], 0)}</td><td>${fmtPct(tb.transportFactor[i])}</td><td>${g}</td><td>${rem}</td><td>${counts[r.rng] || 0}</td></tr>`;
    }).join('');
    el.innerHTML = `<thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody>`;
  }

  /* ------------------------------------------------------------ util de gráficos */
  function niceStep(span, n) {
    const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function tooltip(wrap) {
    let tip = wrap.querySelector('.sp-tip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'sp-tip'; tip.hidden = true; wrap.appendChild(tip); }
    return tip;
  }
  // posição do cursor em unidades do viewBox
  function svgPoint(svg, e) {
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return { x: (e.clientX - r.left) / r.width * vb.width, y: (e.clientY - r.top) / r.height * vb.height, px: e.clientX - r.left, py: e.clientY - r.top };
  }

  /* ----------------------------------------------------- cena 12: projeção de população */
  function initPobChart() {
    const sel = $('sp-pob-select'); if (!sel || !data) return;
    sel.innerHTML = CHART_DMS.filter(c => byCod[c]).map(c => `<option value="${c}">${esc(byCod[c].name)} · ${esc(byCod[c].provName)}</option>`).join('');
    sel.addEventListener('change', renderPobChart);
    renderPobChart();
  }
  function renderPobChart() {
    const sel = $('sp-pob-select'), wrap = $('sp-pob-svg'); if (!sel || !wrap) return;
    const dm = byCod[sel.value]; if (!dm) return;
    const h = (hist && hist.dms[dm.codDM6]) || [];
    const census = [[2002, h[0]], [2010, h[1]], [2022, h[2]]].filter(p => num(p[1], null) !== null);
    const proj = dm.pop.slice(0, 17).map((v, i) => [BASE_YEAR + i, num(v, 0)]);
    const W = chartW(wrap), H = Math.round(Math.max(240, W * 0.53)), ml = 52, mr = W < 420 ? 62 : 70, mt = 18, mb = 42;
    const x0 = 2000, x1 = 2042;
    const ymax = Math.max(...census.map(p => p[1]), ...proj.map(p => p[1])) * 1.12 || 1;
    const X = (yr) => ml + (yr - x0) / (x1 - x0) * (W - ml - mr);
    const Y = (v) => mt + (1 - v / ymax) * (H - mt - mb);
    const step = niceStep(ymax, 5);
    let s = svgEl(W, H);
    for (let v = 0; v <= ymax; v += step) {
      s += `<line class="grid" x1="${ml}" x2="${W - mr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tick" x="${ml - 8}" y="${Y(v) + 4}" text-anchor="end">${fmtInt(v / 1000)}</text>`;
    }
    [2002, 2010, 2022, 2030, 2040].forEach(yr => { s += `<text class="tick" x="${X(yr)}" y="${H - mb + 18}" text-anchor="middle">${yr}</text>`; });
    s += `<line class="ax" x1="${ml}" x2="${W - mr}" y1="${H - mb}" y2="${H - mb}"/>`;
    s += `<text class="axlbl" x="${ml}" y="${mt - 6}">${esc(t('ato3.pob.chart.mil'))} ${esc(t('ato3.pob.chart.yAxis'))}</text>`;
    // linha tracejada ligando os censos (2002 -> 2010 -> 2022) e o último censo à base 2024
    if (census.length) { s += `<polyline points="${[...census, proj[0]].map(p => `${X(p[0])},${Y(p[1])}`).join(' ')}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="3 4"/>`; }
    s += `<polyline class="ln" stroke="${COLORS.alc}" points="${proj.map(p => `${X(p[0])},${Y(p[1])}`).join(' ')}"/>`;
    census.forEach(p => { s += `<circle class="dot" cx="${X(p[0])}" cy="${Y(p[1])}" r="5"/>`; });
    const last = proj[proj.length - 1];
    s += `<circle cx="${X(last[0])}" cy="${Y(last[1])}" r="4" fill="${COLORS.alc}"/><text class="lbl" x="${X(last[0]) + 9}" y="${Y(last[1]) + 4}">${fmtInt(last[1])}</text>`;
    s += `<text class="lbl-sm" x="${X(last[0]) + 9}" y="${Y(last[1]) + 18}">${last[0]}</text>`;
    s += `<line class="cross" id="sp-pob-cross" x1="0" x2="0" y1="${mt}" y2="${H - mb}" visibility="hidden"/>`;
    s += `<rect class="hit" x="${ml}" y="${mt}" width="${W - ml - mr}" height="${H - mt - mb}"/></svg>`;
    wrap.innerHTML = s;
    const curve = h[4] ? (hist.methods[h[4]] || h[4]) : '–';
    $('sp-pob-curve').textContent = `${t('ato3.pob.chart.curve')}: ${curve}.`;
    // hover
    const svg = wrap.querySelector('svg'), hit = svg.querySelector('.hit'), cross = svg.querySelector('#sp-pob-cross'), tip = tooltip(wrap);
    const pts = [...census.map(p => ({ yr: p[0], v: p[1], kind: 'census' })), ...proj.map(p => ({ yr: p[0], v: p[1], kind: 'proj' }))];
    hit.addEventListener('mousemove', e => {
      const p = svgPoint(svg, e); const yr = x0 + (p.x - ml) / (W - ml - mr) * (x1 - x0);
      let best = pts[0]; pts.forEach(q => { if (Math.abs(q.yr - yr) < Math.abs(best.yr - yr)) best = q; });
      cross.setAttribute('x1', X(best.yr)); cross.setAttribute('x2', X(best.yr)); cross.setAttribute('visibility', 'visible');
      tip.innerHTML = `<b>${best.yr}</b> · ${fmtInt(best.v)} hab<br>${esc(t(best.kind === 'census' ? 'ato3.pob.chart.census' : 'ato3.pob.chart.proj'))}`;
      const r = svg.getBoundingClientRect(); tip.style.left = `${X(best.yr) / W * r.width}px`; tip.style.top = `${Y(best.v) / H * r.height}px`; tip.hidden = false;
    });
    hit.addEventListener('mouseleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
  }

  /* --------------------------------------------------------- cena 13: curva da ETE */
  let eteMode = 'kg';
  function initEteChart() {
    const box = $('sp-etechart'); if (!box) return;
    box.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      eteMode = b.dataset.mode; box.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderEteChart();
    }));
    renderEteChart();
  }
  function renderEteChart() {
    const wrap = $('sp-ete-svg'); if (!wrap || !data) return;
    const tb = data.tables, G = 50, hab = eteMode === 'hab';
    const levels = [1, 2, 3, 4], names = T('ato3.custos.ete.chart.levels') || ['Avançado', 'Intermediário', 'Básico', 'Primário'];
    const f = (L, code) => SaniSim.ptarCostPerKg(L, code, tb, 1) * (hab ? G / 1000 : 1);
    const W = chartW(wrap), H = Math.round(Math.max(240, W * 0.53)), ml = 56, mr = W < 420 ? 86 : 104, mt = 18, mb = 44;
    const LMIN = 1000, LMAX = 100000; // kg DBO₅/d; eixos lineares
    const ystep = niceStep(f(LMIN, 1), 5), yTop = Math.ceil(f(LMIN, 1) / ystep) * ystep;
    const X = (L) => ml + (L - LMIN) / (LMAX - LMIN) * (W - ml - mr);
    const Y = (v) => mt + (1 - v / yTop) * (H - mt - mb);
    let s = svgEl(W, H);
    for (let v = 0; v <= yTop; v += ystep) {
      s += `<line class="grid" x1="${ml}" x2="${W - mr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tick" x="${ml - 8}" y="${Y(v) + 4}" text-anchor="end">${fmtInt(v)}</text>`;
    }
    const xstep = niceStep(LMAX, 5);
    const xticks = [LMIN]; for (let L = xstep; L <= LMAX; L += xstep) xticks.push(L);
    xticks.forEach(L => { s += `<line class="grid" y1="${mt}" y2="${H - mb}" x1="${X(L)}" x2="${X(L)}"/><text class="tick" x="${X(L)}" y="${H - mb + 18}" text-anchor="middle">${fmtInt(L)}</text>`; });
    s += `<line class="ax" x1="${ml}" x2="${W - mr}" y1="${H - mb}" y2="${H - mb}"/>`;
    s += `<text class="axlbl" x="${ml}" y="${mt - 6}">${esc(t(hab ? 'ato3.custos.ete.chart.yHab' : 'ato3.custos.ete.chart.yKg'))}</text>`;
    s += `<text class="axlbl" x="${W - mr}" y="${H - 6}" text-anchor="end">${esc(t('ato3.custos.ete.chart.x'))}</text>`;
    // amostragem mais densa perto da origem, onde a curva é mais íngreme
    const N = 80, loads = Array.from({ length: N + 1 }, (_, i) => LMIN + (LMAX - LMIN) * Math.pow(i / N, 2));
    const lab = levels.map((code, i) => ({ i, y: Y(f(LMAX, code)) }));
    for (let k = 1; k < lab.length; k++) if (lab[k].y - lab[k - 1].y < 13) lab[k].y = lab[k - 1].y + 13; // evita sobreposição dos rótulos
    levels.forEach((code, i) => {
      s += `<polyline class="ln" stroke="${COLORS.lvl[i]}" points="${loads.map(L => `${X(L)},${Y(f(L, code))}`).join(' ')}"/>`;
      s += `<text class="lbl-sm" x="${W - mr + 8}" y="${lab[i].y + 4}" fill="${COLORS.lvl[i]}">${esc(names[i])}</text>`;
    });
    s += `<line class="cross" id="sp-ete-cross" x1="0" x2="0" y1="${mt}" y2="${H - mb}" visibility="hidden"/>`;
    s += `<rect class="hit" x="${ml}" y="${mt}" width="${W - ml - mr}" height="${H - mt - mb}"/></svg>`;
    wrap.innerHTML = s;
    const svg = wrap.querySelector('svg'), hit = svg.querySelector('.hit'), cross = svg.querySelector('#sp-ete-cross'), tip = tooltip(wrap);
    hit.addEventListener('mousemove', e => {
      const p = svgPoint(svg, e); const L = Math.min(LMAX, Math.max(LMIN, LMIN + (p.x - ml) / (W - ml - mr) * (LMAX - LMIN)));
      cross.setAttribute('x1', p.x); cross.setAttribute('x2', p.x); cross.setAttribute('visibility', 'visible');
      tip.innerHTML = `<b>${fmtInt(L)} kg DBO₅/d</b>` + levels.map((c, i) => `<br><span style="color:${COLORS.lvl[i]}">●</span> ${esc(names[i])}: ${fmtInt(f(L, c))}`).join('');
      const r = svg.getBoundingClientRect(); tip.style.left = `${p.px}px`; tip.style.top = `${Math.max(90, p.py)}px`; tip.hidden = false;
    });
    hit.addEventListener('mouseleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
  }

  /* ------------------------------------------------------------- cena 14: simulador */
  const sim = { rows: [], scen: { sewerType: 'AC', meta: 100, year: 2040 }, chartCod: null };
  function defaultScen() { return { sewerType: data.params.sewerType || 'AC', meta: Math.round(num(data.params.targetAlc, 1) * 100), year: data.params.horizonYear || 2040 }; }
  function makeRow(cod) { const dm = byCod[cod]; return dm ? { cod, ov: {} } : null; }
  function params() {
    const s = sim.scen, meta = Math.min(1, Math.max(0, num(s.meta, 100) / 100));
    return Object.assign({}, data.params, { sewerType: s.sewerType, targetAlc: meta, targetTar: meta, horizonYear: s.year, yearsToTarget: s.year - BASE_YEAR });
  }
  function rowResult(row) {
    const dm = byCod[row.cod];
    const ov = {};
    for (const k in row.ov) { const v = row.ov[k]; if (v !== undefined && v !== null && v !== '') ov[k] = v; }
    return SaniSim.computeDM(Object.assign({}, dm, ov), params(), data.tables);
  }
  function rowValue(row, k) { const dm = byCod[row.cod]; const v = row.ov[k]; return v === undefined || v === null || v === '' ? dm[k] : v; }

  function initSim() {
    if (!$('sp-sheet') || !data) return;
    const ys = $('sp-year'); ys.innerHTML = ''; for (let y = 2030; y <= 2050; y++) ys.insertAdjacentHTML('beforeend', `<option value="${y}">${y}</option>`);
    restore(false);
    $('sp-type').addEventListener('change', e => { sim.scen.sewerType = e.target.value; renderSim(); });
    $('sp-year').addEventListener('change', e => { sim.scen.year = +e.target.value; renderSim(); });
    const metaN = $('sp-meta'), metaR = $('sp-meta-range');
    metaN.addEventListener('change', () => { sim.scen.meta = Math.min(100, Math.max(0, Math.round(num(metaN.value, 100)))); renderSim(); });
    metaR.addEventListener('input', () => { sim.scen.meta = +metaR.value; metaN.value = metaR.value; renderSim(true); });
    $('sp-restore').addEventListener('click', () => restore(true));
    // abas
    document.querySelectorAll('#sp-sheet [role="tab"]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('#sp-sheet [role="tab"]').forEach(x => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-selected', String(on)); });
      document.querySelectorAll('#sp-sheet .sp-tab').forEach(p => { p.hidden = p.dataset.tab !== b.dataset.tab; });
      if (b.dataset.tab === 'result') renderYearChart();
    }));
    // tabela: entradas
    $('sp-xl').addEventListener('change', e => {
      const el = e.target.closest('[data-k]'); if (!el) return;
      const row = sim.rows.find(r => r.cod === el.dataset.cod); if (!row) return;
      const k = el.dataset.k; let v = el.value;
      if (k === 'covAlc0' || k === 'covTar0') v = Math.min(100, Math.max(0, num(v, 0))) / 100;
      else if (k === 'mPerConn') v = Math.max(0, num(v, 0));
      else if (k === 'domPerConn') v = Math.max(0.01, num(v, 1));
      else if (k === 'ptarLevel') v = +v;
      row.ov[k] = v; renderSim();
    });
    $('sp-xl').addEventListener('click', e => {
      const b = e.target.closest('.sp-rm'); if (!b) return;
      sim.rows = sim.rows.filter(r => r.cod !== b.dataset.cod); renderSim();
    });
    $('sp-year-select').addEventListener('change', e => { sim.chartCod = e.target.value; renderYearChart(); });
    initSearch();
    selfCheck();
    renderSim();
  }
  function restore(keepScen) {
    sim.rows = DEFAULT_DMS.map(makeRow).filter(Boolean);
    sim.scen = defaultScen();
    $('sp-type').value = sim.scen.sewerType; $('sp-year').value = String(sim.scen.year); $('sp-meta').value = sim.scen.meta; $('sp-meta-range').value = sim.scen.meta;
    sim.chartCod = sim.rows[0] ? sim.rows[0].cod : null;
    if (keepScen) renderSim();
  }
  function initSearch() {
    const inp = $('sp-search'), list = $('sp-search-list'), msg = $('sp-search-msg');
    let hl = 0, matches = [];
    const close = () => { list.hidden = true; list.innerHTML = ''; matches = []; };
    const add = (cod) => {
      if (sim.rows.length >= MAX_ROWS) { msg.textContent = t('ato3.sim.search.max'); return; }
      if (!sim.rows.some(r => r.cod === cod)) { sim.rows.push(makeRow(cod)); renderSim(); }
      inp.value = ''; close(); msg.textContent = '';
    };
    inp.addEventListener('input', () => {
      const q = norm(inp.value.trim()); msg.textContent = '';
      if (q.length < 2) { close(); return; }
      matches = data.dms.filter(d => norm(d.name).includes(q) || norm(d.provName).includes(q)).slice(0, 8);
      hl = 0;
      if (!matches.length) { list.innerHTML = `<li class="sp-muted">${esc(t('ato3.sim.search.none'))}</li>`; list.hidden = false; return; }
      list.innerHTML = matches.map((d, i) => `<li data-cod="${d.cod8}" class="${i === 0 ? 'is-hl' : ''}">${esc(d.name)}<span>${esc(d.provName)} · ${fmtInt(d.pop[0])}</span></li>`).join('');
      list.hidden = false;
    });
    list.addEventListener('mousedown', e => { const li = e.target.closest('li[data-cod]'); if (li) { e.preventDefault(); add(li.dataset.cod); } });
    inp.addEventListener('keydown', e => {
      if (list.hidden || !matches.length) return;
      if (e.key === 'ArrowDown') { hl = (hl + 1) % matches.length; } else if (e.key === 'ArrowUp') { hl = (hl - 1 + matches.length) % matches.length; }
      else if (e.key === 'Enter') { e.preventDefault(); add(matches[hl].cod8); return; } else if (e.key === 'Escape') { close(); return; } else return;
      e.preventDefault(); [...list.children].forEach((li, i) => li.classList.toggle('is-hl', i === hl));
    });
    inp.addEventListener('blur', () => setTimeout(close, 150));
  }
  function selfCheck() {
    const el = $('sp-check'); if (!el) return;
    try {
      let maxErr = 0;
      data.dms.forEach(dm => {
        if (!dm.out) return;
        const r = SaniSim.computeDM(dm, data.params, data.tables);
        [['capexAlc', r.capexAlc], ['capexTar', r.capexTar], ['capexIsm', r.capexIsm]].forEach(([k, v]) => {
          const ref = num(dm.out[k], 0); if (ref < 1) return;
          maxErr = Math.max(maxErr, Math.max(0, Math.abs(v - ref) - 0.5) / ref); // out.* está arredondado ao inteiro
        });
      });
      const ok = maxErr < 1e-6, err = (maxErr < 1e-9 ? '< 1e-9' : maxErr.toExponential(1)).replace('.', locale() === 'en-US' ? '.' : ',');
      el.textContent = t(ok ? 'ato3.sim.check.ok' : 'ato3.sim.check.bad').replace('{err}', err);
      el.classList.toggle('is-bad', !ok);
    } catch (e) { el.textContent = ''; }
  }

  function renderSim(light) {
    if (!data) return;
    const p = params(), hIdx = Math.max(0, Math.min(30, sim.scen.year - BASE_YEAR));
    $('sp-plazo').textContent = String(p.yearsToTarget);
    const sub = T('ato3.sim.banner'); if (Array.isArray(sub)) $('sp-sheet-sub').innerHTML = sub.map(esc).join('<br>');
    const c = (k) => esc(t('ato3.sim.cols.' + k));
    const lv = T('ato3.sim.levels') || {};
    const head = `<thead>
      <tr><th class="sp-grp" colspan="7">${esc(t('ato3.fluxo.cols.in.title'))}</th><th class="sp-grp" colspan="6">SISTEMA ALCANTARILLADO</th><th class="sp-grp sp-grp--tar" colspan="4">TRATAMIENTO DE AGUAS RESIDUALES</th><th class="sp-grp sp-grp--out" colspan="4">CAPEX</th><th class="sp-grp"></th></tr>
      <tr><th>${c('n')}</th><th>${c('name')}</th><th>${c('pop0')}</th><th>${c('popH')}</th><th>${c('habDom')}</th><th>${c('rng')}</th><th>${c('diff')}</th>
      <th>${c('covAlc')}</th><th>${c('mConn')}</th><th>${c('domConn')}</th><th>${c('costM')}</th><th>${c('fT')}</th><th>${c('costDom')}</th>
      <th>${c('covTar')}</th><th>${c('load')}</th><th>${c('level')}</th><th>${c('costHab')}</th>
      <th>${c('capexAlc')}</th><th>${c('capexTar')}</th><th>${c('capexTot')}</th><th>${c('usdHab')}</th><th></th></tr></thead>`;
    const tot = { pop0: 0, popH: 0, alc: 0, tar: 0, ism: 0, sis: 0, newPop: 0 };
    const results = [];
    const body = sim.rows.map((row, i) => {
      const dm = byCod[row.cod], r = rowResult(row), u = r.unit; results.push({ row, r });
      tot.pop0 += num(dm.pop[0], 0); tot.popH += num(dm.pop[hIdx], 0); tot.alc += r.capexAlc; tot.tar += r.capexTar; tot.ism += r.capexIsm; tot.sis += r.capexSisC + r.capexSisT; tot.newPop += r.newPopAlc;
      const usdHab = r.newPopAlc > 0 ? r.capexRed / r.newPopAlc : null;
      const inp = (k, val, step, min, max) => `<td class="sp-in"><input type="number" data-cod="${row.cod}" data-k="${k}" value="${val}" step="${step}" min="${min}" max="${max}" aria-label="${c(k === 'covAlc0' ? 'covAlc' : k === 'covTar0' ? 'covTar' : k === 'mPerConn' ? 'mConn' : 'domConn')}"></td>`;
      const lvlSel = `<td class="sp-in"><select data-cod="${row.cod}" data-k="ptarLevel" aria-label="${c('level')}">${[1, 2, 3, 4].map(n => `<option value="${n}" ${n === u.ptarLevel ? 'selected' : ''}>${esc(lv[n] || n)}</option>`).join('')}</select></td>`;
      return `<tr>
        <td class="sp-fix">${i + 1}</td><td class="sp-txt sp-name">${esc(dm.name)}<small>${esc(dm.provName)}</small></td>
        <td class="sp-fix">${fmtInt(dm.pop[0])}</td><td class="sp-fix">${fmtInt(dm.pop[hIdx])}</td><td class="sp-fix">${fmtDec(dm.habDom, 2)}</td><td class="sp-fix">${u.rng}</td><td class="sp-fix sp-txt">${esc(u.difficulty)}</td>
        ${inp('covAlc0', Math.round(rowValue(row, 'covAlc0') * 1000) / 10, 1, 0, 100)}
        ${inp('mPerConn', Math.round(rowValue(row, 'mPerConn') * 10) / 10, 0.5, 0, 50)}
        ${inp('domPerConn', Math.round(rowValue(row, 'domPerConn') * 100) / 100, 0.05, 0.5, 6)}
        <td class="sp-fix" title="${esc(t('ato3.sim.cols.costRam'))}: ${fmtInt(u.costRamal)}">${fmtInt(u.costRedM)}</td><td class="sp-fix">${fmtPct(u.transportF)}</td><td class="sp-out">${fmtInt(u.costDom)}</td>
        ${inp('covTar0', Math.round(rowValue(row, 'covTar0') * 1000) / 10, 1, 0, 100)}
        <td class="sp-fix" title="${esc(t('ato3.sim.cols.popRef'))}: ${fmtInt(u.popRefPtar)}">${fmtInt(u.loadKgD)}</td>${lvlSel}<td class="sp-out">${fmtInt(u.tarCostHab)}</td>
        <td class="sp-out">${fmtInt(r.capexAlc)}</td><td class="sp-out">${fmtInt(r.capexTar)}</td><td class="sp-tot">${fmtInt(r.capexRed)}</td><td class="sp-out">${fmtInt(usdHab)}</td>
        <td><button type="button" class="sp-rm" data-cod="${row.cod}" title="${esc(t('ato3.sim.remove'))}" aria-label="${esc(t('ato3.sim.remove'))}">×</button></td></tr>`;
    }).join('');
    const usdHabTot = tot.newPop > 0 ? (tot.alc + tot.tar) / tot.newPop : null;
    const foot = `<tfoot><tr><td></td><td class="sp-txt">${c('sum')}</td><td>${fmtInt(tot.pop0)}</td><td>${fmtInt(tot.popH)}</td><td colspan="13"></td><td>${fmtInt(tot.alc)}</td><td>${fmtInt(tot.tar)}</td><td>${fmtInt(tot.alc + tot.tar)}</td><td>${fmtInt(usdHabTot)}</td><td></td></tr></tfoot>`;
    // preserva o foco quando o slider está em movimento
    const active = document.activeElement;
    if (!(light && active && active.id === 'sp-meta-range')) { /* nada */ }
    $('sp-xl').innerHTML = head + `<tbody>${body}</tbody>` + foot;
    renderCuadro(tot, usdHabTot);
    // seletor do gráfico anual
    const ysel = $('sp-year-select');
    if (!sim.rows.some(r => r.cod === sim.chartCod)) sim.chartCod = sim.rows[0] ? sim.rows[0].cod : null;
    ysel.innerHTML = sim.rows.map(r => `<option value="${r.cod}" ${r.cod === sim.chartCod ? 'selected' : ''}>${esc(byCod[r.cod].name)}</option>`).join('');
    if (!document.querySelector('#sp-sheet .sp-tab[data-tab="result"]').hidden) renderYearChart();
  }
  function renderCuadro(tot, usdHab) {
    const s = sim.scen, k = (x) => esc(t('ato3.sim.cuadro.' + x));
    $('sp-cuadro').innerHTML = `<div class="sp-cuadro-title">${esc(t('ato3.sim.cuadro.title'))}</div><dl>
      <div class="g" style="display:contents"><dt>${k('red')}</dt><dd>${fmtInt(tot.alc + tot.tar)}</dd></div>
      <div class="sub" style="display:contents"><dt>${k('alc')}</dt><dd>${fmtInt(tot.alc)}</dd></div>
      <div class="sub" style="display:contents"><dt>${k('tar')}</dt><dd>${fmtInt(tot.tar)}</dd></div>
      <div class="g" style="display:contents"><dt>${k('insitu')}</dt><dd>${fmtInt(tot.sis)}</dd></div>
      <div class="g" style="display:contents"><dt>${k('ism')}</dt><dd>${fmtInt(tot.ism)}</dd></div>
      <div class="tot" style="display:contents"><dt>${k('total')}</dt><dd>${fmtInt(tot.alc + tot.tar + tot.sis + tot.ism)}</dd></div>
      <div class="sub" style="display:contents"><dt>${k('pop')}</dt><dd>${fmtInt(tot.newPop)}</dd></div>
      <div class="sub" style="display:contents"><dt>${k('usdHab')}</dt><dd>${fmtInt(usdHab)}</dd></div></dl>`;
    const sc = (x) => esc(t('ato3.sim.scen.' + x));
    $('sp-scen-ro').innerHTML = `<div class="sp-scen-title">${sc('title')}</div><dl>
      <dt>${sc('pop')}</dt><dd class="sp-plain">${sc('popV')}</dd>
      <dt>${sc('type')}</dt><dd>${esc(s.sewerType)}</dd>
      <dt>${sc('meta')}</dt><dd>${s.meta}%</dd>
      <dt>${sc('plazo')}</dt><dd>${s.year - BASE_YEAR}</dd>
      <dt>${sc('base')}</dt><dd class="sp-plain">${BASE_YEAR}</dd>
      <dt>${sc('year')}</dt><dd class="sp-plain">${s.year}</dd></dl>`;
  }
  function renderYearChart() {
    const wrap = $('sp-year-svg'); if (!wrap) return;
    const row = sim.rows.find(r => r.cod === sim.chartCod);
    if (!row) { wrap.innerHTML = ''; return; }
    const r = rowResult(row), by = r.byYear, n = by.year.length;
    const W = chartW(wrap, 760), H = Math.round(Math.max(220, W * 0.42)), ml = 48, mr = 12, mt = 16, mb = 40;
    const M = 1e6, tops = by.alc.map((a, i) => (a + by.tar[i]) / M), ymax = Math.max(...tops, 0.001) * 1.1, step = niceStep(ymax, 4);
    const bw = (W - ml - mr) / Math.max(n, 1), X = (i) => ml + i * bw, Y = (v) => mt + (1 - v / ymax) * (H - mt - mb);
    let s = svgEl(W, H);
    for (let v = 0; v <= ymax; v += step) s += `<line class="grid" x1="${ml}" x2="${W - mr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tick" x="${ml - 8}" y="${Y(v) + 4}" text-anchor="end">${fmtDec(v, step < 1 ? 1 : 0)}</text>`;
    s += `<text class="axlbl" x="${ml}" y="${mt - 4}">${esc(t('ato3.sim.chart.y'))}</text>`;
    by.year.forEach((yr, i) => {
      const a = by.alc[i] / M, tt = by.tar[i] / M, x = X(i) + bw * 0.15, w = bw * 0.7;
      s += `<rect x="${x}" y="${Y(a)}" width="${w}" height="${Math.max(0, Y(0) - Y(a))}" fill="${COLORS.alc}"/>`;
      s += `<rect x="${x}" y="${Y(a + tt) - 1}" width="${w}" height="${Math.max(0, Y(a) - Y(a + tt))}" fill="${COLORS.tar}" stroke="#fff" stroke-width="1"/>`;
      if (n <= 16 || i % 2 === 0) s += `<text class="tick" x="${X(i) + bw / 2}" y="${H - mb + 16}" text-anchor="middle">${yr}</text>`;
      s += `<rect class="hit" data-i="${i}" x="${X(i)}" y="${mt}" width="${bw}" height="${H - mt - mb}"/>`;
    });
    s += `<line class="ax" x1="${ml}" x2="${W - mr}" y1="${Y(0)}" y2="${Y(0)}"/></svg>`;
    wrap.innerHTML = s;
    const svg = wrap.querySelector('svg'), tip = tooltip(wrap);
    svg.querySelectorAll('.hit').forEach(h => {
      h.addEventListener('mousemove', e => {
        const i = +h.dataset.i, rct = svg.getBoundingClientRect();
        tip.innerHTML = `<b>${by.year[i]}</b> · ${esc(t('ato3.sim.chart.cov'))} ${fmtPct(by.covAlc[i])}<br>${esc(t('ato3.sim.chart.alc'))}: ${fmtInt(by.alc[i])}<br>${esc(t('ato3.sim.chart.tar'))}: ${fmtInt(by.tar[i])}`;
        tip.style.left = `${(X(i) + bw / 2) / W * rct.width}px`; tip.style.top = `${Y(tops[i]) / H * rct.height}px`; tip.hidden = false;
      });
      h.addEventListener('mouseleave', () => { tip.hidden = true; });
    });
  }

  /* ------------------------------------------------------------------- init */
  function applyPlaceholders() {
    document.querySelectorAll('#ato3 [data-i18n-placeholder]').forEach(el => { const v = T(el.dataset.i18nPlaceholder); if (typeof v === 'string') el.placeholder = v; });
  }
  function renderAll() {
    applyPlaceholders(); renderMatrix(); renderRedeTable(); renderSizeTable(); renderPobChart(); renderEteChart();
    if ($('sp-sheet') && data) { selfCheck(); renderSim(); }
  }
  async function init() {
    if (!document.getElementById('ato3')) return;
    initLightbox();
    applyPlaceholders(); renderMatrix();
    try {
      [data, hist] = await Promise.all([DATA.get(SIM_URL), DATA.get(HIST_URL).catch(() => null)]);
    } catch (e) { console.error('SaniPLAN: dados não carregados', e); return; }
    data.dms.forEach(d => { byCod[d.cod8] = d; byCod6[d.codDM6] = d; });
    renderRedeTable(); renderSizeTable();
    initPobChart(); initEteChart(); initSim();
    if (window.I18N && I18N.onChange) I18N.onChange(renderAll);
    let rt = null;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { renderPobChart(); renderEteChart(); renderYearChart(); }, 150); });
  }
  window.SANIPLAN = { init, get state() { return sim; } };
})();
