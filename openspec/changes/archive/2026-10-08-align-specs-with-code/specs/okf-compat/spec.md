## MODIFIED Requirements

### Requirement: OKF conformance check
The system SHALL report as errors a non-reserved markdown file without parseable frontmatter, a missing, empty or non-string `type`, frontmatter in a non-root `index.md` or keys other than `okf_version` in the root one, and a `log.md` date heading that is not `YYYY-MM-DD`; it SHALL report as warnings only broken links, a missing or empty `description`, wikilinks (which OKF consumers do not follow) and an OKF v0.1 `timestamp` key without `generated`.

#### Scenario: Conformant bundle
- **WHEN** every concept has a string `type`
- **THEN** `tg okf check` exits 0 even with broken links

#### Scenario: Missing type
- **WHEN** a concept's frontmatter has no `type`
- **THEN** `tg okf check` reports it and exits 1

#### Scenario: Wikilink warned
- **WHEN** a concept with a string `type` contains `[[Bob]]`
- **THEN** `tg okf check` reports a wikilink warning for that line and exits 0

## ADDED Requirements

### Requirement: Reading OKF bundles
The system SHALL read edge lines whose targets are markdown links, resolving bundle-absolute paths from the bundle root and relative paths from the source note's folder with percent escapes decoded, SHALL ignore links with a URL scheme, pure anchors and non-note files in edge lines, and SHALL use a frontmatter `title` as the node title, falling back to the file name.

#### Scenario: Bundle-absolute target
- **WHEN** `people/alice.md` contains `knows:: [Bob](/people/bob.md) {since: 2020}`
- **THEN** the graph has a `knows` edge from `people/alice.md` to `people/bob.md` with `since` 2020

#### Scenario: Frontmatter title kept
- **WHEN** a note has frontmatter `title: GA4 Events Export`
- **THEN** its node title is `GA4 Events Export`
