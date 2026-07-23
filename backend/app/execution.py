"""Hardening III, Etapa 3 — isolamento por processo e timeout real para
`solve_expression`.

Por que processo e não thread: uma thread presa em um cálculo simbólico
pesado não pode ser interrompida à força pelo Python (não existe
`thread.kill()` seguro) — um timeout baseado em thread só para de *esperar*
a thread, que continua rodando e consumindo CPU/GIL indefinidamente,
acumulando threads presas a cada requisição travada. Um processo do SO pode
ser encerrado de verdade (`SIGTERM`/`SIGKILL` no POSIX, `TerminateProcess`
no Windows), independentemente do que o código dentro dele estiver fazendo.

Por que `spawn` e não `fork`: `fork` não existe no Windows. Usar `spawn` nos
dois sistemas operacionais (em vez de `fork` no Linux e `spawn` só no
Windows) garante que o mesmo caminho de código seja exercitado e testado
igualmente nas duas plataformas.

Por que `ProcessPoolExecutor` não resolve sozinho: `future.result(timeout=)`
apenas desiste de esperar — o worker do pool continua ocupado executando a
tarefa presa, e o pool não oferece uma forma de matar só aquele worker sem
destruir o pool inteiro. Por isso cada chamada aqui cria e controla
diretamente o seu próprio `multiprocessing.Process`.

Timeout real vs. crash do processo filho: se nada chega na fila dentro do
prazo, isso pode significar duas coisas bem diferentes — o cálculo ainda
está rodando (timeout de verdade) ou o processo filho já morreu sem nunca
reportar nada (crash interno, ex. falha de um pacote nativo do SymPy).
Confirmado empiricamente (nesta máquina): `Queue.get(timeout=...)` sempre
espera o prazo inteiro e levanta `queue.Empty` nos dois casos — não há
diferenciação automática por parte da fila. Por isso, ao capturar
`queue.Empty`, checamos `process.is_alive()` explicitamente: só é
`ComputationTimeoutError` se o processo ainda estiver vivo; se já morreu,
vira erro interno genérico (mapeado para 500, nunca 400) — não faz sentido
dizer ao cliente que "excedeu o tempo" quando o processo já tinha encerrado
por conta própria.

Shutdown limpo (Etapa 4): cada processo criado é registrado em
`_active_processes` enquanto a chamada está em andamento e removido no
`finally` — assim, se o servidor for desligado com uma requisição ainda em
voo, `shutdown_active_processes()` (chamado pelo lifespan do FastAPI em
`main.py`) sabe exatamente quais processos ainda podem estar vivos e os
encerra à força, em vez de deixá-los órfãos.
"""
from __future__ import annotations

import multiprocessing
import queue
import threading
from multiprocessing.process import BaseProcess
from typing import Callable, TypeVar

from app.config import settings
from app.math_engine import ExpressionError, solve_expression, solve_expression_with_approx
from app.math_engine.errors import ComputationTimeoutError

T = TypeVar("T")

_SPAWN_CONTEXT = multiprocessing.get_context("spawn")

_active_processes: set[BaseProcess] = set()
_active_processes_lock = threading.Lock()


def _register_process(process: BaseProcess) -> None:
    with _active_processes_lock:
        _active_processes.add(process)


def _unregister_process(process: BaseProcess) -> None:
    with _active_processes_lock:
        _active_processes.discard(process)


def shutdown_active_processes() -> None:
    """Encerra à força qualquer processo de cálculo ainda vivo no momento em
    que o servidor é desligado (requisição em andamento quando o processo
    principal recebe o sinal de shutdown). Chamado pelo lifespan do FastAPI
    em `main.py` — nunca deixa um processo filho órfão quando o servidor
    encerra com requisições ainda em voo.
    """
    with _active_processes_lock:
        processes = list(_active_processes)
    for process in processes:
        _terminate_and_reap(process)
        _unregister_process(process)


def _run_solve(expression: str, result_queue: multiprocessing.Queue) -> None:
    try:
        result = solve_expression(expression)
    except ExpressionError as exc:
        result_queue.put(("expression_error", str(exc)))
    except Exception as exc:  # bug real, não esperado — vira erro interno, não ExpressionError
        result_queue.put(("internal_error", f"{type(exc).__name__}: {exc}"))
    else:
        result_queue.put(("ok", result))


