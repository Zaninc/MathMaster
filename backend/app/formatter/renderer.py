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
    merge_coefficient_products,
    merge_parenthesized_products,
    render_sqrt,
    replace_comparisons,
    replace_constants,
    replace_geometry_relations,
    replace_imaginary_unit,
    superscript_exponents,
)


def render_math(text: str) -> str:
    if not text:
        return text
    try:
        # render_sqrt MUST run before replace_constants (see render_sqrt's
        # docstring) so sqrt(pi)/sqrt(tau) resolve to √π/√τ instead of
        # being stranded as sqrt(π)/sqrt(τ).
        rendered = render_sqrt(text)
        rendered = superscript_exponents(rendered)
        rendered = replace_constants(rendered)
        # merge_coefficient_products MUST run after replace_constants (it
        # relies on "pi" already being "π" to merge "2*π" -> "2π") and
        # BEFORE replace_imaginary_unit (its ambiguity guard checks for the
        # reserved uppercase "I" token, before it becomes lowercase "i").
        rendered = merge_coefficient_products(rendered)
        rendered = merge_parenthesized_products(rendered)
        rendered = replace_comparisons(rendered)
        rendered = replace_imaginary_unit(rendered)
        rendered = replace_geometry_relations(rendered)
        return rendered
    except Exception:
        return text
