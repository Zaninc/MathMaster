r"""Sprint "Derivação Implícita" — passo a passo para `derivada(EQUAÇÃO, x)`
onde EQUAÇÃO depende de x e de exatamente uma segunda variável (y=y(x)
implícito). Camada puramente didática, no MESMO espírito de
`derivatives.py`/`advanced_derivatives.py`/`quotient_rule.py`: NUNCA um
segundo motor de derivadas — reaproveita a MESMA infraestrutura
(`compute_derivative`, `factor_derivative_steps`, `quotient_rule_steps`,
`is_quotient_shape`) para calcular e apresentar CADA termo da equação
diferenciada; este módulo só decide COMO (a) representar a variável
dependente como uma `Function` de x para que `sympy.diff` produza
`Derivative(y(x), x)` automaticamente em vez de tratar "y" como
constante, (b) isolar esse `Derivative(y(x), x)` algebricamente (nunca
via `solve()` como caixa-preta — ver `_isolate_derivative` abaixo) e
(c) traduzir `y(x)`/`Derivative(y(x), x)` de volta para a notação
"y"/"derivada(y, x)" que o resto do produto já sabe renderizar
(`to-latex.ts`, ver `_rename_implicit_text`).

Representação interna da variável dependente — decisão validada
empiricamente (nunca assumida): substituí-la por uma `sympy.Function`
aplicada (`Function(nome)(x)`) ANTES de qualquer chamada às funções de
`steps/` já existentes faz com que TODA a maquinária de derivadas já
existente (regra da potência/produto/cadeia/quociente) funcione
automaticamente para termos com essa variável, sem NENHUMA modificação
nelas: `sympy.diff(y(x)**2, x)` já devolve `2*y(x)*Derivative(y(x), x)`
nativamente, `_chain_shape`/`_product_shape` (`advanced_derivatives.py`)
já reconhecem `y(x)**2` como cadeia e `x*y(x)` como produto sem saber
nada sobre "derivação implícita" — só enxergam mais uma função composta/
mais um produto de dois fatores dependendo de x.

Isolamento de `Derivative(y(x), x)` — decisão TAMBÉM validada
empiricamente: `linear_equations.reduce_to_value` (reaproveitada em toda
outra parte do produto para isolar uma incógnita) foi tentada primeiro,
mas falha silenciosamente sempre que o lado com a derivada tem MAIS DE UM
termo contendo `Derivative(y(x), x)` com coeficientes SIMBÓLICOS distintos
(ex. `x*D + 2*y(x)*D`, do caso `x²+xy+y²=7`) — `.as_independent(D,
as_Add=False)` não FATORA uma soma desse tipo (só funciona quando os
termos com D já colapsaram numa única `Mul` antes de chegar ali, o que
sempre acontece numa equação linear comum em UMA incógnita numérica, mas
nunca aqui). `.coeff(D)`, ao contrário, fatora corretamente qualquer soma
de termos em D — confirmado comparando os 13 casos do ticket (8
obrigatórios + 5 de hardening) contra o oráculo `sympy.idiff` antes de
escrever este módulo. Por isso `_isolate_derivative` é uma função NOVA e
pequena (nunca reaproveita `reduce_to_value`).

Notação de apresentação — a notação de Leibniz "dy/dx" pura, embutida
como texto solto tipo "2*y*dy/dx", foi tentada e rejeitada empiricamente: o
pipeline `to-latex.ts` tokeniza "dy"/"dx" como identificadores multi-letra
comuns, produzindo `\frac{2\cdot y\cdot dy}{dx}` — "dy" colado sem
separação visual do fator anterior, o mesmo tipo de artefato de leitura
que o ticket pede para evitar). `to-latex.ts` já reconhece nativamente o
nó de 2 argumentos `derivada(corpo, variável)` e o renderiza como
`\frac{d}{dx}\left(corpo\right)` — usado em TODO passo a passo de
derivada já existente no produto — por isso a notação escolhida aqui é
`derivada(y, x)` (equivalente matemático da notação de Leibniz, mesma
biblioteca de renderização já testada em produção, zero mudança no
frontend).

Hardening Global — a detecção da variável dependente e o parsing da
equação (`parse_implicit_equation`) e o cálculo/verificação do valor
final (`compute_implicit_derivative`) foram promovidos para `calculus/
implicit_differentiation.py`, reaproveitados aqui E por `calculus/
dispatcher.py` (que passou a suportar `derivada(EQUAÇÃO, x)` em `/solve`
nesta mesma rodada — antes só `/solve/steps` sabia lidar com isso, bug
real encontrado testando a nova tecla "dy/dx" no navegador). Este módulo
continua com sua própria maquinária de PASSOS (diferenciação termo a
termo com `factor_derivative_steps`/`quotient_rule_steps`, isolamento via
`_isolate_derivative`) — o valor final é sempre conferido contra
`compute_implicit_derivative` (que já verifica contra `sympy.idiff`
internamente) antes de devolver, nunca duas implementações divergentes
do mesmo cálculo."""
from __future__ import annotations

import re

from sympy import Derivative, Function, Symbol, expand, simplify
from sympy.core.expr import Expr

