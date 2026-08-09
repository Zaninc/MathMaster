"""Sprint V2.9 — ponto único de roteamento do passo a passo determinístico.
Nunca chamado por `/solve` (contrato `{expression, result, approx}`
intocado) — só pela rota nova `/solve/steps` em `main.py`.

Antes de decidir "isto é uma equação/sistema", exclui explicitamente
TODOS os outros domínios do motor, na MESMA ordem de prioridade de
`math_engine/dispatcher.py` — necessário porque vários deles usam "="
livremente por dentro (ex. `A=[[1,2],[3,4]]` é matriz, não equação;
`Σ(i=1..5) x=i` tem um "=" dentro do cabeçalho). Sem essa exclusão, um
texto de outro domínio cairia no parser de equação linear e falharia de
forma confusa (ou, em casos como matriz, um `AttributeError` cru em vez de
`ExpressionError`) em vez de reportar com clareza que aquela área ainda
não tem passo a passo nesta versão.

Sprint V2.9.1 — uma única equação agora é roteada por GRAU real (via
`sympy.degree` sobre `lhs - rhs` já expandido, nunca por regex): grau 1
(ou identidade/contradição, onde a diferença não sobra símbolo nenhum) vai
para `linear_equations`; grau exatamente 2 vai para `quadratic_equations`
(nova); qualquer outro grau continua rejeitado com mensagem amigável. Uma
entrada como "0x²+2x=4" (coeficiente de x² nulo) expande para grau 1 e cai
em `linear_equations` automaticamente — nenhum código dedicado a "casos
degenerados" existe neste módulo nem em `quadratic_equations.py`.

Sprint V2.10 — `derivada(expr, var)` é verificado ANTES da exclusão geral
de domínio de cálculo (`is_calculus_domain_expression`, que casaria
QUALQUER chamada de cálculo, incl. `integral`/`limite`, ainda fora de
escopo do passo a passo): `is_derivative_call` decide especificamente
"isto é uma derivada?" e, se for, delega para `derivatives.py` — o resto
do domínio de cálculo continua caindo na exclusão geral, com a mesma
mensagem amigável de sempre.

Sprint V2.10.1 — mesmo tratamento para `integral(expr, var)` INDEFINIDA
(2 argumentos): `is_indefinite_integral_call` decide "isto é uma integral
indefinida?" e delega para `integrals.py`.

Sprint V2.10.2 — mesmo tratamento para `integral(expr, var, inferior,
superior)` DEFINIDA (4 argumentos): `is_definite_integral_call` delega
para `definite_integrals.py`. `limite` continua sendo o único caso do
domínio de cálculo ainda fora de escopo, caindo na exclusão geral.

Sprint V2.11 — dentro de uma chamada `derivada(expr, var)` já confirmada,
uma segunda decisão (`advanced_derivatives.is_product_or_chain_shape`,
sobre a ÁRVORE do SymPy já parseada, nunca regex) escolhe entre
`derivatives.py` (V2.10, regra da potência/linearidade da soma) e
`advanced_derivatives.py` (regra do produto/regra da cadeia) — ANTES de
qualquer expansão polinomial, porque expressões como `(x+1)*(x²+3)` ou
`(x²+1)³` TAMBÉM se expandem para polinômios simples, mas o objetivo desta
sprint é ensinar a regra do produto/cadeia nesses casos, não escondê-la
atrás da expansão.

Sprint V2.12 — mesmo tratamento para `limite(expr, var, ponto)`:
`is_limit_call` decide especificamente "isto é um limite?" e delega para
`limits.py`, que classifica o caso (substituição direta, indeterminação
0/0, infinito por comparação de graus) sobre a árvore já parseada e
levanta sua própria mensagem amigável para o que ainda não é suportado —
nunca mais cai na exclusão geral de cálculo.

Sprint V2.12.1 — dentro de uma chamada `limite(expr, var, ponto)` já
confirmada, uma segunda decisão
(`trigonometric_limits.is_trigonometric_fundamental_shape`, sobre a
ÁRVORE já parseada, nunca regex) escolhe entre `limits.py` (V2.12,
racionais) e `trigonometric_limits.py` (`sen(ax)/x`, `x/sen(x)`,
`sen(ax)/sen(bx)`, `(1-cos(ax))/x²`) — ANTES do caminho racional, porque
esses casos usam `sin`/`cos` (nunca polinomiais) e precisam da
manipulação algébrica específica do limite fundamental, não da
comparação de graus.

Sprint V2.12.2 — a Regra de L'Hôpital (`lhopital.py`) é SEMPRE o último
recurso da cascata de limites: `lhopital.is_lhopital_shape` só é checada
DEPOIS de `is_trigonometric_fundamental_shape` e exige que numerador OU
denominador NÃO seja polinomial — nunca se sobrepõe ao caminho racional
da V2.12 (substituição direta/fatoração-cancelamento/comparação de
graus), que continua sendo tentado para qualquer razão inteiramente
polinomial. Só indeterminações 0/0 (ponto finito) e ∞/∞ (`x→∞`) com UMA
única aplicação são suportadas; se o novo limite ainda for indeterminado,
`lhopital.py` rejeita com mensagem amigável dedicada (aplicações
sucessivas ficam para versões futuras).

Sprint V2.13 — dentro de uma chamada `derivada(expr, var)` já confirmada,
uma TERCEIRA decisão (`quotient_rule.is_quotient_shape`, sobre a ÁRVORE
já parseada, nunca regex) escolhe entre `advanced_derivatives.py`
(produto/cadeia, denominador == 1), `quotient_rule.py` (denominador
dependendo da variável) e `derivatives.py` (V2.10, denominador constante
— `x²/5` continua sendo um monômio comum). Estrutural, sem sobreposição:
`is_product_or_chain_shape` já exclui QUALQUER denominador != 1, então
`x/sen(x)` nunca chega lá — cai direto na checagem de quociente.

Sprint V2.14 — dentro de uma chamada `integral(expr, var)` INDEFINIDA já
confirmada, uma segunda decisão (`u_substitution.find_substitution`,
sobre a ÁRVORE já parseada, nunca regex) escolhe entre
`u_substitution.py` (substituição imediata `∫f(g(x))·g'(x)dx`) e
`integrals.py` (V2.10.1, regra da potência/linearidade) — ANTES da
regra da potência, pelo mesmo motivo estrutural da V2.11:
`2x(x²+1)³` TAMBÉM se expande para um polinômio que `integrals.py`
saberia integrar termo a termo, mas o objetivo desta sprint é ensinar a
substituição nesses casos, não escondê-la atrás da expansão. Integral
DEFINIDA continua inteiramente fora deste roteamento (fora de escopo da
V2.14) — `is_definite_integral_call` é checado separadamente, sem
nenhuma consulta a `u_substitution.py`.

Sprint V2.15 — dentro de uma chamada `integral(expr, var)` INDEFINIDA já
confirmada, uma TERCEIRA decisão (`integration_by_parts.
find_integration_by_parts`, sobre a ÁRVORE já parseada, nunca regex) é
tentada DEPOIS de `u_substitution.find_substitution` e ANTES do fallback
para `integrals.py`: escolhe `integration_by_parts.py` (`∫u dv = uv -
∫v du`, um fator algébrico emparelhado com log/sen/cos/exp de argumento
NÃO-composto — argumento composto já pertence à V2.14, nunca chega aqui
porque `find_substitution` já o reivindicou antes) quando aplicável.
Estrutural, sem sobreposição: `find_substitution` só reivindica
composições `f(g(x))·g'(x)` genuínas (`_outer_shape` exige que a base/
argumento seja DIFERENTE da própria variável), então `x·eˣ`/`x·sen(x)`/
`ln(x)` nunca casam lá — chegam intactos à checagem de partes.

Sprint V2.16 — dentro de uma chamada `integral(expr, var)` INDEFINIDA já
confirmada, uma QUARTA decisão é tentada DEPOIS de
`integration_by_parts.find_integration_by_parts` e ANTES do fallback para
`integrals.py`: `partial_fractions.is_improper_rational_function` é
checada primeiro (levanta a mensagem amigável DEDICADA sobre divisão
polinomial se `expr` for uma função racional genuína porém imprópria —
grau do numerador >= grau do denominador — ANTES de qualquer outra
tentativa), depois `partial_fractions.find_partial_fractions` (sobre a
ÁRVORE já parseada, nunca regex) escolhe `partial_fractions.py` quando o
denominador fatora em 2+ fatores LINEARES (`factor_list`, distintos ou
repetidos). Estrutural, sem sobreposição: `2x(x²+1)³`/`x·eˣ` nunca têm
denominador != 1 (`.as_numer_denom()` devolve `denom=1` pra qualquer
produto puro), então nunca chegam a esta checagem; `1/(x²+1)` (fator
irredutível de grau >= 2) e `1/(x+1)²` (um único fator, decomposição
pedagogicamente vazia) devolvem `None` e caem no fallback amigável
genérico de `integrals.py`, sem nenhum código de rejeição dedicado.

Sprint V2.17 — dentro de uma chamada `integral(expr, var)` INDEFINIDA já
confirmada, uma QUINTA (e última) decisão é tentada DEPOIS de
`partial_fractions.find_partial_fractions` e ANTES do fallback para
`integrals.py`: `trig_integrals.is_trig_power_shape` (sobre a ÁRVORE já
parseada, nunca regex) escolhe `trig_integrals.py` quando `expr` é
EXATAMENTE um produto de potências de `sen(x)`/`cos(x)`/`tan(x)` (argumento
igual à própria variável, nunca composto) pertencente a uma tabela FIXA
de formas suportadas (`sen²`, `cos²`, `sen³`, `cos³`, `sen²cos²`,
`sen³cos²`, `sen²cos³`, `tan²`). Estrutural, sem sobreposição: nenhuma das
formas acima tem denominador != 1 nem casa como `f(g(x))·g'(x)` genuíno
(`sen(x)²` sozinho falha o teste de coeficiente constante de
`find_substitution`, confirmado empiricamente), então substituição/partes/
frações parciais nunca as reivindicam antes desta checagem chegar.

Sprint V2.18 — dentro de uma chamada `integral(expr, var)` INDEFINIDA já
confirmada, `polynomial_division.find_polynomial_division` passa a ser
checada ANTES de `partial_fractions.find_partial_fractions` (na MESMA
posição que a V2.16 já reservava para a checagem de fração imprópria,
substituindo a antiga rejeição imediata `is_improper_rational_function`
por uma divisão de verdade): quando `expr` é uma fração racional genuína
porém IMPRÓPRIA (grau do numerador >= grau do denominador), `p(x)/q(x) =
Q(x) + r(x)/q(x)` é calculado via `sympy.div` e a parte fracionária
`r(x)/q(x)`, quando ainda precisa de decomposição, REAPROVEITA o mesmo
`partial_fractions._decomposition_body` que `find_partial_fractions` já
usa — nunca um segundo resolvedor. Como toda fração imprópria falha o
teste de propriedade (`grau(numer) < grau(denom)`) de `find_partial_
fractions`, a ORDEM entre as duas checagens não muda qual delas reivindica
qual caso (são mutuamente exclusivas por construção); a ordem é mantida
apenas por continuidade com a posição que a V2.16 já documentava aqui.
Um denominador com fator de grau >= 3 ou múltiplos fatores quadráticos
continua fora de escopo mesmo depois da divisão — `find_polynomial_
division` devolve `None` nesse caso (nunca finge dividir só pela metade),
caindo adiante na cascata até o fallback amigável genérico de
`integrals.py`, exatamente como qualquer outra forma fora de escopo desde
a V2.16."""
from __future__ import annotations

