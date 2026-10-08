## Context

See proposal.md for motivation and `specs/asciidoc-notes/spec.md` for the behavior contract.

Today every layer assumes Markdown:
- `Graph.upsertNote` takes `{ path, text, frontmatter, edges? }` and runs `parseEdges`, which is line-based and Markdown-aware (fences, `#` headings).
- Hosts produce `frontmatter` themselves. Obsidian uses `metadataCache` (`.md` only); node-vault YAML-parses `splitFrontmatter`.
- `pathResolver` appends `.md`, `markdownTarget` rejects other extensions, and `titleOf` strips `.md`.
- `parseMarkdown` (latmd) builds heading-path sections; `chunkNote` splits on `#` headings.
- `@tg:` comment parsing exists for code (`code/annotations.ts`), with forward attachment to the next symbol.
- The CLI treats every non-`.md` file outside `lat.md/` as source.

## Goals / Non-Goals

**Goals:**
- One AsciiDoc parser in core that yields everything hosts need (properties, edges, sections, aliases, includes, visible text, warnings), so hosts only route files.
- Markdown behavior and output stay byte-identical; every existing test passes unchanged.
- Bundle size of the Obsidian plugin grows by a few KB, not by a full AsciiDoc processor.

**Non-Goals:**
- Full AsciiDoc fidelity (inline formatting, tables, conditionals, attribute substitution beyond header attributes in include paths).
- Rendering or editing AsciiDoc in any host.

## Decisions

### 1. A dedicated `asciidoc/` module with one entry point
`parseAsciidoc(text, path, options)` returns:
- `meta`: merged properties, YAML error and conflicting keys;
- `title`;
- `sections`: heading path, level, line range and alias ids;
- `edges`: `ParsedEdge[]` with a `section` prop;
- `includes`, `xrefs`;
- `chunks`: visible text per section;
- `warnings`.

`Graph.upsertNote` dispatches on the extension (`noteFormat(path)`), so callers keep passing the same `NoteInput`. Hosts get properties through `noteFrontmatter(path, text)`, which wraps the YAML path for `.md` and the merged meta for `.adoc`.

*Alternative:* a format-agnostic AST shared with Markdown. Rejected: it would mean rewriting a stable Markdown parser for no user-visible gain.

### 2. Line scanner with a block-delimiter stack
AsciiDoc structure that matters here is line-delimited:
- delimited blocks: `----`, `....`, `====`, `****`, `____`, `++++`, `|===` and `////`, where a closing line must match the opening length;
- section titles: `=`… `======` followed by a space;
- block attribute lines: `[...]`;
- anchors: `[[id]]` and `[#id]`;
- attribute entries: `:name: value`;
- line comments (`//`, but not `////`), and `include::` directives.

One pass with a stack of open delimiters classifies each line. Edge lines inside `@tg` comments reuse `parseEdges` on the extracted text, so edge syntax, signs, properties and diagnostics are shared with Markdown and code.

*Alternative:* Asciidoctor.js at runtime. Rejected: it adds more than 1 MB, drops comments before its AST, and runs synchronously and slowly over large vaults.

### 3. Anchoring reuses the code-annotation rule shape
Pending comment edges are buffered. A section title flushes them to the new section if only blank, block-attribute, anchor or comment lines came in between; any other content line flushes them to the current section. The section is stored as edge prop `section`, the canonical id `<path>#<H1>#<H2>`, which matches how Markdown edges record their heading. That way Cypher, embeds and views need no change.

### 4. Generated id algorithm mirrors Asciidoctor
For each title the steps are:
1. lowercase it;
2. strip inline markup characters and remove invalid id characters;
3. replace spaces, dots and hyphens with the separator;
4. collapse repeats and add the prefix;
5. de-duplicate with `_2`, `_3`.

Defaults are prefix `_` and separator `_`. Header `:idprefix:` and `:idseparator:` override them, and `:sectids!:` disables generated ids. The oracle test (decision 7) pins this against real output, so drift is caught.

