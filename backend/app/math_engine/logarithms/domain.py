import re

from ..errors import ExpressionError

# log(0)/log(-5) não levantam exceção nativamente no SymPy: log(0) já resolve
# para "zoo" na própria construção do nó, e log(-5, 10) reescreve o argumento
# em termos complexos (log(5) + I*pi) já no parse, perdendo o sinal original
# antes que qualquer checagem sobre a árvore já construída pudesse enxergá-lo
# (confirmado empiricamente antes de codar esta validação). Por isso ela roda
# sobre o TEXTO original da expressão, antes do parse — mesma necessidade que
# já havia levado trigonometry/inverse.py a detectar asin/acos via regex no
# texto-fonte em vez de inspecionar a árvore já avaliada.
_LITERAL_ARG_PATTERN = re.compile(r"\b(log|ln)\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)")

# TODO
# Validação simbólica de domínio (log(x-2), log(x**2-1), sqrt(log(x)), etc.)
# será implementada em uma sprint futura dedicada a domínios.


def validate_log_domain(text: str) -> None:
    for func_name, literal in _LITERAL_ARG_PATTERN.findall(text):
        if float(literal) <= 0:
            raise ExpressionError(
                f"{func_name}({literal}) está fora do domínio — "
                f"o argumento de {func_name} deve ser maior que 0."
            )
