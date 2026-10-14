## MODIFIED Requirements

### Requirement: Project root discovery
The system SHALL locate the project root by walking upward from the working directory to the nearest directory containing `lat.md/`, `tg.md/` or `.tg/`, unless `--dir` is given. A `lat.md/` or `tg.md/` directory that is itself a git repository (it holds `.git`) SHALL NOT count, so a clone of another project named `lat.md` does not make its parent a project.

#### Scenario: Run from a subdirectory
- **WHEN** `tg check` runs in `src/auth/` of a project whose root holds `lat.md/`
- **THEN** it checks that project root

#### Scenario: tg.md project
- **WHEN** `tg check` runs in `src/` of a project whose root holds `tg.md/` and no `lat.md/`
- **THEN** it checks that project root

#### Scenario: Explicit directory
- **WHEN** `tg --dir ../other check` runs
- **THEN** the project root is `../other` regardless of the working directory

#### Scenario: No project found
- **WHEN** no ancestor contains `lat.md/`, `tg.md/` or `.tg/`
- **THEN** the command exits with code 2 and a message suggesting `tg init`

#### Scenario: Repository named lat.md
- **WHEN** `~/work/lat.md/` is a git clone and `tg check` runs in `~/work/app/`, which has no docs folder
- **THEN** no project is found and `~/work/` is not used as the root
