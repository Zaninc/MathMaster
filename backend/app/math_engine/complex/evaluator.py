r"""Sprint V2.3 — avaliação de expressões do Motor de Números Complexos.

Reaproveita 100% da infraestrutura segura já existente
(`safe_parse_expr`/`extract_safe_symbols` de `safe_parsing.py`, mesmo
padrão de `matrix/evaluator.py`/`summation/evaluator.py`): a única peça
nova é o `local_dict` desta área, que ensina o parser o que "i" e os três
nomes de função compostos (canônicos + aliases PT-BR/EN) significam — não
precisa de nenhuma árvore sintática própria, porque "+", "-", "*", "/",
"^" (potência) sobre números complexos já são exatamente a aritmética
normal que `safe_parse_expr`/SymPy resolvem nativamente assim que "i"
resolve para `sympy.I` (confirmado empiricamente durante o planejamento:
"(2+i)*(3-i)", "(1+i)^5", "(5+2i)/(1-i)" avaliam corretamente via
`expand()` puro, sem nenhum código de área específico).

`conjugate`/`modulus`/`argument` entram no MESMO `local_dict` — chamadas
delas, isoladas ou compostas com outras operações (ex. "modulo(3+4i)+1",
"2*conjugado(1+i)"), são só sintaxe de chamada de função normal.

`polar(...)` é a única exceção — não entra neste `local_dict` (não produz
um `Expr` composável; ver `dispatcher.py`/`parsing.py` para o porquê) —
`compute_polar_components` avalia só o ARGUMENTO de `polar(...)`, já
isolado por `parsing.extract_whole_polar_argument`, e devolve
separadamente o módulo e o argumento (θ) como `Expr`, para
`dispatcher.py` montar a expressão simbólica final `r*(cos(θ)+i*sin(θ))`.
"""
from __future__ import annotations

from sympy import Abs, I, arg, conjugate, expand
from sympy.core.expr import Expr

from ..errors import ExpressionError
from ..log_convention import LOCAL_DICT as _LOG_LOCAL_DICT
from ..safe_parsing import extract_safe_symbols, safe_parse_expr
from .validation import validate_nonzero_for_polar

# "i" (Sprint V2.3) ao lado de "I" — "I" maiúsculo já era globalmente
# reservado como unidade imaginária desde o Hardening III
# (`safe_parsing._ALLOWED_CONSTANTS`), em TODAS as áreas do motor; esta
# sprint estende a mesma reserva para a grafia minúscula convencional da
# matemática ("2+i", não "2+I") só DENTRO desta área — deliberadamente
# NUNCA em `safe_parsing.py`/`parser/normalize.py` (que afetariam TODAS
# as áreas incondicionalmente), porque "i" já é, em todo o produto, o
# nome de variável de laço de somatório por convenção (ex. "Σ(i=1..10)
# i", visível em `data/examples.ts`/`data/keyboard.ts` do frontend e em
# todo docstring de `summation/`). As duas convenções nunca colidem: em
# `math_engine/dispatcher.py`, `is_summation_domain_expression` decide
# PRIMEIRO, por prefixo ("Σ(", "sum(", "somatorio("), antes desta área
# ser sequer consultada — um cabeçalho de somatório nunca chega até aqui.
_FUNCTION_LOCAL_DICT = {
    "i": I,
    **_LOG_LOCAL_DICT,
    "conjugado": conjugate,
    "conj": conjugate,
    "modulo": Abs,
    "abs": Abs,
    "argumento": arg,
    "arg": arg,
}


def _build_local_dict(text: str) -> dict:
    extra_symbols = extract_safe_symbols(text, exclude=set(_FUNCTION_LOCAL_DICT))
    return {**_FUNCTION_LOCAL_DICT, **extra_symbols}


def _parse(text: str) -> Expr:
    try:
        return safe_parse_expr(text, local_dict=_build_local_dict(text))
    except ExpressionError:
        raise
    except Exception as exc:
        raise ExpressionError(f"Não foi possível interpretar a expressão: {text}") from exc


def evaluate_complex_expression(text: str) -> Expr:
    """Aritmética geral (incluindo `conjugate`/`modulus`/`argument`
    livremente compostas) — `expand()` é a única normalização aplicada,
    DELIBERADAMENTE não `algebra.dispatcher.solve_algebra` (que tenta
    `factor()` primeiro, reservado a `math_engine/dispatcher.py`'s
    fallback final): `factor()` sobre um produto de dois números
    complexos como "(2+i)*(3-i)" não tem fator comum para extrair de dois
    números concretos, então devolveria a forma NÃO avaliada
    "(2 + i)(3 - i)" em vez do valor "7 + i" — confirmado empiricamente
    durante o planejamento. `expand()` sempre resolve para a forma
    retangular padrão a+bi (SymPy já simplifica I**2 -> -1 automaticamente
    dentro de `expand`/`Mul`/`Add`, nenhum código extra necessário)."""
    return expand(_parse(text))


def compute_polar_components(argument_text: str) -> tuple[Expr, Expr]:
    z = expand(_parse(argument_text))
    validate_nonzero_for_polar(z)
    return Abs(z), arg(z)
