"""Sprint V2.18 — passo a passo de divisão polinomial para integrar
frações racionais IMPRÓPRIAS (`grau(numerador) >= grau(denominador)`)
antes de aplicar frações parciais: `p(x)/q(x) = Q(x) + r(x)/q(x)` (divisão
euclidiana real via `sympy.div`), depois `Q(x)` é integrado pela regra da
potência/linearidade já existente (reaproveitando `calculus/integrals.py:
compute_indefinite_integral`, nunca uma regra escrita à mão) e, quando
`r(x)/q(x)` ainda não é uma fração elementar, sua decomposição em frações
parciais reaproveita INTEGRALMENTE `partial_fractions.py`
(`_decomposition_body`/`_integration_pieces` — a MESMA função que
`generate_partial_fraction_steps` já usa, nunca uma cópia) — "fluxo
pedagógico coerente", nunca dois sistemas desconectados como o ticket da
V2.18 pediu explicitamente.

Detecção via ÁRVORE do SymPy: reaproveita `partial_fractions._rational_
parts` (mesma exclusão de `e^x/(x+1)`, `sen(x)/(x+1)`, `ln(x)/(x+1)`,
`x/sen(x)` — nenhum é fração POLINOMIAL genuína) e só then compara graus.
A divisão em si usa `sympy.div(numer, denom, symbol)` (devolve quociente E
resto numa única chamada, evitando computar `quo`/`rem` separadamente) e
todo resultado é verificado simbolicamente (`simplify(numer - (denom*
quociente+resto)) == 0`) antes de qualquer passo ser apresentado.

Três formas para a parte fracionária `r(x)/q(x)` depois da divisão (nunca
decidido por string, sempre por estrutura):

1. Resto ZERO (ex. `(x³+1)/(x+1)`, Exemplo 2 do ticket): a divisão é
   exata, então a fração não aparece em NENHUM passo — "não forçar
   frações parciais quando resto=0" é literal, o passo "Separando a
   integral" nem aparece (não há nada pra separar de um termo só).
2. `q(x)` tem um ÚNICO fator (ex. `(x²+1)/(x+1)`, Exemplo 1 do ticket,
   onde `q(x)=x+1` já é ele mesmo): `r(x)/q(x)` já É sua própria forma
   elementar (mesmo raciocínio de `partial_fractions.find_partial_
   fractions` para `1/(x+1)²` sozinho — decompor um único fator seria
   pedagogicamente vazio), integrada diretamente por `compute_indefinite_
   integral` sem nenhum passo de "Montando as frações parciais".
3. `q(x)` tem 2+ fatores suportados (ex. Exemplo 3 do ticket): reaproveita
   `partial_fractions._decomposition_body` para gerar os mesmos passos
   "Fatorando o denominador" → "Substituindo" que `partial_fractions.py`
   já usa, agora sobre `(r(x), q(x))` em vez do numerador/denominador
   originais.

Qualquer outra forma de `q(x)` (fator de grau >= 3, múltiplos fatores
quadráticos — o mesmo escopo já recusado por `partial_fractions.py`)
devolve `None`: `find_polynomial_division` nunca reivindica o caso, e
`steps/dispatcher.py` cai adiante na cascata até o fallback amigável
genérico — nunca uma mensagem dedicada nem um erro interno."""
from __future__ import annotations

import re
from typing import NamedTuple

from sympy import degree, div, factor_list, simplify
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..calculus.dispatcher import parse_integral_call
from ..calculus.integrals import compute_indefinite_integral
from ..errors import ExpressionError
from .formatting import INTEGRATION_CONSTANT_EXPLANATION, signed_terms_text, wrap_if_sum
from .models import MathStep
from .partial_fractions import (
    _IntegrationPiece,
    _decomposition_body,
    _piece_display_text,
    _rational_parts,
    _term_sign,
    find_partial_fractions,
)
from .validation import UNSUPPORTED_INTEGRAL_MESSAGE

_NATURAL_LOG_PATTERN = re.compile(r"\blog(?=\()")


