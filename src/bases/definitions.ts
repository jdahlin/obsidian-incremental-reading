export const ALL_ITEMS_YAML = `filters:
  and:
    - file.inFolder("IR/Review Items")

properties:
  type:
    displayName: "Type"
  cloze:
    displayName: "Cloze"
  status:
    displayName: "Status"
  priority:
    displayName: "Priority"
  due:
    displayName: "Due"
  stability:
    displayName: "Stability"
  difficulty:
    displayName: "Difficulty"
  reps:
    displayName: "Reps"
  lapses:
    displayName: "Lapses"

views:
  - type: table
    name: "All items"
    order:
      - file.name
      - type
      - cloze
      - status
      - priority
      - due
      - stability
      - difficulty
      - reps
      - lapses
`;

export const DUE_TODAY_YAML = `filters:
  and:
    - file.inFolder("IR/Review Items")
    - "due <= now()"
    - "status != 'new'"

properties:
  type:
    displayName: "Type"
  cloze:
    displayName: "Cloze"
  priority:
    displayName: "Priority"
  due:
    displayName: "Due"

views:
  - type: table
    name: "Due today"
    order:
      - file.name
      - type
      - cloze
      - priority
      - due
`;

export const STRUGGLING_YAML = `filters:
  and:
    - file.inFolder("IR/Review Items")
    - "lapses >= 3"

properties:
  type:
    displayName: "Type"
  cloze:
    displayName: "Cloze"
  lapses:
    displayName: "Lapses"
  difficulty:
    displayName: "Difficulty"
  stability:
    displayName: "Stability"

views:
  - type: table
    name: "Struggling"
    order:
      - file.name
      - type
      - cloze
      - lapses
      - difficulty
      - stability
`;
