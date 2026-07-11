"""Hardening III, Etapa 10 — teste de carga manual, leve, contra um servidor
uvicorn real (não `TestClient`). NÃO faz parte da suíte pytest/CI — é um
script descartável, rodado uma vez para validar throughput/latência e o
comportamento do rate limiting (Etapa 7) sob concorrência real antes de
fechar o Hardening III. Resultado registrado no SESSION_LOG, não mantido
como teste permanente.

Uso: com o backend já rodando em outro terminal (`uvicorn app.main:app`),
rode `python scripts/loadtest.py`.
"""
from __future__ import annotations

import statistics
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import httpx

BASE_URL = "http://127.0.0.1:8000"

FAST_EXPRESSIONS = [
    "2+2",
    "x**2 + 2*x + 1",
    "sin(x)=1/2",
    "x+y=5; x-y=1",
    "circunferencia((0,0),5)",
    "log(100)",
    "sqrt(8)",
]


def _one_request(client: httpx.Client, expression: str) -> tuple[int, float]:
    start = time.perf_counter()
    response = client.post("/solve", json={"expression": expression})
    elapsed = time.perf_counter() - start
    return response.status_code, elapsed


def run_burst(label: str, total_requests: int, concurrency: int) -> None:
    print(f"\n=== {label}: {total_requests} requisições, concorrência {concurrency} ===")
    results: list[tuple[int, float]] = []
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        with ThreadPoolExecutor(max_workers=concurrency) as pool:
            futures = [
                pool.submit(_one_request, client, FAST_EXPRESSIONS[i % len(FAST_EXPRESSIONS)])
                for i in range(total_requests)
            ]
            for future in as_completed(futures):
                results.append(future.result())

    statuses = [status for status, _ in results]
    latencies = [elapsed for _, elapsed in results]

    ok = statuses.count(200)
    too_many = statuses.count(429)
    other = len(statuses) - ok - too_many

    print(f"200 OK: {ok}  |  429 Too Many Requests: {too_many}  |  outros: {other}")
    print(
        f"latência (s) — média: {statistics.mean(latencies):.3f}  "
        f"mediana: {statistics.median(latencies):.3f}  "
        f"p95: {sorted(latencies)[int(len(latencies) * 0.95) - 1]:.3f}  "
        f"máx: {max(latencies):.3f}"
    )


def main() -> None:
    with httpx.Client(base_url=BASE_URL, timeout=5.0) as client:
        health = client.get("/health")
        ready = client.get("/ready")
        print(f"/health -> {health.status_code} {health.json()}")
        print(f"/ready  -> {ready.status_code} {ready.json()}")

    # Fase 1: dentro do orçamento padrão (60/min) -- espera-se 100% 200 OK,
    # mede latência real sob concorrência (isolamento por processo incluso).
    run_burst("Fase 1 — dentro do limite de taxa", total_requests=40, concurrency=20)

    # Fase 2: excede o orçamento padrão (60/min) na mesma janela -- espera-se
    # ver 429 aparecer a partir da 60a requisição desta sessão (a Fase 1 já
    # consumiu 40 do orçamento do IP local).
    run_burst("Fase 2 — excedendo o limite de taxa", total_requests=60, concurrency=30)


if __name__ == "__main__":
    main()