def _rename_natural_log(text: str) -> str:
    return _NATURAL_LOG_PATTERN.sub("ln", text)


class _DivisionPlan(NamedTuple):
    numer: Expr
    denom: Expr
    quotient: Expr
    remainder: Expr
    # "none" (resto=0) | "atomic" (fração já elementar) | "decompose"
    # (reaproveita partial_fractions._decomposition_body)
    fraction_kind: str
    fraction_plan: tuple[Expr, Expr, Expr, list[tuple[Expr, int]]] | None


def find_polynomial_division(expr: Expr, symbol: Symbol) -> _DivisionPlan | None:
    """Plano de divisão se `expr` for uma fração racional genuína (ver
    `partial_fractions._rational_parts`) IMPRÓPRIA. `None` para: não ser
    fração racional, ser PRÓPRIA (pertence a `partial_fractions.py`), ou
    a parte fracionária do resultado cair numa forma fora de escopo
    (fator grau >= 3, múltiplos quadráticos) — nesse último caso a
    divisão em si é válida, mas esta versão não sabe apresentar a
    decomposição da parte fracionária, então prefere recusar o caso
    inteiro a mostrar um resultado pela metade."""
    parts = _rational_parts(expr, symbol)
    if parts is None:
        return None
    numer, denom = parts
    if degree(numer, symbol) < degree(denom, symbol):
        return None

    quotient, remainder = div(numer, denom, symbol)
    if simplify(numer - (denom * quotient + remainder)) != 0:
        # Defesa: nunca deveria disparar (identidade de divisão euclidiana
        # é garantida pelo próprio `sympy.div`), mas nunca arrisca mostrar
        # uma divisão incorreta.
        return None

    if remainder == 0:
        return _DivisionPlan(numer, denom, quotient, remainder, "none", None)

    fraction_expr = remainder / denom
    fraction_plan = find_partial_fractions(fraction_expr, symbol)
    if fraction_plan is not None:
        return _DivisionPlan(numer, denom, quotient, remainder, "decompose", fraction_plan)

    _, factors_with_mult = factor_list(denom, symbol)
    if len(factors_with_mult) < 2:
        return _DivisionPlan(numer, denom, quotient, remainder, "atomic", None)

    # Denominador com 2+ fatores mas fora do escopo de
    # `partial_fractions.py` (fator grau >= 3, múltiplos quadráticos) —
    # nunca finge decompor, devolve None e deixa a cascata do dispatcher
    # seguir até o fallback amigável genérico.
    return None


def _rewritten_integrand_text(quotient: Expr, remainder: Expr, denom: Expr) -> str:
    """"Q(x)" (resto zero) ou "Q(x)+R(x)/D(x)" — construído por texto
    porque `quotient + remainder/denom` como objeto SymPy se auto-combina
    de formas imprevisíveis (mesma lição de `_fraction_magnitude_text`:
    nunca deixar o printer decidir a apresentação de uma soma que precisa
    ficar visualmente estável)."""
    if remainder == 0:
        return str(quotient)
    denom_text = wrap_if_sum(denom)
    if remainder.could_extract_minus_sign():
        magnitude, sign = -remainder, "-"
    else:
        magnitude, sign = remainder, "+"
    magnitude_text = wrap_if_sum(magnitude)
    return f"{quotient}{sign}{magnitude_text}/{denom_text}"


def _division_identity_text(numer: Expr, denom: Expr, quotient: Expr, remainder: Expr) -> str:
    """"numerador=denominador*quociente+resto" (ou sem o "+resto" quando
    resto=0) — a verificação P=D*Q+R que o ticket exige mostrar
    explicitamente, nunca só afirmar."""
    denom_text = wrap_if_sum(denom)
    quotient_text = wrap_if_sum(quotient)
    if remainder == 0:
        return f"{numer}={denom_text}*{quotient_text}"
    if remainder.could_extract_minus_sign():
        magnitude, sign = -remainder, "-"
    else:
        magnitude, sign = remainder, "+"
    return f"{numer}={denom_text}*{quotient_text}{sign}{magnitude}"


