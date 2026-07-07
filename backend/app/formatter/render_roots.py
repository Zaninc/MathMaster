"""Sprint 7.2 — helpers for the "Soluções x = ..." output shape: sorting by
(Re, Im) and unicode-subscript indexing, replacing SymPy's arbitrary
solve()/linsolve() ordering. Only invoked by `pipeline.py` after
`classify.is_assignment_shape` has already confirmed every top-level segment
is a bare "identifier = ..." assignment.
"""
from __future__ import annotations

import re

_SUBSCRIPT_DIGITS = str.maketrans("0123456789", "₀₁₂₃₄₅₆₇₈₉")
_ASSIGNMENT_PATTERN = re.compile(r"^([a-zA-Z_]\w*)\s*=\s*(.+)$")


def subscript(n: int) -> str:
    return str(n).translate(_SUBSCRIPT_DIGITS)


def sort_key(expr):
    """Sort by (real part, imaginary part); non-numeric values (should not
    happen for solve() output, but defensively handled) sort last."""
    try:
        value = complex(expr.evalf())
        return (round(value.real, 12), round(value.imag, 12))
    except Exception:
        return (float("inf"), str(expr))


def parse_assignment(segment: str):
    """"x = -4" -> ("x", "-4"). Returns None if it doesn't match."""
    match = _ASSIGNMENT_PATTERN.match(segment)
    if not match:
        return None
    return match.group(1), match.group(2)
