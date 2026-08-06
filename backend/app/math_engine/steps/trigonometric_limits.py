"""Sprint V2.12.1 — passo a passo dos limites trigonométricos fundamentais
(x→0): `sen(ax)/x`, `x/sen(x)`, `sen(ax)/sen(bx)` e `(1-cos(ax))/x²`.
Camada puramente didática — NUNCA um resolvedor paralelo: reaproveita
`calculus/dispatcher.py:parse_limit_call` (o mesmo parser da V2.12) e,
principalmente, `calculus/limits.py:compute_limit` (o MESMO `sympy.limit`
que o `/solve` já usa) para TODO valor final mostrado. Este módulo só
decide COMO apresentar a manipulação algébrica (multiplicar/dividir para
isolar `sen(u)/u`, identidade `1-cos(θ)=2sen²(θ/2)`) que reduz cada caso
ao limite fundamental `lim u→0 sen(u)/u = 1` — nunca calcula esse valor
por conta própria.

Detecção via ÁRVORE do SymPy, nunca regex: `expr.as_numer_denom()` +
`.func`/`classify_polynomial_term` (mesma classificação "coeficiente*x"
já usada desde a V2.10 para a regra da potência) decidem se o numerador/
denominador é exatamente `sen(a*x)`, `x`, ou `1-cos(a*x)` para algum
coeficiente racional `a`. `is_trigonometric_fundamental_shape` — chamada
por `steps/dispatcher.py` ANTES do caminho racional da V2.12 — exige
`ponto == 0` explicitamente (essas identidades só valem exatamente aí);
qualquer outra forma (incl. `tan(x)/x`, `sen(x²)/x`, produtos, somas, ou
qualquer coisa em outro ponto) devolve `None`/`False` e cai no caminho
racional existente (`limits.py`), que rejeita com a MESMA mensagem
amigável de sempre — nenhum código de rejeição dedicado precisa existir
aqui."""
from __future__ import annotations

from sympy import Integer, cos, sin
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..calculus.dispatcher import parse_limit_call
from ..calculus.limits import compute_limit
from ..errors import ExpressionError
from .formatting import classify_polynomial_term
from .models import MathStep
from .validation import UNSUPPORTED_LIMIT_MESSAGE

_FUNDAMENTAL_STATEMENT = "limite(sin(u)/u, u, 0)=1"
_FUNDAMENTAL_EXPLANATION = (
    "Este é o limite trigonométrico fundamental: quando u→0, sen(u)/u tende a 1."
)


def _coeff_times_symbol(coeff: Expr, symbol: Symbol) -> str:
    """"a*x", exceto quando `a` é 1 — nesse caso, apenas "x" (mesmo
    espírito de `derivatives.term_text_plain`: coeficiente unitário nunca
    aparece explicitamente numa string construída à mão)."""
    return str(symbol) if coeff == 1 else f"{coeff}*{symbol}"


def _linear_coefficient(arg: Expr, symbol: Symbol) -> Expr | None:
    """Coeficiente `a` se `arg` for exatamente `a*symbol` (`a` racional
    != 0) — reaproveita `classify_polynomial_term` (mesma classificação
    "coeficiente*x^n" da V2.10), exigindo expoente exatamente 1."""
    classified = classify_polynomial_term(arg, symbol)
    if classified is None or classified[1] != 1:
        return None
    coeff, _ = classified
    if coeff == 0:
        return None
    return coeff


def _match_sin_over_x(expr: Expr, symbol: Symbol) -> Expr | None:
    numer, denom = expr.as_numer_denom()
    if denom != symbol or numer.func is not sin:
        return None
    return _linear_coefficient(numer.args[0], symbol)


def _is_x_over_sin_x(expr: Expr, symbol: Symbol) -> bool:
    numer, denom = expr.as_numer_denom()
    return numer == symbol and denom == sin(symbol)


def _match_sin_over_sin(expr: Expr, symbol: Symbol) -> tuple[Expr, Expr] | None:
    numer, denom = expr.as_numer_denom()
    if numer.func is not sin or denom.func is not sin:
        return None
    a = _linear_coefficient(numer.args[0], symbol)
    b = _linear_coefficient(denom.args[0], symbol)
    if a is None or b is None:
        return None
    return a, b


def _match_one_minus_cos_over_x_squared(expr: Expr, symbol: Symbol) -> Expr | None:
    numer, denom = expr.as_numer_denom()
    if denom != symbol**2:
        return None
    cos_part = 1 - numer
    if cos_part.func is not cos:
        return None
    return _linear_coefficient(cos_part.args[0], symbol)


def is_trigonometric_fundamental_shape(expr: Expr, symbol: Symbol, point: Expr) -> bool:
    """Sprint V2.12.1 — usada por `steps/dispatcher.py` para decidir o
    roteamento ANTES do caminho racional da V2.12. As identidades só
    valem em `x=0`; em qualquer outro ponto, nenhum caso é reivindicado
    aqui (cai no caminho racional existente, que rejeita normalmente)."""
    if point != 0:
        return False
    return (
        _match_sin_over_x(expr, symbol) is not None
        or _is_x_over_sin_x(expr, symbol)
        or _match_sin_over_sin(expr, symbol) is not None
        or _match_one_minus_cos_over_x_squared(expr, symbol) is not None
    )


