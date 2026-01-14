"""Backend API for lecture navigator frontend."""

import json
import os
from datetime import datetime
from pathlib import Path
import psycopg
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from psycopg.rows import dict_row

from content_scanner.models.api import (
    ContentItem,
    ContentListResponse,
    Course,
    CourseListResponse,
    Lecture,
    LectureListResponse,
    SearchResponse,
    SearchResult,
)

app = FastAPI(title="Lecture Navigator API", version="0.1.0")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DSN = os.environ.get("CONTENT_SCANNER_DSN")
if not DSN:
    raise RuntimeError("CONTENT_SCANNER_DSN is required")
CALENDAR_PATH = Path(__file__).parent.parent.parent / "calendar.json"

# Course metadata
COURSE_META = {
    "fysiologi_1": {"name": "Fysiologi 1 - Neurofysiologi", "code": "LPG002"},
    "fysiologi_2": {"name": "Fysiologi 2 - Cirkulation & Respiration", "code": "LPG002"},
    "fysiologi_3": {"name": "Fysiologi 3 - Digestion & Reproduktion", "code": "LPG002"},
}

SEARCH_SQL = """
WITH q AS (
    SELECT websearch_to_tsquery('swedish', %(query)s) AS q_sv,
           websearch_to_tsquery('english', %(query)s) AS q_en
),
matches AS (
    SELECT DISTINCT ON (s.resource_id, s.page_number)
        s.resource_id,
        s.page_number,
        s.filename,
        s.content,
        (ts_rank_cd(s.tsv_sv, q.q_sv) + ts_rank_cd(s.tsv_en, q.q_en))::float AS rank,
        q.q_sv,
        s.tags
    FROM q, search_index_view s
    WHERE s.tsv_sv @@ q.q_sv OR s.tsv_en @@ q.q_en
    ORDER BY s.resource_id, s.page_number, rank DESC
)
SELECT m.resource_id AS id, m.page_number, m.filename, m.rank,
    ts_headline('swedish', m.content, m.q_sv, 'MaxWords=30,MinWords=15') AS snippet,
    m.tags
FROM matches m
ORDER BY m.rank DESC
LIMIT %(limit)s;
"""

RESOURCES_SQL = """
SELECT id, name, mime_type, page_count, tags
FROM resource_with_tags_view
ORDER BY name
LIMIT %(limit)s OFFSET %(offset)s;
"""

RESOURCES_BY_TAG_SQL = """
SELECT id, name, mime_type, page_count, tags
FROM resource_with_tags_view
WHERE %(tag)s = ANY(tags)
ORDER BY name
LIMIT %(limit)s OFFSET %(offset)s;
"""

RESOURCES_COUNT_SQL = "SELECT COUNT(*) AS total FROM resource_with_tags_view;"

RESOURCES_COUNT_BY_TAG_SQL = """
SELECT COUNT(*) AS total
FROM resource_with_tags_view
WHERE %(tag)s = ANY(tags);
"""

# Mapping course modules to exam tags/patterns
COURSE_TAG_MAP = {
    "fysiologi_1": "fysiologi",
    "fysiologi_2": "fysiologi",
    "fysiologi_3": "fysiologi",
}


def load_calendar() -> dict:
    """Load calendar.json data."""
    with open(CALENDAR_PATH) as f:
        return json.load(f)


def calc_duration(start: str, end: str) -> str:
    """Calculate duration from start/end times."""
    fmt = "%H:%M"
    s = datetime.strptime(start, fmt)
    e = datetime.strptime(end, fmt)
    mins = int((e - s).total_seconds() / 60)
    if mins >= 60:
        hours = mins // 60
        remaining = mins % 60
        if remaining:
            return f"{hours}h {remaining}min"
        return f"{hours}h"
    return f"{mins} min"


def infer_content_type(filename: str, tags: list[str]) -> str:
    """Infer content type from filename and tags."""
    lower = filename.lower()
    tag_set = {t.lower() for t in tags} if tags else set()

    if "exam" in lower or "tenta" in lower or "prov" in lower or "kandidaterna" in tag_set:
        return "exam"
    if "lecture" in lower or "föreläsning" in lower or "slides" in lower:
        return "lecture"
    if "note" in lower or "anteckning" in lower:
        return "notes"
    if lower.endswith((".mp4", ".webm", ".mov")):
        return "video"
    return "book"  # Default for PDFs


# --- API Endpoints ---

@app.get("/")
async def root():
    """API info."""
    return {"api": "Lecture Navigator", "version": "0.1.0"}


@app.get("/api/courses", response_model=CourseListResponse)
async def list_courses():
    """List all courses from calendar.json."""
    calendar = load_calendar()
    courses = []

    for course_id, data in calendar.items():
        meta = COURSE_META.get(course_id, {"name": course_id, "code": ""})
        courses.append(Course(
            id=course_id,
            name=meta["name"],
            code=meta["code"],
            lecture_count=len(data.get("forelasningar", [])),
            lab_count=len(data.get("labbar", [])),
            exam_count=len(data.get("tentamen", [])),
        ))

    return CourseListResponse(courses=courses)


