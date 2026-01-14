"""CLI."""

from __future__ import annotations

import hashlib
import mimetypes
import re
from pathlib import Path

import typer
from rich import print
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

from content_scanner.config import DbConfig
from content_scanner.db import Db
from content_scanner.models import SearchHit
from content_scanner.parsers.pdf import parse_pdf
from content_scanner.parsers.html import parse_html
from content_scanner.sql.search import SEARCH_FTS_SQL

app = typer.Typer()


def get_db() -> Db:
    db = Db(DbConfig.from_env())
    db.connect()
    return db


def clean_tag(name: str) -> str:
    """Convert directory name to clean tag."""
    # Replace underscores and commas with spaces, then clean up
    name = name.replace("_", " ").replace(",", " ")
    # Remove extra whitespace
    name = re.sub(r"\s+", " ", name).strip()
    # Convert to lowercase
    return name.lower()


def ensure_tag(db: Db, tag_name: str) -> int:
    """Ensure tag exists and return its ID."""
    db.execute(
        "INSERT INTO tag (name) VALUES (%(name)s) ON CONFLICT (name) DO NOTHING",
        {"name": tag_name},
    )
    row = db.fetch_one("SELECT id FROM tag WHERE name = %(name)s", {"name": tag_name})
    return row["id"]  # type: ignore


def add_resource_tag(db: Db, resource_id: int, tag_id: int) -> None:
    """Add tag to resource."""
    db.execute(
        """
        INSERT INTO resource_tag (resource_id, tag_id)
        VALUES (%(rid)s, %(tid)s)
        ON CONFLICT DO NOTHING
        """,
        {"rid": resource_id, "tid": tag_id},
    )


SKIP_PATTERNS = [
    "utan_svar",  # Skip exams without answers (keep med_svar)
    "Tentaresultat",  # Skip exam results/grades
]


def index_file_fast(
    db: Db,
    file_path: Path,
    course_id: int,
    tags: list[str],
) -> bool:
    """Index a single file with batch inserts. Returns True if indexed, False if skipped."""
    # Skip files matching skip patterns
    filename_lower = file_path.name.lower()
    for pattern in SKIP_PATTERNS:
        if pattern.lower() in filename_lower:
            return False

    # Skip already indexed
    existing = db.fetch_one(
        "SELECT id FROM resource WHERE storage_filename = %(path)s",
        {"path": str(file_path)},
    )
    if existing:
        return False

    mime_type, _ = mimetypes.guess_type(str(file_path))
    pages = []

    if file_path.suffix.lower() == ".pdf":
        pages = parse_pdf(file_path)
    elif file_path.suffix.lower() in (".html", ".htm"):
        pages = parse_html(file_path)
    else:
        return False

    if not pages:
        return False

    # Compute file hash
    file_hash = hashlib.sha256(file_path.read_bytes()).hexdigest()

    # Insert resource and get ID in one query
    resource_row = db.fetch_one(
        """
        INSERT INTO resource (course_id, name, mime_type, status, storage_filename, storage_sha256)
        VALUES (%(course_id)s, %(name)s, %(mime_type)s, 'searchable', %(path)s, %(hash)s)
        RETURNING id
        """,
        {
            "course_id": course_id,
            "name": file_path.name,
            "mime_type": mime_type or "application/octet-stream",
            "path": str(file_path),
            "hash": file_hash,
        },
    )
    resource_id = resource_row["id"]  # type: ignore

    # Add tags
    for tag_name in tags:
        tag_id = ensure_tag(db, tag_name)
        add_resource_tag(db, resource_id, tag_id)

    # Insert OCR attempt and get ID
    attempt_row = db.fetch_one(
        """
        INSERT INTO ocr_attempt (resource_id, ocr_engine, selected)
        VALUES (%(rid)s, 'pymupdf', TRUE)
        RETURNING id
        """,
        {"rid": resource_id},
    )
    attempt_id = attempt_row["id"]  # type: ignore

    # Batch insert all pages and tokens
    for page in pages:
        # Insert resource_page
        rp_row = db.fetch_one(
            "INSERT INTO resource_page (resource_id, page_number) VALUES (%(rid)s, %(pnum)s) RETURNING id",
            {"rid": resource_id, "pnum": page.number},
        )
        resource_page_id = rp_row["id"]  # type: ignore

        width = int(max((t.x1 for t in page.tokens), default=612))
        height = int(max((t.y1 for t in page.tokens), default=792))

        # Insert ocr_page
        op_row = db.fetch_one(
            """
            INSERT INTO ocr_page (ocr_attempt_id, resource_page_id, content, width_px, height_px)
            VALUES (%(aid)s, %(rpid)s, %(content)s, %(w)s, %(h)s)
            RETURNING id
            """,
            {"aid": attempt_id, "rpid": resource_page_id, "content": page.content, "w": width, "h": height},
        )
        ocr_page_id = op_row["id"]  # type: ignore

        # Batch insert tokens (limit to 200 per page for speed)
        tokens_to_insert = page.tokens[:200]
        if tokens_to_insert:
            db.executemany(
                "INSERT INTO ocr_token (ocr_page_id, token_index, text, x0, y0, x1, y1) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                [
                    (ocr_page_id, t.index, t.text, int(t.x0), int(t.y0), int(t.x1), int(t.y1))
                    for t in tokens_to_insert
                ],
            )

    return True


