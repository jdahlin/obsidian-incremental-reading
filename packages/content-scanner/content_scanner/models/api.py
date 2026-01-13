"""API models for the lecture navigator frontend."""

from datetime import date, time
from pydantic import BaseModel, ConfigDict


class Event(BaseModel):
    """Base event model for lectures, labs, and exams."""
    model_config = ConfigDict(extra="forbid")

    date: date
    start: time
    end: time
    title: str
    note: str | None = None


class Lecture(BaseModel):
    """Lecture model matching frontend expectations."""
    model_config = ConfigDict(extra="forbid")

    id: str
    number: int
    title: str
    date: str
    start: str
    end: str
    duration: str
    content_count: int = 0
    is_completed: bool = False


class Course(BaseModel):
    """Course module with lectures, labs, and exams."""
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    code: str
    lecture_count: int
    lab_count: int
    exam_count: int


class ContentItem(BaseModel):
    """Content item (resource) for the frontend."""
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    type: str  # 'book', 'video', 'notes', 'exam', 'lecture'
    description: str
    lecture_id: str | None = None
    page_count: int | None = None
    duration: str | None = None
    author: str | None = None
    tags: list[str] = []


class SearchResult(BaseModel):
    """Search result with snippet and metadata."""
    model_config = ConfigDict(extra="forbid")

    resource_id: int
    title: str
    type: str
    page_number: int
    rank: float
    snippet: str
    tags: list[str] = []


class CourseListResponse(BaseModel):
    """Response for course list endpoint."""
    courses: list[Course]


class LectureListResponse(BaseModel):
    """Response for lecture list endpoint."""
    course_id: str
    lectures: list[Lecture]


class ContentListResponse(BaseModel):
    """Response for content list endpoint."""
    items: list[ContentItem]
    total: int


class SearchResponse(BaseModel):
    """Response for search endpoint."""
    query: str
    results: list[SearchResult]
    total: int
