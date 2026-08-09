"""Sprint V2.16 — passo a passo de integração de funções racionais por
frações parciais: `p(x)/q(x) = A/(x-r1) + B/(x-r2) + ...` quando `q(x)`
fatora em fatores LINEARES (distintos ou repetidos) e `grau(p) < grau(q)`.

Sprint V2.18 estendeu o mesmo módulo (nunca um segundo resolvedor) para
também aceitar UM fator QUADRÁTICO IRREDUTÍVEL (numerador `Bx+C`, nunca só
uma constante) — ver `_partial_fraction_plan`/`_build_terms` — e extraiu o
núcleo reutilizável (`_partial_fraction_plan`/`_decomposition_body`) para
que `polynomial_division.py` (V2.18, divisão polinomial de frações
impróprias) monte a MESMA decomposição sobre `resto(x)/D(x)` sem duplicar
nenhuma lógica de fatoração/coeficientes/verificação.

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
estruturalmente. Cada fator de `factor_list` já é GARANTIDAMENTE
irredutível sobre os racionais (é a própria definição de fatoração
completa do SymPy) — por isso um fator de grau 2 devolvido por
`factor_list` NUNCA precisa de uma checagem adicional de discriminante
para confirmar irredutibilidade (evita qualquer dependência de float: a
"API de fatoração do SymPy" já É a prova estrutural). Fatores de grau >= 3
continuam fora de escopo. Quadráticas REPETIDAS (`1/(x²+1)²`) e MÚLTIPLAS
quadráticas diferentes (`1/((x²+1)(x²+4))`) também ficam fora de escopo
nesta versão — cada denominador aceita no máximo UM fator de grau 2, com
multiplicidade exatamente 1 — para não prometer uma decomposição que esta
versão não sabe apresentar pedagogicamente. Um denominador com um ÚNICO
fator (por mais repetido que seja, ex. `1/(x+1)²` ou `1/(x²+1)` sozinho)
também não é reivindicado — a decomposição resultante sempre teria o
coeficiente do termo de maior grau igual a zero (a fração já É sua própria
"decomposição", não precisa de nenhuma), então tratar isso como fração
parcial só produziria um passo pedagogicamente vazio; é exatamente por
isso que `1/(x²+1)` sozinho NUNCA é reivindicado por este módulo, mesmo
após a extensão da V2.18 — continua caindo no mesmo fallback amigável
genérico de sempre (o motor real ainda resolve para `atan(x)+C` via
`/solve`, só não tem passo a passo dedicado nesta versão).

Coeficientes (A para fator linear; B e C para o numerador `Bx+C` de um
fator quadrático) determinados por comparação de coeficientes polinomiais
(`sympy.Poly`/`.nth()`) e `sympy.solve` sobre o sistema linear resultante
— reaproveitando o solver algébrico REAL do SymPy, nunca um solver escrito
à mão. Cada decomposição é verificada simbolicamente
(`simplify(fração - decomposto) == 0`) ANTES de qualquer passo ser
apresentado — se a verificação falhar (nunca deveria, dado o escopo
comprovado), o módulo rejeita com a mensagem amigável genérica em vez de
arriscar mostrar matemática errada.

Uma peça com numerador `Bx+C` NUNCA é integrada como um bloco só: a
V2.18 separa `Bx/fator` e `C/fator` em duas peças atômicas ANTES de
integrar (`_integration_pieces`) — `∫(Bx+C)/(x²+1)dx` combinaria
ln(x²+1) e atan(x) numa única soma sem um sinal externo bem definido para
`signed_terms_text`; peças atômicas mantêm a mesma garantia de "um termo
por entrada" que já vale para fatores lineares desde a V2.16."""
from __future__ import annotations

import re
import string
from typing import NamedTuple

from sympy import Eq, Poly, cancel, degree, expand, factor_list, simplify, solve
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

# Um termo da decomposição: `coeff_symbols` tem 1 símbolo (numerador
# constante `A`, fator linear) ou 2 símbolos (numerador `Bx+C`, fator
# quadrático) — nunca mais que isso nesta versão (fora de escopo: fator
# grau >= 3, que exigiria um numerador de grau 2).
_Term = tuple[tuple[Symbol, ...], Expr, int, Expr]

