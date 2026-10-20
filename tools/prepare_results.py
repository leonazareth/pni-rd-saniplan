"""Resultados por província (Resultados.xlsx) -> data/resultados.json

Uso: python tools/prepare_results.py <Resultados.xlsx> <dm_data.json> <data/provincias.geojson> <saida.json>
Cada aba (90_cento, 100_cento) tem dois blocos lado a lado (AC e AE). O script
identifica o tipo de alcantarillado e a meta de cada bloco pelo cabeçalho.
"""
import json, sys, unicodedata
import openpyxl

XLS, DMJ, PROV, OUT = sys.argv[1:5]
norm = lambda s: unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().upper().strip()

prov = json.load(open(PROV, encoding="utf-8"))
code_by_name = {norm(f["properties"]["name_es"]): f["properties"]["cod_geogra"] for f in prov["features"]}

wb = openpyxl.load_workbook(XLS, data_only=True)
scen = {}
for ws in wb.worksheets:
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    # colunas onde começa cada bloco: célula "Tipo Alc"
    for r_i, row in enumerate(rows):
        for c_i, v in enumerate(row):
            if v != "Tipo Alc":
                continue
            tipo = row[c_i + 1]
            meta = rows[r_i + 1][c_i + 1]
            ism = next(rr[c_i + 4] for rr in rows[r_i:r_i + 6] if rr[c_i + 3] and "ISM" in str(rr[c_i + 3]))
            t0 = c_i - 5  # a tabela dinâmica começa 5 colunas à esquerda de "Tipo Alc"
            key = f"{tipo}{round(meta * 100)}"
            # tabela: linha cujo valor na coluna do bloco é um código de região "01".."10"
            data = {}
            for rr in rows:
                cod = rr[t0] if t0 < len(rr) else None
                if isinstance(cod, str) and cod.isdigit() and len(cod) == 2 and rr[t0 + 2]:
                    name = rr[t0 + 2]
                    pc = code_by_name.get(norm(name))
                    if not pc:
                        raise SystemExit(f"Província sem código: {name}")
                    data[pc] = {"reg": rr[t0 + 1], "n_dm": int(rr[t0 + 3]), "pob_lb": rr[t0 + 4],
                                "inc_alc": rr[t0 + 5], "inc_tar": rr[t0 + 6],
                                "capex_alc": rr[t0 + 7], "capex_tar": rr[t0 + 8], "capex": rr[t0 + 9]}
            scen[key] = {"tipo": tipo, "meta": meta, "ism": ism, "prov": data}
print("cenários:", sorted(scen))

# indicadores por província a partir dos distritos (planilha SaniPLAN)
sp = json.load(open(DMJ, encoding="utf-8"))
ind = {}
for d in sp["dms"]:
    p = d["provCode"]; w = d["pop"][0]
    a = ind.setdefault(p, {"pob24": 0, "pob40": 0, "alc": 0, "tar": 0, "m": 0, "dom": 0, "wdom": 0})
    hh = w / d["habDom"]
    a["pob24"] += w; a["pob40"] += d["pop"][16]
    a["alc"] += d["covAlc0"] * w; a["tar"] += d["covTar0"] * w
    a["m"] += d["mPerConn"] * hh / d["domPerConn"]; a["dom"] += hh; a["wdom"] += hh / d["domPerConn"]
indic = {p: {"pob24": round(a["pob24"]), "pob40": round(a["pob40"]),
             "cov_alc": round(a["alc"] / a["pob24"], 4), "cov_tar": round(a["tar"] / a["pob24"], 4),
             "m_conex": round(a["m"] / a["wdom"], 2), "dom_conex": round(a["dom"] / a["wdom"], 3)}
         for p, a in ind.items()}

out = {"indicadores": indic, "cenarios": {}}
for k, s in scen.items():
    tot = {f: sum(v[f] for v in s["prov"].values()) for f in ["pob_lb", "inc_alc", "inc_tar", "capex_alc", "capex_tar", "capex"]}
    out["cenarios"][k] = {
        "tipo": s["tipo"], "meta": s["meta"], "ism": round(s["ism"]),
        "total": {k2: round(v) for k2, v in tot.items()},
        "prov": {p: {**{k2: (round(v) if isinstance(v, float) else v) for k2, v in r.items()}} for p, r in s["prov"].items()}
    }
    print(k, "CAPEX rede+ETE", round(tot["capex"] / 1e6), "M | USD/hab (inc. coleta)", round(tot["capex"] / tot["inc_alc"]))
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
