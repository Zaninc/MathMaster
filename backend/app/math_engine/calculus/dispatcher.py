r"""Sprint 12 — dispatcher de cálculo (derivada, integral, limite).

Sintaxe própria, sem notação algébrica livre — mesmo padrão de
`analytic_geometry/` (cada operação é uma chamada nomeada explícita):

    derivada(expr, var)
    integral(expr, var)                        -> indefinida, "+ C" só na apresentação
    integral(expr, var, inferior, superior)     -> definida
    limite(expr, var, ponto)                    -> bilateral (ver limits.py)

Notação livre (d/dx, ∫...dx, lim_{x->0}) exigiria gramática nova, fora do
escopo desta sprint (reservada para o futuro Parser Inteligente); "->"/">"
também colidiriam com o roteador de equações (`_INEQUALITY_PATTERN`) — a
sintaxe por vírgula evita isso por completo.

Cálculo entra na cascata de `math_engine/dispatcher.py` ANTES de
`functions`/`trigonometry`/`logarithms`/`equations`: essas áreas decidem por
`.search()` livre no texto inteiro (ex. "\bsin\(" em qualquer posição da
string) — uma chamada como `integral(sin(x), x)` seria roubada por
`trigonometry` se cálculo fosse verificado depois. Ver auditoria da
Sprint 12.

Convenção do produto log=base10/ln=natural (`log_convention.py`) é aplicada
sempre ao corpo de qualquer operação de cálculo (decisão explícita da
Sprint 12) — diferente de `functions/`, que só aplica a convenção às 4
formas canônicas por um motivo de escopo específico daquela área que não
existe aqui.
"""
from __future__ import annotations

import re

from sympy import Symbol
from sympy.core.expr import Expr
from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    standard_transformations,
)

from ...canonical_constants import canonicalize_euler_constant
from ..errors import ExpressionError
from ..log_convention import LOCAL_DICT as _LOG_LOCAL_DICT
from ..safe_parsing import extract_safe_symbols, safe_parse_expr
from .derivatives import compute_derivative
from .integrals import compute_definite_integral, compute_indefinite_integral, verify_antiderivative
from .limits import compute_limit

_TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application,)

_CALL_PATTERN = re.compile(r"^\s*(derivada|integral|limite)\s*\((.*)\)\s*$", re.DOTALL)
_VARIABLE_PATTERN = re.compile(r"^[a-zA-Z_]\w*$")

# "log(" nativo do SymPy que sobreviver na saída é sempre log natural (a
# nossa base 10 nunca aparece como um nó "log(...)" isolado — mesmo
# raciocínio já usado por `logarithms/dispatcher.py`/`functions/dispatcher.py`).
_NATURAL_LOG_PATTERN = re.compile(r"\blog(?=\()")


def _rename_natural_log(text: str) -> str:
    return _NATURAL_LOG_PATTERN.sub("ln", text)


def is_calculus_domain_expression(expression: str) -> bool:
    return bool(_CALL_PATTERN.match(expression))


def is_derivative_call(expression: str) -> bool:
    """Sprint V2.10 (Passo a Passo — Derivadas) — mesmo padrão de
    `is_calculus_domain_expression`, mas restrito à operação `derivada`
    especificamente (`integral`/`limite` continuam fora do escopo do
    passo a passo). Usado por `steps/dispatcher.py` para decidir o
    roteamento ANTES da exclusão geral de domínio de cálculo."""
    match = _CALL_PATTERN.match(expression)
    return bool(match) and match.group(1) == "derivada"


def is_indefinite_integral_call(expression: str) -> bool:
    """Sprint V2.10.1 (Passo a Passo — Integrais) — mesmo padrão de
    `is_derivative_call`, restrito a `integral(expr, var)` com EXATAMENTE 2
    argumentos (indefinida). A forma de 4 argumentos (definida,
    `integral(expr, var, inferior, superior)`) tem seu próprio par
    `is_definite_integral_call`/`parse_definite_integral_call` desde a
    V2.10.2 — as duas nunca colidem (contagem de argumentos é mutuamente
    exclusiva)."""
    match = _CALL_PATTERN.match(expression)
    if not match or match.group(1) != "integral":
        return False
    return len(_split_top_level_args(match.group(2))) == 2


