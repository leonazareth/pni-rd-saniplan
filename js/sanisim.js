/* SaniSim: réplica em JavaScript da cadeia de cálculo por distrito do SaniPLAN
   ("SanIplan_DOM_Escen 2040_v.20250331_rev1.xlsm"). Sem dependências.
   Validado contra os valores em cache da planilha (393 distritos, cenários
   AC/AE 100% 2040): erro relativo máximo ~1e-15.

   Uso:
     const r = SaniSim.computeDM(dm, params, tables);
   dm      : um elemento de data.dms (entradas fixas + editáveis). Campos editáveis
             por distrito: covAlc0, covTar0, covSisC0, covSisT0, mPerConn, domPerConn,
             habDom, targetAlc, targetTar, sewerType, removalReq (0..1) ou
             ptarLevel (1 Avanzado, 2 Intermedio, 3 Básico, 4 Primario).
   params  : cenário global (data.params): baseYear, horizonYear, yearsToTarget,
             targetAlc, targetTar, targetSisC, targetSisT, sewerType ('AC'|'AE'),
             densification, emisarioEnabled, favelaFactor.
   tables  : data.tables (tabelas de referência exportadas da planilha). */
(function () {
  'use strict';
  const N_YEARS = 30; // a planilha leva os anos 0..30 (2024..2054)

  /** Faixa de população 1..7 (Rng_POB; IFS "<= max"). 0 acima da última faixa. */
  function popRange(pop, ranges) {
    for (const r of ranges) if (pop <= r.max) return r.rng;
    return 0;
  }

  /** Trajetória linear de cobertura, idêntica a %PobAlc!T40 (e %PobTAR, %PobSiS.C, %PobSiS.T). */
  function coveragePath(c0, target, yearsToTarget, baseYear, horizonYear) {
    const cov = new Array(N_YEARS + 1).fill(0);
    cov[0] = c0;
    for (let t = 1; t <= N_YEARS; t++) {
      if (baseYear + t > horizonYear) { cov[t] = 0; continue; }
      if (!yearsToTarget) { cov[t] = 0; continue; } // IFERROR(…/0) -> 0
      const step = (target - c0) / yearsToTarget;
      if (c0 < target) cov[t] = Math.min(target, cov[t - 1] + step);
      else cov[t] = Math.max(target, cov[t - 1] + step); // step <= 0
    }
    return cov;
  }

  const safePow = (x, b) => (x > 0 ? Math.pow(x, b) : 0); // 0^neg no Excel -> erro -> IFERROR 0
  const num = (v, d) => (v === undefined || v === null || Number.isNaN(+v) ? d : +v);

  /** Nível de tratamento automático a partir da remoção requerida (CALC!AG/AJ). */
  function removalRule(P0, coastal) {
    if (!P0) return 0;
    if (coastal === 1) return P0 <= 11001 ? 0.67 : 0.77;
    return P0 <= 11001 ? 0.85 : 0.88;
  }
  function levelFor(removal, levels) { return levels.find(l => removal <= l.maxRemoval) || null; }

  function computeDM(dm, params, tables) {
    const p = params || {};
    const pick = (k) => (dm[k] !== undefined && dm[k] !== null ? dm[k] : p[k]);
    const baseYear = p.baseYear, horizonYear = p.horizonYear;
    const yearsToTarget = p.yearsToTarget ?? (horizonYear - baseYear);
    const targetAlc = num(pick('targetAlc'), 0);
    const targetTar = num(pick('targetTar'), 0);
    const targetSisC = dm.targetSisC ?? p.targetSisC ?? (1 - targetAlc);
    const type = pick('sewerType') || 'AC';
    const dens = num(p.densification, 0);
    const habDom = num(dm.habDom, 0);
    const pop = dm.pop || [];
    const P0 = num(pop[0], 0);                                  // CALC!T = LB!T (população base define faixa e porte da ETE)
    const regCost = dm.metro === 1 ? 'DOM-M' : 'DOM';           // CALC!U
    const regF = tables.regionCostFactor[regCost] ?? 1;          // Costos.PAIS!D59:D60
    const rng = popRange(P0, tables.popRanges);                  // CALC!V
    const uc = tables.alcUnitCosts[regCost];
    const difficulty = rng ? uc.difficulty[rng - 1] : '-';       // CALC!W
    const mPerConn = num(dm.mPerConn, 0), domPerConn = num(dm.domPerConn, 0);
    const covAlc0 = num(dm.covAlc0, 0), covTar0 = num(dm.covTar0, 0);

    // ---------- 1. Custo unitário da rede (CALC!AB..BC, $Dom CostoUnAlc) ----------
    const costRedM = rng ? uc['Rd.' + type][rng - 1] : 0;       // $/m       CALC!AB
    const costRed = mPerConn * costRedM;                         // $/conex   CALC!AC
    const costRamal = rng ? uc['Rm.' + type][rng - 1] : 0;      // $/conex   CALC!AD
    const transportF = rng ? tables.transportFactor[rng - 1] : 0; // CALC!AE
    const fav = 0, formal = 1, adjAlc = 1;                       // AJ_FAVELA / AJ_OTROS (neutros no arquivo RD)
    const ax = (costRed + costRamal) * (p.favelaFactor ?? 1) * fav + (costRed + costRamal) * formal; // CALC!AX
    const ba = ax * adjAlc;                                      // CALC!BA
    const costConn = ba * (1 + transportF);                      // CALC!BC
    const costConnNet = costConn * (1 - dens);                   // $Dom CostoUnAlc!T
    const costDom = domPerConn ? costConnNet / domPerConn : 0;   // $Dom CostoUnAlc!U

    // ---------- 2. Custo unitário do tratamento (CALC!AF..BD, $Hab CostoUnTAR) ----------
    const popRefPtar = P0 * (targetTar - covTar0);               // CALC!AF
    let removal = dm.removalReq;                                 // CALC!AG
    if (removal === undefined || removal === null) removal = removalRule(P0, dm.coastal);
    const g = !P0 ? 0 : P0 <= 20000 ? 40 : P0 <= 100000 ? 50 : P0 <= 20000000 ? 60 : 0; // CALC!AH
    const load = popRefPtar * g / 1000;                          // kg DBO5/d  CALC!AI
    const levels = tables.ptar.levels;                           // $UN_REF_PTAR!B43:E46
    const lvl = dm.ptarLevel ? levels.find(l => l.code === +dm.ptarLevel) : levelFor(removal, levels);
    const ptarCostPerKg = lvl ? regF * tables.ptar.a * safePow(load, tables.ptar.b) * lvl.factor * tables.ptar.countryFactor : 0; // CALC!AM
    const ptarCostHab = ptarCostPerKg / 1000 * g;                // CALC!AN

    // emissário submarino (CALC!AO..AS)
    const em = tables.emisario;
    const emOn = p.emisarioEnabled ?? em.enabled;
    const popRefEm = (emOn && dm.coastal === 1 && P0 >= em.lengthRule.minPop) ? popRefPtar : 0;      // AO
    const rngEm = (popRefEm === 0 || dm.coastal !== 1) ? 0 : popRange(popRefEm, tables.popRanges);   // AP
    const lenEm = (popRefEm === 0 || dm.coastal !== 1) ? 0
      : (P0 >= 300000 ? em.lengthRule.len_ge300k : (P0 > 100000 && P0 < 300000 ? em.lengthRule.len_100k_300k : 0)) * (emOn ? 1 : 0); // AQ
    const costEmM = lenEm === 0 ? 0 : regF * (popRefEm >= 1e6 ? popRefEm * em.costPerM[6] / 1e6 : (rngEm ? em.costPerM[rngEm - 1] : 0)); // AR
    const emisCostHab = (popRefEm === 0 || rngEm === 0) ? 0 : costEmM * lenEm / popRefEm;          // AS
    const tarCostHab = (ptarCostHab + emisCostHab) * 1 * (1 - dens);   // $Hab CostoUnTAR!S

    // ---------- 3. Cadeia ano a ano ----------
    const covAlc = coveragePath(covAlc0, targetAlc, yearsToTarget, baseYear, horizonYear);
    const covTar = coveragePath(covTar0, targetTar, yearsToTarget, baseYear, horizonYear);
    const hab = (t) => (baseYear + t > horizonYear ? 0 : habDom);  // folha HabDom
    const domAlc = covAlc.map((c, t) => (hab(t) ? num(pop[t], 0) * c / hab(t) : 0)); // DomAlc
    const popTar = covTar.map((c, t) => num(pop[t], 0) * c);                        // PobTAR

    const byYear = { year: [], pop: [], covAlc: [], covTar: [], newDomAlc: [], newPopAlc: [], newPopTar: [], alc: [], tar: [], ism: [], sisC: [], sisT: [] };
    const ism = tables.ism;
    const ismUnit = ism.mix.reduce((s, m, i) => s + m * ((ism.unitCost[regCost] || [])[i] || 0), 0);   // CALC!BO
    const ins = tables.insitu;
    const sisCUnit = ins.mix.reduce((s, m, i) => s + m * ((ins.unitCost[regCost] || [])[i] || 0), 0); // CALC!BY
    // NOTA: %PobSiS.T!AX lê LB!AA (meta SiS.C) na planilha; replicado aqui.
    const covSisC = coveragePath(num(dm.covSisC0, 0), targetSisC, yearsToTarget, baseYear, horizonYear);
    const covSisT = coveragePath(num(dm.covSisT0, 0), targetSisC, yearsToTarget, baseYear, horizonYear);
    const domSisC = covSisC.map((c, t) => (hab(t) ? num(pop[t], 0) * c / hab(t) : 0));
    const popSisT = covSisT.map((c, t) => num(pop[t], 0) * c);
    const sisTCostHab = 0; // PTLS: CALC!CD37 = 0 -> sem tipo de PTLS -> custo 0 na planilha

    let capexAlc = 0, capexTar = 0, capexIsm = 0, capexSisC = 0, capexSisT = 0, newPopAlc = 0, newPopTar = 0;
    for (let t = 1; t <= N_YEARS; t++) {
      const dDom = domAlc[t] === 0 ? 0 : domAlc[t] - domAlc[t - 1];          // Dom+Alc
      const aAlc = dDom >= 0 ? dDom * costDom : 0;                              // $CAPEX Alc
      const dPopT = popTar[t] === 0 ? 0 : popTar[t] - popTar[t - 1];           // Pob+TAR
      const aTar = tarCostHab * dPopT >= 0 ? tarCostHab * dPopT : 0;            // $CAPEX TAR
      const dIsm = ism.share * dDom;                                            // Dom+ISM
      const aIsm = dIsm * ismUnit >= 0 ? dIsm * ismUnit : 0;                    // $CAPEX ISM
      const dSisC = domSisC[t] === 0 ? 0 : domSisC[t] - domSisC[t - 1];
      const aSisC = dSisC >= 0 ? dSisC * sisCUnit : 0;
      const dSisT = popSisT[t] === 0 ? 0 : popSisT[t] - popSisT[t - 1];
      const aSisT = sisTCostHab * dSisT >= 0 ? sisTCostHab * dSisT : 0;

      capexAlc += aAlc; capexTar += aTar; capexSisC += aSisC; capexSisT += aSisT;
      if (t <= (ism.sumYears ?? N_YEARS)) capexIsm += aIsm;  // $CAPEX ISM!AX = SUM(T:AC): só os 10 primeiros anos
      const dPopA = dDom * hab(t);
      if (dPopA > 0) newPopAlc += dPopA;
      if (dPopT > 0) newPopTar += dPopT;
      if (baseYear + t <= horizonYear) {
        byYear.year.push(baseYear + t); byYear.pop.push(num(pop[t], 0)); byYear.covAlc.push(covAlc[t]); byYear.covTar.push(covTar[t]);
        byYear.newDomAlc.push(dDom); byYear.newPopAlc.push(dPopA); byYear.newPopTar.push(dPopT);
        byYear.alc.push(aAlc); byYear.tar.push(aTar); byYear.ism.push(aIsm); byYear.sisC.push(aSisC); byYear.sisT.push(aSisT);
      }
    }

    return {
      capexAlc, capexTar, capexRed: capexAlc + capexTar, capexIsm, capexSisC, capexSisT,
      capexTotal: capexAlc + capexTar + capexIsm + capexSisC + capexSisT,
      newPopAlc, newPopTar,
      unit: { regCost, rng, difficulty, costRedM, costRed, costRamal, transportF, costConn, costConnNet, costDom,
              costHabAlc: habDom ? costDom / habDom : 0,
              popRefPtar, removal, bodGpc: g, loadKgD: load, ptarLevel: lvl ? lvl.code : null, ptarType: lvl ? lvl.name : '-',
              ptarCostPerKg, ptarCostHab, emisCostHab, lenEm, tarCostHab, ismUnit, sisCUnit },
      byYear,
    };
  }

  /** Executa todos os distritos e agrega. overrides: { cod8: {campo: valor} } */
  function computeAll(dms, params, tables, overrides) {
    overrides = overrides || {};
    const rows = dms.map(dm => ({ dm, r: computeDM(Object.assign({}, dm, overrides[dm.cod8] || {}), params, tables) }));
    const sum = (k) => rows.reduce((s, x) => s + x.r[k], 0);
    return { rows, total: { capexAlc: sum('capexAlc'), capexTar: sum('capexTar'), capexIsm: sum('capexIsm'), capexRed: sum('capexRed'), capexTotal: sum('capexTotal') } };
  }

  /** Curva de custo da ETE: $/kg DBO5·d em função da carga e do nível (para gráficos). */
  function ptarCostPerKg(loadKgD, levelCode, tables, regF) {
    const lvl = tables.ptar.levels.find(l => l.code === levelCode);
    if (!lvl) return 0;
    return (regF ?? 1) * tables.ptar.a * safePow(loadKgD, tables.ptar.b) * lvl.factor * tables.ptar.countryFactor;
  }

  const api = { computeDM, computeAll, coveragePath, popRange, removalRule, levelFor, ptarCostPerKg, N_YEARS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.SaniSim = api;
})();
