"""Sprint V2.12.2 — passo a passo da Regra de L'Hôpital, o ÚLTIMO recurso
da cascata de limites (substituição direta/fatoração-cancelamento/
comparação de graus da V2.12, depois limites trigonométricos fundamentais
da V2.12.1, só então L'Hôpital). Escopo: indeterminações 0/0 (ponto
finito) e ∞/∞ (`x→∞`).

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
fica correta mesmo se chamada isoladamente).

Sprint "L'Hôpital com Aplicações Sucessivas" — a versão anterior aplicava
a regra UMA única vez e rejeitava com uma mensagem amigável dedicada
(`UNSUPPORTED_LHOPITAL_MULTIPLE_APPLICATIONS_MESSAGE`, agora removida) se
o novo quociente ainda fosse indeterminado. A limitação nunca foi
matemática — `compute_limit(expr, symbol, point)` (o motor real) SEMPRE
soube resolver esses casos via `/solve`, `generate_lhopital_steps` só não
sabia CONTINUAR apresentando passos além da primeira derivada. Esta
sprint generaliza `generate_lhopital_steps` para um laço controlado
("enquanto a forma atual for 0/0 ou ∞/∞: derivar numerador e denominador,
registrar o passo, reavaliar"), com dois limites defensivos —
`MAX_LHOPITAL_APPLICATIONS` (teto fixo de iterações) e detecção de ciclo
(o mesmo par numerador/denominador reaparecendo) — para nunca entrar em
loop infinito nem produzir um passo matematicamente falso.

Distinção crítica entre duas checagens de indeterminação que pareciam a
mesma coisa antes desta sprint: `is_lhopital_shape` (usada só pelo
dispatcher, UMA vez, para decidir SE esta é a engine certa) também exige
que a razão NÃO seja inteiramente polinomial e que
`is_trigonometric_fundamental_shape` não a tenha reivindicado antes —
essas duas exigências fazem sentido SÓ para a decisão de roteamento
inicial (evitar roubar casos das engines mais didáticas). Dentro do
laço, depois da primeira aplicação, um quociente de derivadas PODE virar
inteiramente polinomial (ex. `x²/eˣ` deriva para `2x/eˣ`, ainda
transcendental, mas `(3x²+2x)/(x²-1)` testado diretamente nesta engine
deriva para `(6x+2)/(2x)`, já polinomial) e ainda assim continuar
indeterminado — por isso o laço usa `_is_indeterminate_ratio`, a mesma
checagem 0/0 ou ∞/∞ SEM as duas exigências extras, evitando que o laço
pare cedo demais só porque a forma "parece" com algo que outra engine
resolveria fora deste fluxo."""
from __future__ import annotations

from sympy import oo
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ...canonical_constants import canonicalize_euler_constant
from ..calculus.derivatives import compute_derivative
from ..calculus.dispatcher import parse_limit_call
from ..calculus.limits import compute_limit
from ..errors import ExpressionError
from .formatting import substitute_symbol_text
from .models import MathStep
from .trigonometric_limits import is_trigonometric_fundamental_shape
from .validation import (
    LHOPITAL_CYCLE_DETECTED_MESSAGE,
    LHOPITAL_MAX_APPLICATIONS_MESSAGE,
    LHOPITAL_UNDEFINED_DERIVATIVE_MESSAGE,
)

_LHOPITAL_EXPLANATION = (
    "A Regra de L'Hôpital diz que, se lim f(x)/g(x) resulta em 0/0 ou ∞/∞ e f e g "
    "são deriváveis, então lim f(x)/g(x) = lim f'(x)/g'(x), desde que esse novo "
    "limite exista."
)

# Sprint "L'Hôpital com Aplicações Sucessivas" — teto defensivo do laço.
# Justificativa: o caso obrigatório mais exigente do ticket (seção 33,
# "stress test") precisa de 4 aplicações; nenhum exemplo pedagógico real
# de um curso de Cálculo 1 precisa de mais do que isso. 8 dá folga
# confortável (o dobro do stress test) sem abrir espaço para uma cadeia
# de passos gigantesca e ilegível — se uma expressão genuína precisar de
# mais que 8 aplicações para resolver a indeterminação, é muito mais
# provável que seja uma forma fora do escopo desta versão (ou uma
# oscilação/ciclo) do que um exercício didático real; nesses casos,
# `LHOPITAL_MAX_APPLICATIONS_MESSAGE` é a resposta correta, nunca uma
# resposta inventada ou um travamento.
MAX_LHOPITAL_APPLICATIONS = 8


