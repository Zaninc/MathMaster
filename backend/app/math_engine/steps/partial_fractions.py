"""Sprint V2.16 — passo a passo de integração de funções racionais por
frações parciais: `p(x)/q(x) = A/(x-r1) + B/(x-r2) + ...` quando `q(x)`
fatora em fatores LINEARES (distintos ou repetidos) e `grau(p) < grau(q)`.
Camada puramente didática — NUNCA um segundo resolvedor de integrais:
reaproveita `calculus/dispatcher.py:parse_integral_call` (o mesmo parser
da V2.10.1/V2.14/V2.15, já com a paridade de Euler do Hotfix V2.15.1) e,
principalmente, `calculus/integrals.py:compute_indefinite_integral` (o
MESMO `sympy.integrate` que o `/solve` já usa) para TODO valor
final mostrado — inclusive cada antiderivada individual `∫coeficiente/
(x-r)^n dx` e o resultado final "+ C" (chamado sobre a expressão
ORIGINAL, garantindo zero divergência do `/solve`). Este módulo só decide
COMO fatiar a decomposição em passos; nunca integra nem resolve
coeficientes por conta própria fora do SymPy real.

Detecção via ÁRVORE do SymPy, nunca regex nem manipulação textual:
`expr.as_numer_denom()` separa numerador/denominador, `.is_polynomial`
confirma que os dois são polinômios em `symbol`, `degree()` confirma
fração PRÓPRIA, e `factor_list(denom, symbol)` fatora o denominador
estruturalmente — cada fator precisa ter grau exatamente 1 (fatores
irredutíveis de grau >= 2, ex. `x²+1`, ficam fora do escopo desta versão,
reservados para uma futura V2.16.1). Um denominador com um ÚNICO fator
(por mais repetido que seja, ex. `1/(x+1)²`) também não é reivindicado —
a decomposição resultante sempre teria o coeficiente do termo de maior
grau igual a zero (a fração já É sua própria "decomposição", não precisa
de nenhuma), então tratar isso como fração parcial só produziria um passo
pedagogicamente vazio.

Coeficientes A/B/C determinados por comparação de coeficientes
polinomiais (`sympy.Poly`/`.nth()`) e `sympy.solve` sobre o sistema linear
resultante — reaproveitando o solver algébrico REAL do SymPy (o mesmo que
`equations/systems.py` usa por baixo dos panos para sistemas lineares),
nunca um solver escrito à mão. Cada decomposição é verificada
simbolicamente (`simplify(expr - decomposto) == 0`) ANTES de qualquer
passo ser apresentado — se a verificação falhar (nunca deveria, dado o
escopo comprovado), o módulo rejeita com a mensagem amigável genérica em
vez de arriscar mostrar matemática errada.

`is_improper_rational_function` é uma checagem SEPARADA e mais estreita
(mesmo formato de fração racional, mas grau do numerador >= grau do
denominador) — o `steps/dispatcher.py` a consulta ANTES de
`find_partial_fractions` para devolver a mensagem amigável DEDICADA sobre
divisão polinomial, distinta da rejeição genérica que qualquer outro caso
fora de escopo (fator irredutível, fator único) recebe."""
from __future__ import annotations

import re
import string

from sympy import Eq, Poly, degree, expand, factor_list, simplify, solve
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..calculus.dispatcher import parse_integral_call
from ..calculus.integrals import compute_indefinite_integral
from ..errors import ExpressionError
from .formatting import INTEGRATION_CONSTANT_EXPLANATION, signed_terms_text, wrap_if_sum
from .models import MathStep
from .validation import UNSUPPORTED_INTEGRAL_MESSAGE

# (numerador, denominador, coeficiente líder, [(fator, multiplicidade), ...])
_PartialFractionPlan = tuple[Expr, Expr, Expr, list[tuple[Expr, int]]]

