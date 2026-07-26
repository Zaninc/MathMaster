"""Hardening III, Etapas 3-4 — testes de `app.execution`."""
from __future__ import annotations

import multiprocessing
import threading
import time

import pytest
from fastapi.testclient import TestClient

import app.execution as execution_module
import app.main as main_module
from app.math_engine import ExpressionError, solve_expression
from app.math_engine.errors import ComputationTimeoutError


def _crash_without_reporting(expression: str, result_queue) -> None:
    """Função de nível de módulo (precisa ser importável para o `spawn`
    conseguir reconstruí-la no processo filho) que simula um processo que
    morre sem nunca chamar `result_queue.put(...)` — ex. um crash real de
    uma extensão nativa, não um `ExpressionError`/`Exception` normal do
    Python que `_run_solve` já capturaria e reportaria."""
    import os

    os._exit(1)


def _sleep_forever(expression: str, result_queue) -> None:
    """Função de nível de módulo que simula um cálculo pesado ainda em
    andamento — usada para testar o shutdown de uma requisição em voo
    (Etapa 4), nunca reporta nada na fila por conta própria."""
    import time as _time

    _time.sleep(60)


def test_returns_same_result_as_solve_expression_for_fast_input() -> None:
    assert execution_module.solve_expression_with_timeout("2+2") == solve_expression("2+2")


def test_propagates_expression_error_from_child() -> None:
    expression = "circunferencia((0,0),0)"
    with pytest.raises(ExpressionError) as exc_info:
        execution_module.solve_expression_with_timeout(expression)
    with pytest.raises(ExpressionError) as direct_exc_info:
        solve_expression(expression)
    assert str(exc_info.value) == str(direct_exc_info.value)


