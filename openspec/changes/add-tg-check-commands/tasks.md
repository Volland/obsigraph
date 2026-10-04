## 1. Read commands

- [ ] 1.1 Implement `locate` and `section` with outgoing and incoming refs
- [ ] 1.2 Implement `refs` and `expand` (including `--hook` style output)
- [ ] 1.3 Add `--json` output for each

## 2. Check

- [ ] 2.1 Validate wiki links and code refs
- [ ] 2.2 Validate the leading-paragraph rule and `require-code-mention`
- [ ] 2.3 Collect all findings and set exit codes

## 3. Parity gate

- [ ] 3.1 Add fixture projects including a copy of this repository's `lat.md/`
- [ ] 3.2 Run `lat check` and `tg check` and compare finding sets in a vitest suite
- [ ] 3.3 Record intentional differences and wire the suite into CI as a release gate

## 4. Tests

- [ ] 4.1 Write tests covering every scenario in the tg-check spec

## 5. Sync

- [ ] 5.1 Document in lat.md/cli, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
