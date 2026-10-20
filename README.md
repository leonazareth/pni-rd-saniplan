# PNI Saneamento · República Dominicana

Página de apresentação da metodologia e dos resultados do Plano Nacional de Investimentos em Saneamento da República Dominicana: análise de dados espaciais + modelo SaniPLAN.

Autores: Pery Nazareth · Leonardo Nazareth

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `index.html` | Página (GitHub Pages) |
| `css/`, `js/` | Estilo e lógica (sem etapa de build) |
| `i18n/` | Textos: `pt.json` (base), `es.json`, `en.json`. Chave ausente usa o português |
| `data/` | Dados leves já recortados (GeoJSON, JSON, JPG) |
| `tools/` | Scripts Python que geram `data/` a partir das camadas e planilhas originais |
| `docs/` | Notas técnicas do SaniPLAN (cadeia de cálculo, identidade visual) |
| `ROTEIRO.md` | Roteiro da apresentação e status de cada cena |

## Traduzir

Copie as chaves de `i18n/pt.json` para `es.json` ou `en.json` e traduza os valores. Não altere as chaves.

## Ver localmente

Os dados são carregados com `fetch`, então abra por um servidor local, não com duplo clique:

```
python -m http.server 8000
```

e acesse http://localhost:8000.

## Mapas base

Cinza escuro e imagem de satélite da Esri (uso livre com atribuição). Configuração em `js/mapstory.js` (`SAT_BASEMAP`).

## Publicar no GitHub Pages (primeira vez)

Repositório: https://github.com/leonazareth/pni-rd-saniplan (vazio, branch `main`).
Site: https://leonazareth.github.io/pni-rd-saniplan/

No terminal, dentro desta pasta:

```bash
git init -b main
git add .
git commit -m "Primeira versão da landing page PNI Saneamento RD"
git remote add origin https://github.com/leonazareth/pni-rd-saniplan.git
git push -u origin main
```

Depois ative o Pages (uma vez só), pelo navegador em **Settings → Pages → Deploy from a branch → main → / (root) → Save**, ou com o GitHub CLI:

```bash
gh api -X POST repos/leonazareth/pni-rd-saniplan/pages -f "source[branch]=main" -f "source[path]=/"
```

O site leva 1–2 minutos para ficar no ar.

## Atualizar o site

```bash
git add .
git commit -m "Descreva a mudança"
git push
```

Notas:
- `.nojekyll` precisa ir junto (faz o GitHub servir os arquivos sem processar).
- `preview.html` é só para a prévia no Claude e fica fora do repositório (`.gitignore`).
- Nenhum arquivo passa de 1 MB; não precisa de Git LFS.
