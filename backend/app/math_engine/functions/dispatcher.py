import re

from sympy import Symbol
from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    standard_transformations,
)

from ..errors import ExpressionError
from ..log_convention import LOCAL_DICT as _LOG_LOCAL_DICT
from ..safe_parsing import safe_parse_expr
from .classification import EXPONENCIAL, LOGARITMICA, QUADRATICA, classify_function, label_for
from .domain import compute_domain
from .evaluate import evaluate_function
from .intercepts import y_intercept
from .logexp import asymptote_field_for, detect_logexp_kind, image_for, monotonicity_for
from .roots import compute_roots
from .vertex import compute_vertex

_TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application,)

_SPLIT_PATTERN = re.compile(r"[;\n]+")
_DEFINITION_PATTERN = re.compile(r"^\s*([a-zA-Z_]\w*)\s*\(\s*([a-zA-Z_]\w*)\s*\)\s*=\s*(.+)$")

# Nomes reservados de outras áreas do motor que sintaticamente também casam
# com "nome(var) = expr" — ex.: "sin(x) = 1/2" não é uma definição de função
# chamada "sin", é uma equação trigonométrica; "log(x) = 5" não é uma função
# chamada "log", é (por enquanto, até a Sprint 8) uma expressão que deve cair
# no fallback de equations/algebra em vez de ser roubada por functions/.
#
# Esta é uma lista mantida manualmente porque a sintaxe "nome(var) = expr" é
# estruturalmente ambígua entre "definição de função do usuário" e "chamada de
# função matemática conhecida seguida de comparação/equação de outra área".
# Qualquer área futura que precise reconhecer "nome(...)" sem uma palavra nova
# aqui vai colidir com functions/ do mesmo jeito. Resolver isso de verdade
# (gramática que distingue definição de uso, ou exigir uma palavra-chave como
# "f(x) := expr") é o tipo de mudança estrutural reservada para o Parser
# Inteligente (Sprint 11) — mudar a sintaxe de definição de função agora
# quebraria a compatibilidade das Sprints 6-7.
_RESERVED_FUNCTION_NAMES = {
    "sin", "cos", "tan", "asin", "acos", "atan",
    "log", "ln", "exp", "sqrt",
    # Sprint 10 (Geometria Analítica I): mesma ambiguidade estrutural,
    # agora entre "definição de função" e uma chamada de operação de
    # analytic_geometry/ — "reta(x) = 2*x" não é uma função chamada
    # "reta", é sintaxe reservada de geometria.
    "distancia", "ponto_medio", "coeficiente_angular",
    "reta", "reta_m", "relacao_retas",
    # Sprint 11 (Geometria Analítica II): mesma ambiguidade estrutural,
    # agora para as quatro cônicas — "circunferencia(x) = 2*x" não é uma
    # função chamada "circunferencia", é sintaxe reservada de geometria.
    "circunferencia", "parabola", "elipse", "hiperbole",
}


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
        return safe_parse_expr(text, transformations=_TRANSFORMATIONS)
    except Exception as exc:
        raise ExpressionError(f"Não foi possível interpretar o valor: {text}") from exc


def solve_function_text(expression: str) -> str:
    parts = _split_parts(expression)
    definicao = _DEFINITION_PATTERN.match(parts[0])
    if not definicao:
        raise ExpressionError(f"Não foi possível interpretar a função: {expression}")

    nome, variavel, lado_direito = definicao.groups()
    symbol = Symbol(variavel)

    # Detecção roda sobre o texto bruto ANTES do parse (ver logexp.py) porque
    # só as 4 formas canônicas (log(x)/ln(x)/exp(x)/a**x com argumento igual
    # à variável isolada) precisam da convenção MathMaster log=base10/
    # ln=natural — qualquer forma composta continua parseada sem local_dict,
    # exatamente como antes da Sprint 9 (comportamento inalterado).
    logexp_match = detect_logexp_kind(lado_direito, variavel)

    # Sprint Parser — a variável declarada em "nome(variavel)=..." é sempre
    # conhecida para o corpo desta função, mesmo que tenha mais de uma letra
    # (ex. "area(largura)=largura**2"): sem isso, a nova camada de
    # ambiguidade de safe_parsing.py rejeitaria "largura" por não ser um
    # nome de 1 caractere nem estar na whitelist global. Mesmo padrão já
    # usado por trigonometry/ para "tau".
    body_local_dict: dict = {variavel: symbol}
    if logexp_match is not None:
        body_local_dict.update(_LOG_LOCAL_DICT)

    try:
        expr = safe_parse_expr(
            lado_direito, transformations=_TRANSFORMATIONS, local_dict=body_local_dict
        )
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

    if logexp_match is not None:
        kind, base = logexp_match
    else:
        kind = classify_function(expr, symbol)
        base = None

    campos = [
        f"Tipo: {label_for(kind)}",
        f"Domínio: {compute_domain(expr, symbol, kind)}",
    ]

    if kind in (LOGARITMICA, EXPONENCIAL):
        campos.append(f"Imagem: {image_for(kind)}")

    raizes = compute_roots(expr, symbol, kind)
    if raizes:
        rotulo = "Raiz" if len(raizes) == 1 else "Raízes"
        campos.append(f"{rotulo}: " + ", ".join(f"{symbol} = {raiz}" for raiz in raizes))
    else:
        campos.append("Raízes: nenhuma")

    campos.append(f"Intercepto em y: {y_intercept(expr, symbol, kind)}")

    if kind == QUADRATICA:
        campos.append(f"Vértice: {compute_vertex(expr, symbol)}")

    if kind in (LOGARITMICA, EXPONENCIAL):
        campos.append(asymptote_field_for(kind))
        campos.append(f"Monotonicidade: {monotonicity_for(kind, base)}")

    return "; ".join(campos)
