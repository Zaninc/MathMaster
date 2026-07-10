# MathMaster

Documentação do produto: [PRD.md](./PRD.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [UI_UX.md](./UI_UX.md) · [MVP_SCOPE.md](./MVP_SCOPE.md)

Este repositório contém a estrutura inicial do **MVP Técnico (V0)**, conforme definido em `MVP_SCOPE.md`. Nenhuma funcionalidade de produto está implementada ainda — apenas o esqueleto de frontend e backend.

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

A suíte (`backend/tests/`) cobre o `math_engine/` por domínio, o `formatter/` por shape de saída, e os contratos HTTP (`/solve`, `/history`, `/health`) via `TestClient`. Roda automaticamente em cada push/PR para `main` via GitHub Actions (`.github/workflows/backend-tests.yml`).
