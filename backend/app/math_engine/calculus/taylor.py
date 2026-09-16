r"""Sprint V3.0.7 (Séries de Taylor e Maclaurin) — polinômio de Taylor
estrutural, compartilhado por `/solve` (valor final) e `/solve/steps`
(valor final + passos) — mesmo padrão de `implicit_differentiation.py`.

    P_n(x) = Σ(k=0 até n) [f^(k)(a)/k!] (x-a)^k

REUTILIZA `calculus/derivatives.py:compute_derivative` (Sprint V3.0.6 —
`sympy.diff(expr, symbol, k)`, já suporta ordem n nativamente) para CADA
f^(k) — nenhum motor de derivação novo, nenhum loop de diferenciação
escrito à mão. k=0 é a própria função (f(a) — nunca uma "derivada de
ordem zero" calculada via `compute_derivative`; tratado explicitamente
aqui, sem hack no motor de derivadas).

Maclaurin é conceitualmente `compute_taylor_polynomial(expr, symbol, 0,
order)` — nunca um caminho de código separado; o "a=0" é só o valor de
`center` passado (a tecla dedicada "Maclaurin" do teclado apenas
pré-preenche esse argumento, ver `frontend/data/keyboard.ts`).

Apresentação (Sprint "Simplificação", item 7 do ticket): `sympy.simplify`
sobre a soma completa (`Add(*termos)`) foi tentado primeiro e REJEITADO —
confirmado empiricamente que ele reescreve `(x-1)**4/4` em potências
soltas de x mesmo quando o resultado não fica mais simples (achado real
testando `Taylor(ln(x), x, 1, 4)`: `simplify` devolve
"-x**4/4 + 4*x**3/3 - 3*x**2 + 4*x - 25/12", destruindo a forma (x-a)
pedida). A soma final é construída termo a termo, na ORDEM de k (0..n),
via `_signed_terms_text` (MESMA técnica de `steps.formatting.signed_
terms_text` — nunca importada de lá: `calculus/` é uma camada abaixo de
`steps/` na fronteira arquitetural já documentada em `implicit_
differentiation.py`/`app/execution.py` — "math_engine fora de steps/
nunca importa steps/" — importar de lá aqui criaria um import circular
real, confirmado empiricamente; duplicar esta função pequena e
self-contained é a mesma convenção já usada em `_split_top_level_args`,
repetida em `calculus/dispatcher.py`/`summation/parsing.py`/`steps/
implicit_differentiation.py`) — cada termo INDIVIDUAL (`f^(k)(a)/k! *
(x-a)**k`) já sai limpo do SymPy sem precisar de `simplify`; só a SOMA
reordenada por `Add`/`simplify` corrompia a forma, nunca os termos
isolados.
"""
from __future__ import annotations

import re

from sympy import factorial
from sympy.core.expr import Expr
from sympy.core.symbol import Symbol

from ..errors import ExpressionError
from .derivatives import compute_derivative


def _signed_terms_text(terms: list[Expr]) -> str:
    """"t1-t2+t3..." — o sinal de cada termo (`could_extract_minus_sign()`,
    nunca `.is_negative`, que só funciona pra números literais) aparece
    sempre FORA do termo. Duplicata deliberada de `steps.formatting.
    signed_terms_text` — ver docstring do módulo.

    Hardening — achado real testando `taylor(sin(x), x, pi, 2)`: quando
    `piece` (depois de extrair o sinal) é uma SOMA de verdade (ex. "x -
    pi", o termo k=1 com centro simbólico), prefixar só "-" na frente
    NUNCA distribui corretamente ("-x - pi" != "-(x - pi)" = "-x + pi",
    um erro matemático real, não só cosmético) — `signed_terms_text`
    original nunca precisou disso porque nenhum chamador existente (soma
    de derivadas/regra do produto) alimenta um `piece` que sobra como
    soma de dois símbolos distintos depois da extração de sinal; Taylor
    com centro simbólico é o primeiro caso real. `wrap_if_sum`-style:
    parênteses ao redor de `piece` sempre que ele mesmo for uma soma."""
    parts: list[str] = []
    for index, term in enumerate(terms):
        negative = term.could_extract_minus_sign()
        piece = -term if negative else term
        piece_text = f"({piece})" if piece.is_Add else str(piece)
        if index == 0:
            sign = "-" if negative else ""
        else:
            sign = "-" if negative else "+"
        parts.append(f"{sign}{piece_text}")
    return "".join(parts)


# Sprint V3.0.7 — ordem máxima segura, centralizada (nunca espalhada em
# magic numbers pelo backend/frontend). Justificada empiricamente: o
# PIOR CASO testado (composição aninhada `exp(sin(x))`, a mesma família
# de expressão que já justificou `MAX_DERIVATIVE_ORDER` na V3.0.6) leva
# ~0.17s pra n=10 e ~0.34s pra n=15 pra montar TODOS os n+1 termos
# (derivar + substituir + dividir por fatorial) — Taylor paga esse custo
# MÚLTIPLAS vezes (uma derivada de ordem k pra cada k de 0 a n, nunca só
# uma chamada), então o limite fica IGUAL ao de derivadas de ordem
# superior (10) por segurança e consistência de produto, com folga
# confortável abaixo do timeout global de 5s (`app.config.settings.
# compute_timeout_seconds`) mesmo no pior caso.
MIN_TAYLOR_ORDER = 0
MAX_TAYLOR_ORDER = 10

