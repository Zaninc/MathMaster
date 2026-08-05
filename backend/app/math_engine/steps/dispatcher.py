"""Sprint V2.9 — ponto único de roteamento do passo a passo determinístico.
Nunca chamado por `/solve` (contrato `{expression, result, approx}`
intocado) — só pela rota nova `/solve/steps` em `main.py`.

Antes de decidir "isto é uma equação/sistema", exclui explicitamente
TODOS os outros domínios do motor, na MESMA ordem de prioridade de
`math_engine/dispatcher.py` — necessário porque vários deles usam "="
livremente por dentro (ex. `A=[[1,2],[3,4]]` é matriz, não equação;
`Σ(i=1..5) x=i` tem um "=" dentro do cabeçalho). Sem essa exclusão, um
texto de outro domínio cairia no parser de equação linear e falharia de
forma confusa (ou, em casos como matriz, um `AttributeError` cru em vez de
`ExpressionError`) em vez de reportar com clareza que aquela área ainda
não tem passo a passo nesta versão."""
from __future__ import annotations

from ..analytic_geometry.dispatcher import is_analytic_geometry_domain_expression
from ..calculus.dispatcher import is_calculus_domain_expression
from ..combinatorics.dispatcher import is_combinatorics_domain_expression
from ..complex.dispatcher import is_complex_domain_expression
from ..dispatcher import normalize_all
from ..equations.dispatcher import is_equation_domain_expression, split_equations
from ..errors import ExpressionError
from ..functions.dispatcher import is_function_domain_expression
from ..logarithms.dispatcher import is_logarithm_domain_expression
from ..matrix.dispatcher import is_matrix_domain_expression
from ..polynomials.dispatcher import is_polynomial_domain_expression
from ..probability.dispatcher import is_probability_domain_expression
from ..summation.dispatcher import is_summation_domain_expression
from ..trigonometry.dispatcher import is_trigonometry_domain_expression
from .linear_equations import generate_linear_equation_steps
from .linear_systems import generate_linear_system_steps
from .models import MathStep
from .validation import EMPTY_EXPRESSION_MESSAGE, UNSUPPORTED_DOMAIN_MESSAGE

_NON_EQUATION_DOMAIN_CHECKS = (
    is_analytic_geometry_domain_expression,
    is_summation_domain_expression,
    is_matrix_domain_expression,
    is_complex_domain_expression,
    is_polynomial_domain_expression,
    is_combinatorics_domain_expression,
    is_probability_domain_expression,
    is_calculus_domain_expression,
    is_function_domain_expression,
    is_trigonometry_domain_expression,
    is_logarithm_domain_expression,
)


def generate_steps(expression: str) -> list[MathStep]:
    expression = expression.strip()
    if not expression:
        raise ExpressionError(EMPTY_EXPRESSION_MESSAGE)

    normalized = normalize_all(expression)

    if any(check(normalized) for check in _NON_EQUATION_DOMAIN_CHECKS):
        raise ExpressionError(UNSUPPORTED_DOMAIN_MESSAGE)

    if not is_equation_domain_expression(normalized):
        raise ExpressionError(UNSUPPORTED_DOMAIN_MESSAGE)

    parts = split_equations(normalized)
    if len(parts) > 1:
        return generate_linear_system_steps(normalized)
    return generate_linear_equation_steps(normalized)
