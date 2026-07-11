# SESSION_LOG_2026-07-11-hardening-iii.md
## MathMaster — Registro de Sessão

| | |
|---|---|
| **Data** | 2026-07-11 |
| **Produto** | MathMaster |
| **Escopo da sessão** | Hardening III — eliminar os principais riscos restantes de segurança, resiliência e estabilidade do backend antes da Sprint Parser |

---

## 0. Processo

Sessão dividida em duas fases, como pedido: (1) auditoria completa (27 áreas) + plano detalhado, apresentado e aprovado sem implementação; (2) implementação em 10 etapas pequenas e sequenciais, cada uma com diff mostrado, testada isoladamente e com resultado reportado antes de avançar. Nenhum commit foi feito em nenhum momento da sessão — fica pendente de aprovação explícita da mensagem.

---

## 1. Diagnóstico (resumo da auditoria)

Achados críticos: `parse_expr`/`sympify` usados nos 11 pontos de parsing sem sandbox (confirmado explorável — `__import__('math').pi` executava código real e devolvia um `float` nativo do Python, não um objeto SymPy); cálculo simbólico síncrono, sem timeout nem isolamento, rodando na própria worker thread; nenhum cancelamento real possível com threads (só processo do SO mata de verdade). Achados altos: sem validação de profundidade de aninhamento; sem rate limiting; histórico em memória sem lock (condição de corrida real, comprovada). Achados médios: `/health` sem readiness real; sem shutdown limpo; `Settings` sem os limites necessários; CORS sem guard-rail. Dependências nunca auditadas. O relatório completo foi apresentado antes da implementação e não é repetido aqui.

---

## 2. O que foi implementado

### Etapa 1 — Settings estendida
`compute_timeout_seconds` (5.0s), `max_expression_nesting_depth` (32), `rate_limit_per_minute` (60) adicionados a `config.py`, com env vars correspondentes em `.env.example`.

### Etapa 2 — Parser hardening central
Novo `app/math_engine/safe_parsing.py`: `global_dict` mínimo e explícito (só `Symbol`/`Integer`/`Float`/`Rational`/`Eq` — necessários internamente pelo SymPy — mais a whitelist de funções/constantes hoje suportadas), `__builtins__` vazio, bloqueio de `__` (dunder), whitelist de caracteres (`.` removido — nenhum caso legítimo usa decimal), validação por pilha dos delimitadores `()[]{}` (rejeita fechamento sem abertura, pares incompatíveis, não fechado, profundidade excedida). Validado empiricamente: o `global_dict` mínimo foi construído forçando-o contra os 151 testes então existentes até zero falhas de `NameError`. 51 testes de segurança novos (`tests/math_engine/test_safe_parsing.py`), incluindo a descoberta de que `eval(1+1)`/`exec(1+1)`/`open(1)` (sem aspas, sem dunder) nunca executam código real mesmo no parser sem patch — o argumento numérico já virou objeto SymPy antes do `eval()` real rodar. Os 11 pontos de chamada de `parse_expr` nos dispatchers de domínio foram substituídos por `safe_parse_expr`, preservando `try/except`, mensagens de erro, `local_dict` e `transformations` de cada site exatamente como estavam. `formatter/safe_parse.py` (processa só texto já computado pelo próprio MathMaster) não foi tocado.

### Etapa 3 — Isolamento por processo + timeout real
Novo `app/execution.py`: `solve_expression_with_timeout` roda `solve_expression` num `multiprocessing.Process` (contexto `spawn`, igual nos dois SOs), com `result_queue.get(timeout=...)` como timeout real. Ao capturar `queue.Empty`, diferencia timeout genuíno de crash do processo filho via `process.is_alive()` (confirmado empiricamente: a fila não diferencia sozinha — sempre espera o prazo inteiro e levanta `Empty` nos dois casos). `ComputationTimeoutError(ExpressionError)` — subclasse, não tipo novo, então o `except ExpressionError` já existente em `main.py` continua funcionando sem mudança, preservando o contrato HTTP (sempre 400, mesmo formato). Encerramento em duas etapas (`terminate` → `join` → `kill` → `join`) sempre dentro de um `finally`, garantindo que nenhuma exceção no processo pai deixe processo filho ativo; `Queue` fechada (`close`/`join_thread`) no mesmo `finally`. Overhead medido: **~0.55s por chamada** (spawn + reimportar sympy) — aceito deliberadamente para a V0 em troca de isolamento real nos dois sistemas operacionais.

