# Roteiro: PNI Saneamento República Dominicana (v1)

Landing page de rolagem. Idioma base: PT (`i18n/pt.json`); ES e EN por botão, traduções depois.
Créditos: Pery Nazareth e Leonardo Nazareth. Sem logos ou menções institucionais.

Status: ✅ no protótipo · 🔧 parcial · ⬜ a construir

Mapas: satélite Google (tiles públicos) nas cenas aproximadas; mapa base Esri cinza escuro no país.
Visual (v2): texto em faixa translúcida à esquerda (sem caixas), cenas com transição por opacidade, satélite Esri nas cenas aproximadas, mapa base Esri cinza escuro.

## Capa ✅
- Título institucional: "PNI Saneamento · República Dominicana".
- Fundo: os 18.352 hexágonos urbanos do país (azul = urbano oficial, âmbar = reclassificado).
- Números: 486.526 hexágonos · 393 distritos · 8,66 mi hab. urbanos (2022, ajustado).

## Ato 0: Visão geral ✅
Título: "Quanto custa universalizar o saneamento urbano na República Dominicana?" (sem valores).
1. Diagrama com ícones: entradas → análise espacial → **SaniPLAN** (mini planilha no centro, com dados reais) → resultados (CAPEX, projeções, mapa por província, priorização). Cada nó abre uma explicação.
2. Zoom nas entradas (transição para o Ato 1).

## Ato 1: Os dados necessários 🔧
1. ✅ Subtópico: o problema dos dados agregados.
2. ✅ Um dado por distrito × grade 100 m (botão alterna; Santo Domingo Este, mesma escala hab/ha).
3. ✅ Fontes e níveis de agregação (tabela-escada: construção → país). Usada depois para lembrar que a cobertura é provincial e o tratamento, nacional.

## Ato 2: Análise espacial 🔧 (mapa fixo + texto curto ao lado)
4. ✅ Do país ao distrito: cobertura por província → província Santo Domingo → SDE.
5. ✅ Grade hexagonal de 10 ha: por quê + clique no hexágono.
6. ✅ Correções do GHSL (zerados × recalculados).
7. ✅ Inconsistência do censo: rural SDE 40.099 → 116.935; satélite 2010 × 2022 com linha do tempo; áreas urbana (azul) e rural (âmbar) oficiais.
7b. ✅ Hexágonos reclassificados sobre a imagem de satélite (zoom na área leste de SDE).
8. ✅ Reclassificação: 148 hex, ~100 mil hab., 23.944 construções em SDE; +860 mil no país.
9. 🔧 Indicadores por distrito (m de rede/ligação, domicílios/ligação), com clique. Falta: zoom numa quadra com construções e ruas.
10. 🔧 Cobertura atual por distrito. Falta: áreas do cadastro de redes.

## Ato 3: SaniPLAN ✅ (revisar)
11. ✅ Fluxo do modelo: 4 etapas + prints da planilha (clique amplia) + diagrama da folha INICIO.
12. ✅ Projeção de população: 5 curvas, matriz de seleção, gráfico interativo por distrito (censos 2002/2010/2022 + projeção 2024–2040, curva atribuída).
13. ✅ Custos unitários: rede AC × AE × dificuldade, curva de ETE interativa, emissário, in situ + ISM, tabela "o tamanho importa".
14. ✅ Simulador com a cara da planilha (abas CALC e RESULTADOS; uma meta única para coleta e tratamento) (Calibri, faixas cinza, células amarelas de entrada): escolher distritos e alterar cobertura atual, meta e ano, m de rede/ligação, AC/AE, nível de tratamento. População e custos ficam fixos. Motor JS validado contra a planilha (erro < 1e-14 em todos os 393 distritos).

## Ato 4: Resultados 🔧
15. ✅ Cenários 2040: 90% / 100% × AC / AE (totais, USD/hab, rede × tratamento). Dados: `Resultados/Resultados.xlsx` → `data/resultados.json` (`tools/prepare_results.py`).
16. ✅ WebGIS provincial: indicador escolhido no mapa, ranking clicável, detalhe da província.
17. Confiança × nível de agregação.
18. Replicabilidade e próximos passos.
19. Créditos.
