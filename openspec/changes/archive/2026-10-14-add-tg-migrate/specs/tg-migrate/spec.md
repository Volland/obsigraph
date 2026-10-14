## ADDED Requirements

### Requirement: Migrate command
`tg migrate [--dry-run] [--json] [--infer] [--keep-lat] [--no-setup] [--no-since] [--force]` SHALL convert the project in the working directory from lat.md to an ontology-aware tg project: set up agents, type docs files, type links, add metadata and upgrade code references, using the ontology in `Types/` or, when the project has none, the bundled code ontology. It SHALL write its changes unless `--dry-run` is given, in which case it SHALL print a diff and modify nothing. A second run SHALL change nothing.

#### Scenario: Dry run
- **WHEN** `tg migrate --dry-run` runs in a lat.md project
- **THEN** a diff of every file it would change is printed and no file is modified

#### Scenario: Idempotent
- **WHEN** `tg migrate` runs twice
- **THEN** the second run reports nothing to change

### Requirement: File typing
`tg migrate` SHALL add a `type:` to the frontmatter of each docs file that has none when its path names its kind: `decision`, `decisions`, `adr` or `adrs` as a file or folder name or an `adr-` file prefix as `Decision`; `requirement`, `requirements` or `reqs` as `Requirement`; a `tests` or `scenarios` folder, or `tests` or `scenarios` file, as `Scenario`; `constraint`, `constraints`, `policies`, `policy` or `compliance` as `Constraint`; `glossary`, `concepts`, `terms` or `terminology` as `Concept`; `changes` or `changelog` as `Change`. Otherwise a file whose sections below the title mostly state SHALL or MUST sentences SHALL be typed `Requirement`. Index files named after their folder and files that already have a `type:` SHALL NOT be changed.

#### Scenario: Decisions typed by name
- **WHEN** `lat.md/decisions.md` has no frontmatter
- **THEN** it gains `type: Decision` and its content is otherwise unchanged

#### Scenario: Existing type kept
- **WHEN** `lat.md/notes.md` has `type: Concept`
- **THEN** its type is unchanged

### Requirement: Link typing
For each plain wiki link in a section of a typed docs file, `tg migrate` SHALL find the candidate relations: the edge types whose `from` allows a type of the source section and whose `to` allows a type of the target (a section of a typed file, an OpenSpec requirement or scenario, or code). Edge types with a negative meaning (`contradicts`) and edge types with no `from` or no `to` SHALL be candidates only when the link's line contains one of their cue words. A candidate SHALL be applied when it is the only candidate whose cue words appear in the sentence containing the link; with `--infer`, a single candidate SHALL also be applied without a cue. Cue words SHALL be matched in that sentence only, not in the rest of the line, as whole words (`reason` does not match `reasonable`) unless a cue is a stem (`motivat*`), and a period inside the link target SHALL NOT end the sentence. An applied relation SHALL be written as a typed edge line at the end of the section's own text, keeping the prose link, and a link already typed in that section SHALL be skipped. Cue words SHALL include the words of the edge type's name, and for the bundled edges: `because`, `due to`, `driven by`, `reason` for `motivated_by`; `replaces`, `supersedes`, `instead of`, `no longer` for `supersedes`; `contradicts`, `conflicts`, `violates`, `despite` for `contradicts`; `refines`, `more specific`, `narrows` for `refines`; `depends on`, `requires`, `needs` for `depends_on`; `constrains`, `limits`, `bound by`, `must`, `shall`, `required`, `should` for `constrains`.

#### Scenario: Cued relation
- **WHEN** a section of a `Decision` file says "Tokens are short because of [[constraints#Session limit]]." and the target is in a `Constraint` file
- **THEN** the section gains `- motivated_by:: [[constraints#Session limit]]` and the prose link stays

#### Scenario: Sentence scope
- **WHEN** a line says "Tokens are short because of [[constraints#Session limit]]. This replaces [[decisions#Long sessions]]."
- **THEN** the first link becomes `motivated_by` and the second `supersedes`

#### Scenario: Words, not substrings
- **WHEN** a `Decision` section says "A reasonable approach, see [[decisions#Long sessions]]."
- **THEN** `reasonable` is not read as the cue `reason` and the link stays plain

#### Scenario: No cue without infer
- **WHEN** a `Decision` section says "See [[glossary#Session]]." and the only candidate is `motivated_by`
- **THEN** no edge is added and the report lists the link with reason `no cue`; with `--infer` the `motivated_by` edge is added

