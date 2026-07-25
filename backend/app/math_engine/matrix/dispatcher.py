r"""Sprint V2.2 — dispatcher do Motor de Matrizes.

Sintaxe principal (prioritária em toda a interface/documentação):

    [[1,2],[3,4]]                        matriz literal
    [[1,2],[3,4]] + [[5,6],[7,8]]        soma
    [[1,2],[3,4]] - [[5,6],[7,8]]        subtração
    [[1,2],[3,4]] * [[5,6],[7,8]]        multiplicação
    2 * [[1,2],[3,4]]                    escalar
    [[1,2],[3,4]] ^ 2                    potência inteira

Funções (aliases PT-BR entre parênteses, mesma semântica):

    det(...)        (determinante(...))
    inv(...)         (inversa(...))
    transpose(...)   (transposta(...))
    trace(...)       (traço(...))

Entra na cascata de `math_engine/dispatcher.py` logo depois de
`summation` e ANTES de `calculus`/`functions`/`trigonometry`/
`logarithms`/`equations` (mesma posição/motivo de
`summation/dispatcher.py`, ver a docstring de lá): o argumento de
det/inv/transpose/trace, ou o lado direito de uma operação escalar, pode
conter livremente números que essas áreas casariam por conta própria em
qualquer posição do texto — matrix precisa decidir primeiro.

`is_matrix_domain_expression` reconhece a presença do literal "[[" (marcador
léxico inequívoco — nenhuma outra área do motor usa colchete duplo; o único
outro uso de "[" hoje, listas de pontos em `analytic_geometry`, é sempre um
único colchete) OU uma chamada de função de matriz conhecida (det/inv/
transpose/trace + aliases PT-BR) em QUALQUER posição do texto — mesmo
critério (`.search()`) que `trigonometry`/`logarithms` já usam, necessário
aqui porque o operando de matriz pode vir depois de um escalar
("2 * [[1,2],[3,4]]", que não começa com "[[").

Preparação para evolução futura (nomes de matriz — ver docstring de
`parsing.py`): esta função de detecção de domínio não precisaria mudar
quando essa evolução chegar — "A*B" sem nenhum "[[" na expressão não seria
reconhecido hoje (comportamento correto: cai para `algebra`, que rejeita
"A"/"B" como identificadores de múltiplas letras), e a detecção baseada em
"[[" continuaria funcionando para o caso "A=[[1,2],[3,4]]" (contém "[["),
sem exigir nenhuma mudança aqui.
"""
from __future__ import annotations

import re

from sympy.matrices import MatrixBase

from .evaluator import evaluate_matrix_node
from .parsing import CANONICAL_FUNCTION_NAMES, parse_matrix_expression

_MATRIX_LITERAL_MARKER = "[["

_CALL_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(name) for name in CANONICAL_FUNCTION_NAMES) + r")\s*\("
)

# "log(" nativo do SymPy que sobreviver na saída é sempre log natural (a
# nossa base 10 nunca aparece como um nó "log(...)" isolado) — mesmo
# raciocínio já usado por `summation/dispatcher.py`/`calculus/dispatcher.py`.
_NATURAL_LOG_PATTERN = re.compile(r"\blog(?=\()")


def _rename_natural_log(text: str) -> str:
    return _NATURAL_LOG_PATTERN.sub("ln", text)


def is_matrix_domain_expression(expression: str) -> bool:
    return _MATRIX_LITERAL_MARKER in expression or bool(_CALL_PATTERN.search(expression))


def _render_matrix(matrix: MatrixBase) -> str:
    rows = [
        ", ".join(str(matrix[row, col]) for col in range(matrix.cols))
        for row in range(matrix.rows)
    ]
    return "[[" + "], [".join(rows) + "]]"


def solve_matrix_text(expression: str) -> str:
    node = parse_matrix_expression(expression)
    result = evaluate_matrix_node(node)
    rendered = _render_matrix(result) if isinstance(result, MatrixBase) else str(result)
    return _rename_natural_log(rendered)
