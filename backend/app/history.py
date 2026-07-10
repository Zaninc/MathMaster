# Persistência simples do histórico (expressão, resultado, data).
# Armazenamento em memória (lista Python) — suficiente para o V0, conforme
# MVP_SCOPE.md, Seção 3.5. Reiniciar o servidor limpa o histórico.

from datetime import datetime, timezone
from typing import TypedDict

from app.config import settings


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
    # Hardening II: sem isso, `_history` cresce indefinidamente durante a
    # vida do processo (nenhum outro mecanismo de limpeza existe). Descarta
    # as entradas mais antigas, preservando a ordem de inserção.
    if len(_history) > settings.history_max_entries:
        del _history[: len(_history) - settings.history_max_entries]
    return entry


def get_history() -> list[HistoryEntry]:
    return list(reversed(_history))
