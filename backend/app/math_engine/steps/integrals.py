"""Sprint V2.10.1 — passo a passo de integrais indefinidas: regra da
potência para polinômios de uma variável (constantes, x^n, coeficiente*x^n,
somas e diferenças desses termos), a linearidade da integral da soma, e a
constante de integração. Camada puramente didática — NUNCA um segundo
resolvedor de integrais: reaproveita o parser já existente do domínio
cálculo (`calculus/dispatcher.py:parse_integral_call`, nunca regex frágil
novo) e, principalmente, `calculus/integrals.py:compute_indefinite_
integral` (o MESMO `sympy.integrate` que o `/solve` já usa) para TODO valor
final mostrado — inclusive o de cada termo isolado. Este módulo só decide
COMO apresentar o cálculo em etapas; nunca recalcula uma integral por
conta própria.

Reaproveita integralmente a infraestrutura de termo polinomial da V2.10
(`formatting.classify_polynomial_term`/`term_expression`/`term_text_plain`/
`linear_combination_expression`) — a forma "coeficiente*x^n" que a regra
da potência sabe explicar é IDÊNTICA para derivar e para integrar; só a
operação final muda. Termo fora desse formato (função transcendental,
produto/quociente entre variáveis, expoente negativo ou fracionário —
incluindo x**-1, cuja integral é ln|x|, fora de escopo) é rejeitado com
`UNSUPPORTED_INTEGRAL_MESSAGE` ANTES de gerar qualquer passo: `/solve`
continua calculando essas integrais normalmente (motor de cálculo
intocado), só o passo a passo fica indisponível para elas nesta versão."""
from __future__ import annotations

from sympy import expand
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..calculus.dispatcher import parse_integral_call
from ..calculus.integrals import compute_indefinite_integral
from ..errors import ExpressionError
from .formatting import (
    classify_polynomial_term,
    linear_combination_expression,
    math_segment,
    term_expression,
    term_text_plain,
    text_segment,
)
from .models import MathStep
from .validation import UNSUPPORTED_INTEGRAL_MESSAGE

_INTEGRATION_CONSTANT_EXPLANATION = (
    "Como a derivada de uma constante é zero, adicionamos uma constante "
    "arbitrária C."
)


def _term_steps(coeff: Expr, exponent: int, symbol: Symbol, *, standalone: bool) -> list[MathStep]:
    """Passo da integral de UM termo já classificado (sempre um único
    passo — diferente da derivada, a regra da potência de integração não
    tem um estágio "aplicar depois simplificar" separado: o coeficiente
    dividido pelo novo expoente já é o resultado final do termo, sempre
    calculado por `compute_indefinite_integral`, nunca à mão)."""
    term_expr = term_expression(coeff, exponent, symbol)
    result = compute_indefinite_integral(term_expr, symbol)

    if exponent == 0:
        title = (
            "A integral de uma constante é a constante multiplicada pela variável"
            if standalone
            else f"Integrando {coeff}"
        )
        return [MathStep(title=title, expression=str(result))]

    title = f"Integrando {term_text_plain(coeff, exponent, symbol)} pela regra da potência"
    title_segments = [
        text_segment("Integrando"),
        math_segment(term_expr),
        text_segment("pela regra da potência"),
    ]
    return [MathStep(title=title, title_segments=title_segments, expression=str(result))]


def generate_integral_steps(text: str) -> list[MathStep]:
    expr, symbol = parse_integral_call(text)

    # Mesma convenção de leitura em grau decrescente da V2.10
    # (`as_ordered_terms()`, nunca `Add.make_args`).
    terms = expand(expr).as_ordered_terms()
    classified = [classify_polynomial_term(term, symbol) for term in terms]
    if any(item is None for item in classified):
        raise ExpressionError(UNSUPPORTED_INTEGRAL_MESSAGE)

    steps = [MathStep(title="Integral original", expression=f"integral({expr}, {symbol})")]

    if len(terms) == 1:
        coeff, exponent = classified[0]
        steps.extend(_term_steps(coeff, exponent, symbol, standalone=True))
        without_constant = compute_indefinite_integral(expr, symbol)
    else:
        steps.append(
            MathStep(
                title="Aplicando a linearidade da integral",
                expression=linear_combination_expression(terms, symbol, "integral"),
            )
        )
        for coeff, exponent in classified:
            steps.extend(_term_steps(coeff, exponent, symbol, standalone=False))

        without_constant = compute_indefinite_integral(expr, symbol)
        steps.append(MathStep(title="Somando os resultados", expression=str(without_constant)))

    steps.append(
        MathStep(
            title="Adicionando a constante de integração",
            explanation=_INTEGRATION_CONSTANT_EXPLANATION,
            expression=f"{without_constant} + C",
        )
    )
    return steps
