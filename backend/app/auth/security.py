import hashlib
import hmac
import re
import secrets

COOKIE = "smart_admin_session"
COOKIE_PATH = "/api/v1/admin"
SESSION_SECONDS = 8 * 60 * 60


def password_hash(password: str) -> str:
    if not 12 <= len(password) <= 256:
        raise ValueError("A senha deve ter entre 12 e 256 caracteres.")
    salt = secrets.token_hex(16)
    return f"scrypt${salt}${_derive(password, salt).hex()}"


def _derive(password: str, salt: str) -> bytes:
    return hashlib.scrypt(
        password.encode("utf-8"),
        salt=bytes.fromhex(salt),
        n=2**17,
        r=8,
        p=1,
        dklen=64,
        maxmem=256 * 1024 * 1024,
    )


def password_matches(password: str, encoded: str | None) -> bool:
    # Mesmo custo para login inexistente; nunca reutilizado como senha de uma conta.
    salt = "0" * 32
    expected = "0" * 128
    valid = False
    if encoded is not None:
        parts = encoded.split("$")
        if (
            len(parts) == 3
            and parts[0] == "scrypt"
            and re.fullmatch(r"[a-f0-9]{32}", parts[1])
            and re.fullmatch(r"[a-f0-9]{128}", parts[2])
        ):
            salt, expected = parts[1:]
            valid = True
    matches = hmac.compare_digest(_derive(password, salt).hex(), expected)
    return valid and matches


def session_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def csrf_token(token: str) -> str:
    return hmac.new(
        token.encode("utf-8"), b"smart-construction:csrf:v1", hashlib.sha256
    ).hexdigest()


def valid_session_token(token: str) -> bool:
    return re.fullmatch(r"[A-Za-z0-9_-]{64}", token) is not None