def _sin_over_x_steps(expr: Expr, symbol: Symbol, coefficient: Expr) -> list[MathStep]:
    if coefficient == 1:
        return [
            MathStep(
                title="Reconhecendo o limite fundamental",
                expression=f"limite(sin({symbol})/{symbol}, {symbol}, 0)=1",
                explanation=_FUNDAMENTAL_EXPLANATION,
            ),
            MathStep(title="Calculando", expression=str(compute_limit(expr, symbol, Integer(0)))),
        ]

    return [
        MathStep(
            title="Reconhecendo o limite fundamental",
            expression=_FUNDAMENTAL_STATEMENT,
            explanation=_FUNDAMENTAL_EXPLANATION,
        ),
        MathStep(
            title="Reescrevendo para isolar o limite fundamental",
            # `coefficient` nunca é 1 neste ramo (o caso trivial já foi
            # tratado acima), então "a*x" sempre aparece por extenso aqui.
            expression=f"{coefficient}*sin({coefficient}*{symbol})/({coefficient}*{symbol})",
        ),
        MathStep(
            title="Aplicando o limite fundamental",
            expression=f"{coefficient}*1",
        ),
        MathStep(title="Calculando", expression=str(compute_limit(expr, symbol, Integer(0)))),
    ]


def _x_over_sin_x_steps(expr: Expr, symbol: Symbol) -> list[MathStep]:
    return [
        MathStep(
            title="Reconhecendo o limite fundamental (forma recíproca)",
            expression=f"limite(sin({symbol})/{symbol}, {symbol}, 0)=1",
            explanation=(
                "Como o limite de sen(x)/x é 1, o limite da função recíproca "
                "x/sen(x) também é 1."
            ),
        ),
        MathStep(title="Calculando", expression=str(compute_limit(expr, symbol, Integer(0)))),
    ]


def _sin_over_sin_steps(expr: Expr, symbol: Symbol, a: Expr, b: Expr) -> list[MathStep]:
    ratio = a / b
    return [
        MathStep(
            title="Reconhecendo o limite fundamental",
            expression=_FUNDAMENTAL_STATEMENT,
            explanation=_FUNDAMENTAL_EXPLANATION,
        ),
        MathStep(
            title="Reescrevendo como produto de limites fundamentais",
            expression=(
                f"({ratio})*(sin({_coeff_times_symbol(a, symbol)})/({_coeff_times_symbol(a, symbol)}))*"
                f"(({_coeff_times_symbol(b, symbol)})/sin({_coeff_times_symbol(b, symbol)}))"
            ),
        ),
        MathStep(title="Aplicando o limite fundamental", expression=f"{ratio}*1*1"),
        MathStep(title="Calculando", expression=str(compute_limit(expr, symbol, Integer(0)))),
    ]


def _one_minus_cos_over_x_squared_steps(expr: Expr, symbol: Symbol, a: Expr) -> list[MathStep]:
    coefficient = a**2 / Integer(2)
    arg_text = _coeff_times_symbol(a, symbol)
    return [
        MathStep(
            title="Aplicando a identidade 1-cos(θ)=2sen²(θ/2)",
            expression=f"1-cos({arg_text})=2*sin({arg_text}/2)**2",
        ),
        MathStep(
            title="Reorganizando a fração",
            expression=f"{coefficient}*(sin({arg_text}/2)/({arg_text}/2))**2",
        ),
        MathStep(
            title="Reconhecendo o limite fundamental",
            expression=_FUNDAMENTAL_STATEMENT,
            explanation=_FUNDAMENTAL_EXPLANATION,
        ),
        MathStep(title="Aplicando o limite fundamental", expression=f"{coefficient}*1**2"),
        MathStep(title="Calculando", expression=str(compute_limit(expr, symbol, Integer(0)))),
    ]


def generate_trigonometric_limit_steps(text: str) -> list[MathStep]:
    expr, symbol, point = parse_limit_call(text)
    steps = [MathStep(title="Expressão original", expression=f"limite({expr}, {symbol}, {point})")]

    if point == 0:
        sin_over_x = _match_sin_over_x(expr, symbol)
        if sin_over_x is not None:
            steps.extend(_sin_over_x_steps(expr, symbol, sin_over_x))
            return steps

        if _is_x_over_sin_x(expr, symbol):
            steps.extend(_x_over_sin_x_steps(expr, symbol))
            return steps

        sin_over_sin = _match_sin_over_sin(expr, symbol)
        if sin_over_sin is not None:
            steps.extend(_sin_over_sin_steps(expr, symbol, *sin_over_sin))
            return steps

        one_minus_cos = _match_one_minus_cos_over_x_squared(expr, symbol)
        if one_minus_cos is not None:
            steps.extend(_one_minus_cos_over_x_squared_steps(expr, symbol, one_minus_cos))
            return steps

    # Nunca deveria acontecer no fluxo normal — `steps/dispatcher.py` só
    # chama esta função quando `is_trigonometric_fundamental_shape` já
    # confirmou uma das quatro formas. Defesa contra uso indevido direto.
    raise ExpressionError(UNSUPPORTED_LIMIT_MESSAGE)