def is_definite_integral_call(expression: str) -> bool:
    """Sprint V2.10.2 (Passo a Passo — Integrais Definidas) — mesmo padrão
    de `is_indefinite_integral_call`, restrito a `integral(expr, var,
    inferior, superior)` com EXATAMENTE 4 argumentos."""
    match = _CALL_PATTERN.match(expression)
    if not match or match.group(1) != "integral":
        return False
    return len(_split_top_level_args(match.group(2))) == 4


def is_limit_call(expression: str) -> bool:
    """Sprint V2.12 (Passo a Passo — Limites) — mesmo padrão de
    `is_derivative_call`, restrito à operação `limite` (sempre 3
    argumentos: expressão, variável e ponto — nunca colide com `derivada`/
    `integral`, que são operações distintas do mesmo `_CALL_PATTERN`)."""
    match = _CALL_PATTERN.match(expression)
    return bool(match) and match.group(1) == "limite"


def _split_top_level_args(text: str) -> list[str]:
    """Mesma técnica de bracket-counting de `parser/normalize.py`/
    `formatter/safe_parse.py`, duplicada aqui deliberadamente — cada área do
    motor é self-contained (convenção registrada desde a Sprint 4/9)."""
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    for char in text:
        if char in "([{":
            depth += 1
        elif char in ")]}":
            depth -= 1
        if char == "," and depth == 0:
            parts.append("".join(current))
            current = []
            continue
        current.append(char)
    parts.append("".join(current))
    return [part.strip() for part in parts]


def _parse_variable(text: str) -> Symbol:
    if not _VARIABLE_PATTERN.match(text):
        raise ExpressionError(f"Nome de variável inválido: '{text}'.")
    return Symbol(text)


def _parse_fragment(text: str, symbol: Symbol):
    # Parâmetros livres (ex. o "A" de "A^(1/x)", ou "a"/"b"/"c" de
    # "a*x**2 + b*x + c") são descobertos explicitamente aqui, nunca
    # deixados para o fallback implícito do SymPy — `symbol` (a variável
    # ativa desta operação) e os nomes já conhecidos por `_LOG_LOCAL_DICT`
    # são excluídos, então nunca ganham uma segunda entrada nem são
    # tratados como parâmetro.
    extra_symbols = extract_safe_symbols(text, exclude={symbol.name, *_LOG_LOCAL_DICT})
    local_dict = {symbol.name: symbol, **_LOG_LOCAL_DICT, **extra_symbols}
    try:
        return safe_parse_expr(text, transformations=_TRANSFORMATIONS, local_dict=local_dict)
    except Exception as exc:
        raise ExpressionError(f"Não foi possível interpretar a expressão: {text}") from exc


def parse_derivative_call(expression: str) -> tuple[Expr, Symbol]:
    """Sprint V2.10 (Passo a Passo — Derivadas) — reaproveitável por
    `math_engine.steps.derivatives`: mesmo parsing que `solve_calculus_text`
    já faz para `derivada(expr, var)` (`_CALL_PATTERN`, `_split_top_level_
    args`, `_parse_variable`, `_parse_fragment` — nunca regex frágil
    novo), devolvendo `(expr, symbol)` já prontos em vez de já calcular a
    derivada. `compute_derivative`/`solve_calculus_text` continuam
    100% intocados — esta função só expõe o parsing que eles já usavam
    internamente.

    Hotfix V2.15.1 (paridade de Euler) — `expr` sai daqui já passado por
    `canonicalize_euler_constant` (ver nota completa em `parse_integral_call`
    abaixo)."""
    match = _CALL_PATTERN.match(expression)
    if not match or match.group(1) != "derivada":
        raise ExpressionError(f"Não foi possível interpretar a expressão: {expression}")
    _, argumentos = match.groups()
    partes = _split_top_level_args(argumentos)
    if len(partes) != 2:
        raise ExpressionError(
            "derivada(...) espera exatamente 2 argumentos: expressão e variável."
        )
    symbol = _parse_variable(partes[1])
    expr = canonicalize_euler_constant(_parse_fragment(partes[0], symbol))
    return expr, symbol


