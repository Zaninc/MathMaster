from sympy import Eq, Pow
from sympy import log as sympy_log
from sympy import solve
from sympy.parsing.sympy_parser import (
    convert_equals_signs,
    implicit_multiplication_application,
    standard_transformations,
)

from ...canonical_constants import canonicalize_euler_constant
from ..errors import ExpressionError
from ..safe_parsing import safe_parse_expr

_TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication_application,
    convert_equals_signs,
)

# Mesma convenção de dispatcher.py: log = base 10, ln = base e. Duplicado
# aqui (em vez de importado) seguindo o mesmo padrão já usado entre
# trigonometry/dispatcher.py e trigonometry/equations.py (cada arquivo que
# chama parse_expr mantém sua própria cópia).
_LOCAL_DICT = {
    "log": lambda x: sympy_log(x, 10),
    "ln": sympy_log,
}


def _validate_exponential_base(equation: Eq, symbol) -> None:
    # Suporte a a**x = b restrito a bases LITERAIS positivas e diferentes de 1
    # (ex.: 2**x = 8, 10**x = 1000, 5**x = 125). Base simbólica (a**x = b com
    # "a" incógnita) está fora do escopo desta sprint — nem chega a ser
    # roteada para logarithms/, pois _EXP_LITERAL_BASE_PATTERN (dispatcher.py)
    # só casa base numérica.
    for node in equation.atoms(Pow):
        base, expoente = node.args
        if not base.is_number or symbol not in expoente.free_symbols:
            continue
        if base <= 0 or base == 1:
            raise ExpressionError(
                "A base de uma equação exponencial deve ser um número real positivo diferente de 1."
            )


def solve_log_equation(text: str) -> str:
    try:
        parsed = safe_parse_expr(text, transformations=_TRANSFORMATIONS, local_dict=_LOCAL_DICT)
    except Exception as exc:
        raise ExpressionError(f"Não foi possível interpretar a equação: {text}") from exc

    if not isinstance(parsed, Eq):
        raise ExpressionError(f"Não foi possível interpretar a equação: {text}")

    # Sprint "Exponenciais e Logaritmos" — causa raiz do bug relatado
    # ("e^x=5" nunca resolvia): sem isto, o símbolo solto "e" (Euler) é
    # indistinguível de qualquer outra variável livre de uma letra só —
    # `Eq(e**x, 5)` tem 2 símbolos livres ("e" e "x"), rejeitado abaixo
    # como "equação de mais de uma incógnita" mesmo a equação sendo,
    # matematicamente, de uma incógnita só. Mesma função já usada por
    # `dispatcher.py` (branch de expressão, não de equação) e por
    # `calculus/dispatcher.py` — puramente sintática (`xreplace`, nunca
    # `subs`/`simplify`), então nunca recalcula nada, só troca o símbolo
    # pela constante real do SymPy ANTES de qualquer decisão de domínio.
    parsed = canonicalize_euler_constant(parsed)

    symbols = list(parsed.free_symbols)
    if len(symbols) != 1:
        raise ExpressionError(
            "Só é possível resolver equações logarítmicas/exponenciais de uma única incógnita nesta versão."
        )
    symbol = symbols[0]

    _validate_exponential_base(parsed, symbol)

    # Achado real (Sprint "Exponenciais e Logaritmos"): `sympy.solve()` para
    # equações exponenciais transcendentais devolve TODOS os ramos
    # complexos (ex. `e**(2x)=7` -> `[log(7)/2 + I*pi, log(7)/2]` — o
    # primeiro é um ramo espúrio do logaritmo complexo, nunca uma solução
    # real de verdade) — confirmado empiricamente, inclusive para
    # `exp(2*x)=7` já alcançável ANTES desta sprint (bug pré-existente,
    # nunca coberto por teste). `domain=S.Reals` no `solve()` NÃO filtra
    # esses casos (testado, mesmo resultado com ou sem). Filtrar por
    # `.is_real` (nunca `None`/indeterminado — fail-closed, mesmo espírito
    # de `verify_antiderivative`) é o único jeito confirmado de manter só
    # soluções genuinamente reais — equivalente pedagógico de "filtrar
    # e^x>0"/"base>0" do lado de fora do `solve()` em vez de confiar que o
    # SymPy já devolve só o que é fisicamente válido.
    solutions = solve(parsed, symbol)
    real_solutions = [solucao for solucao in solutions if solucao.is_real]
    if not real_solutions:
        raise ExpressionError("Esta equação não possui solução real.")
    return ", ".join(f"{symbol} = {solucao}" for solucao in real_solutions)
