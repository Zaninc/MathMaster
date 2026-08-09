"""Sprint V2.19 — passo a passo de integrais que exigem substituição
TRIGONOMÉTRICA por causa de um radical quadrático: `√(a²-x²)` (`x=a·
sen(θ)`), `√(x²+a²)` (`x=a·tan(θ)`), `√(x²-a²)` (`x=a·sec(θ)`). Camada
puramente didática — NUNCA um segundo resolvedor de integrais: reaproveita
`calculus/dispatcher.py:parse_integral_call` e, principalmente,
`calculus/integrals.py:compute_indefinite_integral` (o MESMO
`sympy.integrate` que o `/solve` já usa) para TODO valor final mostrado —
inclusive a antiderivada intermediária em termos de `θ` e o resultado
final "+ C" (chamado sobre a expressão ORIGINAL, garantindo zero
divergência do `/solve`). Este módulo só decide COMO fatiar a troca de
variável trigonométrica em passos; nunca integra por conta própria.

Detecção via ÁRVORE do SymPy, nunca regex: o integrando precisa ser
EXATAMENTE `Pow(base, Rational(1,2))` ou `Pow(base, Rational(-1,2))` no
TOPO da árvore (`expr.is_Pow`, `expr.exp`) — qualquer coisa multiplicando
o radical (`x/√(x²+4)`, `x·√(x²+4)`) já é `Mul` no topo, nunca `Pow`, e
portanto nunca chega aqui: continua pertencendo à V2.14 (substituição u),
que já resolve esses dois casos via `u=x²+4` — confirmado estruturalmente
(expoente fracionário nunca casa com `u_substitution._outer_shape`, que só
aceita expoente INTEIRO) e empiricamente (testes de prioridade). `base` é
classificado por `sympy.Poly` (nunca comparação de string/ordem de
termos): grau exatamente 2, coeficiente de x¹ igual a zero, e o par
(coeficiente de x², termo constante) decide entre os três padrões —
`a²` é extraído do termo constante via `sqrt()` e só é aceito quando
resulta num `Rational` exato (sem raiz sobrando) — `√(10-x²)`, por
exemplo, fica fora de escopo, com rejeição amigável, documentado como
limitação conhecida.

Reuso da V2.17 (identidade de redução de potência): depois de `x=a·
sen(θ)`, `√(a²-x²)=a·cos(θ)`, e a forma DIRETA `√(a²-x²)` vira `a²·
∫cos²(θ)dθ` — a MESMA identidade `cos²(θ)=(1+cos(2θ))/2` que
`trig_integrals.py` já ensina, promovida a `power_reduction_identity`
(função pública, parametrizada por `symbol` — nunca hardcoda "x", já
funcionava para qualquer símbolo antes mesmo desta sprint) especificamente
para este reuso, evitando reescrever a identidade uma segunda vez. A forma
INVERSA `1/√(a²-x²)` não precisa dessa identidade (o `a·cos(θ)` do
numerador cancela com o `a·cos(θ)` do denominador, sobrando `∫dθ=θ`,
trivial). Os padrões `x²+a²`/`x²-a²` (sempre na forma inversa, ver
próximo parágrafo) levam a `∫sec(θ)dθ`, que NENHUMA infraestrutura
existente sabe explicar passo a passo (nem V2.17, que só reconhece
sen/cos/tan, nunca sec, como base de uma potência) — reaproveitado
diretamente via `compute_indefinite_integral(sec(θ), θ)` (o motor real,
nunca uma primitiva manual como `ln|sec θ+tan θ|`), sem tentar ensinar essa
etapa passo a passo.

Escopo deliberadamente restrito (documentado, nunca expandido em
silêncio): a forma DIRETA `√(x²+a²)` e `√(x²-a²)` (sem o "1/") leva a
`∫sec³(θ)dθ`, que exigiria uma técnica nova e substancial (integração por
partes recursiva) — NENHUMA das infraestruturas existentes (V2.15
integração por partes, V2.17 trigonométricas) sabe explicar essa etapa, e
implementá-la sairia do escopo desta sprint. `find_trig_substitution`
nunca reivindica essas duas formas — caem no fallback amigável genérico
de `integrals.py`, e `/solve` continua resolvendo normalmente via
`sympy.integrate` (que NÃO passa por `∫sec³θdθ` internamente, usa uma
técnica diferente — confirmado empiricamente).

Domínio/sinais de `√(cos²θ)`, `√(sec²θ)`, `√(tan²θ)`: verificados
simbolicamente via `sympy.refine` com a suposição `Q.positive(...)` (nunca
apresentados como uma igualdade global, que seria matematicamente falsa
sem essa restrição — `√(cos²θ)=|cos θ|` em geral) — o intervalo escolhido
para `θ` em cada caso (`[-π/2,π/2]` pra seno, `(-π/2,π/2)` pra tangente,
`[0,π/2)` pra secante) é explicado em português no passo correspondente,
nunca uma prova formal de domínio completa.

Volta para x construída via relações de triângulo retângulo REAIS (nunca
substituição textual): a antiderivada em θ é sempre expressa só em termos
de `sen(θ)`/`cos(θ)`/`θ` (confirmado empiricamente para os 3 padrões — o
resultado de `compute_indefinite_integral` nunca deixa `sec`/`tan` soltos
na resposta), então a substituição de volta troca PRIMEIRO `sen(θ)`/
`cos(θ)` pelas razões do triângulo (`.subs()` com um dicionário, uma
operação SymPy real) e SÓ DEPOIS `θ` pela função inversa correspondente —
nessa ordem, o resultado combina automaticamente pra forma mais limpa
(confirmado empiricamente: a ordem inversa produz uma expressão
equivalente mas mais confusa). A função inversa de secante (`asec`) NUNCA
é usada — não está na whitelist de entrada nem tem tratamento visual
comprovado no pipeline; o padrão `x²-a²` usa `acos(a/x)` (relação
equivalente já suportada, `θ=acos(a/x)` quando `x=a·sec(θ)`)."""
from __future__ import annotations