from sympy import degree, expand

from ..analytic_geometry.dispatcher import is_analytic_geometry_domain_expression
from ..calculus.dispatcher import (
    is_calculus_domain_expression,
    is_definite_integral_call,
    is_derivative_call,
    is_indefinite_integral_call,
    is_limit_call,
    parse_derivative_call,
    parse_integral_call,
    parse_limit_call,
)
from ..combinatorics.dispatcher import is_combinatorics_domain_expression
from ..complex.dispatcher import is_complex_domain_expression
from ..dispatcher import normalize_all
from ..equations.dispatcher import (
    is_equation_domain_expression,
    looks_like_inequality,
    split_equations,
)
from ..errors import ExpressionError
from ..functions.dispatcher import is_function_domain_expression
from ..logarithms.dispatcher import is_logarithm_domain_expression
from ..matrix.dispatcher import is_matrix_domain_expression
from ..polynomials.dispatcher import is_polynomial_domain_expression
from ..probability.dispatcher import is_probability_domain_expression
from ..summation.dispatcher import is_summation_domain_expression
from ..trigonometry.dispatcher import is_trigonometry_domain_expression
from .advanced_derivatives import generate_advanced_derivative_steps, is_product_or_chain_shape
from .definite_integrals import generate_definite_integral_steps
from .derivatives import generate_derivative_steps
from .integrals import generate_integral_steps
from .integration_by_parts import find_integration_by_parts, generate_integration_by_parts_steps
from .lhopital import generate_lhopital_steps, is_lhopital_shape
from .limits import generate_limit_steps
from .linear_equations import generate_linear_equation_steps, parse_equation_sides
from .linear_systems import generate_linear_system_steps
from .models import MathStep
from .partial_fractions import find_partial_fractions, generate_partial_fraction_steps
from .polynomial_division import find_polynomial_division, generate_polynomial_division_steps
from .quadratic_equations import generate_quadratic_equation_steps
from .quotient_rule import generate_quotient_rule_steps, is_quotient_shape
from .trig_integrals import generate_trig_integral_steps, is_trig_power_shape
from .trig_substitution import find_trig_substitution, generate_trig_substitution_steps
from .trigonometric_limits import (
    generate_trigonometric_limit_steps,
    is_trigonometric_fundamental_shape,
)
from .u_substitution import find_substitution, generate_u_substitution_steps
from .validation import (
    EMPTY_EXPRESSION_MESSAGE,
    UNSUPPORTED_DOMAIN_MESSAGE,
    UNSUPPORTED_EQUATION_MESSAGE,
    UNSUPPORTED_INEQUALITY_MESSAGE,
    require_single_symbol,
)

