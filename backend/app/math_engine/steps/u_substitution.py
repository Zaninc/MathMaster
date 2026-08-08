"""Sprint V2.14 — passo a passo de integração por substituição
(u-substitution): `∫f(g(x))·g'(x) dx`, reescrita como `∫f(u) du` via
`u=g(x)`. Camada puramente didática — NUNCA um segundo resolvedor de
integrais: reaproveita `calculus/dispatcher.py:parse_integral_call` (o
mesmo parser da V2.10.1) e, principalmente,
`calculus/integrals.py:compute_indefinite_integral` (o MESMO
`sympy.integrate` que o `/solve` já usa) para o valor final mostrado.
Mesmo o antiderivada EM TERMOS DE u (`∫f(u) du`) vem de uma chamada REAL
a `compute_indefinite_integral` — nunca uma tabela de regras "sen->−cos,
potência->n+1" escrita à mão: aplicamos o MESMO integrador real a um
integrando mais simples (`f(u)`), exatamente a ideia central da
substituição. Este módulo só decide COMO fatiar essa troca de variável em
etapas; nunca calcula uma integral por conta própria.

Detecção via ÁRVORE do SymPy, nunca regex: para cada fator do integrando
(`expr.args` se `expr.is_Mul`, senão o próprio `expr`), verifica se é uma
composição `sen`/`cos`/`exp` de um argumento que NÃO é a própria variável,
ou uma potência inteira (positiva OU negativa — cobre `1/g(x)`, que leva a
`ln|u|`) de uma base composta — mesmo padrão de
`advanced_derivatives._chain_shape` (V2.11), estendido para aceitar
expoente negativo. O restante do produto precisa ser um múltiplo
CONSTANTE (`.has(symbol)` falso) da derivada do argumento interno
(`diff()`) — se não for, essa substituição não é "imediata" e este fator
é descartado (nunca "chuta").

`is_u_substitution_shape` é chamada por `steps/dispatcher.py` ANTES de
`integrals.py` (V2.10.1) — necessário porque `2x(x²+1)³` TAMBÉM se
expande para um polinômio que `integrals.py` saberia integrar termo a
termo, mas o objetivo desta sprint é ENSINAR a substituição nesses casos,
não escondê-la atrás da expansão (mesmo raciocínio já usado pela V2.11
para produto/cadeia vs. regra da potência)."""
from __future__ import annotations

import re

from sympy import cancel, cos, diff, exp, sin
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..calculus.dispatcher import parse_integral_call
from ..calculus.integrals import compute_indefinite_integral
from ..errors import ExpressionError
from .formatting import INTEGRATION_CONSTANT_EXPLANATION, substitute_symbol_text
from .models import MathStep
from .validation import UNSUPPORTED_INTEGRAL_MESSAGE

_Substitution = tuple[str, Expr, int | None, Expr, Expr]
_TRIG_EXP_FUNCS = {sin: "sin", cos: "cos", exp: "exp"}
_OUTER_TEMPLATE = {"sin": "sin(u)", "cos": "cos(u)", "exp": "exp(u)"}

# Mesma convenção/técnica já usada em `calculus/dispatcher.py`/
# `logarithms/dispatcher.py`/`quotient_rule.py` (duplicada aqui
# deliberadamente — cada área é self-contained): qualquer "log(" que
# sobreviver num valor real do SymPy é sempre log NATURAL, então renomear
# para "ln(" ao construir a string de apresentação é sempre seguro.
# Necessário aqui porque `∫1/(2x+1)dx` (caso exigido desta sprint) integra
# para `log(...)`.
_NATURAL_LOG_PATTERN = re.compile(r"\blog(?=\()")


def _rename_natural_log(text: str) -> str:
    return _NATURAL_LOG_PATTERN.sub("ln", text)


def _factor_list(expr: Expr) -> list[Expr]:
    return list(expr.args) if expr.is_Mul else [expr]


