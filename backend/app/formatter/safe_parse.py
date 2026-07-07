"""Low-level helpers shared by the Sprint 7.2 formatter shapes.

None of these functions attempt to guess or reconstruct meaning on their
own — they are only used *after* `classify.py` has already confirmed a
string structurally matches a known safe shape.
"""
from __future__ import annotations

import re

from sympy import sympify
from sympy.core.sympify import SympifyError

_RESERVED_TOKENS = {
    "sin", "cos", "tan", "asin", "acos", "atan",
    "log", "ln", "exp", "sqrt", "Abs",
    "pi", "tau", "I", "oo", "E",
}

_IDENTIFIER_PATTERN = re.compile(r"[a-zA-Z_]\w*")
_CALL_PATTERN = re.compile(r"([a-zA-Z_]\w*)\s*\(")


def safe_sympify(text: str):
    """Best-effort sympify; returns None instead of raising on failure."""
    text = text.strip()
    if not text:
        return None
    try:
        return sympify(text)
    except (SympifyError, SyntaxError, TypeError, ValueError, AttributeError):
        return None


def split_top_level(text: str, separator: str = ",") -> list[str]:
    """Split on `separator`, ignoring occurrences nested inside (), [] or {}."""
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    i = 0
    sep_len = len(separator)
    while i < len(text):
        char = text[i]
        if char in "([{":
            depth += 1
        elif char in ")]}":
            depth -= 1
        if depth == 0 and text[i : i + sep_len] == separator:
            parts.append("".join(current))
            current = []
            i += sep_len
            continue
        current.append(char)
        i += 1
    parts.append("".join(current))
    return [part.strip() for part in parts if part.strip()]


def guess_symbol(expression: str) -> str | None:
    """Best-effort guess of the single free-variable name in the *original*
    user input (not the math_engine output). Used only to relabel a bare
    FiniteSet like "{-4, 3}" as "x1 = -4, x2 = 3". Returns None whenever the
    guess is ambiguous — caller must degrade gracefully (plain set notation).
    """
    call_names = set(_CALL_PATTERN.findall(expression))
    candidates = {
        token
        for token in _IDENTIFIER_PATTERN.findall(expression)
        if token not in _RESERVED_TOKENS and token not in call_names
    }
    if len(candidates) == 1:
        return next(iter(candidates))
    return None
