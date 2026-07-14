r"""Sprint 12.1 — normalização de notação natural de Cálculo.

Camada puramente textual (regex/bracket-matching, nunca parsing/eval) que
roda IMEDIATAMENTE DEPOIS de `parser/normalize.py:normalize_expression()` e
ANTES de qualquer roteamento de domínio — mesmo andar arquitetural da
Sprint Parser, só que com vocabulário específico de cálculo (d/dx, ∫, lim),
por isso vive dentro de `calculus/` (convenção "cada área é
self-contained") em vez de dentro do normalizador geral.

Reescreve para a sintaxe técnica já existente e intocada:
    d/dx(expr)                              -> derivada(expr, x)
    ∫expr dx  /  ∫(expr)dx                  -> integral(expr, x)
    ∫_a^b expr dx                           -> integral(expr, x, a, b)
    ∫₀¹expr dx  (só limites inteiros)       -> integral(expr, x, 0, 1)
    lim x→p expr / lim(x→p) expr / lim_{x→p} expr -> limite(expr, x, p)

Mesma regra da Sprint Parser: cada padrão só dispara em uma forma
sintática inequívoca. Qualquer coisa fora desses padrões (d/dx sem
parênteses, ∫ sem "d<var>" final, "lim" malformado, dy/dx, ∫[0,1]) passa
INTOCADA — não é adivinhada aqui, é rejeitada mais adiante por
`_reject_ambiguous_identifiers`/`_ALLOWED_CHARS_PATTERN` (safe_parsing.py)
ou pelo parser do SymPy, exatamente como qualquer entrada inválida já é
hoje. Única exceção deliberada: limites laterais (`x→0+`/`x→0-`) são
detectados e rejeitados aqui com uma mensagem dedicada, para nunca serem
silenciosamente calculados como bilaterais (ver auditoria da Sprint 12.1).

Cada padrão só é reconhecido quando ocupa a expressão INTEIRA (mesma âncora
que a sintaxe técnica `derivada(...)/integral(...)/limite(...)` já usa) —
isso elimina a ambiguidade de "onde termina a expressão" sem precisar de
uma gramática completa.

Não importa nada de `safe_parsing`/SymPy — não faz parsing, não decide
domínio, não é chamado por `safe_parse_expr` em nenhum momento.
"""
from __future__ import annotations

import re

from ..errors import ExpressionError

_BRACKET_PAIRS = {"(": ")", "{": "}"}


def _find_closing(text: str, open_idx: int) -> int | None:
    """Índice do fechamento que casa com o abridor em `open_idx` (suporta
    "(" ou "{"), ou None se não houver — mesma técnica de bracket-counting
    já usada em `parser/normalize.py`/`calculus/dispatcher.py`, duplicada
    aqui deliberadamente (convenção de área self-contained)."""
    opener = text[open_idx]
    closer = _BRACKET_PAIRS[opener]
    depth = 0
    for i in range(open_idx, len(text)):
        if text[i] == opener:
            depth += 1
        elif text[i] == closer:
            depth -= 1
            if depth == 0:
                return i
    return None


# --- Derivada: "d/dx(expr)" -------------------------------------------

_DERIVATIVE_PATTERN = re.compile(r"^\s*d\s*/\s*d([a-zA-Z])\s*\(")


def _try_derivative(text: str) -> str | None:
    match = _DERIVATIVE_PATTERN.match(text)
    if not match:
        return None
    var = match.group(1)
    open_idx = match.end() - 1
    close_idx = _find_closing(text, open_idx)
    if close_idx is None:
        return None
    if text[close_idx + 1 :].strip():
        # Conteúdo sobrando depois do ")" — não é a expressão inteira,
        # deixa intocado (ex. "d/dx(x) + 1" não é reconhecido em V1).
        return None
    inner = text[open_idx + 1 : close_idx].strip()
    if not inner:
        return None
    return f"derivada({inner}, {var})"


# --- Integral: "∫expr dx" / "∫(expr)dx" / "∫_a^b expr dx" / "∫₀¹expr dx" -

