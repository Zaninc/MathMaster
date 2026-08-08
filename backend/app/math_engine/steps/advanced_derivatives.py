"""Sprint V2.11 — passo a passo de derivadas pela regra do produto e pela
regra da cadeia. Camada puramente didática — NUNCA um segundo motor de
derivadas: reaproveita `calculus/dispatcher.py:parse_derivative_call` (o
MESMO parser já usado pela V2.10) e, principalmente,
`calculus/derivatives.py:compute_derivative` (o MESMO `sympy.diff` que o
`/solve` já usa) para TODO valor final mostrado — inclusive o de cada
fator/parte isolada. Este módulo só decide COMO apresentar o cálculo em
etapas; nunca recalcula uma derivada por conta própria.

Detecção via ÁRVORE do SymPy, nunca regex: `expr.is_Mul` (produto de
EXATAMENTE dois fatores não numéricos, ambos dependendo da variável, sem
denominador — `x/sin(x)` tem denominador `sin(x)` != 1, é quociente, fora
de escopo) para a regra do produto; `Pow` de base composta com expoente
inteiro >= 2, ou `sin`/`cos`/`exp` de um argumento que NÃO é a própria
variável isolada (`sin(x²)`, nunca `sin(x)` — esse é trivial, sem cadeia de
verdade), para a regra da cadeia.

`is_product_or_chain_shape` é chamada por `steps/dispatcher.py` ANTES de
decidir entre este módulo e `derivatives.py` (V2.10) — necessário porque
`(x+1)*(x²+3)`, `(x²+1)³` e `(3x+2)⁵` TAMBÉM se expandem para polinômios
simples que `derivatives.py` saberia "resolver" por linearidade da soma,
mas o objetivo desta sprint é ENSINAR a regra do produto/cadeia nesses
casos, não escondê-la atrás da expansão polinomial — por isso a detecção
acontece sobre a árvore ORIGINAL (nunca expandida)."""
from __future__ import annotations

from sympy import cos, exp, sin
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..calculus.derivatives import compute_derivative
from ..calculus.dispatcher import parse_derivative_call
from ..errors import ExpressionError
from .formatting import wrap_if_sum
from .models import MathStep
from .validation import UNSUPPORTED_DERIVATIVE_MESSAGE

_ChainShape = tuple[str, Expr, int | None]

_OUTER_TEMPLATE = {"sin": "sin(u)", "cos": "cos(u)", "exp": "exp(u)"}
_TRIG_EXP_FUNCS = {sin: "sin", cos: "cos", exp: "exp"}


def _chain_shape(expr: Expr, symbol: Symbol) -> _ChainShape | None:
    """`(kind, interna, expoente)` se `expr` for uma composição que a
    regra da cadeia desta versão sabe explicar. `None` (nunca "chuta")
    para qualquer outra forma — incluindo potência da própria variável
    (`x²`, já coberta pela regra da potência da V2.10) e `sin`/`cos`/`exp`
    cujo argumento já é a variável isolada (trivial, sem cadeia)."""
    if expr.is_Pow and expr.exp.is_Integer and expr.exp >= 2:
        base = expr.base
        if base.has(symbol) and base != symbol:
            return "pow", base, int(expr.exp)
        return None
    if expr.func in _TRIG_EXP_FUNCS:
        arg = expr.args[0]
        if arg.has(symbol) and arg != symbol:
            return _TRIG_EXP_FUNCS[expr.func], arg, None
    return None


def _product_shape(expr: Expr, symbol: Symbol) -> tuple[Expr, Expr] | None:
    """`(f, g)` se `expr` for um produto de EXATAMENTE dois fatores não
    numéricos, ambos dependendo de `symbol`. `None` para monômio simples
    (`4*x²`, um único fator simbólico depois do coeficiente — continua no
    caminho da V2.10) ou qualquer outra forma."""
    if not expr.is_Mul:
        return None
    coeff, rest = expr.as_coeff_Mul()
    if coeff != 1:
        return None
    factors = rest.args if rest.is_Mul else (rest,)
    if len(factors) != 2:
        return None
    f, g = factors
    if not (f.has(symbol) and g.has(symbol)):
        return None
    return f, g


def is_product_or_chain_shape(expr: Expr, symbol: Symbol) -> bool:
    """Sprint V2.11 — usada por `steps/dispatcher.py` para decidir o
    roteamento ANTES de qualquer expansão polinomial. Denominador != 1
    (`x/sin(x)`, quociente) é verificado uma única vez aqui, então nunca
    chega a `_product_shape`/`_chain_shape`."""
    if expr.as_numer_denom()[1] != 1:
        return False
    return _product_shape(expr, symbol) is not None or _chain_shape(expr, symbol) is not None


def _outer_derivative_at_u(kind: str, exponent: int | None, u: Symbol) -> Expr:
    if kind == "pow":
        return exponent * u ** (exponent - 1)
    if kind == "sin":
        return cos(u)
    if kind == "cos":
        return -sin(u)
    return exp(u)  # kind == "exp"


def _pow_chain_apply_text(exponent: int, inner: Expr, inner_derivative: Expr) -> str:
    """"expoente*(interna)**(expoente-1)*(derivada da interna)" SEM
    simplificar — construída manualmente (mesmo motivo de
    `derivatives._power_rule_unevaluated_text`: o printer do SymPy
    reordenaria os fatores de forma imprevisível se deixado calcular um
    `Mul` não avaliado sozinho)."""
    inner_text = f"({inner})"
    power_text = inner_text if exponent - 1 == 1 else f"{inner_text}**{exponent - 1}"
    return f"{exponent}*{power_text}*{wrap_if_sum(inner_derivative)}"


