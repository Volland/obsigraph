## MODIFIED Requirements

### Requirement: Typed Graph annotations
The system SHALL keep what SHACL cannot express as annotations in the `tgs:` namespace, as defined by the published TGS namespace: on node shapes the source note (`tgs:note`), the template link (`tgs:template`), the body of a `schema:` note that serves as the type's template (`tgs:templateBody`), the visualization block (`tgs:visualization`, a JSON literal with sorted keys) and `tgs:edgesClosed`; on property shapes `tgs:edge`, `tgs:kind` and `tgs:default`; and on edge-type shapes `tgs:note` and `tgs:visualization`. Every such annotation SHALL be a non-SHACL predicate so other SHACL consumers can ignore it.

#### Scenario: Visualization preserved
- **WHEN** `Person` declares `visualization: {color: "#3b82f6"}`
- **THEN** the Person shape carries a `tgs:visualization` literal containing that color

#### Scenario: Template link and body kept apart
- **WHEN** `Person` declares `template: "[[Templates/Person]]"` and `Note` is declared by a `schema:` note with a body
- **THEN** the Person shape carries `tgs:template` with the link and the Note shape carries `tgs:templateBody` with the note body

### Requirement: Import SHACL into schema notes
The system SHALL import a SHACL Turtle file into the schema folder from the CLI (`tg schema import <file.ttl> [--vault dir] [--schema-folder Types] [--layout auto|per-type|single] [--into name] [--force] [--base iri]`) and from a plugin command. The default layout `auto` SHALL group types by `tgs:note` when present and otherwise create one note per type; `per-type` SHALL create one note per type; `single` SHALL put all types in one note. A type already declared in the vault SHALL be written to the note that declares it. Updating SHALL replace only the schema declarations of the imported types and keep each note's body and other frontmatter.

#### Scenario: One note per type
- **WHEN** the user imports a file with shapes for `Person` and `Company`
- **THEN** `Types/Person.md` and `Types/Company.md` are created, each with `schema:`

#### Scenario: Single note layout
- **WHEN** the user imports the same file with `--layout single --into Org`
- **THEN** `Types/Org.md` is created with `Person` and `Company` under `schemas:`

#### Scenario: Existing body kept
- **WHEN** `Types/Person.md` exists with a body and the import contains `Person`
- **THEN** its schema declaration is replaced and its body is unchanged

#### Scenario: Grouped by source note
- **WHEN** a file exported from a vault where `Person` and `Company` were declared in `Types/Org.md` is imported into an empty vault with the default layout
- **THEN** both types are written under `schemas:` in `Types/Org.md`

## ADDED Requirements

### Requirement: Imported prefixes placed with their users
The system SHALL write each imported non-builtin prefix to the `prefixes:` of the first note whose imported declarations use it, and to the first written note when no declaration uses it.

#### Scenario: Prefix follows its type
- **WHEN** an imported file declares prefix `foaf:` used only by the `Person` shape, with the per-type layout
- **THEN** `Types/Person.md` declares `foaf` under `prefixes:` and `Types/Company.md` does not
