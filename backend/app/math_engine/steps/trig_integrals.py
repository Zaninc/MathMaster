"""Sprint V2.17 — passo a passo de integrais trigonométricas que exigem
uma IDENTIDADE antes de virarem resolvíveis pelas técnicas já existentes:
`sen²(x)`/`cos²(x)` (redução de potência), `sen³(x)`/`cos³(x)` e produtos
mistos `sen^m(x)cos^n(x)` com exatamente um expoente ímpar (separar um
fator + identidade pitagórica + substituição), `sen²(x)cos²(x)` (ângulo
duplo) e `tan²(x)` (`tan²=sec²-1`). Camada puramente didática — NUNCA um
segundo resolvedor de integrais: reaproveita `calculus/dispatcher.py:
parse_integral_call` (já com a paridade de Euler do Hotfix V2.15.1) e,
principalmente, `calculus/integrals.py:compute_indefinite_integral` (o
MESMO `sympy.integrate` que o `/solve` já usa) para TODO valor mostrado —
inclusive a antiderivada intermediária em termos de `u` e o resultado
final "+ C" (chamado sobre a expressão ORIGINAL, garantindo zero
divergência do `/solve`). Este módulo só decide COMO fatiar a
transformação trigonométrica em passos; nunca integra por conta própria.

Detecção via ÁRVORE do SymPy, nunca regex: `_trig_powers` classifica cada
fator do produto (`expr.is_Mul`/`.args`, ou o próprio `expr` se for um
único `Pow`) — só reconhece `sen(x)^n`/`cos(x)^n`/`tan(x)^n` com
argumento EXATAMENTE igual à variável (argumento composto, ex.
`sen(2x)²`, já pertence à V2.14/substituição e nunca casa aqui) e
expoente inteiro positivo. O conjunto de expoentes resultante
(`{sen: 2}`, `{sen: 3, cos: 2}`, ...) é comparado contra uma tabela FIXA
de formas suportadas — nenhuma tentativa de generalizar pra qualquer
potência ou produto (ex. `sen⁸cos⁶`, `tan³` ficam de fora, mesmo que o
SymPy consiga resolver via `sympy.integrate` diretamente).

Toda transformação pedagógica (identidade aplicada, reescrita da
integral) é verificada simbolicamente (`simplify(trigsimp(original -
transformado)) == 0`) ANTES de qualquer passo ser apresentado — se a
verificação falhar (nunca deveria, dado o escopo comprovado), o módulo
rejeita com a mensagem amigável genérica em vez de arriscar mostrar
matemática errada.

Reuso da V2.14 (substituição): avaliado e decidido NÃO chamar
`u_substitution.generate_u_substitution_steps` diretamente — ela sempre
começa com seu PRÓPRIO passo "Integral original" (redundante/confuso no
meio do fluxo desta sprint) e sempre re-executa a busca completa de
`find_substitution` a partir do texto (desperdício, já que `u` é
determinístico aqui: é sempre `cos(x)` ou `sen(x)`, uma CONSEQUÊNCIA
direta da identidade pitagórica aplicada, nunca uma busca genérica).
Em vez disso, a técnica computacional da V2.14 é reaproveitada
diretamente — `compute_indefinite_integral` sobre o integrando
transformado em `u`, e `formatting.substitute_symbol_text` (helper já
promovido desde a V2.12) para "Voltando para x" — sem reimplementar
NENHUMA lógica de detecção ou busca de substituição."""
from __future__ import annotations

import re

from sympy import Symbol, cos, diff, sec, simplify, sin, sympify, tan, trigsimp
from sympy.core.expr import Expr

from ..calculus.dispatcher import parse_integral_call
from ..calculus.integrals import compute_indefinite_integral
from ..errors import ExpressionError
from .formatting import INTEGRATION_CONSTANT_EXPLANATION, substitute_symbol_text
from .models import MathStep
from .validation import UNSUPPORTED_INTEGRAL_MESSAGE

_NATURAL_LOG_PATTERN = re.compile(r"\blog(?=\()")


def _rename_natural_log(text: str) -> str:
    return _NATURAL_LOG_PATTERN.sub("ln", text)


