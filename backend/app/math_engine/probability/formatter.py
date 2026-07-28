r"""Sprint V2.8 — formatação do Motor de Probabilidade.

Mesma identidade visual de livro didático de `combinatorics/formatter.py`:
toda operação devolve a DEDUÇÃO simbólica como cadeia de igualdades em
texto puro, ex.:

    P(A) = 3/10 = 0.3
    P(Aᶜ) = 1-0.3 = 0.7
    P(A∪B) = 0.4+0.5-0.2 = 0.7
    P(A∩B) = 0.5*0.3 = 0.15
    P(A|B) = 0.2/0.5 = 0.4
    P(X=3) = C(10,3)*0.5**3*0.5**7 = 120*0.125*0.0078125 = 0.1171875

Contrato verificado nas duas pontas do pipeline (mesmo raciocínio de
`combinatorics/formatter.py`, reconferido aqui): a cadeia contém "=" e não
casa com nenhum padrão de `app/formatter/classify.py` (a cabeça "P(A)" não
é identificador de atribuição), então `format_result`/`render_math` a
deixam byte a byte intacta — só `superscript_exponents` mexe (converte
"**3"/"**7" em "³"/"⁷", mesmo mecanismo que `combinatorics/`s deduções de
potência não usam mas `polynomials/` já usa). Separador de produto é
SEMPRE "*" e nunca há ";" nem "|" ASCII solto fora da notação de
`condicional` — "|" aparece só na cabeça `P(A|B)`, que o frontend
reconhece com um recorte estrutural dedicado (ver `to-latex.ts`,
mesma técnica já usada para a forma polar de complexos e o somatório Σ),
não pela conversão genérica mathjs.

`format_decimal` é o único ponto de conversão Rational -> string decimal:
aritmética inteira pura (nunca `Float.evalf()`/`str()` do SymPy — testado
empiricamente que ele cai para notação científica em valores pequenos,
ex. `Rational(1,5)**10` vira "1.024000000e-7" em vez de "0.0000001024",
inaceitável para uma dedução didática). Se o denominador reduzido só tem
fatores 2 e 5, a decimal TERMINA e sai exata, com quantas casas forem
necessárias (ex. `0.2**10` -> "0.0000001024" exato). Caso contrário (ex.
1/6), arredonda para 10 casas decimais por divisão inteira
("arredonda-meio-para-cima"), sem nunca produzir notação científica —
"3/10" imprime "0.3", "1/8" imprime "0.125", "1/6" imprime
"0.1666666667". Testado empiricamente para os casos do enunciado
(`0.4+0.5-0.2` -> "0.7", `120*0.125*0.0078125` -> "0.1171875").
"""
from __future__ import annotations

from sympy import Rational
from sympy.core.expr import Expr

_ROUNDED_DECIMAL_PLACES = 10


def format_decimal(value: Expr) -> str:
    rational = Rational(value)
    numerator, denominator = abs(rational.p), rational.q
    sign = "-" if rational.p < 0 else ""

    remaining = denominator
    twos = 0
    while remaining % 2 == 0:
        remaining //= 2
        twos += 1
    fives = 0
    while remaining % 5 == 0:
        remaining //= 5
        fives += 1

    if remaining == 1:
        # Decimal exata: denominador só tem fatores 2 e 5.
        scale = max(twos, fives)
        scaled = numerator * 2 ** (scale - twos) * 5 ** (scale - fives)
    else:
        # Dízima: arredonda-meio-para-cima em `scale` casas decimais.
        scale = _ROUNDED_DECIMAL_PLACES
        scaled = (numerator * 10**scale * 2 + denominator) // (denominator * 2)

    digits = str(scaled).rjust(scale + 1, "0")
    if scale == 0:
        return f"{sign}{digits}"
    integer_part = digits[:-scale] or "0"
    decimal_part = digits[-scale:].rstrip("0")
    if decimal_part == "":
        return f"{sign}{integer_part}"
    return f"{sign}{integer_part}.{decimal_part}"


def format_probabilidade(favoraveis: int, total: int, value: Expr) -> str:
    return f"P(A) = {favoraveis}/{total} = {format_decimal(value)}"


def format_complementar(p: Expr, value: Expr) -> str:
    return f"P(Aᶜ) = 1-{format_decimal(p)} = {format_decimal(value)}"


def format_uniao(pa: Expr, pb: Expr, pinter: Expr, value: Expr) -> str:
    return (
        f"P(A∪B) = {format_decimal(pa)}+{format_decimal(pb)}-{format_decimal(pinter)}"
        f" = {format_decimal(value)}"
    )


def format_intersecao_independente(pa: Expr, pb: Expr, value: Expr) -> str:
    return f"P(A∩B) = {format_decimal(pa)}*{format_decimal(pb)} = {format_decimal(value)}"


def format_condicional(pinter: Expr, pb: Expr, value: Expr) -> str:
    return f"P(A|B) = {format_decimal(pinter)}/{format_decimal(pb)} = {format_decimal(value)}"


def format_independentes(
    pa: Expr, pb: Expr, pinter: Expr, product: Expr, is_independent: bool
) -> str:
    veredicto = "Eventos independentes" if is_independent else "Eventos dependentes"
    return (
        f"P(A)*P(B) = {format_decimal(pa)}*{format_decimal(pb)} = {format_decimal(product)}, "
        f"P(A∩B) = {format_decimal(pinter)} -> {veredicto}"
    )


def format_binomial(
    n: int,
    k: int,
    p: Expr,
    combinations: int,
    p_pow_k: Expr,
    one_minus_p_pow: Expr,
    value: Expr,
) -> str:
    one_minus_p = 1 - p
    return (
        f"P(X={k}) = C({n},{k})*{format_decimal(p)}**{k}*{format_decimal(one_minus_p)}**{n - k}"
        f" = {combinations}*{format_decimal(p_pow_k)}*{format_decimal(one_minus_p_pow)}"
        f" = {format_decimal(value)}"
    )