def _is_indeterminate_ratio(numer: Expr, denom: Expr, symbol: Symbol, point: Expr) -> bool:
    """Núcleo da classificação "isto ainda é 0/0 ou ∞/∞?" — usado tanto
    pela decisão de roteamento (`is_lhopital_shape`, com exigências EXTRAS
    só cabíveis ali) quanto pelo laço interno de `generate_lhopital_steps`
    (sem elas — ver docstring do módulo). Único ponto que decide isto;
    nunca duplicado."""
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


def is_lhopital_shape(expr: Expr, symbol: Symbol, point: Expr) -> bool:
    """Sprint V2.12.2 — usada por `steps/dispatcher.py` para decidir o
    roteamento DEPOIS de `is_trigonometric_fundamental_shape` e SEM
    sobreposição com o caminho racional da V2.12 (que exige numerador E
    denominador polinomiais — aqui exige-se o oposto). Estas duas
    exigências (nunca polinomial-polinomial, nunca já reivindicado pelos
    limites trigonométricos fundamentais) são específicas da decisão de
    ENTRADA na engine — depois de já estar dentro do laço de aplicações
    sucessivas, `_is_indeterminate_ratio` (sem elas) é quem decide se uma
    nova aplicação é válida."""
    if is_trigonometric_fundamental_shape(expr, symbol, point):
        return False

    numer, denom = expr.as_numer_denom()
    if numer.is_polynomial(symbol) and denom.is_polynomial(symbol):
        return False

    return _is_indeterminate_ratio(numer, denom, symbol, point)


def generate_lhopital_steps(text: str) -> list[MathStep]:
    expr, symbol, point = parse_limit_call(text)
    steps = [MathStep(title="Expressão original", expression=f"limite({expr}, {symbol}, {point})")]

    current_numer, current_denom = expr.as_numer_denom()
    indeterminate_text = "oo/oo" if point == oo else "0/0"

    steps.append(MathStep(title="Substituindo o limite", expression=indeterminate_text))
    steps.append(
        MathStep(
            title="Reconhecemos uma forma indeterminada.",
            expression=indeterminate_text,
            explanation=_LHOPITAL_EXPLANATION,
        )
    )

    seen_pairs = {(current_numer, current_denom)}
    diff_numer: Expr | None = None
    diff_denom: Expr | None = None

    for application in range(1, MAX_LHOPITAL_APPLICATIONS + 1):
        # Hotfix V2.12.2a — canonicaliza IMEDIATAMENTE após calcular (nunca
        # dentro de `compute_derivative`, que continua intocado): se o
        # usuário digitou o símbolo solto "e" em vez de `exp(...)`, a
        # derivada real traz "log(e)" (SymPy não sabe que esse "e" é
        # Euler) — puramente uma questão de apresentação, corrigida ANTES
        # de qualquer string ser construída a partir destes valores.
        diff_numer = canonicalize_euler_constant(compute_derivative(current_numer, symbol))
        diff_denom = canonicalize_euler_constant(compute_derivative(current_denom, symbol))

        if diff_denom == 0:
            raise ExpressionError(LHOPITAL_UNDEFINED_DERIVATIVE_MESSAGE)

        steps.append(MathStep(title="Derivando o numerador", expression=str(diff_numer)))
        steps.append(MathStep(title="Derivando o denominador", expression=str(diff_denom)))
        steps.append(
            MathStep(
                title="Aplicando a Regra de L'Hôpital (novo limite)",
                expression=f"limite({diff_numer}/{diff_denom}, {symbol}, {point})",
            )
        )

        if not _is_indeterminate_ratio(diff_numer, diff_denom, symbol, point):
            break

        pair = (diff_numer, diff_denom)
        if pair in seen_pairs:
            raise ExpressionError(LHOPITAL_CYCLE_DETECTED_MESSAGE)
        seen_pairs.add(pair)
        current_numer, current_denom = diff_numer, diff_denom

        new_indeterminate_text = "oo/oo" if point == oo else "0/0"
        steps.append(
            MathStep(
                title=(
                    f"A expressão continua na forma {new_indeterminate_text}. "
                    "Aplicamos L'Hôpital novamente."
                ),
                expression=new_indeterminate_text,
            )
        )
    else:
        raise ExpressionError(LHOPITAL_MAX_APPLICATIONS_MESSAGE)

    if point != oo:
        numer_text = substitute_symbol_text(diff_numer, symbol, point)
        if diff_denom == 1:
            substituted_text = numer_text
        else:
            denom_text = substitute_symbol_text(diff_denom, symbol, point)
            substituted_text = f"{numer_text}/({denom_text})"
        steps.append(MathStep(title="Substituindo", expression=substituted_text))

    result = canonicalize_euler_constant(compute_limit(expr, symbol, point))
    steps.append(MathStep(title="Calculando", expression=str(result)))
    return steps
