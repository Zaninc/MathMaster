"""Hardening III, Etapa 1 — novos limites de Settings (config.py):
compute_timeout_seconds, max_expression_nesting_depth, rate_limit_per_minute.
Hardening III, Etapa 8 — guard-rail de CORS (cors_origins rejeita "*").
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.config import Settings


def test_new_settings_have_sane_defaults() -> None:
    settings = Settings(_env_file=None)

    assert settings.compute_timeout_seconds == 5.0
    assert settings.max_expression_nesting_depth == 32
    assert settings.rate_limit_per_minute == 60


def test_new_settings_are_configurable_via_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MATHMASTER_COMPUTE_TIMEOUT_SECONDS", "2.5")
    monkeypatch.setenv("MATHMASTER_MAX_EXPRESSION_NESTING_DEPTH", "10")
    monkeypatch.setenv("MATHMASTER_RATE_LIMIT_PER_MINUTE", "5")

    settings = Settings(_env_file=None)

    assert settings.compute_timeout_seconds == 2.5
    assert settings.max_expression_nesting_depth == 10
    assert settings.rate_limit_per_minute == 5


def test_cors_origins_default_is_accepted() -> None:
    settings = Settings(_env_file=None)
    assert settings.cors_origins == ["http://localhost:3000"]


def test_cors_origins_rejects_wildcard() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, cors_origins=["*"])


def test_cors_origins_rejects_wildcard_mixed_with_explicit_origins() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, cors_origins=["https://mathmaster.example.com", "*"])


def test_cors_origins_rejects_wildcard_via_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MATHMASTER_CORS_ORIGINS", '["*"]')
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_cors_origins_accepts_explicit_origin_list() -> None:
    settings = Settings(_env_file=None, cors_origins=["https://mathmaster.example.com"])
    assert settings.cors_origins == ["https://mathmaster.example.com"]