### Etapa 4 — Shutdown limpo
Registry `_active_processes` (protegida por lock) em `app/execution.py`; `shutdown_active_processes()` encerra à força qualquer processo ainda vivo. `main.py` ganhou um `lifespan` do FastAPI que chama essa função no shutdown — cobre o caso de uma requisição em voo quando o servidor é desligado.

### Etapa 5 — `/ready`
Novo endpoint, resolve `solve_expression("2+2")` direto (sem subprocesso — sondagem de readiness não deve pagar o custo de um `spawn`), 503 se levantar exceção ou devolver resultado inesperado. `/health` não foi tocado (contrato preservado).

### Etapa 6 — Lock de concorrência no histórico
`threading.Lock` em `add_entry`/`get_history` (`app/history.py`). Descoberta importante: o agendamento natural de threads **não expôs a corrida de forma confiável** nesta máquina (testado com até 300 threads) — foi necessário instrumentar `_history` com um `__len__` artificialmente lento para forçar a janela de corrida a se abrir de propósito. Confirmado manualmente: sem o lock, esse cenário adversarial **esvaziava a lista inteira**; com o lock, permanece exatamente no cap configurado.

### Etapa 7 — Rate limiting
Novo `app/rate_limit.py`: janela deslizante em memória por IP (mesmo padrão do histórico), aplicada só em `/solve` via `Depends()` — não é middleware global com exclusões. Fixture `reset_rate_limit` adicionada a `conftest.py`.

### Etapa 8 — Guard-rail de CORS
`field_validator` em `Settings.cors_origins` rejeitando `"*"` — falha na inicialização da aplicação em vez de subir silenciosamente com CORS coringa + credenciais.

### Etapa 9 — `pip-audit` no CI + upgrade de dependências
`pip-audit` encontrou **9 vulnerabilidades reais** (`python-dotenv 1.0.1`, `starlette 0.41.3` transitivo via `fastapi`). Analisadas quanto à explorabilidade real no MathMaster — nenhuma era (sem `StaticFiles`, sem `HTTPEndpoint`, sem `request.form()`). Após decisão explícita, `python-dotenv` → 1.2.2 e `fastapi` 0.115.6 → 0.139.0 (que traz `starlette` 1.3.1, agora pinado explicitamente). 232/232 testes seguiram passando, `pip-audit` confirma zero vulnerabilidades conhecidas. Novo job `security-audit` em `.github/workflows/backend-tests.yml`, separado do job `test`, roda em paralelo.

### Etapa 10 — Regressão final, carga, documentação
Ver §6 e §9.

---

## 3. Arquivos criados

`backend/app/execution.py`, `backend/app/math_engine/safe_parsing.py`, `backend/app/rate_limit.py`, `backend/scripts/loadtest.py`, `backend/tests/math_engine/test_safe_parsing.py`, `backend/tests/test_config.py`, `backend/tests/test_execution.py`, `backend/tests/test_rate_limit.py`, `docs/SESSION_LOG_2026-07-11-hardening-iii.md`.

## 4. Arquivos modificados

`backend/app/config.py` (novos limites + guard-rail CORS), `backend/app/main.py` (lifespan, `/ready`, rate limiting, imports), `backend/app/history.py` (lock), `backend/app/math_engine/errors.py` (`ComputationTimeoutError`), `backend/app/math_engine/{dispatcher,equations/dispatcher,functions/dispatcher,logarithms/dispatcher,logarithms/equations,trigonometry/dispatcher,trigonometry/equations,analytic_geometry/points}.py` (troca para `safe_parse_expr`), `backend/requirements.txt` (upgrade fastapi/starlette/python-dotenv), `backend/requirements-dev.txt` (`pip-audit`), `backend/.env.example`, `backend/tests/conftest.py` (fixture `reset_rate_limit`), `backend/tests/{test_api,test_error_handling,test_limits}.py`, `.github/workflows/backend-tests.yml` (job `security-audit`), `README.md`.

---

## 5. Testes executados

