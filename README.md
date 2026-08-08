# MathMaster

Documentação do produto: [PRD.md](./PRD.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [UI_UX.md](./UI_UX.md) · [MVP_SCOPE.md](./MVP_SCOPE.md)

O backend (`backend/`) implementa o Math Engine completo do MVP Técnico (álgebra, equações, funções, trigonometria, logaritmos, geometria analítica, cálculo) com parser natural e hardening de segurança — ver `docs/SESSION_LOG_2026-07-13-sprint12-1.md` para o estado mais recente. O frontend (`frontend/`) é a interface real da Sprint Frontend V1 (Home, Calculadora, Gráficos, Geometria, Aprendizado, Ferramentas, Math Mentor) — ver `docs/SESSION_LOG_2026-07-13-frontend-v1.md`. A Sprint V1.5.1 adicionou autenticação opcional via Supabase (login, cadastro, sessão persistente, dashboard) — ver `docs/SESSION_LOG_2026-07-19-sprint-v1.5.1-auth.md`. A Sprint V1.5.2 transformou a página Aprendizado no primeiro sistema real de exercícios (tópicos + múltipla escolha por dificuldade, exigindo login) — ver `docs/SESSION_LOG_2026-07-19-sprint-v1.5.2-exercicios.md`. A Sprint V1.5.3 adicionou o histórico de tentativas (`/dashboard/historico`, acerto conferido por trigger no banco, isolado por usuário via RLS) — ver `docs/SESSION_LOG_2026-07-19-sprint-v1.5.3-historico.md`. A Sprint V1.5.4 trouxe a Learning Engine v1 (domínio por tópico com peso por recência, confiança, progresso e sugestões de estudo em `/aprendizado` — determinística, sem IA) — ver `docs/SESSION_LOG_2026-07-19-sprint-v1.5.4-learning-engine.md`. A Sprint V2.2 adicionou o Motor de Matrizes (`math_engine/matrix/`: literais, soma/subtração/multiplicação/escalar/potência, determinante/inversa/transposta/traço com aliases PT-BR, renderização KaTeX completa) — ver `docs/SESSION_LOG_2026-07-24-sprint-v2.2-matrizes.md`. A Sprint V2.2.1 adicionou variáveis locais de matriz (`A=[[1,2],[3,4]]\nB=...\nA*B`, sem estado entre chamadas) e o campo de expressão da Calculadora virou um `<textarea>` auto-crescente (Ctrl/Cmd+Enter resolve) para suportar isso digitando de verdade — ver `docs/SESSION_LOG_2026-07-24-sprint-v2.2.1-variaveis-matriz.md`. A Sprint V2.3 adicionou o Motor de Números Complexos (`math_engine/complex/`: unidade imaginária `i`/`I`, forma retangular, operações, `conjugado`/`modulo`/`argumento`/`polar` com aliases PT-BR/EN — `polar(...)` produz uma expressão simbólica `r*(cos(θ)+i*sin(θ))` via SymPy, preparando o motor para forma exponencial/raízes n-ésimas/De Moivre) — ver `docs/SESSION_LOG_2026-07-25-sprint-v2.3-numeros-complexos.md`. A Sprint V2.9 adicionou a primeira infraestrutura de resolução passo a passo determinística (`math_engine/steps/`: equações lineares de uma incógnita e sistemas lineares 2×2, sem IA — cada passo nasce de uma operação SymPy real), exposta por um endpoint novo e opcional (`POST /solve/steps`, `/solve` intocado) e por um botão "Ver passo a passo" na Calculadora — ver `docs/SESSION_LOG_2026-08-05-sprint-v2.9-passo-a-passo.md`. A Sprint V2.9.1 estendeu o passo a passo a equações quadráticas, escolhendo automaticamente entre raiz direta, fatoração e fórmula de Bhaskara (nunca Bhaskara indiscriminadamente) — ver `docs/SESSION_LOG_2026-08-05-sprint-v2.9.1-quadraticas.md`. O Hotfix V2.9.1a resolveu a renderização de fórmulas embutidas nos TÍTULOS dos passos (ex. a fórmula de Bhaskara aparecia como texto cru dentro da frase) com um novo componente compartilhado, `MixedMathText`, e um campo aditivo `title_segments` no contrato de passos — ver `docs/SESSION_LOG_2026-08-05-hotfix-v2.9.1a-titulos-mistos.md`. A Sprint V2.10 estendeu o passo a passo a derivadas (regra da potência para polinômios de uma variável, linearidade da soma — nunca um segundo motor, todo valor final vem do `sympy.diff` que o `/solve` já usa) — ver `docs/SESSION_LOG_2026-08-05-sprint-v2.10-derivadas.md`. A Sprint V2.10.1 fez o mesmo para integrais indefinidas (regra da potência, constante de integração "+ C" sempre explicada), promovendo a classificação de termo polinomial da V2.10 para um módulo compartilhado reaproveitado pelos dois domínios — ver `docs/SESSION_LOG_2026-08-05-sprint-v2.10.1-integrais.md`. A Sprint V2.10.2 completou o trio de cálculo com integrais definidas (Teorema Fundamental do Cálculo, `F(b) - F(a)`, limites iguais/invertidos tratados corretamente, "+ C" estruturalmente impossível de vazar) reaproveitando a mesma busca de primitiva da V2.10.1 — ver `docs/SESSION_LOG_2026-08-05-sprint-v2.10.2-integrais-definidas.md`. A Sprint V2.11 estendeu o passo a passo de derivadas com a regra do produto e a regra da cadeia (`x²·sin(x)`, `(x²+1)³`, `sin(x²)`, combinações das duas), detectando o formato certo sobre a árvore SymPy ORIGINAL antes de qualquer expansão polinomial — para nunca esconder a regra sendo ensinada atrás de uma simplificação — ver `docs/SESSION_LOG_2026-08-05-sprint-v2.11-produto-cadeia.md`. A Sprint V2.12 completou o passo a passo de cálculo com limites (substituição direta, indeterminação 0/0 por fatoração/cancelamento, limites no infinito por comparação de graus), classificando cada caso via `as_numer_denom()`/`is_polynomial()` sobre a árvore real — ver `docs/SESSION_LOG_2026-08-06-sprint-v2.12-limites.md`. A Sprint V2.12.1 estendeu os limites aos casos trigonométricos fundamentais (`sen(ax)/x`, `x/sen(x)`, `sen(ax)/sen(bx)`, `(1-cos(ax))/x²`), sempre reduzidos ao limite `lim u→0 sen(u)/u = 1` e verificados contra o motor real — ver `docs/SESSION_LOG_2026-08-06-sprint-v2.12.1-limites-trigonometricos.md`. A Sprint V2.12.2 acrescentou a Regra de L'Hôpital como último recurso da cascata de limites (indeterminações 0/0 e ∞/∞, uma única aplicação), com detecção estrutural que nunca se sobrepõe aos métodos anteriores — ver `docs/SESSION_LOG_2026-08-06-sprint-v2.12.2-lhopital.md`. A Sprint V2.13 completou o passo a passo de derivadas com a Regra do Quociente (`(f/g)' = (f'g - fg')/g²`), reaproveitando automaticamente as regras da cadeia e do produto (V2.11) para o numerador/denominador sempre que necessário, sem duplicar nenhuma lógica — ver `docs/SESSION_LOG_2026-08-07-sprint-v2.13-regra-quociente.md`.

## Estrutura

```
MathMaster/
├── frontend/   # Next.js + TypeScript + Tailwind CSS
├── backend/    # FastAPI + SymPy
└── supabase/   # Migrações SQL (auth/profiles) — aplicar no projeto Supabase
```

## Autenticação (opcional)

O frontend tem login/cadastro/dashboard via Supabase (Sprint V1.5.1). Sem configuração, o app
funciona normalmente e as telas de auth mostram um aviso. Para ativar: crie um projeto no
Supabase, execute `supabase/migrations/0001_profiles.sql` no SQL Editor, e preencha
`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no `frontend/.env.local`
(ver `frontend/.env.local.example`).

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

A suíte (`backend/tests/`) cobre o `math_engine/` por domínio, o `formatter/` por shape de saída, os contratos HTTP (`/solve`, `/solve/steps`, `/history`, `/health`, `/ready`) via `TestClient`, e o isolamento por processo/timeout/rate limiting/concorrência adicionados no Hardening III. Roda automaticamente em cada push/PR para `main` via GitHub Actions (`.github/workflows/backend-tests.yml`), que também audita as dependências de produção contra vulnerabilidades conhecidas (`pip-audit`, job `security-audit`).

## Rodando os testes do frontend

```
cd frontend
npm install
npm run test
```

Vitest + React Testing Library (`frontend/README.md` tem o detalhamento completo, incl. a fronteira entre o que é calculado no frontend e o que sempre chama o backend real).
