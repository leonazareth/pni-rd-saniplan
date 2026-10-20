# SaniPLAN RD: per-DM CAPEX calculation chain

Source: `SanIplan_DOM_Escen 2040_v.20250331_rev1.xlsm`. One row per municipal district (DM): rows 40–432 in every sheet (393 DMs), same row order everywhere. Year columns: `S` = year offset 0 (2024, baseline), `T..AI` = 2025..2040, `AJ..AW` = 2041..2054. Totals are in column `AX`, and the national total is in `AX35`.

Stored scenario: URBANO population only (`LB!I38`), baseline 2024 (`LB!T35`), horizon 2040 (`LB!T36`), target sewer 100% (`LB!Y37`), target treatment 100% (`LB!Z37`), sewer type AC (`CALC!X37`).

Notation for one DM: `t` = year offset 1..30. `Y` = years to target (`LB!AC37` = `T36−T35` = 16). `H` = horizon year.

---

## 0. Inputs per DM

| Symbol | Meaning | Where |
|---|---|---|
| `P[t]` | urban population, t=0..30 | `Pob!S:AW` (S = `LB!T`, rest hard values from the population sub-model) |
| `P0` | baseline population 2024 | `LB!T` (= `CALC!T`) |
| `h` | inhabitants per household | `LB!AD` → `HabDom!AX` (constant over time) |
| `cA0` | baseline sewer coverage | `LB!U` (Censo 2022) |
| `cT0` | baseline treatment coverage | `LB!V` = `50% * LB!U` (hard override in San Pedro de Macorís: 0.90) |
| `cC0`, `cS0` | in-situ safe sanitation / septage treatment baseline | `LB!W`, `LB!X` (X empty → 0) |
| `mA`, `mT` | targets (sewer, treatment) | `LB!Y`, `LB!Z` ← `LB!Y37`, `LB!Z37` |
| `metro` | metropolitan flag | `LB!F` (1 in 16 DMs of Santo Domingo) |
| `coastal` | coastal flag | `LB!G` (57 DMs) |
| `m` | m of sewer network per connection | `CALC!Y` (hard values per DM, 6–20) |
| `k` | households per connection | `CALC!Z` (hard values, 1–2.98) |
| `type` | AC / AE | `CALC!X` ← `CALC!X37` |
| `dens` | share of demand met by densification | `CALC!AA` ← `CALC!AA37` = 10% |

## 1. Coverage path (all four services use the same formula)

Sheets `%PobAlc`, `%PobTAR`, `%PobSiS.C`, `%PobSiS.T`, cell `T40`:

```
c[0] = c0
for t = 1..30:
  if base+t > H:           c[t] = 0                                  # columns after the horizon are zeroed
  elif c0 < meta:          c[t] = min(meta, c[t-1] + (meta-c0)/Y)    # linear rise, capped
  else:                    c[t] = max(meta, c[t-1] - (c0-meta)/Y)    # linear fall, floored
  (Y = 0 → IFERROR → 0)
```

The path is linear in equal steps of `(meta − c0)/Y` and reaches the target in year `Y`. When `Y < H − base` the coverage stays at the target. Target sources: sewer `LB!Y`, treatment `LB!Z`, in-situ containment `LB!AA` (= 1 − Y37), and septage `LB!AA` as well (see issue 3).

## 2. Sewer CAPEX (`$CAPEX Alc`)

```
DomAlc[t]  = P[t]*cA[t] / h                       # DomAlc  (HabDom = 0 after horizon → 0)
dDom[t]    = DomAlc[t]==0 ? 0 : DomAlc[t]-DomAlc[t-1]    # Dom+Alc
CAPEX_A[t] = dDom[t] >= 0 ? dDom[t] * costDom : 0        # $CAPEX Alc!T..AW  (negative increments are ignored)
CAPEX_A    = Σ_t CAPEX_A[t]                              # $CAPEX Alc!AX
```

### Unit cost per household, `costDom` (`CALC` → `$Dom CostoUnAlc!U`)

