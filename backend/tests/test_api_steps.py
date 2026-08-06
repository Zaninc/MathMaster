"""Sprint V2.9 (Passo a Passo) — contrato HTTP de `POST /solve/steps`, e
regressão explícita de que `/solve` continua 100% intocado (mesmo
contrato `{expression, result, approx}`, ver CLAUDE_RULES.md)."""
from __future__ import annotations

from fastapi.testclient import TestClient


def test_solve_steps_success(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "2*x+4=10"})
    assert response.status_code == 200
    body = response.json()
    assert body["expression"] == "2*x+4=10"
    assert body["result"] == "x = 3"
    assert isinstance(body["steps"], list)
    assert body["steps"][0]["title"] == "Equação inicial"
    assert body["steps"][-1]["expression"] == "x=3"


def test_solve_steps_quadratic(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "x**2-9=0"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "x₁ = -3, x₂ = 3"
    expressions = {s["expression"] for s in body["steps"]}
    assert {"x=3", "x=-3"} <= expressions


def test_solve_steps_system(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "x+y=5\nx-y=1"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "x = 3, y = 2"
    assert body["steps"][-1]["expression"] == "x=3, y=2"


def test_solve_steps_unsupported_domain_returns_400(client: TestClient) -> None:
    # Sprint V2.9.1 — grau 2 já é suportado; grau 3 continua fora de escopo.
    response = client.post("/solve/steps", json={"expression": "x**3+2=6"})
    assert response.status_code == 400
    assert "lineares e quadráticas" in response.json()["detail"]


def test_solve_steps_three_by_three_returns_friendly_400(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "x+y+z=6\nx-y=0\ny-z=1"})
    assert response.status_code == 400
    assert "mais de duas incógnitas" in response.json()["detail"]


def test_solve_steps_invalid_expression_returns_400(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "2x+=10"})
    assert response.status_code == 400


def test_solve_endpoint_contract_unchanged_by_steps_feature(client: TestClient) -> None:
    response = client.post("/solve", json={"expression": "2*x+4=10"})
    assert response.status_code == 200
    assert response.json() == {"expression": "2*x+4=10", "result": "x = 3", "approx": None}


def test_solve_steps_step_item_has_optional_title_and_explanation(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "2*x+4=10"})
    for step in response.json()["steps"]:
        assert "expression" in step
        assert "title" in step
        assert "explanation" in step


# --- Hotfix V2.9.1a: title_segments -----------------------------------------


def test_linear_steps_have_no_title_segments_regression(client: TestClient) -> None:
    """Nenhum título de equação linear tem matemática embutida — o campo
    novo é sempre `None`, comportamento idêntico ao contrato pré-hotfix."""
    response = client.post("/solve/steps", json={"expression": "2*x+4=10"})
    for step in response.json()["steps"]:
        assert step["title_segments"] is None


def test_system_steps_have_no_title_segments_regression(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "x+y=5\nx-y=1"})
    for step in response.json()["steps"]:
        assert step["title_segments"] is None


def test_quadratic_bhaskara_steps_return_structured_title_segments(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "2*x**2+3*x-5=0"})
    steps = response.json()["steps"]

    coeff_step = next(s for s in steps if "Identificando os coeficientes" in s["title"])
    assert coeff_step["title_segments"] == [
        {"type": "text", "content": "Identificando os coeficientes"},
        {"type": "math", "content": "a=2, b=3, c=-5"},
        {"type": "text", "content": "e calculando o discriminante"},
        {"type": "math", "content": "Delta=b**2-4*a*c"},
    ]
    # `title` (texto puro) nunca é removido, mesmo quando `title_segments` existe.
    assert coeff_step["title"] == (
        "Identificando os coeficientes (a=2, b=3, c=-5) e calculando o discriminante Δ=b²-4ac"
    )

    root_steps = [s for s in steps if "Aplicando a fórmula de Bhaskara" in s["title"]]
    assert len(root_steps) == 2
    for step in root_steps:
        types = [seg["type"] for seg in step["title_segments"]]
        assert types == ["text", "math", "text"]
        assert step["title_segments"][0]["content"] == "Aplicando a fórmula de Bhaskara"

    # Nenhum HTML/JSX nos segmentos — só texto/matemática pura.
    for step in steps:
        for seg in step.get("title_segments") or []:
            assert "<" not in seg["content"]
            assert ">" not in seg["content"]


def test_quadratic_factoring_and_direct_root_steps_have_no_title_segments() -> None:
    """Só os títulos de Bhaskara têm matemática embutida hoje — fatoração e
    raiz direta continuam com `title_segments=None` (nada a segmentar)."""
    from app.math_engine.steps import generate_steps

    for expr in ["x**2-5*x+6=0", "x**2=16"]:
        for step in generate_steps(expr):
            assert step.title_segments is None


# --- Sprint V2.10: derivadas --------------------------------------------------


