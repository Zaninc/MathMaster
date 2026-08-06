"""Sprint V2.10 — passo a passo de derivadas: regra da potência para
polinômios de uma variável (constantes, x^n, coeficiente*x^n, somas e
diferenças desses termos) e a linearidade da derivada da soma. Camada
puramente didática — NUNCA um segundo motor de derivadas: reaproveita o
parser já existente do domínio cálculo (`calculus/dispatcher.py:
parse_derivative_call`, nunca regex frágil novo) e, principalmente,
`calculus/derivatives.py:compute_derivative` (o MESMO `sympy.diff` que o
`/solve` já usa) para TODO valor final mostrado — inclusive o de cada
termo isolado. Este módulo só decide COMO apresentar o cálculo em etapas;
nunca recalcula uma derivada por conta própria.

Termo fora do formato "coeficiente*x^n" (n inteiro >= 0) — função
transcendental, produto/quociente entre variáveis, expoente negativo ou
fracionário — é rejeitado com `UNSUPPORTED_DERIVATIVE_MESSAGE` ANTES de
gerar qualquer passo: `/solve` continua calculando essas derivadas
normalmente (motor de cálculo intocado), só o passo a passo fica
indisponível para elas nesta versão."""
from __future__ import annotations

from sympy import expand
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..calculus.derivatives import compute_derivative
from ..calculus.dispatcher import parse_derivative_call
from ..errors import ExpressionError
from .formatting import (
    classify_polynomial_term,
    linear_combination_expression,
    math_segment,
    paren_if_negative,
    term_expression,
    term_text_plain,
    text_segment,
)
from .models import MathStep
from .validation import UNSUPPORTED_DERIVATIVE_MESSAGE


def _power_rule_unevaluated_text(coeff: Expr, exponent: int, symbol: Symbol) -> str:
    """"expoente*coeficiente*x^(expoente-1)" SEM simplificar — construído
    manualmente (não via `sympy.core.parameters.evaluate(False)`) pelo
    mesmo motivo já documentado em `quadratic_equations._bhaskara_steps`:
    o printer do SymPy reordena os fatores de um `Mul` não avaliado de
    forma imprevisível quando há números negativos envolvidos. Escrever a
    string à mão dá controle total sobre a ordem "expoente vezes
    coeficiente", exatamente a leitura pedagógica pretendida."""
    new_exponent = exponent - 1
    power_text = str(symbol) if new_exponent == 1 else f"{symbol}**{new_exponent}"
    return f"{exponent}*{paren_if_negative(coeff)}*{power_text}"


def _term_steps(coeff: Expr, exponent: int, symbol: Symbol, *, standalone: bool) -> list[MathStep]:
    """Passo(s) da derivada de UM termo já classificado. O valor final de
    CADA passo vem de `compute_derivative` (mesmo motor do `/solve`) —
    nunca recalculado à mão aqui, mesmo nos casos triviais."""
    term_expr = term_expression(coeff, exponent, symbol)
    result = compute_derivative(term_expr, symbol)

    if exponent == 0:
        title = "A derivada de uma constante é zero" if standalone else f"Derivando {coeff}"
        return [MathStep(title=title, expression=str(result))]

    if exponent == 1:
        return [
            MathStep(
                title=f"Derivando {term_text_plain(coeff, exponent, symbol)}",
                title_segments=[text_segment("Derivando"), math_segment(term_expr)],
                expression=str(result),
            )
        ]

    title = f"Derivando {term_text_plain(coeff, exponent, symbol)} pela regra da potência"
    title_segments = [
        text_segment("Derivando"),
        math_segment(term_expr),
        text_segment("pela regra da potência"),
    ]
    if coeff == 1:
        return [MathStep(title=title, title_segments=title_segments, expression=str(result))]

    unevaluated = _power_rule_unevaluated_text(coeff, exponent, symbol)
    return [
        MathStep(title=title, title_segments=title_segments, expression=unevaluated),
        MathStep(title="Simplificando", expression=str(result)),
    ]


def generate_derivative_steps(text: str) -> list[MathStep]:
    expr, symbol = parse_derivative_call(text)

    # `as_ordered_terms()` (não `Add.make_args`, cuja ordem interna é
    # arbitrária) — grau decrescente, a mesma convenção de leitura "ax²+bx+c"
    # já usada no resto do produto (ex. `quadratic_equations.py`).
    terms = expand(expr).as_ordered_terms()
    classified = [classify_polynomial_term(term, symbol) for term in terms]
    if any(item is None for item in classified):
        raise ExpressionError(UNSUPPORTED_DERIVATIVE_MESSAGE)

    steps = [MathStep(title="Função original", expression=f"derivada({expr}, {symbol})")]

    if len(terms) == 1:
        coeff, exponent = classified[0]
        steps.extend(_term_steps(coeff, exponent, symbol, standalone=True))
        return steps

    steps.append(
        MathStep(
            title="Aplicando a linearidade da derivada",
            expression=linear_combination_expression(terms, symbol, "derivada"),
        )
    )
    for coeff, exponent in classified:
        steps.extend(_term_steps(coeff, exponent, symbol, standalone=False))

    total = compute_derivative(expr, symbol)
    steps.append(MathStep(title="Somando os resultados", expression=str(total)))
    return steps