@app.command()
def init_db() -> None:
    """Initialize database schema."""
    schema_path = Path(__file__).parent.parent / "backend.sql"
    schema = schema_path.read_text()

    db = get_db()
    try:
        db.execute_script(schema)
        print("[green]Schema initialized successfully[/green]")
    finally:
        db.close()


@app.command()
def import_course(
    path: Path = typer.Argument(..., help="Path to course directory (e.g. scraped_data/anatomi_och_histologi_2)"),
    source: str = typer.Option("kandidaterna", help="Source tag (kandidaterna or canvas)"),
) -> None:
    """Import a single course/module directory.

    Example: content-scanner import-course ../scraped_data/anatomi_och_histologi_2
    """
    db = get_db()

    try:
        # Ensure course exists
        db.execute(
            "INSERT INTO course (name) VALUES (%(name)s) ON CONFLICT DO NOTHING",
            {"name": source},
        )
        course_row = db.fetch_one("SELECT id FROM course WHERE name = %(name)s", {"name": source})
        course_id = course_row["id"]  # type: ignore

        course_tag = clean_tag(path.name)
        print(f"[blue]Importing {path.name} as #{source} #{course_tag}[/blue]")

        files = list(path.rglob("*.pdf"))
        files += list(path.rglob("*.html"))
        files += list(path.rglob("*.htm"))

        indexed_count = 0
        with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"), transient=True) as progress:
            task = progress.add_task(f"Processing {len(files)} files...", total=len(files))

            for file_path in files:
                progress.update(task, advance=1, description=f"[cyan]{file_path.name[:40]}[/cyan]")

                tags = [source, course_tag]
                if index_file_fast(db, file_path, course_id, tags):
                    indexed_count += 1

        print(f"[green]Indexed {indexed_count} documents with tags: #{source} #{course_tag}[/green]")

    finally:
        db.close()


@app.command()
def import_kandidaterna(
    path: Path = typer.Argument(
        ...,
        help="Path to kandidaterna scraped_data directory",
    ),
) -> None:
    """Import from kandidaterna scraper output.

    Tags: #kandidaterna + course name (e.g. #fysiologi, #anatomi och histologi 1)
    """
    db = get_db()

    try:
        # Ensure course exists
        db.execute("INSERT INTO course (name) VALUES ('kandidaterna') ON CONFLICT DO NOTHING")
        course_row = db.fetch_one("SELECT id FROM course WHERE name = 'kandidaterna'")
        course_id = course_row["id"]  # type: ignore

        # Find all course directories
        course_dirs = [d for d in path.iterdir() if d.is_dir() and not d.name.startswith(".")]

        total_indexed = 0
        for course_dir in course_dirs:
            course_tag = clean_tag(course_dir.name)
            print(f"[blue]Importing {course_dir.name}...[/blue]")

            files = list(course_dir.rglob("*.pdf"))
            files += list(course_dir.rglob("*.html"))
            files += list(course_dir.rglob("*.htm"))

            with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"), transient=True) as progress:
                task = progress.add_task(f"Processing {len(files)} files...", total=len(files))

                for file_path in files:
                    progress.update(task, advance=1, description=f"[cyan]{file_path.name[:40]}[/cyan]")

                    tags = ["kandidaterna", course_tag]
                    if index_file_fast(db, file_path, course_id, tags):
                        total_indexed += 1

            print(f"  [green]Done: {course_tag}[/green]")

        print(f"[green]Indexed {total_indexed} new documents from kandidaterna[/green]")

    finally:
        db.close()


