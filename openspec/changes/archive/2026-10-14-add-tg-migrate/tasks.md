## 1. Command

- [x] 1.1 `tg migrate` skeleton: flags, dirty-tree guard, dry run, write, text and JSON report
- [x] 1.2 File typing by path and SHALL content
- [x] 1.3 Link typing from the ontology: candidates by endpoint types, cue words, negative and unrestricted edges need a cue
- [x] 1.4 Metadata: `since` from git blame, `strength` from the sentence, `level` from test paths, only when the edge type declares the property
- [x] 1.5 `@lat:` upgrade to `@tg:` with `--keep-lat`
- [x] 1.6 Setup swap through the `tg init --migrate` planner

## 2. Skill

- [x] 2.1 `tg-migrate` skill, installed by `tg init` for every agent and printed by `tg gen migrate-skill.md`

## 3. Tests and docs

- [x] 3.1 Tests for every scenario
- [x] 3.2 lat.md, test specs, README, site docs; `lat check`, `openspec validate --strict`, suite
