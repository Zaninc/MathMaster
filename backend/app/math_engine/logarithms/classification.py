from sympy.core.expr import Expr

from .identities import is_log_identity

AVALIACAO = "avaliacao_numerica"
IDENTIDADE = "identidade_logaritmica"
GERAL = "expressao_logaritmica"

_LABELS = {
    AVALIACAO: "avaliação numérica",
    IDENTIDADE: "identidade logarítmica",
    GERAL: "expressão logarítmica/exponencial",
}


def label_for(kind: str) -> str:
    return _LABELS[kind]


def classify_log_expression(expr: Expr) -> str:
    if not expr.free_symbols:
        return AVALIACAO
    if is_log_identity(expr):
        return IDENTIDADE
    return GERAL
