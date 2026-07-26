r"""Sprint V2.6 — validações semânticas do Motor de Polinômios Avançados.

Erros de SINTAXE (parênteses desbalanceados, caractere fora da whitelist,
identificador ambíguo) já são rejeitados em `parsing.py`/`safe_parsing.py`,
antes de qualquer avaliação — mesma divisão de responsabilidade de
`matrix/validation.py` vs. `matrix/parsing.py`. Este módulo cobre os dois
estados que só fazem sentido verificar DEPOIS de a expressão já estar
parseada: mais de uma variável livre (grau/coeficientes/raízes/divisão só
são definidos para um polinômio de UMA variável) e um corpo que não é, de
fato, um polinômio nessa variável (ex. 1/x, sin(x), sqrt(x), x**(1/2))."""
from __future__ import annotations

from sympy.core.expr import Expr
from sympy.core.symbol import Symbol
from sympy.polys.polyerrors import PolynomialError
from sympy.polys.polytools import Poly

from ..errors import ExpressionError


def resolve_polynomial_symbol(*exprs: Expr) -> Symbol:
    """Uma única variável para todas as expressões combinadas. Se nenhuma
    tiver símbolo livre (ex. "grau(7)", uma constante), usa `x` por
    convenção — o grau/os coeficientes de uma constante independem da
    variável escolhida. Mais de uma letra livre ao todo é rejeitado com uma
    mensagem explícita, nunca "adivinhado" (ex. qual das duas é a incógnita
    em "divisao(x**2-y**2, x-y)")."""
    symbols: set[Symbol] = set()
    for expr in exprs:
        symbols |= expr.free_symbols
    if len(symbols) > 1:
        nomes = ", ".join(sorted(str(symbol) for symbol in symbols))
        raise ExpressionError(
            "Esta operação só é suportada para polinômios de uma única "
            f"variável (encontrado mais de uma: {nomes})."
        )
    if symbols:
        return next(iter(symbols))
    return Symbol("x")


def as_polynomial(expr: Expr, symbol: Symbol) -> Poly:
    """`sympy.Poly` levanta `PolynomialError` nativamente para qualquer
    corpo que não seja um polinômio genuíno em `symbol` (denominador com a
    variável, função transcendental, expoente fracionário/negativo) —
    capturado aqui e traduzido para uma mensagem amigável, nunca deixado
    vazar o repr interno do SymPy."""
    try:
        return Poly(expr, symbol)
    except PolynomialError as exc:
        raise ExpressionError(f"'{expr}' não é um polinômio em {symbol}.") from exc