import re
from typing import NamedTuple

from sympy import (
    Poly,
    Q,
    Rational,
    Symbol,
    acos,
    asin,
    atan,
    cos,
    diff,
    refine,
    sec,
    simplify,
    sin,
    sqrt,
    tan,
)
from sympy.core.expr import Expr

from ..calculus.dispatcher import parse_integral_call
from ..calculus.integrals import compute_indefinite_integral
from ..errors import ExpressionError
from .formatting import INTEGRATION_CONSTANT_EXPLANATION
from .models import MathStep
from .trig_integrals import power_reduction_identity
from .validation import UNSUPPORTED_INTEGRAL_MESSAGE

_NATURAL_LOG_PATTERN = re.compile(r"\blog(?=\()")


def _rename_natural_log(text: str) -> str:
    return _NATURAL_LOG_PATTERN.sub("ln", text)


class _RadicalPlan(NamedTuple):
    kind: str  # "A" (a²-x²) | "B" (x²+a²) | "C" (x²-a²)
    a: Expr  # Rational positivo, extraído estruturalmente de a² (nunca hardcoded)
    a_squared: Expr
    radicand: Expr
    is_direct: bool  # True só para √(a²-x²) (kind "A") sem o "1/"


def find_trig_substitution(expr: Expr, symbol: Symbol) -> _RadicalPlan | None:
    """Plano de substituição trigonométrica se `expr` for EXATAMENTE um
    radical (`Pow` de expoente `1/2` ou `-1/2`) no TOPO da árvore, cuja
    base é um polinômio quadrático em `symbol` sem termo linear, com `a²`
    extraído como um `Rational` exato. `None` (nunca "chuta") para
    qualquer outra forma — inclusive as combinações estruturalmente fora
    de escopo desta versão (ver docstring do módulo: `√(x²+a²)`/
    `√(x²-a²)` sem o "1/", `a²` sem raiz exata, termo linear presente,
    grau != 2, ou o radical multiplicado por qualquer outro fator — nesse
    último caso `expr` já não é `Pow` no topo, é `Mul`)."""
    if not expr.is_Pow:
        return None
    base, exponent = expr.base, expr.exp
    if exponent == Rational(1, 2):
        is_direct = True
    elif exponent == Rational(-1, 2):
        is_direct = False
    else:
        return None
    if not base.is_polynomial(symbol):
        return None
    poly = Poly(base, symbol)
    if poly.degree() != 2:
        return None
    coeffs = poly.all_coeffs()
    if len(coeffs) != 3:
        return None
    c2, c1, c0 = coeffs
    if c1 != 0:
        return None

    if c2 == -1 and c0 > 0:
        kind, a_squared = "A", c0
    elif c2 == 1 and c0 > 0:
        if is_direct:
            return None  # levaria a ∫sec³(θ)dθ — fora de escopo, ver docstring
        kind, a_squared = "B", c0
    elif c2 == 1 and c0 < 0:
        if is_direct:
            return None  # levaria a ∫sec³(θ)dθ — fora de escopo, ver docstring
        kind, a_squared = "C", -c0
    else:
        return None

    a = sqrt(a_squared)
    if not a.is_Rational:
        return None  # a² sem raiz exata — fora de escopo desta versão
    return _RadicalPlan(kind, a, a_squared, base, is_direct)


