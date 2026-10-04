## 1. Scanner

- [x] 1.1 Find `@lat:` and `@tg:` in line and block comments for all supported languages
- [x] 1.2 Strip comment prefixes and delegate to `parseEdges`
- [x] 1.3 Treat a bare `[[x]]` as `references::`

## 2. Attachment

- [x] 2.1 Attach to the next declaration within three lines using the symbol provider
- [x] 2.2 Fall back to the file node with a warning

## 3. Validation

- [x] 3.1 Resolve targets through the lat resolver and report broken ones
- [x] 3.2 Check edge types and targets against schema notes (advisory)
- [x] 3.3 Expose annotations so `tg check` can compute `require-code-mention` coverage (the coverage check itself lands in add-tg-check-commands 2.2)

## 4. Tests

- [x] 4.1 Write tests covering every scenario in the tg-annotations spec

## 5. Sync

- [x] 5.1 Document in lat.md/cli, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