def _trig_powers(expr: Expr, symbol: Symbol) -> dict[object, int] | None:
    """`{sin: n, cos: m, ...}` — expoente de cada fator `sen(x)^n`/
    `cos(x)^n`/`tan(x)^n` num produto (ou de um único fator, se `expr` não
    for `Mul`). `None` (nunca "chuta") para qualquer fator que não seja
    exatamente uma dessas três funções com argumento igual à própria
    variável, ou expoente não inteiro positivo — inclusive argumento
    composto (`sen(2x)`, já pertence à V2.14) e potências negativas/
    fracionárias."""
    factors = list(expr.args) if expr.is_Mul else [expr]
    powers: dict[object, int] = {}
    for factor in factors:
        if factor.is_Pow:
            base, exponent = factor.base, factor.exp
            if not exponent.is_Integer or exponent <= 0:
                return None
        else:
            base, exponent = factor, sympify(1)
        if base.func not in (sin, cos, tan):
            return None
        if not base.args or base.args[0] != symbol:
            return None
        key = base.func
        if key in powers:
            return None
        powers[key] = int(exponent)
    return powers


_SUPPORTED_SHAPES = frozenset(
    {
        frozenset({(sin, 2)}),
        frozenset({(cos, 2)}),
        frozenset({(sin, 3)}),
        frozenset({(cos, 3)}),
        frozenset({(sin, 2), (cos, 2)}),
        frozenset({(sin, 3), (cos, 2)}),
        frozenset({(sin, 2), (cos, 3)}),
        frozenset({(tan, 2)}),
    }
)


def is_trig_power_shape(expr: Expr, symbol: Symbol) -> bool:
    powers = _trig_powers(expr, symbol)
    return powers is not None and frozenset(powers.items()) in _SUPPORTED_SHAPES


def _verify_equivalent(original: Expr, transformed: Expr) -> None:
    if simplify(trigsimp(original - transformed)) != 0:
        # Nunca deveria disparar no escopo comprovado desta versão —
        # defesa contra uso indevido/edge case não antecipado: rejeita em
        # vez de apresentar uma transformação não verificada.
        raise ExpressionError(UNSUPPORTED_INTEGRAL_MESSAGE)


def _power_reduction_steps(expr: Expr, symbol: Symbol, which: str) -> list[MathStep]:
    """`sen²(x)` e `cos²(x)` — a MESMA técnica (identidade de redução de
    potência, fatorar a constante, integrar), parametrizada só pelo sinal
    da identidade. Reaproveitada para os dois casos em vez de duas
    implementações quase idênticas."""
    sign = "-" if which == "sin" else "+"
    identity_rhs_text = f"(1{sign}cos(2*{symbol}))/2"
    # Construído por TEXTO, não via `str()` do valor avaliado: o SymPy
    # distribui "(1-cos(2x))/2" automaticamente em "1/2 - cos(2x)/2" ao
    # ser calculado, perdendo a forma agrupada pedagógica — mesmo
    # espírito de `substitute_symbol_text`/Bhaskara (V2.9.1/V2.10.2):
    # nunca deixar o SymPy decidir sozinho a apresentação de uma
    # igualdade que precisa ficar visualmente agrupada.
    identity_rhs = sympify(identity_rhs_text)
    _verify_equivalent(expr, identity_rhs)

    body_text = f"1{sign}cos(2*{symbol})"
    steps = [
        MathStep(
            title="Identificando uma potência trigonométrica",
            expression=_rename_natural_log(str(expr)),
        ),
        MathStep(
            title="Aplicando a identidade de redução de potência",
            expression=_rename_natural_log(f"{expr}={identity_rhs_text}"),
        ),
        MathStep(
            title="Substituindo na integral",
            expression=_rename_natural_log(f"integral({identity_rhs_text}, {symbol})"),
        ),
        MathStep(
            title="Fatorando a constante",
            expression=_rename_natural_log(f"1/2*integral({body_text}, {symbol})"),
        ),
    ]
    transformed_result = compute_indefinite_integral(identity_rhs, symbol)
    steps.append(
        MathStep(title="Integrando", expression=_rename_natural_log(str(transformed_result)))
    )
    return steps


_TRIG_FUNCS = {"sin": sin, "cos": cos}


