class ExpressionError(ValueError):
    """Erro de interpretação ou avaliação de uma expressão matemática."""


class ComputationTimeoutError(ExpressionError):
    """Erro levantado quando um cálculo simbólico ainda está rodando ao
    esgotar o tempo máximo permitido e é interrompido à força (Hardening
    III, Etapa 3). Não é levantado se o processo filho já tiver encerrado
    (ver `app.execution`) — isso é tratado como erro interno, não timeout.
    """
