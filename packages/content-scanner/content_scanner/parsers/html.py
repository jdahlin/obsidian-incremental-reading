"""HTML parser."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from bs4 import BeautifulSoup


@dataclass
class Token:
    index: int
    text: str
    x0: float = 0
    y0: float = 0
    x1: float = 0
    y1: float = 0


@dataclass
class Page:
    number: int
    content: str
    tokens: list[Token]


def parse_html(path: Path) -> list[Page]:
    """Parse HTML and extract text."""
    try:
        content = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return []

    soup = BeautifulSoup(content, "lxml")

    # Remove script and style elements
    for element in soup(["script", "style", "nav", "footer", "header"]):
        element.decompose()

    text = soup.get_text(separator=" ", strip=True)

    # Create tokens from words
    words = text.split()
    tokens = [Token(index=i, text=w) for i, w in enumerate(words)]

    return [Page(number=1, content=text, tokens=tokens)]
