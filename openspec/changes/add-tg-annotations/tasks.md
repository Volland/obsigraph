## 1. Scanner

- [ ] 1.1 Find `@lat:` and `@tg:` in line and block comments for all supported languages
- [ ] 1.2 Strip comment prefixes and delegate to `parseEdges`
- [ ] 1.3 Treat a bare `[[x]]` as `references::`

## 2. Attachment

- [ ] 2.1 Attach to the next declaration within three lines using the symbol provider
- [ ] 2.2 Fall back to the file node with a warning

## 3. Validation

- [ ] 3.1 Resolve targets through the lat resolver and report broken ones
- [ ] 3.2 Check edge types and targets against schema notes (advisory)
- [ ] 3.3 Feed `require-code-mention` coverage in `tg check`

## 4. Tests

- [ ] 4.1 Write tests covering every scenario in the tg-annotations spec

## 5. Sync

- [ ] 5.1 Document in lat.md/cli, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
