from datetime import date, datetime

import pytest

from app.core.calendar import adult_birth_cutoff, business_today


@pytest.mark.parametrize(
    "moment,expected",
    [
        ("2026-10-24T01:00:00+00:00", date(2026, 10, 23)),
        ("2026-10-24T04:00:00+00:00", date(2026, 10, 24)),
    ],
)
def test_age_uses_sao_paulo_calendar(moment: str, expected: date) -> None:
    assert business_today(datetime.fromisoformat(moment)) == expected


@pytest.mark.parametrize(
    "reference,expected",
    [
        (date(2026, 10, 24), date(2008, 10, 24)),
        (date(2026, 2, 28), date(2008, 2, 28)),
        (date(2026, 3, 1), date(2008, 3, 1)),
        (date(2024, 2, 29), date(2006, 2, 28)),
    ],
)
def test_eighteenth_birthday_and_leap_boundaries(
    reference: date, expected: date
) -> None:
    assert adult_birth_cutoff(reference) == expected
