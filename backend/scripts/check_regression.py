"""Script de regressão persistido, sem pytest (decisão explícita: pytest
fica reservado para o Hardening II/Sprint 12 do roadmap).

Cobre, com asserções de saída EXATA (não só "não lança exceção"): os casos
que motivaram o hotfix da Sprint 11.1 (formatação de soluções periódicas
trigonométricas) e a suíte de compatibilidade cross-domain das Sprints
7-11, para detectar regressões futuras nesses mesmos pontos.

Uso: `.venv/Scripts/python.exe scripts/check_regression.py` a partir de
`backend/` (mesmo ambiente/convenção de todo smoke test manual do projeto).
Sai com código 0 se tudo passar, 1 caso contrário — utilizável como base
direta para os testes reais do Hardening II, mas não é pytest.
"""
from __future__ import annotations

import sys

sys.path.insert(0, ".")

from app.formatter.pipeline import format_result
from app.formatter.renderer import render_math
from app.math_engine.dispatcher import solve_expression
from app.math_engine.errors import ExpressionError


def _solve(expression: str) -> str:
    raw = solve_expression(expression)
    return render_math(format_result(expression, raw))


# (expressão, saída EXATA esperada após format_result()+render_math())
EXACT_CASES = [
    # --- Sprint 11.1 hotfix: formatação de soluções periódicas trigonométricas ---
    ("sin(x)=1/2", "x = 2*π*k + π/6 ou x = 2*π*k + 5*π/6, k ∈ ℤ"),
    ("cos(x)=0", "x = 2*π*k + π/2 ou x = 2*π*k + 3*π/2, k ∈ ℤ"),
    ("tan(x)=1", "x = π*k + π/4, k ∈ ℤ"),
    # --- Sprint 7 trigonometria: valores notáveis, inversas, identidades ---
    ("sin(pi/6)", "Tipo: valor notável; Resultado: 1/2"),
    ("cos(pi/3)", "Tipo: valor notável; Resultado: 1/2"),
    ("tan(pi/4)", "Tipo: valor notável; Resultado: 1"),
    ("asin(1/2)", "Tipo: trigonometria inversa; Resultado: π/6"),
    ("acos(1/2)", "Tipo: trigonometria inversa; Resultado: π/3"),
    ("atan(1)", "Tipo: trigonometria inversa; Resultado: π/4"),
    ("sin(x)**2 + cos(x)**2", "Tipo: identidade trigonométrica fundamental; Resultado: 1"),
    # --- Sprint 8 logaritmos/exponenciais ---
    ("log(100)", "Tipo: avaliação numérica; Resultado: 2"),
    ("ln(E)", "Tipo: avaliação numérica; Resultado: 1"),
    ("exp(0)", "Tipo: avaliação numérica; Resultado: 1"),
    ("log(x)=2", "x = 100"),
    ("2**x=8", "x = 3"),
    # --- Sprint 9 functions: análise log/exp ---
    (
        "f(x)=log(x)",
        "Tipo: função logarítmica; Domínio: (0, +∞); Imagem: ℝ; Raiz: x = 1; "
        "Intercepto em y: inexistente; Assíntota vertical: x = 0; Monotonicidade: crescente",
    ),
    (
        "f(x)=exp(x)",
        "Tipo: função exponencial; Domínio: ℝ; Imagem: (0, +∞); Raízes: nenhuma; "
        "Intercepto em y: (0, 1); Assíntota horizontal: y = 0; Monotonicidade: crescente",
    ),
    # --- Sprint 6 functions ---
    (
        "f(x)=x**2",
        "Tipo: função quadrática; Domínio: ℝ; Raiz: x = 0; Intercepto em y: (0, 0); Vértice: (0, 0)",
    ),
    ("f(x)=2*x+3; f(2)", "f(2) = 7"),
    # --- Sprint 5 equations ---
    ("x**2-4=0", "x₁ = -2, x₂ = 2"),
    ("2*x+3=7", "x = 2"),
    ("x**3-6*x**2+11*x-6=0", "x₁ = 1, x₂ = 2, x₃ = 3"),
    ("Abs(x-3)=5", "x₁ = -2, x₂ = 8"),
    ("x+y=5; x-y=1", "x = 3, y = 2"),
    ("x>2", "(2, ∞)"),
    ("x**2-4>0", "(-∞, -2) ∪ (2, ∞)"),
    # --- Sprint 4 algebra ---
    ("2+2", "4"),
    ("(x-1)*(x+1)", "(x - 1)*(x + 1)"),
    # --- Sprint 10 analytic geometry: retas ---
    ("distancia((0,0),(3,4))", "Distância: 5"),
    ("ponto_medio((0,0),(4,6))", "Ponto médio: (2, 3)"),
    ("coeficiente_angular((0,0),(2,4))", "Coeficiente angular: 2"),
    (
        "reta((0,0),(1,1))",
        "Tipo: reta oblíqua crescente; Equação geral: x - y = 0; Equação reduzida: y = x; "
        "Coeficiente angular: 1; Intercepto em x: 0; Intercepto em y: 0",
    ),
    ("relacao_retas([(0,0),(1,0)],[(0,0),(0,1)])", "Relação entre as retas: Perpendiculares ⊥"),
    # --- Sprint 11 analytic geometry: cônicas ---
    ("circunferencia((0,0),5)", "Tipo: circunferência; Centro: (0, 0); Raio: 5; Equação: x² + y² = 25"),
    (
        "circunferencia((0,0),(3,4))",
        "Tipo: circunferência; Centro: (0, 0); Raio: 5; Equação: x² + y² = 25",
    ),
    (
        "parabola((0,0),(0,2))",
        "Tipo: parábola; Vértice: (0, 0); Foco: (0, 2); Diretriz: y = -2; Eixo: vertical",
    ),
    (
        "elipse((0,0),5,3)",
        "Tipo: elipse; Centro: (0, 0); Semieixo maior: 5; Semieixo menor: 3; "
        "Focos: (-4, 0) e (4, 0); Excentricidade: 4/5",
    ),
    (
        "hiperbole((0,0),4,3)",
        "Tipo: hipérbole; Centro: (0, 0); Semieixos: a = 4, b = 3; Focos: (-5, 0) e (5, 0); "
        "Assíntotas: y = 3*x/4 e y = -3*x/4; Excentricidade: 5/4",
    ),
]

# Casos que devem levantar ExpressionError (mensagem não comparada — só o tipo)
ERROR_CASES = [
    "circunferencia((0,0),0)",
    "parabola((0,0),(0,0))",
    "elipse((0,0),3,5)",
    "hiperbole((0,0),-1,3)",
]


def main() -> int:
    failures = 0

    for expression, expected in EXACT_CASES:
        actual = _solve(expression)
        if actual != expected:
            failures += 1
            print(f"FALHOU | {expression!r}\n  esperado: {expected!r}\n  obtido  : {actual!r}")
        else:
            print(f"ok     | {expression!r} -> {actual!r}")

    for expression in ERROR_CASES:
        try:
            actual = _solve(expression)
            failures += 1
            print(f"FALHOU | {expression!r} deveria levantar ExpressionError, retornou {actual!r}")
        except ExpressionError as exc:
            print(f"ok     | {expression!r} -> ExpressionError: {exc}")

    total = len(EXACT_CASES) + len(ERROR_CASES)
    print(f"\n{total - failures}/{total} casos passaram.")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
