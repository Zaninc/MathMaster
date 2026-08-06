"""Sprint V2.12.2 — passo a passo da Regra de L'Hôpital, o ÚLTIMO recurso
da cascata de limites (substituição direta/fatoração-cancelamento/
comparação de graus da V2.12, depois limites trigonométricos fundamentais
da V2.12.1, só então L'Hôpital). Escopo: indeterminações 0/0 (ponto
finito) e ∞/∞ (`x→∞`), com UMA única aplicação — se o novo limite ainda
for indeterminado, o módulo rejeita com uma mensagem amigável dedicada em
vez de fingir resolver (aplicações sucessivas ficam para versões
futuras).

Camada puramente didática — NUNCA um resolvedor paralelo: reaproveita
`calculus/dispatcher.py:parse_limit_call` (o mesmo parser da V2.12),
`calculus/derivatives.py:compute_derivative` (o MESMO `sympy.diff` que a
V2.10/V2.11 já usam) para "derivando o numerador"/"derivando o
denominador", e `calculus/limits.py:compute_limit` (o MESMO `sympy.limit`
do `/solve`) para TODO valor final e para classificar a forma ∞/∞ (os
sublimites do numerador/denominador). Este módulo só decide COMO
apresentar a troca do quociente original pelo quociente das derivadas;
nunca calcula um limite por conta própria.

Detecção via ÁRVORE do SymPy, nunca regex: `expr.as_numer_denom()` +
`Expr.is_polynomial` decidem se a razão é INTEIRAMENTE polinomial (nesse
caso o caminho racional da V2.12 já cobre tudo — substituição, fatoração,
comparação de graus — e L'Hôpital nunca é reivindicado, respeitando a
prioridade "L'Hôpital é sempre o último recurso" estruturalmente, sem
precisar tentar-e-falhar o caminho antigo primeiro). `is_lhopital_shape`
também nunca reivindica uma forma já reconhecida por
`trigonometric_limits.is_trigonometric_fundamental_shape` (checagem
defensiva — `steps/dispatcher.py` já garante essa ordem, mas a função
fica correta mesmo se chamada isoladamente)."""
from __future__ import annotations

from sympy import oo
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..calculus.derivatives import compute_derivative
from ..calculus.dispatcher import parse_limit_call
from ..calculus.limits import compute_limit
from ..errors import ExpressionError
from .formatting import substitute_symbol_text
from .models import MathStep
from .trigonometric_limits import is_trigonometric_fundamental_shape
from .validation import UNSUPPORTED_LHOPITAL_MULTIPLE_APPLICATIONS_MESSAGE

_LHOPITAL_EXPLANATION = (
    "A Regra de L'Hôpital diz que, se lim f(x)/g(x) resulta em 0/0 ou ∞/∞ e f e g "
    "são deriváveis, então lim f(x)/g(x) = lim f'(x)/g'(x), desde que esse novo "
    "limite exista."
)


def is_lhopital_shape(expr: Expr, symbol: Symbol, point: Expr) -> bool:
    """Sprint V2.12.2 — usada por `steps/dispatcher.py` para decidir o
    roteamento DEPOIS de `is_trigonometric_fundamental_shape` e SEM
    sobreposição com o caminho racional da V2.12 (que exige numerador E
    denominador polinomiais — aqui exige-se o oposto)."""
    if is_trigonometric_fundamental_shape(expr, symbol, point):
        return False

    numer, denom = expr.as_numer_denom()
    if numer.is_polynomial(symbol) and denom.is_polynomial(symbol):
        return False

    if point == oo:
        numer_limit = compute_limit(numer, symbol, point)
        denom_limit = compute_limit(denom, symbol, point)
        return numer_limit in (oo, -oo) and denom_limit in (oo, -oo)

    try:
        numer_value = numer.subs(symbol, point)
        denom_value = denom.subs(symbol, point)
    except Exception:
        return False
    return numer_value == 0 and denom_value == 0


def generate_lhopital_steps(text: str) -> list[MathStep]:
    expr, symbol, point = parse_limit_call(text)
    steps = [MathStep(title="Expressão original", expression=f"limite({expr}, {symbol}, {point})")]

    numer, denom = expr.as_numer_denom()
    indeterminate_text = "oo/oo" if point == oo else "0/0"

    steps.append(MathStep(title="Substituindo o limite", expression=indeterminate_text))
    steps.append(
        MathStep(
            title="Reconhecemos uma forma indeterminada.",
            expression=indeterminate_text,
            explanation=_LHOPITAL_EXPLANATION,
        )
    )

    diff_numer = compute_derivative(numer, symbol)
    diff_denom = compute_derivative(denom, symbol)
    steps.append(MathStep(title="Derivando o numerador", expression=str(diff_numer)))
    steps.append(MathStep(title="Derivando o denominador", expression=str(diff_denom)))

    steps.append(
        MathStep(
            title="Aplicando a Regra de L'Hôpital (novo limite)",
            expression=f"limite({diff_numer}/{diff_denom}, {symbol}, {point})",
        )
    )

    new_ratio = diff_numer / diff_denom
    if is_lhopital_shape(new_ratio, symbol, point):
        raise ExpressionError(UNSUPPORTED_LHOPITAL_MULTIPLE_APPLICATIONS_MESSAGE)

    if point != oo:
        numer_text = substitute_symbol_text(diff_numer, symbol, point)
        if diff_denom == 1:
            substituted_text = numer_text
        else:
            denom_text = substitute_symbol_text(diff_denom, symbol, point)
            substituted_text = f"{numer_text}/({denom_text})"
        steps.append(MathStep(title="Substituindo", expression=substituted_text))

    result = compute_limit(expr, symbol, point)
    steps.append(MathStep(title="Calculando", expression=str(result)))
    return steps