```
regCost  = metro ? "DOM-M" : "DOM"                     # CALC!U  (Costos.PAIS!C59:C60)
rng      = population range of P0 (baseline!)          # CALC!V, IFS over Rng_POB!B6:D12
           1:≤1,000  2:≤5,000  3:≤20,000  4:≤100,000  5:≤500,000  6:≤1,000,000  7:≤20,000,000
diff     = $UN_REF_ALC!E:K row(regCost)  "BMA_RngP{rng}" # CALC!W
           DOM: rng1-3 Bajo, 4-5 Medio, 6-7 Alto;  DOM-M: always Alto
costRedM = $UN_REF_ALC  "Rd.{type} $m_RngP{rng}"       # $/m   CALC!AB  (table rows 122-123, cols L:Y)
costRed  = m * costRedM                                 # $/conn CALC!AC
costRam  = $UN_REF_ALC  "Rm.{type} $un_RngP{rng}"       # $/conn house branch, CALC!AD (cols Z:AM)
fT       = transport factor by rng                      # CALC!AE ← $UN_REF_ALC!E104:E110
           logistic curve 0.150, 0.150, 0.152, 0.159, 0.199, 0.400, 0.500
AX       = (costRed+costRam)                            # CALC!AW/AX (favela share 0 → formal 100%)
BA       = AX * fAdjAlc (=1, AJ_OTROS)                  # CALC!BA
BC       = BA * (1 + fT)                                # CALC!BC  network + branch + transport (collectors, pumping)
costConn = BC * (1 - dens)                              # $Dom CostoUnAlc!T   (−10% densification)
costDom  = costConn / k                                 # $Dom CostoUnAlc!U
```

Unit costs by difficulty (DOM, USD 2024, `$UN_REF_ALC!L122:AM123`):

| | Rd AC $/m | Rd AE $/m | Rm AC $/conn | Rm AE $/conn |
|---|---|---|---|---|
| Bajo | 208.62 | 160.97 | 354.42 | 267.05 |
| Medio | 236.68 | 178.29 | 378.42 | 291.04 |
| Alto | 261.60 | 204.42 | 403.33 | 315.95 |

These are hard values: Brazilian base costs (`$UN_REF_ALC!E37:P37`, 2022) × 1.07137. The live consolidated factor `E22` = country factor 1.0291 × ENR inflation 1.0434 = 1.07378, so the stored table was pasted with an earlier factor. The regional factor `FactCostoReg` is 1.0 for both DOM and DOM-M. The metro premium comes only from the forced "Alto" difficulty.

## 3. Treatment CAPEX (`$CAPEX TAR`)

```
PobTAR[t]  = P[t]*cT[t]                                   # PobTAR
dPop[t]    = PobTAR[t]==0 ? 0 : PobTAR[t]-PobTAR[t-1]     # Pob+TAR
CAPEX_T[t] = max(0, costHabT * dPop[t])                   # $CAPEX TAR!T..AW
CAPEX_T    = Σ_t CAPEX_T[t]                               # $CAPEX TAR!AX
```

### Unit cost per inhabitant, `costHabT` (`CALC!AF..BD` → `$Hab CostoUnTAR!S`)

```
PopRef  = P0 * (mT - cT0)                       # CALC!AF  (baseline pop × coverage gap; NOT 2040 pop)
rem     = P0==0 ? 0 : coastal ? (P0≤11001 ? .67 : .77) : (P0≤11001 ? .85 : .88)   # CALC!AG required % BOD removal
g       = P0≤20000 ? 40 : P0≤100000 ? 50 : 60    # CALC!AH g BOD5/hab/d
L       = PopRef * g / 1000                      # CALC!AI kg BOD5/d
level   = first row of $UN_REF_PTAR!B43:E46 with rem ≤ maxRemoval     # CALC!AJ/AK
          4 Primario ≤0.50 f=0.25 | 3 Básico ≤0.70 f=0.60 | 2 Intermedio ≤0.90 f=1.00 | 1 Avanzado ≤0.95 f=1.25
          (as stored: 0.85/0.88/0.77 → Intermedio (364 DMs), 0.67 → Básico (29 DMs))
$kg     = fReg * a * L^b * f(level) * E22         # CALC!AM, a=35000, b=−0.303 ($UN_REF_PTAR!C37:C38, eq. 1 = CALC!AL37)
                                                  #          E22 = 1.07378 ($UN_REF_PTAR!E22);  L≤0 → 0 (IFERROR)
$hab_P  = $kg / 1000 * g                          # CALC!AN
```

Submarine outfall (`CALC!AO..AS`). It applies only if `CALC!AQ37` = 1, coastal = 1 and P0 ≥ 100,000. In the stored data that is 6 DMs: Puerto Plata, Bajos de Haina, La Romana, San Pedro de Macorís, Santo Domingo de Guzmán and Santo Domingo Este.

