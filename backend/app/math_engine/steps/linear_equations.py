"""Sprint V2.9 — motor de passo a passo para equações lineares de uma
única incógnita. Determinístico por construção: cada passo é o resultado
de UMA operação algébrica legal (propriedade distributiva, mover um termo
para o outro lado, dividir pelo coeficiente) aplicada com SymPy de
verdade — nunca um texto inventado depois que a solução já é conhecida.

Identidade ("2x+1=2x+1") e contradição ("2x+1=2x+3") não são casos
especiais tratados à parte: são o resultado NATURAL de `reduce_to_value`
quando, depois de mover os termos com x, não sobra nenhum x em nenhum dos
lados — nesse ponto só resta comparar duas constantes.
"""
from __future__ import annotations

from sympy import expand
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..equations.dispatcher import looks_like_inequality, split_equation_sides
from ..errors import ExpressionError
from ..safe_parsing import safe_parse_expr
from .formatting import eq_text, isolate_title, move_title
from .models import MathStep
from .validation import (
    UNSUPPORTED_INEQUALITY_MESSAGE,
    require_linear_degree,
    require_single_symbol,
)


def parse_equation_sides(text: str, *, local_dict: dict | None = None) -> tuple[Expr, Expr]:
    """Ponto único de parsing de uma equação de um único "=" para o resto
    de `steps/` (Sprint V2.9.1: também usado por `linear_systems.py` e
    `quadratic_equations.py` — antes duplicado em `linear_systems.py` como
    `_parse_equation_sides`, unificado aqui).

    `local_dict` (Sprint "Exponenciais e Logaritmos", opcional, `None` por
    padrão — nenhum chamador existente muda de comportamento) permite que
    `exponential_equations.py`/`logarithmic_equations.py` passem a
    convenção log/ln do produto (`log_convention.LOCAL_DICT`) — sem isso,
    "log(x)" parsearia como log NATURAL do SymPy (o padrão nativo, que
    este produto deliberadamente inverte), não base 10."""
    lhs_text, rhs_text = split_equation_sides(text)
    try:
        lhs = safe_parse_expr(lhs_text, local_dict=local_dict)
        rhs = safe_parse_expr(rhs_text, local_dict=local_dict)
    except ExpressionError:
        raise
    except Exception as exc:
        raise ExpressionError(f"Não foi possível interpretar a equação: {text}") from exc
    return lhs, rhs


def reduce_to_value(lhs: Expr, rhs: Expr, symbol: Symbol) -> tuple[Expr | None, list[MathStep]]:
    """Núcleo compartilhado: dada uma equação linear já validada (grau <= 1
    em `symbol`, podendo ter o símbolo dos dois lados), devolve o valor
    isolado (ou `None` para identidade/contradição — ver módulo) e a lista
    de passos até chegar lá. Não inclui "Equação inicial" nem a
    distributiva — responsabilidade do chamador; usado tanto pelo fluxo de
    equação única quanto por `linear_systems.py` (resolver a segunda
    incógnita por substituição começa exatamente deste ponto)."""
    steps: list[MathStep] = []
    current_lhs, current_rhs = lhs, rhs

    _, xpart_rhs = current_rhs.as_independent(symbol, as_Add=True)
    if xpart_rhs != 0:
        current_lhs = expand(current_lhs - xpart_rhs)
        current_rhs = expand(current_rhs - xpart_rhs)
        steps.append(MathStep(title=move_title(xpart_rhs), expression=eq_text(current_lhs, current_rhs)))

    if not current_lhs.has(symbol):
        if current_lhs == current_rhs:
            steps.append(
                MathStep(
                    title="Equação verdadeira para qualquer valor real de x — infinitas soluções",
                    expression=eq_text(current_lhs, current_rhs),
                )
            )
        else:
            steps.append(
                MathStep(
                    title="Equação falsa para qualquer valor — a equação não tem solução",
                    expression=eq_text(current_lhs, current_rhs),
                )
            )
        return None, steps

    const_lhs, _ = current_lhs.as_independent(symbol, as_Add=True)
    if const_lhs != 0:
        current_lhs = expand(current_lhs - const_lhs)
        current_rhs = expand(current_rhs - const_lhs)
        steps.append(MathStep(title=move_title(const_lhs), expression=eq_text(current_lhs, current_rhs)))

    coeff = current_lhs.as_independent(symbol, as_Add=False)[0]
    if coeff != 1:
        current_rhs = current_rhs / coeff
        current_lhs = symbol
        steps.append(MathStep(title=isolate_title(coeff), expression=eq_text(current_lhs, current_rhs)))

    return current_rhs, steps


def generate_linear_equation_steps(text: str) -> list[MathStep]:
    if looks_like_inequality(text):
        raise ExpressionError(UNSUPPORTED_INEQUALITY_MESSAGE)

    lhs, rhs = parse_equation_sides(text)

    symbols = lhs.free_symbols | rhs.free_symbols
    require_single_symbol(symbols)
    symbol = next(iter(symbols))

    require_linear_degree(expand(lhs - rhs), symbol)

    steps = [MathStep(title="Equação inicial", expression=eq_text(lhs, rhs))]

    expanded_lhs, expanded_rhs = expand(lhs), expand(rhs)
    if expanded_lhs != lhs or expanded_rhs != rhs:
        steps.append(
            MathStep(
                title="Aplicando a propriedade distributiva",
                expression=eq_text(expanded_lhs, expanded_rhs),
            )
        )

    _, rest = reduce_to_value(expanded_lhs, expanded_rhs, symbol)
    steps.extend(rest)
    return steps
