import re

from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    standard_transformations,
)

from ...canonical_constants import canonicalize_euler_constant
from ..errors import ExpressionError
from ..log_convention import LOCAL_DICT as _LOCAL_DICT
from ..safe_parsing import safe_parse_expr
from .classification import AVALIACAO, classify_log_expression, label_for
from .domain import validate_log_domain
from .equations import solve_log_equation
from .evaluate import evaluate_log_expression
from .simplify import simplify_log

_TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application,)

# A convenção OFICIAL e PERMANENTE do MathMaster (log(x) = base 10, ln(x) =
# base e) agora vive em `math_engine/log_convention.py`, compartilhada com
# `functions/` (Sprint 9) — ver docstring de lá para o motivo de não
# duplicar. Sobrescreve deliberadamente o padrão do SymPy (onde log() bare é
# natural); todo ponto de parse desta área deve usar `_LOCAL_DICT`.

_LOG_FUNCTION_PATTERN = re.compile(r"\b(log|ln|exp)\s*\(")
# Casa base numérica literal seguida de "**" e um expoente que começa com
# identificador ou parênteses (2**x, 10**(x+1)) — não casa x**2 (base é
# símbolo, não dígito) nem 2**3 (expoente puramente numérico), então
# potências comuns de algebra/ continuam intocadas.
_EXP_LITERAL_BASE_PATTERN = re.compile(r"(?<!\w)\d+(\.\d+)?\s*\*\*\s*[\(a-zA-Z]")
_EQUALS_PATTERN = re.compile(r"(?<![<>=!])=(?!=)")
_INEQUALITY_PATTERN = re.compile(r"<=|>=|<|>")

# Qualquer "log(" que sobreviver no resultado final é sempre o log natural
# nativo do SymPy — nosso log de base 10 nunca aparece como um nó "log(...)"
# isolado no resultado (ele já foi expandido para log(x)/log(10) no parse) —
# por isso é seguro renomear para "ln(" ao formatar a saída, propagando a
# convenção do produto também para a resposta, não só para a entrada.
_NATURAL_LOG_PATTERN = re.compile(r"\blog(?=\()")


def _rename_natural_log(text: str) -> str:
    return _NATURAL_LOG_PATTERN.sub("ln", text)


def is_logarithm_domain_expression(expression: str) -> bool:
    return bool(
        _LOG_FUNCTION_PATTERN.search(expression)
        or _EXP_LITERAL_BASE_PATTERN.search(expression)
    )


def _looks_like_equation(expression: str) -> bool:
    return bool(_EQUALS_PATTERN.search(expression))


def _looks_like_inequality(expression: str) -> bool:
    return bool(_INEQUALITY_PATTERN.search(expression))


def solve_logarithm_text(expression: str) -> str:
    if _looks_like_inequality(expression):
        raise ExpressionError(
            "Inequações logarítmicas/exponenciais ainda não fazem parte do escopo desta versão."
        )

    validate_log_domain(expression)

    if _looks_like_equation(expression):
        return _rename_natural_log(solve_log_equation(expression))

    try:
        expr = safe_parse_expr(expression, transformations=_TRANSFORMATIONS, local_dict=_LOCAL_DICT)
    except Exception as exc:
        raise ExpressionError(
            f"Não foi possível interpretar a expressão: {expression}"
        ) from exc

    # Hotfix V2.12.2a — puramente sintático (nunca recalcula nada): o
    # símbolo solto "e" sempre significa Euler nesta convenção, então
    # reclassificar ANTES de decidir avaliação-numérica vs. simplificação
    # geral deixa o resto do pipeline seguir sem nenhuma regra especial
    # (ex. "2*ln(e)" vira "2*log(E)", já uma AVALIAÇÃO numérica sem
    # símbolo livre nenhum, resolvida normalmente).
    expr = canonicalize_euler_constant(expr)

    kind = classify_log_expression(expr)
    if kind == AVALIACAO:
        resultado = evaluate_log_expression(expr)
    else:
        resultado = str(simplify_log(expr))

    resultado = _rename_natural_log(resultado)
    return f"Tipo: {label_for(kind)}; Resultado: {resultado}"
