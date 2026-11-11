import hashlib
import os
from pathlib import Path

import pytest

from scripts.setup_secrets import setup


def test_setup_is_idempotent_and_does_not_print_secrets(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    directory = tmp_path / "backend"
    setup(directory)
    paths = [directory / name for name in ("api-password", "migration-password")]
    before = [hashlib.sha256(path.read_bytes()).hexdigest() for path in paths]
    assert before[0] != before[1]
    assert all(b"\r" not in path.read_bytes() for path in paths)
    assert all(len(path.read_text().strip()) >= 32 for path in paths)
    setup(directory)
    after = [hashlib.sha256(path.read_bytes()).hexdigest() for path in paths]
    assert before == after
    assert capsys.readouterr().out == ""
    if os.name == "posix":
        assert directory.stat().st_mode & 0o777 == 0o700
        assert all(path.stat().st_mode & 0o777 == 0o444 for path in paths)


def test_setup_does_not_replace_invalid_existing_credentials(tmp_path: Path) -> None:
    directory = tmp_path / "backend"
    directory.mkdir()
    (directory / "migration-password").write_text("existing-short", encoding="utf-8")
    with pytest.raises(RuntimeError, match="existente invalida"):
        setup(directory)
    assert (directory / "migration-password").read_text() == "existing-short"
