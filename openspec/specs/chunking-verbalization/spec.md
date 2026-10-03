# chunking-verbalization Specification

## Purpose
Defines how notes are split into self-describing chunks and how edges are rendered as sentences, so both can be embedded and cited back to their source.

## Requirements

### Requirement: Heading-aware chunking
The system SHALL split a note body into chunks at heading boundaries and SHALL further split any section longer than the configured size limit.

#### Scenario: Two sections
- **WHEN** a note has two headings each with short text
- **THEN** two chunks are produced, one per section

#### Scenario: Oversized section
- **WHEN** one section exceeds the size limit
- **THEN** it is split into several chunks each within the limit, without cutting in the middle of a word

### Requirement: Context prepended to every chunk
The system SHALL prepend the note title, its type labels and its frontmatter to the text of every chunk of that note.

#### Scenario: Chunk carries context
- **WHEN** a note titled `Alice` with type `Person` and frontmatter `role: engineer` is chunked into three chunks
- **THEN** the embeddable text of each chunk begins with the title, type and frontmatter before the chunk body

#### Scenario: No frontmatter
- **WHEN** a note has no frontmatter and no type
- **THEN** each chunk is prefixed with the title only

### Requirement: Chunk provenance
The system SHALL record for each chunk the note path and the nearest heading, so a chunk can be cited.

#### Scenario: Chunk under a heading
- **WHEN** a chunk comes from the section `## Career` of `People/Alice.md`
- **THEN** the chunk records path `People/Alice.md` and heading `Career`

#### Scenario: Text before any heading
- **WHEN** a chunk comes from text before the first heading
- **THEN** the chunk records the note path and no heading

### Requirement: Deterministic chunk identity
The system SHALL produce identical chunks, in the same order and with the same stable identifiers, when the same note content is chunked again, and SHALL change the identifier of a chunk when its text changes.

#### Scenario: Re-chunk unchanged note
- **WHEN** a note is chunked twice without edits
- **THEN** both results have the same chunk identifiers and texts

#### Scenario: Edited chunk
- **WHEN** one paragraph of a note is edited
- **THEN** only the chunk containing that paragraph gets a different identifier

### Requirement: Node score aggregation
The system SHALL compute a node's similarity as the highest similarity among its chunks by default, and SHALL support pooling the chunk vectors of a node into one vector as an alternative mode.

#### Scenario: Best chunk
- **WHEN** a node has chunks with similarities 0.3 and 0.8 to a query and the best-chunk mode is active
- **THEN** the node's score is 0.8

#### Scenario: Pooled
- **WHEN** the pooled mode is active
- **THEN** the node is represented by one vector combining its chunk vectors and its score is the similarity of that vector

### Requirement: Edge verbalization
The system SHALL render each edge as one sentence of the form `Source (SourceType) verb Target (TargetType)` followed by ` - ` and its properties when it has any.

#### Scenario: Edge with properties
- **WHEN** edge `knows` from `Alice` (Person) to `Bob` (Person) has properties `since: 2020` and `label: "met at conf"`
- **THEN** the sentence is `Alice (Person) knows Bob (Person) - since 2020, met at conf`

#### Scenario: Edge without properties
- **WHEN** edge `works_at` from `Alice` (Person) to `Acme` (Company) has no properties
- **THEN** the sentence is `Alice (Person) works at Acme (Company)`

#### Scenario: Untyped endpoint
- **WHEN** an endpoint note has no type
- **THEN** its name is rendered without parentheses

### Requirement: Negative edges are verbalized as negative
The system SHALL express a negative sign in the sentence so a distrust edge is not embedded as if it were a positive one.

#### Scenario: Negative edge
- **WHEN** edge `trusts` from `Alice` (Person) to `Eve` (Person) has sign -1
- **THEN** the sentence is `Alice (Person) trusts (negative) Eve (Person)`

### Requirement: Edge sentence provenance
The system SHALL record for each edge sentence the edge identifier, the source note path and the source heading when present.

#### Scenario: Edge under a heading
- **WHEN** an edge line sits under `## Colleagues` in `People/Alice.md`
- **THEN** its sentence record carries the edge identifier, path `People/Alice.md` and heading `Colleagues`
