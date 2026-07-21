from sympy import Abs, Eq, S, solveset
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol


def is_modular_function(expr: Expr) -> bool:
    return expr.has(Abs)


def solve_modular_roots(expr: Expr, symbol: Symbol) -> list | None:
    """Retorna a lista de raízes concretas quando o conjunto solução de
    `expr = 0` é finito (o caso comum: módulo de polinômio/raiz, ex. |x|,
    |sqrt(x)-2|, 5|x+1|**2).

    Quando NÃO é finito, `solveset` sempre retorna rápido (a busca em si
    nunca é o problema — confirmado empiricamente), mas devolve um de dois
    tipos que `list(...)` não consegue tratar com segurança:

    1. Um `Union`/`ImageSet` infinito e periódico — ex. |sin(x)|=0 tem
       raiz em x=kπ para TODO k inteiro. `list(...)` sobre um conjunto
       infinito itera para sempre (trava o processo até o timeout do
       servidor); nunca termina sozinho.
    2. Um `ConditionSet` (equação sem forma fechada) — ex. |x+sin(x)|=0
       (tem raiz única em x=0, mas o solveset não consegue prová-lo
       simbolicamente). `ConditionSet` não é iterável: `list(...)` levanta
       `TypeError` imediatamente.

    Em nenhum dos dois casos é seguro tentar enumerar. Devolve `None`
    ("existem raízes, mas não podem ser listadas individualmente nesta
    versão") — NUNCA uma lista vazia, que diria incorretamente "não há
    raízes" (falso nos dois casos: |sin(x)| tem infinitas, x+sin(x) tem
    x=0)."""
    solution = solveset(Eq(expr, 0), symbol, domain=S.Reals)
    if solution.is_FiniteSet:
        return sorted(solution, key=str)
    return None
