## Why

Books and long-form technical writing are kept in AsciiDoc, which today is invisible to the typed graph: the CLI even scans `.adoc` files as source code. Authors want chapters to be typed notes with properties and edges while the files stay standard AsciiDoc that Asciidoctor renders exactly as before.

## What Changes

- `.adoc` files become first-class typed notes in every host (core, node-vault, CLI, VS Code, sidecar, Obsidian), indexed by default with a setting to turn them off.
- Properties come from a leading `////` comment block holding YAML (same semantics as Markdown frontmatter) and from `:tg-*:` header attributes parsed as one-line YAML; the block wins on conflict and `tg check` warns.
- Typed edges are written only inside comments: `// @tg: type:: [[T]] {props}` lines and `////` blocks starting with an `@tg` line, so nothing ever reaches the rendered output.
- Comments attach forward to the next heading when only blank lines, block attributes or anchors sit between them, otherwise to the enclosing section, and before the first section to the note; the section is recorded on the edge as `section`.
- `xref:` and `<<…>>` become `links_to` edges (resolved relative to the file, as Asciidoctor does); `include::` becomes an ordered `includes` edge carrying `leveloffset`, `tags` and `lines`, and an include of source code links to the code node.
- Sections use heading-path ids like Markdown (`ch03.adoc#Metagraphs#Definition`), with explicit and generated AsciiDoc ids indexed as aliases; `[discrete]` headings and headings inside delimited blocks are not sections; the title comes from `= Title`.
- Bare link targets resolve to `.md` or `.adoc`; when both exist the link is reported ambiguous instead of guessed.
- Search and vector chunks hold only reader-visible text, split at AsciiDoc sections; comments, attribute entries, `include::` lines and block attribute lines are dropped.
- The parser is a dependency-free line parser in core; Asciidoctor.js is a dev dependency used only as a test oracle for render safety, section ids and section structure.
- `tg` gains a `notes` glob list in its config so a book folder is read as notes; `.adoc` is no longer scanned as code. `lat.md/` stays Markdown-only so `lat check` parity holds, and `tg check` warns about `.adoc` there.
- Out of scope for this version: schema notes in AsciiDoc, `{{edge:}}` embeds in AsciiDoc, OKF export of AsciiDoc (skipped with a warning). New typed notes use the format of the type's template.
- TGS 0.3 defines a note as a Markdown or AsciiDoc file. Plugin, CLI and core go to 0.10.0, the VS Code extension to 0.9.0.

## Capabilities

### New Capabilities
- `asciidoc-notes`: AsciiDoc note parsing (properties, comment edges, anchoring, sections and id aliases, xrefs, includes), link resolution across formats, render-safety guarantees and checks, and host indexing.

### Modified Capabilities
- `node-vault-loader`: lists notes with `.md` and `.adoc` extensions and reads AsciiDoc metadata.
- `chunking-verbalization`: chunks AsciiDoc by section with only visible text.
- `tgs-spec`: version 0.3 widens the note definition to AsciiDoc and documents its syntax.
- `okf-compat`: OKF export skips AsciiDoc notes with a warning.

## Impact

- Core: new `packages/core/src/asciidoc/` parser; `Graph.upsertNote`, `pathResolver`, `markdownTarget`, `titleOf`, lat section index, `chunkNote`, `newnote` template handling, OKF export.
- node-vault (`listMarkdown`/`isNotePath`), sidecar sync, VS Code workspace index, Obsidian `vault-index.ts` (non-Markdown files read through the vault adapter; no extension registration), CLI `project.mts` source scan and config.
- New dev dependency: `@asciidoctor/core` (tests only, never bundled).
- Spec site: `spec/tgs/v0.3/`, JSON Schema, namespace page.
- Docs: `lat.md/` sections for AsciiDoc notes and test specs; README and website docs.
