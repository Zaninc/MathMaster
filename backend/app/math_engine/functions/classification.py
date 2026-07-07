from sympy import Poly
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..errors import ExpressionError
from .modular import is_modular_function
from .rational import is_rational_function

AFIM = "afim"
LINEAR = "linear"
QUADRATICA = "quadratica"
POLINOMIAL = "polinomial"
RACIONAL = "racional"
MODULAR = "modular"

_LABELS = {
    AFIM: "função afim",
    LINEAR: "função linear",
    QUADRATICA: "função quadrática",
    POLINOMIAL: "função polinomial",
    RACIONAL: "função racional",
    MODULAR: "função modular",
}


def label_for(kind: str) -> str:
    return _LABELS[kind]


def classify_function(expr: Expr, symbol: Symbol) -> str:
    if is_modular_function(expr):
        return MODULAR

    if is_rational_function(expr, symbol):
        return RACIONAL

    try:
        poly = Poly(expr, symbol)
    except Exception as exc:
        raise ExpressionError(
            f"Não foi possível classificar a função: {expr}"
        ) from exc

    grau = poly.degree()

    if grau == 1:
        termo_independente = poly.nth(0)
        return LINEAR if termo_independente == 0 else AFIM
    if grau == 2:
        return QUADRATICA
    if grau >= 3:
        return POLINOMIAL

    raise ExpressionError(
        f"Funções de grau {grau} ainda não são suportadas nesta versão."
    )
