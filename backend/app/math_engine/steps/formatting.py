"""Sprint V2.9 — infraestrutura compartilhada de apresentação dos passos.
Cada `MathStep.expression` é sempre `str()` de objetos SymPy reais (nunca
texto inventado) — estas funções só decidem COMO montar a string final
("lado=lado") e o título em português de uma operação já realizada pelo
motor (`linear_equations.py`/`linear_systems.py`), nunca calculam nada
matematicamente novo."""
from __future__ import annotations

from sympy.core.expr import Expr


def eq_text(lhs: Expr, rhs: Expr) -> str:
    return f"{lhs}={rhs}"


def _clean(term: Expr) -> str:
    """Cosmético, só para TÍTULOS (nunca para `expression`, que precisa
    continuar 100% parseável pelo pipeline `to-latex.ts` do frontend): o
    termo movido é sempre da forma `coeficiente*x` ou `x` (o símbolo ativo é
    sempre uma única letra, garantia de `safe_parsing.py`), então remover
    "*" não tem ambiguidade nenhuma aqui — vira "2x" em vez de "2*x"."""
    return str(term).replace("*", "")


def move_title(term: Expr) -> str:
    """Título de um passo que move `term` (um termo com x ou uma
    constante) para o outro lado da equação — a operação real é sempre
    "subtrair `term` dos dois lados"; quando `term` já é negativo, subtrair
    um negativo é somar um positivo, fraseado de forma mais natural."""
    text = _clean(term)
    if text.startswith("-"):
        return f"Somando {text[1:]} dos dois lados"
    return f"Subtraindo {text} dos dois lados"


def isolate_title(coeff: Expr) -> str:
    """Título do passo final que isola a variável dividindo pelo
    coeficiente. Coeficiente unitário fracionário (ex. 1/3) é fraseado como
    multiplicação pelo denominador — mesma operação, forma mais natural em
    português (`equação com x/3` -> "multiplicar por 3", não "dividir por
    1/3")."""
    if coeff.is_Rational and coeff.p == 1 and coeff.q != 1:
        return f"Multiplicando os dois lados por {coeff.q}"
    return f"Dividindo os dois lados por {_clean(coeff)}"
