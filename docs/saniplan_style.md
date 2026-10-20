# SaniPLAN: visual identity of the workbook (for the web mockup)

All values below were read from cell styles (openpyxl), the theme (`xl/theme/theme1.xml`) and the drawing XML of the button shapes. Theme colors were converted to hex with Excel's HSL tint and lumMod rules.

## Theme

- Fonts: Calibri (body, all cells) and Calibri Light (headings, theme major). There are no other fonts in cells.
- Office 2013–2022 theme palette:
  - dk1 `#000000`, lt1 `#FFFFFF`, dk2 (tx2) `#44546A`, lt2 `#E7E6E6`
  - accent1 `#5B9BD5`, accent2 `#ED7D31`, accent3 `#A5A5A5`, accent4 `#FFC000`, accent5 `#4472C4`, accent6 `#70AD47`
- Web substitute for Calibri: `Calibri, Carlito, "Segoe UI", sans-serif`. Carlito is metric-compatible and on Google Fonts.

## Top banner ("BarMod" picture, `xl/media/image1.png`, copied to `img/barmod_logo_bar.png`; crop at `img/barmod_crop.png`)

- A full-width strip about 75–100 px high with background `#595959` (dark gray), a thin `#223F59` (dark navy) outline and a white bottom band of about 10 px.
- Logo "san**i**plan":
  - Lower-case, white, in a monospaced sans similar to Consolas or Lucida Console, roughly 40 px.
  - The **i** is bold, taller and heavier than the other letters (it acts as the logo mark).
  - Placed at the left with about 60 px padding.
  - CSS approximation: `font-family: Consolas, "Lucida Console", "DejaVu Sans Mono", monospace; color:#fff; letter-spacing:.02em` with `<b style="font-size:1.25em">i</b>`.
- Subtitle block in the center, right-aligned, white, Calibri about 13 px, three lines:
  - "Modelo de apoyo a la elaboración de Plan de Saneamiento"
  - "Proyección de Población, Cobertura y Estimación de la Inversión Necesaria"
  - "[País o Región]"

## Navigation bar ("MenuMod" shape group, on every main sheet, directly below the banner)

Flat rectangles with no rounding, about 1.0 × 0.36 in each (≈ 96 × 35 px), with ~4 px gaps and white text, in this order:

| Button | Macro | Fill | Font |
|---|---|---|---|
| `↑ ⁄ ↓` (show/hide bar) | BarMod_OnOff | `#8497B0` | 16 pt bold |
| `<` | hojaAnterior | `#8497B0` | 14 pt bold |
| `>` | hojaSiguiente | `#8497B0` | 14 pt bold |
| `< INICIO` | Hoja_inicio | `#8497B0` | 14 pt |
| `CONFIG` (opens sub-menu) | SMenuCfg_OnOff | `#8497B0` | 11 pt |
| `L. BASE` | Hoja_LB | `#8497B0` | 11 pt |
| `POB` (opens sub-menu) | SMenuPob_OnOff | `#8497B0` | 11 pt |
| `CALC` | Hoja_Calc | `#8497B0` | 11 pt bold |
| `RESULTADOS` | Hoja_Result | **`#1F4E79`** on <RESULT> (active page) | 11 pt |

- Active page: the button for the current sheet uses accent1 at 50% luminance (`#1F4E79`). All others use tx2 lighter 40% (`#8497B0`).
- Drop-down sub-menus use paler buttons `#ADB9CA` (tx2 lighter 60%) with white text, 11 pt, separated by a thin vertical line connector:
  - CONFIG: `$UN PTAR`, `$UN ALC`, `Costo País`, `Rangos Pob`, `$UN INSITU`, `$UN ISM`
  - POB: `Población`, `Domicílios`, `Hab/ Dom`
- Action buttons ("GUARDAR COPIA DEL ARCHIVO", "NUEVO PROYECTO", "RECARGAR MODULO DE CALCULO", "ACTUALIZAR TABLA DINÁMICA"):
  - Fill `#595959` (ACTUALIZAR uses `#3F5063`), white, 10 pt bold, upper-case.
  - Each has a translucent tooltip box above it: `#BDD7EE` at 50% alpha, black 11 pt bold text.

## Sheet titles and section bands

