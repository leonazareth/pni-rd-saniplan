"""Prepara os dados leves usados pela landing page (pasta data/).

Uso:  python tools/prepare_data.py <pasta_layers> <dm_data.json> <saida>
Lê as camadas do projeto SaniPLAN/PNI RD e gera GeoJSON simplificados,
recortes de Santo Domingo Este e imagens de satélite em JPG.
"""
import json, sys, warnings
from pathlib import Path
import numpy as np
import geopandas as gpd
import rasterio
from PIL import Image

warnings.filterwarnings("ignore")
L = Path(sys.argv[1]); DMJ = Path(sys.argv[2]); OUT = Path(sys.argv[3])
OUT.mkdir(parents=True, exist_ok=True)
SRC = {  # caminhos relativos à pasta SaniPLAN/Layers
    "dm": L / "Censo 2022/PoblacionTotal_DM_2022_fixed.gpkg",
    "rural": L / "Censo 2022/Pob Urbana y Rural/ONE_PobRural_2022.gpkg",
    "prov": L / "Censo 2022/PROV_2022.gpkg",
    "grid": L / "grided_pop_building.parquet",
    "urb_sde": L / "Censo 2022/Pob Urbana y Rural/SantoDomingoEste_urban2021.gpkg",
    "sat2010": L / "Censo 2022/Pob Urbana y Rural/SantoDomingo_2010.tif",
    "sat2022": L / "Censo 2022/Pob Urbana y Rural/SantoDomingo_2022.tif",
}
SDE = "320101"


def polyonly(g):
    """Mantém só as partes poligonais (a simplificação pode gerar GeometryCollection)."""
    from shapely.geometry import MultiPolygon, Polygon
    from shapely.validation import make_valid
    if g is None or g.is_empty:
        return g
    g = make_valid(g)
    if g.geom_type in ("Polygon", "MultiPolygon"):
        return g
    parts = [x for x in getattr(g, "geoms", []) if isinstance(x, (Polygon, MultiPolygon))]
    polys = [q for x in parts for q in (x.geoms if x.geom_type == "MultiPolygon" else [x])]
    return MultiPolygon(polys) if polys else None


