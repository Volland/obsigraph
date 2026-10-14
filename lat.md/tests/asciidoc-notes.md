---
type: Scenario
openspec: [asciidoc-notes, chunking-verbalization, node-vault-loader, okf-compat]
lat:
  require-code-mention: true
---
# AsciiDoc Notes Tests

Test specifications for AsciiDoc notes: the parser, render safety against Asciidoctor, graph integration, cross-format links, chunking, OKF export, new notes and each host. See [[asciidoc#Metadata hides in comments]].

## Parser

How the line parser reads properties, edges, sections, references and visible text.

### Delimiter stack

A closing delimiter must equal the one that opened the block, so a `====` inside a listing neither closes nor opens anything.

### Document title

The note title is the `= Title` line when the file has one; a partial without a title leaves the file name to the graph.

### Leading property block

A `////` block before the title is read as YAML properties with `type` as labels; `---` fences inside it are optional and a later block adds nothing.

### Block that is not YAML

A leading block that is not a YAML mapping yields no properties and one error that suggests moving the banner, as for broken frontmatter.

### Header attributes

`:tg-key: value` header attributes become properties with one-line YAML values; render attributes such as `:toc:` are ignored.

### Block wins over attributes

When the block and a `:tg-` attribute set the same key the block value stands and the key is reported as a conflict.

### Host without a YAML parser

Without a host YAML parser a small flat reader handles key-value lines and lists, so core stays dependency-free.

### Line comment edge

`// @tg: type:: [[Target]] {props}` becomes a typed edge with its properties.

### Edge comment block

A `////` block whose first line is `@tg` holds one edge per line, with the sign prefix kept.

### Visible edge syntax

Edge syntax outside a comment makes no edge and a warning, because AsciiDoc renders it as a description list.

### Comment inside a verbatim block

A comment inside a listing, literal or passthrough block is content, not metadata, and makes no edge.

### Anchor to the next heading

A comment followed only by blanks, block attributes, anchors or comments belongs to the next heading section.

### Anchor to the enclosing section

A comment followed by other content belongs to the section that contains it.

### Preamble comment

A comment before the first section heading belongs to the note and carries no `section` property.

### Heading-path ids

Sections get `path#Heading#Sub` ids like Markdown sections, with `==` as the first level.

### Explicit id aliases

Explicit `[#id]`, `[[id]]` and `[id=x]` ids resolve to their section.

### Generated ids

Headings without an explicit id get Asciidoctor-style ids, de-duplicated with `_2`, honoring `idprefix`, `idseparator` and `sectids`.

### Discrete and block headings

Discrete headings and heading-like lines inside delimited blocks form no section.

### Relative xref

`xref:` and `<<>>` references resolve against the folder of the referring file and become `links_to` edges when link edges are on.

### Xref fragment

A `#id` fragment becomes the edge subpath, and a reference to an id in the same file makes no edge.

### Anchor is not a link

`[[id]]` outside a comment is an anchor and never a link.

### Ordered includes

Each `include::` outside blocks becomes an `includes` edge with its position and `leveloffset`, `tags` and `lines`.

### Source include

An include of a source file keeps its `tags` and targets the file path.

### Unresolved include

An include path that uses an attribute the file does not set makes no edge and is reported.

### Visible text

Section text drops comments, attribute entries, includes and block attributes but keeps the text of cross references.

## Render safety

Asciidoctor as a test oracle: metadata never changes the rendered output.

### Rendering unchanged

Rendering each fixture file with and without its metadata gives the same HTML, with no metadata text leaking into it.

### Ids agree with Asciidoctor

Every section id Asciidoctor emits resolves in the graph to the section with the same title path.

### Section tree agrees with Asciidoctor

The section tree of each fixture file equals the one Asciidoctor builds.

## Graph

How `.adoc` files become nodes, edges and sections in the graph.

### Node per file

An `.adoc` file is one node whose id keeps the extension, titled from the document title or the file name.

### Labels and properties

Labels and properties come from the leading block, which wins over `:tg-` attributes.

### Host hands no properties

When a host passes no frontmatter the graph reads the properties from the file itself.

### Comment edges with section

Comment edges become graph edges that record their section, and trap lines inside blocks make none.

### Book assembly

A book note has ordered `includes` edges to its chapter notes.

### Xref link edges

Cross references become `links_to` edges only when link edges are enabled.

### Section resolution

`Graph.resolveSection` turns an id, heading path or lone heading into the canonical section id.

## Cross-format links

Link resolution between Markdown and AsciiDoc notes.

### Markdown links a chapter

A bare link from a Markdown note resolves to the only note with that name, even when it is `.adoc`.

### Ambiguous bare link

When `X.md` and `X.adoc` both exist a bare link resolves to neither and is reported with both paths.

### Explicit extension

A link with an extension resolves to that file only.

## Chunking and limits

Search chunks and what this version leaves out.

### Chunks by section

An `.adoc` note is chunked at its sections with the properties as context and only reader-visible text.

### Cross reference text in chunks

A chunk keeps the display text of `xref:` and `<<>>` references.

### Includes not duplicated

Included files are not merged into the including note, so their text appears only in their own chunks.

### AsciiDoc schema ignored

An `.adoc` file in the schema folder declares no schema.

### No edge embeds

`{{edge:}}` embeds are not scanned in `.adoc` notes.

## OKF export

Export of a vault that holds AsciiDoc notes.

### Chapters skipped

The OKF export leaves `.adoc` notes out and lists each as skipped in the report.

### Links to chapters as text

Links from exported notes to a skipped chapter are written as plain text, with the edge type kept and the count reported.

## New notes

Creating a typed note from an `.adoc` template.

### Template decides the format

A type whose template is an `.adoc` file creates an `.adoc` note with its leading block and `:tg-` entries filled.

### Markdown template unchanged

A Markdown template still creates a Markdown note.

### Template values win

Values in the template property block win over type defaults.

## Hosts

What each host does with `.adoc` notes.

### Node vault lists notes

The node vault loader lists `.adoc` beside `.md` unless AsciiDoc is turned off.

### Node vault reads properties

Reading an `.adoc` note returns its merged leading-block and attribute properties.

### Node vault block error

A leading block that is not YAML gives null properties and a one-line error.

### Sidecar indexes notes

The sidecar indexes `.adoc` notes, picks up their edits, and leaves them out when `OBSIGRAPH_ASCIIDOC=0`.

### VS Code indexes notes

The VS Code index reads `.adoc` notes with backlinks and live updates, unless the setting is off.

### VS Code creates an adoc note

The VS Code new-note plan keeps the extension of an `.adoc` template.

### Obsidian indexes notes

The plugin index reads `.adoc` notes through the vault, with labels from the leading block.

### Obsidian resolves across formats

The plugin resolver finds `.adoc` notes by bare name, reports ambiguity with `.md`, and honors extensions.

### Obsidian setting off

With the setting off the plugin skips `.adoc` files and drops them on reindex.

### Obsidian vault events

Edits, deletes and renames of `.adoc` notes reach the graph without a metadata cache event.

### CLI checks notes globs

`tg check` reads `.adoc` files matched by the `notes` globs of `.tg/config.json` and passes a clean book.

### CLI broken links

Broken includes, cross references and source links in notes are errors.

### CLI property and ambiguity errors

Unset include attributes, ambiguous links and unreadable property blocks are errors.

### CLI never scans adoc as code

`.adoc` files are never scanned for code annotations, with or without a glob.

### CLI note warnings

Rendering edge syntax and property conflicts are warnings, always printed.

### AsciiDoc in lat.md

An `.adoc` file in `lat.md/` builds no sections and `tg check` warns, in line with `lat check`.

### CLI locate and search

`tg locate`, `section` and `search` find sections of notes matched by the globs.

### CLI config error

A malformed `.tg/config.json` is reported instead of ignored.

### CLI init proposes globs

`tg init` proposes `notes` globs and writes `.tg/.gitignore` only when `.adoc` files exist.

### CLI init fixes old ignore

`tg init` replaces an old catch-all `.tg/.gitignore` so the committed config stays visible.

### CLI graph with notes

`tg cypher` sees notes with their edges, and an include ends at the code node.