# Mesma convenção/técnica já usada em `u_substitution.py`/
# `integration_by_parts.py`/`quotient_rule.py`/`calculus/dispatcher.py`:
# qualquer "log(" que sobreviver num valor real do SymPy é sempre log
# NATURAL.
_NATURAL_LOG_PATTERN = re.compile(r"\blog(?=\()")


def _rename_natural_log(text: str) -> str:
    return _NATURAL_LOG_PATTERN.sub("ln", text)


def _rational_parts(expr: Expr, symbol: Symbol) -> tuple[Expr, Expr] | None:
    """`(numerador, denominador)` se `expr` for genuinamente uma fração
    racional em `symbol` (denominador não-trivial, os dois lados
    polinomiais). `None` para qualquer outra forma — produto simples
    (`x*exp(x)`, denominador 1), potência composta já coberta pela V2.14,
    ou qualquer coisa com uma função transcendental no numerador/
    denominador (`.is_polynomial` só é `True` para polinômios genuínos)."""
    numer, denom = expr.as_numer_denom()
    if denom == 1:
        return None
    if not (numer.is_polynomial(symbol) and denom.is_polynomial(symbol)):
        return None
    return numer, denom


def is_improper_rational_function(expr: Expr, symbol: Symbol) -> bool:
    """Verdadeiro só quando `expr` é uma função racional genuína (ver
    `_rational_parts`) mas IMPRÓPRIA (grau do numerador >= grau do
    denominador) — usada por `steps/dispatcher.py` para a mensagem
    amigável dedicada sobre divisão polinomial, ANTES de
    `find_partial_fractions` sequer ser consultada."""
    parts = _rational_parts(expr, symbol)
    if parts is None:
        return False
    numer, denom = parts
    return degree(numer, symbol) >= degree(denom, symbol)


def find_partial_fractions(expr: Expr, symbol: Symbol) -> _PartialFractionPlan | None:
    """Plano de decomposição se `expr` for uma fração PRÓPRIA cujo
    denominador fatora em 2+ fatores lineares distintos (repetidos ou
    não) — os únicos casos suportados nesta versão. `None` (nunca
    "chuta") para: não ser uma fração racional genuína, ser imprópria
    (ver `is_improper_rational_function`), ter algum fator de grau >= 2
    (irredutível, fora de escopo), ou ter um único fator (decomposição
    pedagogicamente vazia, ver docstring do módulo)."""
    parts = _rational_parts(expr, symbol)
    if parts is None:
        return None
    numer, denom = parts
    if degree(numer, symbol) >= degree(denom, symbol):
        return None

    leading, factors_with_mult = factor_list(denom, symbol)
    if len(factors_with_mult) < 2:
        return None
    for factor_expr, _multiplicity in factors_with_mult:
        if degree(factor_expr, symbol) != 1:
            return None
    return numer, denom, leading, factors_with_mult


def _build_terms(
    denom: Expr, leading: Expr, factors_with_mult: list[tuple[Expr, int]], symbol: Symbol
) -> list[tuple[Symbol, Expr, int, Expr]]:
    """Um termo `(coeficiente_símbolo, fator, potência, resto)` por grau
    de cada fator repetido (`A/x`, `B/(x+1)`, `C/(x+1)**2`, nunca só o
    maior grau) — `resto` é `denom` dividido pelo fator elevado a essa
    potência específica (usado para montar a equação de "eliminar os
    denominadores" sem nunca reintegrar/expandir o próprio `denom`)."""
    letters = iter(string.ascii_uppercase)
    terms: list[tuple[Symbol, Expr, int, Expr]] = []
    for factor_expr, multiplicity in factors_with_mult:
        for power in range(1, multiplicity + 1):
            coeff_symbol = Symbol(next(letters))
            rest = (denom / leading) / factor_expr**power
            rest = expand(rest) if rest.is_polynomial(symbol) else rest
            terms.append((coeff_symbol, factor_expr, power, rest))
    return terms


