"""Sprint V2.9 — infraestrutura compartilhada de apresentação dos passos.
Cada `MathStep.expression` é sempre `str()` de objetos SymPy reais (nunca
texto inventado) — estas funções só decidem COMO montar a string final
("lado=lado") e o título em português de uma operação já realizada pelo
motor (`linear_equations.py`/`linear_systems.py`), nunca calculam nada
matematicamente novo."""
from __future__ import annotations

import re

from sympy.core.expr import Expr

from .models import TitleSegment


def eq_text(lhs: Expr, rhs: Expr) -> str:
    return f"{lhs}={rhs}"


def text_segment(content: str) -> TitleSegment:
    """Hotfix V2.9.1a — pedaço de título em texto comum (nunca passa pelo
    pipeline de KaTeX do frontend)."""
    return TitleSegment(type="text", content=content)


def math_segment(content: Expr | str) -> TitleSegment:
    """Hotfix V2.9.1a — pedaço de título com matemática embutida. `content`
    é sempre texto matemático puro (mesmo contrato de `MathStep.expression`
    — `str()` de um objeto SymPy real, ou uma string já nesse formato),
    nunca LaTeX bruto."""
    return TitleSegment(type="math", content=str(content))


def _clean(term: Expr) -> str:
    """Cosmético, só para TÍTULOS (nunca para `expression`, que precisa
    continuar 100% parseável pelo pipeline `to-latex.ts` do frontend): o
    termo movido é sempre da forma `coeficiente*x` ou `x` (o símbolo ativo é
    sempre uma única letra, garantia de `safe_parsing.py`), então remover
    "*" não tem ambiguidade nenhuma aqui — vira "2x" em vez de "2*x"."""
    return str(term).replace("*", "")


def move_title(term: Expr) -> str:
    """Título de um passo que move `term` (um termo com x ou uma
    constante) para o outro lado da equação — a operação real é sempre
    "subtrair `term` dos dois lados"; quando `term` já é negativo, subtrair
    um negativo é somar um positivo, fraseado de forma mais natural."""
    text = _clean(term)
    if text.startswith("-"):
        return f"Somando {text[1:]} dos dois lados"
    return f"Subtraindo {text} dos dois lados"


def isolate_title(coeff: Expr) -> str:
    """Título do passo final que isola a variável dividindo pelo
    coeficiente. Coeficiente unitário fracionário (ex. 1/3) é fraseado como
    multiplicação pelo denominador — mesma operação, forma mais natural em
    português (`equação com x/3` -> "multiplicar por 3", não "dividir por
    1/3")."""
    if coeff.is_Rational and coeff.p == 1 and coeff.q != 1:
        return f"Multiplicando os dois lados por {coeff.q}"
    return f"Dividindo os dois lados por {_clean(coeff)}"


def paren_if_negative(value: Expr) -> str:
    """Sprint V2.9.1 (originalmente privado em `quadratic_equations.py`,
    promovido na V2.10 para reuso por `derivatives.py`) — parênteses só
    quando o valor é negativo, evitando ambiguidade ao montar strings
    manuais de substituição (ex. "3*(-4)*x**2", nunca "3*-4*x**2")."""
    return f"({value})" if value.is_negative else str(value)


# --- Sprint V2.10.1 — compartilhado entre derivatives.py e integrals.py ----
# (originalmente privado em derivatives.py; promovido aqui para
# `integrals.py` reaproveitar a MESMA classificação de termo em vez de
# duplicá-la — a forma "coeficiente*x^n" que a regra da potência sabe
# explicar é idêntica nos dois domínios, só a operação final muda.)

_SUPERSCRIPT_DIGITS = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")


def classify_polynomial_term(term: Expr, symbol) -> tuple[Expr, int] | None:
    """`(coeficiente, expoente)` se `term` for um monômio simples
    `coeficiente * symbol**expoente` com expoente inteiro >= 0 — a única
    forma que a regra da potência (derivada OU integral) desta versão sabe
    explicar passo a passo. `None` (nunca "chuta") para qualquer outra
    forma — função transcendental, produto/quociente entre variáveis,
    expoente negativo ou fracionário (ex. 1/x = x**-1, fora de escopo tanto
    para derivar quanto para integrar nesta versão)."""
    if not term.has(symbol):
        return term, 0
    coeff, xpart = term.as_independent(symbol, as_Add=False)
    if xpart == symbol:
        return coeff, 1
    if xpart.is_Pow and xpart.base == symbol and xpart.exp.is_Integer and xpart.exp > 0:
        return coeff, int(xpart.exp)
    return None


