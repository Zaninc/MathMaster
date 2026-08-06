"""Safe, meaning-preserving re-simplification of a single SymPy expression.

Only ever called on a fragment `classify.py` + a dedicated shape formatter
have already isolated (an interval bound, a finite-set element, a solution
value, or a whole bare expression) — never on unclassified text. Never used
to derive new mathematics, only to pick the most legible *equivalent*
representation of a value math_engine already computed.
"""
from __future__ import annotations

from sympy import cancel, factor, radsimp, trigsimp
from sympy.core.expr import Expr
from sympy.functions.elementary.trigonometric import TrigonometricFunction

from ..canonical_constants import canonicalize_euler_constant

# NOTE: simplify(), sqrtdenest() and cancel() were deliberately excluded from
# (or restricted in) this battery after a real regression was caught during
# Sprint 7.2 testing: all three turn an already-factored expression like
# "(x - 1)*(x + 1)" into its expanded form "x**2 - 1" — which is shorter, so
# a naive "shortest equivalent string wins" rule would silently UNDO the
# factored form that algebra/dispatcher.py deliberately prefers (Sprint 4:
# factor -> simplify -> raw). radsimp/trigsimp/factor never do this — factor
# is monotonically "more factored, never less", so it cannot regress a
# result that is already factored. cancel() has the same expand-on-a-plain-
# product behaviour as simplify(), so it is only applied when the source
# text actually looks like a fraction ("/" present) — the one case it's
# needed for and safe in (cancelling a common factor from num/denom).
#
# Sprint V2.1 hotfix (profiling): `trigsimp` searches for identities BETWEEN
# every pair of trig atoms in the expression, so its cost grows steeply with
# how many independent trig calls it has to consider — measured empirically:
# ~0.17s at 24 atoms, ~0.75s at 40, ~3.6s at 60 (`sin(1)+cos(1)+...+sin(n)+
# cos(n)` for n=12/20/30). A summation like "Σ(i=1..30) sin(i)" produces
# exactly this shape (30 unrelated `sin(k)` atoms, no identity to find), and
# `clean_expr` used to pay that cost on every bare-expression result
# regardless of size. `_bounded_trigsimp` skips the attempt above a
# generous-but-bounded atom count — below it, behavior is 100% unchanged
# (still the real `trigsimp`); above it, `best` simply keeps whatever the
# other (cheap, non-search-based) simplifiers already produced, same as any
# other simplifier here that fails to improve on `best`.
_MAX_TRIG_ATOMS_FOR_TRIGSIMP = 12


def _bounded_trigsimp(expr: Expr) -> Expr:
    if len(expr.atoms(TrigonometricFunction)) > _MAX_TRIG_ATOMS_FOR_TRIGSIMP:
        return expr
    return trigsimp(expr)


_SIMPLIFIERS = (radsimp, _bounded_trigsimp, factor)


def _is_equivalent(candidate: Expr, original: Expr) -> bool:
    if candidate == original:
        return True
    try:
        result = candidate.equals(original)
    except Exception:
        return False
    return result is True


def clean_expr(expr: Expr) -> Expr:
    """Try a battery of safe SymPy simplifications and keep the shortest
    representation that is provably equal to the original. Falls back to
    the original expression untouched if nothing safely improves it.

    Hotfix V2.12.2a: `canonicalize_euler_constant` runs FIRST and
    unconditionally (never gated by `_is_equivalent`, unlike the battery
    below) — it's a domain convention (the bare symbol "e" always means
    Euler's number in this product, same as "pi"), not a candidate
    competing on string length. Everything downstream (`best`, the
    equivalence checks) operates on the already-canonicalized expression.
    """
    expr = canonicalize_euler_constant(expr)
    best = expr
    simplifiers = _SIMPLIFIERS + ((cancel,) if "/" in str(expr) else ())
    for simplifier in simplifiers:
        try:
            candidate = simplifier(best)
        except Exception:
            continue
        if _is_equivalent(candidate, expr) and len(str(candidate)) < len(str(best)):
            best = candidate
    return best


def evalf_expr(expr: Expr, precision: int = 6) -> Expr:
    """Numeric (decimal) rendering — prepared architecture for the future
    'decimal mode' (Sprint 7.2 objective 3). Not wired to the public API
    yet; falls back to the exact expression if evalf isn't possible."""
    try:
        return expr.evalf(precision)
    except Exception:
        return expr
