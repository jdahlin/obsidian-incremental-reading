"""PDF parser using PyMuPDF."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import fitz  # pymupdf


@dataclass
class Token:
    index: int
    text: str
    x0: float
    y0: float
    x1: float
    y1: float


@dataclass
class Page:
    number: int
    content: str
    tokens: list[Token]


def clean_text(text: str) -> str:
    """Remove null bytes and other problematic characters."""
    return text.replace("\x00", "")


def parse_pdf(path: Path) -> list[Page]:
    """Parse PDF and extract text with bounding boxes."""
    pages: list[Page] = []

    try:
        doc = fitz.open(path)
    except Exception:
        return pages

    for page_num, page in enumerate(doc, start=1):
        text = clean_text(page.get_text())
        tokens: list[Token] = []

        # Extract words with positions
        words = page.get_text("words")
        for idx, word in enumerate(words):
            x0, y0, x1, y1, text_content, *_ = word
            tokens.append(
                Token(
                    index=idx,
                    text=clean_text(str(text_content)),
                    x0=x0,
                    y0=y0,
                    x1=x1,
                    y1=y1,
                )
            )

        pages.append(Page(number=page_num, content=text, tokens=tokens))

    doc.close()
    return pages
