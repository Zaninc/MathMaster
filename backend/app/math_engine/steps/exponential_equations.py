"""Sprint "Exponenciais e Logaritmos" — passo a passo para equações
exponenciais de uma única incógnita, base constante (numérica ou o número
de Euler) e expoente LINEAR na incógnita: "e^x=5", "e^(2x)=7",
"e^(x+1)=10", "2e^x=8", "2^x=8", "3^(x+1)=27", "5^x=13", etc.

Reaproveita `linear_equations.reduce_to_value` para a etapa final de
isolar x a partir do expoente já resolvido — exatamente o mesmo padrão de
reuso de `quadratic_equations.py` (mirar `reduce_to_value` num alvo que
não é o símbolo puro, aqui o EXPOENTE em vez de x², mas a mesma técnica).

SELEÇÃO AUTOMÁTICA DO MÉTODO (nunca aplicar logaritmo indiscriminadamente):

1. Se o valor do outro lado já é uma potência EXATA da base (ex. 8=2³,
   27=3³, 16=4²) — bases iguais: os expoentes são igualados diretamente,
   sem nenhum logaritmo aparecer no passo a passo. `sympy.log(valor,
   base).simplify()` decide isso (nunca uma tabela de casos hardcoded).
2. Caso contrário — logaritmo natural (ln) dos dois lados, usando a
   propriedade ln(a**k)=k*ln(a); quando a base é "e", ln(e)=1 simplifica
   direto (o exemplo do próprio ticket: "e^(2x)=7" -> 2x=ln(7) -> x=ln(7)/2).

Uma potência de base real positiva nunca é negativa nem nula — se o valor
isolado do outro lado da equação for <= 0, a equação não tem solução real
(`NO_REAL_SOLUTION_MESSAGE`), sem precisar de nenhuma tentativa de
`solve()` que já sabemos que não vai devolver nada real."""
from __future__ import annotations

from sympy import E, Symbol, exp
from sympy import log as sympy_log
from sympy.core.expr import Expr

from ...canonical_constants import canonicalize_euler_constant
from ..errors import ExpressionError
from .formatting import (
    eq_text,
    isolate_title,
    pow_text,
    rename_natural_log,
    rename_natural_log_in_steps,
    wrap_if_sum,
)
from .linear_equations import parse_equation_sides, reduce_to_value
from .models import MathStep
from .validation import (
    NO_REAL_SOLUTION_MESSAGE,
    UNSUPPORTED_EQUATION_MESSAGE,
    require_single_symbol,
)


def match_exponential_term(expr: Expr, symbol: Symbol) -> tuple[Expr, Expr, Expr] | None:
    """(coeficiente, base, expoente) se `expr` for `coeficiente *
    base**expoente`, com `base` uma constante real positiva != 1 (nunca
    dependendo de `symbol`) e `expoente` linear em `symbol`. `None` (nunca
    "chuta") para qualquer outra forma — inclui bases simbólicas (fora do
    escopo desta sprint) e expoentes não-lineares (ex. x², também fora de
    escopo). `E**expoente` é reconhecido via `rest.func is exp`, já que o
    SymPy sempre reescreve potências de `E` como `exp(...)` automaticamente
    (confirmado empiricamente — nunca fica como `Pow(E, expoente)`)."""
    if symbol not in expr.free_symbols:
        return None
    coeff, rest = expr.as_independent(symbol, as_Add=False)
    if rest.func is exp:
        base, exponent = E, rest.args[0]
    elif rest.is_Pow:
        base, exponent = rest.args
    else:
        return None
    if symbol in base.free_symbols:
        return None
    if not (base.is_number and base > 0 and base != 1):
        return None
    if symbol not in exponent.free_symbols:
        return None
    if not exponent.is_polynomial(symbol) or exponent.as_poly(symbol).degree() != 1:
        return None
    return coeff, base, exponent


def is_exponential_equation_shape(lhs: Expr, rhs: Expr, symbol: Symbol) -> bool:
    if symbol not in rhs.free_symbols and match_exponential_term(lhs, symbol) is not None:
        return True
    if symbol not in lhs.free_symbols and match_exponential_term(rhs, symbol) is not None:
        return True
    return False


