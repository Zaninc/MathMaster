r"""Sprint V2.7 — formatação do Motor de Combinatória.

Identidade visual de livro didático: toda operação devolve a DEDUÇÃO
simbólica como cadeia de igualdades em texto puro, ex.:

    C(10,3) = 10!/(3!*7!) = 120
    A(8,3) = 8!/(8-3)! = 8!/5! = 336
    P(6) = 6! = 720
    6! = 720

Contrato verificado empiricamente nas duas pontas do pipeline:

- `app/formatter/` (backend): a cadeia contém "=" e não casa com nenhum
  padrão de `classify.py` (a cabeça "C(10,3)" não é identificador de
  atribuição) — `format_result`/`render_math` a deixam byte a byte intacta.
- `to-latex.ts` (frontend): `resultToLatex` -> `expressionToLatex` divide
  por "=" (com espaço antes, o lookbehind de `EQUATION_SPLIT` nunca vê o
  "!" de fatorial) e cada pedaço é mathjs válido — "C(10,3)" vira C_{10,3}
  pela tabela de combinatória e "10!/(3!*7!)" vira \frac{10!}{3!\cdot 7!}
  nativamente. Por isso o separador de produto é SEMPRE "*" (o "·" da forma
  polar de complexos derruba o parser do mathjs) e nunca há ";" ou "|" na
  cadeia (quebrariam o split de segmentos rotulados e a reescrita de módulo).

`permutacao_repeticao` devolve só a fração (sem cabeça): não existe
notação de TEXTO PURO consagrada para P_n^{a,b,...} que sobreviva a esse
contrato (qualquer separador candidato colide acima) — o preview do input
já mostra a notação bonita via `to-latex.ts`.
"""
from __future__ import annotations


def format_factorial(n: int, value: int) -> str:
    return f"{n}! = {value}"


def format_permutation(n: int, value: int) -> str:
    return f"P({n}) = {n}! = {value}"


def format_arrangement(n: int, k: int, value: int) -> str:
    return f"A({n},{k}) = {n}!/({n}-{k})! = {n}!/{n - k}! = {value}"


def format_combination(n: int, k: int, value: int) -> str:
    return f"C({n},{k}) = {n}!/({k}!*{n - k}!) = {value}"


def format_permutation_with_repetition(
    n: int, repetitions: list[int], value: int
) -> str:
    denominator = "*".join(f"{repetition}!" for repetition in repetitions)
    return f"{n}!/({denominator}) = {value}"
