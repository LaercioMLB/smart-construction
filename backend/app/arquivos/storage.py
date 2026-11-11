from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING, Protocol
from urllib.parse import urlsplit

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.problems import ApiProblem
from app.core.settings import Settings

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client


class PrivateStorage(Protocol):
    bucket: str

    def put(self, key: str, data: bytes, content_type: str) -> None: ...
    def get(self, key: str, expected_size: int, expected_hash: str) -> bytes: ...
    def delete(self, key: str) -> None: ...
    def check(self) -> None: ...
    def close(self) -> None: ...


class S3PrivateStorage:
    def __init__(self, settings: Settings) -> None:
        endpoint = settings.s3_endpoint_url
        if endpoint is None or urlsplit(endpoint).scheme not in ("http", "https"):
            raise RuntimeError("Endpoint do armazenamento privado não configurado.")
        self.bucket = settings.s3_bucket
        try:
            access = settings.s3_access_key_file.read_text(encoding="utf-8").strip()
            secret = settings.s3_secret_key_file.read_text(encoding="utf-8").strip()
        except OSError:
            raise RuntimeError(
                "Credenciais do armazenamento privado indisponíveis."
            ) from None
        if len(access) < 32 or len(secret) < 32:
            raise RuntimeError("Credenciais do armazenamento privado inválidas.")
        self.client: S3Client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            region_name="us-east-1",
            aws_access_key_id=access,
            aws_secret_access_key=secret,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
                connect_timeout=3,
                read_timeout=5,
                retries={"total_max_attempts": 1},
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
            ),
        )

    def put(self, key: str, data: bytes, content_type: str) -> None:
        digest = hashlib.sha256(data).hexdigest()
        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
                Metadata={"sha256": digest},
                CacheControl="no-store",
            )
            stored = self.client.head_object(Bucket=self.bucket, Key=key)
            if (
                stored.get("ContentLength") != len(data)
                or stored.get("Metadata", {}).get("sha256") != digest
            ):
                raise ApiProblem(
                    503,
                    "STORAGE_UNAVAILABLE",
                    "Não foi possível confirmar o arquivo enviado.",
                )
        except (BotoCoreError, ClientError):
            raise ApiProblem(
                503,
                "STORAGE_UNAVAILABLE",
                "Armazenamento temporariamente indisponível.",
            ) from None

    def get(self, key: str, expected_size: int, expected_hash: str) -> bytes:
        try:
            result = self.client.get_object(Bucket=self.bucket, Key=key)
            body = result["Body"]
            try:
                data = body.read(expected_size + 1)
            finally:
                body.close()
            if (
                len(data) != expected_size
                or hashlib.sha256(data).hexdigest() != expected_hash
            ):
                raise ApiProblem(
                    503, "STORAGE_UNAVAILABLE", "Arquivo temporariamente indisponível."
                )
            return data
        except (BotoCoreError, ClientError):
            raise ApiProblem(
                503, "STORAGE_UNAVAILABLE", "Arquivo temporariamente indisponível."
            ) from None

    def delete(self, key: str) -> None:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
        except (BotoCoreError, ClientError):
            raise ApiProblem(
                503,
                "STORAGE_UNAVAILABLE",
                "Armazenamento temporariamente indisponível.",
            ) from None

    def delete_verified(self, key: str) -> None:
        """Manutenção: recusa versionamento e só confirma após HEAD 404."""
        try:
            versioning = self.client.get_bucket_versioning(Bucket=self.bucket)
            if versioning.get("Status") in ("Enabled", "Suspended"):
                raise ApiProblem(
                    503, "VERSIONED_STORAGE", "Exclusão exige bucket sem versões."
                )
            self.delete(key)
            try:
                self.client.head_object(Bucket=self.bucket, Key=key)
            except ClientError as exc:
                if (
                    exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
                    == 404
                ):
                    return
                raise
            raise ApiProblem(
                503, "DELETE_UNCONFIRMED", "Arquivo ainda presente após exclusão."
            )
        except (BotoCoreError, ClientError):
            raise ApiProblem(
                503, "DELETE_UNCONFIRMED", "Exclusão não confirmada pelo armazenamento."
            ) from None

    def check(self) -> None:
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except (BotoCoreError, ClientError):
            raise ApiProblem(
                503,
                "STORAGE_UNAVAILABLE",
                "Armazenamento temporariamente indisponível.",
            ) from None

    def close(self) -> None:
        self.client.close()
