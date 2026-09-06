"""Hardening Global — núcleo de derivação implícita, compartilhado por
`calculus/dispatcher.py` (`/solve`, só o valor final) e `steps/implicit_
differentiation.py` (`/solve/steps`, valor final + passos). Promovido
para `calculus/` (peer de `derivatives.py`/`limits.py`) porque `math_
engine` fora de `steps/` nunca importa `steps/` (fronteira arquitetural
já documentada em `app/execution.py`/`calculus/dispatcher.py` — `steps/`
é uma camada de apresentação construída SOBRE `math_engine`, nunca o
contrário). Antes desta rodada de hardening, esta lógica só existia
dentro de `steps/implicit_differentiation.py`: `derivada(EQUAÇÃO, x)`
funcionava em `/solve/steps` mas nunca em `/solve` — bug real encontrado
testando a nova tecla "dy/dx" no navegador (o botão "Resolver" devolvia
400, já que `solve_calculus_text` tentava fazer `_parse_fragment` (parser
de EXPRESSÃO comum) engolir um "=" e falhava).

Reaproveita SEMPRE `compute_derivative` (nunca reimplementa uma regra de
derivada) e `sympy.idiff` como ORÁCULO de validação (nunca gerador do
valor em si) — mesmo espírito e mesmas decisões de design já validadas em
`steps/implicit_differentiation.py` (ver a docstring completa daquele
módulo para a justificativa detalhada de cada escolha: y representado
como `Function(x)` para que `sympy.diff` produza `Derivative(y(x), x)`
automaticamente, isolamento via `.as_independent()`+`.coeff()` em vez de
`linear_equations.reduce_to_value` — que falha para somas de termos com
coeficientes simbólicos distintos em `Derivative(y(x), x)`)."""
from __future__ import annotations

import re

from sympy import Derivative, Function, expand, idiff, simplify
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ...canonical_constants import canonicalize_euler_constant
from ..equations.dispatcher import looks_like_equation, split_equation_sides
from ..errors import ExpressionError
from ..safe_parsing import extract_safe_symbols, safe_parse_expr
from .derivatives import compute_derivative

# "e" nunca conta como candidato a variável dependente — é o símbolo que o
# usuário digita para a constante de Euler antes de `canonicalize_euler_
# constant` resolvê-lo (mesma ambiguidade de `canonical_constants.py`).
_RESERVED_NAMES = frozenset({"e"})

NO_DEPENDENT_VARIABLE_MESSAGE = (
    "Esta equação não depende de nenhuma outra variável além de x — não há "
    "derivação implícita a fazer aqui."
)
MULTIPLE_DEPENDENT_VARIABLES_MESSAGE = (
    "Derivação implícita com mais de uma variável dependente ainda não é "
    "suportada nesta versão."
)


def looks_like_implicit_derivative_argument(expr_text: str) -> bool:
    """Sprint "Derivação Implícita" (promovida aqui no hardening) — só a
    FORMA textual: o primeiro argumento de `derivada(...)` parece uma
    equação ("=" de nível raiz). Nunca decide se a equação é de fato
    suportada — isso é responsabilidade de `parse_implicit_equation`."""
    return looks_like_equation(expr_text)


