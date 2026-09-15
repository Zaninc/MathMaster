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

from sympy import Derivative, Function, expand, fraction, idiff, reduced, simplify, together
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


def reduce_using_original_equation(isolated: Expr, lhs: Expr, rhs: Expr) -> Expr:
    """Sprint V3.0.6 (Derivação Implícita de Ordem Superior) — tenta
    reduzir `isolated` (o resultado de ordem >= 2, tipicamente com
    potências de x e/ou y sobrando) usando a equação ORIGINAL como
    restrição polinomial — a mesma técnica de divisão polinomial
    (`sympy.reduced`, base de Gröbner de UM só polinômio) que já resolve
    frações parciais/divisão polinomial em `steps/partial_fractions.py`/
    `steps/polynomial_division.py`, nunca uma substituição hardcoded pra
    "x²+y²=25" — funciona pra QUALQUER restrição polinomial em x/y.
    Best-effort: se a restrição não é polinomial nesses geradores (ex.
    envolve `sin`/`log`) ou a redução falha por qualquer motivo,
    devolve `isolated` sem alteração — o resultado já verificado contra
    o oráculo `idiff` continua correto, só potencialmente menos "bonito"."""
    constraint = expand(lhs - rhs)
    try:
        numerator, denominator = fraction(together(isolated))
        _, remainder = reduced(numerator, [constraint])
        reduced_expr = simplify(remainder / denominator)
    except Exception:
        return isolated
    return reduced_expr if reduced_expr != isolated else isolated


def compute_implicit_derivative(
    lhs: Expr, rhs: Expr, y_name: str, x_symbol: Symbol, order: int = 1
) -> Expr:
    """Deriva os dois lados (`compute_derivative`, o mesmo motor real) e
    isola `Derivative(y(x), x, ordem)` algebricamente — nunca via
    `solve()` como caixa-preta. Toda equação obtida derivando UMA vez uma
    equação algébrica em x/y é, por construção da regra da cadeia, LINEAR
    na derivada de maior ordem presente, então "mover os termos com ela
    para um lado, fatorar via `.coeff()`, dividir" sempre basta — em
    QUALQUER ordem, por indução: a prova de que y=y(x) nunca se perde
    (item central desta sprint) é estrutural, não um truque por ordem —
    `y` é sempre `Function(x)` (nunca um Symbol comum), então `sympy.diff`
    já produz `Derivative(y(x), x, k)` automaticamente pra QUALQUER k,
    tanto na PRIMEIRA quanto em cada diferenciação SEGUINTE da própria
    equação já diferenciada.

    Sprint V3.0.6 — generalização por LOOP (nunca `if order==2`/`if
    order==3`): a cada rodada k, isola `Derivative(y(x), x, k)` da
    equação atual, substitui as derivadas de ordem MENOR já isoladas
    (`substitutions`, preenchido rodada a rodada) e, se ainda não chegou
    na ordem pedida, deriva a MESMA equação relativa ("derivada_k -
    isolada_k = 0") mais uma vez — exatamente o algoritmo de `sympy.idiff`
    (usado abaixo como ORÁCULO independente, `idiff(..., order)`, que já
    suporta ordem n nativamente — `MAX_DERIVATIVE_ORDER` em `calculus/
    dispatcher.py` limita `order` antes de chegar aqui). Ordem 1 é o caso
    de sempre (loop roda uma única vez, substitutions vazio, comportamento
    e resultado IDÊNTICOS à versão anterior desta função — confirmado por
    regressão).

    A partir de ordem 2, tenta uma simplificação adicional usando a
    equação ORIGINAL como restrição (`reduce_using_original_equation`,
    Gröbner de um polinômio só, nunca hardcoded pra um caso específico) —
    é isso que reduz `(-x²-y²)/y³` pra `-25/y³` quando a restrição é
    "x²+y²=25", sem jamais mencionar "25" ou "círculo" em código algum.

    Fail-closed: verificado contra `sympy.idiff` (ORÁCULO, nunca gerador
    do valor) antes de devolver — nunca um resultado não verificado."""
    y_func = Function(y_name)(x_symbol)

    diff_eq = expand(compute_derivative(lhs, x_symbol) - compute_derivative(rhs, x_symbol))
    substitutions: dict[Expr, Expr] = {}
    isolated: Expr | None = None

    for k in range(1, order + 1):
        target = Derivative(y_func, x_symbol, k)
        if not diff_eq.has(target):
            raise ExpressionError(NO_DEPENDENT_VARIABLE_MESSAGE)

        independent, dependent = diff_eq.as_independent(target, as_Add=True)
        coeff = dependent.coeff(target)
        isolated = simplify((-independent / coeff).subs(substitutions))

        if k == order:
            break
        substitutions[target] = isolated
        # Deriva "target = isolated" (equivalente a "target - isolated =
        # 0") mais uma vez em relação a x — a MESMA técnica de
        # `sympy.idiff` (ver `derivs`/`eq = dydx - yp` no código-fonte do
        # SymPy), generalizada por indução: eleva a ordem em 1 a cada
        # rodada, sem nenhum caso especial por k.
        diff_eq = expand(compute_derivative(target - isolated, x_symbol))

    assert isolated is not None  # order >= MIN_DERIVATIVE_ORDER (>= 1) sempre garante 1+ rodada

    # Verificação SEMPRE contra a forma NÃO reduzida — `oracle` também é
    # uma expressão em x/y de verdade (não usa a restrição original pra
    # simplificar), então comparar contra a versão JÁ reduzida pela
    # restrição (abaixo) sempre falharia: a igualdade só vale QUANDO a
    # restrição é respeitada, nunca como identidade simbólica livre.
    try:
        oracle = idiff(lhs - rhs, y_func, x_symbol, order)
        verified = simplify(isolated - oracle) == 0
    except Exception:
        verified = False
    if not verified:
        raise ExpressionError(
            f"Não foi possível verificar a derivação implícita de ordem {order} de "
            f"{lhs}={rhs} nesta versão."
        )

    # A redução pela restrição original só acontece DEPOIS da verificação
    # acima — é uma simplificação adicional, válida porque a restrição
    # (lhs=rhs) é justamente a premissa do problema, nunca um atalho que
    # escapa da prova contra o oráculo.
    if order >= 2:
        isolated = reduce_using_original_equation(isolated, lhs, rhs)

    return isolated


