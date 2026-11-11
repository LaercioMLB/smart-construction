import pytest
from pydantic import ValidationError

from app.auth.security import (
    password_hash,
    password_matches,
    session_hash,
    valid_session_token,
)
from app.profissoes.schemas import ProfissaoAlteracao, ProfissaoCriacao


def test_password_hash_is_salted_and_rejects_wrong_or_missing_credentials() -> None:
    password = "Senha sintética para teste!"
    first, second = password_hash(password), password_hash(password)
    assert first != second
    assert password not in first
    assert password_matches(password, first)
    assert not password_matches("incorreta", first)
    assert not password_matches(password, None)
    assert not password_matches(password, "hash-corrompido")


def test_password_policy_and_session_token_shape() -> None:
    for password in ("curta", "x" * 257):
        with pytest.raises(ValueError):
            password_hash(password)
    assert valid_session_token("a" * 64)
    assert not valid_session_token("a" * 65)
    assert session_hash("a" * 64) != "a" * 64


@pytest.mark.parametrize(
    "data",
    [
        {},
        {"nome": None},
        {"nome": " "},
        {"nome": "<script>"},
        {"ativo": None},
        {"ativo": "false"},
        {"versao": 3},
    ],
)
def test_profession_edit_rejects_empty_null_or_server_fields(
    data: dict[str, object],
) -> None:
    with pytest.raises(ValidationError):
        ProfissaoAlteracao.model_validate(data)


def test_profession_input_normalizes_whitespace() -> None:
    assert ProfissaoCriacao(nome="  Técnico   de obras ").nome == "Técnico de obras"
    assert ProfissaoAlteracao(ativo=False).model_fields_set == {"ativo"}