```
PopEm  = PopRef                                   # AO
rngEm  = range(PopEm)                             # AP
len    = P0≥300000 ? 3000 : (100000<P0<300000 ? 1500 : 0)   # AQ  (m)
$m     = fReg * (PopEm≥1e6 ? PopEm*L79/1e6 : costPerM[rngEm])   # AR, $UN_REF_PTAR!L73:L79
         costPerM = 1,648.6 / 3,297.2 / 4,945.9 / 6,594.5 / 14,837.6 / 20,607.7 / 20,607.7 $/m
         = 1.3429 (IND 2009 → DOM 2024, ×0.8 free factor) × 6138.4 × DN(m)
$hab_E = $m * len / PopEm                         # AS
costHabT = ($hab_P + $hab_E) * fAdjTAR(=1) * (1 - dens)    # AT → BD → $Hab CostoUnTAR!S   (densification −10% also applied here)
```

## 4. ISM: minimum household sanitary installation (`$CAPEX ISM`)

```
dDomISM[t] = 0.19 * dDom[t]                          # Dom+ISM (CALC!BE37 = 19% of new sewer connections)
unitISM    = Σ mix_i * $ISM_i[regCost]               # CALC!BO: mix 0/100%/0/0 (CALC!BF37:BI37) → ISM-2 = 1,484.51 $/household
CAPEX_ISM  = Σ_{t=1..10} max(0, dDomISM[t]*unitISM)   # $CAPEX ISM!AX = SUM(T:AC) → ONLY 2025-2034 (see issue 1)
```

National total 491.2 M USD. Replicated exactly.

## 5. In-situ (`SiS.C` containment, `SiS.T` septage treatment)

- **SiS.C.** Same chain as sewer, in households: `cC0 = LB!W`, target `LB!AA` = 1 − sewer target. Unit cost `CALC!BY` = 10% × 965.87 (dry toilet) + 90% × 1,251.50 (pour-flush) = 1,222.93 $/household. With a 100% sewer target, in-situ coverage falls to 0, so CAPEX = 0.
- **SiS.T.** Same chain as treatment, in inhabitants. Cost `CALC!CH` comes from the PTLS curve (a = 35000, b = −0.303 × factor 0.6). `CALC!CD37` = 0 is not a valid PTLS type code, so CH = 0 and **CAPEX = 0 in any scenario as configured**.

The simulator implements both chains with the same rules. Both are 0 in the stored scenario and match the sheet.

## 6. Totals and outputs

- `ALC+TAR!AD/AE/AF`: per-DM CAPEX for ALC, TAR and the sum.
- `<RESULT>!K5..K12`: national summary:
  - Sewer network 7,680,638,665
  - Treatment 1,525,040,129
  - In-situ 0
  - ISM 491,229,783
  - Total 9,696,908,577
- `<RESULT>` rows 18–49 hold a pivot by province for the active scenario (B:K). The same table appears twice more as pasted values: AE scenario in Q:Z (ALC 5,899,958,967) and AC scenario in AB:AK.
- The "Valor Presente" columns (`AY`) are empty. There is no discounting.

## 7. Open issues and quirks

1. **ISM sums only 10 years.** `$CAPEX ISM!AX = SUM(T:AC)`, i.e. 2025–2034, while every other component sums `T:AW`. This looks like a bug. The simulator reproduces it (`tables.ism.sumYears = 10`). Set it to 30 to sum the full horizon.
2. **Unit cost and PTAR size are frozen at the 2024 population.** The population range, difficulty, BOD per capita, required removal and PTAR load (`CALC!AF`) all use the baseline P0, not the population at the horizon. PTAR load uses `P0 × (target − cT0)`, so treatment costs per inhabitant do not respond to population growth.
3. **`%PobSiS.T!AX` reads `LB!AA` (in-situ containment target) instead of `LB!AB` (septage target).** It has no effect today because both are 0.
4. **Densification also discounts treatment.** `$Hab CostoUnTAR!S = CALC!BD*(1−CALC!AA)`. That is debatable for treatment, but it is how the model works.
5. **Negative yearly increments are dropped, not netted.** This happens when population falls (some rural DMs) or coverage falls. It makes CAPEX slightly asymmetric.
6. **Pasted unit-cost table.** `$UN_REF_ALC!L122:AM123` uses factor 1.07137, while the live `E22` = 1.07378 (+0.2%). Rows 39–48 (the live recalculation) reference `#REF!` and evaluate to 0, so the pasted table is what drives the model.
7. **Changing the horizon.** The workbook ties `LB!AC37` (years to target) to `T36 − T35`. In the web app, set `yearsToTarget = horizonYear − baseYear` unless the user wants to reach the target earlier. Population exists only up to 2054.
8. **Scenario validation.** Only the stored scenario (AC and AE, 100%, 2040) can be validated against cached values. LibreOffice 24.2 here lacks XLOOKUP, so other scenarios could not be recomputed in a spreadsheet engine. The decreasing-coverage branch was validated exactly against the cached `%PobSiS.C` path.

