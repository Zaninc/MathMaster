# Persistência simples do histórico (expressão, resultado, data).
# Armazenamento em memória (lista Python) — suficiente para o V0, conforme
# MVP_SCOPE.md, Seção 3.5. Reiniciar o servidor limpa o histórico.
#
# Hardening III, Etapa 6 — `_history_lock` protege `add_entry`/`get_history`
# contra condição de corrida DENTRO de um mesmo processo: o Starlette roda
# rotas síncronas (como `/solve`) num threadpool, então duas requisições
# concorrentes podiam intercalar o "append + verifica limite + trunca" de
# forma que o histórico encolhesse abaixo do limite configurado (uma thread
# calcula quantas entradas antigas descartar com base num tamanho que já
# ficou desatualizado pela truncagem de outra thread). O lock torna essa
# sequência atômica.
#
# Isso NÃO resolve (nem tenta resolver) o histórico divergir entre múltiplos
# workers (`uvicorn --workers N>1`): cada processo tem sua própria lista
# `_history` em memória, e um lock de thread não cruza processos. Resolver
# isso de verdade exigiria um armazenamento compartilhado (Redis/DB), fora
# do escopo desta etapa — o V0 deve continuar rodando com 1 worker.

import threading
from datetime import datetime, timezone
from typing import TypedDict

from app.config import settings


class HistoryEntry(TypedDict):
    expression: str
    result: str
    timestamp: str


_history: list[HistoryEntry] = []
_history_lock = threading.Lock()


def add_entry(expression: str, result: str) -> HistoryEntry:
    entry: HistoryEntry = {
        "expression": expression,
        "result": result,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    with _history_lock:
        _history.append(entry)
        # Hardening II: sem isso, `_history` cresce indefinidamente durante a
        # vida do processo (nenhum outro mecanismo de limpeza existe). Descarta
        # as entradas mais antigas, preservando a ordem de inserção.
        if len(_history) > settings.history_max_entries:
            del _history[: len(_history) - settings.history_max_entries]
    return entry


def get_history() -> list[HistoryEntry]:
    with _history_lock:
        return list(reversed(_history))
