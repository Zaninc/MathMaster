"""Sprint V2.1 — avaliação de um `SummationNode` já validado.

Reaproveita 100% da infraestrutura segura existente:
- `safe_parse_expr`/`extract_safe_symbols` (`safe_parsing.py`), mesmo padrão
  de `calculus/dispatcher.py:_parse_fragment` para descobrir parâmetros
  livres (ex. o "a" de "Σ(i=1..5) a*i") e montar o `local_dict`;
- a mesma técnica de substituição de `functions/evaluate.py`
  (`expr.subs(...)`) para avaliar cada termo.

O corpo é parseado UMA ÚNICA VEZ (a variável do somatório vira um Symbol
livre) e depois substituído por cada índice do intervalo — nunca reparseado
a cada iteração, importante para intervalos de até 10.000 termos. Nenhum
`eval`/`exec`.

Hotfix (profiling, ver SESSION_LOG): a soma final NUNCA passa por
`sympy.simplify()` — `simplify()` tenta várias estratégias e escolhe a mais
curta, e uma delas (`trigsimp`) tenta casar identidades trigonométricas
ENTRE todos os termos da soma. Para um corpo com sin/cos de argumento
numérico (ex. "Σ(i=1..30) sin(i)"), isso significa buscar identidades entre
até 30 átomos `sin(k)`/`cos(k)` sem relação nenhuma entre si — medido
empiricamente em ~31s para 30 termos mistos (trigsimp sozinho passou de
15s), muito acima do timeout padrão de 5s, mesmo o loop de substituição
inteiro custando ~0.03s. As trocas abaixo (`cancel`/`together`/
`logcombine`) são todas estruturais (sem busca de padrão) e resolvem em
<0.02s no mesmo caso, com resultado IDÊNTICO a `simplify()` para todos os
casos testados que não envolvem trigonometria (soma auto-combina
racionais/parâmetros livres por construção do próprio `Add`/`Mul` do
SymPy) — a única diferença observável é que uma soma de senos/cossenos de
argumento numérico permanece como soma de átomos (`sin(1) + sin(2) + ...`)
em vez de arriscar juntar tudo num resultado só, o que é o valor exato
correto (não há forma fechada mais simples) e nunca vira aproximação
numérica silenciosa.

Sprint V2.1 (apresentação progressiva) — depois de `cancel/together/
logcombine`, uma última tentativa BEM LIMITADA de `trigsimp` (mesmo
`_MAX_TRIG_ATOMS_FOR_TRIGSIMP` e mesma técnica de `formatter/expr_clean.py:
_bounded_trigsimp`, duplicada aqui de propósito — áreas do motor não
importam de `formatter/`) é o que permite "Σ(i=1..5) sin(i)²+cos(i)²"
continuar colapsando para "5" (10 átomos, dentro do limite) sem reabrir o
custo do BUG 2 para somas com muito mais átomos independentes (que
permanecem como soma de átomos, agora candidatas à notação compacta em
`dispatcher.py`)."""
from __future__ import annotations

from sympy import Integer, cancel, logcombine, nan, oo, together, trigsimp, zoo
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol
from sympy.functions.elementary.trigonometric import TrigonometricFunction

from ..errors import ExpressionError
from ..log_convention import LOCAL_DICT as _LOG_LOCAL_DICT
from ..safe_parsing import extract_safe_symbols, safe_parse_expr
from .parsing import SummationNode

_UNDEFINED_VALUES = (zoo, nan, oo, -oo)

# Mesmo valor de `formatter/expr_clean.py:_MAX_TRIG_ATOMS_FOR_TRIGSIMP`,
# calibrado empiricamente lá (ver o próprio módulo): ~0.17s a 12 átomos,
# custo crescendo rápido depois disso.
_MAX_TRIG_ATOMS_FOR_TRIGSIMP = 12


def _bounded_trigsimp(expr: Expr) -> Expr:
    if len(expr.atoms(TrigonometricFunction)) > _MAX_TRIG_ATOMS_FOR_TRIGSIMP:
        return expr
    return trigsimp(expr)


def _is_undefined(term: Expr) -> bool:
    """Um termo é indefinido quando a substituição concreta do índice
    produz `zoo`/`nan`/±infinito (ex. divisão por zero, log(0)) — sympy já
    resolve isso automaticamente na própria substituição de um número
    concreto, sem precisar de `simplify()` antes de checar (mesma lição da
    correção de `functions/modular.py`: nunca supor a forma do resultado,
    checar o valor/tipo real)."""
    if term in _UNDEFINED_VALUES:
        return True
    return bool(term.has(zoo, nan))


def parse_summation_body(node: SummationNode) -> tuple[Expr, Symbol]:
    """Parseia o corpo do somatório uma única vez. Compartilhado por
    `evaluate_summation` e por `steps.build_summation_steps`, para que os
    dois nunca precisem reparsear texto de usuário de formas diferentes."""
    symbol = Symbol(node.variable)
    extra_symbols = extract_safe_symbols(
        node.expression, exclude={node.variable, *_LOG_LOCAL_DICT}
    )
    local_dict = {node.variable: symbol, **_LOG_LOCAL_DICT, **extra_symbols}
    try:
        body_expr = safe_parse_expr(node.expression, local_dict=local_dict)
    except Exception as exc:
        raise ExpressionError(
            f"Não foi possível interpretar a expressão: {node.expression}"
        ) from exc
    return body_expr, symbol


def evaluate_summation(node: SummationNode) -> Expr:
    body_expr, symbol = parse_summation_body(node)

    total: Expr = Integer(0)
    for index in range(node.lower, node.upper + 1):
        term = body_expr.subs(symbol, index)
        if _is_undefined(term):
            raise ExpressionError(
                f"O termo do somatório é indefinido para {node.variable} = {index}."
            )
        total += term

    return _bounded_trigsimp(cancel(together(logcombine(total))))


def approximate_summation(total: Expr) -> str | None:
    """Aproximação numérica decimal do valor já exato de `total` — Sprint
    V2.1 (apresentação progressiva). `None` quando não há nada útil para
    aproximar: `total` depende de um parâmetro livre (ex. "6*a", sem valor
    numérico) ou já É um inteiro exato (uma aproximação decimal só
    repetiria o mesmo número com zeros à direita)."""
    if total.free_symbols or total.is_Integer:
        return None
    return str(total.evalf(10))
