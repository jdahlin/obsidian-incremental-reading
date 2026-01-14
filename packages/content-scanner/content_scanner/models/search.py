"""Search models."""

from pydantic import BaseModel, ConfigDict


class SearchHit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resource_id: int
    page_number: int
    rank: float
    snippet: str
    tags: list[str]
