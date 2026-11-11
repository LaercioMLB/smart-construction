"""Inicializa somente o bucket privado fixo e recusa políticas públicas."""

from botocore.exceptions import ClientError

from app.arquivos.storage import S3PrivateStorage
from app.core.settings import Settings


def main() -> None:
    settings = Settings()
    if settings.s3_bucket != "smart-cadastros-private":
        raise SystemExit(
            "Bootstrap permitido somente para o bucket privado de cadastros."
        )
    store = S3PrivateStorage(settings)
    try:
        try:
            store.client.head_bucket(Bucket=store.bucket)
        except ClientError as exc:
            if exc.response["ResponseMetadata"]["HTTPStatusCode"] != 404:
                raise
            store.client.create_bucket(Bucket=store.bucket)
        try:
            store.client.get_bucket_policy(Bucket=store.bucket)
        except ClientError as exc:
            if exc.response["Error"]["Code"] not in (
                "NoSuchBucketPolicy",
                "NoSuchPolicy",
            ):
                raise
        else:
            raise SystemExit(
                "Bucket privado possui política explícita; revisar antes de continuar."
            )
    except ClientError:
        raise SystemExit("Não foi possível inicializar o bucket privado.") from None
    print("Bucket privado inicializado, sem política pública.")


if __name__ == "__main__":
    main()