def _solve_coefficients(
    numer: Expr, denom: Expr, leading: Expr, terms: list[tuple[Symbol, Expr, int, Expr]], symbol: Symbol
) -> tuple[Expr, Expr, dict[Symbol, Expr]]:
    """Resolve A/B/C comparando coeficientes polinomiais (`Poly.nth`) dos
    dois lados de "numerador = soma(coeficiente*resto)" — reaproveita
    `sympy.solve` sobre o sistema linear resultante, nunca um solver
    manual. Devolve também os dois lados ANTES de expandir (para o passo
    "Eliminando os denominadores", que mostra a forma fatorada
    `A*(x+2)`, não a expandida `A*x+2*A`)."""
    cleared_lhs = expand(numer / leading)
    cleared_rhs = expand(sum(coeff * rest for coeff, _f, _p, rest in terms))

    coeffs = [coeff for coeff, _f, _p, _rest in terms]
    poly_lhs = Poly(cleared_lhs, symbol)
    poly_rhs = Poly(cleared_rhs, symbol)
    max_degree = degree(denom, symbol) - 1
    equations = [
        Eq(poly_lhs.nth(power), poly_rhs.nth(power)) for power in range(0, max_degree + 1)
    ]
    solutions = solve(equations, coeffs, dict=True)
    if not solutions:
        # Nunca deveria acontecer no escopo desta versão — uma
        # decomposição em frações parciais com fatores lineares SEMPRE
        # tem solução única. Defesa contra uso indevido/edge case não
        # antecipado: rejeita em vez de arriscar valores inventados.
        raise ExpressionError(UNSUPPORTED_INTEGRAL_MESSAGE)
    solution = solutions[0]
    return cleared_lhs, cleared_rhs, solution


def _term_sign(value: Expr, *, is_first: bool) -> str:
    negative = value.could_extract_minus_sign()
    if negative:
        return "-"
    return "" if is_first else "+"


def _fraction_magnitude_text(value: Expr, factor_expr: Expr, power: int) -> str:
    """"{|value|}/{fator}" ou "{|value|}/{fator}**{potência}" — construído
    por texto porque o printer do SymPy mostra inconsistentemente
    "1/(x+1)" para expoente -1 mas "(x+1)**(-2)" (sem o "1/" explícito)
    quando o coeficiente é exatamente 1 e o expoente é <= -2 (o Mul
    colapsa "1*(x+1)**-2" para só "(x+1)**-2"). `wrap_if_sum` (V2.13)
    garante parênteses ao redor do fator quando ele é uma soma, mesmo sem
    expoente ("1/(x + 1)", nunca "1/x + 1"). Coeficiente fracionário
    (ex. 8/3) ganha parênteses próprios ("(8/3)/(x - 1)", nunca
    "8/3/(x - 1)") — sintaticamente equivalente sem eles, mas ambíguo de
    ler; inteiro (`q == 1`) nunca precisa disso."""
    magnitude = -value if value.could_extract_minus_sign() else value
    magnitude_text = f"({magnitude})" if getattr(magnitude, "q", 1) != 1 else str(magnitude)
    base_text = wrap_if_sum(factor_expr)
    denom_text = base_text if power == 1 else f"{base_text}**{power}"
    return f"{magnitude_text}/{denom_text}"


