"""Sprint V2.12 — passo a passo de limites: substituição direta (funções
contínuas, incluindo racionais sem indeterminação), indeterminação 0/0 por
fatoração/cancelamento, e limites no infinito de funções racionais por
comparação de graus. Camada puramente didática — NUNCA um segundo motor de
limites: reaproveita `calculus/dispatcher.py:parse_limit_call` (o mesmo
parser das demais operações de cálculo) e, principalmente,
`calculus/limits.py:compute_limit` (o MESMO `sympy.limit` que o `/solve`
já usa) para TODO valor final mostrado. Este módulo só decide COMO
apresentar o cálculo em etapas; nunca recalcula um limite por conta
própria — `cancel()`/`factor()`/`degree()` são operações REAIS do SymPy
(mesma categoria de `compute_derivative`/`compute_limit`, nunca um
resolvedor paralelo), usadas só para decidir como fatiar a apresentação.

Escopo desta versão (via `expr.as_numer_denom()` + `Expr.is_polynomial`,
nunca regex): expressões que são uma razão de dois polinômios de uma
variável (o denominador pode ser 1 — uma expressão puramente polinomial).
Fora de escopo — rejeitado com `UNSUPPORTED_LIMIT_MESSAGE` ANTES de gerar
qualquer passo: funções transcendentais (`sin(x)/x`, regra de L'Hôpital
implícita), indeterminações que sobrevivem a um único cancelamento, e
limites no infinito onde o grau do numerador supera o do denominador
(diverge — sem exemplo no escopo desta sprint). `/solve` continua
calculando todos esses casos normalmente (motor de cálculo intocado)."""
from __future__ import annotations

from sympy import cancel, degree, expand, factor, oo
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..calculus.dispatcher import parse_limit_call
from ..calculus.limits import compute_limit
from ..errors import ExpressionError
from .formatting import substitute_symbol_text
from .models import MathStep
from .validation import UNSUPPORTED_LIMIT_MESSAGE


def _direct_substitution_steps(expr: Expr, symbol: Symbol, point: Expr) -> list[MathStep]:
    substituted = substitute_symbol_text(expr, symbol, point)
    result = compute_limit(expr, symbol, point)
    return [
        MathStep(
            title=f"Como a função é contínua em {symbol}={point}, podemos substituir diretamente.",
            expression=substituted,
        ),
        MathStep(title="Calculando", expression=str(result)),
    ]


def _try_indeterminate_zero_over_zero_steps(
    numer: Expr, denom: Expr, symbol: Symbol, point: Expr
) -> list[MathStep] | None:
    """Só reivindica este caminho quando um ÚNICO cancelamento de
    `(symbol - point)` já resolve a indeterminação (os casos do escopo
    desta versão: numerador e denominador compartilham exatamente uma
    raiz simples em `point`). `None` (nunca "chuta") se o resultado
    continuar indeterminado/divergente depois do cancelamento."""
    cancelled = cancel(numer / denom)
    _, cancelled_denom = cancelled.as_numer_denom()
    if cancelled_denom.subs(symbol, point) == 0:
        return None

    factored_numer = factor(numer)
    if denom == symbol - point:
        # Denominador já é exatamente o fator comum — mostrar o próprio
        # denominador fatorado de novo seria redundante (ver exemplos do
        # ticket: só o numerador fatorado já revela o fator cancelável).
        factoring_text = str(factored_numer)
    else:
        factoring_text = f"({factored_numer})/({factor(denom)})"

    result = compute_limit(numer / denom, symbol, point)
    return [
        MathStep(title="Substituindo", expression="0/0"),
        MathStep(
            title="Reconhecemos uma indeterminação.",
            expression="0/0",
            explanation=(
                "A substituição direta resulta em 0/0, uma forma indeterminada — "
                "precisamos simplificar a expressão antes de calcular o limite."
            ),
        ),
        MathStep(title="Fatorando", expression=factoring_text),
        MathStep(title="Cancelando o fator comum", expression=str(cancelled)),
        MathStep(title="Substituindo", expression=str(result)),
    ]


def _infinite_limit_steps(expr: Expr, numer: Expr, denom: Expr, symbol: Symbol) -> list[MathStep]:
    degree_numer = degree(numer, symbol)
    degree_denom = degree(denom, symbol)
    if degree_denom < 1 or degree_numer > degree_denom:
        # Denominador trivial (não é razão de verdade) ou numerador de
        # grau maior (diverge para +-oo) — sem exemplo no escopo desta
        # versão, fora de escopo.
        raise ExpressionError(UNSUPPORTED_LIMIT_MESSAGE)

    power_text = "x" if degree_denom == 1 else f"x**{degree_denom}"
    divided_numer = expand(numer / symbol**degree_denom)
    divided_denom = expand(denom / symbol**degree_denom)
    numer_limit = compute_limit(numer / symbol**degree_denom, symbol, oo)
    denom_limit = compute_limit(denom / symbol**degree_denom, symbol, oo)
    result = compute_limit(expr, symbol, oo)

    return [
        MathStep(
            title=(
                f"O maior grau do numerador é {degree_numer} e o maior grau do "
                f"denominador é {degree_denom}."
            ),
            expression=str(expr),
        ),
        MathStep(
            title=f"Dividindo o numerador e o denominador por {power_text}",
            expression=f"({divided_numer})/({divided_denom})",
        ),
        MathStep(
            title="Quando x→∞, os termos com x no denominador tendem a zero.",
            expression=f"{numer_limit}/{denom_limit}",
        ),
        MathStep(title="Simplificando", expression=str(result)),
    ]


def generate_limit_steps(text: str) -> list[MathStep]:
    expr, symbol, point = parse_limit_call(text)
    steps = [MathStep(title="Expressão original", expression=f"limite({expr}, {symbol}, {point})")]

    if not expr.has(symbol):
        # Constante: não depende de x, o limite é sempre a própria
        # constante — nunca precisa de substituição de verdade.
        result = compute_limit(expr, symbol, point)
        steps.append(
            MathStep(
                title="Como a expressão não depende de x, o limite é a própria constante.",
                expression=str(expr),
            )
        )
        steps.append(MathStep(title="Calculando", expression=str(result)))
        return steps

    numer, denom = expr.as_numer_denom()
    if not numer.is_polynomial(symbol) or not denom.is_polynomial(symbol):
        raise ExpressionError(UNSUPPORTED_LIMIT_MESSAGE)

    if point in (oo, -oo):
        if point is oo:
            steps.extend(_infinite_limit_steps(expr, numer, denom, symbol))
            return steps
        # x -> -oo fica fora do escopo desta versão (nenhum exemplo do
        # ticket usa -oo) — cai na mensagem amigável abaixo.
        raise ExpressionError(UNSUPPORTED_LIMIT_MESSAGE)

    if denom.subs(symbol, point) != 0:
        steps.extend(_direct_substitution_steps(expr, symbol, point))
        return steps

    if numer.subs(symbol, point) == 0:
        indeterminate_steps = _try_indeterminate_zero_over_zero_steps(numer, denom, symbol, point)
        if indeterminate_steps is not None:
            steps.extend(indeterminate_steps)
            return steps

    raise ExpressionError(UNSUPPORTED_LIMIT_MESSAGE)