_NON_EQUATION_DOMAIN_CHECKS = (
    is_analytic_geometry_domain_expression,
    is_summation_domain_expression,
    is_matrix_domain_expression,
    is_complex_domain_expression,
    is_polynomial_domain_expression,
    is_combinatorics_domain_expression,
    is_probability_domain_expression,
    is_calculus_domain_expression,
    is_function_domain_expression,
    is_trigonometry_domain_expression,
    is_logarithm_domain_expression,
)


def _generate_single_equation_steps(text: str) -> list[MathStep]:
    if looks_like_inequality(text):
        raise ExpressionError(UNSUPPORTED_INEQUALITY_MESSAGE)

    lhs, rhs = parse_equation_sides(text)
    symbols = lhs.free_symbols | rhs.free_symbols
    require_single_symbol(symbols)
    symbol = next(iter(symbols))

    diff = expand(lhs - rhs)
    if not diff.free_symbols:
        # Identidade/contradição ("2x+1=2x+1"/"2x+1=2x+3") — grau
        # irrelevante, `linear_equations.reduce_to_value` já sabe tratar.
        return generate_linear_equation_steps(text)

    try:
        grau = degree(diff, symbol)
    except Exception as exc:
        raise ExpressionError(UNSUPPORTED_EQUATION_MESSAGE) from exc

    if grau == 1:
        return generate_linear_equation_steps(text)
    if grau == 2:
        return generate_quadratic_equation_steps(text)
    raise ExpressionError(UNSUPPORTED_EQUATION_MESSAGE)


