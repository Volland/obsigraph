## 1. In place

- [ ] 1.1 Detect a `lat.md/` folder in the vault or at the vault root
- [ ] 1.2 Resolve nested-heading and code links on click, hover and backlinks via the lat resolver
- [ ] 1.3 Surface check findings as diagnostics in the plugin

## 2. Export

- [ ] 2.1 Project a vault subset to a lat-conformant folder with typed edges flattened
- [ ] 2.2 Normalize links and verify leading-paragraph and link rules
- [ ] 2.3 Print a loss report and refuse to overwrite without `--force`

## 3. Import

- [ ] 3.1 Implement `tg import` by copy and by mount

## 4. Tests

- [ ] 4.1 Write tests covering every scenario in the lat-vault-integration spec

## 5. Sync

- [ ] 5.1 Document in lat.md/cli, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
