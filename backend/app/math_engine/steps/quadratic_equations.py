"""Sprint V2.9.1 — passo a passo de equações quadráticas de uma
incógnita. Reaproveita integralmente a infraestrutura da V2.9: o parser
compartilhado (`linear_equations.parse_equation_sides`) e, principalmente,
`linear_equations.reduce_to_value` — o mesmo núcleo que resolve uma
equação linear comum é reaproveitado de duas formas distintas aqui:

1. Isolando x² em vez de x (`reduce_to_value(lhs, rhs, symbol**2)`) para o
   caminho de raiz direta — `as_independent`/`.has()` do SymPy aceitam
   qualquer subexpressão como alvo, não só um `Symbol` atômico, então o
   MESMO código que já sabe "mover termos, isolar o coeficiente" funciona
   sem nenhuma alteração quando o alvo é `x**2`.
2. Resolvendo cada fator linear já isolado (`x - r = 0`) no caminho de
   fatoração — cada fator é literalmente uma equação linear trivial.

Este módulo NUNCA precisa tratar o caso `a=0` (coeficiente de x² nulo):
quem decide se uma equação é linear ou quadrática é `steps/dispatcher.py`,
com base no grau REAL da equação (via `sympy.degree`) — uma entrada como
"0x²+2x=4" já expande para grau 1 e é roteada para `linear_equations`
automaticamente, sem nenhum código dedicado aqui ("encaminhar
automaticamente ao resolvedor linear existente. Sem duplicação de
código" — literalmente zero linhas neste arquivo).

SELEÇÃO AUTOMÁTICA DO MÉTODO (nunca Bhaskara indiscriminadamente):

1. Se b=0 (equação incompleta sem termo linear) e -c/a >= 0: raiz
   quadrada direta (`x²=k` -> `x=±√k`), sem discriminante.
2. Senão, se a=1 (mônica) e as duas raízes exatas forem inteiras
   DISTINTAS: fatoração — `sympy.factor()` decide, nunca uma tentativa
   manual de "chutar" fatores.
3. Em qualquer outro caso (não mônica, raízes racionais não inteiras,
   raiz dupla, raízes irracionais ou complexas — incluindo b=0 com
   -c/a < 0): fórmula de Bhaskara. Δ<0/Δ=0 são ramos NATURAIS do mesmo
   cálculo de Δ, não casos hardcoded à parte (mesmo espírito de
   identidade/contradição em `linear_equations.reduce_to_value`).
"""
from __future__ import annotations

from sympy import Integer, factor, sqrt
from sympy import expand as sympy_expand
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..errors import ExpressionError
from .formatting import eq_text, math_segment, paren_if_negative, text_segment
from .linear_equations import parse_equation_sides, reduce_to_value
from .models import MathStep
from .validation import UNSUPPORTED_EQUATION_MESSAGE, require_single_symbol


def _standard_form_steps(lhs: Expr, rhs: Expr) -> tuple[list[MathStep], Expr]:
    """"Equação inicial" + (se necessário) "Organizando em ax²+bx+c=0".
    Devolve os passos e a expressão padrão já isolada (`standard = 0`)."""
    steps = [MathStep(title="Equação inicial", expression=eq_text(lhs, rhs))]
    standard = sympy_expand(lhs - rhs)
    if not (rhs == 0 and sympy_expand(lhs) == standard):
        steps.append(
            MathStep(title="Organizando em ax²+bx+c=0", expression=eq_text(standard, Integer(0)))
        )
    return steps, standard


def _complex_root_text(root: Expr) -> str:
    """Convenção de exibição já usada em todo o produto para a unidade
    imaginária (`formatter/unicode_math.py:replace_imaginary_unit` —
    "I" -> "i"): aqui feito diretamente na string, já que `MathStep.
    expression` nunca passa por `render_math` (é texto puro para o
    `to-latex.ts`, não a saída de apresentação do `/solve`)."""
    return str(root).replace("I", "i")


def _direct_square_root_steps(standard: Expr, symbol: Symbol) -> list[MathStep]:
    """b=0, -c/a >= 0 — "x²=k" seguido de raiz quadrada direta, nunca
    discriminante. Reaproveita `reduce_to_value` mirando `x**2` em vez de
    `x` (ver docstring do módulo)."""
    k_value, isolate_steps = reduce_to_value(standard, Integer(0), symbol**2)
    steps = list(isolate_steps)
    root = sqrt(k_value)
    steps.append(
        MathStep(
            title="Aplicando a raiz quadrada dos dois lados (primeira raiz)",
            expression=eq_text(symbol, root),
        )
    )
    steps.append(MathStep(title="Segunda raiz", expression=eq_text(symbol, -root)))
    return steps


def _try_integer_factoring(standard: Expr, a: Expr, symbol: Symbol) -> list[tuple[Expr, Expr]] | None:
    """Só reivindica o caminho de fatoração quando a equação é MÔNICA
    (a=1) e fatora em exatamente dois fatores lineares distintos com raiz
    inteira — critério verificado empiricamente contra os casos do
    escopo: "2x²+3x-5=0" também fatora sobre os racionais
    ((x-1)(2x+5)), mas uma das raízes (-5/2) não é inteira, então cai
    para Bhaskara, como pedido ("aplicar fatoração apenas quando a
    fatoração INTEIRA não for natural"). Devolve `None` (nunca "chuta")
    para qualquer outro caso — incluindo raiz dupla (`factor()` devolve
    uma `Pow`, não um `Mul` de dois fatores, e por isso nunca casa aqui;
    Δ=0 é tratado pelo ramo de Bhaskara, que já lida com isso
    naturalmente)."""
    if a != 1:
        return None
    factored = factor(standard)
    if not factored.is_Mul:
        return None
    factors = factored.as_ordered_factors()
    if len(factors) != 2:
        return None

    result: list[tuple[Expr, Expr]] = []
    roots: list[Expr] = []
    for factor_expr in factors:
        if not factor_expr.is_polynomial(symbol) or factor_expr.as_poly(symbol).degree() != 1:
            return None
        if factor_expr.coeff(symbol, 1) != 1:
            return None
        root = -factor_expr.coeff(symbol, 0)
        if not root.is_Integer:
            return None
        result.append((factor_expr, root))
        roots.append(root)
    if roots[0] == roots[1]:
        return None
    return result


