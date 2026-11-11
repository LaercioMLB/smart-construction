from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo


def business_today(moment: datetime | None = None) -> date:
    return (
        (moment or datetime.now(UTC)).astimezone(ZoneInfo("America/Sao_Paulo")).date()
    )


def adult_birth_cutoff(today: date | None = None) -> date:
    current = today or business_today()
    try:
        return current.replace(year=current.year - 18)
    except ValueError:
        # 29/02 sem correspondente no ano de referência.
        return current.replace(year=current.year - 18, day=28)


def require_adult_birth(birth: date | None) -> None:
    if birth is not None and birth > adult_birth_cutoff():
        raise ValueError("Cadastro permitido somente a maiores de 18 anos.")
