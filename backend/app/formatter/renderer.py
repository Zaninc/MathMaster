"""Sprint 7.3 — final Unicode presentation pass, runs after Sprint 7.2's
format_result().

Purely cosmetic, token-level substitutions (superscript exponents, √,
Greek letters, comparison operators, imaginary unit) applied to the WHOLE
string — including the "Tipo: ...; ..." blocks Sprint 7.2 deliberately
left untouched, since none of these substitutions need to understand that
structure, only find safe, unambiguous tokens inside it.

Never touches math_engine, never re-derives a result, never converts to
decimal. On any unexpected error, returns the untouched input.
"""
from __future__ import annotations

from .unicode_math import (
    render_sqrt,
    replace_comparisons,
    replace_constants,
    replace_imaginary_unit,
    superscript_exponents,
)


def render_math(text: str) -> str:
    if not text:
        return text
    try:
        # render_sqrt MUST run before replace_constants (see render_sqrt's
        # docstring) so sqrt(pi)/sqrt(tau) resolve to √π/√τ instead of
        # being stranded as sqrt(π)/sqrt(τ). The remaining steps have no
        # ordering dependency on each other.
        rendered = render_sqrt(text)
        rendered = superscript_exponents(rendered)
        rendered = replace_constants(rendered)
        rendered = replace_comparisons(rendered)
        rendered = replace_imaginary_unit(rendered)
        return rendered
    except Exception:
        return text