_ORDER_PATTERN_MESSAGE_RANGE = f"{MIN_TAYLOR_ORDER} e {MAX_TAYLOR_ORDER}"

NO_TAYLOR_EXPANSION_MESSAGE = (
    "Esta função não possui uma expansão de Taylor real nesse ponto "
    "(ela ou uma de suas derivadas não é finita/real no centro escolhido)."
)

# Sprint V3.0.7 — mesma técnica de validação de ordem de `calculus/
# dispatcher.py:parse_derivative_order` (V3.0.6), duplicada aqui
# deliberadamente (self-contained, mesma convenção já registrada nesse
# módulo) porque o INTERVALO é diferente: ordem 0 é válida pra Taylor
# (P₀(x)=f(a), o caso-base da própria série) mas nunca pra derivada
# comum (não existe "derivada de ordem zero").
_TAYLOR_ORDER_PATTERN = re.compile(r"^\s*-?\d+\s*$")


def parse_taylor_order(text: str) -> int:
    stripped = text.strip()
    if not stripped:
        raise ExpressionError(
            "Ordem do polinômio de Taylor vazia. Informe um número inteiro entre "
            f"{_ORDER_PATTERN_MESSAGE_RANGE}."
        )
    if not _TAYLOR_ORDER_PATTERN.match(stripped):
        raise ExpressionError(
            f"Ordem do polinômio de Taylor inválida: '{text}'. Informe um número "
            f"inteiro entre {_ORDER_PATTERN_MESSAGE_RANGE}."
        )
    order = int(stripped)
    if order < MIN_TAYLOR_ORDER:
        raise ExpressionError(
            "Ordem do polinômio de Taylor deve ser um número inteiro não-negativo "
            f"(mínimo {MIN_TAYLOR_ORDER})."
        )
    if order > MAX_TAYLOR_ORDER:
        raise ExpressionError(
            f"Ordem do polinômio de Taylor muito alta para esta versão "
            f"(máximo {MAX_TAYLOR_ORDER})."
        )
    return order


def _derivative_at_order(expr: Expr, symbol: Symbol, order: int) -> Expr:
    """f^(order)(x) — order=0 é a própria função. Nunca uma chamada real a
    `compute_derivative` com ordem 0 (isso pediria ao motor de derivadas
    pra "calcular uma derivada de ordem zero", um conceito que não existe
    matematicamente); tratado aqui, explicitamente, como o caso-base da
    própria definição da série de Taylor."""
    if order == 0:
        return expr
    return compute_derivative(expr, symbol, order)


def taylor_terms(
    expr: Expr, symbol: Symbol, center: Expr, order: int
) -> list[tuple[int, Expr, Expr, Expr]]:
    """`[(k, f^(k)(x), f^(k)(a), termo)]` para CADA k de 0 a `order`
    (inclusive os termos que se anulam — f^(k)(a) == 0 — quem chama
    decide se filtra; `steps/taylor.py` precisa deles TODOS para mostrar
    "por que os termos ímpares zeram", `compute_taylor_polynomial` abaixo
    filtra antes de montar a soma final). Núcleo único, nunca duas
    implementações do mesmo cálculo.

    Fail-closed de domínio: se `f^(k)(a)` não é finito (`is_finite is
    False` — ex. `log(x)` em `x=0`, que o SymPy avalia para `zoo`) OU não
    é real (`is_real is False` — ex. `log(x)` em `x=-1`, que avalia para
    `I*pi`), levanta `ExpressionError` com mensagem amigável em vez de
    devolver `zoo`/`nan`/um polinômio com coeficiente complexo. Checagem
    genérico sobre QUALQUER k (não só k=0): `sqrt(x)` em `x=0` é finito
    (`sqrt(0)=0`), mas sua primeira derivada `1/(2*sqrt(x))` diverge em
    `x=0` — só aparece ao checar k=1, nunca detectável olhando só f(a)."""
    terms: list[tuple[int, Expr, Expr, Expr]] = []
    for k in range(order + 1):
        derivative_expr = _derivative_at_order(expr, symbol, k)
        value_at_center = derivative_expr.subs(symbol, center)
        if value_at_center.is_finite is False or value_at_center.is_real is False:
            raise ExpressionError(NO_TAYLOR_EXPANSION_MESSAGE)
        term = (value_at_center / factorial(k)) * (symbol - center) ** k
        terms.append((k, derivative_expr, value_at_center, term))
    return terms


def compute_taylor_polynomial_text(expr: Expr, symbol: Symbol, center: Expr, order: int) -> str:
    """O polinômio de Taylor já como TEXTO final (nunca um `Expr` somado
    via `Add`/`simplify` — seria reordenado, ver docstring do módulo).
    Único ponto de saída para o valor, usado por `/solve` (`calculus/
    dispatcher.py`) e pelos testes (que sympificam o texto devolvido pra
    verificar contra o oráculo `P_n^(k)(a) == f^(k)(a)`, mesmo padrão já
    usado em `test_calculus.py` para derivação implícita — nunca uma
    segunda função só para devolver `Expr`)."""
    terms = taylor_terms(expr, symbol, center, order)
    nonzero_terms = [term for _, _, value_at_center, term in terms if value_at_center != 0]
    if not nonzero_terms:
        return "0"
    return _signed_terms_text(nonzero_terms)
