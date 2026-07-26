r"""Sprint V2.6 — dispatcher do Motor de Polinômios Avançados.

Sintaxe própria, sem notação algébrica livre — mesmo padrão de
`calculus/`/`analytic_geometry/` (cada operação é uma chamada nomeada
explícita, nunca "adivinhada" a partir de uma equação livre):

    fatorar(expr)
    expandir(expr)
    simplificar(expr)
    grau(expr)
    coeficientes(expr)
    raizes(expr)                    (raízes)
    divisao(dividendo, divisor)     (divisão)

Ver `parsing.py` para o reconhecimento léxico completo (aliases PT-BR/
ASCII) e a posição desta área na cascata de `math_engine/dispatcher.py`
(logo depois de `complex`, antes de `calculus`/`functions`/`trigonometry`/
`logarithms`/`equations` — mesmo motivo já documentado por
`calculus/dispatcher.py`: o argumento de qualquer uma destas sete chamadas
pode conter livremente "sin(", "log(", "=" etc.).

Não implementado nesta versão (fora de escopo, reservado para uma sprint
V2.6.x futura): teorema do resto, teorema das raízes racionais,
Briot-Ruffini, interpolação, polinômios ortogonais, frações parciais,
séries de Taylor.
"""
from __future__ import annotations

from ..errors import ExpressionError
from .evaluator import (
    expand_polynomial,
    factor_polynomial,
    polynomial_coefficients,
    polynomial_degree,
    polynomial_division,
    polynomial_roots,
    simplify_polynomial,
)
from .formatter import (
    format_coefficients,
    format_degree,
    format_division,
    format_expanded,
    format_roots,
)
from .parsing import match_polynomial_call, parse_polynomial_fragment, split_top_level_args
from .validation import as_polynomial, resolve_polynomial_symbol


def is_polynomial_domain_expression(expression: str) -> bool:
    return match_polynomial_call(expression) is not None


def _solve_division(argumentos: str) -> str:
    partes = split_top_level_args(argumentos)
    if len(partes) != 2:
        raise ExpressionError(
            "divisão(...) espera exatamente 2 argumentos: dividendo e divisor."
        )
    dividendo = parse_polynomial_fragment(partes[0])
    divisor = parse_polynomial_fragment(partes[1])
    symbol = resolve_polynomial_symbol(dividendo, divisor)
    as_polynomial(dividendo, symbol)
    as_polynomial(divisor, symbol)
    quociente, resto = polynomial_division(dividendo, divisor, symbol)
    return format_division(quociente, resto)


def solve_polynomial_text(expression: str) -> str:
    match = match_polynomial_call(expression)
    if match is None:
        raise ExpressionError(f"Não foi possível interpretar a expressão: {expression}")
    operacao, argumentos = match

    if operacao == "divisao":
        return _solve_division(argumentos)

    expr = parse_polynomial_fragment(argumentos)

    if operacao == "fatorar":
        return str(factor_polynomial(expr))
    if operacao == "expandir":
        return format_expanded(expand_polynomial(expr))
    if operacao == "simplificar":
        return str(simplify_polynomial(expr))

    # grau/coeficientes/raizes: as três únicas operações restantes exigem
    # um polinômio genuíno de uma variável (ver `validation.py`) —
    # fatorar/expandir/simplificar acima trabalham sobre qualquer `Expr`
    # (incluindo expressões racionais, no caso de simplificar).
    symbol = resolve_polynomial_symbol(expr)
    poly = as_polynomial(expr, symbol)

    if operacao == "grau":
        return format_degree(polynomial_degree(poly))
    if operacao == "coeficientes":
        return format_coefficients(polynomial_coefficients(poly))
    if operacao == "raizes":
        raizes = polynomial_roots(expr, symbol)
        return format_roots(symbol, raizes)

    raise ExpressionError(f"Operação de polinômio não reconhecida: {operacao}")
