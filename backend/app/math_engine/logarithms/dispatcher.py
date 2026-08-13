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
# Casa base numérica literal seguida de "**"/"^" e um expoente que começa
# com identificador ou parênteses (2**x, 10**(x+1), 2^x, 3^(x+1)) — não
# casa x**2 (base é símbolo, não dígito) nem 2**3 (expoente puramente
# numérico), então potências comuns de algebra/ continuam intocadas.
# "^" incluído (Sprint "Exponenciais e Logaritmos") — `safe_parse_expr`
# já converte "^" -> "**" internamente (`_convert_caret_power`) antes de
# QUALQUER parse, então a forma final resolvida é idêntica; a lacuna real
# era só de ROTEAMENTO: "2^x=8" nunca batia aqui (só "**" literal), caía
# no dispatcher de equações genérico (`equations/dispatcher.py`), que
# classifica por grau POLINOMIAL — falha porque x está no expoente, não
# na base, sem nenhuma mensagem específica de "isto é uma equação
# exponencial". Confirmado empiricamente: `solve_log_equation` já
# resolvia "2^x=8" corretamente QUANDO alcançada diretamente — só nunca
# era alcançada por essa forma de entrada.
_EXP_LITERAL_BASE_PATTERN = re.compile(r"(?<!\w)\d+(\.\d+)?\s*(\*\*|\^)\s*[\(a-zA-Z]")
# Constante de Euler solta como base de potência ("e^x", "e**x", "e^(2x)",
# "2e^x" — dígito colado na frente é multiplicação implícita, nunca parte
# de um número maior, já que "e" nunca é dígito) — Sprint "Exponenciais e
# Logaritmos". Mesma lacuna de roteamento do padrão acima: "e^x=5" nunca
# batia em nenhum padrão desta função (nem `_LOG_FUNCTION_PATTERN`, que
# exige "exp(" literal, nem `_EXP_LITERAL_BASE_PATTERN`, que exige base
# NUMÉRICA), caindo no dispatcher de equações genérico — lá, "e" solto
# vira `Symbol('e')` (nunca a constante), a equação passa a ter 2
# símbolos livres ("e" e "x") e é rejeitada com "só é possível resolver
# equações de uma única incógnita", uma mensagem que não tem nada a ver
# com a causa real. Deliberadamente SEM fronteira de palavra `\b` antes
# de "e" (só depois): "2e^x"/"3e^(2x)" (coeficiente numérico colado,
# ticket item 2) precisam bater também, e um "e" colado numa LETRA
# anterior (ex. "te^x", identificador de 2 letras) já era rejeitado antes
# desta mudança por `safe_parsing.py:_reject_ambiguous_identifiers` — rotear
# esse caso pra cá também não regride nada, só troca qual mensagem amigável
# aparece.
_EULER_EXPONENT_PATTERN = re.compile(r"e\s*(\*\*|\^)")
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
        or _EULER_EXPONENT_PATTERN.search(expression)
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