def is_trig_substitution_shape(expr: Expr, symbol: Symbol) -> bool:
    return find_trig_substitution(expr, symbol) is not None


def _verify(condition_expr: Expr) -> None:
    if simplify(condition_expr) != 0:
        # Nunca deveria disparar no escopo comprovado desta versão —
        # defesa contra uso indevido/edge case não antecipado: rejeita em
        # vez de apresentar uma transformação não verificada.
        raise ExpressionError(UNSUPPORTED_INTEGRAL_MESSAGE)


_PATTERN_DESCRIPTIONS = {
    "A": "a²-x²",
    "B": "x²+a²",
    "C": "x²-a²",
}


def _identification_steps(plan: _RadicalPlan, symbol: Symbol) -> list[MathStep]:
    pattern = _PATTERN_DESCRIPTIONS[plan.kind]
    return [
        MathStep(
            title="Identificando o padrão",
            explanation=f"O radical tem a forma √({pattern}).",
            expression=_rename_natural_log(str(plan.radicand)),
        ),
        MathStep(
            title="Encontrando a",
            expression=_rename_natural_log(f"a**2={plan.a_squared}, a={plan.a}"),
        ),
    ]


def _case_a_steps(plan: _RadicalPlan, symbol: Symbol, theta: Symbol) -> tuple[list[MathStep], Expr, Expr]:
    """Casos A: `√(a²-x²)` (direto) e `1/√(a²-x²)` (inverso). Devolve os
    passos até "Integrando em θ" (inclusive) e `(x_expr, theta_antideriv)`
    — `x_expr` (`a·sen(θ)`) e a antiderivada REAL em θ, usados por
    `_back_to_x_steps` pra montar "Voltando para x"."""
    a = plan.a
    x_expr = a * sin(theta)
    dx_coeff = a * cos(theta)
    radicand_subbed = plan.radicand.subs(symbol, x_expr)

    steps = [
        MathStep(title="Escolhendo a substituição", expression=_rename_natural_log(f"{symbol}={x_expr}")),
        MathStep(title="Calculando dx", expression=_rename_natural_log(f"d{symbol}={dx_coeff}*d{theta}")),
        MathStep(
            title="Substituindo no radical",
            expression=_rename_natural_log(f"sqrt({plan.radicand})=sqrt({radicand_subbed})"),
        ),
    ]

    factored = a * sqrt(1 - sin(theta) ** 2)
    _verify(sqrt(radicand_subbed) - factored)
    steps.append(
        MathStep(
            title="Fatorando",
            expression=_rename_natural_log(f"sqrt({radicand_subbed})={factored}"),
        )
    )

    pythagorean_rhs = cos(theta) ** 2
    _verify((1 - sin(theta) ** 2) - pythagorean_rhs)
    steps.append(
        MathStep(
            title="Usando a identidade pitagórica",
            expression=_rename_natural_log(f"1-sin({theta})**2=cos({theta})**2"),
        )
    )

    _verify(refine(sqrt(cos(theta) ** 2), Q.positive(cos(theta))) - cos(theta))
    steps.append(
        MathStep(
            title="Considerando o intervalo escolhido",
            explanation=f"Escolhemos {theta} em [-π/2, π/2], onde cos({theta}) ≥ 0.",
            expression=_rename_natural_log(f"sqrt(cos({theta})**2)=cos({theta})"),
        )
    )

    radical_value = a * cos(theta)
    steps.append(
        MathStep(
            title="Concluindo a substituição do radical",
            expression=_rename_natural_log(f"sqrt({plan.radicand})={radical_value}"),
        )
    )

    if plan.is_direct:
        theta_integrand = (a**2) * cos(theta) ** 2
        steps.append(
            MathStep(
                title="Substituindo na integral",
                expression=_rename_natural_log(
                    f"integral(sqrt({plan.radicand}), {symbol})={a**2}*integral(cos({theta})**2, {theta})"
                ),
            )
        )
        identity_rhs, identity_rhs_text = power_reduction_identity(theta, "cos")
        steps.append(
            MathStep(
                title="Aplicando a identidade de redução de potência",
                expression=_rename_natural_log(f"cos({theta})**2={identity_rhs_text}"),
            )
        )
    else:
        theta_integrand = Rational(1)
        steps.append(
            MathStep(
                title="Substituindo na integral",
                expression=_rename_natural_log(
                    f"integral(1/sqrt({plan.radicand}), {symbol})=integral(1, {theta})"
                ),
            )
        )

    theta_antiderivative = compute_indefinite_integral(theta_integrand, theta)
    steps.append(
        MathStep(title="Integrando em θ", expression=_rename_natural_log(str(theta_antiderivative)))
    )
    return steps, x_expr, theta_antiderivative