def generate_partial_fraction_steps(text: str) -> list[MathStep]:
    expr, symbol = parse_integral_call(text)
    steps = [
        MathStep(
            title="Integral original",
            expression=_rename_natural_log(f"integral({expr}, {symbol})"),
        )
    ]

    plan = find_partial_fractions(expr, symbol)
    if plan is None:
        # Nunca deveria acontecer no fluxo normal — `steps/dispatcher.py`
        # só chama esta função quando `find_partial_fractions` já
        # confirmou a forma. Defesa contra uso indevido direto do módulo.
        raise ExpressionError(UNSUPPORTED_INTEGRAL_MESSAGE)
    numer, denom, leading, factors_with_mult = plan

    steps.append(
        MathStep(title="Identificando uma função racional", expression=_rename_natural_log(str(expr)))
    )
    steps.append(MathStep(title="Fatorando o denominador", expression=_rename_natural_log(str(denom))))

    terms = _build_terms(denom, leading, factors_with_mult, symbol)
    ansatz = sum(coeff / factor_expr**power for coeff, factor_expr, power, _rest in terms)
    steps.append(
        MathStep(
            title="Montando as frações parciais",
            expression=_rename_natural_log(f"{expr}={ansatz}"),
        )
    )

    cleared_lhs, _cleared_rhs, solution = _solve_coefficients(numer, denom, leading, terms, symbol)
    unexpanded_rhs = "+".join(f"{coeff}*({rest})" for coeff, _f, _p, rest in terms)
    steps.append(
        MathStep(
            title="Eliminando os denominadores",
            expression=_rename_natural_log(f"{cleared_lhs}={unexpanded_rhs}"),
        )
    )

    coefficient_values = [(coeff, solution[coeff]) for coeff, _f, _p, _rest in terms]
    steps.append(
        MathStep(
            title="Determinando os coeficientes",
            expression=_rename_natural_log(", ".join(f"{c}={v}" for c, v in coefficient_values)),
        )
    )

    decomposed_terms = [value / factor_expr**power for (_c, value), (_c2, factor_expr, power, _r) in zip(coefficient_values, terms)]
    decomposed = sum(decomposed_terms)
    if simplify(expr - decomposed) != 0:
        # Mesma defesa de `_solve_coefficients`: nunca deveria disparar no
        # escopo comprovado desta versão. O produto nunca apresenta uma
        # decomposição que não seja exatamente equivalente à original.
        raise ExpressionError(UNSUPPORTED_INTEGRAL_MESSAGE)

    # `signed_terms_text`/`str()` não servem aqui: o printer do SymPy
    # mostra "1/(x + 1)" para expoente -1, mas "(x + 1)**(-2)" (SEM o
    # "1/" explícito) para expoente <= -2 quando o coeficiente é
    # exatamente 1 (o Mul colapsa "1*(x+1)**-2" para só "(x+1)**-2") —
    # inconsistência do próprio printer, não um bug de sinal. Construído
    # por texto a partir de componentes REAIS (`value`/`factor_expr`/
    # `power`, todos já verificados), nunca por manipulação da expressão
    # original — mesmo espírito de `substitute_symbol_text`/Bhaskara
    # (V2.9.1/V2.10.2): nunca deixar o SymPy decidir sozinho a
    # apresentação de um valor que precisa ficar visualmente consistente.
    fraction_texts = [
        _fraction_magnitude_text(value, factor_expr, power)
        for (_c, value), (_c2, factor_expr, power, _r) in zip(coefficient_values, terms)
    ]
    substituting_text = "".join(
        f"{_term_sign(value, is_first=index == 0)}{fraction_text}"
        for index, ((_c, value), fraction_text) in enumerate(zip(coefficient_values, fraction_texts))
    )
    steps.append(
        MathStep(
            title="Substituindo",
            expression=_rename_natural_log(f"{expr}={substituting_text}"),
        )
    )

    integral_text = "".join(
        f"{_term_sign(value, is_first=index == 0)}integral({fraction_text}, {symbol})"
        for index, ((_c, value), fraction_text) in enumerate(zip(coefficient_values, fraction_texts))
    )
    steps.append(
        MathStep(title="Separando a integral", expression=_rename_natural_log(integral_text))
    )

    per_term_antiderivatives = [
        value * compute_indefinite_integral(1 / factor_expr**power, symbol)
        for (_c, value), (_c2, factor_expr, power, _r) in zip(coefficient_values, terms)
    ]
    steps.append(
        MathStep(
            title="Integrando",
            expression=_rename_natural_log(signed_terms_text(per_term_antiderivatives)),
        )
    )

    primitive = compute_indefinite_integral(expr, symbol)
    steps.append(
        MathStep(
            title="Adicionando a constante de integração",
            explanation=INTEGRATION_CONSTANT_EXPLANATION,
            expression=_rename_natural_log(f"{primitive} + C"),
        )
    )
    return steps
