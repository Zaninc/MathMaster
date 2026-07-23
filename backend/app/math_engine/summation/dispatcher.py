r"""Sprint V2.1 — dispatcher de somatórios finitos (Σ).

Sintaxe principal (prioritária em toda a interface/documentação):

    Σ(variavel=inferior..superior) expressao

Aliases secundários (mesma semântica e ordem de argumentos):

    sum(variavel, inferior, superior, expressao)
    somatorio(variavel, inferior, superior, expressao)

Entra na cascata de `math_engine/dispatcher.py` logo depois de
`analytic_geometry` e ANTES de `calculus`/`functions`/`trigonometry`/
`logarithms`/`equations` (decisão explícita do Theo): o corpo de um
somatório pode conter livremente "sin(", "log(", "x**2 = 0" etc., e essas
áreas decidem por `.search()` livre sobre o texto inteiro — se somatório
fosse verificado depois, uma chamada como "Σ(i=1..5) sin(i)^2 + cos(i)^2"
seria roubada por `trigonometry` antes de chegar aqui. Mesmo raciocínio já
documentado em `calculus/dispatcher.py`.

`is_summation_domain_expression` reconhece SOMENTE expressões que COMEÇAM
(ignorando espaços à esquerda) por "Σ(", "sum(" ou "somatorio(" — nunca por
ocorrência no meio do texto, para não roubar o domínio de nenhuma outra
área cujo corpo apenas mencione essas palavras incidentalmente.

Apresentação progressiva (Sprint V2.1, hotfix pós-BUG 1/2): quando o valor
exato NÃO colapsa para poucos termos (ex. "Σ(i=1..30) sin(i)", sem forma
fechada), `solve_summation_text` devolve a própria notação Σ compacta em
vez de expandir dezenas de termos — o valor continua exato (só
reapresentado de forma compacta, nunca truncado/arredondado). A
aproximação numérica decimal (para o frontend decidir, por MEDIÇÃO VISUAL
real, quando mostrar "≈..." como principal) é exposta à parte por
`solve_summation_with_approx`, chamada só pelo dispatcher raiz — nunca
pelo contrato de `solve_expression`, que continua devolvendo só uma
string.
"""
from __future__ import annotations

import re

from sympy.core.expr import Expr

from .evaluator import approximate_summation, evaluate_summation
from .parsing import SummationNode, parse_summation_expression
from .steps import EXPAND_LIMIT
from .validation import validate_summation_node

_SIGMA_PREFIX = "Σ("

# "log(" nativo do SymPy que sobreviver na saída é sempre log natural (a
# nossa base 10 nunca aparece como um nó "log(...)" isolado) — mesmo
# raciocínio já usado por `calculus/dispatcher.py`/`logarithms/dispatcher.py`.
_NATURAL_LOG_PATTERN = re.compile(r"\blog(?=\()")


def _rename_natural_log(text: str) -> str:
    return _NATURAL_LOG_PATTERN.sub("ln", text)


def is_summation_domain_expression(expression: str) -> bool:
    stripped = expression.lstrip()
    if stripped.startswith(_SIGMA_PREFIX):
        return True
    lowered = stripped.lower()
    return lowered.startswith("sum(") or lowered.startswith("somatorio(")


def _should_stay_compact(node: SummationNode, total: Expr) -> bool:
    """Só vale a pena expandir em termos separados quando o intervalo é
    pequeno E o total realmente não colapsou para algo mais curto (ex.
    "Σ(i=1..30) i" tem 30 termos mas `total` é só "465" — `total.is_Add`
    dá `False`, expande normalmente). Mesmo limite de `steps.py` (o que já
    é "pouco" o bastante para expandir passo a passo também é pouco o
    bastante para mostrar expandido como resultado)."""
    term_count = node.upper - node.lower + 1
    return term_count > EXPAND_LIMIT and total.is_Add and len(total.args) > 1


def solve_summation_text(expression: str) -> str:
    node = parse_summation_expression(expression)
    validate_summation_node(node)
    total = evaluate_summation(node)
    if _should_stay_compact(node, total):
        return node.notation
    return _rename_natural_log(str(total))


def solve_summation_with_approx(expression: str) -> str | None:
    """Aproximação numérica decimal do valor exato, para o dispatcher raiz
    expor via `solve_expression_with_approx` — `None` quando não há
    aproximação útil (parâmetro livre, ou já é um inteiro exato). Reparseia
    a expressão (mesmo custo pequeno de `evaluate_summation`, já protegido
    pelo timeout global) em vez de acoplar `solve_summation_text` a um
    retorno de tupla, preservando o contrato `str` de `solve_expression`
    intacto para todo o resto do sistema."""
    node = parse_summation_expression(expression)
    validate_summation_node(node)
    total = evaluate_summation(node)
    return approximate_summation(total)