@app.get("/api/courses/{course_id}/lectures", response_model=LectureListResponse)
async def list_lectures(course_id: str):
    """List all lectures for a course."""
    calendar = load_calendar()

    if course_id not in calendar:
        return LectureListResponse(course_id=course_id, lectures=[])

    data = calendar[course_id]
    lectures = []

    for i, lec in enumerate(data.get("forelasningar", []), start=1):
        lectures.append(Lecture(
            id=f"{course_id}-lec-{i}",
            number=i,
            title=lec["title"],
            date=lec["date"],
            start=lec["start"],
            end=lec["end"],
            duration=calc_duration(lec["start"], lec["end"]),
            content_count=0,  # Will be computed when we link content
            is_completed=False,
        ))

    return LectureListResponse(course_id=course_id, lectures=lectures)


@app.get("/api/courses/{course_id}/labs")
async def list_labs(course_id: str):
    """List all labs for a course."""
    calendar = load_calendar()

    if course_id not in calendar:
        return {"course_id": course_id, "labs": []}

    data = calendar[course_id]
    labs = []

    for i, lab in enumerate(data.get("labbar", []), start=1):
        labs.append({
            "id": f"{course_id}-lab-{i}",
            "number": i,
            "title": lab["title"],
            "date": lab["date"],
            "start": lab["start"],
            "end": lab["end"],
            "duration": calc_duration(lab["start"], lab["end"]),
        })

    return {"course_id": course_id, "labs": labs}


@app.get("/api/courses/{course_id}/exams")
async def list_exams(course_id: str):
    """List all exams for a course."""
    calendar = load_calendar()

    if course_id not in calendar:
        return {"course_id": course_id, "exams": []}

    data = calendar[course_id]
    exams = []

    for i, exam in enumerate(data.get("tentamen", []), start=1):
        exams.append({
            "id": f"{course_id}-exam-{i}",
            "number": i,
            "title": exam["title"],
            "date": exam["date"],
            "start": exam["start"],
            "end": exam["end"],
            "duration": calc_duration(exam["start"], exam["end"]),
            "note": exam.get("note"),
        })

    return {"course_id": course_id, "exams": exams}


@app.get("/api/content", response_model=ContentListResponse)
async def list_content(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    tag: str | None = Query(default=None),
    course_id: str | None = Query(default=None),
):
    """List content/resources from the database."""
    # Map course_id to tag if provided
    filter_tag = tag
    if course_id and not tag:
        filter_tag = COURSE_TAG_MAP.get(course_id)

    with psycopg.connect(DSN, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            if filter_tag:
                cur.execute(RESOURCES_COUNT_BY_TAG_SQL, {"tag": filter_tag})
                total = cur.fetchone()["total"]
                cur.execute(RESOURCES_BY_TAG_SQL, {"tag": filter_tag, "limit": limit, "offset": offset})
            else:
                cur.execute(RESOURCES_COUNT_SQL)
                total = cur.fetchone()["total"]
                cur.execute(RESOURCES_SQL, {"limit": limit, "offset": offset})
            rows = cur.fetchall()

    items = []
    for row in rows:
        tags = row["tags"] or []
        items.append(ContentItem(
            id=str(row["id"]),
            title=row["name"],
            type=infer_content_type(row["name"], tags),
            description=f"Resource: {row['name']}",
            page_count=row["page_count"],
            tags=tags,
        ))

    return ContentListResponse(items=items, total=total)


@app.get("/api/courses/{course_id}/materials")
async def list_course_materials(
    course_id: str,
    limit: int = Query(default=50, le=200),
):
    """List old exams and materials for a course from kandidaterna."""
    filter_tag = COURSE_TAG_MAP.get(course_id)
    if not filter_tag:
        return {"course_id": course_id, "materials": [], "total": 0}

    with psycopg.connect(DSN, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(RESOURCES_BY_TAG_SQL, {"tag": filter_tag, "limit": limit, "offset": 0})
            rows = cur.fetchall()

    materials = []
    for row in rows:
        tags = row["tags"] or []
        materials.append({
            "id": str(row["id"]),
            "title": row["name"],
            "type": infer_content_type(row["name"], tags),
            "page_count": row["page_count"],
            "tags": tags,
        })

    return {"course_id": course_id, "materials": materials, "total": len(materials)}


@app.get("/api/search", response_model=SearchResponse)
async def search(
    q: str = Query(min_length=2),
    limit: int = Query(default=20, le=100),
):
    """Full-text search across all content."""
    with psycopg.connect(DSN, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(SEARCH_SQL, {"query": q, "limit": limit})
            hits = cur.fetchall()

    results = []
    for hit in hits:
        tags = hit["tags"] or []
        results.append(SearchResult(
            resource_id=hit["id"],
            title=hit["filename"],
            type=infer_content_type(hit["filename"], tags),
            page_number=hit["page_number"],
            rank=hit["rank"],
            snippet=hit["snippet"] or "",
            tags=tags,
        ))

    return SearchResponse(query=q, results=results, total=len(results))