def parse_implicit_equation(expr_text: str, x_symbol: Symbol) -> tuple[Expr, Expr, str]:
    """`(lhs, rhs, nome_da_variável_dependente)` — divide a equação em
    texto (nunca deixando o SymPy avaliar a igualdade, mesma técnica de
    `split_equation_sides`), descobre a ÚNICA variável dependente via
    `extract_safe_symbols` (mesma extração já usada em todo o motor para
    parâmetros livres) e reparseia os dois lados com essa variável
    representada como `Function(x)` — o que faz `sympy.diff` já produzir
    `Derivative(y(x), x)` automaticamente para qualquer termo com ela,
    sem nenhuma regra de derivada nova."""
    lhs_text, rhs_text = split_equation_sides(expr_text)
    candidates = extract_safe_symbols(
        f"{lhs_text}+{rhs_text}", exclude={x_symbol.name, *_RESERVED_NAMES}
    )
    if not candidates:
        raise ExpressionError(NO_DEPENDENT_VARIABLE_MESSAGE)
    if len(candidates) > 1:
        raise ExpressionError(MULTIPLE_DEPENDENT_VARIABLES_MESSAGE)
    y_name = next(iter(candidates))
    y_func = Function(y_name)(x_symbol)
    local_dict = {x_symbol.name: x_symbol, y_name: y_func}

    lhs = canonicalize_euler_constant(safe_parse_expr(lhs_text, local_dict=local_dict))
    rhs = canonicalize_euler_constant(safe_parse_expr(rhs_text, local_dict=local_dict))

    if not (lhs.has(y_func) or rhs.has(y_func)):
        # Defensivo — nunca deveria disparar no fluxo normal, já que
        # `extract_safe_symbols` já confirmou a presença textual de
        # `y_name` antes do parse completo.
        raise ExpressionError(NO_DEPENDENT_VARIABLE_MESSAGE)

    return lhs, rhs, y_name


def compute_implicit_derivative(lhs: Expr, rhs: Expr, y_name: str, x_symbol: Symbol) -> Expr:
    """Deriva os dois lados (`compute_derivative`, o mesmo motor real) e
    isola `Derivative(y(x), x)` algebricamente — nunca via `solve()` como
    caixa-preta. Toda equação obtida derivando UMA vez uma equação
    algébrica em x/y é, por construção da regra da cadeia, LINEAR em
    `Derivative(y(x), x)`, então "mover os termos com a derivada para um
    lado, fatorar via `.coeff()`, dividir" sempre basta. Fail-closed:
    verificado contra `sympy.idiff` (ORÁCULO, nunca gerador do valor) antes
    de devolver — nunca um resultado não verificado."""
    y_func = Function(y_name)(x_symbol)
    derivative = Derivative(y_func, x_symbol)

    dlhs = compute_derivative(lhs, x_symbol)
    drhs = compute_derivative(rhs, x_symbol)

    diff_eq = expand(dlhs - drhs)
    if not diff_eq.has(derivative):
        raise ExpressionError(NO_DEPENDENT_VARIABLE_MESSAGE)

    independent, dependent = diff_eq.as_independent(derivative, as_Add=True)
    coeff = dependent.coeff(derivative)
    isolated = simplify(-independent / coeff)

    try:
        oracle = idiff(lhs - rhs, y_func, x_symbol)
        verified = simplify(isolated - oracle) == 0
    except Exception:
        verified = False
    if not verified:
        raise ExpressionError(
            f"Não foi possível verificar a derivação implícita de {lhs}={rhs} nesta versão."
        )

    return isolated


def rename_implicit_derivative_text(text: str, y_name: str, x_name: str) -> str:
    """"Derivative(y(x), x)" -> "derivada(y, x)" (renderiza como
    \\frac{d}{dx}(y) via `to-latex.ts`, já testado em produção), e
    qualquer "y(x)" que sobrar (ex. dentro de "-x/y(x)", o resultado
    isolado de `compute_implicit_derivative`) -> "y". Compartilhada por
    `/solve` (`calculus/dispatcher.py`, uma string) e `/solve/steps`
    (`steps/implicit_differentiation.py`, aplicada a cada `MathStep`) —
    achado real testando `/solve` no navegador: sem isto, o resultado
    de `derivada(x²+y²=25, x)` vazava como "Derivada: -x/y(x)" em vez de
    "Derivada: -x/y". A ORDEM importa: o padrão de `Derivative` precisa
    casar ANTES do padrão solto de `y(x)`, senão o "y(x)" de dentro de
    "Derivative(y(x), x)" seria consumido primeiro e quebraria o
    casamento do padrão maior."""
    derivative_pattern = re.compile(
        rf"Derivative\({re.escape(y_name)}\({re.escape(x_name)}\),\s*{re.escape(x_name)}\)"
    )
    text = derivative_pattern.sub(f"derivada({y_name}, {x_name})", text)
    function_pattern = re.compile(rf"\b{re.escape(y_name)}\({re.escape(x_name)}\)")
    return function_pattern.sub(y_name, text)