def _case_b_steps(plan: _RadicalPlan, symbol: Symbol, theta: Symbol) -> tuple[list[MathStep], Expr, Expr]:
    """Caso B: `1/√(x²+a²)`. Sempre inverso (forma direta é fora de
    escopo, ver `find_trig_substitution`)."""
    a = plan.a
    x_expr = a * tan(theta)
    dx_coeff = a * sec(theta) ** 2
    radicand_subbed = plan.radicand.subs(symbol, x_expr)

    steps = [
        MathStep(title="Escolhendo a substituição", expression=_rename_natural_log(f"{symbol}={x_expr}")),
        MathStep(title="Calculando dx", expression=_rename_natural_log(f"d{symbol}={dx_coeff}*d{theta}")),
        MathStep(
            title="Substituindo no radical",
            expression=_rename_natural_log(f"sqrt({plan.radicand})=sqrt({radicand_subbed})"),
        ),
    ]

    factored = a * sqrt(1 + tan(theta) ** 2)
    _verify(sqrt(radicand_subbed) - factored)
    steps.append(
        MathStep(
            title="Fatorando",
            expression=_rename_natural_log(f"sqrt({radicand_subbed})={factored}"),
        )
    )

    _verify((1 + tan(theta) ** 2) - sec(theta) ** 2)
    steps.append(
        MathStep(
            title="Usando a identidade pitagórica",
            expression=_rename_natural_log(f"1+tan({theta})**2=sec({theta})**2"),
        )
    )

    _verify(refine(sqrt(sec(theta) ** 2), Q.positive(sec(theta))) - sec(theta))
    steps.append(
        MathStep(
            title="Considerando o intervalo escolhido",
            explanation=f"Escolhemos {theta} em (-π/2, π/2), onde sec({theta}) ≥ 0.",
            expression=_rename_natural_log(f"sqrt(sec({theta})**2)=sec({theta})"),
        )
    )

    radical_value = a * sec(theta)
    steps.append(
        MathStep(
            title="Concluindo a substituição do radical",
            expression=_rename_natural_log(f"sqrt({plan.radicand})={radical_value}"),
        )
    )

    steps.append(
        MathStep(
            title="Substituindo na integral",
            expression=_rename_natural_log(
                f"integral(1/sqrt({plan.radicand}), {symbol})=integral(sec({theta}), {theta})"
            ),
        )
    )

    theta_antiderivative = compute_indefinite_integral(sec(theta), theta)
    steps.append(
        MathStep(title="Integrando em θ", expression=_rename_natural_log(str(theta_antiderivative)))
    )
    return steps, x_expr, theta_antiderivative


