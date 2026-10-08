## 1. Setup and fixtures

- [ ] 1.1 Add `@asciidoctor/core` as a root devDependency and confirm no package bundle can import it (esbuild externals and the plugin install test)
- [ ] 1.2 Create the fixture book `packages/core/test/fixtures/asciidoc-book/` (book.adoc with includes, chapters with leading YAML block, `:tg-*:` attributes, `// @tg:` lines, `//// @tg` blocks, xrefs, explicit and generated ids, `[discrete]`, delimited blocks containing trap lines, a code include) plus its metadata-free twin generator

## 2. Core AsciiDoc parser

- [ ] 2.1 Line scanner with block-delimiter stack classifying comments, comment blocks, titles, attribute entries, block attributes, anchors, includes and content lines (`packages/core/src/asciidoc/scan.ts`)
- [ ] 2.2 Metadata: leading `////` YAML block (optional `---` fences), `:tg-*:` attributes as one-line YAML, merge with block precedence and conflict list, document title
- [ ] 2.3 Sections: heading paths, levels, `[discrete]`, explicit ids and Asciidoctor-compatible generated ids honoring `idprefix`, `idseparator`, `sectids!`
- [ ] 2.4 Comment edges: `// @tg:` lines and `//// @tg` blocks parsed with `parseEdges`, forward-sticking anchoring, `section` edge prop
- [ ] 2.5 `xref:` / `<<…>>` to `links_to` (relative resolution, `#id` fragments), anchors never links; `include::` to ordered `includes` edges with props and header-attribute substitution
- [ ] 2.6 Warnings: visible edge syntax outside comments, attribute/block conflicts, unresolved includes, non-YAML leading block
- [ ] 2.7 Visible-text chunks per section (strip comments, attribute entries, include and block attribute lines; xref text kept)
- [ ] 2.8 Export `parseAsciidoc`, `noteFormat`, `noteFrontmatter` from core; unit tests for 2.1–2.7

## 3. Graph integration

- [ ] 3.1 `Graph.upsertNote` dispatches `.adoc` to the AsciiDoc parser; `titleOf` strips `.adoc`; Markdown path unchanged
- [ ] 3.2 Extension-aware `pathResolver` with ambiguity result kept unresolved; `markdownTarget` accepts `.adoc`; stub ids strip either extension
- [ ] 3.3 Section alias ids feed lat index fragment resolution; include of a source file targets the code node
- [ ] 3.4 `chunkNote` uses AsciiDoc chunks for `.adoc`
- [ ] 3.5 Schema reading ignores `.adoc`; `{{edge:}}` embeds not expanded in `.adoc`; OKF export skips `.adoc` with report entries and plain-text links
- [ ] 3.6 `planNewNote`/`templateNotePath` keep the template extension and fill the AsciiDoc leading block and `:tg-*:` entries

## 4. Render-safety oracle

- [ ] 4.1 Test: rendering the fixture book with and without metadata gives equal HTML, and no `@tg`, YAML line or edge syntax appears
- [ ] 4.2 Test: every `id=` emitted by Asciidoctor resolves through our alias map to the same title path
- [ ] 4.3 Test: our section tree equals Asciidoctor's section tree for every fixture file

## 5. Hosts

- [ ] 5.1 node-vault: `listNotes({ asciidoc })`, `isNotePath` for `.adoc`, `readNote` using `noteFrontmatter`; keep `listMarkdown` as alias
- [ ] 5.2 Sidecar sync and watcher pick up `.adoc` notes; setting to turn off
- [ ] 5.3 VS Code: index and watch `.adoc`, backlinks and graph for `.adoc` editors; setting to turn off
- [ ] 5.4 Obsidian: index `.adoc` via `vault.getFiles()` and `cachedRead`, route vault events by extension, ambiguity check in the link resolver, setting to turn off, no extension registration
- [ ] 5.5 CLI: `.tg/config.json` `notes` globs, `.adoc` excluded from source scan, `lat.md/*.adoc` warning, `tg init` proposes globs and writes `.tg/.gitignore`; `tg check`/`read`/`search` work on AsciiDoc notes

## 6. Spec, docs and release

- [ ] 6.1 TGS 0.3: spec text with AsciiDoc section and example, JSON Schema and site build for `spec/tgs/v0.3/`, earlier versions archived unchanged
- [ ] 6.2 `lat.md/`: AsciiDoc notes section, test spec file with `@lat:` refs in tests, updates to publishing/cli/vscode/vector-search sections; `lat check` passes
- [ ] 6.3 README and website docs for AsciiDoc notes; CHANGELOG entries
- [ ] 6.4 Version bump: core, CLI, plugin, sidecar 0.10.0; VS Code 0.9.0; `npm run verify` green
