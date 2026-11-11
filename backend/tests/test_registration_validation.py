import struct
import zlib
from copy import deepcopy
from datetime import date, timedelta
from io import BytesIO

import pytest
from PIL import Image, PngImagePlugin
from pydantic import ValidationError
from registration_samples import company_data, professional_data

from app.arquivos.images import MAX_FILE_BYTES, prepare_image
from app.cadastros.schemas import EmpresaDadosEntrada, ProfissionalDadosEntrada
from app.cadastros.validation import cnpj, cpf, phone
from app.core.problems import ApiProblem


def png_bytes() -> bytes:
    output = BytesIO()
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text("Author", "Identidade sintética para remoção")
    Image.new("RGB", (32, 24), "blue").save(output, format="PNG", pnginfo=metadata)
    return output.getvalue()


def test_documents_normalize_and_validate_check_digits() -> None:
    assert cpf("123.456.789-09") == "12345678909"
    assert cnpj("12.abc.345/01de-35") == "12ABC34501DE35"
    assert cnpj("11.222.333/0001-81") == "11222333000181"
    for invalid in (
        "00000000000",
        "12345678900",
        "１２３４５６７８９０９",
        "abc12345678909",
    ):
        with pytest.raises(ValueError):
            cpf(invalid)
    for invalid in (
        "00000000000000",
        "12ABC34501DE00",
        "12ABC34501DEAA",
        "12ABC34501DÉ35",
    ):
        with pytest.raises(ValueError):
            cnpj(invalid)


@pytest.mark.parametrize(
    "raw,expected",
    [("(45) 99123-4567", "+5545991234567"), ("+55 (11) 2345-6789", "+551123456789")],
)
def test_phone_accepts_mobile_and_business_landline(raw: str, expected: str) -> None:
    assert phone(raw) == expected


@pytest.mark.parametrize(
    "invalid",
    [
        "+5523991234567",
        "+5545891234567",
        "+5545999999999",
        "123",
        "+15545991234567",
        "abc45991234567",
    ],
)
def test_phone_rejects_invalid_ddd_or_number(invalid: str) -> None:
    with pytest.raises(ValueError):
        phone(invalid)


def test_professional_birth_optional_but_minor_and_future_rejected() -> None:
    data = professional_data()
    assert ProfissionalDadosEntrada.model_validate(data).nascimento is None
    data["nascimento"] = "2020-01-01"
    with pytest.raises(ValidationError):
        ProfissionalDadosEntrada.model_validate(data)
    data["nascimento"] = str(date.today() + timedelta(days=1))
    with pytest.raises(ValidationError):
        ProfissionalDadosEntrada.model_validate(data)


@pytest.mark.parametrize("invalid", [False, 1, "true", None])
def test_adulthood_declaration_is_explicit_strict_true(invalid: object) -> None:
    for model, data in [
        (ProfissionalDadosEntrada, professional_data()),
        (EmpresaDadosEntrada, company_data()),
    ]:
        data["aceites"]["maior_de_idade"] = invalid
        with pytest.raises(ValidationError):
            model.model_validate(data)


def test_birth_on_eighteenth_birthday_is_accepted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core import calendar

    monkeypatch.setattr(calendar, "business_today", lambda: date(2026, 10, 24))
    data = professional_data() | {"nascimento": "2008-10-24"}
    assert ProfissionalDadosEntrada.model_validate(data).nascimento == date(
        2008, 10, 24
    )
    with pytest.raises(ValidationError):
        ProfissionalDadosEntrada.model_validate(data | {"nascimento": "2008-10-25"})


@pytest.mark.parametrize(
    "field,value",
    [
        ("cpf", "00000000000"),
        ("nome", "  "),
        ("biografia", "curta"),
        ("biografia", "<script>texto não permitido</script>"),
        ("email", "email-invalido"),
        ("status", "aprovado"),
        ("cursos", [{"nome": "Curso", "inicio": 2025, "conclusao": 2020}]),
        ("cursos", [{"nome": "Curso", "inicio": date.today().year + 1}]),
    ],
)
def test_professional_invalid_fields_and_mass_assignment(
    field: str, value: object
) -> None:
    data = professional_data()
    data[field] = value
    with pytest.raises(ValidationError):
        ProfissionalDadosEntrada.model_validate(data)