def save(gdf, name, precision=5):
    """Grava GeoJSON compacto (sem GDAL) com coordenadas arredondadas."""
    import shapely
    gdf = gdf.to_crs(4326).copy()
    gdf["geometry"] = shapely.set_precision(gdf.geometry.values, 10 ** -precision)
    if gdf.geom_type.isin(["Polygon", "MultiPolygon", "GeometryCollection"]).any():
        gdf["geometry"] = gdf.geometry.apply(polyonly)
    txt = gdf.to_json(drop_id=True, na="null", show_bbox=False)
    (OUT / name).write_text(txt.replace(", ", ",").replace(": ", ":"), encoding="utf-8")
    print(name, (OUT / name).stat().st_size // 1024, "KB", len(gdf))


# --- SaniPLAN (planilha) por DM -------------------------------------------
sp = json.loads(DMJ.read_text())
spdm = {d["codDM6"]: d for d in sp["dms"]}

# --- Distritos municipais -------------------------------------------------
dm = gpd.read_file(SRC["dm"])
dm["cod"] = dm["codDM6"].astype(str).str.zfill(6)
rur = gpd.read_file(SRC["rural"]).drop(columns="geometry")
rur["cod"] = rur["cod_1"].astype(int).astype(str).str.zfill(6)
dm = dm.merge(rur[["cod", "Pob_Rural_2022", "Pob_Rural_2010"]], on="cod", how="left")

grid = gpd.read_parquet(SRC["grid"])
grid["coddm6"] = grid["coddm6"].astype(str)
urb = grid[grid.urban_consolidated]
agg = urb.groupby("coddm6").agg(pop_urb_adj=("pop_adj_census22", "sum"),
                                 edif=("count_buildings", "sum"),
                                 ruas_m=("sum_roads_extension", "sum"),
                                 hex_urb=("id", "count"))
dm = dm.merge(agg, left_on="cod", right_index=True, how="left")


def sp_field(cod, key, sub=None):
    d = spdm.get(cod)
    if not d:
        return None
    v = d.get(sub, {}).get(key) if sub else d.get(key)
    return None if v is None else round(float(v), 4)


dm["area_ha"] = (dm.to_crs(32619).area / 1e4).round()
dm["prov"] = dm["cod"].map(lambda c: (spdm.get(c) or {}).get("provName"))
dm["reg"] = dm["cod"].map(lambda c: (spdm.get(c) or {}).get("regName"))
dm["cov_alc"] = dm["cod"].map(lambda c: sp_field(c, "covAlc0"))
dm["m_conex"] = dm["cod"].map(lambda c: sp_field(c, "mPerConn"))
dm["dom_conex"] = dm["cod"].map(lambda c: sp_field(c, "domPerConn"))
dm["pob24"] = dm["cod"].map(lambda c: round((spdm.get(c) or {"pop": [0]})["pop"][0]))
dm["pob40"] = dm["cod"].map(lambda c: round((spdm.get(c) or {"pop": [0] * 17})["pop"][16]))
keep = ["cod", "nom_dist", "prov", "reg", "area_ha", "pob_total_one", "pob_urbana_one", "pop_urb_adj",
        "Pob_Rural_2010", "Pob_Rural_2022", "hab_per_hogar", "edif", "ruas_m", "hex_urb",
        "cov_alc", "m_conex", "dom_conex", "pob24", "pob40", "geometry"]
dmo = dm[keep].copy()
dmo["pop_urb_adj"] = dmo["pop_urb_adj"].round()
dmo["ruas_m"] = dmo["ruas_m"].round()
dmo["geometry"] = dmo.to_crs(32619).simplify(120).to_crs(dm.crs)
save(dmo, "dm.geojson", 4)

# --- Províncias -----------------------------------------------------------
pv = gpd.read_file(SRC["prov"])
pv["geometry"] = pv.to_crs(32619).simplify(200).to_crs(pv.crs)
# cobertura provincial = média ponderada pela população 2024 dos DMs
covs = {}
for d in sp["dms"]:
    p = d["provCode"]; w = d["pop"][0]
    a = covs.setdefault(p, [0, 0, 0]); a[0] += d["covAlc0"] * w; a[1] += d["covTar0"] * w; a[2] += w
pv["cov_alc"] = pv["cod_geogra"].map(lambda c: round(covs[c][0] / covs[c][2], 4) if c in covs else None)
pv["cov_tar"] = pv["cod_geogra"].map(lambda c: round(covs[c][1] / covs[c][2], 4) if c in covs else None)
save(pv[["cod_geogra", "name_es", "cov_alc", "cov_tar", "geometry"]], "provincias.geojson", 4)

# --- Hexágonos urbanos do país (centróides) -------------------------------
cen = urb.to_crs(32619).copy()
cen["geometry"] = cen.geometry.centroid
cen["p"] = cen["pop_adj_census22"].fillna(0).round().astype(int)
cen["r"] = (cen.urban_consolidated & ~cen.urban_area).astype(int)  # reclassificado
save(cen[["p", "r", "geometry"]], "hex_urbanos_rd.geojson", 4)

# --- Santo Domingo Este: hexágonos completos ------------------------------
s = grid[grid.coddm6 == SDE].copy()
s["cls"] = np.where(s.urban_area, "oficial", np.where(s.urban_consolidated, "reclass", "rural"))
cols = {"id": "id", "sum_population": "ghs", "sum_pop_adjust": "ghs_adj", "pop_adj_census22": "pop",
        "count_buildings": "edif", "sum_roads_extension": "ruas_m", "roads_per_building": "m_edif",
        "pop_per_building": "hab_edif", "neighbors_with_buildings": "viz_edif",
        "pop_no_buildings": "flag_pop_sem_edif", "buildings_no_pop": "flag_edif_sem_pop",
        "pop_adjusted": "ajustado", "cls": "cls"}
so = s[list(cols) + ["geometry"]].rename(columns=cols)
for c in ["ghs", "ghs_adj", "pop", "ruas_m", "m_edif", "hab_edif"]:
    so[c] = so[c].astype(float).round(1)
save(so, "sde_hex.geojson", 5)

sde = dm[dm.cod == SDE][["cod", "nom_dist", "Pob_Rural_2010", "Pob_Rural_2022", "geometry"]]
save(sde, "sde_limite.geojson", 5)
save(gpd.read_file(SRC["urb_sde"])[["geometry"]], "sde_urbana_oficial.geojson", 5)

# --- Satélite 2010 (Landsat 7) e 2022 (Sentinel-2) ------------------------
def rgb(path, bands, out, lo=2, hi=98, gamma=0.9):
    r = rasterio.open(path)
    a = np.stack([r.read(b).astype("float32") for b in bands])
    gap = ~np.isfinite(a).all(0) | (a <= 0).any(0)
    if gap.any():  # Landsat 7 SLC-off: preenche faixas sem dado com o vizinho mais próximo
        from scipy import ndimage
        _, (iy, ix) = ndimage.distance_transform_edt(gap, return_indices=True)
        a = a[:, iy, ix]
    v = a[np.isfinite(a)]
    p1, p2 = np.percentile(v, lo), np.percentile(v, hi)
    a = np.clip((a - p1) / (p2 - p1), 0, 1) ** gamma
    img = Image.fromarray((np.nan_to_num(a.transpose(1, 2, 0)) * 255).astype("uint8"))
    img.save(OUT / out, quality=82)
    b = r.bounds
    print(out, img.size, (OUT / out).stat().st_size // 1024, "KB")
    return [[b.left, b.top], [b.right, b.top], [b.right, b.bottom], [b.left, b.bottom]]


meta = {"sat2010": rgb(SRC["sat2010"], [3, 2, 1], "sat_sde_2010.jpg"),
        "sat2022": rgb(SRC["sat2022"], [4, 3, 2], "sat_sde_2022.jpg")}

# --- Números-chave para o texto -------------------------------------------
rec = s[s.cls == "reclass"]
meta["sde"] = {"hex_total": int(len(s)), "hex_reclass": int(len(rec)),
               "pop_reclass": round(float(rec.pop_adj_census22.sum())),
               "edif_reclass": int(rec.count_buildings.sum()),
               "rural2010": int(sde.Pob_Rural_2010.iloc[0]), "rural2022": int(sde.Pob_Rural_2022.iloc[0])}
meta["rd"] = {"hex_total": int(len(grid)), "hex_urb": int(len(urb)),
              "pop_urb_adj": round(float(urb.pop_adj_census22.sum()))}
(OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
print(json.dumps(meta)[:600])
