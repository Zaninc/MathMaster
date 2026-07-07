from sympy.core.expr import Expr

from .identities import is_fundamental_identity

INVERSA = "trigonometria_inversa"
NOTAVEL = "valor_notavel"
IDENTIDADE = "identidade_fundamental"
GERAL = "expressao_trigonometrica"

_LABELS = {
    INVERSA: "trigonometria inversa",
    NOTAVEL: "valor notável",
    IDENTIDADE: "identidade trigonométrica fundamental",
    GERAL: "expressão trigonométrica",
}


def label_for(kind: str) -> str:
    return _LABELS[kind]


def classify_trig_expression(expr: Expr, mentions_inverse: bool) -> str:
    if mentions_inverse:
        return INVERSA
    if not expr.free_symbols:
        return NOTAVEL
    if is_fundamental_identity(expr):
        return IDENTIDADE
    return GERAL
