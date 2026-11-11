"""Expira somente pacotes reconhecidos, íntegros e com mais de 30 dias."""

import hashlib
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path

FILES = {
    "database.dump",
    "editorial.tar",
    "private.tar",
    "secrets.tar",
    "env.production",
    "release.txt",
    "retention-origin.txt",
}
SNAPSHOT = re.compile(r"^(\d{8}T\d{6}Z)-[0-9]+$")


def snapshot_time(name: str) -> datetime:
    match = SNAPSHOT.fullmatch(name)
    if match is None:
        raise ValueError("Identificador de backup inválido.")
    return datetime.strptime(match[1], "%Y%m%dT%H%M%SZ").replace(tzinfo=UTC)


def verify_package(directory: Path) -> None:
    if directory.is_symlink() or not directory.is_dir():
        raise ValueError("Pacote precisa ser diretório físico.")
    expected = FILES | {"SHA256SUMS"}
    if {item.name for item in directory.iterdir()} != expected:
        raise ValueError("Pacote incompleto, preservado ou não reconhecido.")
    manifest: dict[str, str] = {}
    for line in (directory / "SHA256SUMS").read_text(encoding="ascii").splitlines():
        match = re.fullmatch(r"([a-f0-9]{64})  ([a-zA-Z0-9._-]+)", line)
        if match is None or match[2] in manifest:
            raise ValueError("Manifesto inválido.")
        manifest[match[2]] = match[1]
    if set(manifest) != FILES:
        raise ValueError("Lista de arquivos inesperada.")
    for name, digest in manifest.items():
        path = directory / name
        if path.is_symlink() or not path.is_file():
            raise ValueError("Link ou arquivo inesperado no backup.")
        with path.open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != digest:
                raise ValueError("Backup corrompido.")


def expire_backups(
    root: Path, *, apply: bool = False, moment: datetime | None = None
) -> dict[str, list[str]]:
    moment = moment or datetime.now(UTC)
    if root.is_symlink() or not root.is_dir():
        raise ValueError("Raiz dos backups inválida.")
    root = root.resolve(strict=True)
    result: dict[str, list[str]] = {"candidatos": [], "removidos": [], "revisar": []}
    for directory in sorted(root.iterdir()):
        if SNAPSHOT.fullmatch(directory.name) is None:
            continue
        if snapshot_time(directory.name) >= moment - timedelta(days=30):
            continue
        try:
            if directory.resolve().parent != root:
                raise ValueError("Pacote fora da raiz autorizada.")
            verify_package(directory)
        except (ValueError, OSError):
            result["revisar"].append(directory.name)
            continue
        result["candidatos"].append(directory.name)
        if apply:
            # Não usa remoção recursiva: apenas arquivos exatos já verificados.
            for name in sorted(FILES | {"SHA256SUMS"}):
                (directory / name).unlink()
            directory.rmdir()
            result["removidos"].append(directory.name)
    return result
