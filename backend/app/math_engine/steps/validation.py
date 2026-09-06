"""Sprint V2.9 — mensagens amigáveis e guards compartilhados entre
`linear_equations.py`/`linear_systems.py`/`dispatcher.py`. Nenhuma lógica
de resolução mora aqui — só decisões de "isto está dentro do escopo desta
primeira versão?", sempre terminando em `ExpressionError` (nunca uma
exceção interna do SymPy/Python vazando, mesmo contrato de
`safe_parsing.py`)."""
from __future__ import annotations

from sympy import degree

from ..errors import ExpressionError

UNSUPPORTED_DOMAIN_MESSAGE = (
    "Passo a passo disponível apenas para equações lineares e quadráticas de "
    "uma incógnita e sistemas lineares 2x2 nesta versão."
)
UNSUPPORTED_EQUATION_MESSAGE = (
    "Passo a passo disponível apenas para equações lineares e quadráticas de "
    "uma única incógnita nesta versão."
)
UNSUPPORTED_INEQUALITY_MESSAGE = (
    "Passo a passo ainda não está disponível para inequações nesta versão."
)
UNSUPPORTED_SYSTEM_MESSAGE = (
    "Passo a passo disponível apenas para sistemas lineares 2x2 nesta versão."
)
TOO_MANY_UNKNOWNS_MESSAGE = (
    "Passo a passo ainda não disponível para sistemas com mais de duas incógnitas."
)
EMPTY_EXPRESSION_MESSAGE = "A expressão não pode estar vazia."
UNSUPPORTED_DERIVATIVE_MESSAGE = (
    "O passo a passo para este tipo de derivada ainda não foi implementado nesta versão."
)
UNSUPPORTED_INTEGRAL_MESSAGE = (
    "O passo a passo para este tipo de integral ainda não foi implementado nesta versão."
)
UNSUPPORTED_LIMIT_MESSAGE = (
    "O passo a passo para este tipo de limite ainda não foi implementado nesta versão."
)
# Sprint "L'Hôpital com Aplicações Sucessivas" — substitui a antiga
# UNSUPPORTED_LHOPITAL_MULTIPLE_APPLICATIONS_MESSAGE (que rejeitava
# QUALQUER segunda aplicação): agora aplicações sucessivas são suportadas
# até um teto defensivo (`lhopital.MAX_LHOPITAL_APPLICATIONS`); só as
# duas situações abaixo (teto atingido, ciclo detectado) interrompem o
# passo a passo, nunca um loop infinito nem um resultado inventado.
LHOPITAL_MAX_APPLICATIONS_MESSAGE = (
    "A Regra de L'Hôpital foi aplicada o número máximo de vezes permitido "
    "nesta versão sem eliminar a indeterminação — o passo a passo foi "
    "interrompido por segurança."
)
LHOPITAL_CYCLE_DETECTED_MESSAGE = (
    "A Regra de L'Hôpital entrou em um ciclo (a mesma expressão reapareceu "
    "após uma aplicação) sem eliminar a indeterminação — o passo a passo foi "
    "interrompido por segurança nesta versão."
)
LHOPITAL_UNDEFINED_DERIVATIVE_MESSAGE = (
    "A derivada do denominador é identicamente zero — não é possível "
    "continuar aplicando a Regra de L'Hôpital com segurança."
)
UNSUPPORTED_INTEGRATION_BY_PARTS_MULTIPLE_APPLICATIONS_MESSAGE = (
    "Esta integral requer aplicações sucessivas de integração por partes, que "
    "ainda não fazem parte desta versão."
)
# Sprint "Exponenciais e Logaritmos" — usada por `exponential_equations.py` e
# `exponential_substitution_equations.py`: uma potência de base real positiva
# nunca resulta em um valor negativo ou nulo, então uma equação como "e^x=-5"
# (ou, após a substituição u=e^x, nenhuma raiz de u sendo positiva) é
# matematicamente válida de se propor mas não tem solução real nenhuma —
# situação distinta de "fora do escopo desta versão" (`UNSUPPORTED_EQUATION_
# MESSAGE`), por isso uma mensagem dedicada.
NO_REAL_SOLUTION_MESSAGE = "Esta equação não possui solução real."
# Sprint "Derivação Implícita" — `NO_DEPENDENT_VARIABLE_MESSAGE`/
# `MULTIPLE_DEPENDENT_VARIABLES_MESSAGE` foram promovidas para `calculus/
# implicit_differentiation.py` no Hardening Global (única fonte da
# verdade, compartilhada por `/solve` e `/solve/steps` — ver aquele
# módulo). Só a mensagem abaixo (forma sequer parece uma equação — caso
# defensivo, nunca disparado no fluxo normal) continua aqui, específica
# do passo a passo.
UNSUPPORTED_IMPLICIT_DIFFERENTIATION_MESSAGE = (
    "O passo a passo para esta derivação implícita ainda não foi implementado "
    "nesta versão."
)


def require_single_symbol(symbols: set) -> None:
    if len(symbols) != 1:
        raise ExpressionError(UNSUPPORTED_EQUATION_MESSAGE)


def require_linear_degree(diff, symbol) -> None:
    """`diff` é `lhs - rhs` já expandido. Sem símbolo nenhum sobrando =
    identidade/contradição (grau é irrelevante, tratado à parte por
    `linear_equations.reduce_to_value`); com símbolo, exige grau exatamente
    1 — checagem defensiva própria de `linear_equations.py` para uso
    isolado/direto (o roteamento normal via `steps/dispatcher.py` já filtra
    por grau ANTES de chamar este módulo, então isto nunca dispara no fluxo
    real). Grau 2 tem seu próprio motor (`quadratic_equations.py`); grau
    >= 3 ou não-polinomial continua fora de escopo desta versão."""
    if not diff.free_symbols:
        return
    try:
        grau = degree(diff, symbol)
    except Exception as exc:
        raise ExpressionError(UNSUPPORTED_EQUATION_MESSAGE) from exc
    if grau != 1:
        raise ExpressionError(UNSUPPORTED_EQUATION_MESSAGE)
