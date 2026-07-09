"""Sprint 9 — reconhecimento e propriedades de funções logarítmicas/
exponenciais CANÔNICAS dentro de `functions/`.

Reconhece apenas corpos onde o argumento (log/ln/exp) ou o expoente (potência
de base literal) é a variável isolada: `log(x)`, `ln(x)`, `exp(x)`, `2**x`,
`0.5**x`, `1/3**x`. Qualquer forma composta (`log(x+1)`, `2**(x+1)`,
`x*exp(x)`) deliberadamente NÃO é reconhecida aqui e continua caindo em
`TRANSCENDENTE` via `classify_function()`, como antes da Sprint 9 — domínio
simbólico genérico fica fora de escopo (mesmo TODO já registrado desde a
Sprint 7.1/8).

Detecção roda sobre o TEXTO BRUTO do corpo da função, antes do parse — mesmo
padrão já usado em `trigonometry/inverse.py` e `logarithms/domain.py` — para
não depender de como o SymPy reestrutura a árvore (ver descoberta da
Sprint 8: `log(x, 10)` nunca sobrevive como nó distinto, sempre vira
`log(x)/log(10)`).

Como as formas reconhecidas são canônicas e finitas, os valores de domínio/
imagem/raiz/intercepto/assíntota/monotonicidade são determinísticos por
`kind`/base — não dependem de `solve()`/domínio simbólico genérico do SymPy.
"""
from __future__ import annotations

import re
from fractions import Fraction

from .classification import EXPONENCIAL, LOGARITMICA

_REAIS = "ℝ"


def _patterns(variable_name: str) -> dict[str, re.Pattern]:
    var = re.escape(variable_name)
    return {
        "log": re.compile(rf"(?:log|ln)\(\s*{var}\s*\)"),
        "exp_e": re.compile(rf"exp\(\s*{var}\s*\)"),
        "exp_fraction": re.compile(rf"(\d+)\s*/\s*(\d+)\s*\*\*\s*{var}"),
        "exp_literal": re.compile(rf"(\d+(?:\.\d+)?)\s*\*\*\s*{var}"),
    }


def _valid_base(base: Fraction) -> bool:
    return base > 0 and base != 1


def detect_logexp_kind(body_text: str, variable_name: str) -> tuple[str, Fraction | None] | None:
    """Retorna (kind, base) se `body_text` bater EXATAMENTE com uma das
    formas canônicas, senão None. `base` é None para log/ln/exp (base fixa
    10/e/e) e a Fraction extraída para potência de base literal — usada só
    para decidir monotonicidade (crescente se base > 1, decrescente se
    0 < base < 1)."""
    text = body_text.strip()
    patterns = _patterns(variable_name)

    if patterns["log"].fullmatch(text):
        return LOGARITMICA, None

    if patterns["exp_e"].fullmatch(text):
        return EXPONENCIAL, None

    match = patterns["exp_fraction"].fullmatch(text)
    if match:
        numerador, denominador = match.groups()
        if denominador == "0":
            return None
        base = Fraction(int(numerador), int(denominador))
        return (EXPONENCIAL, base) if _valid_base(base) else None

    match = patterns["exp_literal"].fullmatch(text)
    if match:
        base = Fraction(match.group(1))
        return (EXPONENCIAL, base) if _valid_base(base) else None

    return None


def image_for(kind: str) -> str:
    return _REAIS if kind == LOGARITMICA else "(0, +∞)"


def asymptote_field_for(kind: str) -> str:
    if kind == LOGARITMICA:
        return "Assíntota vertical: x = 0"
    return "Assíntota horizontal: y = 0"


def monotonicity_for(kind: str, base: Fraction | None) -> str:
    if kind == LOGARITMICA:
        return "crescente"
    if base is None:  # exp(x): base e > 1
        return "crescente"
    return "crescente" if base > 1 else "decrescente"
