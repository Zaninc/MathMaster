"""Sprint 7.2 — output formatting layer.

Classification-first, conservative by design: `raw` is matched against a
small set of known, narrow output shapes (interval, finite set, "x = ..."
solution list, or a bare SymPy expression) BEFORE any parsing is attempted
— see `classify.py`. Only the matched shape's dedicated formatter ever
touches the string, and only the sub-fragments relevant to that shape are
passed to sympify — never the whole raw string blindly. Anything that
doesn't cleanly match a known shape (labeled "Tipo: ..." blocks, plain
messages, error text), or that fails to parse inside a matched shape, is
returned exactly as math_engine produced it.

This module never re-derives a result, only re-renders one math_engine
already computed correctly. It does not import from, and never modifies,
math_engine.
"""
from __future__ import annotations

from typing import Literal

from .classify import (
    is_assignment_shape,
    is_finiteset_shape,
    is_interval_shape,
    is_pure_expression_shape,
)
from .expr_clean import clean_expr, evalf_expr
from .render_roots import parse_assignment, sort_key, subscript
from .render_sets import render_finiteset_values, render_interval
from .safe_parse import guess_symbol, safe_sympify, split_top_level

Mode = Literal["exact", "decimal"]


def _apply_mode(expr, mode: Mode):
    cleaned = clean_expr(expr)
    return evalf_expr(cleaned) if mode == "decimal" else cleaned


def _format_interval(raw: str) -> str | None:
    parsed = safe_sympify(raw)
    if parsed is None:
        return None
    return render_interval(parsed)


def _format_finiteset(raw: str, expression: str) -> str | None:
    # NOTE: sympify('{a, b}') returns a plain Python `set`, not a
    # `sympy.FiniteSet` — sympifying the braces as a whole is a dead end.
    # Each element is parsed individually instead, same as every other
    # shape here (never sympify unclassified/whole-string text blindly).
    inner = raw[1:-1].strip()
    if not inner:
        return None
    pieces = split_top_level(inner)
    values = [safe_sympify(piece) for piece in pieces]
    if not pieces or any(value is None for value in values):
        return None
    symbol = guess_symbol(expression)
    return render_finiteset_values(values, symbol)


def _format_assignment_list(segments: list[str], mode: Mode) -> str | None:
    parsed = [parse_assignment(segment) for segment in segments]
    if any(item is None for item in parsed):
        return None

    values = [safe_sympify(expr_text) for _, expr_text in parsed]
    if any(value is None for value in values):
        return None

    symbols = {symbol for symbol, _ in parsed}
    pairs = list(zip((symbol for symbol, _ in parsed), values))

    if len(symbols) == 1:
        symbol = next(iter(symbols))
        pairs.sort(key=lambda pair: sort_key(pair[1]))
        rendered = [str(_apply_mode(value, mode)) for _, value in pairs]
        if len(rendered) == 1:
            return f"{symbol} = {rendered[0]}"
        return ", ".join(
            f"{symbol}{subscript(i + 1)} = {value}" for i, value in enumerate(rendered)
        )

    # Different symbols per segment => a system's solution tuple, not
    # multiple roots of one unknown: preserve segment order, don't index.
    return ", ".join(f"{symbol} = {_apply_mode(value, mode)}" for symbol, value in pairs)


def _format_pure_expression(raw: str, mode: Mode) -> str | None:
    parsed = safe_sympify(raw)
    if parsed is None:
        return None
    return str(_apply_mode(parsed, mode))


def format_result(expression: str, raw: str, mode: Mode = "exact") -> str:
    """Re-render solve_expression()'s output for legibility.

    `mode="decimal"` is prepared architecture for a future opt-in numeric
    display (Sprint 7.2 objective 3); not reachable from the public API yet
    — main.py always calls this with the default "exact", so current
    behaviour is unchanged unless a shape is positively recognised and
    successfully reformatted.
    """
    if not raw:
        return raw

    try:
        stripped = raw.strip()

        if is_interval_shape(stripped):
            rendered = _format_interval(stripped)
            return rendered if rendered is not None else raw

        if is_finiteset_shape(stripped):
            rendered = _format_finiteset(stripped, expression)
            return rendered if rendered is not None else raw

        segments = split_top_level(stripped)
        if is_assignment_shape(segments):
            rendered = _format_assignment_list(segments, mode)
            return rendered if rendered is not None else raw

        if is_pure_expression_shape(stripped):
            rendered = _format_pure_expression(stripped, mode)
            return rendered if rendered is not None else raw

        return raw
    except Exception:
        return raw