_SUBSCRIPT_TO_DIGIT = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")
_VALID_SUBSCRIPT_RUN = re.compile(r"^₋?[₀₁₂₃₄₅₆₇₈₉]+$")
_SUBSCRIPT_RUN = re.compile(r"[₀₁₂₃₄₅₆₇₈₉₋]+")

_SUPERSCRIPT_TO_DIGIT = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹", "0123456789")
_VALID_SUPERSCRIPT_RUN = re.compile(r"^⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+$")
_SUPERSCRIPT_RUN = re.compile(r"[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+")

_LOWER_BOUND_TOKEN = re.compile(r"[^\s^]+")
_UPPER_BOUND_TOKEN = re.compile(r"\S+")
_INTEGRAL_TAIL = re.compile(r"^\s*(.*?)\s*d([a-zA-Z])\s*$", re.DOTALL)


def _convert_subscript_run(run: str) -> str | None:
    if not _VALID_SUBSCRIPT_RUN.match(run):
        return None
    if run.startswith("₋"):
        return "-" + run[1:].translate(_SUBSCRIPT_TO_DIGIT)
    return run.translate(_SUBSCRIPT_TO_DIGIT)


def _convert_superscript_run(run: str) -> str | None:
    if not _VALID_SUPERSCRIPT_RUN.match(run):
        return None
    if run.startswith("⁻"):
        return "-" + run[1:].translate(_SUPERSCRIPT_TO_DIGIT)
    return run.translate(_SUPERSCRIPT_TO_DIGIT)


def _capture_bound(text: str, pos: int, token_pattern: re.Pattern[str]) -> tuple[str, int] | None:
    """Captura um limite de integral definida em notação ASCII a partir de
    `pos`: "{...}"/"(...)" (bracket-matching, aceita sub-expressão composta)
    ou um token simples sem espaço (`token_pattern`, ex. "-1", "1/2", "pi",
    "oo"). Retorna (conteúdo, próxima posição) ou None se não houver nada
    válido — chamador deve deixar o texto original intocado nesse caso."""
    if pos >= len(text):
        return None
    if text[pos] in _BRACKET_PAIRS:
        close = _find_closing(text, pos)
        if close is None:
            return None
        inner = text[pos + 1 : close].strip()
        if not inner:
            return None
        return inner, close + 1
    match = token_pattern.match(text, pos)
    if not match or not match.group():
        return None
    return match.group(), match.end()


def _try_integral(text: str) -> str | None:
    stripped = text.strip()
    if not stripped.startswith("∫"):
        return None
    pos = 1
    lower: str | None = None
    upper: str | None = None

    if pos < len(stripped) and stripped[pos] == "_":
        # Forma ASCII: ∫_a^b ... (a/b podem ser um token simples ou um
        # grupo "{...}"/"(...)" — suporta negativo, fração, pi, oo).
        pos += 1
        cap = _capture_bound(stripped, pos, _LOWER_BOUND_TOKEN)
        if cap is None:
            return None
        lower, pos = cap
        while pos < len(stripped) and stripped[pos] == " ":
            pos += 1
        if pos >= len(stripped) or stripped[pos] != "^":
            return None
        pos += 1
        cap = _capture_bound(stripped, pos, _UPPER_BOUND_TOKEN)
        if cap is None:
            return None
        upper, pos = cap
    else:
        # Forma Unicode: ∫₀¹... — só limites inteiros (incl. "₋" negativo);
        # fração/pi/oo exigem a forma ASCII "_a^b" acima.
        sub_match = _SUBSCRIPT_RUN.match(stripped, pos)
        if sub_match:
            sup_match = _SUPERSCRIPT_RUN.match(stripped, sub_match.end())
            if not sup_match:
                # Subscrito sem superscrito colado logo em seguida — não é
                # um par de limites válido, não adivinha.
                return None
            lower = _convert_subscript_run(sub_match.group())
            upper = _convert_superscript_run(sup_match.group())
            if lower is None or upper is None:
                return None
            pos = sup_match.end()
        elif pos < len(stripped) and stripped[pos] == "[":
            # "∫[0,1] ..." — notação de intervalo com colchetes, rejeitada
            # deliberadamente (ver auditoria da Sprint 12.1): sem isso, o
            # "[0,1]" cairia como se fosse parte do integrando de uma
            # integral indefinida, produzindo uma sintaxe técnica sem
            # sentido em vez de deixar a entrada intocada.
            return None

    remainder = stripped[pos:]
    tail_match = _INTEGRAL_TAIL.match(remainder)
    if not tail_match:
        return None
    body, var = tail_match.group(1), tail_match.group(2)
    if not body.strip():
        return None

    if lower is None:
        return f"integral({body}, {var})"
    return f"integral({body}, {var}, {lower}, {upper})"