def test_solve_steps_derivative_polynomial(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "d/dx(x**2+3*x)"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Derivada: 2x + 3"
    assert body["steps"][0]["title"] == "Função original"
    assert body["steps"][-1]["title"] == "Somando os resultados"
    assert body["steps"][-1]["expression"] == "2*x + 3"


def test_solve_steps_derivative_technical_syntax_also_works(client: TestClient) -> None:
    # `d/dx(...)` normaliza para `derivada(...)`, mas a sintaxe técnica
    # (o que o /solve já aceita) também deve funcionar sem tradução extra.
    response = client.post("/solve/steps", json={"expression": "derivada(x**2, x)"})
    assert response.status_code == 200
    assert response.json()["steps"][-1]["expression"] == "2*x"


def test_solve_steps_derivative_with_title_segments(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "d/dx(x**5)"})
    assert response.status_code == 200
    step = response.json()["steps"][-1]
    assert step["title_segments"] == [
        {"type": "text", "content": "Derivando"},
        {"type": "math", "content": "x**5"},
        {"type": "text", "content": "pela regra da potência"},
    ]


def test_solve_steps_derivative_unsupported_returns_friendly_400(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "d/dx(sin(x))"})
    assert response.status_code == 400
    assert "ainda não foi implementado" in response.json()["detail"]


def test_solve_endpoint_unaffected_by_unsupported_derivative_steps(client: TestClient) -> None:
    """`/solve` continua calculando normalmente qualquer derivada, mesmo
    quando `/solve/steps` ainda não sabe explicá-la passo a passo — o
    motor de cálculo (`calculus/derivatives.py`) nunca foi alterado."""
    response = client.post("/solve", json={"expression": "d/dx(sin(x))"})
    assert response.status_code == 200
    assert response.json()["result"] == "Derivada: cos(x)"


# --- Sprint V2.10.1: integrais --------------------------------------------------


def test_solve_steps_integral_polynomial(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(x**2+3*x, x)"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Integral: x³/3 + 3x²/2 + C"
    assert body["steps"][0]["title"] == "Integral original"
    assert body["steps"][-1]["title"] == "Adicionando a constante de integração"
    assert body["steps"][-1]["expression"] == "x**3/3 + 3*x**2/2 + C"


def test_solve_steps_integral_natural_notation_also_works(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "∫x⁵dx"})
    assert response.status_code == 200
    assert response.json()["steps"][-1]["expression"] == "x**6/6 + C"


