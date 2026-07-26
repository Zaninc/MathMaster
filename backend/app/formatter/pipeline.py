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

import re
from typing import Literal

from .classify import (
    is_assignment_shape,
    is_finiteset_shape,
    is_interval_shape,
    is_multi_assignment_shape,
    is_periodic_solution_shape,
    is_pure_expression_shape,
)
from .expr_clean import clean_expr, evalf_expr
from .render_roots import parse_assignment, sort_key, subscript
from .render_sets import render_finiteset_values, render_interval, render_periodic_solution
from .safe_parse import guess_symbol, safe_sympify, split_top_level

Mode = Literal["exact", "decimal"]

# SymPy só tem um único nome de impressão ("log") para logaritmo natural —
# um "ln(...)" vindo de math_engine/logarithms/ (Sprint 8) que passe por
# safe_sympify()/str() aqui reimprime como "log(...)", quebrando em silêncio
# a convenção oficial do MathMaster (log = base 10, ln = base e) para
# soluções de equação que não colapsam a um número exato (ex.: exp(x) = 8 ->
# x = log(8), na verdade log natural). Nenhuma outra área do math_engine
# produz "log(" hoje, então esta substituição é um no-op seguro para todo o
# resto do pipeline.
_NATURAL_LOG_PATTERN = re.compile(r"\blog(?=\()")


def _rename_natural_log(text: str) -> str:
    return _NATURAL_LOG_PATTERN.sub("ln", text)


def _apply_mode(expr, mode: Mode):
    cleaned = clean_expr(expr)
    return evalf_expr(cleaned) if mode == "decimal" else cleaned


def _format_interval(raw: str) -> str | None:
    parsed = safe_sympify(raw)
    if parsed is None:
        return None
    return render_interval(parsed)


def _format_periodic_solution(raw: str, expression: str) -> str | None:
    symbol = guess_symbol(expression)
    return render_periodic_solution(raw, symbol)


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
            return _rename_natural_log(f"{symbol} = {rendered[0]}")
        return _rename_natural_log(
            ", ".join(
                f"{symbol}{subscript(i + 1)} = {value}" for i, value in enumerate(rendered)
            )
        )

    # Different symbols per segment => a system's solution tuple, not
    # multiple roots of one unknown: preserve segment order, don't index.
    return _rename_natural_log(
        ", ".join(f"{symbol} = {_apply_mode(value, mode)}" for symbol, value in pairs)
    )


def _format_multi_assignment(branches: list[list[str]], mode: Mode) -> str | None:
    """Sprint V2.5 (Sistemas Polinomiais Não Lineares) — cada ramo "ou" é
    a solução de UM tuplo do sistema ("x = 2, y = 3"), com símbolos
    diferentes por segmento — reaproveita `_format_assignment_list` já
    existente (mesma limpeza/ordenação por valor), nunca duplica essa
    lógica. `None` se QUALQUER ramo falhar ao formatar (mesmo contrato
    "tudo ou nada" das outras formas — o chamador preserva o raw)."""
    rendered_branches = []
    for segments in branches:
        rendered = _format_assignment_list(segments, mode)
        if rendered is None:
            return None
        rendered_branches.append(rendered)
    return " ou ".join(rendered_branches)


def _format_pure_expression(raw: str, mode: Mode) -> str | None:
    parsed = safe_sympify(raw)
    if parsed is None:
        return None
    return _rename_natural_log(str(_apply_mode(parsed, mode)))


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

        if is_periodic_solution_shape(stripped):
            rendered = _format_periodic_solution(stripped, expression)
            return rendered if rendered is not None else raw

        if is_interval_shape(stripped):
            rendered = _format_interval(stripped)
            return rendered if rendered is not None else raw

        if is_finiteset_shape(stripped):
            rendered = _format_finiteset(stripped, expression)
            return rendered if rendered is not None else raw

        # Sprint V2.5 — checado ANTES do assignment-shape comum pelo
        # mesmo motivo que a forma periódica é checada antes das outras:
        # um split ingênuo por vírgula da string INTEIRA quebraria no
        # lugar errado (" ou " não é fronteira de vírgula). Só dispara
        # para o raw de múltiplas soluções de um sistema não linear
        # (`equations/nonlinear_formatter.py`) — uma equação normal nunca
        # contém " ou " no meio.
        ou_branches = [split_top_level(branch) for branch in split_top_level(stripped, " ou ")]
        if is_multi_assignment_shape(ou_branches):
            rendered = _format_multi_assignment(ou_branches, mode)
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
