"""Sprint V2.1 — preparação da arquitetura de passos (expansão) de um
somatório já resolvido.

NÃO é consumido pelo `/solve` nesta sprint — `SolveResponse` continua
`{expression, result}`, decisão explícita (ver CLAUDE_RULES.md §2 "não
alterar endpoints sem necessidade"). Este módulo existe para ser testável
isoladamente e ficar pronto para uma futura sprint de explicações
determinísticas (Fase 1, sprint 13 do roadmap) ligar a um campo de resposta
novo, sem precisar desenhar a expansão do zero.

Limitação consciente: a etapa "termo a termo" usa `sympy.core.parameters.
evaluate(False)` para preservar a substituição sem colapsar a aritmética
(ex. "2*1", não "2") — é a forma correta/nativa do SymPy de fazer isso,
não uma reconstrução textual manual. A formatação cosmética final (ex.
"2*1" -> "2(1)") pertence à camada `formatter/` (já compartilhada por todo
o projeto) e não é aplicada aqui, já que nenhuma área de `math_engine`
chama `formatter/` diretamente hoje (`main.py`/os testes é que compõem
`format_result`/`render_math` por cima do resultado bruto).
"""
from __future__ import annotations

from sympy.core.expr import Expr
from sympy.core.parameters import evaluate as sympy_evaluate

from .evaluator import parse_summation_body
from .parsing import SummationNode

# Acima deste número de termos, a expansão usa reticências em vez de listar
# cada termo (spec: "para intervalos grandes, utilizar reticências sem
# expandir milhares de termos").
EXPAND_LIMIT = 10


def build_summation_steps(node: SummationNode, total: Expr) -> list[str]:
    term_count = node.upper - node.lower + 1
    header = node.notation

    if term_count > EXPAND_LIMIT:
        return [header, "...", str(total)]

    body_expr, symbol = parse_summation_body(node)
    with sympy_evaluate(False):
        substituted_terms = [
            body_expr.subs(symbol, index) for index in range(node.lower, node.upper + 1)
        ]
    expanded = " + ".join(str(term) for term in substituted_terms)

    return [header, expanded, str(total)]
