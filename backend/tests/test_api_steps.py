"""Sprint V2.9 (Passo a Passo) — contrato HTTP de `POST /solve/steps`, e
regressão explícita de que `/solve` continua 100% intocado (mesmo
contrato `{expression, result, approx}`, ver CLAUDE_RULES.md)."""
from __future__ import annotations

import pytest
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


# --- Sprint V2.14: integração por substituição (u-substitution) ------------------


def test_solve_steps_u_substitution_power_case(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(2*x*(x**2+1)**3, x)"})
    assert response.status_code == 200
    body = response.json()
    titles = [s["title"] for s in body["steps"]]
    assert titles == [
        "Integral original",
        "Identificando uma substituição",
        "Derivando u",
        "Substituindo",
        "Integrando",
        "Voltando para x",
        "Adicionando a constante de integração",
    ]
    assert body["steps"][1]["expression"] == "u=x**2 + 1"
    assert body["steps"][-1]["expression"] == "x**8/4 + x**6 + 3*x**4/2 + x**2 + C"


def test_solve_steps_u_substitution_combined_coefficient_case(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(6*x*(x**2+1)**5, x)"})
    assert response.status_code == 200
    steps = response.json()["steps"]
    assert steps[3]["expression"] == "3*integral(u**5, u)"
    assert steps[-1]["expression"] == "x**12/2 + 3*x**10 + 15*x**8/2 + 10*x**6 + 15*x**4/2 + 3*x**2 + C"


def test_solve_steps_u_substitution_rational_case_uses_natural_log(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(1/(2*x+1)*2, x)"})
    assert response.status_code == 200
    steps = response.json()["steps"]
    assert steps[-1]["expression"] == "ln(2*x + 1) + C"
    assert all("log(" not in s["expression"] for s in steps)


def test_solve_steps_u_substitution_constant_step_has_explanation(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(sin(5*x)*5, x)"})
    steps = response.json()["steps"]
    assert steps[-1]["explanation"] == (
        "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C."
    )


def test_solve_steps_bare_polynomial_still_uses_old_module_not_substitution(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(x**2, x)"})
    assert response.status_code == 200
    titles = [s["title"] for s in response.json()["steps"]]
    assert "Identificando uma substituição" not in titles


def test_solve_steps_u_substitution_out_of_scope_returns_friendly_400(client: TestClient) -> None:
    # x*sin(x) passou a ser suportado pela integração por partes (Sprint
    # V2.15, ver seção dedicada abaixo) — trig*trig continua fora de
    # escopo dos dois módulos.
    response = client.post("/solve/steps", json={"expression": "integral(sin(x)*cos(x), x)"})
    assert response.status_code == 400
    assert "ainda não foi implementado" in response.json()["detail"]


# --- Sprint V2.15: integração por partes ------------------------------------------


def test_solve_steps_integration_by_parts_polynomial_times_exponential(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(x*exp(x), x)"})
    assert response.status_code == 200
    body = response.json()
    titles = [s["title"] for s in body["steps"]]
    assert titles == [
        "Integral original",
        "Identificando integração por partes",
        "Derivando u",
        "Integrando dv",
        "Aplicando a fórmula",
        "Substituindo",
        "Calculando a integral restante",
        "Adicionando a constante de integração",
    ]
    assert body["steps"][1]["expression"] == "u=x, dv=exp(x)*dx"
    assert body["steps"][-1]["expression"] == "(x - 1)*exp(x) + C"


def test_solve_steps_integration_by_parts_bare_logarithm_uses_natural_log(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(ln(x), x)"})
    assert response.status_code == 200
    steps = response.json()["steps"]
    assert steps[1]["expression"] == "u=ln(x), dv=dx"
    assert steps[-1]["expression"] == "x*ln(x) - x + C"
    assert all("log(" not in s["expression"] for s in steps)


def test_solve_steps_integration_by_parts_polynomial_times_logarithm(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(x*ln(x), x)"})
    assert response.status_code == 200
    steps = response.json()["steps"]
    assert steps[1]["expression"] == "u=ln(x), dv=x*dx"
    assert steps[-1]["expression"] == "x**2*ln(x)/2 - x**2/4 + C"


def test_solve_steps_integration_by_parts_constant_step_has_explanation(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(x*sin(x), x)"})
    steps = response.json()["steps"]
    assert steps[-1]["explanation"] == (
        "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C."
    )


def test_solve_steps_integration_by_parts_never_steals_substitution_case(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(2*x*(x**2+1)**3, x)"})
    assert response.status_code == 200
    titles = [s["title"] for s in response.json()["steps"]]
    assert "Identificando uma substituição" in titles
    assert "Identificando integração por partes" not in titles


def test_solve_steps_integration_by_parts_needs_repetition_returns_dedicated_friendly_400(
    client: TestClient,
) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(x**2*exp(x), x)"})
    assert response.status_code == 400
    assert "aplicações sucessivas de integração por partes" in response.json()["detail"]


def test_solve_endpoint_unaffected_by_integration_by_parts_repetition_rejection(
    client: TestClient,
) -> None:
    """`/solve` continua calculando normalmente mesmo quando `/solve/steps`
    ainda não sabe explicar aplicações sucessivas de integração por
    partes — o motor de cálculo nunca foi alterado."""
    response = client.post("/solve", json={"expression": "integral(x**2*exp(x), x)"})
    assert response.status_code == 200
    assert response.json()["result"] == "Integral: (x² - 2x + 2)*exp(x) + C"


# --- Hotfix V2.15.1: paridade de Euler entre /solve e /solve/steps ---------------


@pytest.mark.parametrize("expression", ["integral(x*e^x, x)", "integral(x*e**x, x)"])
def test_solve_steps_bare_e_power_uses_integration_by_parts_not_fallback(
    client: TestClient, expression: str
) -> None:
    response = client.post("/solve/steps", json={"expression": expression})
    assert response.status_code == 200
    body = response.json()
    titles = [s["title"] for s in body["steps"]]
    assert titles == [
        "Integral original",
        "Identificando integração por partes",
        "Derivando u",
        "Integrando dv",
        "Aplicando a fórmula",
        "Substituindo",
        "Calculando a integral restante",
        "Adicionando a constante de integração",
    ]
    assert body["steps"][1]["expression"] == "u=x, dv=exp(x)*dx"
    assert body["steps"][-1]["expression"] == "(x - 1)*exp(x) + C"


# --- Sprint V2.16: frações parciais -----------------------------------------------


def test_solve_steps_partial_fractions_distinct_linear_factors(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(1/((x+1)*(x+2)), x)"})
    assert response.status_code == 200
    body = response.json()
    titles = [s["title"] for s in body["steps"]]
    assert titles == [
        "Integral original",
        "Identificando uma função racional",
        "Fatorando o denominador",
        "Montando as frações parciais",
        "Eliminando os denominadores",
        "Determinando os coeficientes",
        "Substituindo",
        "Separando a integral",
        "Integrando",
        "Adicionando a constante de integração",
    ]
    assert body["steps"][5]["expression"] == "A=1, B=-1"
    assert body["steps"][-1]["expression"] == "ln(x + 1) - ln(x + 2) + C"


def test_solve_steps_partial_fractions_repeated_linear_factor(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(1/(x*(x+1)**2), x)"})
    assert response.status_code == 200
    steps = response.json()["steps"]
    assert steps[3]["expression"] == "1/(x*(x + 1)**2)=A/x + B/(x + 1) + C/(x + 1)**2"
    assert steps[5]["expression"] == "A=1, B=-1, C=-1"
    assert steps[-1]["expression"] == "ln(x) - ln(x + 1) + 1/(x + 1) + C"


def test_solve_steps_partial_fractions_constant_step_has_explanation(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(1/(x*(x+1)), x)"})
    steps = response.json()["steps"]
    assert steps[-1]["explanation"] == (
        "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C."
    )


def test_solve_steps_partial_fractions_never_steals_substitution_or_by_parts(
    client: TestClient,
) -> None:
    substitution = client.post(
        "/solve/steps", json={"expression": "integral(2*x*(x**2+1)**3, x)"}
    )
    assert substitution.status_code == 200
    substitution_titles = [s["title"] for s in substitution.json()["steps"]]
    assert "Identificando uma substituição" in substitution_titles
    assert "Identificando uma função racional" not in substitution_titles

    by_parts = client.post("/solve/steps", json={"expression": "integral(x*exp(x), x)"})
    assert by_parts.status_code == 200
    by_parts_titles = [s["title"] for s in by_parts.json()["steps"]]
    assert "Identificando integração por partes" in by_parts_titles
    assert "Identificando uma função racional" not in by_parts_titles


def test_solve_endpoint_unaffected_by_improper_rational_handling(client: TestClient) -> None:
    """`/solve` sempre calculou este valor corretamente, independente do
    que `/solve/steps` sabia (ou não) explicar — o motor de cálculo nunca
    foi alterado. Desde a V2.18, `/solve/steps` também sabe explicar (ver
    `# --- Sprint V2.18` abaixo); este teste só confirma que `/solve`
    continua batendo com o mesmo valor de sempre."""
    response = client.post("/solve", json={"expression": "integral((x**2+1)/(x+1), x)"})
    assert response.status_code == 200
    assert response.json()["result"] == "Integral: x²/2 - x + 2*ln(x + 1) + C"


# --- Sprint V2.17: integrais trigonométricas --------------------------------------


def test_solve_steps_trig_sin_squared(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(sin(x)**2, x)"})
    assert response.status_code == 200
    body = response.json()
    titles = [s["title"] for s in body["steps"]]
    assert titles == [
        "Integral original",
        "Identificando uma potência trigonométrica",
        "Aplicando a identidade de redução de potência",
        "Substituindo na integral",
        "Fatorando a constante",
        "Integrando",
        "Adicionando a constante de integração",
    ]
    assert body["steps"][2]["expression"] == "sin(x)**2=(1-cos(2*x))/2"
    assert body["steps"][-1]["expression"] == "x/2 - sin(x)*cos(x)/2 + C"


def test_solve_steps_trig_sin_cubed_uses_substitution_technique(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(sin(x)**3, x)"})
    assert response.status_code == 200
    steps = response.json()["steps"]
    titles = [s["title"] for s in steps]
    assert titles == [
        "Integral original",
        "Identificando uma potência ímpar de sin",
        "Separando um fator sin(x)",
        "Aplicando sin²(x)=1-cos²(x)",
        "Reescrevendo a integral",
        "Aplicando a substituição",
        "Integrando",
        "Voltando para x",
        "Adicionando a constante de integração",
    ]
    assert steps[5]["expression"] == "u=cos(x), du=-sin(x)*dx"
    assert steps[-1]["expression"] == "cos(x)**3/3 - cos(x) + C"


def test_solve_steps_trig_sin_squared_cos_squared_golden_test(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(sin(x)**2*cos(x)**2, x)"})
    assert response.status_code == 200
    steps = response.json()["steps"]
    assert [s["title"] for s in steps] == [
        "Integral original",
        "Identificando potências pares de seno e cosseno",
        "Utilizando a identidade de ângulo duplo",
        "Elevando ao quadrado",
        "Aplicando redução de potência",
        "Reescrevendo",
        "Substituindo na integral",
        "Integrando",
        "Adicionando a constante de integração",
    ]
    assert steps[2]["expression"] == "sin(x)*cos(x)=sin(2*x)/2"
    assert steps[-1]["expression"] == "x/8 - sin(2*x)*cos(2*x)/16 + C"


def test_solve_steps_trig_tan_squared(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(tan(x)**2, x)"})
    assert response.status_code == 200
    steps = response.json()["steps"]
    assert steps[2]["expression"] == "tan(x)**2=sec(x)**2-1"
    assert steps[-1]["expression"] == "-x + sin(x)/cos(x) + C"


def test_solve_steps_trig_constant_step_has_explanation(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(cos(x)**2, x)"})
    steps = response.json()["steps"]
    assert steps[-1]["explanation"] == (
        "Como a derivada de uma constante é zero, adicionamos uma constante arbitrária C."
    )


def test_solve_steps_trig_never_steals_substitution_by_parts_or_partial_fractions(
    client: TestClient,
) -> None:
    substitution = client.post("/solve/steps", json={"expression": "integral(2*x*sin(x**2), x)"})
    assert substitution.status_code == 200
    assert "Identificando uma substituição" in [s["title"] for s in substitution.json()["steps"]]

    by_parts = client.post("/solve/steps", json={"expression": "integral(x*sin(x), x)"})
    assert by_parts.status_code == 200
    assert "Identificando integração por partes" in [s["title"] for s in by_parts.json()["steps"]]

    partial_fractions = client.post(
        "/solve/steps", json={"expression": "integral(1/((x+1)*(x+2)), x)"}
    )
    assert partial_fractions.status_code == 200
    assert "Identificando uma função racional" in [
        s["title"] for s in partial_fractions.json()["steps"]
    ]


def test_solve_steps_trig_out_of_scope_returns_friendly_400(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(tan(x)**3, x)"})
    assert response.status_code == 400
    assert "ainda não foi implementado" in response.json()["detail"]


def test_solve_endpoint_unaffected_by_trig_out_of_scope_rejection(client: TestClient) -> None:
    """`/solve` continua calculando normalmente mesmo quando `/solve/steps`
    ainda não sabe explicar essa forma trigonométrica — o motor de cálculo
    nunca foi alterado."""
    response = client.post("/solve", json={"expression": "integral(tan(x)**3, x)"})
    assert response.status_code == 200


# --- Sprint V2.18: divisão polinomial + frações parciais avançadas ---------------


def test_solve_steps_polynomial_division_example_1(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral((x**2+1)/(x+1), x)"})
    assert response.status_code == 200
    body = response.json()
    titles = [s["title"] for s in body["steps"]]
    assert titles == [
        "Integral original",
        "Identificando uma fração imprópria",
        "Dividindo os polinômios",
        "Verificando a divisão",
        "Reescrevendo a integral",
        "Separando a integral",
        "Integrando",
        "Adicionando a constante de integração",
    ]
    assert body["steps"][3]["expression"] == "x**2 + 1=(x + 1)*(x - 1)+2"
    assert body["steps"][-1]["expression"] == "x**2/2 - x + 2*ln(x + 1) + C"


def test_solve_steps_polynomial_division_exact_never_forces_partial_fractions(
    client: TestClient,
) -> None:
    response = client.post("/solve/steps", json={"expression": "integral((x**3+1)/(x+1), x)"})
    assert response.status_code == 200
    titles = [s["title"] for s in response.json()["steps"]]
    assert "Separando a integral" not in titles
    assert "Fatorando o denominador" not in titles
    assert response.json()["steps"][-1]["expression"] == "x**3/3 - x**2/2 + x + C"


def test_solve_steps_polynomial_division_combined_with_partial_fractions(
    client: TestClient,
) -> None:
    response = client.post(
        "/solve/steps", json={"expression": "integral((x**3+2*x**2+1)/(x**2-1), x)"}
    )
    assert response.status_code == 200
    body = response.json()
    titles = [s["title"] for s in body["steps"]]
    assert "Dividindo os polinômios" in titles
    assert "Fatorando o denominador" in titles
    assert "Montando as frações parciais" in titles
    assert body["steps"][-1]["expression"] == "x**2/2 + 2*x + 2*ln(x - 1) - ln(x + 1) + C"


def test_solve_steps_irreducible_quadratic_golden_example(client: TestClient) -> None:
    """Golden example 2 do ticket da V2.18: `1/((x+1)(x²+1))`, 11 passos,
    A=1/2, B=-1/2, C=1/2."""
    response = client.post(
        "/solve/steps", json={"expression": "integral(1/((x+1)*(x**2+1)), x)"}
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["steps"]) == 11
    titles = [s["title"] for s in body["steps"]]
    assert titles == [
        "Integral original",
        "Identificando uma função racional",
        "Fatorando o denominador",
        "Reconhecendo fator quadrático irredutível",
        "Montando as frações parciais",
        "Eliminando os denominadores",
        "Determinando os coeficientes",
        "Substituindo",
        "Separando a integral",
        "Integrando",
        "Adicionando a constante de integração",
    ]
    assert body["steps"][6]["expression"] == "A=1/2, B=-1/2, C=1/2"
    assert body["steps"][-1]["expression"] == "ln(x + 1)/2 - ln(x**2 + 1)/4 + atan(x)/2 + C"


def test_solve_steps_polynomial_division_out_of_scope_returns_friendly_400(
    client: TestClient,
) -> None:
    response = client.post(
        "/solve/steps", json={"expression": "integral(1/((x**2+1)*(x**2+4)), x)"}
    )
    assert response.status_code == 400
    assert "ainda não foi implementado" in response.json()["detail"]


def test_solve_steps_polynomial_division_never_steals_substitution_or_by_parts(
    client: TestClient,
) -> None:
    substitution = client.post(
        "/solve/steps", json={"expression": "integral(2*x*(x**2+1)**3, x)"}
    )
    assert substitution.status_code == 200
    substitution_titles = [s["title"] for s in substitution.json()["steps"]]
    assert "Identificando uma substituição" in substitution_titles
    assert "Identificando uma fração imprópria" not in substitution_titles

    by_parts = client.post("/solve/steps", json={"expression": "integral(x*exp(x), x)"})
    assert by_parts.status_code == 200
    by_parts_titles = [s["title"] for s in by_parts.json()["steps"]]
    assert "Identificando integração por partes" in by_parts_titles
    assert "Identificando uma fração imprópria" not in by_parts_titles


# --- Sprint V2.19: substituição trigonométrica ------------------------------------


def test_solve_steps_trig_substitution_case_a_direct(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(sqrt(9-x**2), x)"})
    assert response.status_code == 200
    body = response.json()
    titles = [s["title"] for s in body["steps"]]
    assert titles == [
        "Integral original",
        "Identificando o padrão",
        "Encontrando a",
        "Escolhendo a substituição",
        "Calculando dx",
        "Substituindo no radical",
        "Fatorando",
        "Usando a identidade pitagórica",
        "Considerando o intervalo escolhido",
        "Concluindo a substituição do radical",
        "Substituindo na integral",
        "Aplicando a identidade de redução de potência",
        "Integrando em θ",
        "Voltando para x",
        "Adicionando a constante de integração",
    ]
    assert body["steps"][2]["expression"] == "a**2=9, a=3"
    assert body["steps"][-1]["expression"] == "x*sqrt(9 - x**2)/2 + 9*asin(x/3)/2 + C"


def test_solve_steps_trig_substitution_case_a_inverse_golden_example(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(1/sqrt(9-x**2), x)"})
    assert response.status_code == 200
    body = response.json()
    assert body["steps"][-1]["expression"] == "asin(x/3) + C"
    titles = [s["title"] for s in body["steps"]]
    assert "Aplicando a identidade de redução de potência" not in titles


def test_solve_steps_trig_substitution_case_b(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(1/sqrt(x**2+4), x)"})
    assert response.status_code == 200
    body = response.json()
    assert body["steps"][3]["expression"] == "x=2*tan(theta)"
    assert body["steps"][-1]["expression"] == "asinh(x/2) + C"


def test_solve_steps_trig_substitution_case_c(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(1/sqrt(x**2-9), x)"})
    assert response.status_code == 200
    body = response.json()
    assert body["steps"][3]["expression"] == "x=3*sec(theta)"
    assert body["steps"][-1]["expression"] == "ln(x + sqrt(x**2 - 9)) + C"


def test_solve_steps_trig_substitution_no_hardcode(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(sqrt(25-x**2), x)"})
    assert response.status_code == 200
    body = response.json()
    assert body["steps"][2]["expression"] == "a**2=25, a=5"
    assert body["steps"][-1]["expression"] == "x*sqrt(25 - x**2)/2 + 25*asin(x/5)/2 + C"


def test_solve_steps_trig_substitution_out_of_scope_returns_friendly_400(client: TestClient) -> None:
    # √(x²+4) SEM o "1/" levaria a ∫sec³(θ)dθ — nenhuma infraestrutura
    # existente sabe explicar essa etapa, rejeição amigável genérica.
    response = client.post("/solve/steps", json={"expression": "integral(sqrt(x**2+4), x)"})
    assert response.status_code == 400
    assert "ainda não foi implementado" in response.json()["detail"]


def test_solve_endpoint_unaffected_by_trig_substitution_out_of_scope_rejection(
    client: TestClient,
) -> None:
    response = client.post("/solve", json={"expression": "integral(sqrt(x**2+4), x)"})
    assert response.status_code == 200
    assert response.json()["result"].startswith("Integral:")


def test_solve_steps_trig_substitution_never_steals_u_substitution_multiplied_radical(
    client: TestClient,
) -> None:
    response = client.post("/solve/steps", json={"expression": "integral(x*sqrt(x**2+4), x)"})
    # Fora de escopo tanto de `trig_substitution.py` quanto de
    # `u_substitution.py` hoje (lacuna pré-existente, documentada no
    # relatório) — o importante é NUNCA ser reivindicado incorretamente
    # como substituição trigonométrica, e `/solve` nunca quebrar.
    if response.status_code == 200:
        assert "Identificando o padrão" not in [s["title"] for s in response.json()["steps"]]
    solve_response = client.post("/solve", json={"expression": "integral(x*sqrt(x**2+4), x)"})
    assert solve_response.status_code == 200


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


def test_solve_steps_quotient_now_supported_since_v2_13(client: TestClient) -> None:
    # `x/sin(x)` era o exemplo de "quociente ainda não suportado" — desde
    # a Sprint V2.13 tem seu próprio módulo dedicado (ver seção abaixo).
    response = client.post("/solve/steps", json={"expression": "d/dx(x/sin(x))"})
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


# --- Sprint V2.12: limites ---------------------------------------------------


def test_solve_steps_limit_direct_substitution(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "limite(x**2+1, x, 2)"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Limite: 5"
    titles = [step["title"] for step in body["steps"]]
    assert titles == [
        "Expressão original",
        "Como a função é contínua em x=2, podemos substituir diretamente.",
        "Calculando",
    ]
    assert body["steps"][-1]["expression"] == "5"


def test_solve_steps_limit_rational_no_indetermination(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "limite((x+1)/(x+3), x, 2)"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Limite: 3/5"
    assert body["steps"][-1]["expression"] == "3/5"


def test_solve_steps_limit_zero_over_zero(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "limite((x**2-4)/(x-2), x, 2)"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Limite: 4"
    titles = [step["title"] for step in body["steps"]]
    assert "Reconhecemos uma indeterminação." in titles
    assert "Fatorando" in titles
    assert "Cancelando o fator comum" in titles
    assert body["steps"][-1]["expression"] == "4"


def test_solve_steps_limit_infinite_equal_degrees(client: TestClient) -> None:
    response = client.post(
        "/solve/steps", json={"expression": "limite((3*x**2+2)/(x**2-1), x, oo)"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Limite: 3"
    assert body["steps"][-1]["title"] == "Simplificando"
    assert body["steps"][-1]["expression"] == "3"


def test_solve_steps_limit_infinite_numerator_smaller_degree(client: TestClient) -> None:
    response = client.post(
        "/solve/steps", json={"expression": "limite((x**2+1)/(x**3+5), x, oo)"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Limite: 0"
    assert body["steps"][-1]["expression"] == "0"


def test_solve_steps_limit_unsupported_returns_friendly_400(client: TestClient) -> None:
    # sen(x)/x deixou de ser um exemplo válido de rejeição desde a Sprint
    # V2.12.1 (agora suportado); tan(x)/x deixou de ser válido desde a
    # V2.12.2 (0/0 genuíno, agora resolvido pela Regra de L'Hôpital — ver
    # seção "Sprint V2.12.2" abaixo). x*ln(x) é uma indeterminação 0*∞,
    # nunca um quociente 0/0 ou ∞/∞ — continua fora de escopo.
    response = client.post("/solve/steps", json={"expression": "limite(x*ln(x), x, 0)"})
    assert response.status_code == 400
    assert "ainda não foi implementado" in response.json()["detail"]


def test_solve_endpoint_unaffected_by_unsupported_limit_steps(client: TestClient) -> None:
    """`/solve` continua calculando normalmente um limite fora de escopo
    (indeterminação 0*∞), mesmo sem passo a passo — motor de cálculo 100%
    intocado."""
    response = client.post("/solve", json={"expression": "limite(x*ln(x), x, 0)"})
    assert response.status_code == 200
    assert response.json()["result"] == "Limite: 0"


# --- Sprint V2.12.1: limites trigonométricos fundamentais -------------------


def test_solve_steps_sin_over_x(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "limite(sin(x)/x, x, 0)"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Limite: 1"
    titles = [step["title"] for step in body["steps"]]
    assert titles == ["Expressão original", "Reconhecendo o limite fundamental", "Calculando"]
    assert body["steps"][-1]["expression"] == "1"


def test_solve_steps_x_over_sin_x(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "limite(x/sin(x), x, 0)"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Limite: 1"
    assert body["steps"][-1]["expression"] == "1"


def test_solve_steps_sin_of_ax_over_x(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "limite(sin(3*x)/x, x, 0)"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Limite: 3"
    titles = [step["title"] for step in body["steps"]]
    assert "Reescrevendo para isolar o limite fundamental" in titles
    assert body["steps"][-1]["expression"] == "3"


def test_solve_steps_sin_over_sin(client: TestClient) -> None:
    response = client.post(
        "/solve/steps", json={"expression": "limite(sin(5*x)/sin(2*x), x, 0)"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Limite: 5/2"
    assert body["steps"][-1]["expression"] == "5/2"


def test_solve_steps_one_minus_cos_over_x_squared(client: TestClient) -> None:
    response = client.post(
        "/solve/steps", json={"expression": "limite((1-cos(3*x))/x**2, x, 0)"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Limite: 9/2"
    titles = [step["title"] for step in body["steps"]]
    assert "Aplicando a identidade 1-cos(θ)=2sen²(θ/2)" in titles
    assert body["steps"][-1]["expression"] == "9/2"


def test_solve_steps_trigonometric_out_of_scope_returns_friendly_400(client: TestClient) -> None:
    # sen(x²)/x deixou de ser um exemplo válido desde a Sprint V2.12.2 (0/0
    # genuíno, resolvido pela Regra de L'Hôpital); cos(x²) nunca forma 0/0
    # ou ∞/∞ de verdade (denominador sempre 1) e continua fora de escopo.
    response = client.post("/solve/steps", json={"expression": "limite(cos(x**2), x, 0)"})
    assert response.status_code == 400
    assert "ainda não foi implementado" in response.json()["detail"]


def test_solve_steps_rational_limit_still_uses_v2_12_path(client: TestClient) -> None:
    # Regressão: um limite racional continua pelo caminho da V2.12,
    # nunca pelo novo módulo trigonométrico.
    response = client.post(
        "/solve/steps", json={"expression": "limite((x**2-4)/(x-2), x, 2)"}
    )
    assert response.status_code == 200
    titles = [step["title"] for step in response.json()["steps"]]
    assert "Reconhecendo o limite fundamental" not in titles


# --- Sprint V2.13: regra do quociente ----------------------------------------


def test_solve_steps_x_over_sin_x(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "d/dx(x/sin(x))"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Derivada: -x*cos(x)/sin(x)² + 1/sin(x)"
    titles = [step["title"] for step in body["steps"]]
    assert titles == [
        "Função original",
        "Identificando um quociente",
        "Aplicando a Regra do Quociente",
        "Calculando f'",
        "Calculando g'",
        "Substituindo",
        "Simplificando",
    ]
    assert body["steps"][-1]["expression"] == "-x*cos(x)/sin(x)**2 + 1/sin(x)"


def test_solve_steps_polynomial_over_polynomial_quotient(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "d/dx((x**2+1)/(x-3))"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Derivada: 2x/(x - 3) - (x² + 1)/(x - 3)²"
    assert body["steps"][-1]["expression"] == "2*x/(x - 3) - (x**2 + 1)/(x - 3)**2"


def test_solve_steps_ln_over_x_never_shows_log(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "d/dx(ln(x)/x)"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Derivada: -ln(x)/x² + x⁻²"
    for step in body["steps"]:
        assert "log(" not in step["expression"]
    identify_step = next(s for s in body["steps"] if s["title"] == "Identificando um quociente")
    assert identify_step["expression"] == "f=ln(x), g=x"
    assert body["steps"][-1]["expression"] == "-ln(x)/x**2 + x**(-2)"


def test_solve_steps_exp_over_x_squared(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "d/dx(exp(x)/x**2)"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Derivada: exp(x)/x² - 2*exp(x)/x³"
    assert body["steps"][-1]["expression"] == "exp(x)/x**2 - 2*exp(x)/x**3"


def test_solve_steps_chain_shaped_numerator_reuses_chain_rule(client: TestClient) -> None:
    response = client.post(
        "/solve/steps", json={"expression": "d/dx((x**2+1)**3/(x+2))"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Derivada: 6x*(x² + 1)²/(x + 2) - (x² + 1)³/(x + 2)²"
    titles = [step["title"] for step in body["steps"]]
    assert "Identificando função composta" in titles
    assert titles.count("Identificando um quociente") == 1
    assert body["steps"][-1]["expression"] == (
        "6*x*(x**2 + 1)**2/(x + 2) - (x**2 + 1)**3/(x + 2)**2"
    )


def test_solve_steps_product_shaped_numerator_reuses_product_rule(client: TestClient) -> None:
    response = client.post(
        "/solve/steps", json={"expression": "d/dx((x+1)*(x**2+3)/(x-1))"}
    )
    assert response.status_code == 200
    body = response.json()
    titles = [step["title"] for step in body["steps"]]
    assert "Identificando um produto" in titles
    assert titles.count("Identificando um quociente") == 1


def test_solve_steps_constant_denominator_still_uses_v2_10_path(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "d/dx(x**2/5)"})
    assert response.status_code == 200
    body = response.json()
    assert body["result"] == "Derivada: 2x/5"
    titles = [step["title"] for step in body["steps"]]
    assert "Identificando um quociente" not in titles


def test_solve_steps_pure_chain_rule_without_quotient_still_works(client: TestClient) -> None:
    # Regressão: (x²+1)³ sozinho (sem divisão) continua pelo caminho da
    # V2.11, nunca pelo novo módulo de quociente.
    response = client.post("/solve/steps", json={"expression": "d/dx((x**2+1)**3)"})
    assert response.status_code == 200
    titles = [step["title"] for step in response.json()["steps"]]
    assert "Identificando um quociente" not in titles


def test_solve_steps_pure_product_rule_without_quotient_still_works(client: TestClient) -> None:
    response = client.post("/solve/steps", json={"expression": "d/dx(x**2*sin(x))"})
    assert response.status_code == 200
    titles = [step["title"] for step in response.json()["steps"]]
    assert "Identificando um quociente" not in titles
