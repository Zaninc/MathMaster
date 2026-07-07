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

from sympy import EmptySet, Interval, S, Union

from .expr_clean import clean_expr
from .render_roots import sort_key, subscript

_INFINITY = "∞"


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
