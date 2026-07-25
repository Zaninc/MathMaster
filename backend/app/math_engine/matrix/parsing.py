r"""Sprint V2.2 — Motor de Matrizes: parsing de literais e expressões
matriciais.

Sintaxe principal:

    [[1,2],[3,4]]                        matriz literal (linhas entre
                                          colchetes, separadas por vírgula)
    [[1,2],[3,4]] + [[5,6],[7,8]]        soma
    [[1,2],[3,4]] - [[5,6],[7,8]]        subtração
    [[1,2],[3,4]] * [[5,6],[7,8]]        multiplicação
    2 * [[1,2],[3,4]]                    escalar
    [[1,2],[3,4]] ^ 2                    potência inteira
    det(...) / inv(...) / transpose(...) / trace(...)
    determinante(...) / inversa(...) / transposta(...) / traço(...)

Parsing puramente estrutural (bracket-counting sobre colchetes/parênteses,
NUNCA regex sobre o CONTEÚDO da matriz) — mesmo padrão de
`summation/parsing.py`/`calculus/dispatcher.py`: cada célula (número
inteiro, racional ou expressão simbólica simples) só chega ao SymPy via
`safe_parse_expr`, em `evaluator.py`, depois de isolada como texto por este
módulo. "[[" é um marcador léxico inequívoco — nenhuma outra área do motor
usa colchete duplo (o único outro uso de "[" hoje, listas de pontos em
`analytic_geometry`, é sempre um único colchete).

Produz uma árvore de `MatrixNode` (literal / escalar / chamada de função /
operação binária) via um parser de descida recursiva com precedência
("^" > "*" > "+"/"-", mesma ordem convencional), em vez de casar só os
poucos padrões dos exemplos da sprint — isso é o que permite expressões
como "[[1,2],[3,4]] + [[5,6],[7,8]] * 2" funcionarem de graça, sem
casos especiais.

Sprint V2.2.1 (Variáveis Locais para Matrizes) — um PROGRAMA de matriz é
zero ou mais atribuições ("NOME = expressão-de-matriz") seguidas de UMA
expressão final, cada instrução separada por quebra de linha OU ";" no
nível mais alto (fora de colchetes/parênteses — bracket-counting, nunca
split ingênuo, ver `_split_statements`). Um identificador maiúsculo
("A", "B", "M1") que NÃO é seguido de "(" — já reconhecido como
`ScalarNode` desde a Sprint V2.2, ponto de extensão documentado ali —
continua sendo esse mesmo nó; quem decide se ele é uma referência de
variável de matriz ou um parâmetro escalar livre é `evaluator.py`, no
momento da avaliação (o ambiente local só existe ali, nunca aqui).
Identificador minúsculo continua 100% como antes (parâmetro escalar
livre) — só maiúsculo entra no namespace de variável de matriz.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Union

from ..errors import ExpressionError

# --- AST ---------------------------------------------------------------


@dataclass(frozen=True)
class MatrixLiteralNode:
    """Uma matriz literal já dividida em linhas/células, mas com o texto de
    cada célula ainda cru (não sympificado) — `evaluator.py` decide como
    interpretar cada célula."""

    rows: tuple[tuple[str, ...], ...]


@dataclass(frozen=True)
class ScalarNode:
    """Um átomo escalar (número ou identificador) ainda cru, mesmo texto
    que chegaria a uma célula de matriz — reaproveita o mesmo caminho de
    avaliação em `evaluator.py`."""

    text: str


@dataclass(frozen=True)
class MatrixCallNode:
    """Uma chamada de função de matriz já canonicalizada (aliases PT-BR
    resolvidos aqui, nunca em `evaluator.py`)."""

    name: str  # "det" | "inv" | "transpose" | "trace"
    argument: "MatrixNode"


@dataclass(frozen=True)
class MatrixBinaryOpNode:
    operator: str  # "+" | "-" | "*" | "^"
    left: "MatrixNode"
    right: "MatrixNode"


MatrixNode = Union[MatrixLiteralNode, ScalarNode, MatrixCallNode, MatrixBinaryOpNode]


@dataclass(frozen=True)
class AssignmentNode:
    """Uma atribuição de variável de matriz local ("NOME = expressão") já
    parseada — `matrix` é a MESMA árvore `MatrixNode` de sempre (reaproveita
    `_parse_expression` por completo; uma atribuição pode ter qualquer
    expressão do lado direito, não só um literal, ex. "A = [[1,2],[3,4]] +
    [[1,1],[1,1]]"). `evaluator.py` decide se o valor avaliado é realmente
    uma matriz (nunca um escalar — fora do escopo desta sprint)."""

    name: str
    matrix: MatrixNode


@dataclass(frozen=True)
class ProgramNode:
    """Zero ou mais `AssignmentNode` seguidos de UMA expressão final —
    produzido por `parse_matrix_program`, o novo ponto de entrada de
    `dispatcher.py`. As variáveis existem só durante a avaliação deste
    programa (`evaluator.evaluate_matrix_program` descarta o ambiente ao
    final) — nunca há estado entre chamadas do `/solve`."""

    assignments: tuple[AssignmentNode, ...]
    expression: MatrixNode


# Nome digitado -> nome canônico usado por `evaluator.py`/`dispatcher.py`.
CANONICAL_FUNCTION_NAMES: dict[str, str] = {
    "det": "det",
    "determinante": "det",
    "inv": "inv",
    "inversa": "inv",
    "transpose": "transpose",
    "transposta": "transpose",
    "trace": "trace",
    "traço": "trace",
}

# Sprint V2.2.1 — nomes que não podem ser usados como variável de matriz:
# as próprias funções de matriz (`CANONICAL_FUNCTION_NAMES`, incluindo os
# aliases PT-BR — evita "Det = [[1,2],[3,4]]" colidir com "det(...)" de
# forma confusa) mais o vocabulário de célula pedido explicitamente
# (trigonometria/log/raiz). Comparação é case-insensitive (`name.lower()`)
# — "Det"/"DET" são igualmente reservados, não só "det" (que já cairia no
# erro de nome inválido antes disso, por não começar com maiúscula).
RESERVED_NAMES: frozenset[str] = frozenset(CANONICAL_FUNCTION_NAMES) | {
    "sin",
    "cos",
    "tan",
    "ln",
    "log",
    "sqrt",
}

# Variável de matriz: letra maiúscula seguida de letras/dígitos/underscore
# — "A", "B", "M1", "Matriz2". Minúsculo inicial nunca é nome de variável
# de matriz (continua sendo parâmetro escalar livre, comportamento
# intocado desde antes desta sprint).
_NAME_PATTERN = re.compile(r"^[A-Z][A-Za-z0-9_]*$")


# --- Bracket-counting (nunca regex) -------------------------------------


def _find_matching_bracket(text: str, open_idx: int, open_char: str, close_char: str) -> int:
    """Índice do `close_char` que fecha `open_char` em `open_idx`. Mesma
    técnica de `summation/parsing.py:_find_matching_paren`, generalizada
    para o par de delimitador ser parametrizável (usada tanto para "()"
    quanto para "[]")."""
    depth = 0
    for i in range(open_idx, len(text)):
        if text[i] == open_char:
            depth += 1
        elif text[i] == close_char:
            depth -= 1
            if depth == 0:
                return i
    delimiters = f"'{open_char}{close_char}'"
    raise ExpressionError(f"Delimitador {delimiters} não fechado em: {text}")


def _split_top_level(text: str, separator: str) -> list[str]:
    """Mesma técnica de `summation/parsing.py:_split_top_level_args`,
    duplicada aqui deliberadamente (cada área do motor é self-contained) —
    também respeita colchetes, não só parênteses/chaves, para dividir
    linhas de uma matriz ("[1,2],[3,4]") sem cortar dentro de cada linha."""
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    for char in text:
        if char in "([{":
            depth += 1
        elif char in ")]}":
            depth -= 1
        if char == separator and depth == 0:
            parts.append("".join(current))
            current = []
            continue
        current.append(char)
    parts.append("".join(current))
    return [part.strip() for part in parts]


def _skip_whitespace(text: str, pos: int) -> int:
    while pos < len(text) and text[pos].isspace():
        pos += 1
    return pos


# --- Literal de matriz ---------------------------------------------------


def _parse_matrix_literal(text: str) -> MatrixLiteralNode:
    """`text` é exatamente "[...]" (colchete externo já isolado pelo
    chamador via `_find_matching_bracket`). Extrai as linhas — cada uma seu
    próprio "[...]" — e, dentro de cada linha, as células por vírgula no
    nível mais alto. Valida aqui (não em `validation.py`) porque isto é
    estrutura sintática, não uma regra semântica sobre uma matriz já
    avaliada: colchetes balanceados (garantido pelo bracket-matching do
    chamador), espaços (tolerados por `strip()` em cada célula/linha),
    matriz vazia e linhas de tamanhos diferentes."""
    inner = text[1:-1].strip()
    if not inner:
        raise ExpressionError("A matriz não pode estar vazia.")

    row_texts = _split_top_level(inner, ",")
    rows: list[tuple[str, ...]] = []
    for row_text in row_texts:
        if not (row_text.startswith("[") and row_text.endswith("]")):
            raise ExpressionError(
                f"Cada linha da matriz precisa estar entre colchetes: '{row_text}'."
            )
        cells_text = row_text[1:-1].strip()
        if not cells_text:
            raise ExpressionError("A matriz não pode ter uma linha vazia.")
        cells = tuple(_split_top_level(cells_text, ","))
        if any(cell == "" for cell in cells):
            raise ExpressionError(f"Elemento vazio na linha da matriz: '{row_text}'.")
        rows.append(cells)

    column_count = len(rows[0])
    if any(len(row) != column_count for row in rows):
        raise ExpressionError(
            "Todas as linhas da matriz devem ter o mesmo número de colunas."
        )

    return MatrixLiteralNode(rows=tuple(rows))


# --- Expressão (descida recursiva com precedência) -----------------------


def _parse_primary(text: str, pos: int) -> tuple[MatrixNode, int]:
    pos = _skip_whitespace(text, pos)
    if pos >= len(text):
        raise ExpressionError("Expressão de matriz incompleta.")

    char = text[pos]

    if char == "[":
        close_idx = _find_matching_bracket(text, pos, "[", "]")
        node = _parse_matrix_literal(text[pos : close_idx + 1])
        return node, close_idx + 1

    if char == "(":
        close_idx = _find_matching_bracket(text, pos, "(", ")")
        inner_text = text[pos + 1 : close_idx]
        inner_node, inner_end = _parse_expression(inner_text, 0)
        inner_end = _skip_whitespace(inner_text, inner_end)
        if inner_end != len(inner_text):
            raise ExpressionError(f"Expressão inválida entre parênteses: {text[pos:close_idx + 1]}")
        return inner_node, close_idx + 1

    if char.isalpha() or char == "_":
        start = pos
        while pos < len(text) and (text[pos].isalnum() or text[pos] == "_"):
            pos += 1
        name = text[start:pos]
        after_name = _skip_whitespace(text, pos)

        if after_name < len(text) and text[after_name] == "(":
            canonical = CANONICAL_FUNCTION_NAMES.get(name)
            if canonical is None:
                raise ExpressionError(f"Função de matriz desconhecida: '{name}'.")
            close_idx = _find_matching_bracket(text, after_name, "(", ")")
            argument_text = text[after_name + 1 : close_idx]
            argument_node, arg_end = _parse_expression(argument_text, 0)
            arg_end = _skip_whitespace(argument_text, arg_end)
            if arg_end != len(argument_text):
                raise ExpressionError(f"Argumento inválido em '{name}(...)'.")
            return MatrixCallNode(name=canonical, argument=argument_node), close_idx + 1

        # Ponto de extensão futuro (ver docstring do módulo): um
        # identificador maiúsculo aqui é hoje só um parâmetro livre
        # (ScalarNode) — um dia poderia virar uma referência de matriz.
        return ScalarNode(text=name), pos

    if char.isdigit():
        start = pos
        while pos < len(text) and (text[pos].isdigit() or text[pos] == "."):
            pos += 1
        return ScalarNode(text=text[start:pos]), pos

    raise ExpressionError(f"Caractere inesperado na expressão de matriz: '{char}'.")


def _parse_power(text: str, pos: int) -> tuple[MatrixNode, int]:
    left, pos = _parse_primary(text, pos)
    while True:
        next_pos = _skip_whitespace(text, pos)
        if next_pos < len(text) and text[next_pos] == "^":
            right, pos = _parse_primary(text, next_pos + 1)
            left = MatrixBinaryOpNode(operator="^", left=left, right=right)
        else:
            break
    return left, pos


def _parse_term(text: str, pos: int) -> tuple[MatrixNode, int]:
    left, pos = _parse_power(text, pos)
    while True:
        next_pos = _skip_whitespace(text, pos)
        if next_pos < len(text) and text[next_pos] == "*":
            right, pos = _parse_power(text, next_pos + 1)
            left = MatrixBinaryOpNode(operator="*", left=left, right=right)
        else:
            break
    return left, pos


def _parse_expression(text: str, pos: int) -> tuple[MatrixNode, int]:
    left, pos = _parse_term(text, pos)
    while True:
        next_pos = _skip_whitespace(text, pos)
        if next_pos < len(text) and text[next_pos] in "+-":
            operator = text[next_pos]
            right, pos = _parse_term(text, next_pos + 1)
            left = MatrixBinaryOpNode(operator=operator, left=left, right=right)
        else:
            break
    return left, pos


def parse_matrix_expression(expression: str) -> MatrixNode:
    node, end = _parse_expression(expression, 0)
    end = _skip_whitespace(expression, end)
    if end != len(expression):
        raise ExpressionError(f"Não foi possível interpretar a expressão de matriz: {expression}")
    return node


# --- Programa (atribuições + expressão final) -----------------------------


def _split_statements(text: str) -> list[str]:
    """Divide `text` em instruções por "\\n" OU ";" no nível mais alto —
    fora de colchetes/parênteses/chaves — num único bracket-counting
    (nunca um split ingênuo, e nunca dois passes separados para os dois
    separadores: os dois são tratados igualmente, no mesmo laço, mesma
    técnica de `_split_top_level` generalizada para múltiplos caracteres
    de separação). Instruções vazias (linha em branco, ";" duplo,
    espaço) são descartadas aqui — o chamador nunca precisa filtrar de
    novo."""
    statements: list[str] = []
    depth = 0
    current: list[str] = []
    for char in text:
        if char in "([{":
            depth += 1
        elif char in ")]}":
            depth -= 1
        if char in "\n;" and depth == 0:
            statement = "".join(current).strip()
            if statement:
                statements.append(statement)
            current = []
            continue
        current.append(char)
    tail = "".join(current).strip()
    if tail:
        statements.append(tail)
    return statements


def _parse_assignment_line(line: str) -> AssignmentNode:
    """`line` já é uma instrução isolada (sem "\\n"/";" de nível mais
    alto). Divide em "NOME" / "expressão" pelo primeiro "=" de nível mais
    alto — mesmo `_split_top_level` de sempre, que já ignora "=" dentro de
    colchetes/parênteses (irrelevante aqui, pois nomes de variável nunca
    têm colchete, mas mantém a mesma disciplina de bracket-counting em vez
    de um `line.split("=", 1)` ingênuo)."""
    parts = _split_top_level(line, "=")
    if len(parts) != 2:
        raise ExpressionError(f"Atribuição de matriz inválida: '{line}'.")

    name, rhs_text = parts[0].strip(), parts[1].strip()
    if not _NAME_PATTERN.match(name):
        raise ExpressionError(
            f"Nome de variável inválido: '{name}'. Use uma letra maiúscula seguida "
            "opcionalmente de letras/números (ex. A, B, M1)."
        )
    if name.lower() in RESERVED_NAMES:
        raise ExpressionError(
            f"'{name}' é um nome reservado (função/constante do motor de matrizes) "
            "e não pode ser usado como variável."
        )
    if not rhs_text:
        raise ExpressionError(f"Atribuição sem expressão: '{line}'.")

    matrix_node, end = _parse_expression(rhs_text, 0)
    end = _skip_whitespace(rhs_text, end)
    if end != len(rhs_text):
        raise ExpressionError(f"Não foi possível interpretar a atribuição: '{line}'.")

    return AssignmentNode(name=name, matrix=matrix_node)


def parse_matrix_program(text: str) -> ProgramNode:
    """Ponto de entrada de `dispatcher.py` (Sprint V2.2.1) — substitui a
    chamada direta a `parse_matrix_expression` de antes. Zero atribuições
    (o caso de 100% das expressões da Sprint V2.2, sem nenhuma mudança de
    comportamento) produz um `ProgramNode` com `assignments=()` e a mesma
    árvore de sempre em `expression`."""
    statements = _split_statements(text)
    if not statements:
        raise ExpressionError("A expressão não pode estar vazia.")

    *assignment_lines, expression_line = statements

    assignments: list[AssignmentNode] = []
    seen_names: set[str] = set()
    for line in assignment_lines:
        assignment = _parse_assignment_line(line)
        if assignment.name in seen_names:
            raise ExpressionError(f"Variável '{assignment.name}' já foi definida.")
        seen_names.add(assignment.name)
        assignments.append(assignment)

    expression = parse_matrix_expression(expression_line)
    return ProgramNode(assignments=tuple(assignments), expression=expression)
