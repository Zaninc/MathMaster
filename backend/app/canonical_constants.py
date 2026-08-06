"""Hotfix V2.12.2a — simplificação canônica de constantes matemáticas na
CAMADA DE APRESENTAÇÃO, nunca no cálculo. Único módulo compartilhado por
`app/formatter/` (pipeline do `/solve`) e `app/math_engine/steps/`
(passo a passo) para este propósito — deliberadamente FORA dos dois
pacotes e sem importar nenhum deles, preservando o desacoplamento de mão
única já estabelecido no projeto (`app/formatter/pipeline.py`/
`app/math_engine/equations/nonlinear_formatter.py`: formatter nunca
importa math_engine, math_engine nunca importa formatter). Só sympy como
dependência.

Problema: quando o usuário digita o símbolo solto "e" (Euler) em vez da
função `exp(...)`, o parser cria um `Symbol` genérico de uma letra — o
MESMO tratamento de qualquer outra variável livre (`a`, `b`, `x`...) —
porque nenhuma área do motor associa esse símbolo à constante `sympy.E`
(diferente de "pi"/"π", que já é mapeado para `sympy.pi` na whitelist do
parser, `safe_parsing.py`). O cálculo em si (`compute_derivative`/
`compute_limit`, intocados por este hotfix) continua matematicamente
correto tratando "e" como uma constante livre — só a APRESENTAÇÃO final
sofre, porque o SymPy nunca reconhece `ln(Symbol('e'))` como 1 (só
`ln(sympy.E)` colapsa nativamente).

Correção: `xreplace` (substituição puramente sintática, nunca simplify/
subs disparando avaliação numérica) troca o símbolo "e" pela constante
real do SymPy IMEDIATAMENTE ANTES de qualquer expressão virar texto de
apresentação — depois disso, a simplificação NATIVA do próprio SymPy
(`ln(E)=1`, `E**0=1`) resolve tudo sozinha, sem nenhuma regra adicional
hardcoded por identidade."""
from __future__ import annotations

from sympy import E, Symbol
from sympy.core.expr import Expr

_EULER_SYMBOL = Symbol("e")


def canonicalize_euler_constant(expr: Expr) -> Expr:
    """"2*e**(2*x)*log(e)" (e = Symbol livre) -> "2*exp(2*x)" (e = sympy.E,
    log(E) já colapsa para 1 nativamente). No-op se "e" não aparecer na
    expressão — nunca força uma substituição desnecessária."""
    if not expr.has(_EULER_SYMBOL):
        return expr
    return expr.xreplace({_EULER_SYMBOL: E})
