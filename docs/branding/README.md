# Bubikas Holdings — identidade do escopo

A Bubikas Holdings é a holding fictícia responsável pelo Organizadin e pelo projeto Smart Construction neste cenário de laboratório.

## Identidade visual

- Logo: [bubikas-holdings-logo.png](bubikas-holdings-logo.png), com coruja geométrica e assinatura BUBIKAS HOLDINGS.
- Paleta institucional: vermelho `#C62828` e branco `#FFFFFF`, com cinzas neutros para o texto do documento.
- Arquivo PNG com transparência preservada, utilizado na capa e nos cabeçalhos do PDF.
- Criação com a ferramenta nativa **imagegen**, no modo `logo-brand`; sem uso do fallback CLI.

## Prompt de geração

```text
Use case: logo-brand. Asset type: official horizontal logo for a corporate PDF and reusable brand asset. Primary request: Create a modern, minimalist logo for Bubikas Holdings using a stylized owl as the animal symbol. Subject: a memorable front-facing geometric owl with a symmetrical silhouette, two clean circular eyes and a small central beak; use simple confident curves and negative space, elegant rather than cartoonish. Composition: one horizontal lockup, owl symbol on the left and the wordmark on the right; generous transparent clear space around the whole logo; the owl and lettering should occupy most of the useful canvas without being cropped. Style: flat, crisp, professional corporate identity with very few geometric shapes and excellent legibility at small sizes. Palette: a single rich corporate red #C62828 for all solid artwork and typography; white/transparent negative space; no other colors. Text verbatim: 'BUBIKAS' on the first line, 'HOLDINGS' below it in smaller widely spaced capitals. Spell B U B I K A S exactly. Typography: restrained modern geometric sans-serif, strong simple letterforms, careful kerning. Constraints: genuine transparent background; one finished logo only; no mockup, no paper texture, no gradients, no 3D, no shadows, no slogan, no extra text, no border, no watermark.
```

## Fonte e reprodução do PDF

O conteúdo editorial está em [docs/escopo.md](../escopo.md). O PDF é gerado pelo script [scripts/render-escopo.py](../../scripts/render-escopo.py), que incorpora as fontes Vera distribuídas com o ReportLab e utiliza o logo local.

Em um ambiente Python com as dependências de documentação instaladas:

```sh
python -m pip install -r docs/pdf-requirements.txt
python scripts/render-escopo.py --edition 11/11/2026
```

Execute os comandos na raiz do repositório. A saída padrão é `escopo.pdf`; `--output` permite gerar uma cópia em outro caminho. A ferramenta lê somente os arquivos de documentação e não acessa banco, contas ou serviços.

O gerador também atualiza os diagramas de conexões em `docs/diagrams/`, nos formatos SVG e Mermaid. As conexões são definidas em `scripts/escopo_diagrams.py` e incorporadas ao PDF como vetores.
