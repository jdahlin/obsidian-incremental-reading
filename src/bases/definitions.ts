export const DUE_TODAY_YAML = `filters:
  and:
    - file.hasTag("topic")
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
  priority:
    displayName: "Priority"
  stability:
    displayName: "Stability"
  source:
    displayName: "Source"
  formula.days_overdue:
    displayName: "Days Overdue"

views:
  - type: table
    name: "Due for Review"
    order:
      - type
      - priority
      - due
      - stability
      - source
      - file.name
`;

export const TOPICS_YAML = `filters:
  and:
    - file.hasTag("topic")
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
  reps:
    displayName: "Reviews"
  created:
    displayName: "Created"
  source:
    displayName: "Source"
  formula.progress:
    displayName: "Progress"

views:
  - type: table
    name: "All Topics"
    order:
      - priority
      - status
      - due
      - reps
      - source
      - file.name
  - type: table
    name: "Due Topics"
    filters:
      and:
        - "due <= now()"
    order:
      - priority
      - due
      - reps
      - source
      - file.name
`;

export const ITEMS_YAML = `filters:
  and:
    - file.hasTag("topic")
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
  difficulty:
    displayName: "Difficulty"
  reps:
    displayName: "Reviews"
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
      - stability
      - difficulty
      - reps
      - lapses
      - source
      - file.name
  - type: table
    name: "Due Items"
    filters:
      and:
        - "due <= now()"
    order:
      - due
      - stability
      - difficulty
      - source
      - file.name
`;

export const NEW_CARDS_YAML = `filters:
  and:
    - file.hasTag("topic")
    - "status == 'new'"

properties:
  type:
    displayName: "Type"
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
      - type
      - priority
      - created
      - source
      - file.name
`;

export const LEARNING_YAML = `filters:
  and:
    - file.hasTag("topic")
    - or:
      - "status == 'learning'"
      - "status == 'relearning'"

properties:
  due:
    displayName: "Due"
  status:
    displayName: "Status"
  difficulty:
    displayName: "Difficulty"
  reps:
    displayName: "Reviews"
  lapses:
    displayName: "Lapses"
  source:
    displayName: "Source"

views:
  - type: table
    name: "In Learning"
    order:
      - due
      - status
      - difficulty
      - reps
      - lapses
      - source
      - file.name
`;

export const ALL_EXTRACTS_YAML = `filters:
  and:
    - file.hasTag("topic")

formulas:
  next_review: "if(due < now(), 'Overdue', due)"
  health: "if(lapses > 3, 'Struggling', if(stability > 10, 'Strong', 'Normal'))"

properties:
  type:
    displayName: "Type"
  status:
    displayName: "Status"
  due:
    displayName: "Next Review"
  priority:
    displayName: "Priority"
  stability:
    displayName: "Stability"
  difficulty:
    displayName: "Difficulty"
  reps:
    displayName: "Reviews"
  lapses:
    displayName: "Lapses"
  created:
    displayName: "Created"
  source:
    displayName: "Source"
  formula.health:
    displayName: "Health"

views:
  - type: table
    name: "All Cards"
    order:
      - type
      - status
      - due
      - priority
      - stability
      - reps
      - lapses
      - source
      - file.name
  - type: table
    name: "By Stability"
    order:
      - stability
      - difficulty
      - reps
      - lapses
      - file.name
`;

export const BY_SOURCE_YAML = `filters:
  and:
    - file.hasTag("topic")

properties:
  source:
    displayName: "Source"
  type:
    displayName: "Type"
  status:
    displayName: "Status"
  due:
    displayName: "Due"
  priority:
    displayName: "Priority"
  reps:
    displayName: "Reviews"

views:
  - type: table
    name: "Grouped by Source"
    order:
      - source
      - type
      - priority
      - status
      - due
      - reps
      - file.name
`;
