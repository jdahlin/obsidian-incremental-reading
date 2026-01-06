export const DUE_TODAY_YAML = `filters:
  and:
    - file.hasTag("extract")
    - "due <= now()"
    - "status != 'new'"

formulas:
  days_overdue: "max(0, (now() - due) / (1000 * 60 * 60 * 24))"

properties:
  type:
    displayName: "Type"
  due:
    displayName: "Due"
  status:
    displayName: "Status"
  source:
    displayName: "Source"
  formula.days_overdue:
    displayName: "Days Overdue"

views:
  - type: table
    name: "Due for Review"
    order:
      - type
      - due
      - file.name
`;

export const TOPICS_YAML = `filters:
  and:
    - file.hasTag("extract")
    - "type == 'topic'"

formulas:
  progress: "if(scroll_pos > 0, 'In Progress', 'Not Started')"

properties:
  due:
    displayName: "Due"
  status:
    displayName: "Status"
  priority:
    displayName: "Priority"
  source:
    displayName: "Source"
  formula.progress:
    displayName: "Progress"

views:
  - type: table
    name: "All Topics"
    order:
      - priority
      - due
  - type: table
    name: "Due Topics"
    filters:
      and:
        - "due <= now()"
    order:
      - due
`;

export const ITEMS_YAML = `filters:
  and:
    - file.hasTag("extract")
    - "type == 'item'"

formulas:
  health: "if(lapses > 3, 'Struggling', if(stability > 10, 'Strong', 'Normal'))"

properties:
  due:
    displayName: "Due"
  status:
    displayName: "Status"
  stability:
    displayName: "Stability"
  lapses:
    displayName: "Lapses"
  source:
    displayName: "Source"
  formula.health:
    displayName: "Health"

views:
  - type: table
    name: "All Items"
    order:
      - status
      - due
  - type: table
    name: "Due Items"
    filters:
      and:
        - "due <= now()"
    order:
      - due
`;

export const NEW_CARDS_YAML = `filters:
  and:
    - file.hasTag("extract")
    - "status == 'new'"

properties:
  created:
    displayName: "Created"
  source:
    displayName: "Source"
  priority:
    displayName: "Priority"

views:
  - type: table
    name: "New Cards"
    order:
      - priority
      - created
`;

export const LEARNING_YAML = `filters:
  and:
    - file.hasTag("extract")
    - or:
      - "status == 'learning'"
      - "status == 'relearning'"

properties:
  due:
    displayName: "Due"
  status:
    displayName: "Status"
  lapses:
    displayName: "Lapses"

views:
  - type: table
    name: "In Learning"
    order:
      - due
`;

export const ALL_EXTRACTS_YAML = `filters:
  and:
    - file.hasTag("extract")

formulas:
  next_review: "if(due < now(), 'Overdue', due)"
  health: "if(lapses > 3, 'Struggling', if(stability > 10, 'Strong', 'Normal'))"

properties:
  status:
    displayName: "Status"
  due:
    displayName: "Next Review"
  stability:
    displayName: "Stability"
  reps:
    displayName: "Reps"
  lapses:
    displayName: "Lapses"
  source:
    displayName: "Source"

views:
  - type: table
    name: "All Cards"
    order:
      - status
      - due
  - type: table
    name: "By Stability"
    order:
      - stability
      - file.name
`;

export const BY_SOURCE_YAML = `filters:
  and:
    - file.hasTag("extract")

properties:
  source:
    displayName: "Source"
  status:
    displayName: "Status"
  due:
    displayName: "Due"

views:
  - type: table
    name: "Grouped by Source"
    order:
      - source
      - due
`;