from ..calculus.derivatives import compute_derivative
from ..calculus.implicit_differentiation import (
    NO_DEPENDENT_VARIABLE_MESSAGE,
    compute_implicit_derivative,
    looks_like_implicit_derivative_argument,
    parse_implicit_equation,
    rename_implicit_derivative_text,
)
from ..equations.dispatcher import looks_like_inequality
from ..errors import ExpressionError
from .advanced_derivatives import factor_derivative_steps
from .formatting import eq_text, linear_combination_expression
from .models import MathStep
from .quotient_rule import is_quotient_shape, quotient_rule_steps
from .validation import UNSUPPORTED_IMPLICIT_DIFFERENTIATION_MESSAGE, UNSUPPORTED_INEQUALITY_MESSAGE

# Mesma técnica de regex/bracket-counting de `calculus/dispatcher.py`
# (`_CALL_PATTERN`/`_split_top_level_args`/`_parse_variable`), duplicada
# aqui deliberadamente — convenção já estabelecida em `steps/` (ver
# `quotient_rule._NATURAL_LOG_PATTERN`) de que cada módulo é self-contained
# em vez de importar helpers privados de módulos irmãos. Restrita à
# operação "derivada" (nunca "integral"/"limite" — fora de escopo aqui).
_CALL_PATTERN = re.compile(r"^\s*derivada\s*\((.*)\)\s*$", re.DOTALL)
_VARIABLE_PATTERN = re.compile(r"^[a-zA-Z_]\w*$")


def _split_derivative_call(text: str) -> tuple[str, str] | None:
    match = _CALL_PATTERN.match(text)
    if not match:
        return None
    parts = _split_top_level_args(match.group(1))
    if len(parts) != 2:
        return None
    return parts[0].strip(), parts[1].strip()


def _split_top_level_args(text: str) -> list[str]:
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    for char in text:
        if char in "([{":
            depth += 1
        elif char in ")]}":
            depth -= 1
        if char == "," and depth == 0:
            parts.append("".join(current))
            current = []
            continue
        current.append(char)
    parts.append("".join(current))
    return [part.strip() for part in parts]


def _parse_variable(text: str) -> Symbol:
    if not _VARIABLE_PATTERN.match(text):
        raise ExpressionError(f"Nome de variável inválido: '{text}'.")
    return Symbol(text)


def is_implicit_differentiation_call(text: str) -> bool:
    """Sprint "Derivação Implícita" — usada por `steps/dispatcher.py` para
    decidir o roteamento ANTES de `parse_derivative_call` (que rejeitaria
    o "=" com um erro genérico). Só verifica a FORMA textual (é
    `derivada(...)` de 2 argumentos cujo primeiro parece uma equação) —
    nunca lança, nunca decide se a equação é de fato suportada (isso é
    responsabilidade de `generate_implicit_differentiation_steps`, que
    dá mensagens amigáveis dedicadas para cada motivo de rejeição)."""
    parts = _split_derivative_call(text)
    if parts is None:
        return False
    expr_text, _ = parts
    return looks_like_implicit_derivative_argument(expr_text)


def _term_derivative_steps(
    term: Expr, x_symbol: Symbol, y_func: Expr
) -> tuple[Expr, list[MathStep]]:
    """Derivada de UM termo da equação já diferenciada termo a termo —
    delega inteiramente para a maquinária existente (regra do quociente
    se o termo for uma razão de verdade dependendo de x, senão a mesma
    `factor_derivative_steps` que já decide sozinha entre regra da
    cadeia/produto/caso trivial). Nunca decide nada matematicamente novo
    aqui; só escolhe QUAL motor já existente chamar."""
    if not term.has(x_symbol) and not term.has(y_func):
        return term * 0, [MathStep(title="A derivada de uma constante é zero", expression="0")]

    quotient = is_quotient_shape(term, x_symbol)
    if quotient is not None:
        numer, denom = quotient
        return quotient_rule_steps(term, numer, denom, x_symbol)

    label = str(term).replace("**", "^")
    return factor_derivative_steps(term, x_symbol, label)


def _differentiate_side(expr: Expr, x_symbol: Symbol, y_func: Expr) -> tuple[Expr, list[MathStep]]:
    terms = expand(expr).as_ordered_terms()
    steps: list[MathStep] = []
    if len(terms) > 1:
        steps.append(
            MathStep(
                title="Aplicando a linearidade da derivada",
                expression=linear_combination_expression(terms, x_symbol, "derivada"),
            )
        )
    for term in terms:
        _, term_steps = _term_derivative_steps(term, x_symbol, y_func)
        steps.extend(term_steps)

    total = compute_derivative(expr, x_symbol)
    return total, steps