def _outer_shape(factor: Expr, symbol: Symbol) -> tuple[str, Expr, int | None] | None:
    """`(kind, interna, expoente)` se `factor` for `sen(g)`/`cos(g)`/
    `exp(g)`, ou `g**n` (`n` inteiro != 0 e != 1 — inclui expoentes
    negativos, ex. `g**-1` -> `1/g`), com `g` dependendo de `symbol` e
    diferente do próprio `symbol`. `None` (nunca "chuta") para qualquer
    outra forma — incluindo potência da própria variável (`x²`, já
    coberta pela regra da potência da V2.10.1)."""
    if factor.is_Pow and factor.exp.is_Integer and factor.exp not in (0, 1):
        base = factor.base
        if base.has(symbol) and base != symbol:
            return "pow", base, int(factor.exp)
        return None
    if factor.func in _TRIG_EXP_FUNCS:
        arg = factor.args[0]
        if arg.has(symbol) and arg != symbol:
            return _TRIG_EXP_FUNCS[factor.func], arg, None
    return None


def find_substitution(expr: Expr, symbol: Symbol) -> _Substitution | None:
    """Primeiro fator do integrando (na ordem de `expr.args`) cuja forma
    composta, combinada com o restante do produto, revela uma
    substituição imediata: `(kind, interna, expoente, coeficiente,
    fator_composto)`. `coeficiente` é o múltiplo constante que sobra
    depois de dividir o restante do produto pela derivada da parte
    interna (`du`) — pode ser qualquer racional, não só inteiro (ex.
    `∫1/(2x+1)dx`, coeficiente 1/1 depois de cancelar o 2 do próprio
    `du`). `None` se nenhum fator render uma substituição imediata."""
    for factor in _factor_list(expr):
        shape = _outer_shape(factor, symbol)
        if shape is None:
            continue
        kind, inner, exponent = shape
        inner_derivative = diff(inner, symbol)
        if inner_derivative == 0:
            continue
        rest = cancel(expr / factor)
        coefficient = cancel(rest / inner_derivative)
        if coefficient.has(symbol):
            continue
        return kind, inner, exponent, coefficient, factor
    return None


def is_u_substitution_shape(expr: Expr, symbol: Symbol) -> bool:
    return find_substitution(expr, symbol) is not None


def _outer_u_expr(kind: str, exponent: int | None, u: Symbol) -> Expr:
    if kind == "pow":
        return u**exponent
    if kind == "sin":
        return sin(u)
    if kind == "cos":
        return cos(u)
    return exp(u)  # kind == "exp"


def generate_u_substitution_steps(text: str) -> list[MathStep]:
    expr, symbol = parse_integral_call(text)
    steps = [MathStep(title="Integral original", expression=f"integral({expr}, {symbol})")]

    substitution = find_substitution(expr, symbol)
    if substitution is None:
        # Nunca deveria acontecer no fluxo normal — `steps/dispatcher.py`
        # só chama esta função quando `is_u_substitution_shape` já
        # confirmou a forma. Defesa contra uso indevido direto do módulo.
        raise ExpressionError(UNSUPPORTED_INTEGRAL_MESSAGE)

    kind, inner, exponent, coefficient, _factor = substitution
    u = Symbol("u")

    steps.append(MathStep(title="Identificando uma substituição", expression=f"u={inner}"))

    inner_derivative = diff(inner, symbol)
    steps.append(
        MathStep(title="Derivando u", expression=f"du={inner_derivative}*dx")
    )

    outer_u = _outer_u_expr(kind, exponent, u)
    u_integral_text = f"integral({outer_u}, {u})"
    if coefficient != 1:
        u_integral_text = f"{coefficient}*{u_integral_text}"
    steps.append(
        MathStep(title="Substituindo", expression=_rename_natural_log(u_integral_text))
    )

    u_antiderivative = coefficient * compute_indefinite_integral(outer_u, u)
    steps.append(
        MathStep(title="Integrando", expression=_rename_natural_log(str(u_antiderivative)))
    )

    back_to_x = substitute_symbol_text(u_antiderivative, u, inner)
    steps.append(MathStep(title="Voltando para x", expression=_rename_natural_log(back_to_x)))

    primitive = compute_indefinite_integral(expr, symbol)
    steps.append(
        MathStep(
            title="Adicionando a constante de integração",
            explanation=INTEGRATION_CONSTANT_EXPLANATION,
            expression=_rename_natural_log(f"{primitive} + C"),
        )
    )
    return steps
