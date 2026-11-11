import re
import unicodedata

DDDS = frozenset(
    "11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 "
    "41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 "
    "71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99".split()
)


def plain_text(value: object) -> object:
    if not isinstance(value, str):
        return value
    value = value.strip()
    if any(
        char in "<>" or unicodedata.category(char) in ("Cc", "Cs")
        for char in value
        if char not in "\n\r\t"
    ):
        raise ValueError(
            "Use texto simples, sem marcação HTML ou caracteres de controle."
        )
    return value


def normalized_name(value: str) -> str:
    return " ".join(
        unicodedata.normalize("NFKD", value)
        .encode("ascii", "ignore")
        .decode()
        .casefold()
        .split()
    )


def _check_digit(values: list[int], weights: list[int]) -> str:
    remainder = (
        sum(value * weight for value, weight in zip(values, weights, strict=True)) % 11
    )
    return str(0 if remainder < 2 else 11 - remainder)


def cpf(value: str) -> str:
    if not re.fullmatch(r"[0-9.\-\s]+", value):
        raise ValueError("CPF inválido.")
    digits = re.sub(r"[.\-\s]", "", value)
    if not re.fullmatch(r"[0-9]{11}", digits) or len(set(digits)) == 1:
        raise ValueError("CPF inválido.")
    for count in (9, 10):
        if (
            _check_digit(
                [int(char) for char in digits[:count]], list(range(count + 1, 1, -1))
            )
            != digits[count]
        ):
            raise ValueError("CPF inválido.")
    return digits


def cnpj(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9./\-\s]+", value):
        raise ValueError("CNPJ inválido.")
    document = re.sub(r"[./\-\s]", "", value).upper()
    if not re.fullmatch(r"[A-Z0-9]{12}[0-9]{2}", document) or len(set(document)) == 1:
        raise ValueError("CNPJ inválido.")
    # Receita Federal: código ASCII de cada posição menos 48, inclusive letras.
    for count, weights in (
        (12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]),
        (13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]),
    ):
        if (
            _check_digit([ord(char) - 48 for char in document[:count]], weights)
            != document[count]
        ):
            raise ValueError("CNPJ inválido.")
    return document


def phone(value: str) -> str:
    if not re.fullmatch(r"[0-9+()\-\s]+", value):
        raise ValueError("Telefone inválido.")
    digits = re.sub(r"[^0-9]", "", value)
    if len(digits) in (12, 13) and digits.startswith("55"):
        digits = digits[2:]
    if len(digits) not in (10, 11) or digits[:2] not in DDDS:
        raise ValueError("Informe DDD e telefone brasileiro válidos.")
    local = digits[2:]
    if not (
        (len(local) == 9 and local[0] == "9")
        or (len(local) == 8 and local[0] in "2345")
    ):
        raise ValueError("Telefone inválido.")
    if len(set(local)) == 1:
        raise ValueError("Telefone inválido.")
    return "+55" + digits
