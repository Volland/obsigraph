## Purpose

Makes AsciiDoc (`.adoc`) files first-class typed notes with properties, typed edges, sections and links, while keeping every file standard AsciiDoc whose rendered output is unchanged by graph metadata.

## ADDED Requirements

### Requirement: AsciiDoc files are notes
An `.adoc` file SHALL become one node whose id is its path including the extension. Its `title` SHALL be the document title (`= Title`) when present and otherwise the file name without extension.

#### Scenario: Document title
- **WHEN** `book/ch03.adoc` starts with `= Chapter 3. Metagraphs`
- **THEN** the node `book/ch03.adoc` has title `Chapter 3. Metagraphs`

#### Scenario: Partial without title
- **WHEN** `book/parts/intro.adoc` has no document title
- **THEN** its title is `intro`

### Requirement: Properties from a leading comment block
When the first block of an `.adoc` file, before the document title, is a `////` comment block, its content SHALL be read as YAML with the same semantics as Markdown frontmatter, including `type`/`types` labels. A content that is not valid YAML SHALL yield no properties and a one-line error, as for Markdown. Any later `////` block SHALL NOT be read as properties.

#### Scenario: Typed chapter
- **WHEN** a file starts with `////`, `type: Chapter`, `status: draft`, `////`, then `= Metagraphs`
- **THEN** the node has label `Chapter` and property `status` equal to `draft`

#### Scenario: Optional YAML fences
- **WHEN** the leading block content is wrapped in `---` lines
- **THEN** the YAML between them is read the same way

#### Scenario: Later block ignored
- **WHEN** a `////` block holding `type: Chapter` appears after the document title
- **THEN** it adds no properties or labels

### Requirement: Properties from tg attributes
Header attribute entries named `:tg-<key>: <value>` SHALL set property `<key>`, with the value parsed as one-line YAML. Attributes without the `tg-` prefix SHALL NOT become properties. When a key is set by both the leading block and an attribute, the block value SHALL win and the conflict SHALL be reported by `tg check`.

#### Scenario: Typed attribute values
- **WHEN** the header has `:tg-pages: 12` and `:tg-concepts: [Metagraph, Reification]`
- **THEN** `pages` is the number 12 and `concepts` is a two-item list

#### Scenario: Render attributes ignored
- **WHEN** the header has `:toc:` and `:imagesdir: img`
- **THEN** the node has no `toc` or `imagesdir` property

#### Scenario: Conflict
- **WHEN** the block sets `status: draft` and the header has `:tg-status: final`
- **THEN** `status` is `draft` and `tg check` reports the conflicting key

### Requirement: Typed edges only in comments
Typed edges in `.adoc` files SHALL be read only from line comments of the form `// @tg: <edge line>` and from `////` blocks whose first content line is `@tg`, where every following non-blank line is an edge line in the standard edge syntax. Edge syntax outside comments SHALL NOT produce edges.

#### Scenario: Line comment
- **WHEN** a section contains `// @tg: cites:: [[Pavlyshyn 2024]] {page: 12}`
- **THEN** the note has a `cites` edge to `Pavlyshyn 2024` with property `page` 12

#### Scenario: Edge block
- **WHEN** a `////` block holds `@tg`, `extends:: [[Hypergraph]]` and `-contrasts_with:: [[Property graph]]`
- **THEN** the note has an `extends` edge and a negative `contrasts_with` edge

#### Scenario: Visible edge syntax ignored
- **WHEN** a paragraph line reads `defines:: [[Metagraph]]` outside any comment
- **THEN** no edge is produced and `tg check` warns that the line renders as a description list

#### Scenario: Inside a delimited block
- **WHEN** `// @tg: defines:: [[X]]` appears inside a `----` listing block
- **THEN** no edge is produced

### Requirement: Comment anchoring to sections
An edge from a comment SHALL record a `section` property with the canonical id of the section it belongs to. A comment followed, before the next heading, only by blank lines, block attribute lines, anchors or other comments SHALL belong to that next heading's section. Any other comment SHALL belong to the section containing it. A comment before the first section heading SHALL belong to the note and carry no `section` property.

#### Scenario: Comment above a heading
- **WHEN** `// @tg: defines:: [[Metagraph]]` is followed by `[#metagraphs]` and `== Metagraphs`
- **THEN** the edge's `section` is `book/ch03.adoc#Metagraphs`

#### Scenario: Comment in a section body
- **WHEN** the comment sits between two paragraphs of `== Hypergraphs`
- **THEN** the edge's `section` is `book/ch03.adoc#Hypergraphs`

#### Scenario: Comment in the preamble
- **WHEN** the comment appears after the document title and before any `==` heading
- **THEN** the edge has no `section` property

### Requirement: Sections and id aliases
Section headings `==` through `======` SHALL form sections with heading-path ids (`<path>#<Heading>#<Sub>`), the same as Markdown notes. Explicit ids (`[#id]`, `[[id]]`, `[id=…]`) and the ids Asciidoctor generates (honoring `:idprefix:` and `:idseparator:` set in the header) SHALL resolve to the same section. Headings marked `[discrete]` and heading-like lines inside delimited blocks SHALL NOT form sections.

#### Scenario: Heading path
- **WHEN** `== Metagraphs` contains `=== Definition`
- **THEN** a link to `[[ch03#Metagraphs#Definition]]` resolves to that section

#### Scenario: Explicit id alias
- **WHEN** `[#metagraphs]` precedes `== Metagraphs`
- **THEN** `xref:ch03.adoc#metagraphs[]` resolves to the section `ch03.adoc#Metagraphs`

#### Scenario: Generated id alias
- **WHEN** a heading `== Typed Links` has no explicit id and the header sets no id attributes
- **THEN** the id `_typed_links` resolves to that section