@pytest.mark.parametrize(
    "choices",
    [
        [],
        [{"sugestao": "Teste", "principal": False}],
        [
            {"sugestao": "Pintor", "principal": True},
            {"sugestao": "PINTÓR", "principal": False},
        ],
        [
            {"sugestao": "Pintor", "principal": True},
            {"sugestao": "Pedreiro", "principal": True},
        ],
        [{"sugestao": "Teste", "principal": "true"}],
        [
            {
                "sugestao": "Teste",
                "profissao_id": "028fbd30-f4dc-4a8e-b000-000000000001",
                "principal": True,
            }
        ],
    ],
)
def test_profession_selection_rules(choices: object) -> None:
    data = professional_data()
    data["profissoes"] = choices
    with pytest.raises(ValidationError):
        ProfissionalDadosEntrada.model_validate(data)


def test_field_limits_company_documents_and_explicit_consents() -> None:
    assert EmpresaDadosEntrada.model_validate(company_data()).cnpj == "12ABC34501DE35"
    for changes in (
        {"cnpj": "12345678909"},
        {"responsavel": ""},
        {"segmento": ""},
        {"nome_fantasia": ""},
    ):
        data = company_data() | changes
        with pytest.raises(ValidationError):
            EmpresaDadosEntrada.model_validate(data)
    for value in (False, 1, "true"):
        data = deepcopy(professional_data())
        data["aceites"]["termos_aceitos"] = value
        with pytest.raises(ValidationError):
            ProfissionalDadosEntrada.model_validate(data)
    for count, field in ((6, "profissoes"), (11, "cursos")):
        data = professional_data()
        data[field] = [
            {"sugestao": f"Teste {i}", "principal": i == 0}
            if field == "profissoes"
            else {"nome": f"Curso {i}"}
            for i in range(count)
        ]
        with pytest.raises(ValidationError):
            ProfissionalDadosEntrada.model_validate(data)


def test_image_reencoding_removes_metadata_and_preserves_purpose() -> None:
    result = prepare_image(
        png_bytes(), content_type="image/png", purpose="foto_perfil", order=0
    )
    assert (result.width, result.height, result.purpose) == (32, 24, "foto_perfil")
    with Image.open(BytesIO(result.data)) as image:
        assert "Author" not in image.info and not image.getexif()
    output = BytesIO()
    exif = Image.Exif()
    exif[315] = "Autor sintético"
    Image.new("RGB", (16, 16)).save(output, format="JPEG", exif=exif)
    jpeg = prepare_image(
        output.getvalue(), content_type="image/jpeg", purpose="logo", order=0
    )
    with Image.open(BytesIO(jpeg.data)) as image:
        assert not image.getexif()


@pytest.mark.parametrize(
    "data,mime,status",
    [
        (b"<svg></svg>", "image/png", 422),
        (b"", "image/jpeg", 422),
        (png_bytes(), "image/jpeg", 422),
        (png_bytes(), "image/gif", 422),
        (b"a" * (MAX_FILE_BYTES + 1), "image/png", 413),
    ],
    ids=["svg", "empty", "wrong-mime", "unsupported-type", "over-five-mib"],
)
def test_image_bytes_type_and_size_are_checked(
    data: bytes, mime: str, status: int
) -> None:
    with pytest.raises(ApiProblem) as failure:
        prepare_image(data, content_type=mime, purpose="logo", order=0)
    assert failure.value.status == status


@pytest.mark.parametrize("width,height", [(8193, 1), (5001, 5000)])
def test_image_headers_over_limits_rejected_before_decoding(
    width: int, height: int
) -> None:
    data = bytearray(png_bytes())
    data[16:24] = struct.pack(">II", width, height)
    data[29:33] = struct.pack(">I", zlib.crc32(data[12:29]))
    with pytest.raises(ApiProblem) as failure:
        prepare_image(bytes(data), content_type="image/png", purpose="logo", order=0)
    assert failure.value.code == "IMAGE_DIMENSIONS"
