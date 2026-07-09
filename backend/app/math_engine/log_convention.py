"""Fonte única da convenção OFICIAL e PERMANENTE do MathMaster para nomes de
função logarítmica/exponencial, estabelecida na Sprint 8: `log(x)` = base 10,
`ln(x)` = base e (natural), `exp(x)` = e**x (já é o comportamento nativo do
SymPy, não precisa de remapeamento).

Compartilhado entre `logarithms/` (Sprint 8) e `functions/` (Sprint 9) porque
é uma convenção de PRODUTO, não uma técnica de resolução interna de uma área
— ao contrário do padrão usual deste projeto de cada área reimplementar sua
própria lógica de forma independente (ver `functions/modular.py` vs
`equations/absolute.py`), duplicar esta constante especificamente arriscaria
as duas cópias divergirem silenciosamente se a convenção mudar no futuro, o
mesmo tipo de falha silenciosa que já exigiu um patch em
`formatter/pipeline.py` na Sprint 8 (§9.5 do SESSION_LOG correspondente).

Todo ponto de parse que precise interpretar `log`/`ln` no corpo de uma
expressão do usuário deve importar `LOCAL_DICT` daqui em vez de declarar o
seu próprio.
"""
from __future__ import annotations

from sympy import log as sympy_log

LOCAL_DICT = {
    "log": lambda x: sympy_log(x, 10),  # convenção MathMaster: log = base 10
    "ln": sympy_log,  # ln = log natural (base e)
}