#### Scenario: Discrete heading
- **WHEN** `[discrete]` precedes `== Aside`
- **THEN** no section `Aside` exists

### Requirement: Native cross references become links
`xref:<target>[...]` and `<<target,...>>` SHALL produce `links_to` edges when link edges are enabled, resolving the target path relative to the referring file as Asciidoctor does, and a `#id` fragment to the matching section. `[[...]]` outside comments SHALL be treated as an anchor, never as a link.

#### Scenario: Relative xref
- **WHEN** `book/ch03.adoc` contains `xref:ch04.adoc[next chapter]`
- **THEN** it has a `links_to` edge to `book/ch04.adoc`

#### Scenario: Anchor is not a link
- **WHEN** a paragraph contains `[[metagraph-def]]`
- **THEN** no edge to a note named `metagraph-def` is produced

### Requirement: Includes become ordered edges
Each `include::<path>[attrs]` outside delimited blocks SHALL produce an `includes` edge to the resolved file with an `order` property giving its position among the file's includes and `leveloffset`, `tags` and `lines` properties when given. An include of a source file SHALL target that file's code node. Included content SHALL NOT be merged into the including note. A `{name}` reference in the path SHALL be substituted from the same file's header attributes, and an unresolvable include SHALL be reported by `tg check`.

#### Scenario: Book assembly
- **WHEN** `book.adoc` has `include::chapters/ch01.adoc[]` then `include::chapters/ch02.adoc[leveloffset=+1]`
- **THEN** it has `includes` edges with `order` 1 and 2, the second with `leveloffset` `+1`

#### Scenario: Code include
- **WHEN** a chapter has `include::../src/graph.ts[tags=upsert]`
- **THEN** it has an `includes` edge to the code node for `src/graph.ts` with `tags` `upsert`

#### Scenario: Unknown attribute in path
- **WHEN** a file has `include::{chapters}/ch01.adoc[]` and no `:chapters:` header attribute
- **THEN** no edge is produced and `tg check` reports the unresolved include

### Requirement: Link resolution across formats
A bare link target SHALL resolve to a note with either the `.md` or `.adoc` extension. When both exist, the link SHALL be reported as ambiguous and left unresolved; a target with an explicit extension SHALL resolve to that file only.

#### Scenario: Markdown note links a chapter
- **WHEN** `Concepts/Metagraph.md` has `appears_in:: [[ch03]]` and only `book/ch03.adoc` matches
- **THEN** the edge targets `book/ch03.adoc`

#### Scenario: Ambiguous target
- **WHEN** both `Metagraph.md` and `Metagraph.adoc` exist and a note links `[[Metagraph]]`
- **THEN** `tg check` reports the ambiguous link and no edge to either file is created

#### Scenario: Explicit extension
- **WHEN** both exist and a note links `[[Metagraph.adoc]]`
- **THEN** the edge targets `Metagraph.adoc`

### Requirement: Rendering is unchanged by graph metadata
Graph metadata written as specified SHALL NOT change the rendered output of a standard AsciiDoc processor: no `@tg` text, property YAML, edge syntax or undeclared anchor SHALL appear in the HTML. Section ids and the section tree computed for the graph SHALL match those of the processor.

#### Scenario: Rendered fixture book
- **WHEN** the fixture book with every metadata form is rendered by Asciidoctor
- **THEN** the HTML contains none of the metadata text and equals the rendering of the same files with the metadata comments removed

#### Scenario: Ids agree
- **WHEN** the fixture book is rendered
- **THEN** every section id the processor emits resolves in the graph to the section with the same title path

### Requirement: Hosts index AsciiDoc notes
The Obsidian plugin, the VS Code extension, the sidecar and the `tg` CLI SHALL index `.adoc` notes alongside Markdown notes. Vault hosts SHALL index them by default with a setting to turn them off. The Obsidian plugin SHALL NOT register itself as the editor for `.adoc` files. The CLI SHALL read `.adoc` files matched by the `notes` globs of its config as notes and SHALL NOT scan `.adoc` files as source code.

#### Scenario: Obsidian graph
- **WHEN** a vault contains `book/ch03.adoc` with `type: Chapter`
- **THEN** a Cypher query `MATCH (c:Chapter) RETURN c` in a `graph-query` block returns it

#### Scenario: Setting off
- **WHEN** AsciiDoc indexing is turned off in a vault host
- **THEN** no `.adoc` file appears in the graph

#### Scenario: CLI notes glob
- **WHEN** the `tg` config has `notes: ["book/**/*.adoc"]`
- **THEN** `tg check` validates links in those files and reports no code annotations for them

### Requirement: lat.md folder stays Markdown-only
`.adoc` files inside `lat.md/` SHALL NOT be read as lat.md sections, and `tg check` SHALL warn about them, so `tg check` and `lat check` agree on every `lat.md/` folder.

#### Scenario: AsciiDoc in lat.md
- **WHEN** `lat.md/notes.adoc` exists
- **THEN** `tg check` warns that `lat.md/` holds only Markdown and builds no sections from it

### Requirement: AsciiDoc limits in this version
Schema notes SHALL be read only from Markdown files. `{{edge:...}}` embeds SHALL NOT be expanded in `.adoc` files. Creating a typed note SHALL produce an `.adoc` file exactly when the type's template is an `.adoc` file.

#### Scenario: Template decides format
- **WHEN** the type `Chapter` has template `Templates/Chapter.adoc` and a user creates a `Chapter` named `Reification`
- **THEN** the new file is `Reification.adoc` with the template's leading block and attributes filled in

#### Scenario: AsciiDoc schema ignored
- **WHEN** an `.adoc` file in the schema folder declares `schema:` in its leading block
- **THEN** no schema is read from it