def test_raises_computation_timeout_error_when_child_still_running(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(execution_module.settings, "compute_timeout_seconds", 0.01)
    with pytest.raises(ComputationTimeoutError):
        execution_module.solve_expression_with_timeout("2+2")


def test_nonlinear_system_still_respects_the_existing_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Sprint V2.5 — `solve_nonlinear_system` (`nonlinsolve`) roda dentro
    do MESMO isolamento por processo/timeout de qualquer outra expressão
    (`solve_expression_with_timeout` envolve `solve_expression` inteiro,
    sem exceção nenhuma para equations/nonlinear.py) — nenhum código novo
    de timeout foi necessário nesta sprint. Mesmo padrão do teste acima
    (timeout de 0.01s): mesmo um cálculo trivial não termina a tempo do
    subprocesso nem ser criado, então isto é robusto independente da
    complexidade real do sistema não linear."""
    monkeypatch.setattr(execution_module.settings, "compute_timeout_seconds", 0.01)
    with pytest.raises(ComputationTimeoutError):
        execution_module.solve_expression_with_timeout("x**2+y=5\nx-y=1")


def test_child_process_created_by_the_call_is_not_left_alive_after_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Verifica só o processo/PID criado por ESTA chamada (não o estado
    global de `multiprocessing.active_children()`, que poderia refletir
    processos de outros testes)."""
    monkeypatch.setattr(execution_module.settings, "compute_timeout_seconds", 0.01)

    real_process_factory = execution_module._SPAWN_CONTEXT.Process
    created: list = []

    def spying_process_factory(*args, **kwargs):
        process = real_process_factory(*args, **kwargs)
        created.append(process)
        return process

    monkeypatch.setattr(execution_module._SPAWN_CONTEXT, "Process", spying_process_factory)

    with pytest.raises(ComputationTimeoutError):
        execution_module.solve_expression_with_timeout("2+2")

    assert len(created) == 1
    process = created[0]
    assert process.pid is not None
    assert process.is_alive() is False


def test_child_crash_without_reporting_is_not_classified_as_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Requisito explícito: se o processo filho encerra sem nunca colocar
    nada na fila, isso é um erro interno (crash), NUNCA um
    `ComputationTimeoutError` — mesmo que a fila também levante
    `queue.Empty` nesse caso (confirmado empiricamente: `Queue.get(timeout=)`
    não diferencia sozinha; a diferenciação é feita via `is_alive()`)."""
    monkeypatch.setattr(execution_module, "_run_solve", _crash_without_reporting)
    # Prazo generoso: o processo filho precisa reimportar todo o módulo de
    # teste (que puxa TestClient/fastapi, mais pesado que só app.execution)
    # antes de conseguir chamar os._exit(1) -- um prazo curto demais mede a
    # reimportação, não a diferenciação crash-vs-timeout que este teste
    # verifica.
    monkeypatch.setattr(execution_module.settings, "compute_timeout_seconds", 3.0)

    with pytest.raises(RuntimeError) as exc_info:
        execution_module.solve_expression_with_timeout("2+2")

    assert not isinstance(exc_info.value, ComputationTimeoutError)
    assert "encerrou inesperadamente" in str(exc_info.value)


def test_terminate_and_reap_is_a_noop_for_a_process_that_never_started() -> None:
    process = execution_module._SPAWN_CONTEXT.Process(target=solve_expression, args=("2+2",))
    assert process.pid is None
    execution_module._terminate_and_reap(process)  # não deve levantar


def test_run_solve_reports_ok_for_successful_computation() -> None:
    result_queue: "multiprocessing.Queue" = multiprocessing.Queue()
    execution_module._run_solve("2+2", result_queue)
    assert result_queue.get() == ("ok", solve_expression("2+2"))


def test_run_solve_reports_expression_error() -> None:
    expression = "circunferencia((0,0),0)"
    result_queue: "multiprocessing.Queue" = multiprocessing.Queue()
    execution_module._run_solve(expression, result_queue)
    status, payload = result_queue.get()
    assert status == "expression_error"
    with pytest.raises(ExpressionError) as exc_info:
        solve_expression(expression)
    assert payload == str(exc_info.value)


def test_run_solve_reports_internal_error_for_unexpected_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _boom(expression: str) -> str:
        raise RuntimeError("bug interno simulado")

    monkeypatch.setattr(execution_module, "solve_expression", _boom)
    result_queue: "multiprocessing.Queue" = multiprocessing.Queue()
    execution_module._run_solve("2+2", result_queue)
    status, payload = result_queue.get()
    assert status == "internal_error"
    assert payload == "RuntimeError: bug interno simulado"


def test_solve_endpoint_returns_400_on_timeout(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(execution_module.settings, "compute_timeout_seconds", 0.01)
    response = client.post("/solve", json={"expression": "2+2"})
    assert response.status_code == 400
    assert "tempo máximo" in response.json()["detail"]


# --- Hardening III, Etapa 4 — shutdown limpo de requisições em voo --------


def test_shutdown_active_processes_is_a_noop_with_nothing_registered() -> None:
    execution_module.shutdown_active_processes()  # não deve levantar


def test_shutdown_active_processes_terminates_an_in_flight_process(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Simula uma requisição em andamento (processo filho ainda vivo,
    calculando) no momento em que o servidor é desligado. O `finally` de
    `solve_expression_with_timeout` roda normalmente (só depois que o
    próprio `get(timeout=...)` desistir), então esta chamada é feita numa
    thread de fundo enquanto o teste, na thread principal, aciona o
    shutdown e confirma que o processo é encerrado à força ANTES disso."""
    monkeypatch.setattr(execution_module, "_run_solve", _sleep_forever)
    monkeypatch.setattr(execution_module.settings, "compute_timeout_seconds", 2.0)

    background_exception: list[BaseException] = []

    def _call_in_background() -> None:
        try:
            execution_module.solve_expression_with_timeout("2+2")
        except BaseException as exc:  # noqa: BLE001 - captura para inspeção no teste
            background_exception.append(exc)

    thread = threading.Thread(target=_call_in_background, daemon=True)
    thread.start()

    deadline = time.monotonic() + 5
    while time.monotonic() < deadline and not execution_module._active_processes:
        time.sleep(0.05)

    assert len(execution_module._active_processes) == 1
    process = next(iter(execution_module._active_processes))
    assert process.is_alive() is True

    execution_module.shutdown_active_processes()

    assert process.is_alive() is False
    assert execution_module._active_processes == set()

    thread.join(timeout=3)
    assert not thread.is_alive()
    assert len(background_exception) == 1
    # Encerrado via shutdown, não por exceder o próprio prazo -- classificado
    # como erro interno (processo já morto), nunca como timeout.
    assert not isinstance(background_exception[0], ComputationTimeoutError)


def test_lifespan_shutdown_calls_shutdown_active_processes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[bool] = []
    monkeypatch.setattr(
        main_module, "shutdown_active_processes", lambda: calls.append(True)
    )

    with TestClient(main_module.app):
        pass  # dispara startup e shutdown do lifespan ao entrar/sair do "with"

    assert calls == [True]