| Element | Example | Font | Fill |
|---|---|---|---|
| Sheet title band | <RESULT>!B3 "SINTESIS DE RESULTADOS DEL MODELO", LB!B3, <INICIO>!B3 "INÍCIO" | Calibri 24, white, regular (CALC!B3 20 bold) | `#595959` (dk1 tint 0.35), full width |
| Scenario title | <RESULT>!Q3 / AB3 "Escenario A – Alcantarillado Económico (AE)" | Calibri 18 white | `#595959` |
| Section band, large | CALC!V31 "Saneamiento con RED" | Calibri 22 white | `#808080` |
| Section band, info | CALC!B31 "Información General" | Calibri 20 white | `#A6A6A6` |
| Block header | CALC!V38 "SISTEMA ALCANTARILLADO" | Calibri 14 black, centered | `#D9D9D9` |
| Block header (treatment) | CALC!AF38 "TRATAMIENTO DE AGUAS RESIDUALES" | Calibri 14 black | `#BFBFBF` |
| Block header (LB) | LB!J38 / T38 / Y38 "BASE DE DATOS…", "LÍNEA DE BASE…", "METAS…" | Calibri 14 bold black, centered, no fill | – |
| Table column headers | LB row 39 | Calibri 9 white, centered, wrap | `#595959` |
| Table column headers | CALC row 39 / calc sheets row 39 | Calibri 9 (8 bold for code headers such as `CAPEX_ALC.1`), black, centered, wrap | none |
| Result table headers | <RESULT> row 17 (Q:Z) | Calibri 11 bold white, centered, wrap | `#808080` |
| Sheet code label | LB!B35 "LB", CALC!B35 "CALC" | Calibri 26 black | – |
| <INICIO> panel titles | "Identificación del Proyecto", "Diagrama – Secuencia…" | Calibri 16 white | `#595959` |
| <INICIO> "Hojas Principales" | D42 | Calibri 16 white | `#A6A6A6` |
| <INICIO> sheet links | D44.. "Costo$_PAIS", "Rng_POB", "LB", "CALC", "SINTESIS" | Calibri 11, centered | `#FFE699` (accent4 tint 0.6) |
| <INICIO> sheet index header | W7 "Hojas" | Calibri 16 black | `#D0CECE` |

## Input vs formula cells

- **Input cells** (user loads data):
  - Fill `#FFFFD5` (light cream yellow). Some per-DM editable columns use `#FFFFDD` or `#FFFFCC`, and CALC!BE37 uses `#FFFF99`.
  - Scenario parameter inputs (LB!T35, T36, Y37, Z37; CALC!X37, AA37, AL37) use a **red bold** font `#FF0000` at 10–14 pt, centered.
  - Instruction boxes read "Cargar información o fórmulas solamente en las celdas color amarillo". They use fill `#FFFFD5` with a red `#FF0000` outline and text.
- **Formula/derived cells**: no fill, black Calibri 10. Key results are bold (CALC!V rng, BC, BD).
- **Highlighted outputs** on <RESULT>:
  - Active scenario values (Tipo Alc "AC", Meta 100%, Plazo 16): Calibri 16, dark red `#C00000`, centered.
  - Total row "Σ SIST. SANEAMIENTO": Calibri 10 bold `#C00000`.
- Help callouts next to CALC inputs ("Eligir el Tipo de Alcantarillado…", "Definir la extensión media de Red por conexión…"): fill `#DAE3F3` at 70% alpha, Calibri 10–11, gray outline.

## Number formats

| Use | Format |
|---|---|
| Money, population, households | `#,##0` (CALC!T uses accounting `_-* #,##0_-;…;_-* "-"??_-`) |
| Percentages (coverage, targets, densification, transport factor) | `0%` |
| m/connection | `#,##0.0` |
| households/connection, inhabitants/household | `#,##0.00` / `0.00` |
| Year | `#,##0` (shows "2,024" in English locale; use plain integer on the web) |
| Region/province codes | text with leading zeros, format `0#` / `0#######` (e.g. "01", "0109", "01090102") |
| Timestamp | `yyyy/mm/dd hh:mm` |

## Layout and feel

- White background. Gridlines are hidden on <RESULT> and visible on the other sheets. Zoom is 55–85%.
- Wide flat gray bands, no rounded corners and no shadows.
- Dense tables in 9–10 pt type.
- Dark-gray header bars contrast with cream-yellow input columns.
- <RESULT> layout:
  - Title band.
  - Left: the "Escenario Activo" box, a 2-column key/value list (bold labels 10 pt, values centered, red values 16 pt).
  - Right: the "Cuadro Síntesis – Inversión Estimada (CAPEX $)" box. Labels are right-aligned, (I)/(II)/(III) group lines are bold and subtotals are underlined.
  - Below: the provincial pivot table (codReg, Región, Provincia, cant DM, Pob LB, incremental population sewer/treatment, CAPEX ALC, CAPEX TAR, CAPEX TOTAL).

## Rendered references (values-only re-render via LibreOffice; shapes/buttons are not reproduced, banner overlaid)

- `sheet_RESULT.png`, `sheet_LB.png`, `sheet_INICIO.png`, `sheet_CALC.png` (full width, overview)
- `sheet_CALC_zoom1.png`, `sheet_CALC_zoom2.png` (readable crops of the sewer and treatment blocks)
- `render/sheets_values_only.pdf`
- `img/barmod_logo_bar.png` (original banner, 11325×163), `img/barmod_crop.png` (left 2400 px), `img/inicio_image2.png` (four-step flow diagram on <INICIO>)
