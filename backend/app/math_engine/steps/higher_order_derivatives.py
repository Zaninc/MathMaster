"""Sprint V3.0.6 (Derivadas de Ordem Superior) — passo a passo de
`derivada(expr, var, n)` com n >= 2 (d²/dx², d³/dx³, ..., dⁿ/dxⁿ). Camada
puramente didática — NUNCA um segundo motor de derivadas: cada RODADA
reaproveita EXATAMENTE o mesmo motor de primeira ordem já existente
(regra da potência/produto/cadeia/quociente/elementar trivial), com o
MESMO roteamento por forma que `steps/dispatcher.py` já usa pra decidir
entre eles — a diferença é que aqui cada rodada opera direto sobre
`(expr, symbol)` já parseados (as variantes "puras", sem o passo "Função
original", de `derivatives.py`/`advanced_derivatives.py`/`quotient_
rule.py`), nunca gerando e reparseando uma string `derivada(...)`
aninhada a cada iteração — exatamente a "forma estrutural mais segura"
pedida pra esta sprint em vez de string aninhada + reparse repetido.

`d²f/dx² = d/dx(d/dx(f))`: a prova disso nos PASSOS é literal — a rodada
k usa como entrada o RESULTADO REAL (`compute_derivative`, o mesmo motor
que `/solve` usa) da rodada k-1, nunca uma expressão inventada.

Elementar trivial (`sin(x)`/`cos(x)`/`exp(x)`/`ln(x)` sozinhos, sem
composição/produto/quociente em volta) precisou de um pequeno gap
fechado em `advanced_derivatives.py` (`is_trivial_elementary_shape`) —
gap PRÉ-EXISTENTE (nunca tinha passo a passo de primeira ordem nesta
versão), descoberto testando os casos obrigatórios desta sprint
(`d²/dx²(sin(x))`, `d²/dx²(exp(x))`, `d²/dx²(ln(x))`) — sem ele, a
SEGUNDA rodada de qualquer uma dessas (que precisa derivar `cos(x)`/
`-sin(x)`/`exp(x)`/`-1/x²` — todas ainda formas elementares triviais)
ficaria bloqueada mesmo com o motor de ordem superior funcionando."""
from __future__ import annotations

from sympy import expand
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..calculus.derivatives import compute_derivative
from ..errors import ExpressionError
from .advanced_derivatives import (
    advanced_derivative_steps,
    is_product_or_chain_shape,
    is_trivial_elementary_shape,
)
from .derivatives import polynomial_derivative_steps
from .formatting import linear_combination_expression
from .models import MathStep
from .quotient_rule import is_quotient_shape, quotient_derivative_steps

_ORDINALS = {
    1: "primeira", 2: "segunda", 3: "terceira", 4: "quarta", 5: "quinta",
    6: "sexta", 7: "sétima", 8: "oitava", 9: "nona", 10: "décima",
}


def _ordinal(order: int) -> str:
    # `MAX_DERIVATIVE_ORDER` (calculus/dispatcher.py) já garante order <= 10
    # antes de chegar aqui — o fallback numérico nunca dispara no fluxo
    # normal, só protege contra uso indevido direto deste módulo.
    return _ORDINALS.get(order, f"{order}ª")


def _mixed_sum_steps(expr: Expr, symbol: Symbol) -> list[MathStep] | None:
    """Sprint V3.0.6 — generaliza a linearidade da derivada (`derivatives.
    py`, hoje restrita a somas de termos POLINOMIAIS) pra somas de termos
    de QUALQUER forma que `single_order_derivative_steps` já sabe
    explicar sozinho (produto/cadeia/quociente/elementar trivial/
    polinomial) — necessário porque uma rodada de ordem superior
    frequentemente produz uma soma assim: `x*exp(x)` derivado uma vez vira
    `exp(x)+x*exp(x)`, dois termos, NENHUM deles polinomial sozinho, mas
    cada um perfeitamente explicável pela regra do produto/cadeia. `None`
    (nunca "chuta") se `expr` não é uma soma de 2+ termos OU se qualquer
    termo não bate em NENHUMA forma conhecida — quem chama decide o
    fallback (mensagem amigável de sempre), nunca finge explicar um termo
    desconhecido."""
    terms = expand(expr).as_ordered_terms()
    if len(terms) < 2:
        return None
    term_steps_list: list[list[MathStep]] = []
    for term in terms:
        try:
            _, term_steps = single_order_derivative_steps(term, symbol)
        except ExpressionError:
            return None
        term_steps_list.append(term_steps)

    steps = [
        MathStep(
            title="Aplicando a linearidade da derivada",
            expression=linear_combination_expression(terms, symbol, "derivada"),
        )
    ]
    for term_steps in term_steps_list:
        steps.extend(term_steps)
    total = compute_derivative(expr, symbol)
    steps.append(MathStep(title="Somando os resultados", expression=str(total)))
    return steps


def single_order_derivative_steps(expr: Expr, symbol: Symbol) -> tuple[Expr, list[MathStep]]:
    """Escolhe o MESMO motor que `steps/dispatcher.py` escolheria pra
    `derivada(expr, symbol)` de PRIMEIRA ordem — produto/cadeia,
    elementar trivial, quociente, potência/linearidade polinomial ou
    (fallback final) soma de termos de forma mista (`_mixed_sum_steps`) —
    e devolve `(derivada, passos)` direto, sem reparsear texto nenhum.
    Reaproveitada por CADA rodada de `generate_higher_order_derivative_
    steps` abaixo (inclusive recursivamente, por `_mixed_sum_steps`, um
    termo de cada vez)."""
    if is_product_or_chain_shape(expr, symbol) or is_trivial_elementary_shape(expr, symbol):
        steps = advanced_derivative_steps(expr, symbol)
    elif is_quotient_shape(expr, symbol) is not None:
        steps = quotient_derivative_steps(expr, symbol)
    else:
        try:
            steps = polynomial_derivative_steps(expr, symbol)
        except ExpressionError:
            mixed = _mixed_sum_steps(expr, symbol)
            if mixed is None:
                raise
            steps = mixed
    derivative = compute_derivative(expr, symbol)
    return derivative, steps


def generate_higher_order_derivative_steps(expr: Expr, symbol: Symbol, order: int) -> list[MathStep]:
    """`expr`/`symbol`/`order` já vêm parseados e validados por `calculus/
    dispatcher.py:parse_derivative_call_with_order` — chamada só por
    `steps/dispatcher.py`, e só quando `order >= 2` (`order == 1` continua
    inteiramente pelo caminho de primeira ordem já existente, intocado)."""
    steps = [
        MathStep(
            title=f"Derivada de {_ordinal(order)} ordem",
            expression=f"derivada({expr}, {symbol}, {order})",
        )
    ]

    current = expr
    for k in range(1, order + 1):
        steps.append(
            MathStep(
                title="Calcule a primeira derivada" if k == 1 else "Derive novamente",
                expression=f"derivada({current}, {symbol})",
            )
        )
        derivative, round_steps = single_order_derivative_steps(current, symbol)
        steps.extend(round_steps)
        current = derivative

    steps.append(MathStep(title="Resultado", expression=str(current)))
    return steps