def rename_implicit_derivative_text(text: str, y_name: str, x_name: str, order: int = 1) -> str:
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
    casamento do padrão maior.

    Sprint V3.0.6 — `order` opcional (padrão 1, comportamento IDÊNTICO ao
    de antes): quando > 1, casa TAMBÉM a forma `Derivative(y(x), (x, n))`
    que o SymPy imprime pra derivadas de ordem >= 2 — sintaxe diferente
    de propósito (SymPy nunca imprime "(x, 1)" pra ordem 1), reescrita pra
    a MESMA sintaxe canônica `derivada(y, x, n)` que o resto do produto já
    usa pra qualquer derivada explícita de ordem n (`to-latex.ts` já
    sabe renderizar isso como `\\frac{d^n}{dx^n}(y)`, reaproveitado de
    graça — nenhuma notação nova só pra derivação implícita)."""
    if order > 1:
        higher_order_pattern = re.compile(
            rf"Derivative\({re.escape(y_name)}\({re.escape(x_name)}\),\s*"
            rf"\({re.escape(x_name)},\s*(\d+)\)\)"
        )
        text = higher_order_pattern.sub(rf"derivada({y_name}, {x_name}, \1)", text)
    derivative_pattern = re.compile(
        rf"Derivative\({re.escape(y_name)}\({re.escape(x_name)}\),\s*{re.escape(x_name)}\)"
    )
    text = derivative_pattern.sub(f"derivada({y_name}, {x_name})", text)
    function_pattern = re.compile(rf"\b{re.escape(y_name)}\({re.escape(x_name)}\)")
    return function_pattern.sub(y_name, text)