# --- Limite: "lim x→p expr" / "lim(x→p) expr" / "lim_{x→p} expr" -------

_LIM_KEYWORD = re.compile(r"^\s*lim(?![a-zA-Z])\s*")
_VAR_ARROW = re.compile(r"([a-zA-Z])\s*(?:->|→)\s*")
_POINT_TOKEN = re.compile(r"\S+")


def _try_limit(text: str) -> str | None:
    # "lim(?![a-zA-Z])" em vez de um "\blim\b" ingênuo: "\b" trata "_" como
    # caractere de palavra, então "lim_{x->0}..." (forma braced) falharia
    # o boundary entre "m" e "_" — o lookahead negativo exclui "limite"/
    # "limpar"/"limit" (que continuam com letra logo depois de "lim") sem
    # excluir "_"/"("/espaço/dígito, que são os únicos separadores válidos
    # aqui.
    stripped = text.strip()
    keyword_match = _LIM_KEYWORD.match(stripped)
    if not keyword_match:
        return None
    pos = keyword_match.end()
    if pos < len(stripped) and stripped[pos] == "_":
        pos += 1

    if pos < len(stripped) and stripped[pos] in _BRACKET_PAIRS:
        close = _find_closing(stripped, pos)
        if close is None:
            return None
        inner = stripped[pos + 1 : close].strip()
        arrow_match = _VAR_ARROW.match(inner)
        if not arrow_match:
            return None
        var = arrow_match.group(1)
        point = inner[arrow_match.end() :].strip()
        if not point:
            return None
        pos = close + 1
    else:
        arrow_match = _VAR_ARROW.match(stripped, pos)
        if not arrow_match:
            return None
        var = arrow_match.group(1)
        point_match = _POINT_TOKEN.match(stripped, arrow_match.end())
        if not point_match:
            return None
        point = point_match.group()
        pos = point_match.end()

    body = stripped[pos:].strip()
    if not body:
        return None

    if point.endswith("+") or point.endswith("-"):
        # Limites laterais ficam fora do escopo desta versão (decisão
        # explícita da auditoria) — rejeita com mensagem dedicada em vez de
        # calcular silenciosamente um limite bilateral que não é o que foi
        # pedido.
        raise ExpressionError(
            "Limites laterais (ex. x→0+ ou x→0-) ainda não são suportados nesta versão."
        )

    return f"limite({body}, {var}, {point})"


def normalize_calculus_notation(text: str) -> str:
    """Ponto único de entrada — tenta cada padrão nesta ordem; a primeira
    reescrita bem-sucedida vence. Nenhum padrão colide com os outros (cada
    um exige um marcador inicial distinto: "d/d", "∫" ou "lim"), então a
    ordem entre si não importa para o resultado, só para o custo (padrões
    mais comuns primeiro). Entrada que já está em sintaxe técnica
    (derivada/integral/limite) nunca casa com nenhum desses padrões — ver
    `tests/math_engine/test_calculus_natural_notation.py` para a prova de
    idempotência."""
    for attempt in (_try_derivative, _try_integral, _try_limit):
        rewritten = attempt(text)
        if rewritten is not None:
            return rewritten
    return text
