r"""Sprint V2.3 — dispatcher do Motor de Números Complexos.

Ver `parsing.py` para a sintaxe completa suportada e o porquê de quase
tudo aqui reaproveitar `safe_parse_expr` diretamente (via
`evaluator.py`), sem árvore sintática própria.

Entra na cascata de `math_engine/dispatcher.py` logo depois de `matrix` e
ANTES de `calculus`/`functions`/`trigonometry`/`logarithms`/`equations` —
mesmo motivo já documentado por `matrix/dispatcher.py`/
`summation/dispatcher.py`: o argumento de "conjugado(...)"/"modulo(...)"/
etc. pode conter livremente "sin(", "log(" etc., que essas áreas
casariam por `.search()` em qualquer posição do texto.

`is_complex_domain_expression` reconhece:

1. uma chamada às quatro funções desta área (canônica ou alias PT-BR/EN),
   em QUALQUER posição do texto — mesmo critério de
   `matrix/dispatcher.py:is_matrix_domain_expression` para det/inv/etc.;
2. OU a presença da unidade imaginária como token isolado ("i"/"I",
   fronteira de palavra) — SOMENTE quando a expressão não contém "=".

Por que excluir "=" de AMBOS os critérios (não só do 2): preserva 100% do
comportamento já existente para qualquer texto em forma de
equação/definição — "abs(x) = 5", "modulo(x) = 5" continuam caindo
exatamente onde já caíam ANTES desta sprint (nenhuma mudança), porque
resolver equações envolvendo módulo/argumento de um complexo desconhecido
é uma feature própria, fora do escopo desta sprint (só aritmética + as
quatro funções sobre valores já conhecidos). Como
`is_summation_domain_expression` decide PRIMEIRO na cascata (por
prefixo), um cabeçalho de somatório como "Σ(i=1..10) i" nunca chega até
esta função — "i" como variável de laço de somatório nunca colide com "i"
como unidade imaginária (ver docstring de `evaluator.py` para os
detalhes).
"""
from __future__ import annotations

import re

from ..errors import ExpressionError
from .evaluator import compute_polar_components, evaluate_complex_expression
from .parsing import (
    contains_complex_call,
    contains_polar_call,
    extract_whole_polar_argument,
)

# NÃO usar `\b[iI]\b`: fronteira de palavra falha quando "i" está colado a
# um dígito ("4i", "3-4i" — implicit multiplication), porque dígito
# TAMBÉM é caractere de palavra para `\b` (sem fronteira entre "4" e "i").
# Lookaround explícito: "i"/"I" isolado de QUALQUER letra/underscore dos
# dois lados (nunca faz parte de um identificador maior, ex. "modulo",
# "circunferencia") — mas dígito colado do lado esquerdo é permitido de
# propósito, exatamente para casar "4i"/"-4i"/"3-4i".
_IMAGINARY_TOKEN_PATTERN = re.compile(r"(?<![A-Za-z_])[iI](?![A-Za-z_])")

# "log(" nativo do SymPy que sobreviver na saída é sempre log natural (a
# nossa base 10 nunca aparece como um nó "log(...)" isolado) — mesmo
# raciocínio já usado por `matrix/dispatcher.py`/`summation/dispatcher.py`.
_NATURAL_LOG_PATTERN = re.compile(r"\blog(?=\()")


def _rename_natural_log(text: str) -> str:
    return _NATURAL_LOG_PATTERN.sub("ln", text)


def is_complex_domain_expression(expression: str) -> bool:
    if "=" in expression:
        return False
    if contains_complex_call(expression):
        return True
    return bool(_IMAGINARY_TOKEN_PATTERN.search(expression))


def _render_polar(modulus, argument) -> str:
    """Monta a string final manualmente (nunca via `str()` de uma árvore
    SymPy composta) — precisa sobreviver INTACTA ao pipeline de
    apresentação (`app/formatter/pipeline.py`), que resympifica qualquer
    resultado classificado como "expressão pura" e reavaliaria
    "cos(pi/4)"/"sin(pi/4)" de volta para a forma retangular, destruindo a
    forma polar (confirmado empiricamente durante o planejamento). O "·"
    entre "I" e "sin(...)" é deliberado: nenhum caractere do whitelist de
    `formatter/classify.py:_PURE_EXPRESSION_PATTERN` inclui "·", então
    esta string nunca é classificada como "expressão pura" — passa
    INTOCADA por `format_result` e só recebe o polimento cosmético
    incondicional de `formatter/unicode_math.render_math` (sqrt->√,
    pi->π, I->i), a mesma camada que toda outra área do motor já usa.
    Resultado final típico: "√2(cos(π/4)+i·sin(π/4))"."""
    return _rename_natural_log(f"{modulus}(cos({argument})+I·sin({argument}))")


def solve_complex_text(expression: str) -> str:
    polar_argument = extract_whole_polar_argument(expression)
    if polar_argument is not None:
        modulus, argument = compute_polar_components(polar_argument)
        return _render_polar(modulus, argument)

    if contains_polar_call(expression):
        # "polar(" apareceu, mas não como a expressão INTEIRA (ex.
        # "2*polar(1+i)", "polar(1+i) + 1", ou "polar(" sem fechamento) —
        # rejeitado explicitamente em vez de "adivinhar" uma composição:
        # a forma polar (decisão de arquitetura pré-sprint) é uma
        # expressão SIMBÓLICA de apresentação, não um valor genérico que
        # faça sentido somar/multiplicar livremente.
        raise ExpressionError(
            "polar(...) precisa ser a expressão inteira — não pode ser combinada "
            "com outras operações."
        )

    result = evaluate_complex_expression(expression)
    return _rename_natural_log(str(result))
