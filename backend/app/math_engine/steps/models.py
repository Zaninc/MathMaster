"""Sprint V2.9 — contrato tipado e estável dos passos de resolução
determinística. Independente de HTML/KaTeX: `expression` é sempre texto
matemático puro (a mesma sintaxe que `lib/math/to-latex.ts` já sabe
converter para o eco da expressão digitada), nunca LaTeX bruto — a
conversão é responsabilidade exclusiva do frontend (ver CLAUDE_RULES.md
"não escrever LaTeX bruto no backend").

Hotfix V2.9.1a — `title` sozinho não bastava para títulos que misturam
texto comum com fórmulas embutidas (ex. "Aplicando a fórmula de Bhaskara
(x=(-b+√Δ)/(2a)) — primeira raiz"): renderizar o título inteiro como texto
cru deixa a fórmula sem KaTeX; renderizar o título inteiro como fórmula
quebraria as palavras em português. `title_segments` é a evolução mínima e
aditiva do contrato (nunca remove `title`, que continua populado como
fallback em texto puro/acessibilidade) — uma lista ordenada de pedaços
`text`/`math`, cada `math` sendo texto matemático puro (mesmo contrato de
`expression`, nunca LaTeX). `None` (o padrão) significa "este título não
tem matemática embutida, exibir `title` como está" — nenhum título
existente (equações lineares, sistemas, fatoração, raiz direta) muda de
comportamento."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class TitleSegment:
    type: Literal["text", "math"]
    content: str


@dataclass(frozen=True)
class MathStep:
    expression: str
    title: str | None = None
    title_segments: list[TitleSegment] | None = None
    explanation: str | None = None
