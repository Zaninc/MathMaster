# Persistência simples do histórico (expressão, resultado, data).
# Armazenamento em memória (lista Python) — suficiente para o V0, conforme
# MVP_SCOPE.md, Seção 3.5. Reiniciar o servidor limpa o histórico.

from datetime import datetime, timezone
from typing import TypedDict


class HistoryEntry(TypedDict):
    expression: str
    result: str
    timestamp: str


_history: list[HistoryEntry] = []


def add_entry(expression: str, result: str) -> HistoryEntry:
    entry: HistoryEntry = {
        "expression": expression,
        "result": result,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    _history.append(entry)
    return entry


def get_history() -> list[HistoryEntry]:
    return list(reversed(_history))
