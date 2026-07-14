"""Sprint Parser — camadas [1]/[2] da arquitetura aprovada na auditoria:
normalização Unicode e aliases em português, puramente léxicas (regex/
bracket-matching sobre texto, nunca parsing/eval), que rodam ANTES de
qualquer roteamento de domínio ou de `safe_parse_expr`.

Por que isso precisa existir fora de `safe_parsing.py`: os roteadores de
domínio (`is_trigonometry_domain_expression`, `is_logarithm_domain_expression`,
etc.) decidem para qual área uma expressão vai a partir de regex sobre o
TEXTO BRUTO, antes de qualquer parse — "sen(x)" só é reconhecido como
trigonometria se já estiver escrito "sin(x)" nesse ponto. Por isso
`normalize_expression()` roda no topo de `math_engine/dispatcher.py:
solve_expression()`, antes da cascata de roteamento, não dentro de
`safe_parse_expr`.

Cada transformação só dispara em um padrão sintático inequívoco — nunca em
heurística "provavelmente". Qualquer coisa fora desses padrões passa
intocada e, se for realmente inválida, é rejeitada mais adiante por
`safe_parsing._reject_ambiguous_identifiers` ou pelo parser do SymPy, nunca
"adivinhada" aqui.

`normalize_expression()` é idempotente: aplicá-la duas vezes produz o mesmo
resultado que aplicá-la uma vez (todo padrão de entrada já normalizado deixa
de casar com os próprios regexes de origem — ver `tests/math_engine/
test_normalize.py`).
"""
from __future__ import annotations

import re

_SUPERSCRIPT_TO_DIGIT = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹", "0123456789")
_VALID_SUPERSCRIPT_RUN = re.compile(r"^⁻?[⁰¹²³⁴⁵⁶⁷⁸⁹]+$")
_SUPERSCRIPT_RUN = re.compile(r"[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+")

# Funções trigonométricas (canônicas + aliases em português) que aceitam a
# notação "nome²(arg)" — expoente ENTRE o nome e os parênteses, ex.
# "sen²(x)" significando "(sen(x))²". Forma distinta de "sin(x)²" (expoente
# DEPOIS do fechamento), que já é coberta pela reescrita genérica de
# sobrescrito sobre um grupo entre parênteses — ver _rewrite_superscript_atoms.
_FUNC_POWER_PATTERN = re.compile(
    r"\b(sin|cos|tan|sen|tg|asin|acos|atan)\s*([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)\s*\("
)

_PI_PATTERN = re.compile(r"π")
_INFINITY_PATTERN = re.compile(r"∞")
_UNICODE_OPERATORS = {
    "×": "*",
    "÷": "/",
    "−": "-",
    "≤": "<=",
    "≥": ">=",
    "≠": "!=",
}

_ROOT_PAREN = re.compile(r"√\s*\(")
_ROOT_ATOM = re.compile(r"√\s*([A-Za-z0-9_]+)")
_CBRT_PAREN = re.compile(r"∛\s*\(")
_CBRT_ATOM = re.compile(r"∛\s*([A-Za-z0-9_]+)")

_ALIAS_MAP = {"sen": "sin", "tg": "tan", "raiz": "sqrt"}
_ALIAS_PATTERN = re.compile(r"\b(sen|tg|raiz)\s*\(")


def _convert_superscript_run(run: str) -> str | None:
    """Converte um run de dígitos sobrescritos (com "⁻" opcional na frente)
    para uma string de expoente ASCII ("²" -> "2", "⁻²" -> "-2"). Retorna
    None se o run não bater exatamente com esse formato (ex. "⁻" sozinho,
    sem dígito) — chamador deve deixar o texto original intocado nesse caso,
    nunca adivinhar."""
    if not _VALID_SUPERSCRIPT_RUN.match(run):
        return None
    if run.startswith("⁻"):
        return "-" + run[1:].translate(_SUPERSCRIPT_TO_DIGIT)
    return run.translate(_SUPERSCRIPT_TO_DIGIT)


def _find_matching_paren(text: str, open_idx: int) -> int | None:
    """Índice do ")" que fecha o "(" em `open_idx`, ou None se não houver
    fechamento (entrada malformada — deixada intocada pelo chamador)."""
    depth = 0
    for i in range(open_idx, len(text)):
        if text[i] == "(":
            depth += 1
        elif text[i] == ")":
            depth -= 1
            if depth == 0:
                return i
    return None


