"""Hardening II, Etapa 5 — limite de tamanho de `expression` (schemas.py)
e cap de tamanho do histórico em memória (history.py).
Hardening III, Etapa 6 — concorrência de `add_entry`/`get_history`."""
from __future__ import annotations

import threading
import time

import pytest
from fastapi.testclient import TestClient

from app.history import _history, add_entry, get_history


def test_expression_within_max_length_is_accepted(client: TestClient) -> None:
    expression = "1+" * 499 + "1"  # 999 caracteres, dentro do limite de 1000
    response = client.post("/solve", json={"expression": expression})
    assert response.status_code == 200


def test_expression_over_max_length_is_rejected(client: TestClient) -> None:
    expression = "1+" * 501  # 1002 caracteres, acima do limite de 1000
    response = client.post("/solve", json={"expression": expression})
    assert response.status_code == 422


def test_history_is_capped_at_configured_max_entries(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.history as history_module

    monkeypatch.setattr(history_module.settings, "history_max_entries", 3)

    for i in range(5):
        add_entry(f"expr{i}", f"result{i}")

    assert len(_history) == 3
    # As mais antigas (expr0, expr1) foram descartadas; as 3 mais recentes
    # permanecem, na ordem de inserção original dentro da lista interna.
    assert [entry["expression"] for entry in _history] == ["expr2", "expr3", "expr4"]


def test_get_history_still_returns_most_recent_first_when_capped(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.history as history_module

    monkeypatch.setattr(history_module.settings, "history_max_entries", 2)

    for i in range(4):
        add_entry(f"expr{i}", f"result{i}")

    ordered = get_history()
    assert [entry["expression"] for entry in ordered] == ["expr3", "expr2"]


def test_add_entry_is_thread_safe_under_concurrent_writes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Sem o lock em `add_entry`, threads concorrentes podem intercalar o
    "append + verifica limite + trunca": uma thread calcula quantas entradas
    antigas descartar com base num tamanho que outra thread já truncou,
    fazendo o histórico encolher (às vezes catastroficamente, até esvaziar)
    abaixo do limite configurado. Verificado empiricamente: o agendamento
    natural de 200+ threads nem sempre expõe essa corrida de forma
    confiável nesta máquina (o GIL raramente troca de contexto no meio de
    uma função tão curta) — por isso este teste força a janela de corrida a
    se abrir substituindo `_history` por uma lista instrumentada cujo
    `__len__` insere um atraso deliberado exatamente entre o append e a
    truncagem, tornando a corrida determinística em vez de depender de
    sorte do agendador do SO. Confirmado manualmente: contra a versão sem
    lock, este cenário adversarial zera a lista; com o lock, permanece
    exatamente em 50."""
    import app.history as history_module

    class _SlowList(list):
        def __len__(self) -> int:
            length = super().__len__()
            time.sleep(0.005)
            return length

    monkeypatch.setattr(history_module.settings, "history_max_entries", 50)
    monkeypatch.setattr(history_module, "_history", _SlowList())

    total_writes = 60
    barrier = threading.Barrier(total_writes)

    def _write(i: int) -> None:
        barrier.wait()
        add_entry(f"expr{i}", f"result{i}")

    threads = [threading.Thread(target=_write, args=(i,)) for i in range(total_writes)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(history_module._history) == 50
    expressions = [entry["expression"] for entry in history_module._history]
    assert len(set(expressions)) == 50  # sem duplicatas nem entradas perdidas além do cap
    for entry in history_module._history:
        assert entry["expression"].startswith("expr")
        assert entry["result"].startswith("result")
        assert "timestamp" in entry


def test_get_history_is_thread_safe_during_concurrent_writes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Confirma que `get_history()` não lê `_history` no meio de uma
    mutação concorrente (o `reversed()`/`list()` percorrem a lista
    compartilhada; sem o lock, uma truncagem simultânea poderia corromper
    essa leitura)."""
    import app.history as history_module

    monkeypatch.setattr(history_module.settings, "history_max_entries", 50)

    stop = threading.Event()

    def _writer() -> None:
        i = 0
        while not stop.is_set():
            add_entry(f"expr{i}", f"result{i}")
            i += 1

    readers_ok = []

    def _reader() -> None:
        for _ in range(200):
            ordered = get_history()
            readers_ok.append(all("expression" in entry for entry in ordered))

    writer_thread = threading.Thread(target=_writer)
    reader_threads = [threading.Thread(target=_reader) for _ in range(10)]

    writer_thread.start()
    for t in reader_threads:
        t.start()
    for t in reader_threads:
        t.join()
    stop.set()
    writer_thread.join()

    assert readers_ok and all(readers_ok)