#### Scenario: Disambiguated by a cue
- **WHEN** a `Decision` section says "This replaces [[decisions#Long sessions]]."
- **THEN** the section gains `- supersedes:: [[decisions#Long sessions]]`

#### Scenario: Ambiguous link left plain
- **WHEN** a `Decision` section links another `Decision` with no cue word
- **THEN** no edge is added and the report lists the link with candidates `supersedes` and `motivated_by`

### Requirement: Edge metadata
`tg migrate` SHALL add to an applied edge only properties its edge type declares: `since` as the `YYYY-MM-DD` date of the commit that last changed the link's line, from `git blame`, unless `--no-since` is given or the file is not tracked; `strength` as `must` when the line contains MUST, SHALL, `required` or `must`, and `should` when it contains `should` or `recommended`; `level` on a `verifies` edge as `e2e`, `integration` or `unit` from an `e2e`, `integration` or other test path.

#### Scenario: Strength from the sentence
- **WHEN** a `Constraint` section says "Every token MUST expire, see [[requirements#Token expiry]]."
- **THEN** the edge written is `- constrains:: [[requirements#Token expiry]] {strength: must}`, and a committed `motivated_by` link gets `since` with its commit date

#### Scenario: Undeclared property not added
- **WHEN** the edge type of an applied relation declares no `since`
- **THEN** the edge line has no `since`

### Requirement: Code reference upgrade
`tg migrate` SHALL replace an `@lat: [[target]]` comment whose target is a section typed `Requirement` or `Decision` with `@tg: implements:: [[target]]`, and one whose target is typed `Scenario`, or that sits directly above a test call, with `@tg: verifies:: [[target]]`, keeping the comment marker and indentation and adding the metadata its edge type declares. Other `@lat:` comments SHALL be left alone. With `--keep-lat` the `@lat:` line SHALL be kept and the `@tg:` line added above it.

#### Scenario: Implementation upgraded
- **WHEN** `src/token.ts` has `// @lat: [[requirements#Token expiry]]` above a function and the target file is typed `Requirement`
- **THEN** the line becomes `// @tg: implements:: [[requirements#Token expiry]]` with `since` when committed

#### Scenario: Keep lat
- **WHEN** `tg migrate --keep-lat` runs on the same file, twice
- **THEN** both the `@tg: implements::` line and the original `@lat:` line are present, once each

### Requirement: Setup swap
Unless `--no-setup` is given, `tg migrate` SHALL apply the `tg init --migrate` setup for the detected agents, or Claude Code when none is detected: the lat block, `lat hook` commands and `lat` MCP entry replaced by tg's, and the skills, OpenSpec guidance and code ontology added when missing.

#### Scenario: lat block replaced
- **WHEN** `CLAUDE.md` holds a `%% lat:begin %%` block and `tg migrate` runs
- **THEN** it holds a `%% tg:begin %%` block instead and text outside the markers is unchanged

### Requirement: Migration safety
`tg migrate` SHALL refuse to write, and exit 2 naming the files, when any file it would change has uncommitted changes in git, unless `--force` is given, and SHALL also refuse when git cannot report the state of those files. It SHALL always refuse, naming the paths, to write a file whose real location, through a symlink, is outside the project root.

#### Scenario: Symlink out of the project
- **WHEN** `lat.md/shared` is a symlink to a folder outside the project whose files `tg migrate` would change
- **THEN** it exits 2 naming those paths and writes nothing, even with `--force`

#### Scenario: Dirty file refused
- **WHEN** `lat.md/decisions.md` has uncommitted edits and `tg migrate` would change it
- **THEN** it exits 2, names the file and writes nothing

### Requirement: Migration report
`tg migrate` SHALL report the files it typed, the edges it added by type, the code references it upgraded, and every link it left plain with its file, line, section, target, the reason (`untyped source`, `untyped target`, `no candidate`, `no cue` or `ambiguous`), the candidates and the line's text, as text or, with `--json`, as data.

#### Scenario: JSON for an agent
- **WHEN** `tg migrate --dry-run --json` runs
- **THEN** the output lists `typed`, `edges`, `upgraded` and `unresolved`, each unresolved entry with `file`, `line`, `section`, `target`, `reason`, `candidates` and `text`
