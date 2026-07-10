"""Sprint 7.3 — pure, token-level Unicode substitutions for math_engine's
already-correct string output.

Each function is a narrow, self-contained regex transform: no parsing, no
restructuring, no semantic understanding of the surrounding text — only
literal, unambiguous token replacement. Safe to run over ANY string,
including the composite "Tipo: ...; ..." blocks Sprint 7.2 deliberately
left untouched, because none of these transforms need to understand that
structure, only find safe tokens inside it.
"""
from __future__ import annotations

import re

_SUPERSCRIPT_DIGITS = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")
_SUPERSCRIPT_MINUS = "⁻"

# SymPy's str() always wraps a negative integer exponent in parens
# ("x**(-2)") and never wraps a positive one ("x**2", "x**123"). Two
# distinct, anchored patterns — rather than one pattern with an optional
# "\)?" — avoid ever swallowing an unrelated closing paren, e.g. the outer
# ")" in "(x**2)" must NOT be consumed by the exponent match.
_NEGATIVE_EXPONENT_PATTERN = re.compile(r"\*\*\((-\d+)\)")
_POSITIVE_EXPONENT_PATTERN = re.compile(r"\*\*(\d+)\b")

# Single atomic argument only: a bare integer or a bare identifier
# (includes named constants like pi/tau/E, which are just identifiers at
# this point in the pipeline — see render_sqrt()'s docstring for why order
# matters). Compound arguments never match this pattern, by construction.
_SQRT_ATOM_PATTERN = re.compile(r"sqrt\((-?\d+|[a-zA-Z_]\w*)\)")

_PI_PATTERN = re.compile(r"\bpi\b")
_TAU_PATTERN = re.compile(r"\btau\b")
_OO_PATTERN = re.compile(r"\boo\b")

_IMAGINARY_UNIT_PATTERN = re.compile(r"\bI\b")

# Sprint 10 — analytic_geometry/classification.py só produz os rótulos
# semânticos "Paralelas"/"Perpendiculares" (ver decisão registrada no
# plano da Sprint 10: lógica interna nunca usa ∥/⊥ diretamente); os
# símbolos são acrescentados aqui, na camada de apresentação, como
# qualquer outra substituição cosmética deste módulo.
_PARALELAS_PATTERN = re.compile(r"\bParalelas\b")
_PERPENDICULARES_PATTERN = re.compile(r"\bPerpendiculares\b")


def _to_superscript(digits: str) -> str:
    if digits.startswith("-"):
        return _SUPERSCRIPT_MINUS + digits[1:].translate(_SUPERSCRIPT_DIGITS)
    return digits.translate(_SUPERSCRIPT_DIGITS)


def superscript_exponents(text: str) -> str:
    """x**2 -> x², x**10 -> x¹⁰, x**123 -> x¹²³, x**(-2) -> x⁻² — every
    digit is translated individually via the Unicode superscript table, so
    exponents of any length are supported. Only plain integer exponents are
    converted; "**" is left untouched for anything else (e.g. "x**(1/2)"),
    per the "quando possível" scope."""
    text = _NEGATIVE_EXPONENT_PATTERN.sub(lambda m: _to_superscript(m.group(1)), text)
    text = _POSITIVE_EXPONENT_PATTERN.sub(lambda m: _to_superscript(m.group(1)), text)
    return text


def render_sqrt(text: str) -> str:
    """sqrt(2) -> √2, sqrt(x) -> √x, sqrt(pi) -> √pi (still ASCII "pi" at
    this point — replace_constants() runs afterwards and turns it into
    √π). Only a single atomic argument (a bare integer or identifier,
    which includes named constants like pi/tau/E) is converted. Compound
    arguments (sqrt(x + 1), sqrt(2*x), sqrt(x**2 - 4)) are left completely
    untouched: deciding correct parenthesisation for a compound argument
    from the string alone is not something a regex can do safely.

    MUST run before replace_constants(): once "pi"/"tau" have already been
    turned into the Greek letters, they no longer match the ASCII
    identifier pattern this function looks for, and sqrt(pi) would be
    stranded as "sqrt(π)" instead of becoming "√π".
    """
    return _SQRT_ATOM_PATTERN.sub(lambda m: f"√{m.group(1)}", text)


def replace_constants(text: str) -> str:
    """pi -> π, tau -> τ, oo -> ∞ (word-boundary safe; "-oo" becomes "-∞"
    automatically since "-" isn't a word character, so the boundary before
    "oo" is still there)."""
    text = _PI_PATTERN.sub("π", text)
    text = _TAU_PATTERN.sub("τ", text)
    text = _OO_PATTERN.sub("∞", text)
    return text


def replace_comparisons(text: str) -> str:
    """<=, >=, != -> ≤, ≥, ≠. No known math_engine output currently
    contains these (inequalities are already rendered as intervals by
    Sprint 7.2) — kept as a defensive, currently-inert safety net."""
    return text.replace("<=", "≤").replace(">=", "≥").replace("!=", "≠")


def replace_imaginary_unit(text: str) -> str:
    """I -> i (presentation only). "I" is never a user-chosen variable name
    in this system's output — SymPy's parser resolves any bare "I" to the
    imaginary unit constant — so this substitution is unambiguous. Word
    boundaries keep "Interval" untouched. "2*I" becomes "2*i"; collapsing
    to "2i" is deliberately out of scope for this sprint."""
    return _IMAGINARY_UNIT_PATTERN.sub("i", text)


def replace_geometry_relations(text: str) -> str:
    """Paralelas -> Paralelas ∥, Perpendiculares -> Perpendiculares ⊥
    (Sprint 10). Word-boundary literal substitution, same pattern as the
    rest of this module — analytic_geometry/'s internal logic never uses
    these symbols, only the plain-Portuguese labels this function looks
    for."""
    text = _PARALELAS_PATTERN.sub("Paralelas ∥", text)
    text = _PERPENDICULARES_PATTERN.sub("Perpendiculares ⊥", text)
    return text