def _rewrite_function_power(text: str) -> str:
    """"sen²(x)" -> "sen(x)**2" (mantém o nome original — a troca de alias
    para "sin" acontece depois, em _apply_aliases). Usa bracket-matching
    real (não regex) para localizar o fechamento do "(" que segue o
    sobrescrito, porque o conteúdo entre parênteses pode ser composto
    (ex. "sen²(x+1)")."""
    pieces: list[str] = []
    pos = 0
    for match in _FUNC_POWER_PATTERN.finditer(text):
        if match.start() < pos:
            continue
        name, sup_run = match.group(1), match.group(2)
        exponent = _convert_superscript_run(sup_run)
        open_idx = match.end() - 1
        close_idx = _find_matching_paren(text, open_idx)
        if exponent is None or close_idx is None:
            continue
        pieces.append(text[pos : match.start()])
        inner = text[open_idx + 1 : close_idx]
        pieces.append(f"{name}({inner})**{exponent}")
        pos = close_idx + 1
    pieces.append(text[pos:])
    return "".join(pieces)


def _replace_unicode_constants_and_operators(text: str) -> str:
    """π -> pi; ∞ -> oo; ×÷−≤≥≠ -> */−(ascii)<=>=!=. Substituições
    literais, seguras e inequívocas: nenhum desses caracteres Unicode tem
    outro significado no sistema. "∞" -> "oo" foi adicionado na Sprint
    12.1 para suportar limites/integrais em notação natural (ex.
    "lim x→∞"), mas é global como "π" -> "pi" porque "∞" também não tem
    nenhum outro significado possível fora desse contexto."""
    text = _PI_PATTERN.sub("pi", text)
    text = _INFINITY_PATTERN.sub("oo", text)
    for symbol, replacement in _UNICODE_OPERATORS.items():
        text = text.replace(symbol, replacement)
    return text


def _rewrite_roots(text: str) -> str:
    """"√(x+1)" -> "sqrt(x+1)" (o "(" que já existe vira o próprio abridor
    de sqrt, sem precisar localizar o fechamento manualmente); "√x"/"√8" ->
    "sqrt(x)"/"sqrt(8)" (argumento atômico: só o identificador/número que
    segue imediatamente o símbolo, mesmo escopo de `unicode_math.render_sqrt`
    do lado da saída). "∛" segue o mesmo padrão para "cbrt"."""
    text = _ROOT_PAREN.sub("sqrt(", text)
    text = _ROOT_ATOM.sub(r"sqrt(\1)", text)
    text = _CBRT_PAREN.sub("cbrt(", text)
    text = _CBRT_ATOM.sub(r"cbrt(\1)", text)
    return text


def _rewrite_superscript_atoms(text: str) -> str:
    """"x²" -> "x**2"; "(x+1)²" -> "(x+1)**2"; "2⁻³" -> "2**-3". Não precisa
    reconstruir o "base" — só inserir "**expoente" no lugar do sobrescrito é
    suficiente, porque a precedência normal de operadores já faz "(x+1)**2"
    e "sin(x)**2" significarem exatamente "a base inteira elevada ao
    expoente". Um sobrescrito sem nada válido antes dele (início da string,
    operador, vírgula, "(") fica intocado — é rejeitado mais adiante pela
    whitelist de caracteres do parser, nunca adivinhado aqui."""

    def repl(match: re.Match[str]) -> str:
        start = match.start()
        if start == 0:
            return match.group()
        prev_char = text[start - 1]
        if prev_char != ")" and not re.match(r"[A-Za-z0-9_]", prev_char):
            return match.group()
        exponent = _convert_superscript_run(match.group())
        if exponent is None:
            return match.group()
        return f"**{exponent}"

    return _SUPERSCRIPT_RUN.sub(repl, text)


def _apply_aliases(text: str) -> str:
    """sen(/tg(/raiz( -> sin(/tan(/sqrt( — só na forma de chamada de função
    (nome seguido de "("), nunca substring: "sensor(" não casa porque depois
    de "sen" o próximo caractere não-espaço precisa ser "(" imediatamente."""
    return _ALIAS_PATTERN.sub(lambda m: _ALIAS_MAP[m.group(1)] + "(", text)


def normalize_expression(text: str) -> str:
    """Ponto único de entrada da Sprint Parser — compõe, nesta ordem exata:

    1. sen²(x) -> sen(x)**2               (antes da troca de alias, preserva o nome)
    2. π -> pi; ∞ -> oo; ×÷−≤≥≠ -> ascii   (para que √π/superscripts em cima de pi funcionem)
    3. √/∛ atômico ou entre parênteses -> sqrt(...)/cbrt(...)
    4. x²/(x+1)²/2⁻³ -> **2/**2/**-3       (genérico, cobre inclusive sqrt(x)² e sen(x)²)
    5. sen/tg/raiz -> sin/tan/sqrt          (por último, forma de chamada apenas)

    Puramente textual: não importa nada de `safe_parsing`/SymPy, não faz
    parsing, não decide domínio. Idempotente — ver test_normalize.py.
    """
    text = _rewrite_function_power(text)
    text = _replace_unicode_constants_and_operators(text)
    text = _rewrite_roots(text)
    text = _rewrite_superscript_atoms(text)
    text = _apply_aliases(text)
    return text
