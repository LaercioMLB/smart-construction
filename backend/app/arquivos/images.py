import hashlib
from dataclasses import dataclass
from io import BytesIO
from threading import BoundedSemaphore

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.problems import ApiProblem

MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 25_000_000
MAX_DIMENSION = 8192
_image_slots = BoundedSemaphore(2)


@dataclass(frozen=True)
class PreparedImage:
    purpose: str
    order: int
    data: bytes
    content_type: str
    width: int
    height: int
    original_sha256: str

    @property
    def sha256(self) -> str:
        return hashlib.sha256(self.data).hexdigest()


def prepare_image(
    raw: bytes, *, content_type: str, purpose: str, order: int
) -> PreparedImage:
    if len(raw) > MAX_FILE_BYTES:
        raise ApiProblem(413, "IMAGE_TOO_LARGE", "Cada imagem deve ter até 5 MiB.")
    formats = {"image/jpeg": "JPEG", "image/png": "PNG"}
    expected = formats.get(content_type)
    if expected is None:
        raise ApiProblem(422, "INVALID_IMAGE", "Envie somente imagens JPG ou PNG.")
    with _image_slots:
        try:
            with Image.open(BytesIO(raw), formats=["JPEG", "PNG"]) as original:
                width, height = original.size
                if (
                    width > MAX_DIMENSION
                    or height > MAX_DIMENSION
                    or width * height > MAX_PIXELS
                ):
                    raise ApiProblem(
                        422,
                        "IMAGE_DIMENSIONS",
                        "Imagem acima dos limites de dimensão ou pixels.",
                    )
                if original.format != expected or getattr(original, "n_frames", 1) != 1:
                    raise ApiProblem(
                        422,
                        "INVALID_IMAGE",
                        "O conteúdo deve ser uma imagem JPG/PNG estática válida.",
                    )
                original.verify()
            with Image.open(BytesIO(raw), formats=["JPEG", "PNG"]) as original:
                original.load()
                oriented = ImageOps.exif_transpose(original)
                mode = "RGBA" if expected == "PNG" else "RGB"
                # Uma imagem nova elimina EXIF, GPS, comentários e metadados PNG.
                clean = Image.new(mode, oriented.size)
                clean.paste(oriented.convert(mode))
                output = BytesIO()
                clean.save(output, format=expected)
                encoded = output.getvalue()
                width, height = clean.size
                clean.close()
        except (
            UnidentifiedImageError,
            OSError,
            ValueError,
            SyntaxError,
            Image.DecompressionBombError,
        ):
            raise ApiProblem(
                422, "INVALID_IMAGE", "Não foi possível decodificar a imagem enviada."
            ) from None
    if len(encoded) > MAX_FILE_BYTES:
        raise ApiProblem(
            413,
            "IMAGE_TOO_LARGE",
            "A imagem processada excedeu 5 MiB. Reduza sua resolução.",
        )
    return PreparedImage(
        purpose=purpose,
        order=order,
        data=encoded,
        content_type=content_type,
        width=width,
        height=height,
        original_sha256=hashlib.sha256(raw).hexdigest(),
    )
