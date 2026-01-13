"""Single-file web search with autocomplete."""

import os
from fastapi import FastAPI, Query
from fastapi.responses import HTMLResponse
import psycopg
from psycopg.rows import dict_row

app = FastAPI()

DSN = os.environ.get("CONTENT_SCANNER_DSN")
if not DSN:
    raise RuntimeError("CONTENT_SCANNER_DSN is required")

SEARCH_SQL = """
WITH q AS (
    SELECT websearch_to_tsquery('swedish', %(query)s) AS q_sv,
           websearch_to_tsquery('english', %(query)s) AS q_en
)
SELECT s.resource_id AS id,
       s.page_number,
       s.filename,
       (ts_rank_cd(s.tsv_sv, q.q_sv) + ts_rank_cd(s.tsv_en, q.q_en))::float AS rank,
       ts_headline('swedish', s.content, q.q_sv, 'MaxWords=20,MinWords=10') AS snippet,
       s.tags
FROM search_index_view s, q
WHERE s.tsv_sv @@ q.q_sv OR s.tsv_en @@ q.q_en
ORDER BY rank DESC
LIMIT %(limit)s;
"""

HTML = """<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Content Search</title>
    <script src="https://unpkg.com/htmx.org@1.9.10"></script>
    <style>
        * { box-sizing: border-box; }
        body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #1a1a2e; color: #eee; }
        input[type="search"] { width: 100%; padding: 12px 16px; font-size: 18px; border: 2px solid #4a4a6a; border-radius: 8px; background: #16213e; color: #fff; }
        input[type="search"]:focus { outline: none; border-color: #0f3460; }
        .results { margin-top: 20px; }
        .hit { background: #16213e; border-radius: 8px; padding: 16px; margin-bottom: 12px; border-left: 4px solid #e94560; }
        .hit:hover { background: #1a1a3e; }
        .tags { margin-bottom: 8px; }
        .tag { background: #e94560; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 4px; }
        .filename { color: #888; font-size: 13px; }
        .snippet { margin-top: 8px; line-height: 1.5; }
        .snippet b { color: #e94560; background: rgba(233,69,96,0.2); padding: 0 2px; }
        .page { color: #4a9; font-size: 13px; }
        .empty { color: #666; text-align: center; padding: 40px; }
        .htmx-request { opacity: 0.5; }
    </style>
</head>
<body>
    <h1>🔍 Content Search</h1>
    <input type="search" name="q" placeholder="Search exams... (try: retina, histologi, cornea OR retina)"
           hx-get="/search" hx-trigger="keyup changed delay:200ms, search" hx-target="#results" autofocus>
    <div id="results" class="results"></div>
</body>
</html>"""


def render_hit(hit: dict) -> str:
    tags = "".join(f'<span class="tag">#{t}</span>' for t in (hit["tags"] or []) if t)
    return f"""<div class="hit">
        <div class="tags">{tags}</div>
        <div class="filename">{hit['filename']} <span class="page">p.{hit['page_number']}</span></div>
        <div class="snippet">{hit['snippet'] or ''}</div>
    </div>"""


@app.get("/", response_class=HTMLResponse)
async def index():
    return HTML


@app.get("/search", response_class=HTMLResponse)
async def search(q: str = Query(default="")):
    if not q or len(q) < 2:
        return '<div class="empty">Type to search...</div>'

    with psycopg.connect(DSN, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(SEARCH_SQL, {"query": q, "limit": 20})
            hits = cur.fetchall()

    if not hits:
        return f'<div class="empty">No results for "{q}"</div>'

    return "".join(render_hit(h) for h in hits)
