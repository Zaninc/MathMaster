from sympy.core.expr import Expr

from .factor import factor_expression
from .simplify import simplify_expression


def solve_algebra(expr: Expr) -> str:
    """Comportamento padrão da Sprint 4: idêntico ao da Sprint 1 (factor -> simplify -> raw).

    expand.py, powers.py, roots.py e products.py já existem como operações
    isoladas, mas ainda não são acionadas automaticamente aqui — ficam
    reservadas para seleção explícita de operação em uma sprint futura.
    """
    try:
        return str(factor_expression(expr))
    except Exception:
        pass

    try:
        return str(simplify_expression(expr))
    except Exception:
        return str(expr)