---

## 8. Inputs a website user could plausibly edit

| Input | Scope | Cell / column | Stored value | Range in data / sensible range | `simulator.js` field |
|---|---|---|---|---|---|
| Current sewer coverage | per DM | `LB!U40:U432` (yellow input, Censo 2022) | 0–86%, median 10% | 0–1 | `dm.covAlc0` |
| Current treatment coverage | per DM | `LB!V40:V432` (= 50%·U; San Pedro de Macorís hard 90%) | 0–90%, median 5% | 0–1 (≤ covAlc0 is logical but not enforced) | `dm.covTar0` |
| Target sewer coverage | global (per-DM copy `LB!Y`) | `LB!Y37` | 100% | 0–1 | `params.targetAlc` or `dm.targetAlc` |
| Target treatment coverage | global (`LB!Z`) | `LB!Z37` | 100% | 0–1 | `params.targetTar` or `dm.targetTar` |
| Target / horizon year | global | `LB!T36` (base `LB!T35` = 2024) | 2040 | 2025–2054 (pop data ends 2054) | `params.horizonYear` |
| Years to reach target (plazo) | global (`LB!AC`) | `LB!AC37` = T36−T35 | 16 | 1 to horizon−base | `params.yearsToTarget` |
| m of network per connection | per DM | `CALC!Y40:Y432` (hard values; header cell `CALC!Y37` = "NOTA (*)") | 6.0–20.0, median 12.0 | 5–25 m | `dm.mPerConn` |
| Households per connection | per DM | `CALC!Z40:Z432` (hard values) | 1.0–2.98, median 1.0 | 1–4 | `dm.domPerConn` |
| Sewer type AC / AE | global (per-DM `CALC!X`) | `CALC!X37` | AC | "AC" / "AE" | `params.sewerType` or `dm.sewerType` |
| Densification share | global | `CALC!AA37` | 10% | 0–30% | `params.densification` |
| Treatment level | per DM, formula | `CALC!AG` (% BOD removal by size and coastal flag) → `CALC!AJ` level code via `$UN_REF_PTAR!B43:E46` | 85/88% inland, 67/77% coastal → Intermedio (364) / Básico (29) | 1 Avanzado (×1.25), 2 Intermedio (×1.0), 3 Básico (×0.6), 4 Primario (×0.25) | `dm.ptarLevel` (or `dm.removalReq`) |
| Submarine outfall on/off | global | `CALC!AQ37` | 1 | 0/1 | `params.emisarioEnabled` |
| Inhabitants per household | per DM | `LB!AD` | 1.66–4.23 | fixed (census) | `dm.habDom` |
| ISM share of new connections | global | `CALC!BE37` | 19% | 0–100% | `tables.ism.share` |

Not editable (fixed data): urban population projection `Pob!S:AW`, metro/coastal flags (`LB!F/G`), unit-cost tables, PTAR curve (a = 35000, b = −0.303), regional factors (all 1.0).

## 9. Validation (`simulator.js` vs cached values; see `validation_report.txt`)

Stored AC, 100%, 2040 scenario, all 393 DMs:

| Component | Simulator | Workbook | Max relative error per DM |
|---|---|---|---|
| Sewer (ALC) | 7,680,638,665 | 7,680,638,665 | 1.8e-15 |
| Treatment (TAR) | 1,525,040,129 | 1,525,040,129 | 1.1e-15 |
| ISM | 491,229,783 | 491,229,783 | 2.3e-16 |
| In-situ | 0 | 0 | – |

AE scenario: national ALC is 5,899,958,967 in both (rel. 1.6e-16). The 32 province totals in `<RESULT>!X18:X49` match with a maximum relative error of 2.0e-15. Per-DM AE values are not stored in the workbook.
