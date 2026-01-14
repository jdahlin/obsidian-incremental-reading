"""Configuration."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class DbConfig:
    dsn: str

    @classmethod
    def from_env(cls) -> DbConfig:
        dsn = os.environ.get("DATABASE_URL", "postgresql:///johandahlin")
        return cls(dsn=dsn)


@dataclass(frozen=True)
class SourceConfig:
    name: str
    path: Path


# Default sources
SOURCES = [
    SourceConfig(
        name="kandidaterna",
        path=Path(__file__).parent.parent.parent / "kandidaterna-scraper" / "scraped_data",
    ),
    SourceConfig(
        name="canvas-lms",
        path=Path(__file__).parent.parent.parent / "canvas-extractor" / "canvas-lms",
    ),
]
