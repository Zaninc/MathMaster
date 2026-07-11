from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "MathMaster API (V0)"
    cors_origins: list[str] = ["http://localhost:3000"]
    log_level: str = "INFO"
    history_max_entries: int = 500

    # Hardening III: tempo máximo (em segundos) que um cálculo simbólico pode
    # rodar antes de o processo isolado ser encerrado à força (Etapa 3).
    compute_timeout_seconds: float = 5.0
    # Hardening III: profundidade máxima de aninhamento de parênteses/colchetes/
    # chaves aceita antes do parse (Etapa 2) — protege contra RecursionError.
    max_expression_nesting_depth: int = 32
    # Hardening III: limite de requisições por IP por minuto em /solve (Etapa 7).
    rate_limit_per_minute: int = 60

    model_config = SettingsConfigDict(env_file=".env", env_prefix="MATHMASTER_")


settings = Settings()
