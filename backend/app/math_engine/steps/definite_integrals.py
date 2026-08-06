"""Sprint V2.10.2 — passo a passo de integrais definidas: o Teorema
Fundamental do Cálculo aplicado sobre a mesma regra da potência das
integrais indefinidas (V2.10.1). Camada puramente didática — NUNCA um
resolvedor paralelo: a primitiva vem de `integrals.find_primitive_steps`
(reaproveitado sem alteração — mesma classificação de termo, mesmos
passos de "regra da potência"/"linearidade"), e o valor numérico final
vem de `calculus/integrals.py:compute_definite_integral` (o MESMO
`sympy.integrate` com limites que o `/solve` já chama). Este módulo só
decide como apresentar o Teorema Fundamental (F(b) - F(a)) em cima de uma
primitiva já encontrada por infraestrutura existente.

Diferente da integral indefinida, o resultado NUNCA leva "+ C" — a
constante de integração se cancela em `F(b) - F(a)` (`(F(b)+C) - (F(a)+C)
= F(b) - F(a)`), então nem é mostrada aqui: `find_primitive_steps` já
devolve a primitiva SEM "+ C" por design (é o mesmo valor que a integral
indefinida usa internamente antes de decidir acrescentar a constante —
aqui simplesmente nunca chegamos a acrescentá-la).

Limites iguais (`∫ₐᵃ`) são tratados à parte, sem sequer calcular uma
primitiva: o comprimento nulo do intervalo já garante resultado zero,
independente de qual seria a primitiva. Limites invertidos (`∫ᵦᵃ`, b > a)
NÃO são normalizados/reordenados — a integral definida representa área
ORIENTADA, e `compute_definite_integral`/a substituição de limites deste
módulo usam os limites exatamente como o usuário digitou, produzindo o
sinal correto automaticamente."""
from __future__ import annotations

import re

from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..calculus.dispatcher import parse_definite_integral_call
from ..calculus.integrals import compute_definite_integral
from .integrals import find_primitive_steps
from .models import MathStep

_FTC_EXPLANATION = (
    "Encontramos uma primitiva F(x) e calculamos F(b) - F(a), o Teorema "
    "Fundamental do Cálculo."
)


def _substitute_bound_text(primitive: Expr, symbol: Symbol, value: Expr) -> str:
    """"x**3/3" com x substituído pelo LIMITE (entre parênteses, nunca
    simplificado) -> "(2)**3/3". Substituição por texto (não `.subs()`,
    que avaliaria a aritmética na hora — o mesmo problema já documentado
    em `quadratic_equations._bhaskara_steps`/`derivatives._power_rule_
    unevaluated_text`): `symbol` é sempre um identificador de uma letra
    (garantia de `safe_parsing.py`), então a fronteira de palavra `\\b`
    troca exatamente as ocorrências da variável, nunca um dígito ou outro
    identificador."""
    return re.sub(rf"\b{re.escape(str(symbol))}\b", f"({value})", str(primitive))


def generate_definite_integral_steps(text: str) -> list[MathStep]:
    expr, symbol, lower, upper = parse_definite_integral_call(text)

    steps = [
        MathStep(title="Integral original", expression=f"integral({expr}, {symbol}, {lower}, {upper})")
    ]

    if lower == upper:
        steps.append(
            MathStep(
                title="O intervalo de integração tem comprimento nulo (os limites são iguais)",
                explanation=(
                    "Quando o limite inferior é igual ao superior, o intervalo não tem "
                    "largura nenhuma — a integral definida vale sempre zero."
                ),
                expression="0",
            )
        )
        return steps

    primitive, primitive_steps = find_primitive_steps(expr, symbol)
    steps.extend(primitive_steps)

    steps.append(
        MathStep(
            title="Aplicando o Teorema Fundamental do Cálculo",
            explanation=_FTC_EXPLANATION,
            expression=f"F({upper})-F({lower})",
        )
    )

    upper_text = _substitute_bound_text(primitive, symbol, upper)
    lower_text = _substitute_bound_text(primitive, symbol, lower)
    # Parênteses em volta de `lower_text` sempre — nunca só quando a
    # primitiva tem mais de um termo: sem eles, "A+B-C+D" (concatenação
    # ingênua de "A+B" menos "C+D") distribui o sinal de menos só no
    # PRIMEIRO termo do limite inferior, um erro matemático real (pego
    # empiricamente com limite inferior != 0 e primitiva de 2+ termos).
    steps.append(
        MathStep(title="Substituindo os limites", expression=f"{upper_text}-({lower_text})")
    )

    result = compute_definite_integral(expr, symbol, lower, upper)
    steps.append(MathStep(title="Calculando", expression=str(result)))
    return steps
