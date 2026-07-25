r"""Sprint V2.3 — validações semânticas do Motor de Números Complexos.

Erros de SINTAXE (ex. "polar(" sem fechamento, chamada de função
desconhecida) já são rejeitados em `parsing.py`/`safe_parsing.py`, antes
de qualquer avaliação — mesma divisão de responsabilidade de
`matrix/validation.py` vs. `matrix/parsing.py`. Este módulo cobre só o
único estado que exige validação DEPOIS de um número complexo já
avaliado."""
from __future__ import annotations

from sympy.core.expr import Expr

from ..errors import ExpressionError


def validate_nonzero_for_polar(value: Expr) -> None:
    """`sympy.arg(0)` não tem valor definido (SymPy devolve `nan`
    silenciosamente, sem levantar nada) — a forma polar de z=0 não existe
    (módulo 0, ângulo indefinido). Rejeitado explicitamente aqui, ANTES de
    `arg()` alguma vez rodar sobre esse valor — mesmo espírito de
    `matrix/validation.py:validate_invertible` (recusar o estado inválido
    antes de deixar o SymPy devolver algo sem sentido matemático em
    silêncio). `is_zero` (não `== 0`): para um argumento simbólico onde não
    dá para provar que é zero, `is_zero` é `None` (falsy) e a validação
    simplesmente não bloqueia — nunca rejeita um caso ambíguo por engano."""
    if value.is_zero:
        raise ExpressionError(
            "A forma polar não é definida para z = 0 (módulo 0, argumento indefinido)."
        )
