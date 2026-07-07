"""Presentation layer for solve_expression() output.

Sprint 7.2 (format_result): classification-first and conservative —
re-renders only the output shapes it positively recognises (intervals,
finite sets, "x = ..." solution lists, bare expressions); everything else
— including composite "Tipo: ...; ..." text — is returned exactly as
math_engine produced it.

Sprint 7.3 (render_math): a final, purely cosmetic Unicode pass — runs
after format_result() and applies safe, token-level substitutions
(superscript exponents, √, Greek letters, imaginary unit) over the whole
string, including the "Tipo: ..." blocks format_result() left untouched.

math_engine, its dispatcher, and the public API contract are untouched by
this package.
"""
from .pipeline import format_result
from .renderer import render_math

__all__ = ["format_result", "render_math"]
