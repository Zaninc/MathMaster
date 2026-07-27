from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    standard_transformations,
)

from .algebra.dispatcher import solve_algebra
from .analytic_geometry.dispatcher import (
    is_analytic_geometry_domain_expression,
    solve_analytic_geometry_text,
)
from .calculus.dispatcher import is_calculus_domain_expression, solve_calculus_text
from .calculus.natural_notation import normalize_calculus_notation
from .combinatorics.dispatcher import (
    is_combinatorics_domain_expression,
    solve_combinatorics_text,
)
from .complex.dispatcher import is_complex_domain_expression, solve_complex_text
from .equations.dispatcher import is_equation_domain_expression, solve_equation_text
from .errors import ExpressionError
from .functions.dispatcher import is_function_domain_expression, solve_function_text
from .logarithms.dispatcher import (
    is_logarithm_domain_expression,
    solve_logarithm_text,
)
from .matrix.dispatcher import is_matrix_domain_expression, solve_matrix_text
from .parser.normalize import normalize_expression
from .polynomials.dispatcher import (
    is_polynomial_domain_expression,
    solve_polynomial_text,
)
from .safe_parsing import safe_parse_expr
from .summation.dispatcher import (
    is_summation_domain_expression,
    solve_summation_text,
    solve_summation_with_approx,
)
from .trigonometry.dispatcher import (
    is_trigonometry_domain_expression,
    solve_trigonometry_text,
)

_TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application,)


def normalize_all(expression: str) -> str:
    """Compõe as duas camadas de normalização puramente textual, nesta
    ordem exata: Sprint Parser (Unicode/aliases gerais) primeiro, depois
    Sprint 12.1 (notação natural de cálculo — d/dx, ∫, lim), que já espera
    receber o texto geral já normalizado (ex. "sen(x)" -> "sin(x)" antes de
    "d/dx(sen(x))" virar "derivada(sin(x), x)"). Único ponto de entrada
    usado tanto por `solve_expression` quanto por `main.py` (que recalcula
    a normalização à parte só para formatar/rotular o resultado, nunca para
    o histórico — ver `app/main.py`)."""
    return normalize_calculus_notation(normalize_expression(expression))


def solve_expression(expression: str) -> str:
    expression = expression.strip()
    if not expression:
        raise ExpressionError("A expressão não pode estar vazia.")

    # Sprint Parser + Sprint 12.1 — normaliza Unicode/aliases/notação
    # natural de cálculo ANTES de qualquer roteamento de domínio, porque os
    # roteadores abaixo decidem por regex sobre o texto bruto (ex. "sen(x)"
    # só é reconhecido como trigonometria depois de virar "sin(x)"; "d/dx(x)"
    # só é reconhecido como cálculo depois de virar "derivada(x, x)"). Ver
    # docstrings de `parser/normalize.py` e `calculus/natural_notation.py`.
    expression = normalize_all(expression)

    if is_analytic_geometry_domain_expression(expression):
        return solve_analytic_geometry_text(expression)

    # Sprint V2.1 — precisa vir antes de calculus/functions/trigonometry/
    # logarithms/equations pelo mesmo motivo que já justifica calculus vir
    # antes delas: o corpo de "Σ(...)  ..." pode conter livremente "sin(",
    # "log(", "=" etc., e essas áreas casam por `.search()` no texto
    # inteiro. Ver docstring de `summation/dispatcher.py`.
    if is_summation_domain_expression(expression):
        return solve_summation_text(expression)

    # Sprint V2.2 — precisa vir antes de calculus/functions/trigonometry/
    # logarithms/equations pelo mesmo motivo que já justifica summation vir
    # antes delas: o argumento de "det(...)"/"inv(...)"/etc., ou o lado
    # direito de uma multiplicação por escalar, pode conter livremente
    # números que essas áreas casariam por conta própria. Ver docstring de
    # `matrix/dispatcher.py`.
    if is_matrix_domain_expression(expression):
        return solve_matrix_text(expression)

    # Sprint V2.3 — precisa vir antes de calculus/functions/trigonometry/
    # logarithms/equations pelo mesmo motivo que já justifica matrix vir
    # antes delas: o argumento de "conjugado(...)"/"modulo(...)"/etc. pode
    # conter livremente números que essas áreas casariam por conta própria.
    # Ver docstring de `complex/dispatcher.py`.
    if is_complex_domain_expression(expression):
        return solve_complex_text(expression)

    # Sprint V2.6 — precisa vir antes de calculus/functions/trigonometry/
    # logarithms/equations pelo mesmo motivo que já justifica complex vir
    # antes delas: o argumento de "fatorar(...)"/"raizes(...)"/etc. pode
    # conter livremente "sin(", "log(", "=" etc. Ver docstring de
    # `polynomials/dispatcher.py`.
    if is_polynomial_domain_expression(expression):
        return solve_polynomial_text(expression)

    # Sprint V2.7 — chamadas nomeadas ancoradas ("fatorial(6)",
    # "combinacao(10,3)", "C(10,3)"...), mesma família de polynomials acima.
    # Os argumentos são só inteiros, então não há risco real de roubo por
    # calculus/trigonometry/etc., mas a posição segue a convenção das áreas
    # de chamada nomeada. "5!"/"factorial(5)" soltos continuam caindo na
    # álgebra (fallback), intocados. Ver `combinatorics/dispatcher.py`.
    if is_combinatorics_domain_expression(expression):
        return solve_combinatorics_text(expression)

    # Sprint 12 — precisa vir antes de functions/trigonometry/logarithms:
    # essas áreas casam "sin("/"log(" em qualquer posição do texto, o que
    # roubaria uma chamada como "integral(sin(x), x)" se checado depois.
    if is_calculus_domain_expression(expression):
        return solve_calculus_text(expression)

    if is_function_domain_expression(expression):
        return solve_function_text(expression)

    if is_trigonometry_domain_expression(expression):
        return solve_trigonometry_text(expression)

    if is_logarithm_domain_expression(expression):
        return solve_logarithm_text(expression)

    if is_equation_domain_expression(expression):
        return solve_equation_text(expression)

    try:
        parsed = safe_parse_expr(expression, transformations=_TRANSFORMATIONS)
    except Exception as exc:
        raise ExpressionError(
            f"Não foi possível interpretar a expressão: {expression}"
        ) from exc

    return solve_algebra(parsed)


def solve_expression_with_approx(expression: str) -> tuple[str, str | None]:
    """Sprint V2.1 (apresentação progressiva) — mesmo resultado de
    `solve_expression`, mais uma aproximação numérica decimal quando a
    expressão é um somatório (única área que produz hoje resultados
    simbólicos longos o bastante para precisar disso; ver `MEMORY`/relatório
    da sprint — escopo consciente, não retroativo às outras áreas).

    Contrato de `solve_expression` continua 100% intocado (mesma função,
    mesma assinatura, usada em `/ready` e em toda a suíte de testes) — esta
    é uma função NOVA e separada, só chamada por `execution.py`/`main.py`
    para o `/solve`.
    """
    result = solve_expression(expression)
    normalized = normalize_all(expression)
    if is_summation_domain_expression(normalized):
        return result, solve_summation_with_approx(normalized)
    return result, None
