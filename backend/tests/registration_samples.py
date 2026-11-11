"""Entradas exclusivamente sintéticas; documentos são vetores de algoritmo."""

from uuid import UUID


def professional_data(profession: UUID | None = None) -> dict:
    return {
        "nome": "Profissional Sintético",
        "cpf": "12345678909",
        "whatsapp": "+5545991234567",
        "email": "teste@example.com",
        "endereco": {"cidade": "Cidade Sintética", "uf": "PR"},
        "biografia": "Biografia sintética para verificar o recebimento do cadastro.",
        "profissoes": [
            {"profissao_id": str(profession), "principal": True}
            if profession
            else {"sugestao": "Pintor Sintético", "principal": True}
        ],
        "aceites": {
            "termos_aceitos": True,
            "maior_de_idade": True,
            "versao_termos": "teste-v1",
            "privacidade_aceita": True,
            "versao_privacidade": "teste-v1",
            "autorizacao_publicacao": True,
        },
    }


def company_data() -> dict:
    return {
        "razao_social": "Empresa Sintética Ltda",
        "cnpj": "12ABC34501DE35",
        "responsavel": "Responsável Sintético",
        "whatsapp": "+5545991234567",
        "segmento": "Materiais de Teste",
        "endereco": {"cidade": "Cidade Sintética", "uf": "PR"},
        "aceites": {
            "termos_aceitos": True,
            "maior_de_idade": True,
            "versao_termos": "teste-v1",
            "privacidade_aceita": True,
            "versao_privacidade": "teste-v1",
        },
    }
