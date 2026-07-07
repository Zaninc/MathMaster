"""Sprint 7.2 — presentation layer for solve_expression() output.

Classification-first and conservative: re-renders only the output shapes it
positively recognises (intervals, finite sets, "x = ..." solution lists,
bare expressions); everything else — including composite "Tipo: ...; ..."
text — is returned exactly as math_engine produced it. math_engine, its
dispatcher, and the public API contract are untouched by this package.
"""
from .pipeline import format_result

__all__ = ["format_result"]
