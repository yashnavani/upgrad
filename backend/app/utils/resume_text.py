# backend/app/utils/resume_text.py
"""Extract plain text from common resume upload formats (PDF, DOCX, TXT)."""
from __future__ import annotations

from io import BytesIO
from pathlib import Path


def extract_resume_text(filename: str, raw: bytes) -> str:
    """
    Return UTF-8 text from resume bytes. Raises ValueError on unsupported type or empty output.
    """
    if not raw:
        raise ValueError("Empty file.")

    suf = Path(filename or "").suffix.lower()
    if not suf:
        suf = ".txt"

    if suf in (".txt", ".md"):
        return raw.decode("utf-8", errors="replace").strip()

    if suf == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(raw))
        parts: list[str] = []
        for page in reader.pages:
            t = page.extract_text() or ""
            if t.strip():
                parts.append(t)
        out = "\n".join(parts).strip()
        if not out:
            raise ValueError("PDF contained no extractable text (try a text-based PDF or .txt).")
        return out

    if suf == ".docx":
        from docx import Document

        doc = Document(BytesIO(raw))
        lines = [p.text.strip() for p in doc.paragraphs if p.text and p.text.strip()]
        out = "\n".join(lines).strip()
        if not out:
            raise ValueError("DOCX contained no readable paragraphs.")
        return out

    raise ValueError(
        f"Unsupported format {suf!r}. Upload PDF, DOCX, or plain text (.txt / .md)."
    )
