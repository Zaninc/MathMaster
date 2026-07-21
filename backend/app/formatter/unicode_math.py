"""Sprint 7.3 (extended by the Formatter Fix sprint) — pure, token-level
Unicode substitutions for math_engine's already-correct string output.

Each function is a narrow, self-contained transform: no sympify, no
semantic understanding of the surrounding text — only literal,
unambiguous token replacement (most via regex; render_sqrt() and
merge_parenthesized_products() use balanced-parenthesis counting instead,
since their target shape can nest). Safe to run over ANY string, including
the composite "Tipo: ...; ..." blocks Sprint 7.2 deliberately left
untouched, because none of these transforms need to understand that
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

# A bare integer or a bare identifier (includes named constants like
# pi/tau/E, which are just identifiers at this point in the pipeline — see
# render_sqrt()'s docstring for why order matters). Used to decide whether
# a sqrt(...) argument needs wrapping parens once extracted.
_SQRT_ATOM_PATTERN = re.compile(r"^-?\d+$|^[a-zA-Z_]\w*$")
_SQRT_PREFIX_PATTERN = re.compile(r"sqrt\(")

_ABS_PREFIX_PATTERN = re.compile(r"Abs\(")

_PI_PATTERN = re.compile(r"\bpi\b")
_TAU_PATTERN = re.compile(r"\btau\b")
_OO_PATTERN = re.compile(r"\boo\b")

_IMAGINARY_UNIT_PATTERN = re.compile(r"\bI\b")
_EULERS_NUMBER_PATTERN = re.compile(r"\bE\b")

# Sprint Formatter Fix — implicit-multiplication cleanup. Only removes "*"
# when it is unambiguous: a numeric coefficient directly touching a symbol,
# a named constant, a √, or a | (módulo — ver render_abs()). Two lookaheads
# guard against ambiguity:
#   - "(?!I\b)" / "(?!E\b)": "I"/"E" are reserved (never a user variable,
#     see replace_imaginary_unit()'s docstring) but this module deliberately
#     keeps their product notation as-is ("2*I", "2*E") rather than
#     collapsing to "2i"/"2E" — same scope decision already made for I in
#     Sprint 7.3, extended here to E for consistency.
#   - "(?!\w*\()": never collapse into a function call — "2*sin(x)" must
#     stay "2*sin(x)", not become "2sin(x)".
# Symbol×symbol products (e.g. "pi*k") are deliberately NOT covered: only
# a numeric coefficient triggers the merge, so "π*k" stays "π*k". "|" is
# treated like "√" (a delimiter, not a word-like function name) rather than
# under the function-call guard: "3*|x|" reads naturally as "3|x|", same
# convention as "3*√x" -> "3√x". MUST run after render_abs() so "Abs(x)"
# has already become "|x|" by the time this pattern looks for "|".
_COEFFICIENT_PRODUCT_PATTERN = re.compile(
    r"(?<=\d)\*(?!I\b)(?!E\b)(?=(?:[^\W\d_](?!\w*\()|√|\|))"
)

# Function-call identifier immediately before a "(" — used by
# merge_parenthesized_products() to tell "(x-1)*(x+1)" (bare factors, safe
# to collapse) apart from "sin(x)*(x+1)" (a call result times a factor;
# collapsing would read as calling sin(x) with (x+1), which is wrong).
_IDENTIFIER_CHAR_PATTERN = re.compile(r"[A-Za-z_]")

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


def render_abs(text: str) -> str:
    """Abs(x) -> |x|; Abs(x**2 - 9) -> |x**2 - 9| (superscript_exponents()
    runs afterwards, so exponents here are still "**" — no different from
    how render_sqrt() hands compound arguments onward). Argument extracted
    via balanced-parenthesis counting (same technique as render_sqrt()),
    since it can nest.

    Nested "Abs(...)" inside the argument is rendered recursively BEFORE
    wrapping, so "Abs(x - Abs(y))" becomes "|x - |y||", not
    "|x - Abs(y)|" — traditional nested-modulus notation. In practice
    SymPy already collapses "Abs(Abs(y))" to "Abs(y)" during simplify
    (|.|.| = |.|), so same-argument nesting never reaches here doubled;
    the recursion only matters for DIFFERENT nested arguments.

    Only cosmetic: never touches math_engine, never re-derives a result.
    Purely presentation, same as √ — the internal representation stays
    `sympy.Abs` throughout."""
    result: list[str] = []
    i = 0
    length = len(text)
    while i < length:
        match = _ABS_PREFIX_PATTERN.match(text, i)
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
        result.append(f"|{render_abs(inner)}|")
        i = j

    return "".join(result)


def merge_coefficient_products(text: str) -> str:
    """2*x -> 2x, 2*π -> 2π, 3*√2 -> 3√2, 3*√(x + 1) -> 3√(x + 1). Only
    collapses "*" directly between a numeric coefficient and a symbol,
    named constant, or √ — see _COEFFICIENT_PRODUCT_PATTERN's comment for
    the exact ambiguity guards (never before I/E, never into a function
    call, never between two numbers, never symbol×symbol)."""
    return _COEFFICIENT_PRODUCT_PATTERN.sub("", text)


def merge_parenthesized_products(text: str) -> str:
    """(x - 1)*(x + 1) -> (x - 1)(x + 1). Only collapses "*" directly
    between two parenthesized groups, and only when the left group is a
    bare factor — not a function call. Finding the left group's matching
    "(" requires balanced-parenthesis counting (see render_sqrt()), since a
    fixed-width regex lookbehind cannot handle nested parentheses."""
    result: list[str] = []
    i = 0
    length = len(text)
    while i < length:
        is_boundary = (
            text[i] == ")"
            and i + 2 < length
            and text[i + 1] == "*"
            and text[i + 2] == "("
        )
        if not is_boundary:
            result.append(text[i])
            i += 1
            continue

        depth = 1
        j = i - 1
        while j >= 0 and depth > 0:
            if text[j] == ")":
                depth += 1
            elif text[j] == "(":
                depth -= 1
            j -= 1
        # j now sits one character before the left group's matching "(".
        is_function_call = j >= 0 and bool(_IDENTIFIER_CHAR_PATTERN.match(text[j]))

        result.append(")")
        if is_function_call:
            result.append("*")
        i += 2  # skip ")" (already appended) and "*"; "(" is handled next

    return "".join(result)


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


def replace_eulers_number(text: str) -> str:
    """E -> e (presentation only). Same reasoning and same safety guarantee
    as replace_imaginary_unit() above: "E" is never a user-chosen free
    parameter in this system's output — math_engine.safe_parsing.
    extract_safe_symbols() explicitly excludes it (alongside pi/I/oo) from
    ever being created as a free symbol, so a bare "E" can only ever be
    SymPy's Euler's-number singleton. Word boundaries mean this never
    touches "E" inside a longer token — "exp(2)", "Equação", "1E5" — only a
    standalone "E". MUST run after merge_coefficient_products() (like
    replace_imaginary_unit): that function's ambiguity guard checks for the
    reserved uppercase "E" token to keep "2*E" as "2*E" instead of
    collapsing to "2E" — converting to lowercase first would remove the
    guard's anchor and let the merge fire, changing that already-decided
    presentation choice for imaginary/Euler coefficients."""
    return _EULERS_NUMBER_PATTERN.sub("e", text)


def replace_geometry_relations(text: str) -> str:
    """Paralelas -> Paralelas ∥, Perpendiculares -> Perpendiculares ⊥
    (Sprint 10). Word-boundary literal substitution, same pattern as the
    rest of this module — analytic_geometry/'s internal logic never uses
    these symbols, only the plain-Portuguese labels this function looks
    for."""
    text = _PARALELAS_PATTERN.sub("Paralelas ∥", text)
    text = _PERPENDICULARES_PATTERN.sub("Perpendiculares ⊥", text)
    return text
