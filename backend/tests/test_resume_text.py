# backend/tests/test_resume_text.py
import pytest

from app.utils.resume_text import extract_resume_text


def test_extract_plain_text():
    t = extract_resume_text("r.txt", b"  Line one.\n\nLine two.  ")
    assert "Line one" in t
    assert "Line two" in t


def test_extract_rejects_empty():
    with pytest.raises(ValueError):
        extract_resume_text("empty.txt", b"")


def test_extract_rejects_unknown_suffix():
    with pytest.raises(ValueError, match="Unsupported"):
        extract_resume_text("f.bin", b"xyz")
