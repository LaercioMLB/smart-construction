import hashlib
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import pytest

from app.retencao.backups import FILES, expire_backups, snapshot_time
from app.retencao.ledger import Erasure, Ledger, months_after


def test_ledger_corruption_and_lock_do_not_silently_reset(tmp_path: Path):
    ledger = Ledger(tmp_path / "ledger")
    origin = ledger.initialize()
    assert ledger.initialize() == origin
    with ledger.locked(), pytest.raises(FileExistsError), ledger.locked():
        pass
    now = datetime.now(UTC)
    entry = Erasure(
        cadastro_id=uuid4(),
        encerrado_em=now,
        expira_em=months_after(now, 24),
        administrador_id=uuid4(),
        motivo="fim_finalidade",
        eventos=[],
        aceites=[],
    )
    with ledger.locked():
        ledger.erase(entry)
        ledger.erase(entry)
    assert len(ledger.read().exclusoes) == 1
    path = ledger.directory / "ledger.json"
    damaged = json.loads(path.read_bytes())
    damaged["dados"]["exclusoes"] = []
    path.write_text(json.dumps(damaged), encoding="utf8")
    with pytest.raises(ValueError, match="corrompido"):
        ledger.initialize()
    path.unlink()
    (ledger.directory / "unexpected").touch()
    with pytest.raises(ValueError, match="incompleto"):
        ledger.initialize()


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ("2024-02-29T12:00:00+00:00", "2026-02-28T12:00:00+00:00"),
        ("2026-10-24T12:00:00+00:00", "2028-10-24T12:00:00+00:00"),
    ],
)
def test_retention_is_calendar_months(source: str, expected: str):
    assert months_after(datetime.fromisoformat(source), 24).isoformat() == expected


def package(root: Path, name: str) -> Path:
    directory = root / name
    directory.mkdir()
    lines = []
    for name in sorted(FILES):
        data = f"synthetic-{name}".encode()
        (directory / name).write_bytes(data)
        lines.append(f"{hashlib.sha256(data).hexdigest()}  {name}\n")
    (directory / "SHA256SUMS").write_text("".join(lines), encoding="ascii")
    return directory


def test_backup_expiry_is_bounded_and_dry_by_default(tmp_path: Path):
    now = datetime(2026, 10, 24, 12, tzinfo=UTC)
    root = tmp_path / "backups"
    root.mkdir()
    old = package(root, "20260901T120000Z-1")
    boundary = package(root, "20260924T120000Z-2")
    fresh = package(root, "20261024T110000Z-3")
    broken = package(root, "20260901T120000Z-4")
    (broken / "private.tar").write_bytes(b"corrupt")
    preserved = package(root, "20260901T120000Z-5")
    (preserved / ".preserve").write_text("synthetic-case", encoding="ascii")
    unexpected = root / "restored"
    unexpected.mkdir()
    (unexpected / "keep").write_bytes(b"keep")
    assert expire_backups(root, moment=now)["candidatos"] == [old.name]
    assert old.exists()
    result = expire_backups(root, moment=now, apply=True)
    assert result["removidos"] == [old.name] and not old.exists()
    assert sorted(result["revisar"]) == sorted([broken.name, preserved.name])
    assert all(path.exists() for path in [boundary, fresh, unexpected])
    assert snapshot_time(boundary.name) == now - timedelta(days=30)
    with pytest.raises(ValueError):
        snapshot_time("../../outside")


def test_backup_manifest_cannot_redirect_deletion(tmp_path: Path):
    root = tmp_path / "backups"
    root.mkdir()
    old = package(root, "20260901T120000Z-1")
    outside = tmp_path / "outside"
    outside.write_bytes(b"keep")
    (old / "SHA256SUMS").write_text("0" * 64 + "  ../../outside\n", encoding="ascii")
    result = expire_backups(root, apply=True, moment=datetime(2026, 10, 24, tzinfo=UTC))
    assert result["candidatos"] == [] and outside.read_bytes() == b"keep"
