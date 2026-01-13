# Content Scanner

Scan and search exam content from kandidaterna + canvas-lms using PostgreSQL FTS.

## Source Directories

- `../kandidaterna-scraper/scraped_data/` - 625 files (PDFs)
- `../canvas-extractor/canvas-lms/` - 453 files (PDFs, HTML, DOCX, PPTX)

## Stack

- psycopg3, pydantic v2, typer + rich, pymupdf, beautifulsoup4

## Database

PostgreSQL: `johandahlin` (default). Extensions: pg_trgm, unaccent

## Commands

```bash
uv sync
content-scanner init-db
content-scanner scan
content-scanner search "fysiologi"
```
