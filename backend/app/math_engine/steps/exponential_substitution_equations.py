"""Sprint "Exponenciais e Logaritmos" — equações exponenciais resolvidas
por substituição, ex. "e^(2x)-5e^x+6=0" (u=e^x -> u²-5u+6=0).

Reaproveita INTEGRALMENTE dois motores já existentes, nunca duplicando
lógica de resolução:

1. `quadratic_equations.generate_quadratic_equation_steps` — resolve a
   equação quadrática EM u (ex. "u**2-5*u+6=0") com toda a seleção
   automática de método (fatoração/Bhaskara/raiz direta) que esse módulo
   já sabe fazer, chamada sobre um texto novo construído a partir dos
   coeficientes detectados.
2. `exponential_equations.resolve_exponential_target` — para CADA raiz
   real e POSITIVA de u (u=base**x nunca pode ser <= 0 — filtro central
   desta sprint, item 6 do ticket), volta a resolver base**x=raiz para x,
   reaproveitando o mesmo caminho "mesma base/logaritmo" de uma equação
   exponencial simples.

Restrito ao padrão explicitamente pedido pelo ticket: dois termos
exponenciais de MESMA base, um com expoente igual à própria incógnita
(u=base**x) e outro com o DOBRO desse expoente (base**(2x)=u²) — "também
teste casos análogos de base numérica quando matematicamente válido" já é
atendido, pois `base` nunca é hardcoded para "e"."""
from __future__ import annotations

from sympy import E, Integer, Symbol, exp, solve
from sympy import expand as sympy_expand
from sympy.core.expr import Expr

from ...canonical_constants import canonicalize_euler_constant
from ..errors import ExpressionError
from .exponential_equations import resolve_exponential_target
from .formatting import eq_text, rename_natural_log
from .linear_equations import parse_equation_sides
from .models import MathStep
from .quadratic_equations import generate_quadratic_equation_steps
from .validation import NO_REAL_SOLUTION_MESSAGE, UNSUPPORTED_EQUATION_MESSAGE, require_single_symbol

_U_SYMBOL = Symbol("u")


def _match_unit_or_double_exponential_term(term: Expr, symbol: Symbol) -> tuple[Expr, Expr, int] | None:
    """(coeficiente, base, 1 ou 2) se `term` for `coeficiente *
    base**symbol` ou `coeficiente * base**(2*symbol)` — as únicas duas
    potências que participam de uma substituição u=base**symbol
    genuinamente quadrática em u. `None` para qualquer outro expoente
    (ex. `base**(3*symbol)`, fora do escopo desta sprint)."""
    if symbol not in term.free_symbols:
        return None
    coeff, rest = term.as_independent(symbol, as_Add=False)
    if rest.func is exp:
        base, exponent = E, rest.args[0]
    elif rest.is_Pow:
        base, exponent = rest.args
    else:
        return None
    if symbol in base.free_symbols or not (base.is_number and base > 0 and base != 1):
        return None
    if exponent == symbol:
        return coeff, base, 1
    if exponent == 2 * symbol:
        return coeff, base, 2
    return None


def _classify_substitution_terms(standard: Expr, symbol: Symbol) -> tuple[Expr, Expr, Expr, Expr] | None:
    """(base, a, b, c) tal que `standard` == a*base**(2x) + b*base**x + c,
    com a != 0 e b != 0 (senão não é uma substituição genuína — sem termo
    ao quadrado ou sem termo linear em u já seria uma equação mais simples,
    fora do escopo deste módulo)."""
    terms = standard.as_ordered_terms() if standard.is_Add else [standard]
    base: Expr | None = None
    a = Integer(0)
    b = Integer(0)
    c = Integer(0)
    for term in terms:
        if symbol not in term.free_symbols:
            c += term
            continue
        match = _match_unit_or_double_exponential_term(term, symbol)
        if match is None:
            return None
        coeff, term_base, power = match
        if base is None:
            base = term_base
        elif base != term_base:
            return None
        if power == 1:
            b += coeff
        else:
            a += coeff
    if base is None or a == 0 or b == 0:
        return None
    return base, a, b, c


def is_exponential_substitution_shape(lhs: Expr, rhs: Expr, symbol: Symbol) -> bool:
    standard = sympy_expand(lhs - rhs)
    return _classify_substitution_terms(standard, symbol) is not None


def generate_exponential_substitution_steps(text: str) -> list[MathStep]:
    lhs, rhs = parse_equation_sides(text)
    lhs = canonicalize_euler_constant(lhs)
    rhs = canonicalize_euler_constant(rhs)

    symbols = lhs.free_symbols | rhs.free_symbols
    require_single_symbol(symbols)
    symbol = next(iter(symbols))

    steps = [MathStep(title="Equação inicial", expression=rename_natural_log(eq_text(lhs, rhs)))]

    standard = sympy_expand(lhs - rhs)
    if not (rhs == 0 and sympy_expand(lhs) == standard):
        steps.append(
            MathStep(
                title="Organizando a equação (tudo em um lado, igualado a zero)",
                expression=rename_natural_log(eq_text(standard, Integer(0))),
            )
        )

    classified = _classify_substitution_terms(standard, symbol)
    if classified is None:
        raise ExpressionError(UNSUPPORTED_EQUATION_MESSAGE)
    base, a, b, c = classified

    base_call_text = f"exp({symbol})" if base == E else f"{base}**{symbol}"
    steps.append(
        MathStep(
            title=f"Fazendo a substituição u={base_call_text}",
            expression=eq_text(a * _U_SYMBOL**2 + b * _U_SYMBOL + c, Integer(0)),
        )
    )

    quadratic_text = f"{a * _U_SYMBOL**2 + b * _U_SYMBOL + c}=0"
    steps.extend(generate_quadratic_equation_steps(quadratic_text))

    u_roots = solve(a * _U_SYMBOL**2 + b * _U_SYMBOL + c, _U_SYMBOL)
    valid_roots = [root for root in u_roots if root.is_real and root > 0]
    if not valid_roots:
        raise ExpressionError(NO_REAL_SOLUTION_MESSAGE)

    for root in sorted(valid_roots, key=lambda r: float(r.evalf())):
        steps.append(
            MathStep(
                title=f"Como u={base_call_text} deve ser positivo, retomando com u={root}",
                expression=rename_natural_log(f"{base_call_text}={root}"),
            )
        )
        steps.extend(resolve_exponential_target(base, symbol, root, symbol))

    return steps
