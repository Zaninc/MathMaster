# MathMaster

Documentação do produto: [PRD.md](./PRD.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [UI_UX.md](./UI_UX.md) · [MVP_SCOPE.md](./MVP_SCOPE.md)

O backend (`backend/`) implementa o Math Engine completo do MVP Técnico (álgebra, equações, funções, trigonometria, logaritmos, geometria analítica, cálculo) com parser natural e hardening de segurança — ver `docs/SESSION_LOG_2026-07-13-sprint12-1.md` para o estado mais recente. O frontend (`frontend/`) é a interface real da Sprint Frontend V1 (Home, Calculadora, Gráficos, Geometria, Aprendizado, Ferramentas, Math Mentor) — ver `docs/SESSION_LOG_2026-07-13-frontend-v1.md`.

## Estrutura

```
MathMaster/
├── frontend/   # Next.js + TypeScript + Tailwind CSS
└── backend/    # FastAPI + SymPy
```

## Rodando o frontend

```
cd frontend
npm install
npm run dev
```

Acesse http://localhost:3000.

## Rodando o backend

```
cd backend
python -m venv .venv
./.venv/Scripts/activate     # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Acesse http://localhost:8000/health e http://localhost:8000/docs.

## Rodando os testes do backend

```
cd backend
pip install -r requirements-dev.txt
pytest
```

A suíte (`backend/tests/`) cobre o `math_engine/` por domínio, o `formatter/` por shape de saída, os contratos HTTP (`/solve`, `/history`, `/health`, `/ready`) via `TestClient`, e o isolamento por processo/timeout/rate limiting/concorrência adicionados no Hardening III. Roda automaticamente em cada push/PR para `main` via GitHub Actions (`.github/workflows/backend-tests.yml`), que também audita as dependências de produção contra vulnerabilidades conhecidas (`pip-audit`, job `security-audit`).

## Rodando os testes do frontend

```
cd frontend
npm install
npm run test
```

Vitest + React Testing Library (`frontend/README.md` tem o detalhamento completo, incl. a fronteira entre o que é calculado no frontend e o que sempre chama o backend real).