def _move_title(term: Expr) -> str:
    """Mesma frase de `formatting.move_title` ("Subtraindo/Somando X dos
    dois lados"), mas SEM passar por `formatting._clean` (que remove todo
    "*" assumindo — corretamente em todo o resto do produto — que o termo
    movido só tem UMA letra multiplicando um coeficiente numérico). Aqui
    `term` pode ser um produto de DUAS letras distintas (x e a variável
    dependente, ex. "y(x)*cos(x*y(x))" em `sin(xy)=x+y`) — remover o "*"
    colaria os dois tokens ("xy(x)"), quebrando o casamento por fronteira
    de palavra (`\\b`) que `_rename_implicit_text` depende para trocar
    "y(x)" por "y" só onde ele aparece como um token de verdade."""
    text = str(term)
    if text.startswith("-"):
        return f"Somando {text[1:]} dos dois lados"
    return f"Subtraindo {text} dos dois lados"


def _isolate_derivative(
    dlhs: Expr, drhs: Expr, derivative: Expr, x_symbol: Symbol
) -> tuple[Expr, list[MathStep]]:
    """Isola `derivative` (sempre `Derivative(y(x), x)`) algebricamente a
    partir de `dlhs = drhs` — ver docstring do módulo para o motivo de
    `.coeff(derivative)` ser usada em vez de `linear_equations.reduce_
    to_value`. Toda equação obtida derivando UMA vez uma equação
    algébrica em x/y é, por construção da regra da cadeia, LINEAR em
    `Derivative(y(x), x)` (nunca aparece elevada a uma potência) — por
    isso "mover os termos com a derivada para um lado, fatorar, dividir"
    sempre basta, sem precisar resolver uma equação de grau maior."""
    steps = [MathStep(title="Reunindo os resultados", expression=eq_text(dlhs, drhs))]

    diff_eq = expand(dlhs - drhs)
    independent, dependent = diff_eq.as_independent(derivative, as_Add=True)

    if independent != 0:
        steps.append(
            MathStep(title=_move_title(independent), expression=eq_text(dependent, -independent))
        )

    coeff = dependent.coeff(derivative)
    if coeff != 1:
        steps.append(
            MathStep(
                title="Fatorando a derivada em evidência",
                expression=eq_text(f"({coeff})*{derivative}", -independent),
            )
        )
        isolated = simplify(-independent / coeff)
        steps.append(
            MathStep(title="Isolando a derivada", expression=eq_text(derivative, isolated))
        )
    else:
        isolated = -independent

    return isolated, steps


def _rename_implicit_steps(steps: list[MathStep], y_name: str, x_name: str) -> list[MathStep]:
    return [
        MathStep(
            title=(
                rename_implicit_derivative_text(step.title, y_name, x_name)
                if step.title
                else step.title
            ),
            title_segments=step.title_segments,
            expression=rename_implicit_derivative_text(step.expression, y_name, x_name),
            explanation=step.explanation,
        )
        for step in steps
    ]


def generate_implicit_differentiation_steps(text: str) -> list[MathStep]:
    parts = _split_derivative_call(text)
    if parts is None:
        raise ExpressionError(UNSUPPORTED_IMPLICIT_DIFFERENTIATION_MESSAGE)
    expr_text, var_text = parts
    x_symbol = _parse_variable(var_text)

    if looks_like_inequality(expr_text):
        raise ExpressionError(UNSUPPORTED_INEQUALITY_MESSAGE)
    if not looks_like_implicit_derivative_argument(expr_text):
        raise ExpressionError(UNSUPPORTED_IMPLICIT_DIFFERENTIATION_MESSAGE)

    lhs, rhs, y_name = parse_implicit_equation(expr_text, x_symbol)
    y_func = Function(y_name)(x_symbol)

    steps = [MathStep(title="Equação original", expression=eq_text(lhs, rhs))]
    steps.append(
        MathStep(
            title="Derivando ambos os lados em relação a x",
            expression=eq_text(f"derivada({lhs}, {x_symbol})", f"derivada({rhs}, {x_symbol})"),
        )
    )

    dlhs, lhs_steps = _differentiate_side(lhs, x_symbol, y_func)
    steps.extend(lhs_steps)
    drhs, rhs_steps = _differentiate_side(rhs, x_symbol, y_func)
    steps.extend(rhs_steps)

    derivative = Derivative(y_func, x_symbol)
    if not expand(dlhs - drhs).has(derivative):
        raise ExpressionError(NO_DEPENDENT_VARIABLE_MESSAGE)

    isolated, isolation_steps = _isolate_derivative(dlhs, drhs, derivative, x_symbol)
    steps.extend(isolation_steps)

    # Verificação final: `compute_implicit_derivative` (o MESMO núcleo que
    # `/solve` usa, `calculus/implicit_differentiation.py`) já confere
    # contra o oráculo `sympy.idiff` internamente e levanta `Expression
    # Error` fail-closed se discordar; comparar `isolated` (calculado aqui
    # de forma independente, termo a termo, só para os PASSOS) contra o
    # valor autoritativo garante que a apresentação nunca diverge do
    # resultado — nunca duas implementações do mesmo cálculo.
    authoritative = compute_implicit_derivative(lhs, rhs, y_name, x_symbol)
    if simplify(isolated - authoritative) != 0:
        raise ExpressionError(
            f"Não foi possível verificar a derivação implícita de {lhs}={rhs} nesta versão."
        )

    return _rename_implicit_steps(steps, y_name, x_symbol.name)