### 5. Resolution: extension-aware `pathResolver`
The resolver indexes basenames without the extension, mapping each to the set of paths with that basename. A bare target with one candidate resolves; with several candidates whose extensions differ it returns an `ambiguous` result, which the graph keeps as unresolved (no stub merge) and `tg check` reports. Explicit extensions match exactly. The plugin's `getFirstLinkpathDest` path gets the same ambiguity check by looking up the sibling extension.

`xref:` targets resolve relative to the source directory, never by basename. Section aliases go into the lat index alias map consulted by `#fragment` resolution.

### 6. Hosts route by extension; Obsidian reads `.adoc` through the adapter
- **node-vault:** `listNotes({ asciidoc })` replaces `listMarkdown`, which stays as a deprecated alias. `isNotePath` accepts `.adoc`.
- **Obsidian:** `vault.getMarkdownFiles()` plus `vault.getFiles().filter(adoc)`. `.adoc` text is read with `vault.cachedRead`, because `metadataCache` has nothing for it. Vault events route by extension to the note path when the setting is on, and to the code layer otherwise. No `registerExtensions`.
- **VS Code / sidecar:** they follow node-vault, and VS Code also watches `**/*.adoc`.
- **CLI:** `tg` has no config file today, so this adds `.tg/config.json` with `{ "notes": ["book/**/*.adoc"] }`. It is committed, while the vector cache in `.tg/` stays ignored through a `.tg/.gitignore` that `tg init` writes. The glob matches are added to the doc set. `sourceFiles()` excludes `.adoc`. `lat.md/**/*.adoc` produces a warning only.

### 7. Asciidoctor.js as a test-only oracle
`@asciidoctor/core` is a root devDependency, imported only from `packages/core/test/asciidoc-render.test.ts`. The fixture book lives in `packages/core/test/fixtures/asciidoc-book/`. Tests:
- render with and without metadata (comments stripped by our own scanner) and compare the HTML;
- check that the HTML contains no `@tg` and no YAML lines;
- check that every `id=` in the HTML resolves through our alias map;
- check that our section tree equals `doc.getSections()` recursively.

The esbuild config keeps it out of the bundles; the plugin install test from the previous change already fails if `main.js` requires an unknown module.

### 8. Chunking reuses `chunkNote` output shape
For `.adoc`, `chunkNote` takes `parseAsciidoc(...).chunks` (visible lines per section) and applies the existing size splitting, context prefix and stable ids. Visible text is everything except comments, attribute entries, `include::` lines and block attribute lines. `xref:t[text]` becomes `text` and `<<t,text>>` becomes `text`.

### 9. New-note format from the template extension
`templateNotePath` and `planNewNote` keep the template's extension. When the template is `.adoc`, the planned file is `<name>.adoc`. Property filling then rewrites the leading `////` YAML block and existing `:tg-*:` entries instead of frontmatter.

## Risks / Trade-offs

- [Generated ids differ from Asciidoctor on exotic titles, such as unicode or inline macros] → oracle test over a fixture with tricky titles; explicit `[#id]` always wins; documented limitation.
- [An author's existing `////` header comment, such as a licence banner, is not YAML] → it produces a one-line YAML error and no properties, like broken Markdown frontmatter. `tg check` explains that the leading block is read as properties and suggests adding a blank `////` block or moving the banner below the title.
- [Treating `.adoc` as notes changes CLI output for repos that had `.adoc` scanned as code] → release notes; previously only `@tg` comments were picked up, and those are still read, now with section anchoring.
- [Obsidian `vault.on('modify')` for non-Markdown files fires without a metadata cache] → we re-read and debounce through the existing refresh path.
- [Ambiguity errors surprise vaults that have both `X.md` and `X.adoc`] → the message names both files and the explicit-extension fix.

## Migration Plan

Additive. AsciiDoc indexing is on by default in vault hosts with a setting to turn it off, and the CLI reads `.adoc` notes only through `notes` globs (`tg init` proposes one when `.adoc` files exist). Rollback is turning the setting off, or dropping the globs. Versions: core, CLI, plugin and sidecar 0.10.0, VS Code 0.9.0, TGS 0.3. The release goes out with an atomic push of the commit and the tag, and the plugin install check runs afterwards.