def _chain_rule_steps(expr: Expr, symbol: Symbol, shape: _ChainShape) -> tuple[Expr, list[MathStep]]:
    """Passos da regra da cadeia para UMA expressão composta já
    classificada por `_chain_shape`. Devolve `(derivada, passos)` — a
    derivada final vem sempre de `compute_derivative` (motor real)."""
    kind, inner, exponent = shape
    u = Symbol("u")
    outer_text = f"u**{exponent}" if kind == "pow" else _OUTER_TEMPLATE[kind]

    steps = [
        MathStep(title="Identificando função composta", expression=f"u={inner}, y={outer_text}")
    ]

    outer_derivative = _outer_derivative_at_u(kind, exponent, u)
    steps.append(MathStep(title="Derivando a externa", expression=str(outer_derivative)))

    inner_derivative = compute_derivative(inner, symbol)
    steps.append(MathStep(title="Derivando a interna", expression=str(inner_derivative)))

    total = compute_derivative(expr, symbol)
    if kind == "pow":
        apply_text = _pow_chain_apply_text(exponent, inner, inner_derivative)
        steps.append(MathStep(title="Aplicando a regra da cadeia", expression=apply_text))
        steps.append(MathStep(title="Simplificando", expression=str(total)))
    else:
        # sin/cos/exp de argumento composto: o valor já canônico do motor
        # real É a aplicação da cadeia — nunca um passo de "simplificação"
        # redundante mostrando a mesma string duas vezes (diferente da
        # potência, cujo resultado bruto da regra precisa de reordenação
        # visível, ver `_pow_chain_apply_text`).
        steps.append(MathStep(title="Aplicando a regra da cadeia", expression=str(total)))

    return total, steps


def factor_derivative_steps(
    expr: Expr, symbol: Symbol, label: str, *, trivial_title: str | None = None
) -> tuple[Expr, list[MathStep]]:
    """Derivada de UMA parte isolada — um fator de produto (V2.11) ou o
    numerador/denominador de um quociente (V2.13): se a parte exige a
    regra da cadeia, embute os passos completos (`_chain_rule_steps`); se
    exige a regra do produto (ex. `(x+1)*(x²+3)` como numerador de um
    quociente), embute `_product_rule_steps` recursivamente; senão, um
    único passo com o valor real de `compute_derivative` — cobre tanto
    partes triviais (`x`, `x+1`) quanto funções já simples cujo argumento
    é a própria variável (`sin(x)`, `exp(x)` — sem cadeia de verdade).
    `trivial_title` sobrescreve o título padrão "Derivando {label}" do
    caso trivial (V2.13 usa "Calculando {label}'"); `None` preserva o
    comportamento exato já usado pela V2.11 desde sempre."""
    shape = _chain_shape(expr, symbol)
    if shape is not None:
        return _chain_rule_steps(expr, symbol, shape)
    product = _product_shape(expr, symbol)
    if product is not None:
        f, g = product
        derivative = compute_derivative(expr, symbol)
        return derivative, _product_rule_steps(expr, f, g, symbol)
    derivative = compute_derivative(expr, symbol)
    title = trivial_title if trivial_title is not None else f"Derivando {label}"
    return derivative, [MathStep(title=title, expression=str(derivative))]


def _product_rule_steps(expr: Expr, f: Expr, g: Expr, symbol: Symbol) -> list[MathStep]:
    steps = [
        MathStep(title="Identificando um produto", expression=f"f={f}, g={g}"),
        MathStep(
            title="Aplicando a regra do produto",
            expression=(
                f"derivada(f*g, {symbol})=derivada(f, {symbol})*g+f*derivada(g, {symbol})"
            ),
        ),
    ]

    f_derivative, f_steps = factor_derivative_steps(f, symbol, "f")
    steps.extend(f_steps)
    g_derivative, g_steps = factor_derivative_steps(g, symbol, "g")
    steps.extend(g_steps)

    substitution = (
        f"{wrap_if_sum(f_derivative)}*{wrap_if_sum(g)}"
        f"+{wrap_if_sum(f)}*{wrap_if_sum(g_derivative)}"
    )
    steps.append(MathStep(title="Substituindo", expression=substitution))

    total = compute_derivative(expr, symbol)
    steps.append(MathStep(title="Simplificando", expression=str(total)))
    return steps


def generate_advanced_derivative_steps(text: str) -> list[MathStep]:
    expr, symbol = parse_derivative_call(text)
    steps = [MathStep(title="Função original", expression=f"derivada({expr}, {symbol})")]

    if expr.as_numer_denom()[1] != 1:
        raise ExpressionError(UNSUPPORTED_DERIVATIVE_MESSAGE)

    product = _product_shape(expr, symbol)
    if product is not None:
        f, g = product
        steps.extend(_product_rule_steps(expr, f, g, symbol))
        return steps

    chain = _chain_shape(expr, symbol)
    if chain is not None:
        _, chain_steps = _chain_rule_steps(expr, symbol, chain)
        steps.extend(chain_steps)
        return steps

    # Nunca deveria acontecer no fluxo normal — `steps/dispatcher.py` só
    # chama esta função quando `is_product_or_chain_shape` já confirmou
    # uma das duas formas. Defesa contra uso indevido direto deste módulo.
    raise ExpressionError(UNSUPPORTED_DERIVATIVE_MESSAGE)