def term_expression(coeff: Expr, exponent: int, symbol: Expr) -> Expr:
    if exponent == 0:
        return coeff
    return coeff * symbol**exponent


def _superscript(n: int) -> str:
    return str(n).translate(_SUPERSCRIPT_DIGITS)


def term_text_plain(coeff: Expr, exponent: int, symbol: Expr) -> str:
    """Texto legível SÓ para o `title` de fallback (nunca para `expression`/
    `title_segments`, que precisam continuar 100% parseáveis pelo
    `to-latex.ts`) — mesmo espírito de `_clean`, com expoente em sobrescrito
    Unicode em vez de "**n"."""
    if exponent == 0:
        return str(coeff)
    power = str(symbol) if exponent == 1 else f"{symbol}{_superscript(exponent)}"
    if coeff == 1:
        return power
    if coeff == -1:
        return f"-{power}"
    return f"{coeff}{power}"


# --- Sprint V2.10.2 — compartilhado entre definite_integrals.py e limits.py --
# (originalmente privado em definite_integrals.py como `_substitute_bound_
# text`; promovido aqui na V2.12 para `limits.py` reaproveitar a MESMA
# técnica de substituição textual em vez de duplicá-la.)


def substitute_symbol_text(expression: Expr, symbol: Expr, value: Expr) -> str:
    """"x**3/3" com x substituído pelo VALOR (entre parênteses, nunca
    simplificado) -> "(2)**3/3". Substituição por texto (não `.subs()`, que
    avaliaria a aritmética na hora — o mesmo problema já documentado em
    `quadratic_equations._bhaskara_steps`/`derivatives._power_rule_
    unevaluated_text`): `symbol` é sempre um identificador de uma letra
    (garantia de `safe_parsing.py`), então a fronteira de palavra `\\b` troca
    exatamente as ocorrências da variável, nunca um dígito ou outro
    identificador."""
    return re.sub(rf"\b{re.escape(str(symbol))}\b", f"({value})", str(expression))


# --- Sprint V2.13 — compartilhado entre advanced_derivatives.py e --------
# quotient_rule.py (originalmente privado em advanced_derivatives.py como
# `_paren_if_sum`; promovido aqui para `quotient_rule.py` reaproveitar a
# MESMA regra em vez de duplicá-la — a mesma lição da V2.10.2 se aplica a
# qualquer módulo que concatene termos manualmente.)


def wrap_if_sum(expr: Expr) -> str:
    """Parênteses só quando `expr` é uma soma no topo — evita ambiguidade
    ao concatenar manualmente termos de um produto/quociente (mesma lição
    da V2.10.2, `definite_integrals._substitute_bound_text`: nunca
    concatenar sem parênteses ao redor de uma soma)."""
    return f"({expr})" if expr.is_Add else str(expr)


def linear_combination_expression(terms: list[Expr], symbol: Expr, operation: str) -> str:
    """"{operation}(t1, x)+{operation}(t2, x)-{operation}(t3, x)..." — cada
    termo isolado dentro da chamada técnica (`derivada(...)`/`integral(...)`,
    ambas já reconhecidas pelo `productHandler` existente em
    `to-latex.ts`), com o sinal de subtração aparecendo FORA da chamada
    (nunca "derivada(-5*x, x)", que esconderia o sinal dentro dos
    parênteses)."""
    parts: list[str] = []
    for index, term in enumerate(terms):
        negative = term.could_extract_minus_sign()
        piece = -term if negative else term
        if index == 0:
            sign = "-" if negative else ""
        else:
            sign = "-" if negative else "+"
        parts.append(f"{sign}{operation}({piece}, {symbol})")
    return "".join(parts)
