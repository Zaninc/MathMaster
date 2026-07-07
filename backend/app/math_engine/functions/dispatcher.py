import re

from sympy import Symbol
from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

from ..errors import ExpressionError
from .classification import QUADRATICA, classify_function, label_for
from .domain import compute_domain
from .evaluate import evaluate_function
from .intercepts import y_intercept
from .roots import compute_roots
from .vertex import compute_vertex

_TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application,)

_SPLIT_PATTERN = re.compile(r"[;\n]+")
_DEFINITION_PATTERN = re.compile(r"^\s*([a-zA-Z_]\w*)\s*\(\s*([a-zA-Z_]\w*)\s*\)\s*=\s*(.+)$")

# Nomes reservados de outras áreas do motor (ex.: trigonometria, Sprint 7) que
# sintaticamente também casam com "nome(var) = expr" — "sin(x) = 1/2" não é uma
# definição de função chamada "sin", é uma equação trigonométrica.
_RESERVED_FUNCTION_NAMES = {"sin", "cos", "tan", "asin", "acos", "atan"}


def _split_parts(expression: str) -> list[str]:
    return [part.strip() for part in _SPLIT_PATTERN.split(expression) if part.strip()]


def looks_like_function_definition(text: str) -> bool:
    match = _DEFINITION_PATTERN.match(text)
    if not match:
        return False
    return match.group(1) not in _RESERVED_FUNCTION_NAMES


def is_function_domain_expression(expression: str) -> bool:
    parts = _split_parts(expression)
    if not parts:
        return False
    return looks_like_function_definition(parts[0])


def _parse_value(text: str):
    try:
        return parse_expr(text, transformations=_TRANSFORMATIONS)
    except Exception as exc:
        raise ExpressionError(f"Não foi possível interpretar o valor: {text}") from exc


def solve_function_text(expression: str) -> str:
    parts = _split_parts(expression)
    definicao = _DEFINITION_PATTERN.match(parts[0])
    if not definicao:
        raise ExpressionError(f"Não foi possível interpretar a função: {expression}")

    nome, variavel, lado_direito = definicao.groups()
    symbol = Symbol(variavel)

    try:
        expr = parse_expr(lado_direito, transformations=_TRANSFORMATIONS)
    except Exception as exc:
        raise ExpressionError(
            f"Não foi possível interpretar a função: {lado_direito}"
        ) from exc

    avaliacoes = parts[1:]
    if avaliacoes:
        padrao_avaliacao = re.compile(rf"^\s*{re.escape(nome)}\s*\(\s*(.+?)\s*\)\s*$")
        resultados = []
        for parte in avaliacoes:
            chamada = padrao_avaliacao.match(parte)
            if not chamada:
                raise ExpressionError(f"Não foi possível interpretar a avaliação: {parte}")
            valor = _parse_value(chamada.group(1))
            resultado = evaluate_function(expr, symbol, valor)
            resultados.append(f"{nome}({valor}) = {resultado}")
        return ", ".join(resultados)

    kind = classify_function(expr, symbol)

    campos = [
        f"Tipo: {label_for(kind)}",
        f"Domínio: {compute_domain(expr, symbol, kind)}",
    ]

    raizes = compute_roots(expr, symbol, kind)
    if raizes:
        rotulo = "Raiz" if len(raizes) == 1 else "Raízes"
        campos.append(f"{rotulo}: " + ", ".join(f"{symbol} = {raiz}" for raiz in raizes))
    else:
        campos.append("Raízes: nenhuma")

    campos.append(f"Intercepto em y: {y_intercept(expr, symbol)}")

    if kind == QUADRATICA:
        campos.append(f"Vértice: {compute_vertex(expr, symbol)}")

    return "; ".join(campos)
