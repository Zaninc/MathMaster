r"""Sprint V3.0.7 (Séries de Taylor e Maclaurin) — passo a passo de
`taylor(expr, var, centro, ordem)`. Camada puramente didática — NUNCA um
segundo motor: reaproveita inteiramente `calculus/taylor.py:taylor_terms`
(que por sua vez reaproveita `calculus/derivatives.py:compute_derivative`,
a mesma primitiva `sympy.diff(expr, symbol, k)` da V3.0.6) para TODO
valor mostrado em cada passo — este módulo só decide COMO apresentar o
cálculo já feito em etapas, nunca recalcula nada por conta própria.

Estrutura dos passos (mesmo espírito conceitual do ticket, seção 8):

1. Fórmula de Taylor — referência FIXA (mesma ideia de mostrar a fórmula
   de Bhaskara como referência em `quadratic_equations.py`: um FATO
   constante, não um resultado calculado, nunca "hardcoding" no sentido
   proibido do ticket).
2. Função original — f(x)=... (o `expr` já parseado).
3. Uma etapa por ordem k=1..n — f^(k)(x)=... (reaproveita `compute_
   derivative` via `taylor_terms`).
4. Uma etapa por ordem k=0..n — avaliação em x=a: f^(k)(a)=...
5. Substituição — a soma AINDA com "k!" literal (não simplificado),
   preservando a leitura pedagógica "coeficiente/k! vezes (x-a)^k".
6. Resultado — o polinômio final já simplificado (`compute_taylor_
   polynomial_text`, mesma função que `/solve` usa — nunca duas
   implementações do mesmo cálculo).
"""
from __future__ import annotations

import re

from sympy.core.symbol import Symbol

from ..calculus.dispatcher import parse_taylor_call
from ..calculus.taylor import compute_taylor_polynomial_text, taylor_terms
from .formatting import eq_text, wrap_if_sum
from .models import MathStep

_NATURAL_LOG_PATTERN = re.compile(r"\blog(?=\()")


def _rename_natural_log(text: str) -> str:
    return _NATURAL_LOG_PATTERN.sub("ln", text)


def _derivative_label(k: int, symbol: Symbol) -> str:
    """"f(x)"/"f'(x)"/"f''(x)"/"f'''(x)"/"f^(4)(x)"... — notação de livro
    didático padrão pras 3 primeiras ordens (prima simples/dupla/tripla),
    caindo pra "f^(k)(x)" a partir da 4ª — mesmo padrão de apresentação
    já usado em `advanced_derivatives.py` pra rótulos de fatores (nunca
    um cálculo, só como NOMEAR o passo)."""
    if k == 0:
        return f"f({symbol})"
    if k == 1:
        return f"f'({symbol})"
    if k == 2:
        return f"f''({symbol})"
    if k == 3:
        return f"f'''({symbol})"
    return f"f^({k})({symbol})"


def _evaluation_label(k: int, center_text: str) -> str:
    if k == 0:
        return f"f({center_text})"
    if k == 1:
        return f"f'({center_text})"
    if k == 2:
        return f"f''({center_text})"
    if k == 3:
        return f"f'''({center_text})"
    return f"f^({k})({center_text})"


def generate_taylor_steps(text: str) -> list[MathStep]:
    expr, symbol, center, order = parse_taylor_call(text)
    terms = taylor_terms(expr, symbol, center, order)  # já fail-closed de domínio

    steps: list[MathStep] = [
        MathStep(
            title="Fórmula de Taylor",
            expression=(
                f"P_{order}({symbol})="
                f"Σ(k=0..{order}) (derivada(f,{symbol},k)/factorial(k))*({symbol}-a)^k"
            ),
        ),
        MathStep(title="Função original", expression=eq_text(f"f({symbol})", expr)),
    ]

    # Uma etapa por ordem — as derivadas necessárias (k=0 já é "Função
    # original" acima, começa em k=1). Cada `derivative_expr` vem direto
    # de `taylor_terms` (que já chamou `compute_derivative` — nunca
    # recalculado aqui).
    for k, derivative_expr, _value_at_center, _term in terms:
        if k == 0:
            continue
        steps.append(
            MathStep(
                title=f"Calculando a {k}ª derivada" if k > 1 else "Calculando a derivada",
                expression=eq_text(_derivative_label(k, symbol), derivative_expr),
            )
        )

    # Uma etapa por ordem — avaliação de cada derivada em x=a. Mostra
    # TODOS os k, inclusive os que zeram (ex. termos ímpares de sen(x) em
    # a=π/2) — é exatamente essa etapa que prova "por que os termos
    # ímpares zeram" (item 11 do ticket), nunca escondida.
    center_text = str(center)
    for k, _derivative_expr, value_at_center, _term in terms:
        steps.append(
            MathStep(
                title=f"Avaliando em {symbol}={center_text}",
                expression=eq_text(_evaluation_label(k, center_text), value_at_center),
            )
        )

    # Substituição — soma AINDA com "k!" literal (não avaliado), na ORDEM
    # de k (nunca reordenada por `Add`/`simplify` — mesmo motivo já
    # documentado em `calculus/taylor.py`). Termos com f^(k)(a)==0 são
    # OMITIDOS aqui também (eles já foram mostrados explicitamente na
    # etapa de avaliação acima — não precisam reaparecer como "+0*(...)"
    # nesta soma).
    substitution_pieces: list[str] = []
    for index, (k, _derivative_expr, value_at_center, _term) in enumerate(
        item for item in terms if item[2] != 0
    ):
        negative = value_at_center.could_extract_minus_sign()
        magnitude = -value_at_center if negative else value_at_center
        sign = "-" if negative else ("" if index == 0 else "+")
        if k == 0:
            # k=0 é sempre f(a)/0! * (x-a)^0 = f(a) — "/factorial(0)*(...)^0"
            # nunca aparece por escrito (0!=1 e (x-a)^0=1, mostrar os dois
            # literalmente só atrapalharia a leitura sem ensinar nada novo).
            substitution_pieces.append(f"{sign}{magnitude}")
            continue
        # `center == 0` (Maclaurin) mostra a potência como "x^k" puro —
        # "(x-0)" é matematicamente correto mas visualmente redundante;
        # SEM caso especial no CÁLCULO (o valor já é idêntico dos dois
        # jeitos), só na FORMATAÇÃO deste passo pedagógico.
        base_text = str(symbol) if center == 0 else f"({symbol}-{center_text})"
        power_text = base_text if k == 1 else f"{base_text}^{k}"
        substitution_pieces.append(f"{sign}{wrap_if_sum(magnitude)}/factorial({k})*{power_text}")
    substitution_text = "".join(substitution_pieces) if substitution_pieces else "0"
    steps.append(
        MathStep(
            title="Substituindo na fórmula de Taylor",
            expression=f"P_{order}({symbol})={substitution_text}",
        )
    )

    final_text = compute_taylor_polynomial_text(expr, symbol, center, order)
    steps.append(
        MathStep(title="Simplificando", expression=f"P_{order}({symbol})={final_text}")
    )

    return [
        MathStep(
            title=_rename_natural_log(step.title) if step.title else step.title,
            title_segments=step.title_segments,
            expression=_rename_natural_log(step.expression),
            explanation=step.explanation,
        )
        for step in steps
    ]