def generate_polynomial_division_steps(text: str) -> list[MathStep]:
    expr, symbol = parse_integral_call(text)
    steps = [
        MathStep(
            title="Integral original",
            expression=_rename_natural_log(f"integral({expr}, {symbol})"),
        )
    ]

    plan = find_polynomial_division(expr, symbol)
    if plan is None:
        # Nunca deveria acontecer no fluxo normal — `steps/dispatcher.py`
        # só chama esta função quando `find_polynomial_division` já
        # confirmou a forma. Defesa contra uso indevido direto do módulo.
        raise ExpressionError(UNSUPPORTED_INTEGRAL_MESSAGE)
    numer, denom, quotient, remainder, fraction_kind, fraction_plan = plan

    numer_degree = degree(numer, symbol)
    denom_degree = degree(denom, symbol)
    steps.append(
        MathStep(
            title="Identificando uma fração imprópria",
            explanation=(
                f"O grau do numerador ({numer_degree}) é maior ou igual ao "
                f"grau do denominador ({denom_degree}), então é preciso "
                "dividir os polinômios antes de integrar."
            ),
            expression=_rename_natural_log(str(expr)),
        )
    )
    steps.append(
        MathStep(
            title="Dividindo os polinômios",
            explanation="Q é o quociente e R é o resto da divisão.",
            expression=_rename_natural_log(f"Q={quotient}, R={remainder}"),
        )
    )
    steps.append(
        MathStep(
            title="Verificando a divisão",
            expression=_rename_natural_log(_division_identity_text(numer, denom, quotient, remainder)),
        )
    )
    steps.append(
        MathStep(
            title="Reescrevendo a integral",
            expression=_rename_natural_log(f"{expr}={_rewritten_integrand_text(quotient, remainder, denom)}"),
        )
    )

    # (sinal, texto_de_exibição, integrando_base) de cada peça a integrar
    # DEPOIS de Q(x) — vazio quando resto=0 ("não forçar frações
    # parciais"), um único bloco quando D(x) tem um único fator (a fração
    # já é sua forma elementar), ou reaproveita `partial_fractions.
    # _decomposition_body` quando D(x) precisa de decomposição de verdade.
    fraction_pieces: list[_IntegrationPiece] = []
    if fraction_kind == "decompose":
        assert fraction_plan is not None
        _f_numer, _f_denom, leading, factors_with_mult = fraction_plan
        body_steps, fraction_pieces = _decomposition_body(
            remainder, denom, leading, factors_with_mult, symbol, remainder / denom
        )
        steps.extend(body_steps)

    if fraction_kind == "none":
        antiderivatives = [compute_indefinite_integral(quotient, symbol)]
    elif fraction_kind == "atomic":
        fraction_expr = remainder / denom
        integral_text = f"integral({quotient}, {symbol})+integral({wrap_if_sum(remainder)}/{wrap_if_sum(denom)}, {symbol})"
        steps.append(MathStep(title="Separando a integral", expression=_rename_natural_log(integral_text)))
        antiderivatives = [
            compute_indefinite_integral(quotient, symbol),
            compute_indefinite_integral(fraction_expr, symbol),
        ]
    else:
        piece_terms = "".join(
            f"{_term_sign(piece.value, is_first=False)}integral({_piece_display_text(piece, symbol)}, {symbol})"
            for piece in fraction_pieces
        )
        integral_text = f"integral({quotient}, {symbol}){piece_terms}"
        steps.append(MathStep(title="Separando a integral", expression=_rename_natural_log(integral_text)))
        antiderivatives = [compute_indefinite_integral(quotient, symbol)] + [
            piece.value * compute_indefinite_integral(piece.base_integrand, symbol) for piece in fraction_pieces
        ]

    steps.append(
        MathStep(
            title="Integrando",
            expression=_rename_natural_log(signed_terms_text(antiderivatives)),
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
