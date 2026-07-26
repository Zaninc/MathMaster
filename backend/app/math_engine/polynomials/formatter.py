r"""Sprint V2.6 — apresentação do Motor de Polinômios Avançados.

Nunca devolve `Poly(...)`/`Dict(...)`/repr() do SymPy: cada função aqui
produz uma string já pronta para o usuário.

`format_roots` reaproveita o MESMO vocabulário "var = valor" que
`equations/quadratic.py`/`equations/polynomial.py` já produzem para
solução de equação — passa INTOCADO pelo pipeline de apresentação
(`app/formatter/pipeline.py:_format_assignment_list`), que já sabe ordenar
por (parte real, parte imaginária) e numerar com subscrito Unicode
("x₁ = -3, x₂ = 3") quando há 2+ valores. `format_division` reaproveita o
MESMO padrão "Rótulo: valor; Rótulo: valor" que `calculus/dispatcher.py`
já usa ("Derivada: ...", "Integral: ... + C") — os dois formatos são
reconhecidos (e deixados intactos) pelo formatter existente, nenhuma
extensão foi necessária lá. `format_coefficients` usa colchetes ("[1, 2, 0, -5]") deliberadamente: a
whitelist de caracteres de `formatter/classify.py:_PURE_EXPRESSION_PATTERN`
não inclui "[" nem "]", então essa forma nunca é reinterpretada/
ressympificada pelo pipeline — chega ao usuário byte a byte como produzida
aqui."""
from __future__ import annotations

from sympy.core.symbol import Symbol


def format_coefficients(coefficients: list) -> str:
    return "[" + ", ".join(str(coefficient) for coefficient in coefficients) + "]"


def format_degree(degree) -> str:
    """`str(degree)` cobre tanto um `Integer` normal (ex. "5") quanto o
    singleton `-oo` do polinômio nulo (ex. "grau(0)" -> "-oo") — o pipeline
    de apresentação já traduz "-oo" para "-∞"
    (`formatter/unicode_math.py:replace_constants`), mesmo tratamento que
    qualquer outro resultado infinito do motor (ex. limites)."""
    return str(degree)


def format_roots(symbol: Symbol, roots: list) -> str:
    if not roots:
        return "Nenhuma raiz"
    return ", ".join(f"{symbol} = {root}" for root in roots)


def format_division(quotient, remainder) -> str:
    return f"Quociente: {quotient}; Resto: {remainder}"


def format_expanded(expr) -> str:
    """Rótulo "Expandido: ..." — DIFERENTE de fatorar/simplificar/grau/
    coeficientes (que devolvem o valor puro, sem rótulo): sem isso, o
    resultado de `expand()` (uma soma) volta a passar pela forma
    "expressão pura" do pipeline de apresentação
    (`formatter/pipeline.py:_format_pure_expression` ->
    `formatter/expr_clean.py:clean_expr`), que aplica `factor()` e prefere
    o resultado MAIS CURTO — para um polinômio como "(x+2)³", isso
    silenciosamente desfaz a expansão de volta para a forma fatorada
    original (bug real, confirmado empiricamente durante o
    desenvolvimento: "expandir((x+2)³)" devolvia "(x + 2)³" sem o rótulo).
    O rótulo (mesmo padrão "Rótulo: valor" de
    `calculus/dispatcher.py:solve_calculus_text`) contém ":" — o pipeline
    de apresentação já reconhece essa forma e a deixa INTOCADA (nunca
    entra em `clean_expr`), evitando alterar `expr_clean.py` (código
    compartilhado por todas as áreas do motor) só para esta operação."""
    return f"Expandido: {expr}"