def _case_c_steps(plan: _RadicalPlan, symbol: Symbol, theta: Symbol) -> tuple[list[MathStep], Expr, Expr]:
    """Caso C: `1/√(x²-a²)`. Sempre inverso (forma direta é fora de
    escopo, ver `find_trig_substitution`)."""
    a = plan.a
    x_expr = a * sec(theta)
    dx_coeff = a * sec(theta) * tan(theta)
    radicand_subbed = plan.radicand.subs(symbol, x_expr)

    steps = [
        MathStep(title="Escolhendo a substituição", expression=_rename_natural_log(f"{symbol}={x_expr}")),
        MathStep(title="Calculando dx", expression=_rename_natural_log(f"d{symbol}={dx_coeff}*d{theta}")),
        MathStep(
            title="Substituindo no radical",
            expression=_rename_natural_log(f"sqrt({plan.radicand})=sqrt({radicand_subbed})"),
        ),
    ]

    factored = a * sqrt(sec(theta) ** 2 - 1)
    _verify(sqrt(radicand_subbed) - factored)
    steps.append(
        MathStep(
            title="Fatorando",
            expression=_rename_natural_log(f"sqrt({radicand_subbed})={factored}"),
        )
    )

    _verify((sec(theta) ** 2 - 1) - tan(theta) ** 2)
    steps.append(
        MathStep(
            title="Usando a identidade pitagórica",
            expression=_rename_natural_log(f"sec({theta})**2-1=tan({theta})**2"),
        )
    )

    _verify(refine(sqrt(tan(theta) ** 2), Q.positive(tan(theta))) - tan(theta))
    steps.append(
        MathStep(
            title="Considerando o intervalo escolhido",
            explanation=f"Escolhemos {theta} em [0, π/2), onde tan({theta}) ≥ 0.",
            expression=_rename_natural_log(f"sqrt(tan({theta})**2)=tan({theta})"),
        )
    )

    radical_value = a * tan(theta)
    steps.append(
        MathStep(
            title="Concluindo a substituição do radical",
            expression=_rename_natural_log(f"sqrt({plan.radicand})={radical_value}"),
        )
    )

    steps.append(
        MathStep(
            title="Substituindo na integral",
            expression=_rename_natural_log(
                f"integral(1/sqrt({plan.radicand}), {symbol})=integral(sec({theta}), {theta})"
            ),
        )
    )

    theta_antiderivative = compute_indefinite_integral(sec(theta), theta)
    steps.append(
        MathStep(title="Integrando em θ", expression=_rename_natural_log(str(theta_antiderivative)))
    )
    return steps, x_expr, theta_antiderivative


def _back_to_x_step(
    plan: _RadicalPlan, symbol: Symbol, theta: Symbol, theta_antiderivative: Expr, original_expr: Expr
) -> MathStep:
    """"Voltando para x" — SEMPRE construído via `.subs()` real (nunca
    substituição textual): primeiro troca `sen(θ)`/`cos(θ)` pelas razões
    do triângulo retângulo correspondente (a antiderivada em θ nunca deixa
    `sec`/`tan` soltos, confirmado empiricamente para os 3 padrões), SÓ
    DEPOIS troca `θ` pela função inversa — nessa ordem produz a forma mais
    limpa (confirmado empiricamente). Verificado derivando o resultado e
    comparando com o integrando original (`simplify(diff(...) -
    original)==0`) — a prova mais forte de que a substituição de volta
    está correta, independente de quão "bonita" a forma final é."""
    a = plan.a
    if plan.kind == "A":
        triangle = {sin(theta): symbol / a, cos(theta): sqrt(plan.radicand) / a}
        theta_inverse = asin(symbol / a)
    elif plan.kind == "B":
        hyp = sqrt(symbol**2 + a**2)
        triangle = {sin(theta): symbol / hyp}
        theta_inverse = atan(symbol / a)
    else:
        triangle = {sin(theta): sqrt(plan.radicand) / symbol}
        theta_inverse = acos(a / symbol)

    back = theta_antiderivative.subs(triangle).subs(theta, theta_inverse)
    _verify(diff(back, symbol) - original_expr)
    return MathStep(title="Voltando para x", expression=_rename_natural_log(str(back)))


def generate_trig_substitution_steps(text: str) -> list[MathStep]:
    expr, symbol = parse_integral_call(text)
    steps = [
        MathStep(
            title="Integral original",
            expression=_rename_natural_log(f"integral({expr}, {symbol})"),
        )
    ]

    plan = find_trig_substitution(expr, symbol)
    if plan is None:
        # Nunca deveria acontecer no fluxo normal — `steps/dispatcher.py`
        # só chama esta função quando `find_trig_substitution` já
        # confirmou a forma. Defesa contra uso indevido direto do módulo.
        raise ExpressionError(UNSUPPORTED_INTEGRAL_MESSAGE)

    theta = Symbol("theta")
    steps.extend(_identification_steps(plan, symbol))

    if plan.kind == "A":
        case_steps, x_expr, theta_antiderivative = _case_a_steps(plan, symbol, theta)
    elif plan.kind == "B":
        case_steps, x_expr, theta_antiderivative = _case_b_steps(plan, symbol, theta)
    else:
        case_steps, x_expr, theta_antiderivative = _case_c_steps(plan, symbol, theta)
    steps.extend(case_steps)

    steps.append(_back_to_x_step(plan, symbol, theta, theta_antiderivative, expr))

    primitive = compute_indefinite_integral(expr, symbol)
    steps.append(
        MathStep(
            title="Adicionando a constante de integração",
            explanation=INTEGRATION_CONSTANT_EXPLANATION,
            expression=_rename_natural_log(f"{primitive} + C"),
        )
    )
    return steps
