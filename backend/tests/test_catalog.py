import pytest
from pydantic import ValidationError

from app.profissoes.cli import InitialCatalog, load_initial_catalog


def test_reviewed_catalog_preserves_base_and_adds_architect() -> None:
    catalog = load_initial_catalog()
    assert catalog.status == "base_aprovada" and len(catalog.profissoes) == 25
    architect = next(item for item in catalog.profissoes if item.nome == "Arquiteto")
    assert architect.servicos_referencia == ["arquiteto"]


@pytest.mark.parametrize("names", [["Pintor", "píntor"], ["Outra"]])
def test_equivalent_names_or_other_cannot_enter_initial_catalog(
    names: list[str],
) -> None:
    data = load_initial_catalog().model_dump()
    data["profissoes"] = [
        {"nome": name, "servicos_referencia": ["pintor"]} for name in names
    ]
    with pytest.raises(ValidationError):
        InitialCatalog.model_validate(data)


def test_proposal_is_not_treated_as_reviewed_catalog() -> None:
    data = load_initial_catalog().model_dump()
    data["status"] = "proposta_pendente_de_revisao"
    with pytest.raises(ValidationError):
        InitialCatalog.model_validate(data)