def test_solve_steps_integral_with_title_segments(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(x**5, x)"})
    assert response.status_code == 200
    steps = response.json()["steps"]
    power_step = next(s for s in steps if "regra da potência" in s["title"])
    assert power_step["title_segments"] == [
        {"type": "text", "content": "Integrando"},
        {"type": "math", "content": "x**5"},
        {"type": "text", "content": "pela regra da potência"},
    ]


def test_solve_steps_integral_constant_step_has_explanation(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(x**2+3*x, x)"})
    steps = response.json()["steps"]
    constant_step = steps[-1]
    assert constant_step["explanation"] == (
        "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C."
    )


def test_solve_steps_integral_unsupported_returns_friendly_400(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(sin(x), x)"})
    assert response.status_code == 400
    assert "ainda não foi implementado" in response.json()["detail"]


def test_solve_steps_definite_integral_now_supported_since_v2_10_2(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(x**2, x, 0, 1)"})
    assert response.status_code == 200
    assert response.json()["steps"][-1]["expression"] == "1/3"


def test_solve_endpoint_unaffected_by_unsupported_integral_steps(client: TestClient) -> None:
    """`/solve` continua calculando normalmente qualquer integral, mesmo
    quando `/solve/steps` ainda não sabe explicá-la passo a passo — o
    motor de cálculo (`calculus/integrals.py`) nunca foi alterado."""
    response = client.post("/solve", json={"expression": "integral(sin(x), x)"})
    assert response.status_code == 200
    assert response.json()["result"] == "Integral: -cos(x) + C"


# --- Sprint V2.10.2: integrais definidas -----------------------------------------


def test_solve_steps_definite_integral(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(x**2, x, 0, 2)"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Integral definida: 8/3"
    titles = [s["title"] for s in body["steps"]]
    assert titles == [
        "Integral original",
        "Integrando x² pela regra da potência",
        "Aplicando o Teorema Fundamental do Cálculo",
        "Substituindo os limites",
        "Calculando",
    ]
    assert body["steps"][-1]["expression"] == "8/3"


def test_solve_steps_definite_integral_never_has_plus_c(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(x**2+3*x, x, 0, 2)"})
    for step in response.json()["steps"]:
        assert "+ C" not in step["expression"]


def test_solve_steps_definite_integral_equal_bounds_returns_zero(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(x**2, x, 3, 3)"})
    assert response.status_code == 200
    steps = response.json()["steps"]
    assert steps[-1]["expression"] == "0"
    assert steps[-1]["explanation"] is not None


def test_solve_steps_definite_integral_inverted_bounds_preserves_sign(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(x**2, x, 2, 0)"})
    assert response.status_code == 200
    assert response.json()["steps"][-1]["expression"] == "-8/3"


def test_solve_steps_definite_integral_unsupported_returns_friendly_400(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(sin(x), x, 0, 1)"})
    assert response.status_code == 400
    assert "ainda não foi implementado" in response.json()["detail"]


def test_solve_endpoint_unaffected_by_unsupported_definite_integral_steps(client: TestClient) -> None:
    """`/solve` continua calculando normalmente qualquer integral definida,
    mesmo quando `/solve/steps` ainda não sabe explicá-la — o motor de
    cálculo (`calculus/integrals.py:compute_definite_integral`) nunca foi
    alterado."""
    response = client.post("/solve", json={"expression": "integral(sin(x), x, 0, 1)"})
    assert response.status_code == 200
    assert response.json()["result"] == "Integral definida: 1 - cos(1)"


# --- Sprint V2.11: regra do produto e regra da cadeia -----------------------


def test_solve_steps_product_rule(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "d/dx(x**2*sin(x))"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Derivada: x²*cos(x) + 2x*sin(x)"
    assert body["steps"][0]["title"] == "Função original"
    assert body["steps"][1]["title"] == "Identificando um produto"
    assert body["steps"][-1]["title"] == "Simplificando"
    assert body["steps"][-1]["expression"] == "x**2*cos(x) + 2*x*sin(x)"


def test_solve_steps_product_rule_never_hidden_by_polynomial_expansion(client: TestClient) -> None:
    # (x+1)(x²+3) TAMBÉM se expande pra polinômio simples — o passo a passo
    # precisa continuar ensinando a regra do produto, não a linearidade.
    response = client.post("/solve/steps", json={"expression": "d/dx((x+1)*(x**2+3))"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Derivada: x² + 2x*(x + 1) + 3"
    titles = [step["title"] for step in body["steps"]]
    assert "Identificando um produto" in titles
    assert "Identificando função composta" not in titles


def test_solve_steps_chain_rule_power(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "d/dx((x**2+1)**3)"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Derivada: 6x*(x² + 1)²"
    titles = [step["title"] for step in body["steps"]]
    assert titles == [
        "Função original",
        "Identificando função composta",
        "Derivando a externa",
        "Derivando a interna",
        "Aplicando a regra da cadeia",
        "Simplificando",
    ]
    assert body["steps"][-1]["expression"] == "6*x*(x**2 + 1)**2"


def test_solve_steps_chain_rule_trig(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "d/dx(sin(x**2))"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Derivada: 2x*cos(x²)"
    assert body["steps"][-1]["title"] == "Aplicando a regra da cadeia"
    assert body["steps"][-1]["expression"] == "2*x*cos(x**2)"


def test_solve_steps_chain_rule_exp(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "d/dx(exp(x**2))"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Derivada: 2x*exp(x²)"
    assert body["steps"][-1]["expression"] == "2*x*exp(x**2)"


def test_solve_steps_product_and_chain_combined(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "d/dx((x**2+1)**3*sin(x))"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Derivada: 6x*(x² + 1)²*sin(x) + (x² + 1)³*cos(x)"
    titles = [step["title"] for step in body["steps"]]
    assert titles.count("Identificando um produto") == 1
    assert titles.count("Identificando função composta") == 1
    assert body["steps"][-1]["expression"] == "6*x*(x**2 + 1)**2*sin(x) + (x**2 + 1)**3*cos(x)"


def test_solve_steps_quotient_unsupported_returns_friendly_400(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "d/dx(x/sin(x))"})
    assert response.status_code == 400
    assert "ainda não foi implementado" in response.json()["detail"]


def test_solve_endpoint_unaffected_by_unsupported_quotient_derivative_steps(
    client: TestClient,
) -> None:
    """`/solve` continua calculando normalmente uma derivada de quociente,
    mesmo sem passo a passo (regra do quociente fica para versões
    futuras) — motor de cálculo 100% intocado."""
    response = client.post("/solve", json={"expression": "d/dx(x/sin(x))"})
    assert response.status_code == 200
    assert response.json()["result"] == "Derivada: -x*cos(x)/sin(x)² + 1/sin(x)"


def test_solve_steps_basic_derivative_still_uses_v2_10_path(client: TestClient) -> None:
    # Regressão: uma derivada polinomial simples continua pelo caminho da
    # V2.10 (regra da potência/linearidade), nunca pelo novo módulo.
    response = client.post("/solve/steps", json={"expression": "d/dx(x**2+3*x)"})
    assert response.status_code == 200
    titles = [step["title"] for step in response.json()["steps"]]
    assert "Identificando um produto" not in titles
    assert "Identificando função composta" not in titles
