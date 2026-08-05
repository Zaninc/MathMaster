"""Sprint V2.9 — contrato tipado e estável dos passos de resolução
determinística. Independente de HTML/KaTeX: `expression` é sempre texto
matemático puro (a mesma sintaxe que `lib/math/to-latex.ts` já sabe
converter para o eco da expressão digitada), nunca LaTeX bruto — a
conversão é responsabilidade exclusiva do frontend (ver CLAUDE_RULES.md
"não escrever LaTeX bruto no backend")."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MathStep:
    expression: str
    title: str | None = None
    explanation: str | None = None
