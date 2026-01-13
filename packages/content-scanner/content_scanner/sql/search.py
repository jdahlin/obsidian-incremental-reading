"""Search queries."""

# FTS search with tags
SEARCH_FTS_SQL = """
WITH q AS (
    SELECT
        websearch_to_tsquery('swedish', %(query)s) AS q_sv,
        websearch_to_tsquery('english', %(query)s) AS q_en
)
SELECT
    r.id AS resource_id,
    rp.page_number,
    (
        ts_rank_cd(op.tsv_sv, q.q_sv) +
        ts_rank_cd(op.tsv_en, q.q_en)
    )::float8 AS rank,
    CASE
        WHEN op.tsv_sv @@ q.q_sv THEN ts_headline('swedish', op.content, q.q_sv, 'MaxWords=30')
        ELSE ts_headline('english', op.content, q.q_en, 'MaxWords=30')
    END AS snippet,
    COALESCE(
        (SELECT array_agg(t.name ORDER BY t.name)
         FROM resource_tag rt
         JOIN tag t ON t.id = rt.tag_id
         WHERE rt.resource_id = r.id),
        ARRAY[]::text[]
    ) AS tags
FROM q, ocr_page op
JOIN ocr_attempt oa ON oa.id = op.ocr_attempt_id AND oa.selected = TRUE
JOIN resource r ON r.id = oa.resource_id
JOIN resource_page rp ON rp.id = op.resource_page_id
WHERE (op.tsv_sv @@ q.q_sv) OR (op.tsv_en @@ q.q_en)
ORDER BY rank DESC
LIMIT %(limit)s;
"""

# Fuzzy search with tags
SEARCH_FUZZY_SQL = """
WITH params AS (
    SELECT unaccent(LOWER(%(query)s)) AS q
)
SELECT DISTINCT ON (r.id)
    r.id AS resource_id,
    rp.page_number,
    MAX(similarity(t.text_unaccent, params.q))::float8 AS rank,
    'Fuzzy match: ' || %(query)s AS snippet,
    COALESCE(
        (SELECT array_agg(tg.name ORDER BY tg.name)
         FROM resource_tag rt
         JOIN tag tg ON tg.id = rt.tag_id
         WHERE rt.resource_id = r.id),
        ARRAY[]::text[]
    ) AS tags
FROM params, ocr_token t
JOIN ocr_page op ON op.id = t.ocr_page_id
JOIN ocr_attempt oa ON oa.id = op.ocr_attempt_id AND oa.selected = TRUE
JOIN resource r ON r.id = oa.resource_id
JOIN resource_page rp ON rp.id = op.resource_page_id
WHERE t.text_unaccent % params.q
GROUP BY r.id, rp.page_number
ORDER BY r.id, rank DESC
LIMIT %(limit)s;
"""