@app.command()
def import_canvas(
    path: Path = typer.Argument(
        ...,
        help="Path to canvas-lms directory",
    ),
) -> None:
    """Import from canvas extractor output.

    Tags: #canvas + module name (e.g. #lpg001, #hlr vuxen)
    """
    db = get_db()

    try:
        # Ensure course exists
        db.execute("INSERT INTO course (name) VALUES ('canvas') ON CONFLICT DO NOTHING")
        course_row = db.fetch_one("SELECT id FROM course WHERE name = 'canvas'")
        course_id = course_row["id"]  # type: ignore

        # Find all module directories (skip internal dirs starting with _)
        module_dirs = [d for d in path.iterdir() if d.is_dir() and not d.name.startswith((".", "_"))]

        total_indexed = 0
        for module_dir in module_dirs:
            module_tag = clean_tag(module_dir.name)
            print(f"[blue]Importing {module_dir.name}...[/blue]")

            files = list(module_dir.rglob("*.pdf"))
            files += list(module_dir.rglob("*.html"))
            files += list(module_dir.rglob("*.htm"))

            with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"), transient=True) as progress:
                task = progress.add_task(f"Processing {len(files)} files...", total=len(files))

                for file_path in files:
                    progress.update(task, advance=1, description=f"[cyan]{file_path.name[:40]}[/cyan]")

                    tags = ["canvas", module_tag]
                    if index_file_fast(db, file_path, course_id, tags):
                        total_indexed += 1

            print(f"  [green]Done: {module_tag}[/green]")

        print(f"[green]Indexed {total_indexed} new documents from canvas[/green]")

    finally:
        db.close()


@app.command()
def search(query: str, limit: int = 20) -> None:
    """Search documents."""
    db = get_db()

    try:
        rows = db.fetch_all(SEARCH_FTS_SQL, {"query": query, "limit": limit})

        if not rows:
            print("[yellow]No results found[/yellow]")
            return

        table = Table(title=f"Search: {query}")
        table.add_column("Tags", style="magenta")
        table.add_column("Page", justify="right")
        table.add_column("Rank", justify="right")
        table.add_column("Snippet", max_width=60)

        for row in rows:
            hit = SearchHit(**row)
            tags_str = " ".join(f"#{t}" for t in hit.tags) if hit.tags else "-"
            table.add_row(
                tags_str,
                str(hit.page_number),
                f"{hit.rank:.2f}",
                hit.snippet[:100] + "..." if len(hit.snippet) > 100 else hit.snippet,
            )

        print(table)

    finally:
        db.close()


@app.command()
def stats() -> None:
    """Show database statistics."""
    db = get_db()

    try:
        resources = db.fetch_one("SELECT COUNT(*) as cnt FROM resource")
        pages = db.fetch_one("SELECT COUNT(*) as cnt FROM ocr_page")
        tokens = db.fetch_one("SELECT COUNT(*) as cnt FROM ocr_token")
        tags = db.fetch_one("SELECT COUNT(*) as cnt FROM tag")

        print(f"Resources: {resources['cnt']}")  # type: ignore
        print(f"Pages: {pages['cnt']}")  # type: ignore
        print(f"Tokens: {tokens['cnt']}")  # type: ignore
        print(f"Tags: {tags['cnt']}")  # type: ignore

        # Show tag breakdown
        tag_counts = db.fetch_all(
            """
            SELECT t.name, COUNT(*) as cnt
            FROM tag t
            JOIN resource_tag rt ON rt.tag_id = t.id
            GROUP BY t.id, t.name
            ORDER BY cnt DESC
            LIMIT 15
            """
        )
        if tag_counts:
            print("\nTop tags:")
            for row in tag_counts:
                print(f"  #{row['name']}: {row['cnt']}")

    finally:
        db.close()


if __name__ == "__main__":
    app()
