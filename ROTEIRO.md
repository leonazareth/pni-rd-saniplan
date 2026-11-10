# Roteiro: PNI Saneamento República Dominicana (v1)

Landing page de rolagem. Idioma base: PT (`i18n/pt.json`); ES e EN por botão, traduções depois.
Créditos: Pery Nazareth e Leonardo Nazareth. Sem logos ou menções institucionais.

Status: ✅ no protótipo · 🔧 parcial · ⬜ a construir

Mapas: satélite Google (tiles públicos) nas cenas aproximadas; mapa base Esri cinza escuro no país.
Visual (v2): texto em faixa translúcida à esquerda (sem caixas), cenas com transição por opacidade, satélite Esri nas cenas aproximadas, mapa base Esri cinza escuro.

## Capa ✅
- Título institucional: "PNI Saneamento · República Dominicana".
- Fundo: os 18.352 hexágonos urbanos do país (azul = urbano oficial, laranja = reclassificado).
- Números: 486.526 hexágonos · 393 distritos · 8,66 mi hab. urbanos (2022, ajustado).

## Ato 0: Visão geral ✅
Título: "Quanto custa universalizar o saneamento urbano na República Dominicana?" (sem valores).
1. Diagrama com ícones: entradas → análise espacial → **SaniPLAN** (mini planilha no centro, com dados reais) → resultados (CAPEX, projeções, mapa por província, priorização). Cada nó abre uma explicação.
2. Zoom nas entradas (transição para o Ato 1).

## Dados espaciais ✅ (antigos atos 1 e 2; revisão de nov/2026, branch `revisao-dados-espaciais`)
Mapa fixo + texto ao lado. A câmera vai do país a Santo Domingo Este e volta ao país uma única vez.
Escalas de cor do escuro (menor) para o claro (maior): viridis para metros de rua por construção e rede por ligação; no fecho, uma escala por indicador.
Hexágonos urbanos do país: geometria real em `data/hex_urbanos_rd.geojson`. Na escala do país (hexágono < 1 px) aparecem como pontos; ao aproximar (zoom ~10), como hexágonos.
Sem tiles externos (prévia): terra em cinza (`data/pais.geojson`), imagem Sentinel-2 de 2022 no lugar do satélite na cena 6, miniaturas ocultas.
1. ✅ Abertura da seção: hexágonos urbanos do país (azul = urbano oficial, laranja = reclassificado).
2. ✅ Fontes e níveis de agregação: tabela-escada com a área típica de cada nível; em cada linha, hexágonos que crescem da esquerda para a direita (cheio = nível do dado; claros = agregações). O mapa mostra os níveis aninhados na mesma escala e, ao passar o mouse numa coluna, as unidades daquele nível (em "País", só o contorno do país).
3. ✅ Santo Domingo Este, por distrito: um valor para o polígono inteiro (preenchimento a 45%, borda cheia).
4. ✅ Santo Domingo Este, por hexágono de 10 ha (mesma câmera; preenchimento a 60%).
5. ✅ Aprimorando os dados disponíveis: rural SDE 40.099 → 116.935; satélite 2010 × 2022 com linha do tempo.
6. ✅ Reclassificar o que já é cidade: hexágonos reclassificados sobre a imagem de 2022 (mesma câmera do 5); 148 hex, ~100 mil hab., 23.944 construções em SDE; +860 mil no país.
7. ✅ Ruas ÷ construções em Santo Domingo Este (preenchimento a 68%), com dois hexágonos de exemplo (ocupação adensada × ocupação dispersa) e miniatura de satélite de 166 px (reduz em telas baixas). Os dois cartões abrem para cima, com contorno branco, haste e ponto ligando ao hexágono.
8. ✅ O mesmo cálculo para o país: hexágonos urbanos coloridos por metros de rua por construção (ruas OSM ÷ construções Overture; só hexágonos com 5+ construções), sem mapa base, só contornos de país, províncias e distritos. Clique mostra ruas, construções e a razão.
9. ✅ Fecho: indicadores por distrito com seletor (rede por ligação, domicílios por ligação, habitantes por domicílio, população urbana ajustada, cobertura de esgoto), escala, valor ao clicar e nível de origem do dado.
Os botões Por distrito / Por hexágono aparecem só nos itens 3 e 4; o item 7 não tem botões.
Termo: "ocupação dispersa" (não "espalhado").
Removido: correção da população modelada (GHSL), que confundia com o slide 5.

## Ato 3: SaniPLAN ✅ (revisar)
11. ✅ Fluxo do modelo: 4 etapas + prints da planilha (clique amplia) + diagrama da folha INICIO.
12. ✅ Projeção de população: 5 curvas, matriz de seleção, gráfico interativo por distrito (censos 2002/2010/2022 + projeção 2024–2040, curva atribuída).
13. ✅ Custos unitários: rede AC × AE × dificuldade, curva de ETE interativa, emissário, in situ + ISM, tabela "o tamanho importa".
14. ✅ Simulador com a cara da planilha (abas CALC e RESULTADOS; uma meta única para coleta e tratamento) (Calibri, faixas cinza, células amarelas de entrada): escolher distritos e alterar cobertura atual, meta e ano, m de rede/ligação, AC/AE, nível de tratamento. População e custos ficam fixos. Motor JS validado contra a planilha (erro < 1e-14 em todos os 393 distritos).
14b. ✅ Resultados do modelo (fecho do SaniPLAN): repete os três outputs do slide "O que faz" (%, hab, $), agora com os números do país no cenário rede econômica / meta 90% (lidos de `data/resultados.json`, com contador). No slide de Resultados, os mesmos símbolos aparecem como selos em "Meta de cobertura", "Investimento total" e "População a atender".

## Ato 4: Resultados 🔧
15. ✅ Cenários 2040: 90% / 100% × AC / AE (totais, USD/hab, rede × tratamento). Dados: `Resultados/Resultados.xlsx` → `data/resultados.json` (`tools/prepare_results.py`).
16. ✅ WebGIS provincial: indicador escolhido no mapa, ranking clicável, detalhe da província.
17. Confiança × nível de agregação.
18. Replicabilidade e próximos passos.
19. Créditos.