# Uma peça ATÔMICA pronta para integração: `value` é o coeficiente
# numérico já resolvido, `base_integrand` é `1/fator**potência` (peça
# "constant") ou `symbol/fator**potência` (peça "linear", só existe para
# a metade `Bx` de um numerador quadrático).
class _IntegrationPiece(NamedTuple):
    value: Expr
    base_integrand: Expr
    kind: str  # "constant" | "linear"
    factor_expr: Expr
    power: int


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
    denominador (`.is_polynomial` só é `True` para polinômios genuínos —
    é assim que `e^x/(x+1)`, `sen(x)/(x+1)`, `ln(x)/(x+1)`, `x/sen(x)`
    ficam automaticamente fora do escopo deste módulo E do
    `polynomial_division.py`, sem nenhuma checagem dedicada)."""
    numer, denom = expr.as_numer_denom()
    if denom == 1:
        return None
    if not (numer.is_polynomial(symbol) and denom.is_polynomial(symbol)):
        return None
    return numer, denom


def is_improper_rational_function(expr: Expr, symbol: Symbol) -> bool:
    """Verdadeiro só quando `expr` é uma função racional genuína (ver
    `_rational_parts`) mas IMPRÓPRIA (grau do numerador >= grau do
    denominador). Mantida para uso externo/diagnóstico — desde a V2.18
    `steps/dispatcher.py` não usa mais esta função para rejeitar de
    imediato: `polynomial_division.find_polynomial_division` decide o caso
    impróprio (dividindo de verdade em vez de só detectar e desistir)."""
    parts = _rational_parts(expr, symbol)
    if parts is None:
        return False
    numer, denom = parts
    return degree(numer, symbol) >= degree(denom, symbol)


def _partial_fraction_plan(
    numer: Expr, denom: Expr, symbol: Symbol
) -> _PartialFractionPlan | None:
    """Núcleo reutilizável: dado um par (numerador, denominador) já
    PRÓPRIO (grau numer < grau denom — responsabilidade do chamador, ver
    `find_partial_fractions` e `polynomial_division.find_polynomial_
    division`), decide se o denominador fatora numa forma suportada — 2+
    fatores, cada um de grau 1 ou 2 (irredutibilidade de qualquer fator
    grau 2 é estrutural, ver docstring do módulo), no máximo um fator
    quadrático, e esse fator quadrático nunca repetido. `None` (nunca
    "chuta") para qualquer forma fora desse escopo."""
    leading, factors_with_mult = factor_list(denom, symbol)
    if len(factors_with_mult) < 2:
        return None
    quadratic_factor_count = 0
    for factor_expr, multiplicity in factors_with_mult:
        factor_degree = degree(factor_expr, symbol)
        if factor_degree not in (1, 2):
            return None
        if factor_degree == 2:
            if multiplicity != 1:
                return None
            quadratic_factor_count += 1
    if quadratic_factor_count > 1:
        return None
    return numer, denom, leading, factors_with_mult


def find_partial_fractions(expr: Expr, symbol: Symbol) -> _PartialFractionPlan | None:
    """Plano de decomposição se `expr` for uma fração PRÓPRIA cujo
    denominador fatora numa forma suportada (ver `_partial_fraction_
    plan`). `None` para: não ser uma fração racional genuína, ser
    imprópria, ou ter uma forma de fatoração fora de escopo."""
    parts = _rational_parts(expr, symbol)
    if parts is None:
        return None
    numer, denom = parts
    if degree(numer, symbol) >= degree(denom, symbol):
        return None
    return _partial_fraction_plan(numer, denom, symbol)


def _build_terms(
    denom: Expr, leading: Expr, factors_with_mult: list[tuple[Expr, int]], symbol: Symbol
) -> list[_Term]:
    """Um termo `(símbolos_do_coeficiente, fator, potência, resto)` por
    grau de cada fator repetido (`A/x`, `B/(x+1)`, `C/(x+1)**2`, nunca só
    o maior grau) — fator linear consome UM símbolo (numerador
    constante); fator quadrático consome DOIS símbolos consecutivos
    (numerador `symbol_1*x + symbol_2`, ver `_term_numerator_expr`).
    `resto` é `denom` dividido pelo fator elevado a essa potência
    específica (usado para montar a equação de "eliminar os
    denominadores" sem nunca reintegrar/expandir o próprio `denom`)."""
    letters = iter(string.ascii_uppercase)
    terms: list[_Term] = []
    for factor_expr, multiplicity in factors_with_mult:
        factor_degree = degree(factor_expr, symbol)
        for power in range(1, multiplicity + 1):
            if factor_degree == 1:
                coeff_symbols = (Symbol(next(letters)),)
            else:
                coeff_symbols = (Symbol(next(letters)), Symbol(next(letters)))
            # `cancel()` (não divisão bruta) porque `denom` nem sempre
            # chega já fatorado como `Mul` dos próprios fatores — quando
            # `polynomial_division.py` (V2.18) reaproveita este helper
            # sobre um denominador digitado em forma expandida (ex.
            # `x**2 - 1`, nunca `(x - 1)*(x + 1)`), `(denom/leading)/
            # factor_expr**power` como divisão crua NÃO cancela
            # textualmente (SymPy só cancela automaticamente Muls com o
            # mesmo fator já em evidência) e sobra uma fração não-
            # polinomial; `cancel()` faz o cancelamento polinomial de
            # verdade em qualquer uma das duas formas de entrada.
            rest = cancel((denom / leading) / factor_expr**power)
            rest = expand(rest) if rest.is_polynomial(symbol) else rest
            terms.append((coeff_symbols, factor_expr, power, rest))
    return terms


def _term_numerator_expr(coeff_symbols: tuple[Symbol, ...], symbol: Symbol) -> Expr:
    """`A` (fator linear) ou `B*symbol + C` (fator quadrático) — a única
    diferença estrutural entre as duas formas de ansatz desta versão."""
    if len(coeff_symbols) == 1:
        return coeff_symbols[0]
    b, c = coeff_symbols
    return b * symbol + c


def _solve_coefficients(
    numer: Expr, denom: Expr, leading: Expr, terms: list[_Term], symbol: Symbol
) -> tuple[Expr, Expr, dict[Symbol, Expr]]:
    """Resolve A/B/C comparando coeficientes polinomiais (`Poly.nth`) dos
    dois lados de "numerador = soma(numerador_do_termo*resto)" —
    reaproveita `sympy.solve` sobre o sistema linear resultante, nunca um
    solver manual. Devolve também os dois lados ANTES de expandir (para o
    passo "Eliminando os denominadores", que mostra a forma fatorada,
    não a expandida)."""
    cleared_lhs = expand(numer / leading)
    cleared_rhs = expand(
        sum(_term_numerator_expr(coeff_symbols, symbol) * rest for coeff_symbols, _f, _p, rest in terms)
    )

    coeffs = [coeff for coeff_symbols, _f, _p, _rest in terms for coeff in coeff_symbols]
    poly_lhs = Poly(cleared_lhs, symbol)
    poly_rhs = Poly(cleared_rhs, symbol)
    max_degree = degree(denom, symbol) - 1
    equations = [
        Eq(poly_lhs.nth(power), poly_rhs.nth(power)) for power in range(0, max_degree + 1)
    ]
    solutions = solve(equations, coeffs, dict=True)
    if not solutions:
        # Nunca deveria acontecer no escopo desta versão — uma
        # decomposição em frações parciais com fatores lineares/um
        # quadrático simples SEMPRE tem solução única. Defesa contra uso
        # indevido/edge case não antecipado: rejeita em vez de arriscar
        # valores inventados.
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


def _linear_numerator_fraction_text(coeff: Expr, symbol: Symbol, factor_expr: Expr, power: int) -> str:
    """"{|coeficiente|}*{symbol}/{fator}" — mesma técnica de
    `_fraction_magnitude_text`, generalizada para a peça `coeficiente*x/
    fator**potência` (metade `Bx` de um numerador quadrático já separada
    da metade constante `C`, ver `_integration_pieces`)."""
    magnitude = -coeff if coeff.could_extract_minus_sign() else coeff
    base_text = wrap_if_sum(factor_expr)
    denom_text = base_text if power == 1 else f"{base_text}**{power}"
    if magnitude == 1:
        return f"{symbol}/{denom_text}"
    magnitude_text = f"({magnitude})" if getattr(magnitude, "q", 1) != 1 else str(magnitude)
    return f"{magnitude_text}*{symbol}/{denom_text}"


def _quadratic_fraction_text(
    b_value: Expr, c_value: Expr, factor_expr: Expr, power: int, symbol: Symbol
) -> str:
    """"({numerador})/{fator}" para o termo COMBINADO `(Bx+C)/fator` —
    usado só nos passos "Montando as frações parciais"/"Substituindo"
    (mostrar o ansatz/decomposição como o usuário reconheceria da teoria),
    nunca no cálculo da integral (que separa `Bx` e `C` em peças
    atômicas, ver `_integration_pieces`, exatamente para evitar a
    ambiguidade de sinal de somar ln+atan como um bloco só)."""
    numerator_terms = [term for term in (b_value * symbol, c_value) if term != 0]
    numerator_text = signed_terms_text(numerator_terms) if numerator_terms else "0"
    base_text = wrap_if_sum(factor_expr)
    denom_text = base_text if power == 1 else f"{base_text}**{power}"
    return f"({numerator_text})/{denom_text}"


def _decomposed_term_piece(
    coeff_symbols: tuple[Symbol, ...],
    factor_expr: Expr,
    power: int,
    solution: dict[Symbol, Expr],
    symbol: Symbol,
    *,
    is_first: bool,
) -> str:
    """Um pedaço "{sinal}{fração}" do passo "Substituindo" — fator linear
    reaproveita `_fraction_magnitude_text` com sinal extraído por fora
    (mesmo comportamento da V2.16); fator quadrático usa
    `_quadratic_fraction_text` (já parenteticamente autocontido — nunca
    tenta extrair um sinal único de um numerador de sinal misto)."""
    if len(coeff_symbols) == 1:
        value = solution[coeff_symbols[0]]
        sign = _term_sign(value, is_first=is_first)
        text = _fraction_magnitude_text(value, factor_expr, power)
        return f"{sign}{text}"
    b_value, c_value = solution[coeff_symbols[0]], solution[coeff_symbols[1]]
    text = _quadratic_fraction_text(b_value, c_value, factor_expr, power, symbol)
    sign = "" if is_first else "+"
    return f"{sign}{text}"


def _integration_pieces(
    terms: list[_Term], solution: dict[Symbol, Expr], symbol: Symbol
) -> list[_IntegrationPiece]:
    """Lista de peças INTEGRÁVEIS ATOMICAMENTE — um fator LINEAR
    contribui uma peça (`valor/fator**potência`); um fator QUADRÁTICO
    contribui até duas peças JÁ SEPARADAS (`B*x/fator` e `C/fator`,
    omitindo qualquer uma cujo coeficiente resolvido seja zero — nunca
    mostra um termo "+0/fator" vazio). Ver docstring do módulo para o
    motivo de nunca integrar `(Bx+C)/fator` como um bloco só."""
    pieces: list[_IntegrationPiece] = []
    for coeff_symbols, factor_expr, power, _rest in terms:
        if len(coeff_symbols) == 1:
            value = solution[coeff_symbols[0]]
            pieces.append(_IntegrationPiece(value, 1 / factor_expr**power, "constant", factor_expr, power))
        else:
            b_value, c_value = solution[coeff_symbols[0]], solution[coeff_symbols[1]]
            if b_value != 0:
                pieces.append(
                    _IntegrationPiece(b_value, symbol / factor_expr**power, "linear", factor_expr, power)
                )
            if c_value != 0:
                pieces.append(
                    _IntegrationPiece(c_value, 1 / factor_expr**power, "constant", factor_expr, power)
                )
    return pieces


def _piece_display_text(piece: _IntegrationPiece, symbol: Symbol) -> str:
    if piece.kind == "constant":
        return _fraction_magnitude_text(piece.value, piece.factor_expr, piece.power)
    return _linear_numerator_fraction_text(piece.value, symbol, piece.factor_expr, piece.power)


def _quadratic_recognition_step(quadratic_factors: list[Expr], symbol: Symbol) -> MathStep:
    """Passo pedagógico condicional (só aparece quando o plano tem um
    fator quadrático) explicando POR QUE o numerador desse fator precisa
    ser `Bx+C` em vez de só uma constante — nunca aparece para os casos
    puramente lineares da V2.16 (preserva os 10 títulos originais
    intocados, ver `_decomposition_body`)."""
    factors_text = ", ".join(_rename_natural_log(str(factor_expr)) for factor_expr in quadratic_factors)
    return MathStep(
        title="Reconhecendo fator quadrático irredutível",
        explanation=(
            "Este fator não se divide em fatores lineares reais, então seu "
            "numerador na decomposição precisa ser da forma B*x+C, nunca só "
            "uma constante."
        ),
        expression=_rename_natural_log(factors_text),
    )


def _decomposition_body(
    numer: Expr,
    denom: Expr,
    leading: Expr,
    factors_with_mult: list[tuple[Expr, int]],
    symbol: Symbol,
    display_expr: Expr,
) -> tuple[list[MathStep], list[_IntegrationPiece]]:
    """Passos "Fatorando o denominador" até "Substituindo" — núcleo
    reaproveitado tanto por `generate_partial_fraction_steps` quanto por
    `polynomial_division.generate_polynomial_division_steps` (para a
    parte resto(x)/D(x) de uma fração imprópria). NÃO inclui "Integral
    original"/"Identificando..." (específicos de cada chamador) nem a
    integração final (o chamador decide como juntar as peças devolvidas
    com o resto do que precisa integrar — só R(x)/D(x) aqui, ou também
    Q(x) no caso da divisão). `display_expr` é o que aparece do lado
    esquerdo do "=" nos passos "Montando"/"Substituindo" — nunca
    recalculado como `numer/denom` (que poderia imprimir diferente do
    texto que o usuário digitou/do resto já calculado pelo chamador)."""
    steps: list[MathStep] = [
        MathStep(title="Fatorando o denominador", expression=_rename_natural_log(str(denom)))
    ]

    quadratic_factors = [
        factor_expr for factor_expr, _m in factors_with_mult if degree(factor_expr, symbol) == 2
    ]
    if quadratic_factors:
        steps.append(_quadratic_recognition_step(quadratic_factors, symbol))

    terms = _build_terms(denom, leading, factors_with_mult, symbol)
    ansatz = sum(
        _term_numerator_expr(coeff_symbols, symbol) / factor_expr**power
        for coeff_symbols, factor_expr, power, _rest in terms
    )
    steps.append(
        MathStep(
            title="Montando as frações parciais",
            expression=_rename_natural_log(f"{display_expr}={ansatz}"),
        )
    )

    cleared_lhs, _cleared_rhs, solution = _solve_coefficients(numer, denom, leading, terms, symbol)
    unexpanded_rhs = "+".join(
        f"{wrap_if_sum(_term_numerator_expr(coeff_symbols, symbol))}*({rest})"
        for coeff_symbols, _f, _p, rest in terms
    )
    steps.append(
        MathStep(
            title="Eliminando os denominadores",
            expression=_rename_natural_log(f"{cleared_lhs}={unexpanded_rhs}"),
        )
    )

    all_coeff_values = [(coeff, solution[coeff]) for coeff_symbols, _f, _p, _r in terms for coeff in coeff_symbols]
    steps.append(
        MathStep(
            title="Determinando os coeficientes",
            expression=_rename_natural_log(", ".join(f"{c}={v}" for c, v in all_coeff_values)),
        )
    )

    decomposed = sum(
        _term_numerator_expr(coeff_symbols, symbol).subs(solution) / factor_expr**power
        for coeff_symbols, factor_expr, power, _r in terms
    )
    if simplify(numer / denom - decomposed) != 0:
        # Mesma defesa de `_solve_coefficients`: nunca deveria disparar no
        # escopo comprovado desta versão. O produto nunca apresenta uma
        # decomposição que não seja exatamente equivalente à original.
        raise ExpressionError(UNSUPPORTED_INTEGRAL_MESSAGE)

    substituting_text = "".join(
        _decomposed_term_piece(coeff_symbols, factor_expr, power, solution, symbol, is_first=index == 0)
        for index, (coeff_symbols, factor_expr, power, _r) in enumerate(terms)
    )
    steps.append(
        MathStep(
            title="Substituindo",
            expression=_rename_natural_log(f"{display_expr}={substituting_text}"),
        )
    )

    pieces = _integration_pieces(terms, solution, symbol)
    return steps, pieces


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

    body_steps, pieces = _decomposition_body(numer, denom, leading, factors_with_mult, symbol, expr)
    steps.extend(body_steps)

    integral_text = "".join(
        f"{_term_sign(piece.value, is_first=index == 0)}integral({_piece_display_text(piece, symbol)}, {symbol})"
        for index, piece in enumerate(pieces)
    )
    steps.append(MathStep(title="Separando a integral", expression=_rename_natural_log(integral_text)))

    per_piece_antiderivatives = [
        piece.value * compute_indefinite_integral(piece.base_integrand, symbol) for piece in pieces
    ]
    steps.append(
        MathStep(
            title="Integrando",
            expression=_rename_natural_log(signed_terms_text(per_piece_antiderivatives)),
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
