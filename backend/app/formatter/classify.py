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

# Sprint 11.1 hotfix — trigonometry/equations.py returns SymPy's raw
# solveset() repr for periodic solutions (e.g. sin(x)=1/2), which prints as
# either "ImageSet(Lambda(_n, ...), Integers)" (one branch, e.g. tan(x)=1)
# or "Union(ImageSet(Lambda(_n, ...), Integers), ImageSet(...))" (multiple
# branches, e.g. sin/cos). This positively-identified prefix must be
# checked BEFORE is_interval_shape (whose "Union(" prefix would otherwise
# also match the multi-branch case) and before is_pure_expression_shape
# (which would otherwise swallow the single-branch case, since it contains
# none of "=":";").
_PERIODIC_SOLUTION_PATTERN = re.compile(r"^(Union\(ImageSet\(Lambda\(|ImageSet\(Lambda\()")


def is_interval_shape(text: str) -> bool:
    return bool(_INTERVAL_PATTERN.match(text.strip()))


def is_periodic_solution_shape(text: str) -> bool:
    return bool(_PERIODIC_SOLUTION_PATTERN.match(text.strip()))


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


def is_multi_assignment_shape(branches: list[list[str]]) -> bool:
    """Sprint V2.5 (Sistemas Polinomiais Não Lineares) — `branches` are
    already the top-level " ou "-split branches of the raw string, each
    itself already comma-split into segments (see
    `safe_parse.split_top_level`, called twice by the caller). True only
    if there are 2+ branches and EVERY branch is itself a valid
    assignment-shape list — the raw shape
    `equations/nonlinear_formatter.py` produces for a system with
    multiple solution tuples, e.g. "x = 2, y = 3 ou x = 3, y = 2". Must be
    checked BEFORE `is_assignment_shape` on the whole string: a naive
    comma-split of that raw string produces malformed segments (" y = 3
    ou x = 3" as ONE segment), since " ou " isn't a comma boundary."""
    return len(branches) >= 2 and all(is_assignment_shape(segments) for segments in branches)


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
