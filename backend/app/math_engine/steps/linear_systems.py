"""Sprint V2.9 — passo a passo de sistemas lineares 2x2 pelo método da
eliminação: soma/subtração direta das duas equações quando o coeficiente
da segunda incógnita já se cancela; senão, multiplica cada equação por uma
constante que force o cancelamento antes de somar (nunca "adivinha" o
multiplicador — é sempre o cruzamento `b2`/`-b1` que zera algebricamente o
termo em y). Resolve x primeiro, substitui numa das equações originais e reaproveita
`linear_equations.reduce_to_value` para isolar y — o mesmo motor que
resolve uma equação linear comum, porque depois da substituição é
exatamente isso que sobra.

Escopo desta primeira versão (ver LEARNING_RULES/CLAUDE_RULES do sprint):
exatamente 2 equações, 2 incógnitas, coeficientes racionais. Sistemas
maiores continuam resolvidos pelo motor atual (`equations/systems.py`),
sem passo a passo — `TOO_MANY_UNKNOWNS_MESSAGE`, nunca "fingido"."""
from __future__ import annotations

from sympy import Eq, expand, linear_eq_to_matrix
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..equations.dispatcher import split_equation_sides, split_equations
from ..equations.nonlinear_validation import is_linear_system
from ..errors import ExpressionError
from ..safe_parsing import safe_parse_expr
from .formatting import eq_text
from .linear_equations import reduce_to_value
from .models import MathStep
from .validation import TOO_MANY_UNKNOWNS_MESSAGE, UNSUPPORTED_SYSTEM_MESSAGE


def _parse_equation_sides(text: str) -> tuple[Expr, Expr]:
    lhs_text, rhs_text = split_equation_sides(text)
    try:
        return safe_parse_expr(lhs_text), safe_parse_expr(rhs_text)
    except ExpressionError:
        raise
    except Exception as exc:
        raise ExpressionError(f"Não foi possível interpretar a equação: {text}") from exc


def generate_linear_system_steps(text: str) -> list[MathStep]:
    parts = split_equations(text)
    if len(parts) != 2:
        raise ExpressionError(TOO_MANY_UNKNOWNS_MESSAGE if len(parts) > 2 else UNSUPPORTED_SYSTEM_MESSAGE)

    sides = [_parse_equation_sides(part) for part in parts]
    symbols = sorted(
        {symbol for lhs, rhs in sides for symbol in (lhs.free_symbols | rhs.free_symbols)},
        key=str,
    )
    if len(symbols) != 2:
        raise ExpressionError(TOO_MANY_UNKNOWNS_MESSAGE if len(symbols) > 2 else UNSUPPORTED_SYSTEM_MESSAGE)

    equations = [Eq(lhs, rhs) for lhs, rhs in sides]
    if not is_linear_system(equations, symbols):
        raise ExpressionError(UNSUPPORTED_SYSTEM_MESSAGE)

    x, y = symbols
    steps = [MathStep(title="Sistema inicial", expression="\n".join(parts))]

    matrix_a, matrix_b = linear_eq_to_matrix(equations, symbols)
    a1, b1 = matrix_a[0, 0], matrix_a[0, 1]
    a2, b2 = matrix_a[1, 0], matrix_a[1, 1]
    c1, c2 = matrix_b[0], matrix_b[1]

    if b1 == 0 and b2 == 0:
        # Nenhuma das duas equações depende de y — sistema degenerado para
        # o método da eliminação nesta forma; fora do escopo desta versão.
        raise ExpressionError(UNSUPPORTED_SYSTEM_MESSAGE)

    if b1 == -b2:
        m1, m2, op_title = 1, 1, "Somando as duas equações"
    elif b1 == b2:
        m1, m2, op_title = 1, -1, "Subtraindo a segunda equação da primeira"
    else:
        m1, m2, op_title = b2, -b1, "Somando as duas equações"

    if (m1, m2) not in {(1, 1), (1, -1)}:
        scaled1 = eq_text(expand(m1 * a1 * x + m1 * b1 * y), expand(m1 * c1))
        scaled2 = eq_text(expand(m2 * a2 * x + m2 * b2 * y), expand(m2 * c2))
        steps.append(
            MathStep(
                title=f"Multiplicando a primeira equação por {m1} e a segunda por {m2}",
                expression=f"{scaled1}\n{scaled2}",
            )
        )

    combined_lhs = expand(m1 * a1 * x + m1 * b1 * y + m2 * a2 * x + m2 * b2 * y)
    combined_rhs = expand(m1 * c1 + m2 * c2)
    steps.append(MathStep(title=op_title, expression=eq_text(combined_lhs, combined_rhs)))

    x_value, x_steps = reduce_to_value(combined_lhs, combined_rhs, x)
    steps.extend(x_steps)
    if x_value is None:
        # Sem solução / infinitas soluções já relatado por `reduce_to_value`.
        return steps

    # Substitui na primeira equação original que de fato depende de y — só
    # multiplicação/adição comuns bastam aqui (nunca colapsam "y" com um
    # número, unlike terms), diferente da substituição de
    # `summation/steps.py` (que evita colapsar aritmética repetida do MESMO
    # termo, ex. "2*1"); não há esse risco neste caso.
    sub_a, sub_b, sub_c = (a1, b1, c1) if b1 != 0 else (a2, b2, c2)
    sub_lhs = sub_a * x_value + sub_b * y
    steps.append(
        MathStep(
            title="Substituindo o valor encontrado em uma das equações originais",
            expression=eq_text(sub_lhs, sub_c),
        )
    )

    y_value, y_steps = reduce_to_value(expand(sub_lhs), sub_c, y)
    steps.extend(y_steps)

    if y_value is not None:
        steps.append(MathStep(title="Solução do sistema", expression=f"{x}={x_value}, {y}={y_value}"))

    return steps