def _same_base_exponent(value: Expr, base: Expr) -> Expr | None:
    """`k` racional exato tal que `base**k == value` (ex. 8, 2 -> 3), ou
    `None` se `value` não for uma potência exata da base — nesse caso o
    caminho de logaritmo é quem resolve, nunca uma aproximação aqui."""
    if not value.is_number or value <= 0:
        return None
    k = sympy_log(value, base).simplify()
    if k.is_rational:
        return k
    return None


def _base_display(base: Expr) -> str:
    """"e" (minúsculo, como o usuário digitou) em vez de "E" (o símbolo
    interno do SymPy) — só para texto lido por humanos (`title`/
    concatenações manuais de `expression`); nunca afeta o valor
    matemático real, só a representação em string."""
    return "e" if base == E else str(base)


def resolve_exponential_target(base: Expr, exponent: Expr, target_value: Expr, symbol: Symbol) -> list[MathStep]:
    """Núcleo compartilhado: dada uma equação já reduzida à forma
    `base**expoente = target_value` (`target_value` sem `symbol`), devolve
    os passos até isolar `symbol` — reaproveitado tanto por
    `generate_exponential_equation_steps` quanto por
    `exponential_substitution_equations.py` (cada raiz válida de u volta
    para cá)."""
    if not target_value.is_number or target_value <= 0:
        raise ExpressionError(NO_REAL_SOLUTION_MESSAGE)

    steps: list[MathStep] = []
    same_base_exponent = _same_base_exponent(target_value, base)
    if same_base_exponent is not None:
        steps.append(
            MathStep(
                title=f"Reescrevendo {target_value} como potência de base {_base_display(base)}",
                expression=f"{pow_text(base, exponent)}={pow_text(base, same_base_exponent)}",
            )
        )
        steps.append(
            MathStep(
                title="Como as bases são iguais, os expoentes devem ser iguais",
                expression=eq_text(exponent, same_base_exponent),
            )
        )
        value = same_base_exponent
    else:
        steps.append(
            MathStep(
                title="Aplicando o logaritmo natural (ln) aos dois lados",
                expression=rename_natural_log(f"ln({pow_text(base, exponent)})=ln({target_value})"),
            )
        )
        steps.append(
            MathStep(
                title="Usando a propriedade ln(a**k) = k*ln(a)",
                expression=rename_natural_log(
                    f"{wrap_if_sum(exponent)}*ln({_base_display(base)})={sympy_log(target_value)}"
                ),
            )
        )
        if base == E:
            value = sympy_log(target_value)
            steps.append(
                MathStep(
                    title="Como ln(e) = 1",
                    expression=rename_natural_log(eq_text(exponent, value)),
                )
            )
        else:
            value = sympy_log(target_value) / sympy_log(base)
            steps.append(
                MathStep(
                    title=f"Isolando o expoente, dividindo os dois lados por ln({base})",
                    expression=rename_natural_log(eq_text(exponent, value)),
                )
            )

    _, rest = reduce_to_value(exponent, value, symbol)
    steps.extend(rename_natural_log_in_steps(rest))
    return steps


def generate_exponential_equation_steps(text: str) -> list[MathStep]:
    lhs, rhs = parse_equation_sides(text)
    lhs = canonicalize_euler_constant(lhs)
    rhs = canonicalize_euler_constant(rhs)

    symbols = lhs.free_symbols | rhs.free_symbols
    require_single_symbol(symbols)
    symbol = next(iter(symbols))

    steps = [MathStep(title="Equação inicial", expression=rename_natural_log(eq_text(lhs, rhs)))]

    match = match_exponential_term(lhs, symbol)
    if match is not None:
        exp_side, const_side = lhs, rhs
    else:
        match = match_exponential_term(rhs, symbol)
        if match is None:
            raise ExpressionError(UNSUPPORTED_EQUATION_MESSAGE)
        exp_side, const_side = rhs, lhs
        steps.append(
            MathStep(
                title="Reescrevendo a equação",
                expression=rename_natural_log(eq_text(exp_side, const_side)),
            )
        )

    coeff, base, exponent = match
    if coeff != 1:
        const_side = const_side / coeff
        steps.append(
            MathStep(
                title=isolate_title(coeff),
                expression=rename_natural_log(f"{pow_text(base, exponent)}={const_side}"),
            )
        )

    steps.extend(resolve_exponential_target(base, exponent, const_side, symbol))
    return steps
