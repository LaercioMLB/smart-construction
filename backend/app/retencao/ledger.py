"""Registro externo ao dump. Escrita atômica antes de qualquer exclusão."""

import hashlib
import json
import os
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Literal
from uuid import UUID, uuid4

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class MinimalEvent(Record):
    id: UUID
    acao: str = Field(max_length=40)
    ocorrido_em: AwareDatetime
    administrador_id: UUID | None


class MinimalConsent(Record):
    tipo: str = Field(max_length=20)
    versao: str = Field(max_length=80)
    aceito_em: AwareDatetime


class Erasure(Record):
    cadastro_id: UUID
    encerrado_em: AwareDatetime
    expira_em: AwareDatetime
    administrador_id: UUID
    motivo: Literal["solicitacao_titular", "fim_finalidade", "cadastro_indevido"]
    eventos: list[MinimalEvent]
    aceites: list[MinimalConsent]
    eliminado_em: AwareDatetime | None = None


class FileErasure(Record):
    arquivo_id: UUID
    cadastro_id: UUID
    bucket: str
    chave: str = Field(pattern=r"^cadastros/[a-f0-9]{32}/[a-f0-9]{32}\.(jpg|png)$")
    registrado_em: AwareDatetime
    eliminado_em: AwareDatetime | None = None


class PreservationRecord(Record):
    id: UUID = Field(default_factory=uuid4)
    entidade_id: UUID
    referencia: str = Field(pattern=r"^[A-Za-z0-9_-]{3,80}$")
    responsavel_id: UUID
    registrado_em: AwareDatetime
    ate: AwareDatetime


class State(Record):
    formato: Literal[1] = 1
    origem: UUID
    exclusoes: list[Erasure] = Field(default_factory=list)
    arquivos: list[FileErasure] = Field(default_factory=list)
    preservacoes: list[PreservationRecord] = Field(default_factory=list)


class Envelope(Record):
    sha256: str
    dados: State


def canonical(state: State) -> bytes:
    return json.dumps(
        state.model_dump(mode="json"), sort_keys=True, separators=(",", ":")
    ).encode()


class Ledger:
    def __init__(self, directory: Path) -> None:
        self.directory = directory

    def initialize(self) -> UUID:
        self.directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(self.directory, 0o700)
        if (self.directory / "ledger.json").exists():
            return self.read().origem
        # Nunca interpretar perda do registro como instalação nova.
        if any(self.directory.iterdir()):
            raise ValueError(
                "Diretório de retenção incompleto; recupere a cópia atual."
            )
        state = State(origem=uuid4())
        self.write(state)
        return state.origem

    def read(self) -> State:
        source = self.directory / "ledger.json"
        if source.is_symlink():
            raise ValueError("Registro de retenção não pode ser link.")
        data = source.read_bytes()
        envelope = Envelope.model_validate_json(data)
        raw: dict[str, object] = json.loads(data)
        encoded = json.dumps(
            raw["dados"], sort_keys=True, separators=(",", ":")
        ).encode()
        # Conferir o payload original antes de acrescentar defaults compatíveis.
        if hashlib.sha256(encoded).hexdigest() != envelope.sha256:
            raise ValueError("Registro de retenção corrompido.")
        return envelope.dados

    def write(self, state: State) -> None:
        # O chamador mantém o lock de operação; tmp exclusivo e fsync antes de replace.
        target = self.directory / "ledger.json"
        temporary = self.directory / f".write-{uuid4().hex}"
        data = Envelope(
            sha256=hashlib.sha256(canonical(state)).hexdigest(), dados=state
        )
        try:
            with temporary.open("xb") as stream:
                os.chmod(temporary, 0o600)
                stream.write(data.model_dump_json().encode())
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, target)
            if os.name == "posix":
                descriptor = os.open(self.directory, os.O_RDONLY)
                try:
                    os.fsync(descriptor)
                finally:
                    os.close(descriptor)
        finally:
            temporary.unlink(missing_ok=True)

    @contextmanager
    def locked(self) -> Iterator[None]:
        lock = self.directory / ".lock"
        lock.mkdir(mode=0o700)
        try:
            self.read()
            yield
        finally:
            lock.rmdir()

    def erase(self, record: Erasure) -> None:
        state = self.read()
        existing = next(
            (
                item
                for item in state.exclusoes
                if item.cadastro_id == record.cadastro_id
            ),
            None,
        )
        if existing is not None:
            if existing != record:
                raise ValueError("Encerramento já registrado com outro marco.")
            return
        self.write(state.model_copy(update={"exclusoes": [*state.exclusoes, record]}))

    def files(self, records: list[FileErasure]) -> None:
        state = self.read()
        existing = {item.arquivo_id: item for item in state.arquivos}
        for item in records:
            previous = existing.get(item.arquivo_id)
            if previous is not None and (
                previous.chave != item.chave or previous.bucket != item.bucket
            ):
                raise ValueError("Vínculo de arquivo alterado.")
            existing.setdefault(item.arquivo_id, item)
        self.write(state.model_copy(update={"arquivos": list(existing.values())}))

    def finish(self, identifier: UUID, moment: datetime, *, file: bool = False) -> None:
        state = self.read()
        if file:
            values = [
                item.model_copy(update={"eliminado_em": moment})
                if item.arquivo_id == identifier and item.eliminado_em is None
                else item
                for item in state.arquivos
            ]
            self.write(state.model_copy(update={"arquivos": values}))
        else:
            entries = [
                item.model_copy(update={"eliminado_em": moment})
                if item.cadastro_id == identifier and item.eliminado_em is None
                else item
                for item in state.exclusoes
            ]
            self.write(state.model_copy(update={"exclusoes": entries}))

    def preserve(self, record: PreservationRecord) -> None:
        state = self.read()
        values = [
            item
            for item in state.preservacoes
            if item.entidade_id != record.entidade_id
        ]
        self.write(state.model_copy(update={"preservacoes": [*values, record]}))


def months_after(moment: datetime, months: int) -> datetime:
    from calendar import monthrange

    index = moment.year * 12 + moment.month - 1 + months
    year, month = divmod(index, 12)
    month += 1
    return moment.replace(
        year=year, month=month, day=min(moment.day, monthrange(year, month)[1])
    )
