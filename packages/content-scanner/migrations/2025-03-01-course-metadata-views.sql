ALTER TABLE course
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE course_item DROP CONSTRAINT IF EXISTS course_item_kind_check;
ALTER TABLE course_item
ADD CONSTRAINT course_item_kind_check CHECK (
	kind IN ('lecture', 'group', 'lab', 'seminarium', 'examination')
);

CREATE INDEX IF NOT EXISTS course_item_course_id_idx ON course_item(course_id);
CREATE INDEX IF NOT EXISTS course_item_kind_idx ON course_item(kind);
CREATE INDEX IF NOT EXISTS course_item_hidden_idx ON course_item(is_hidden);
CREATE INDEX IF NOT EXISTS course_item_start_at_idx ON course_item(start_at);

CREATE INDEX IF NOT EXISTS resource_course_id_idx ON resource(course_id);
CREATE INDEX IF NOT EXISTS resource_course_item_id_idx ON resource(course_item_id);
CREATE INDEX IF NOT EXISTS resource_parent_resource_id_idx ON resource(parent_resource_id);
CREATE INDEX IF NOT EXISTS resource_derived_from_id_idx ON resource(derived_from_id);
CREATE INDEX IF NOT EXISTS resource_extraction_target_id_idx
	ON resource(extraction_target_resource_id);

CREATE OR REPLACE VIEW resource_with_tags_view AS
SELECT r.id,
	r.name,
	r.mime_type,
	r.course_id,
	r.course_item_id,
	(SELECT COUNT(*) FROM resource_page WHERE resource_id = r.id) AS page_count,
	array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) AS tags
FROM resource r
LEFT JOIN resource_tag rt ON rt.resource_id = r.id
LEFT JOIN tag t ON t.id = rt.tag_id
GROUP BY r.id;

CREATE OR REPLACE VIEW search_index_view AS
SELECT r.id AS resource_id,
	r.name AS filename,
	r.course_item_id,
	rp.page_number,
	op.content,
	op.tsv_sv,
	op.tsv_en,
	array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) AS tags
FROM ocr_page op
JOIN ocr_attempt oa ON oa.id = op.ocr_attempt_id AND oa.selected
JOIN resource r ON r.id = oa.resource_id
JOIN resource_page rp ON rp.id = op.resource_page_id
LEFT JOIN resource_tag rt ON rt.resource_id = r.id
LEFT JOIN tag t ON t.id = rt.tag_id
GROUP BY r.id, r.name, r.course_item_id, rp.page_number, op.content, op.tsv_sv, op.tsv_en;

CREATE OR REPLACE VIEW course_counts_view AS
SELECT c.id,
	c.name,
	c.code,
	c.description,
	c.metadata,
	c.created_at,
	c.updated_at,
	(COUNT(ci.id) FILTER (WHERE ci.kind = 'lecture'))::int AS lecture_count_all,
	(COUNT(ci.id) FILTER (WHERE ci.kind = 'lecture' AND NOT ci.is_hidden))::int
		AS lecture_count_visible,
	(COUNT(ci.id) FILTER (WHERE ci.kind = 'lab'))::int AS lab_count_all,
	(COUNT(ci.id) FILTER (WHERE ci.kind = 'lab' AND NOT ci.is_hidden))::int AS lab_count_visible,
	(COUNT(ci.id) FILTER (WHERE ci.kind = 'examination'))::int AS exam_count_all,
	(COUNT(ci.id) FILTER (WHERE ci.kind = 'examination' AND NOT ci.is_hidden))::int
		AS exam_count_visible,
	(COUNT(ci.id) FILTER (WHERE ci.kind = 'group'))::int AS group_count_all,
	(COUNT(ci.id) FILTER (WHERE ci.kind = 'group' AND NOT ci.is_hidden))::int AS group_count_visible,
	(COUNT(ci.id) FILTER (WHERE ci.kind = 'seminarium'))::int AS seminarium_count_all,
	(COUNT(ci.id) FILTER (WHERE ci.kind = 'seminarium' AND NOT ci.is_hidden))::int
		AS seminarium_count_visible
FROM course c
LEFT JOIN course_item ci ON ci.course_id = c.id
GROUP BY c.id;

CREATE OR REPLACE VIEW lecture_items_view AS
SELECT ci.id,
	ci.course_id,
	ci.name,
	ci.start_at,
	ci.end_at,
	to_char(ci.start_at, 'YYYY-MM-DD') AS start_date,
	to_char(ci.start_at, 'HH24:MI') AS start_time,
	to_char(ci.end_at, 'HH24:MI') AS end_time,
	COUNT(r.id)::int AS content_count,
	ci.is_hidden,
	row_number() OVER (PARTITION BY ci.course_id ORDER BY ci.start_at NULLS LAST, ci.id) AS number
FROM course_item ci
LEFT JOIN resource r ON r.course_item_id = ci.id
WHERE ci.kind = 'lecture'
GROUP BY ci.id;

CREATE OR REPLACE VIEW lecture_items_visible_view AS
SELECT ci.id,
	ci.course_id,
	ci.name,
	ci.start_at,
	ci.end_at,
	to_char(ci.start_at, 'YYYY-MM-DD') AS start_date,
	to_char(ci.start_at, 'HH24:MI') AS start_time,
	to_char(ci.end_at, 'HH24:MI') AS end_time,
	COUNT(r.id)::int AS content_count,
	ci.is_hidden,
	row_number() OVER (PARTITION BY ci.course_id ORDER BY ci.start_at NULLS LAST, ci.id) AS number
FROM course_item ci
LEFT JOIN resource r ON r.course_item_id = ci.id
WHERE ci.kind = 'lecture' AND ci.is_hidden = FALSE
GROUP BY ci.id;

CREATE OR REPLACE VIEW lab_items_view AS
SELECT ci.id,
	ci.course_id,
	ci.name,
	ci.start_at,
	ci.end_at,
	to_char(ci.start_at, 'YYYY-MM-DD') AS start_date,
	to_char(ci.start_at, 'HH24:MI') AS start_time,
	to_char(ci.end_at, 'HH24:MI') AS end_time,
	ci.is_hidden,
	row_number() OVER (PARTITION BY ci.course_id ORDER BY ci.start_at NULLS LAST, ci.id) AS number
FROM course_item ci
WHERE ci.kind = 'lab';

CREATE OR REPLACE VIEW lab_items_visible_view AS
SELECT ci.id,
	ci.course_id,
	ci.name,
	ci.start_at,
	ci.end_at,
	to_char(ci.start_at, 'YYYY-MM-DD') AS start_date,
	to_char(ci.start_at, 'HH24:MI') AS start_time,
	to_char(ci.end_at, 'HH24:MI') AS end_time,
	ci.is_hidden,
	row_number() OVER (PARTITION BY ci.course_id ORDER BY ci.start_at NULLS LAST, ci.id) AS number
FROM course_item ci
WHERE ci.kind = 'lab' AND ci.is_hidden = FALSE;