**232/232 testes pytest aprovados**, cobertura de linha **91%** (`pytest --cov=app`), ~19-29s de execução total (subiu de ~1s porque os testes que já batiam em `/solve` via `TestClient` agora pagam o custo real de `spawn` — mantido deliberadamente para validar o comportamento real de produção nesses testes, não mockado).

**Teste de carga manual** (`backend/scripts/loadtest.py`, contra um `uvicorn` real, não `TestClient`):
- Fase 1 (40 requisições, concorrência 20, dentro do limite de taxa): **100% 200 OK**. Latência sob concorrência real: média 2.035s, mediana 2.026s, p95 2.313s, máx 2.574s — **bem mais alta** que os ~0.55s medidos para uma chamada isolada, porque múltiplos `spawn` simultâneos disputam CPU para reimportar o SymPy. Achado relevante para capacidade futura, registrado aqui.
- Fase 2 (60 requisições, concorrência 30, excedendo o limite): **20 200 OK + 40 429**, batendo exatamente no limite de 60/minuto (40 da Fase 1 + 20 da Fase 2 = 60) — confirma o rate limiting funcionando sob carga HTTP concorrente real, não só via `TestClient`.
- Zero processos Python remanescentes após o teste (confirmado via `Get-Process`).

Smoke test manual final (mesmos 7 casos usados em cada etapa, via API real): resultados idênticos aos anteriores, byte a byte.

---

## 6. Regressões encontradas

**Nenhuma.** Todos os 232 testes (incluindo a suíte de regressão de compatibilidade das Sprints 4-11) continuam produzindo saída idêntica. Nenhum contrato público (`/health`, `/solve`, `/history`) mudou de forma quebradora — `/ready` é aditivo. O upgrade de `fastapi`/`starlette`/`python-dotenv` (Etapa 9) não alterou nenhum comportamento observável, confirmado pela suíte completa e por smoke test manual.

---

## 7. Riscos conhecidos, deixados fora do escopo (deliberado)

- **Multi-worker**: histórico e rate limiting em memória por processo — `uvicorn --workers N>1` teria estado divergente entre workers. Documentado explicitamente no código; V0 deve rodar com 1 worker. Resolver de verdade exigiria Redis/DB compartilhado.
- **Limite de memória por processo**: o timeout limita duração, não pico de memória dentro da janela. Mitigação real exigiria `Job Objects` (Windows) / `cgroups` (Linux) em nível de infraestrutura — melhor resolvido no deploy/container futuro, não na aplicação.
- **Overhead de `spawn` sob concorrência**: ~2s de latência sob carga (Fase 1 do teste de carga), contra ~0.55s isolado. Se virar problema real de capacidade, a evolução natural é um pool de processos recicláveis em vez de processo-por-requisição — não implementado agora, por ser mais complexo e fora do que foi aprovado.
- **`StarletteDeprecationWarning`**: `TestClient` com `httpx` está deprecado em favor de `httpx2` (descoberto no upgrade da Etapa 9). Não quebra nada, mas é um item para acompanhar.
- Autenticação de API pública, WAF, Dependabot automatizado — fora do escopo desde o plano aprovado.

---

## 8. Estado atual do projeto

- Parser protegido contra a classe de vulnerabilidade `eval`/`sympify` (confirmada explorável antes da correção).
- Todo cálculo simbólico de `/solve` isolado em processo próprio, com timeout real e cancelamento garantido nos dois sistemas operacionais.
- Shutdown do servidor nunca deixa processo filho órfão.
- `/health` (liveness) e `/ready` (readiness) distintos.
- Histórico e rate limiting thread-safe dentro de um processo.
- CORS com guard-rail contra configuração perigosa.
- Zero vulnerabilidades conhecidas nas dependências de produção, auditadas automaticamente a cada push/PR.
- 232 testes, 91% de cobertura, CI com dois jobs (testes + auditoria de segurança).
- Nenhum commit/push realizado nesta sessão — aguardando aprovação explícita da mensagem de commit.

## 9. Objetivo da próxima sprint

A definir com Theo — candidatos no roadmap: Sprint Parser (gramática dedicada, adiada explicitamente durante todo o Hardening III), ou os itens de risco futuro registrados no §7 (pool de processos recicláveis, limite de memória por SO, multi-worker com storage compartilhado).
