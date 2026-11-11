"""Gera credenciais locais sem imprimir ou substituir valores existentes."""

import argparse
import json
import os
import secrets
from pathlib import Path


def setup(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    directory.chmod(0o700)
    for name in (
        "migration-password",
        "api-password",
        "s3-bootstrap-access-key",
        "s3-bootstrap-secret-key",
        "s3-api-access-key",
        "s3-api-secret-key",
        "s3-admin-password",
    ):
        path = directory / name
        try:
            descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            if len(path.read_text(encoding="utf-8").strip()) < 32:
                raise RuntimeError(f"Credencial existente invalida: {name}") from None
        else:
            with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as output:
                output.write(secrets.token_urlsafe(48) + "\n")
        # O diretorio 0700 protege no host; 0444 permite o bind de secrets
        # pelo Compose e a leitura pelo usuario sem root dentro da API.
        path.chmod(0o444)
    identities = {
        "identities": [
            {
                "name": "bootstrap",
                "credentials": [
                    {
                        "accessKey": (directory / "s3-bootstrap-access-key")
                        .read_text()
                        .strip(),
                        "secretKey": (directory / "s3-bootstrap-secret-key")
                        .read_text()
                        .strip(),
                    }
                ],
                "actions": ["Admin", "Read", "Write", "List", "Tagging"],
            },
            {
                "name": "api",
                "credentials": [
                    {
                        "accessKey": (directory / "s3-api-access-key")
                        .read_text()
                        .strip(),
                        "secretKey": (directory / "s3-api-secret-key")
                        .read_text()
                        .strip(),
                    }
                ],
                "actions": [
                    "Read:smart-cadastros-private",
                    "Write:smart-cadastros-private",
                    "List:smart-cadastros-private",
                ],
            },
        ]
    }
    config = directory / "s3-identities.json"
    if config.exists():
        if json.loads(config.read_text(encoding="utf-8")) != identities:
            raise RuntimeError(
                "Configuração S3 diverge das credenciais; revisar rotação."
            )
    else:
        with config.open("x", encoding="utf-8", newline="\n") as output:
            json.dump(identities, output)
            output.write("\n")
    config.chmod(0o444)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, required=True)
    args = parser.parse_args()
    setup(args.directory)
    print("Credenciais do backend prontas; valores existentes preservados.")