def generate_steps(expression: str) -> list[MathStep]:
    expression = expression.strip()
    if not expression:
        raise ExpressionError(EMPTY_EXPRESSION_MESSAGE)

    normalized = normalize_all(expression)

    if is_derivative_call(normalized):
        expr, symbol = parse_derivative_call(normalized)
        if is_product_or_chain_shape(expr, symbol):
            return generate_advanced_derivative_steps(normalized)
        if is_quotient_shape(expr, symbol) is not None:
            return generate_quotient_rule_steps(normalized)
        return generate_derivative_steps(normalized)

    if is_indefinite_integral_call(normalized):
        expr, symbol = parse_integral_call(normalized)
        if find_substitution(expr, symbol) is not None:
            return generate_u_substitution_steps(normalized)
        if find_integration_by_parts(expr, symbol) is not None:
            return generate_integration_by_parts_steps(normalized)
        if find_polynomial_division(expr, symbol) is not None:
            return generate_polynomial_division_steps(normalized)
        if find_partial_fractions(expr, symbol) is not None:
            return generate_partial_fraction_steps(normalized)
        if is_trig_power_shape(expr, symbol):
            return generate_trig_integral_steps(normalized)
        if find_trig_substitution(expr, symbol) is not None:
            return generate_trig_substitution_steps(normalized)
        return generate_integral_steps(normalized)

    if is_definite_integral_call(normalized):
        return generate_definite_integral_steps(normalized)

    if is_limit_call(normalized):
        expr, symbol, point = parse_limit_call(normalized)
        if is_trigonometric_fundamental_shape(expr, symbol, point):
            return generate_trigonometric_limit_steps(normalized)
        if is_lhopital_shape(expr, symbol, point):
            return generate_lhopital_steps(normalized)
        return generate_limit_steps(normalized)

    if any(check(normalized) for check in _NON_EQUATION_DOMAIN_CHECKS):
        raise ExpressionError(UNSUPPORTED_DOMAIN_MESSAGE)

    if not is_equation_domain_expression(normalized):
        raise ExpressionError(UNSUPPORTED_DOMAIN_MESSAGE)

    parts = split_equations(normalized)
    if len(parts) > 1:
        return generate_linear_system_steps(normalized)
    return _generate_single_equation_steps(normalized)