def _run_solve_with_approx(expression: str, result_queue: multiprocessing.Queue) -> None:
    """Sprint V2.1 (apresentação progressiva) — mesmo protocolo de
    `_run_solve`, só troca `solve_expression` por `solve_expression_with_approx`
    (o payload "ok" vira uma tupla `(resultado, approx)`; tuplas atravessam
    o `multiprocessing.Queue` normalmente via pickle, sem tratamento
    especial)."""
    try:
        result = solve_expression_with_approx(expression)
    except ExpressionError as exc:
        result_queue.put(("expression_error", str(exc)))
    except Exception as exc:
        result_queue.put(("internal_error", f"{type(exc).__name__}: {exc}"))
    else:
        result_queue.put(("ok", result))


def _terminate_and_reap(process: BaseProcess) -> None:
    if process.pid is None:
        # process.start() nunca chegou a suceder -- não há processo do SO
        # para encerrar ou reaproveitar.
        return
    if process.is_alive():
        process.terminate()
        process.join(timeout=1)
        if process.is_alive():
            process.kill()
            process.join(timeout=1)
    else:
        process.join()


def _run_in_subprocess_with_timeout(
    target: Callable[[str, multiprocessing.Queue], None], expression: str
) -> T:
    """Núcleo compartilhado de `solve_expression_with_timeout`/
    `solve_expression_with_timeout_and_approx` (Sprint V2.1) — isola
    QUALQUER função de protocolo `(expression, queue) -> None` que siga o
    contrato `("ok", payload) | ("expression_error", str) |
    ("internal_error", str)` em um processo próprio, com o mesmo limite
    real de tempo (`settings.compute_timeout_seconds`). Extraído para que as
    duas variantes (com/sem aproximação) nunca duplicem a lógica de
    timeout/shutdown/limpeza — só o `target` (e, portanto, o formato do
    `payload` de sucesso) muda entre elas.
    """
    result_queue: multiprocessing.Queue = _SPAWN_CONTEXT.Queue()
    process = _SPAWN_CONTEXT.Process(target=target, args=(expression, result_queue), daemon=True)
    _register_process(process)
    try:
        process.start()
        try:
            status, payload = result_queue.get(timeout=settings.compute_timeout_seconds)
        except queue.Empty:
            if process.is_alive():
                raise ComputationTimeoutError(
                    f"O cálculo excedeu o tempo máximo permitido de "
                    f"{settings.compute_timeout_seconds}s e foi interrompido."
                )
            raise RuntimeError(
                "O processo de cálculo encerrou inesperadamente "
                f"(código de saída {process.exitcode}) sem retornar um resultado."
            )
    finally:
        _terminate_and_reap(process)
        _unregister_process(process)
        result_queue.close()
        result_queue.join_thread()

    if status == "ok":
        return payload
    if status == "expression_error":
        raise ExpressionError(payload)
    raise RuntimeError(payload)


def solve_expression_with_timeout(expression: str) -> str:
    """Executa `solve_expression` em um processo isolado, com um limite real
    de tempo (`settings.compute_timeout_seconds`). Levanta
    `ComputationTimeoutError` (subclasse de `ExpressionError`) se o cálculo
    ainda estiver rodando quando o prazo esgotar — o processo é encerrado à
    força, nunca deixado rodando em segundo plano.
    """
    return _run_in_subprocess_with_timeout(_run_solve, expression)


def solve_expression_with_timeout_and_approx(expression: str) -> tuple[str, str | None]:
    """Sprint V2.1 (apresentação progressiva) — mesma proteção de timeout de
    `solve_expression_with_timeout`, chamando `solve_expression_with_approx`
    dentro do processo isolado em vez de `solve_expression`. Usada só pelo
    `/solve` de `main.py`; `solve_expression_with_timeout` continua intocada
    (mesma assinatura, mesmo comportamento) para `/ready` e para a suíte de
    testes existente.
    """
    return _run_in_subprocess_with_timeout(_run_solve_with_approx, expression)
