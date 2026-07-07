"""Sprint 7.2 — output-shape classification.

Runs BEFORE any parsing attempt: decides which (if any) of the known,
narrow output shapes `raw` belongs to. Each recognised shape has exactly
one dedicated formatter downstream (see `render_sets.py` / `render_roots.py`
via `pipeline.py`). Anything that does not cleanly match one of these
shapes is "texto comum" (labeled "Tipo: ..." blocks, plain messages, error
text) and must be returned untouched by the caller — see `pipeline.py`.
"""
from __future__ import annotations

import re

_INTERVAL_PATTERN = re.compile(r"^(Interval\b|Union\(|EmptySet$|Reals$)")
_FINITESET_PATTERN = re.compile(r"^\{.*\}$")
_ASSIGNMENT_SEGMENT_PATTERN = re.compile(r"^[a-zA-Z_]\w*\s*=\s*.+$")
_PURE_EXPRESSION_PATTERN = re.compile(r"^[0-9A-Za-z_+\-*/().,\s^%!]*$")


def is_interval_shape(text: str) -> bool:
    return bool(_INTERVAL_PATTERN.match(text.strip()))


def is_finiteset_shape(text: str) -> bool:
    return bool(_FINITESET_PATTERN.match(text.strip()))


def is_assignment_shape(segments: list[str]) -> bool:
    """`segments` must already be the top-level comma-split pieces of the
    raw string (see `safe_parse.split_top_level`). True only if EVERY
    segment is a bare "identifier = ..." assignment — a single non-matching
    segment (e.g. a "f(2) = 7" call, or plain text) rejects the whole
    string, so the caller preserves it untouched rather than half-format."""
    if not segments:
        return False
    return all(_ASSIGNMENT_SEGMENT_PATTERN.match(segment) for segment in segments)


def is_pure_expression_shape(text: str) -> bool:
    """Conservative whitelist: SymPy's str() of a plain expression never
    contains "=", ":", ";" or accented/non-ASCII characters — Portuguese
    messages ("Sistema sem solução", "Tipo: ...") always do, so rejecting
    those characters is enough to keep this bucket from ever swallowing
    plain text into a sympify() call."""
    text = text.strip()
    if not text or "=" in text or ":" in text or ";" in text:
        return False
    return bool(_PURE_EXPRESSION_PATTERN.match(text))
