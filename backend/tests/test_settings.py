from pathlib import Path

import pytest

from app.core.settings import Settings


def test_secret_is_read_from_file_and_url_escapes_special_characters(
    tmp_path: Path,
) -> None:
    password = "synthetic-password-with-@-%-and-/-more-than-32"
    path = tmp_path / "password"
    path.write_text(password, encoding="utf-8")
    settings = Settings(db_password_file=path)
    url = settings.database_url()
    assert url.password == password
    assert password not in str(url)
    assert password not in repr(settings)
    assert url.drivername == "postgresql+psycopg"


def test_missing_password_fails_without_showing_a_secret(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError, match="ausente ou inacessivel"):
        Settings(db_password_file=tmp_path / "missing").database_url()


def test_weak_existing_password_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "password"
    path.write_text("short", encoding="utf-8")
    with pytest.raises(RuntimeError, match="ao menos 32"):
        Settings(db_password_file=path).database_url()


def test_postgres_settings_have_bounded_timeouts() -> None:
    with pytest.raises(ValueError):
        Settings(db_connect_timeout=0)
    with pytest.raises(ValueError):
        Settings(db_port=0)
    with pytest.raises(ValueError):
        Settings(db_statement_timeout_ms=100000)