def _odd_power_steps(expr: Expr, symbol: Symbol, peel: str, other_power: int) -> list[MathStep]:
    """`sen³(x)`, `cos³(x)`, `sen³(x)cos²(x)`, `sen²(x)cos³(x)` — a MESMA
    técnica (separar um fator do expoente ímpar, reescrever o resto via
    identidade pitagórica em termos da OUTRA função, substituir
    `u=outra(x)`), parametrizada por qual função tem o expoente ímpar
    (`peel`) e pelo expoente já presente da outra (`other_power`, 0 para
    `sen³(x)`/`cos³(x)` sozinhos). Reaproveitada para os 4 casos em vez de
    4 implementações quase idênticas."""
    other = "cos" if peel == "sin" else "sin"
    peel_func = _TRIG_FUNCS[peel]
    other_func = _TRIG_FUNCS[other]
    peel_expr = peel_func(symbol)
    other_expr = other_func(symbol)

    is_mixed = other_power > 0
    other_suffix = f"*{other}({symbol})**{other_power}" if is_mixed else ""
    original_text = f"{peel}({symbol})**3{other_suffix}"
    separated_text = f"{peel}({symbol})*{peel}({symbol})**2{other_suffix}"

    title_identify = (
        f"Identificando produto com potência ímpar de {peel}"
        if is_mixed
        else f"Identificando uma potência ímpar de {peel}"
    )
    explanation_identify = (
        f"Como o expoente de {peel}({symbol}) é ímpar, separamos um fator "
        f"{peel}({symbol}) e reescrevemos o restante em termos de "
        f"{other}({symbol}), preparando a substituição u={other}({symbol})."
        if is_mixed
        else None
    )

    steps = [
        MathStep(
            title=title_identify,
            expression=_rename_natural_log(str(expr)),
            explanation=explanation_identify,
        ),
        MathStep(
            title=f"Separando um fator {peel}({symbol})",
            expression=_rename_natural_log(f"{original_text}={separated_text}"),
        ),
        MathStep(
            title=f"Aplicando {peel}²({symbol})=1-{other}²({symbol})",
            expression=_rename_natural_log(f"{peel}({symbol})**2=1-{other}({symbol})**2"),
        ),
    ]

    other_power_factor = other_expr**other_power if is_mixed else 1
    rewritten = peel_expr * (1 - other_expr**2) * other_power_factor
    _verify_equivalent(expr, rewritten)
    steps.append(
        MathStep(
            title="Reescrevendo a integral",
            expression=_rename_natural_log(f"integral({rewritten}, {symbol})"),
        )
    )

    du_expr = diff(other_expr, symbol)
    steps.append(
        MathStep(
            title="Aplicando a substituição",
            expression=_rename_natural_log(f"u={other_expr}, du={du_expr}*dx"),
        )
    )

    # `peel(x)*dx` em termos de `u`/`du`: como `du=du_expr*dx`, e
    # `du_expr` é sempre ±`peel_expr` (par pitagórico sen/cos), esse
    # coeficiente é SEMPRE uma constante ±1 real, calculada aqui — nunca
    # hardcoded.
    coefficient = simplify(peel_expr / du_expr)
    u = Symbol("u")
    u_power_factor = u**other_power if is_mixed else 1
    u_integrand = coefficient * (1 - u**2) * u_power_factor
    u_antiderivative = compute_indefinite_integral(u_integrand, u)
    steps.append(
        MathStep(title="Integrando", expression=_rename_natural_log(str(u_antiderivative)))
    )

    back_to_x = substitute_symbol_text(u_antiderivative, u, other_expr)
    steps.append(
        MathStep(title="Voltando para x", expression=_rename_natural_log(back_to_x))
    )
    return steps


def _sin2cos2_steps(expr: Expr, symbol: Symbol) -> list[MathStep]:
    """`sen²(x)cos²(x)` — ângulo duplo aplicado duas vezes: primeiro
    `sen(x)cos(x)=sen(2x)/2`, depois `sen²(2x)=(1-cos(4x))/2` (a MESMA
    identidade de redução de potência da V2.17, agora sobre `2x`)."""
    double_angle_lhs = f"sin({symbol})*cos({symbol})"
    double_angle_rhs = f"sin(2*{symbol})/2"
    _verify_equivalent(sin(symbol) * cos(symbol), sympify(double_angle_rhs))

    squared_lhs = f"sin({symbol})**2*cos({symbol})**2"
    squared_rhs = f"sin(2*{symbol})**2/4"

    reduction_lhs = f"sin(2*{symbol})**2"
    reduction_rhs = f"(1-cos(4*{symbol}))/2"

    final_text = f"(1-cos(4*{symbol}))/8"
    final_rhs = sympify(final_text)
    _verify_equivalent(expr, final_rhs)

    steps = [
        MathStep(
            title="Identificando potências pares de seno e cosseno",
            expression=_rename_natural_log(str(expr)),
        ),
        MathStep(
            title="Utilizando a identidade de ângulo duplo",
            expression=_rename_natural_log(f"{double_angle_lhs}={double_angle_rhs}"),
        ),
        MathStep(
            title="Elevando ao quadrado",
            expression=_rename_natural_log(f"{squared_lhs}={squared_rhs}"),
        ),
        MathStep(
            title="Aplicando redução de potência",
            expression=_rename_natural_log(f"{reduction_lhs}={reduction_rhs}"),
        ),
        MathStep(title="Reescrevendo", expression=_rename_natural_log(f"{expr}={final_text}")),
        MathStep(
            title="Substituindo na integral",
            expression=_rename_natural_log(f"integral({final_text}, {symbol})"),
        ),
    ]
    transformed_result = compute_indefinite_integral(final_rhs, symbol)
    steps.append(
        MathStep(title="Integrando", expression=_rename_natural_log(str(transformed_result)))
    )
    return steps


