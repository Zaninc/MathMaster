"""Sprint "Exponenciais e Logaritmos" — passo a passo para equações
logarítmicas de uma única incógnita, com argumento LINEAR na incógnita:
"ln(x)=2", "ln(x+1)=4", "log(x)=2" (base 10, convenção do produto),
"log(x)/log(2)=3" (base arbitrária).

Base arbitrária NÃO tem sintaxe própria no texto do backend — confirmado
empiricamente (`logarithms/equations.py`, `log_convention.py`) e já
documentado no adapter do frontend (`mathfield-to-backend.ts`, Sprint
V3.0.3): "log_2(x)" é rejeitado, a mudança de base `log(arg)/log(base)` é
o caminho OFICIAL e testado do produto — inclusive é exatamente a forma
para a qual "log(x)=2" já se expande internamente (`_LOCAL_DICT`:
`log(x)/log(10)`). Por isso `match_logarithmic_term` reconhece as DUAS
formas ("ln(arg)" bare e "log(arg)/log(base)") com o MESMO código: base
10 nunca é um caso especial, só mais um valor de `base`.

Relação inversa mostrada explicitamente (nunca só o resultado final):
ln(a)=b <=> a=e**b; log_base(a)=b <=> a=base**b. Domínio (argumento > 0)
é sempre um passo explícito — nunca precisa de FILTRO em tempo de
execução aqui, porque a=base**b é sempre positivo para base>0 (potência
de base positiva), então qualquer solução encontrada já satisfaz o
domínio por construção; mostrar o passo é só pedagógico (ticket item 4)."""
from __future__ import annotations

from sympy import E, Symbol
from sympy import log as sympy_log
from sympy.core.expr import Expr

from ...canonical_constants import canonicalize_euler_constant
from ..errors import ExpressionError
from ..log_convention import LOCAL_DICT as _LOG_LOCAL_DICT
from .formatting import eq_text, isolate_title, rename_natural_log, rename_natural_log_in_steps
from .linear_equations import parse_equation_sides, reduce_to_value
from .models import MathStep
from .validation import UNSUPPORTED_EQUATION_MESSAGE, require_single_symbol


def _is_linear_in(expr: Expr, symbol: Symbol) -> bool:
    return expr.is_polynomial(symbol) and expr.as_poly(symbol).degree() == 1


def match_logarithmic_term(expr: Expr, symbol: Symbol) -> tuple[Expr, Expr, Expr | None] | None:
    """(coeficiente, argumento, base) se `expr` for `coeficiente *
    log_base(argumento)`, com `argumento` linear em `symbol` e `base` uma
    constante real positiva != 1 (nunca dependendo de `symbol`).
    `base=None` significa log NATURAL ("ln", "e" implícito — o SymPy
    reconhece isso como um `log(...)` de UM argumento só, nunca dividido
    por outro `log`). `None` (nunca "chuta") para qualquer outra forma."""
    if symbol not in expr.free_symbols:
        return None

    numer, denom = expr.as_numer_denom()
    if denom != 1:
        if not (denom.func is sympy_log and len(denom.args) == 1):
            return None
        base = denom.args[0]
        if symbol in base.free_symbols or not (base.is_number and base > 0 and base != 1):
            return None
        coeff, log_part = numer.as_independent(symbol, as_Add=False)
        if not (log_part.func is sympy_log and len(log_part.args) == 1):
            return None
        argument = log_part.args[0]
        if symbol not in argument.free_symbols or not _is_linear_in(argument, symbol):
            return None
        return coeff, argument, base

    coeff, rest = expr.as_independent(symbol, as_Add=False)
    if not (rest.func is sympy_log and len(rest.args) == 1):
        return None
    argument = rest.args[0]
    if symbol not in argument.free_symbols or not _is_linear_in(argument, symbol):
        return None
    return coeff, argument, None


def is_logarithmic_equation_shape(lhs: Expr, rhs: Expr, symbol: Symbol) -> bool:
    if symbol not in rhs.free_symbols and match_logarithmic_term(lhs, symbol) is not None:
        return True
    if symbol not in lhs.free_symbols and match_logarithmic_term(rhs, symbol) is not None:
        return True
    return False


def generate_logarithmic_equation_steps(text: str) -> list[MathStep]:
    lhs, rhs = parse_equation_sides(text, local_dict=_LOG_LOCAL_DICT)
    lhs = canonicalize_euler_constant(lhs)
    rhs = canonicalize_euler_constant(rhs)

    symbols = lhs.free_symbols | rhs.free_symbols
    require_single_symbol(symbols)
    symbol = next(iter(symbols))

    steps = [MathStep(title="Equação inicial", expression=rename_natural_log(eq_text(lhs, rhs)))]

    match = match_logarithmic_term(lhs, symbol)
    if match is not None:
        log_side, const_side = lhs, rhs
    else:
        match = match_logarithmic_term(rhs, symbol)
        if match is None:
            raise ExpressionError(UNSUPPORTED_EQUATION_MESSAGE)
        log_side, const_side = rhs, lhs
        steps.append(
            MathStep(
                title="Reescrevendo a equação",
                expression=rename_natural_log(eq_text(log_side, const_side)),
            )
        )

    coeff, argument, base = match
    log_call_text = f"ln({argument})" if base is None else f"log({argument})/log({base})"
    if coeff != 1:
        const_side = const_side / coeff
        steps.append(
            MathStep(
                title=isolate_title(coeff),
                expression=rename_natural_log(f"{log_call_text}={const_side}"),
            )
        )

    steps.append(
        MathStep(
            title="Verificando o domínio: o argumento do logaritmo deve ser positivo",
            expression=f"{argument}>0",
        )
    )

    if base is None:
        value = E**const_side
        title = "Como ln e a função exponencial são inversas, ln(a)=b equivale a a=exp(b)"
    else:
        value = base**const_side
        title = (
            f"Como log de base {base} e a potência de base {base} são inversas, "
            f"log_{base}(a)=b equivale a a={base}**b"
        )
    steps.append(MathStep(title=title, expression=rename_natural_log(eq_text(argument, value))))

    _, rest = reduce_to_value(argument, value, symbol)
    steps.extend(rename_natural_log_in_steps(rest))
    return steps
