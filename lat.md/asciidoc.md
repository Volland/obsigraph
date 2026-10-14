---
type: Decision
openspec: [asciidoc-notes, chunking-verbalization, node-vault-loader, okf-compat, tgs-spec]
---
# AsciiDoc Notes

`.adoc` files are typed notes beside Markdown ones, with properties, typed edges, sections and links, while each file stays plain AsciiDoc that Asciidoctor renders as before. These are the choices behind how.

## Metadata hides in comments

A file carries graph metadata only in a leading `////` YAML block, `:tg-*:` header attributes and `// @tg:` comments, so no processor ever renders it.

The leading block has the meaning of Markdown frontmatter and wins over a `:tg-key:` attribute for the same key, which `tg check` reports. Edges are read only from `// @tg: type:: [[Target]] {props}` lines and from `////` blocks whose first line is `@tg`; edge syntax outside a comment is no edge and a warning, because AsciiDoc renders it as a description list.

- motivated_by:: [[architecture#Source of truth]] {note: "the files stay the source of truth and stay readable by their own tools"}

## Line parser in core

One dependency-free scanner in [[packages/core/src/asciidoc/parse.ts#parseAsciidoc]] yields properties, edges, sections, includes, cross references and visible text, so hosts only route files by extension.

[[packages/core/src/asciidoc/scan.ts#scanLines]] classifies each line with a stack of open delimiters: a closing delimiter must equal its opener, and nothing inside a verbatim block counts. Edge lines inside comments reuse the shared edge parser, so syntax, signs and diagnostics match Markdown and code. Core takes the YAML parser from the host.

- motivated_by:: [[architecture#Monorepo layout]] {note: "core has no host APIs and the plugin bundle stays small"}
- motivated_by:: [[asciidoc#Metadata hides in comments]]

## Comments anchor forward

A comment followed only by blanks, block attributes, anchors or other comments belongs to the next heading; any other comment belongs to its enclosing section.

The section is stored on the edge as `section`, the canonical heading-path id, which matches how Markdown edges record their heading, so Cypher, embeds and views need no change. A comment before the first heading belongs to the note.

- motivated_by:: [[asciidoc#Metadata hides in comments]]

## Ids as Asciidoctor makes them

Sections get heading-path ids like Markdown; explicit ids and the ids Asciidoctor generates resolve to the same section.

[[packages/core/src/asciidoc/parse.ts#generateId]] follows Asciidoctor's algorithm with `idprefix`, `idseparator` and `sectids`, and an oracle test pins it against real output. The graph resolves an id, heading path or lone heading through [[packages/core/src/graph/graph.ts#Graph#resolveSection]]. The lattice index in `lat.md/` stays Markdown-only; the CLI adds note sections for lookups through [[packages/core/src/latmd/index.ts#LatIndex#setNotes]].

- motivated_by:: [[asciidoc#Line parser in core]]

## Ambiguous across formats

A bare link matches `.md` and `.adoc` notes; when both exist it is reported and resolves to nothing, and a link with an extension names that file only.

[[packages/core/src/graph/resolve.ts#pathResolver]] returns no match and lists both paths through its `ambiguous` method, which the graph turns into an `ambiguous-link` diagnostic. Guessing would link a chapter to the wrong note without anyone noticing.

- motivated_by:: [[graph-model#Nodes]]

## Hosts route by extension

Each host indexes `.adoc` notes beside Markdown with a setting to turn them off, and never registers itself as an editor for them.

Obsidian reads them with `vault.getFiles()` and `cachedRead` because its metadata cache has nothing for them, and re-reads edits itself. The node loader ([[packages/node-vault/src/index.ts#listNotes]]) serves the sidecar and VS Code. The CLI reads only files matched by the `notes` globs of the committed `.tg/config.json`, never scans `.adoc` as code, and warns about `.adoc` in `lat.md/` through `checkNotes` in `packages/cli/src/notes.mts`, so `tg check` and `lat check` agree on every `lat.md/` folder.

- motivated_by:: [[architecture#Source of truth]]
- motivated_by:: [[asciidoc#Line parser in core]]

## Asciidoctor only as an oracle

`@asciidoctor/core` is a dev dependency used by tests alone: it renders the fixture book with and without metadata and compares ids and section trees.

It never enters a bundle, which the plugin install check would catch, and runtime code needs none of its weight.

- motivated_by:: [[asciidoc#Line parser in core]]

## Left out of this version

Schema notes stay Markdown, `{{edge:}}` embeds are not expanded in `.adoc`, and the OKF export skips `.adoc` notes, listing each one and writing links to them as plain text.

A new typed note uses the format of its type's template, which [[packages/core/src/schema/adocnote.ts#renderAdocNote]] fills in for `.adoc`.

- motivated_by:: [[asciidoc#Line parser in core]]