def _tan2_steps(expr: Expr, symbol: Symbol) -> list[MathStep]:
    """`tan²(x)=sec²(x)-1` — investigado ANTES de escrever este código:
    `sec` já é uma classe SymPy real e já renderiza corretamente via o
    pipeline `valueToLatex` existente (`\\sec`, comando KaTeX próprio, não
    um fallback cru) mesmo `sec` não estando na whitelist de ENTRADA do
    parser (`safe_parsing.py`) — irrelevante aqui, porque esta string é
    sempre SAÍDA já calculada, nunca texto que precisa ser reaceito como
    entrada."""
    identity_rhs_text = f"sec({symbol})**2-1"
    identity_rhs = sympify(identity_rhs_text)
    _verify_equivalent(expr, identity_rhs)

    steps = [
        MathStep(
            title="Identificando uma potência de tangente",
            expression=_rename_natural_log(str(expr)),
        ),
        MathStep(
            title=f"Aplicando tan²({symbol})=sec²({symbol})-1",
            expression=_rename_natural_log(f"{expr}={identity_rhs_text}"),
        ),
        MathStep(
            title="Substituindo na integral",
            expression=_rename_natural_log(f"integral({identity_rhs_text}, {symbol})"),
        ),
        MathStep(
            title="Separando a integral",
            expression=_rename_natural_log(
                f"integral(sec({symbol})**2, {symbol})-integral(1, {symbol})"
            ),
        ),
    ]
    transformed_result = compute_indefinite_integral(identity_rhs, symbol)
    steps.append(
        MathStep(title="Integrando", expression=_rename_natural_log(str(transformed_result)))
    )
    return steps


def generate_trig_integral_steps(text: str) -> list[MathStep]:
    expr, symbol = parse_integral_call(text)
    steps = [
        MathStep(
            title="Integral original",
            expression=_rename_natural_log(f"integral({expr}, {symbol})"),
        )
    ]

    powers = _trig_powers(expr, symbol)
    if powers is None:
        # Nunca deveria acontecer no fluxo normal — `steps/dispatcher.py`
        # só chama esta função quando `is_trig_power_shape` já confirmou
        # a forma. Defesa contra uso indevido direto do módulo.
        raise ExpressionError(UNSUPPORTED_INTEGRAL_MESSAGE)
    key = frozenset(powers.items())

    if key == frozenset({(sin, 2)}):
        steps.extend(_power_reduction_steps(expr, symbol, "sin"))
    elif key == frozenset({(cos, 2)}):
        steps.extend(_power_reduction_steps(expr, symbol, "cos"))
    elif key == frozenset({(sin, 3)}):
        steps.extend(_odd_power_steps(expr, symbol, "sin", 0))
    elif key == frozenset({(cos, 3)}):
        steps.extend(_odd_power_steps(expr, symbol, "cos", 0))
    elif key == frozenset({(sin, 3), (cos, 2)}):
        steps.extend(_odd_power_steps(expr, symbol, "sin", 2))
    elif key == frozenset({(sin, 2), (cos, 3)}):
        steps.extend(_odd_power_steps(expr, symbol, "cos", 2))
    elif key == frozenset({(sin, 2), (cos, 2)}):
        steps.extend(_sin2cos2_steps(expr, symbol))
    elif key == frozenset({(tan, 2)}):
        steps.extend(_tan2_steps(expr, symbol))
    else:
        raise ExpressionError(UNSUPPORTED_INTEGRAL_MESSAGE)

    primitive = compute_indefinite_integral(expr, symbol)
    steps.append(
        MathStep(
            title="Adicionando a constante de integração",
            explanation=INTEGRATION_CONSTANT_EXPLANATION,
            expression=_rename_natural_log(f"{primitive} + C"),
        )
    )
    return steps
