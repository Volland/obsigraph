## MODIFIED Requirements

### Requirement: Schema changes take effect live
The system SHALL re-read a schema when its note changes, and SHALL update diagnostics for affected notes in the same vault index update that processes the change, without reopening the vault or restarting the plugin.

#### Scenario: Required flag added
- **WHEN** the user marks `born` as required in `Types/Person.md`
- **THEN** after the index processes that change, Person notes without `born` have a diagnostic, with no restart

## ADDED Requirements

### Requirement: Multi-label validation
The system SHALL validate a note with several types against the merge of their schemas: the first declaration of a property wins, allowed edge types are the union of all types' edges, the targets of an edge type are the union of its targets, any-target wins over a target list, and `many` and `required` hold when any type sets them.

#### Scenario: Edges from both types allowed
- **WHEN** a note has `type: [Person, Employee]`, `Person` allows only `knows` and `Employee` allows only `works_at`
- **THEN** the note's `knows` and `works_at` edges produce no diagnostic

#### Scenario: Required from one type
- **WHEN** `Employee` requires `employer` and a note typed `[Person, Employee]` lacks it
- **THEN** the note is reported as missing `employer`

### Requirement: Malformed declarations reported
The system SHALL report a malformed declaration (a `schema` that is not a mapping, `edges` that is neither a list nor a mapping, invalid `from` or `to`, a non-string `uri` or `template`, an invalid prefix IRI) as a diagnostic naming the schema note and the key, and SHALL ignore only the malformed part.

#### Scenario: Bad edges value
- **WHEN** `Types/Person.md` declares `edges: 5` and a valid `properties` block
- **THEN** a diagnostic names `Types/Person.md` and `edges`, and the declared properties still validate Person notes
