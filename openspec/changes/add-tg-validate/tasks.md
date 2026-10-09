## 1. Findings with codes

- [x] 1.1 Add optional `code` to `Diagnostic` and set it at every creation site: edge syntax, TGS declaration, schema validation, style and embed diagnostics
- [x] 1.2 Add the code-to-severity table and a `Finding` type in core
- [x] 1.3 Replace the message-matching in the TGS conformance test with the `code` field

## 2. Shared validation

- [x] 2.1 Implement `validateVault(notes, options)` in core with `--schema-only` support and deterministic ordering
- [x] 2.2 Make `VaultIndex.diagnostics()` call it, keeping the lat.md findings the plugin adds on top

## 3. CLI

- [x] 3.1 Implement `tg validate` with `--vault`, `--schema-folder`, `--only`, `--ignore`, `--schema-only`, `--strict` and exit codes
- [x] 3.2 Add text, `--json` and `--format sarif` writers
- [ ] 3.3 Read vault notes with `@obsigraph/node-vault`, sharing the helper with `tg schema` and `tg okf`

## 4. Tests

- [x] 4.1 Write tests covering every scenario in the tg-validate spec
- [x] 4.2 Add a test that the example vault gives the same findings through the command and through the plugin's diagnostics

## 5. Docs and sync

- [x] 5.1 Document the command in lat.md, add test-spec sections with `@lat:` refs, update the website docs with a CI example, and add the command to the agent hook guidance
- [x] 5.2 Run `lat check`, `openspec validate add-tg-validate --strict` and the full test suite
