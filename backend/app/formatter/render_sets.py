"""Sprint 7.2 — dedicated renderers for the "Intervalos" and
"FiniteSet/conjuntos" output shapes.

Only called from `pipeline.py` after `classify.py` has already confirmed
the raw string structurally matches one of these shapes. Still defensive
against the sympify result *not* actually being the expected SymPy type
(e.g. a Union mixing Intervals with an ImageSet, from periodic trigonometric
solutions) — returns None in that case so the caller preserves the original
string untouched rather than risk misrepresenting it.
"""
from __future__ import annotations

from sympy import EmptySet, ImageSet, Interval, S, Symbol, Union

from .expr_clean import clean_expr
from .render_roots import sort_key, subscript
from .safe_parse import safe_sympify

_INFINITY = "∞"
_INTEGER_K = Symbol("k")


def _format_bound(value) -> str:
    if value == S.Infinity:
        return _INFINITY
    if value == S.NegativeInfinity:
        return f"-{_INFINITY}"
    return str(clean_expr(value))


def render_interval(obj) -> str | None:
    if obj == EmptySet:
        return "∅"
    if obj == S.Reals:
        return "ℝ"
    if isinstance(obj, Interval):
        left = "(" if obj.left_open else "["
        right = ")" if obj.right_open else "]"
        return f"{left}{_format_bound(obj.start)}, {_format_bound(obj.end)}{right}"
    if isinstance(obj, Union):
        if not all(isinstance(arg, Interval) for arg in obj.args):
            return None
        rendered = [render_interval(arg) for arg in obj.args]
        if any(piece is None for piece in rendered):
            return None
        return " ∪ ".join(rendered)
    return None


def render_periodic_solution(raw: str, symbol: str | None) -> str | None:
    """Sprint 11.1 hotfix — renders the periodic ImageSet/Union solution
    trigonometry/equations.py returns for equations like sin(x)=1/2 (see
    classify.is_periodic_solution_shape). `raw` has already been positively
    identified as this shape; `safe_sympify` re-parses the whole string
    (safe here specifically because the shape check already anchored it to
    "ImageSet(Lambda(" / "Union(ImageSet(Lambda(", not because sympify() is
    ever trusted on unclassified text). Returns None — same conservative
    fallback-to-raw contract as render_interval() — if the reparsed object
    doesn't actually have the expected structure (every branch a single-
    variable ImageSet over the integers), so the caller never risks
    misrepresenting an unexpected shape.
    """
    parsed = safe_sympify(raw)
    if parsed is None:
        return None

    branches = parsed.args if isinstance(parsed, Union) else (parsed,)
    if not branches or not all(
        isinstance(branch, ImageSet) and branch.base_set == S.Integers for branch in branches
    ):
        return None

    # NOTE: deliberately NOT run through clean_expr() here (unlike every
    # other shape in this module) — solveset() already returns each branch
    # in the canonical "k*pi + constant" additive form, and clean_expr's
    # factor() step turns exactly one of two branches with an odd numerator
    # (e.g. "2*pi*k + 3*pi/2" from cos(x)=0) into "pi*(4*k + 3)/2" purely
    # because that's one character shorter — leaving the two branches of the
    # same periodic family in visibly inconsistent styles. The unsimplified
    # form is both already minimal and uniform across branches.
    var = symbol or "x"
    equations = []
    for branch in branches:
        variables = branch.lamda.variables
        if len(variables) != 1:
            return None
        expr = branch.lamda.expr.xreplace({variables[0]: _INTEGER_K})
        equations.append(f"{var} = {expr}")

    return " ou ".join(equations) + ", k ∈ ℤ"


def render_finiteset_values(values: list, symbol: str | None) -> str:
    """`values` are the already-sympified elements found inside a "{...}"
    literal (see pipeline._format_finiteset — the braces are never sympified
    as a whole, since SymPy's own sympify() turns "{a, b}" into a plain
    Python `set`, not a `sympy.FiniteSet`)."""
    ordered = sorted(values, key=sort_key)
    cleaned = [clean_expr(value) for value in ordered]
    if symbol:
        if len(cleaned) == 1:
            return f"{symbol} = {cleaned[0]}"
        return ", ".join(
            f"{symbol}{subscript(i + 1)} = {value}" for i, value in enumerate(cleaned)
        )
    return "{" + ", ".join(str(value) for value in cleaned) + "}"