def _factoring_steps(factors: list[tuple[Expr, Expr]], symbol: Symbol) -> list[MathStep]:
    factored_lhs = factors[0][0] * factors[1][0]
    steps = [MathStep(title="Fatorando o trinômio", expression=eq_text(factored_lhs, Integer(0)))]
    for ordinal, (factor_expr, _root) in zip(("primeiro", "segundo"), factors):
        steps.append(
            MathStep(
                title=f"Igualando o {ordinal} fator a zero",
                expression=eq_text(factor_expr, Integer(0)),
            )
        )
        _, factor_steps = reduce_to_value(factor_expr, Integer(0), symbol)
        steps.extend(factor_steps)
    return steps


def _bhaskara_steps(a: Expr, b: Expr, c: Expr, symbol: Symbol) -> list[MathStep]:
    """Fórmula de Bhaskara — Δ é sempre calculado e mostrado; Δ>0 (duas
    raízes reais), Δ=0 (raiz dupla) e Δ<0 (duas raízes complexas) são
    ramos naturais do MESMO cálculo, nunca casos especiais separados."""
    steps: list[MathStep] = []

    b_squared = b**2
    delta_substituted = f"Delta={b_squared}-4*{paren_if_negative(a)}*{paren_if_negative(c)}"
    steps.append(
        MathStep(
            title=(
                f"Identificando os coeficientes (a={a}, b={b}, c={c}) e calculando "
                "o discriminante Δ=b²-4ac"
            ),
            title_segments=[
                text_segment("Identificando os coeficientes"),
                math_segment(f"a={a}, b={b}, c={c}"),
                text_segment("e calculando o discriminante"),
                math_segment("Delta=b**2-4*a*c"),
            ],
            expression=delta_substituted,
        )
    )
    delta_value = b**2 - 4 * a * c
    steps.append(MathStep(title="Discriminante calculado", expression=f"Delta={delta_value}"))

    two_a = 2 * a
    if delta_value > 0:
        sqrt_delta = sqrt(delta_value)
        root1 = (-b + sqrt_delta) / two_a
        root2 = (-b - sqrt_delta) / two_a
        steps.append(
            MathStep(
                title="Aplicando a fórmula de Bhaskara (x=(-b+√Δ)/(2a)) — primeira raiz",
                title_segments=[
                    text_segment("Aplicando a fórmula de Bhaskara"),
                    math_segment(f"{symbol}=(-b+sqrt(Delta))/(2*a)"),
                    text_segment("— primeira raiz"),
                ],
                expression=eq_text(symbol, root1),
            )
        )
        steps.append(
            MathStep(
                title="Aplicando a fórmula de Bhaskara (x=(-b-√Δ)/(2a)) — segunda raiz",
                title_segments=[
                    text_segment("Aplicando a fórmula de Bhaskara"),
                    math_segment(f"{symbol}=(-b-sqrt(Delta))/(2*a)"),
                    text_segment("— segunda raiz"),
                ],
                expression=eq_text(symbol, root2),
            )
        )
    elif delta_value == 0:
        root = -b / two_a
        steps.append(
            MathStep(
                title="Δ igual a zero — raiz dupla: x=-b/(2a)",
                expression=eq_text(symbol, root),
            )
        )
    else:
        sqrt_delta = sqrt(delta_value)
        root1 = (-b + sqrt_delta) / two_a
        root2 = (-b - sqrt_delta) / two_a
        steps.append(
            MathStep(
                title="Δ negativo — a equação possui duas raízes complexas",
                expression=eq_text(symbol, _complex_root_text(root1)),
            )
        )
        steps.append(
            MathStep(
                title="Segunda raiz complexa",
                expression=eq_text(symbol, _complex_root_text(root2)),
            )
        )

    return steps


def generate_quadratic_equation_steps(text: str) -> list[MathStep]:
    lhs, rhs = parse_equation_sides(text)

    symbols = lhs.free_symbols | rhs.free_symbols
    require_single_symbol(symbols)
    symbol = next(iter(symbols))

    steps, standard = _standard_form_steps(lhs, rhs)

    a = standard.coeff(symbol, 2)
    b = standard.coeff(symbol, 1)
    c = standard.coeff(symbol, 0)
    if a == 0:
        # Nunca deveria acontecer (o dispatcher só chama esta função para
        # equações de grau 2 de verdade) — defesa contra uso indevido
        # direto deste módulo fora do fluxo normal.
        raise ExpressionError(UNSUPPORTED_EQUATION_MESSAGE)

    if b == 0:
        k_value = -c / a
        if k_value >= 0:
            steps.extend(_direct_square_root_steps(standard, symbol))
            return steps
        steps.extend(_bhaskara_steps(a, b, c, symbol))
        return steps

    factors = _try_integer_factoring(standard, a, symbol)
    if factors is not None:
        steps.extend(_factoring_steps(factors, symbol))
        return steps

    steps.extend(_bhaskara_steps(a, b, c, symbol))
    return steps
