## 1. Section tree

- [ ] 1.1 Parse headings into nested sections skipping frontmatter and fenced code
- [ ] 1.2 Capture the leading paragraph and its length excluding wiki-link content
- [ ] 1.3 Read `lat:` frontmatter options such as `require-code-mention`

## 2. Ids and links

- [ ] 2.1 Implement full and short section ids and fuzzy locate
- [ ] 2.2 Extract wiki links outside code with alias support
- [ ] 2.3 Implement the tagged resolver (section, file, code, ambiguous, missing)

## 3. Integration

- [ ] 3.1 Export from `core` and feed resolved links into the graph builder so nested-heading links are not stubs
- [ ] 3.2 Keep an incremental per-file cache

## 4. Tests

- [ ] 4.1 Write tests covering every scenario in the lat-resolver spec

## 5. Sync

- [ ] 5.1 Document in lat.md/cli, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