def parse_integral_call(expression: str) -> tuple[Expr, Symbol]:
    """Sprint V2.10.1 (Passo a Passo — Integrais) — mesmo espírito de
    `parse_derivative_call`: reaproveita o parsing que `solve_calculus_text`
    já faz para `integral(expr, var)`, restrito à forma INDEFINIDA (2
    argumentos — a única suportada pelo passo a passo nesta versão).
    `compute_indefinite_integral`/`solve_calculus_text` continuam 100%
    intocados.

    Hotfix V2.15.1 (paridade de Euler entre `/solve` e `/solve/steps`) —
    `expr` sai daqui já passado por `canonicalize_euler_constant`
    (`app/canonical_constants.py`, o MESMO helper que `solve_calculus_text`
    já aplicava ao RESULTADO de cada operação, e que `logarithms/
    dispatcher.py` já aplica à ENTRADA antes de classificar, ver linha 86
    daquele arquivo — mesmo precedente, reaproveitado aqui, nunca
    duplicado). Sem isto, `e^x`/`e**x` digitado à mão vira
    `Pow(Symbol('e'), x)` — uma árvore estruturalmente diferente de
    `exp(x)` para QUALQUER classificador que compare `factor.func` (
    `u_substitution._outer_shape`, `integration_by_parts._classify_factor`,
    e qualquer detector futuro que precise reconhecer uma exponencial) —
    fazendo `/solve/steps` cair no fallback amigável enquanto `/solve`
    (que nunca precisa classificar a FORMA da entrada, só integra/deriva
    direto e canonicaliza o resultado depois) resolvia normalmente.
    Aplicado aqui — no ÚNICO ponto de saída do parsing compartilhado por
    TODOS os módulos de `steps/` (cada um chama esta função ou uma das
    3 irmãs abaixo, nunca reimplementa parsing próprio) — em vez de
    dentro de cada detector individual, que duplicaria conhecimento
    sintático e deixaria qualquer detector futuro vulnerável ao mesmo
    bug. `_parse_fragment`/`solve_calculus_text` (o `/solve` propriamente
    dito) continuam INTOCADOS — só os 4 `parse_*_call` que o pacote
    `steps/` consome são afetados; `/solve` já tinha sua própria
    canonicalização (pós-cálculo) e seu comportamento não muda."""
    match = _CALL_PATTERN.match(expression)
    if not match or match.group(1) != "integral":
        raise ExpressionError(f"Não foi possível interpretar a expressão: {expression}")
    _, argumentos = match.groups()
    partes = _split_top_level_args(argumentos)
    if len(partes) != 2:
        raise ExpressionError(
            "Passo a passo disponível apenas para integrais indefinidas "
            "(2 argumentos: expressão e variável) nesta versão."
        )
    symbol = _parse_variable(partes[1])
    expr = canonicalize_euler_constant(_parse_fragment(partes[0], symbol))
    return expr, symbol


def parse_definite_integral_call(expression: str) -> tuple[Expr, Symbol, Expr, Expr]:
    """Sprint V2.10.2 (Passo a Passo — Integrais Definidas) — mesmo
    espírito de `parse_integral_call`, restrito à forma DEFINIDA (4
    argumentos). `compute_definite_integral`/`solve_calculus_text`
    continuam 100% intocados.

    Hotfix V2.15.1 (paridade de Euler) — `expr`/`lower`/`upper` saem
    daqui já canonicalizados (ver nota completa em `parse_integral_call`
    acima)."""
    match = _CALL_PATTERN.match(expression)
    if not match or match.group(1) != "integral":
        raise ExpressionError(f"Não foi possível interpretar a expressão: {expression}")
    _, argumentos = match.groups()
    partes = _split_top_level_args(argumentos)
    if len(partes) != 4:
        raise ExpressionError(
            "Passo a passo disponível apenas para integrais definidas (4 "
            "argumentos: expressão, variável, limite inferior e limite "
            "superior) nesta versão."
        )
    symbol = _parse_variable(partes[1])
    expr = canonicalize_euler_constant(_parse_fragment(partes[0], symbol))
    lower = canonicalize_euler_constant(_parse_fragment(partes[2], symbol))
    upper = canonicalize_euler_constant(_parse_fragment(partes[3], symbol))
    return expr, symbol, lower, upper


