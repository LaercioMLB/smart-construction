"""Valida o contrato planejado; nao executa nem testa uma API real."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
CACHED_TOOLS = ROOT / ".cache" / "openapi-tools"
if CACHED_TOOLS.is_dir():
    sys.path.insert(0, str(CACHED_TOOLS))

try:
    from jsonschema import Draft202012Validator, FormatChecker
    from openapi_spec_validator import validate
    from referencing import Registry, Resource
    from referencing.jsonschema import DRAFT202012
except ImportError:
    raise SystemExit(
        "Instale as ferramentas: python -m pip install --target .cache/openapi-tools "
        "--cache-dir .cache/pip -r docs/api/requirements-validation.txt"
    )

SPEC = json.loads((ROOT / "docs" / "api" / "openapi.json").read_text(encoding="utf-8"))
SCHEMAS = SPEC["components"]["schemas"]
RESOURCE_ID = "urn:smart-construction:contrato"
REGISTRY = Registry().with_resource(
    RESOURCE_ID, Resource.from_contents(SPEC, default_specification=DRAFT202012)
)
ID = "00000000-0000-4000-8000-000000000001"


def validator(name: str) -> Draft202012Validator:
    return Draft202012Validator(
        {"$ref": f"{RESOURCE_ID}#/components/schemas/{name}"},
        registry=REGISTRY,
        format_checker=FormatChecker(),
    )


def professional() -> dict:
    # Documento estrutural de teste, sem afirmar verificadores ou titularidade.
    return {
        "nome": "Profissional Teste",
        "cpf": "00000000000",
        "whatsapp": "+5545000000000",
        "endereco": {"cidade": "Cidade Teste", "uf": "PR"},
        "biografia": "Apresentacao sintetica para validar o contrato.",
        "profissoes": [{"profissao_id": ID, "principal": True}],
        "aceites": {
            "termos_aceitos": True,
            "maior_de_idade": True,
            "versao_termos": "teste-v1",
            "privacidade_aceita": True,
            "versao_privacidade": "teste-v1",
            "autorizacao_publicacao": True,
        },
    }


def company() -> dict:
    return {
        "razao_social": "Empresa Teste",
        "cnpj": "AAAAAAAAAAAA00",
        "responsavel": "Responsavel Teste",
        "whatsapp": "+5545000000000",
        "segmento": "Segmento de teste",
        "endereco": {"cidade": "Cidade Teste", "uf": "PR"},
        "aceites": {
            "termos_aceitos": True,
            "maior_de_idade": True,
            "versao_termos": "teste-v1",
            "privacidade_aceita": True,
            "versao_privacidade": "teste-v1",
        },
    }


class ContractTests(unittest.TestCase):
    def test_openapi_structure(self) -> None:
        validate(SPEC)
        for schema in SCHEMAS.values():
            Draft202012Validator.check_schema(schema)

    def test_all_references_are_local_and_resolve(self) -> None:
        def visit(value: object) -> None:
            if isinstance(value, dict):
                if "$ref" in value:
                    reference = value["$ref"]
                    self.assertTrue(reference.startswith("#/"))
                    target = SPEC
                    for token in reference[2:].split("/"):
                        target = target[token.replace("~1", "/").replace("~0", "~")]
                for child in value.values():
                    visit(child)
            elif isinstance(value, list):
                for child in value:
                    visit(child)

        visit(SPEC)

    def test_operation_ids_are_unique(self) -> None:
        ids = [
            operation["operationId"]
            for methods in SPEC["paths"].values()
            for operation in methods.values()
        ]
        self.assertEqual(len(ids), len(set(ids)))

    def test_every_admin_operation_requires_session(self) -> None:
        for route, methods in SPEC["paths"].items():
            for method, operation in methods.items():
                if not route.startswith("/admin/") or (
                    route == "/admin/sessao" and method == "post"
                ):
                    continue
                with self.subTest(route=route, method=method):
                    expected = {"AdminSession": []}
                    if method != "get":
                        expected["CsrfToken"] = []
                    self.assertEqual(operation["security"], [expected])

    def test_mutations_of_records_require_current_version(self) -> None:
        for route, methods in SPEC["paths"].items():
            for method, operation in methods.items():
                if (
                    not route.startswith("/admin/")
                    or "{" not in route
                    or method == "get"
                ):
                    continue
                with self.subTest(route=route, method=method):
                    self.assertIn(
                        {"$ref": "#/components/parameters/IfMatch"},
                        operation["parameters"],
                    )
                    self.assertIn("412", operation["responses"])
                    self.assertIn("428", operation["responses"])

    def test_public_graph_has_no_private_fields(self) -> None:
        forbidden = {
            "cpf",
            "cnpj",
            "nascimento",
            "whatsapp",
            "email",
            "endereco",
            "rua",
            "cep",
            "numero",
            "complemento",
            "bairro",
            "historico",
            "bucket",
            "chave",
            "senha",
            "csrf_token",
            "protocolo",
            "rating",
            "reviewCount",
            "jobsCompleted",
        }

        def visit(value: object, seen: set[str]) -> None:
            if isinstance(value, dict):
                if "$ref" in value:
                    name = value["$ref"].split("/")[-1]
                    if name not in seen:
                        seen.add(name)
                        visit(SCHEMAS[name], seen)
                self.assertFalse(forbidden.intersection(value.get("properties", {})))
                if value.get("type") == "object":
                    self.assertIs(value.get("additionalProperties"), False)
                for child in value.values():
                    visit(child, seen)
            elif isinstance(value, list):
                for child in value:
                    visit(child, seen)

        for name in (
            "ProfissionaisPagina",
            "ProfissionalPublico",
            "ProfissoesPublicas",
        ):
            with self.subTest(schema=name):
                visit(SCHEMAS[name], set())

    def test_no_public_company_or_registration_lookup(self) -> None:
        for route, methods in SPEC["paths"].items():
            if not route.startswith("/admin/"):
                if route == "/cadastros/configuracao":
                    self.assertEqual(set(SCHEMAS["ConfiguracaoCadastro"]["properties"]), {"habilitado", "versao_termos", "versao_privacidade"})
                    self.assertEqual(methods["get"]["responses"]["200"]["content"]["application/json"]["schema"], {"$ref": "#/components/schemas/ConfiguracaoCadastro"})
                    continue
                self.assertFalse("empresa" in route and "get" in methods)
                self.assertFalse("cadastros" in route and "get" in methods)

    def test_minimal_professional_without_birth_address_photos(self) -> None:
        validator("ProfissionalDadosEntrada").validate(professional())

    def test_birth_shape_does_not_prove_age_eligibility(self) -> None:
        value = professional()
        value["nascimento"] = "2020-01-01"
        validator("ProfissionalDadosEntrada").validate(value)

    def test_adulthood_declaration_required_and_true_for_both_types(self) -> None:
        for schema, value in [("ProfissionalDadosEntrada", professional()), ("EmpresaDadosEntrada", company())]:
            del value["aceites"]["maior_de_idade"]
            self.assertFalse(validator(schema).is_valid(value))
            value["aceites"]["maior_de_idade"] = False
            self.assertFalse(validator(schema).is_valid(value))

    def test_optional_values_can_be_null(self) -> None:
        value = professional()
        value.update({"nascimento": None, "email": None})
        validator("ProfissionalDadosEntrada").validate(value)

    def test_professional_required_fields(self) -> None:
        for field in SCHEMAS["ProfissionalDadosEntrada"]["required"]:
            with self.subTest(field=field):
                value = professional()
                del value[field]
                self.assertFalse(validator("ProfissionalDadosEntrada").is_valid(value))

    def test_birth_and_email_formats(self) -> None:
        for field, invalid in (("nascimento", "2026-02-30"), ("email", "sem-arroba")):
            value = professional()
            value[field] = invalid
            self.assertFalse(validator("ProfissionalDadosEntrada").is_valid(value))

    def test_profession_suggestion_is_distinct_from_id(self) -> None:
        value = professional()
        value["profissoes"] = [{"sugestao": "Profissao Teste", "principal": True}]
        validator("ProfissionalDadosEntrada").validate(value)
        value["profissoes"][0]["profissao_id"] = ID
        self.assertFalse(validator("ProfissionalDadosEntrada").is_valid(value))

    def test_exactly_one_principal_and_max_five(self) -> None:
        for count, principal_count, accepted in (
            (0, 0, False),
            (1, 0, False),
            (1, 1, True),
            (5, 1, True),
            (5, 2, False),
            (6, 1, False),
        ):
            with self.subTest(count=count, principal_count=principal_count):
                value = professional()
                value["profissoes"] = [
                    {
                        "sugestao": f"Profissao Teste {index}",
                        "principal": index < principal_count,
                    }
                    for index in range(count)
                ]
                self.assertEqual(
                    validator("ProfissionalDadosEntrada").is_valid(value), accepted
                )

    def test_identical_professions_rejected(self) -> None:
        value = professional()
        value["profissoes"] = value["profissoes"] * 2
        self.assertFalse(validator("ProfissionalDadosEntrada").is_valid(value))

    def test_mass_assignment_rejected(self) -> None:
        for field in ("status", "publicado", "administrador_id", "rating", "criado_em"):
            with self.subTest(field=field):
                value = professional()
                value[field] = "forjado"
                self.assertFalse(validator("ProfissionalDadosEntrada").is_valid(value))
                self.assertFalse(
                    validator("ProfissionalAlteracoes").is_valid({field: "forjado"})
                )

    def test_company_alphanumeric_and_numeric_shapes(self) -> None:
        for document in ("AAAAAAAAAAAA00", "00000000000000"):
            value = company()
            value["cnpj"] = document
            validator("EmpresaDadosEntrada").validate(value)

    def test_company_does_not_accept_cpf_or_letters_in_check_digits(self) -> None:
        for document in ("00000000000", "aaaaaaaaaaaa00", "AAAAAAAAAAAAAA"):
            value = company()
            value["cnpj"] = document
            self.assertFalse(validator("EmpresaDadosEntrada").is_valid(value))

    def test_company_required_fields(self) -> None:
        for field in SCHEMAS["EmpresaDadosEntrada"]["required"]:
            with self.subTest(field=field):
                value = company()
                del value[field]
                self.assertFalse(validator("EmpresaDadosEntrada").is_valid(value))

    def test_terms_cannot_be_false(self) -> None:
        for schema, factory in (
            ("ProfissionalDadosEntrada", professional),
            ("EmpresaDadosEntrada", company),
        ):
            for field in factory()["aceites"]:
                if field.startswith("versao_"):
                    continue
                value = factory()
                value["aceites"][field] = False
                self.assertFalse(validator(schema).is_valid(value))

    def test_upload_counts_and_purposes(self) -> None:
        validator("ProfissionalEnvio").validate({"dados": json.dumps(professional())})
        self.assertFalse(
            validator("ProfissionalEnvio").is_valid({"dados": "{}", "logo": "imagem"})
        )
        self.assertFalse(
            validator("ProfissionalEnvio").is_valid(
                {"dados": "{}", "fotos_trabalhos": ["imagem"] * 7}
            )
        )
        self.assertFalse(
            validator("EmpresaEnvio").is_valid({"dados": "{}", "foto_perfil": "imagem"})
        )
        # contentSchema descreve JSON dentro de texto; validar a decodificacao separadamente.
        validator("ProfissionalDadosEntrada").validate(
            json.loads(json.dumps(professional()))
        )

    def test_public_model_rejects_contact_added_to_response(self) -> None:
        value = {
            "id": ID,
            "nome": "Profissional Teste",
            "biografia": "Apresentacao sintetica para contrato.",
            "localizacao": {"cidade": "Cidade Teste", "uf": "PR"},
            "profissoes": [
                {
                    "id": ID,
                    "nome": "Profissao Teste",
                    "slug": "profissao-teste",
                    "principal": True,
                }
            ],
            "cursos": [],
            "foto_perfil": None,
            "fotos_trabalhos": [],
        }
        validator("ProfissionalPublico").validate(value)
        value["whatsapp"] = "+5545000000000"
        self.assertFalse(validator("ProfissionalPublico").is_valid(value))

    def test_rejection_requires_reason(self) -> None:
        self.assertFalse(validator("Motivo").is_valid({}))
        self.assertFalse(validator("Motivo").is_valid({"motivo": ""}))

    def test_expected_version_is_explicit(self) -> None:
        version = Draft202012Validator(
            SPEC["components"]["parameters"]["IfMatch"]["schema"]
        )
        for value, accepted in (
            ('"1"', True),
            ('"3"', True),
            ("*", False),
            ('W/"3"', False),
            ("3", False),
        ):
            self.assertEqual(version.is_valid(value), accepted)

    def test_public_submissions_require_idempotency(self) -> None:
        for route in ("/cadastros/profissionais", "/cadastros/empresas"):
            self.assertIn(
                {"$ref": "#/components/parameters/IdempotencyKey"},
                SPEC["paths"][route]["post"]["parameters"],
            )

    def test_biography_boundaries(self) -> None:
        for size, accepted in ((19, False), (20, True), (400, True), (401, False)):
            value = professional()
            value["biografia"] = "a" * size
            self.assertEqual(
                validator("ProfissionalDadosEntrada").is_valid(value), accepted
            )

    def test_course_limit_and_required_name(self) -> None:
        for courses, accepted in (
            ([], True),
            ([{"nome": "Curso Teste"}] * 10, True),
            ([{"nome": "Curso Teste"}] * 11, False),
            ([{"instituicao": "Teste"}], False),
        ):
            value = professional()
            value["cursos"] = courses
            self.assertEqual(
                validator("ProfissionalDadosEntrada").is_valid(value), accepted
            )

    def test_city_and_uf_required_without_full_address(self) -> None:
        for address in (
            {"cidade": "Cidade Teste"},
            {"uf": "PR"},
            {"cidade": "Cidade Teste", "uf": "XX"},
        ):
            value = professional()
            value["endereco"] = address
            self.assertFalse(validator("ProfissionalDadosEntrada").is_valid(value))

    def test_edit_cannot_change_type_status_or_consents(self) -> None:
        validator("CadastroAlteracao").validate(
            {"tipo": "profissional", "alteracoes": {"nome": "Nome Teste"}}
        )
        for value in (
            {"tipo": "profissional", "alteracoes": {}},
            {"tipo": "empresa", "alteracoes": {"cpf": "00000000000"}},
            {
                "tipo": "profissional",
                "alteracoes": {"aceites": professional()["aceites"]},
            },
            {
                "tipo": "profissional",
                "alteracoes": {"nome": "Nome Teste"},
                "status": "aprovado",
            },
        ):
            self.assertFalse(validator("CadastroAlteracao").is_valid(value))

    def test_receipt_does_not_return_personal_data_or_lookup_token(self) -> None:
        value = {
            "protocolo": "cadastro-sintetico-para-teste",
            "status": "pendente",
            "recebido_em": "2026-10-23T12:00:00Z",
        }
        validator("Recebimento").validate(value)
        value["cpf"] = "00000000000"
        self.assertFalse(validator("Recebimento").is_valid(value))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--report", type=Path, help="Salvar resumo JSON dentro do repositorio."
    )
    args = parser.parse_args()
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(ContractTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if args.report:
        target = (ROOT / args.report).resolve()
        if not target.is_relative_to(ROOT):
            parser.error("O relatorio precisa ficar dentro do repositorio.")
        target.parent.mkdir(parents=True, exist_ok=True)
        report = {
            "status": "passed" if result.wasSuccessful() else "failed",
            "contract": "docs/api/openapi.json",
            "contract_sha256": hashlib.sha256(
                (ROOT / "docs/api/openapi.json").read_bytes()
            ).hexdigest(),
            "openapi_version": SPEC["openapi"],
            "contract_version": SPEC["info"]["version"],
            "operations": sum(len(methods) for methods in SPEC["paths"].values()),
            "schemas": len(SCHEMAS),
            "tests_run": result.testsRun,
            "failures": len(result.failures),
            "errors": len(result.errors),
            "tools": {
                name: importlib.metadata.version(name)
                for name in ("openapi-spec-validator", "jsonschema")
            },
            "runtime_api_tests_executed": False,
            "limitations": [
                "Validador somente de contrato; autenticacao, cadastros e bucket privado possuem testes reais e evidencias separados.",
                "JSON Schema nao valida verificadores de CPF/CNPJ, unicidade, idade/data futura, vinculos reais, transacoes, CSRF ou bytes das imagens.",
                "contentSchema e limites x-* sao anotacoes; o servidor precisa valida-los explicitamente.",
                "Documentos dos fixtures sao apenas entradas estruturais sinteticas; nao representam verificacao cadastral.",
            ],
        }
        target.write_text(
            json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
    raise SystemExit(0 if result.wasSuccessful() else 1)
