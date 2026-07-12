"""Sprint 7.3 (extended by the Formatter Fix sprint) — pure, token-level
Unicode substitutions for math_engine's already-correct string output.

Each function is a narrow, self-contained transform: no sympify, no
semantic understanding of the surrounding text — only literal,
unambiguous token replacement (most via regex; render_sqrt() uses
balanced-parenthesis counting instead, since its argument can nest). Safe
to run over ANY string, including the composite "Tipo: ...; ..." blocks
Sprint 7.2 deliberately left untouched, because none of these transforms
need to understand that structure, only find safe tokens inside it.
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

# A bare integer or a bare identifier (includes named constants like
# pi/tau/E, which are just identifiers at this point in the pipeline — see
# render_sqrt()'s docstring for why order matters). Used to decide whether
# a sqrt(...) argument needs wrapping parens once extracted.
_SQRT_ATOM_PATTERN = re.compile(r"^-?\d+$|^[a-zA-Z_]\w*$")
_SQRT_PREFIX_PATTERN = re.compile(r"sqrt\(")

_PI_PATTERN = re.compile(r"\bpi\b")
_TAU_PATTERN = re.compile(r"\btau\b")
_OO_PATTERN = re.compile(r"\boo\b")

_IMAGINARY_UNIT_PATTERN = re.compile(r"\bI\b")

# Sprint Formatter Fix — implicit-multiplication cleanup. Only removes "*"
# when it is unambiguous: a numeric coefficient directly touching a symbol,
# a named constant, or a √. Two lookaheads guard against ambiguity:
#   - "(?!I\b)" / "(?!E\b)": "I"/"E" are reserved (never a user variable,
#     see replace_imaginary_unit()'s docstring) but this module deliberately
#     keeps their product notation as-is ("2*I", "2*E") rather than
#     collapsing to "2i"/"2E" — same scope decision already made for I in
#     Sprint 7.3, extended here to E for consistency.
#   - "(?!\w*\()": never collapse into a function call — "2*sin(x)" must
#     stay "2*sin(x)", not become "2sin(x)".
# Symbol×symbol products (e.g. "pi*k") are deliberately NOT covered: only
# a numeric coefficient triggers the merge, so "π*k" stays "π*k".
_COEFFICIENT_PRODUCT_PATTERN = re.compile(
    r"(?<=\d)\*(?!I\b)(?!E\b)(?=(?:[^\W\d_](?!\w*\()|√))"
)

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
    √π). An atomic argument (a bare integer or identifier, which includes
    named constants like pi/tau/E) is converted without wrapping parens.
    A compound argument (sqrt(x + 1), sqrt(x**2 - 4)) is converted too, but
    wrapped: sqrt(x + 1) -> √(x + 1). The argument is extracted via
    balanced-parenthesis counting (same technique as
    safe_parse.split_top_level), not a fixed-shape regex, so nested
    parentheses inside the argument are handled correctly.

    MUST run before replace_constants(): once "pi"/"tau" have already been
    turned into the Greek letters, they no longer match the ASCII
    identifier pattern this function looks for, and sqrt(pi) would be
    stranded as "sqrt(π)" instead of becoming "√π".
    """
    result: list[str] = []
    i = 0
    length = len(text)
    while i < length:
        match = _SQRT_PREFIX_PATTERN.match(text, i)
        if match is None:
            result.append(text[i])
            i += 1
            continue

        start = match.end()
        depth = 1
        j = start
        while j < length and depth > 0:
            if text[j] == "(":
                depth += 1
            elif text[j] == ")":
                depth -= 1
            j += 1

        if depth != 0:
            # Unbalanced parens (should not happen for well-formed
            # math_engine output) — leave the rest of the string untouched
            # rather than risk mangling it.
            result.append(text[i:])
            break

        inner = text[start : j - 1]
        if _SQRT_ATOM_PATTERN.match(inner):
            result.append(f"√{inner}")
        else:
            result.append(f"√({inner})")
        i = j

    return "".join(result)


def merge_coefficient_products(text: str) -> str:
    """2*x -> 2x, 2*π -> 2π, 3*√2 -> 3√2, 3*√(x + 1) -> 3√(x + 1). Only
    collapses "*" directly between a numeric coefficient and a symbol,
    named constant, or √ — see _COEFFICIENT_PRODUCT_PATTERN's comment for
    the exact ambiguity guards (never before I/E, never into a function
    call, never between two numbers, never symbol×symbol)."""
    return _COEFFICIENT_PRODUCT_PATTERN.sub("", text)


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
    boundaries keep "Interval" untouched. "2*I" becomes "2*i": the "*" is
    deliberately preserved by merge_coefficient_products() (see its
    pattern's comment) rather than collapsed to "2i"."""
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