def parse_limit_call(expression: str) -> tuple[Expr, Symbol, Expr]:
    """Sprint V2.12 (Passo a Passo — Limites) — reaproveitável por
    `math_engine.steps.limits`: mesmo parsing que `solve_calculus_text` já
    faz para `limite(expr, var, ponto)` (`_CALL_PATTERN`, `_split_top_
    level_args`, `_parse_variable`, `_parse_fragment` — nunca regex frágil
    novo), devolvendo `(expr, symbol, point)` já prontos em vez de já
    calcular o limite. `compute_limit`/`solve_calculus_text` continuam
    100% intocados.

    Hotfix V2.15.1 (paridade de Euler) — `expr`/`point` saem daqui já
    canonicalizados (ver nota completa em `parse_integral_call` acima)."""
    match = _CALL_PATTERN.match(expression)
    if not match or match.group(1) != "limite":
        raise ExpressionError(f"Não foi possível interpretar a expressão: {expression}")
    _, argumentos = match.groups()
    partes = _split_top_level_args(argumentos)
    if len(partes) != 3:
        raise ExpressionError(
            "limite(...) espera exatamente 3 argumentos: expressão, variável e ponto."
        )
    symbol = _parse_variable(partes[1])
    expr = canonicalize_euler_constant(_parse_fragment(partes[0], symbol))
    point = canonicalize_euler_constant(_parse_fragment(partes[2], symbol))
    return expr, symbol, point


def solve_calculus_text(expression: str) -> str:
    match = _CALL_PATTERN.match(expression)
    if not match:
        raise ExpressionError(f"Não foi possível interpretar a expressão: {expression}")

    operacao, argumentos = match.groups()
    partes = _split_top_level_args(argumentos)

    if operacao == "derivada":
        if len(partes) != 2:
            raise ExpressionError(
                "derivada(...) espera exatamente 2 argumentos: expressão e variável."
            )
        symbol = _parse_variable(partes[1])
        expr = _parse_fragment(partes[0], symbol)
        resultado = canonicalize_euler_constant(compute_derivative(expr, symbol))
        return _rename_natural_log(f"Derivada: {resultado}")

    if operacao == "limite":
        if len(partes) != 3:
            raise ExpressionError(
                "limite(...) espera exatamente 3 argumentos: expressão, variável e ponto."
            )
        symbol = _parse_variable(partes[1])
        expr = _parse_fragment(partes[0], symbol)
        ponto = _parse_fragment(partes[2], symbol)
        resultado = canonicalize_euler_constant(compute_limit(expr, symbol, ponto))
        return _rename_natural_log(f"Limite: {resultado}")

    if operacao == "integral":
        if len(partes) == 2:
            symbol = _parse_variable(partes[1])
            expr = _parse_fragment(partes[0], symbol)
            primitive = compute_indefinite_integral(expr, symbol)
            # Hotfix P0 — hardening matemático: nunca apresenta uma
            # antiderivada não verificada. Recalcula `d/dx(primitive)` e
            # compara com o integrando original (`verify_antiderivative`,
            # `calculus/integrals.py`) — fail-closed: se não bater
            # (inclusive quando o próprio SymPy não consegue decidir),
            # levanta erro amigável em vez de arriscar um resultado
            # matematicamente errado. Só no ponto de saída final pro
            # usuário (`/solve`) — a maquinária interna de passo a passo
            # (substituição/frações parciais/integração por partes)
            # continua chamando `compute_indefinite_integral` sem essa
            # camada extra, sem risco de regressão na cobertura extensa
            # já existente ali.
            if not verify_antiderivative(primitive, expr, symbol):
                raise ExpressionError(
                    f"Não foi possível verificar a integral de {expr} nesta versão."
                )
            resultado = canonicalize_euler_constant(primitive)
            return _rename_natural_log(f"Integral: {resultado} + C")
        if len(partes) == 4:
            symbol = _parse_variable(partes[1])
            expr = _parse_fragment(partes[0], symbol)
            inferior = _parse_fragment(partes[2], symbol)
            superior = _parse_fragment(partes[3], symbol)
            resultado = canonicalize_euler_constant(compute_definite_integral(expr, symbol, inferior, superior))
            return _rename_natural_log(f"Integral definida: {resultado}")
        raise ExpressionError(
            "integral(...) espera 2 argumentos (indefinida) ou 4 argumentos (definida)."
        )

    raise ExpressionError(f"Operação de cálculo não reconhecida: {operacao}")
