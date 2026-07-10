import logging

from sympy.core.expr import Expr

from .factor import factor_expression
from .simplify import simplify_expression

logger = logging.getLogger("mathmaster")


def solve_algebra(expr: Expr) -> str:
    """Comportamento padrão da Sprint 4: idêntico ao da Sprint 1 (factor -> simplify -> raw).

    expand.py, powers.py, roots.py e products.py já existem como operações
    isoladas, mas ainda não são acionadas automaticamente aqui — ficam
    reservadas para seleção explícita de operação em uma sprint futura.

    Hardening II: as duas exceções abaixo continuam amplas de propósito —
    `factor`/`simplify` podem falhar de várias formas não específicas em
    entradas legítimas, e o fallback (próxima etapa, depois `str(expr)` cru)
    é o comportamento correto para todas elas. A mudança desta sprint é só
    parar de engolir silenciosamente: agora fica logado em nível DEBUG, para
    não mascarar um bug real de programação atrás de um fallback que sempre
    "funciona" sem deixar rastro.
    """
    try:
        return str(factor_expression(expr))
    except Exception:
        logger.debug("factor_expression falhou para %r, tentando simplify", expr, exc_info=True)

    try:
        return str(simplify_expression(expr))
    except Exception:
        logger.debug("simplify_expression falhou para %r, retornando expressão crua", expr, exc_info=True)
        return str(expr)
