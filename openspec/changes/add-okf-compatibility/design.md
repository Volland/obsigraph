## Context

OKF v0.2 (github.com/GoogleCloudPlatform/knowledge-catalog, `okf/SPEC.md`) defines a bundle as a directory of markdown concepts. Conformance (section 11) needs only three things: every non-reserved `.md` file has parseable frontmatter, every frontmatter has a non-empty `type`, and `index.md` / `log.md` follow their structure. Links are standard markdown links, bundle-absolute (`/a/b.md`, recommended) or relative, and are untyped: "the specific kind is conveyed by the surrounding prose". Consumers must tolerate broken links, unknown types and unknown keys.

Typed Graph notes use `type` frontmatter (possibly a list), `[[wikilinks]]`, and `type:: [[Target]] {props}` edge lines.

## Goals / Non-Goals

**Goals:** a vault exports to a conformant bundle; tg reads that bundle back into the same typed graph; tg reads third-party OKF bundles usefully; a validator tells authors whether a folder is conformant.

**Non-Goals:** producing provenance or trust fields (`generated`, `verified`, `sources`) the author never wrote; attested computations; copying attachments; two-way sync.

## Decisions

**Typed edges survive as prose.** `knows:: [[Bob]] {since: 2020}` exports as `knows:: [Bob](/People/Bob.md) {since: 2020}`. To an OKF consumer it is a link whose kind the prose names; to tg it is the original typed edge, because the edge parser accepts markdown link targets. The export is lossless for the graph except embeds and transclusions.

**Markdown link targets are normalized to vault paths.** The parser decodes percent escapes, drops `#anchor` into the subpath, resolves `./` and `../` against the source note's folder, strips a leading `/`, and adds `.md` when missing. Every resolver (Obsidian's, `pathResolver`) then gets a full vault path. A link with a URL scheme (`https:`, `mailto:`) is never an edge. A missing target becomes a stub named by its path without `.md`, like a missing wikilink.

**Plain link edges are opt-in.** OKF consumers treat every link as an untyped edge, but turning all prose wikilinks into edges would change every existing vault's graph and queries. The `links_to` type is produced only when the graph is built with `linkEdges`. Image embeds (`![...]`) are not edges.

**`type` is always a string in the output.** A missing or empty `type` gets the default (`--default-type`, `Note`). A list keeps its first entry as `type` and the whole list as the extension key `types`, which consumers must preserve. Unparseable frontmatter cannot be fixed safely, so it is left as written and reported as a finding.

**Frontmatter is edited, not re-serialized.** Core has no YAML dependency, and rewriting an author's YAML loses comments and formatting. The export inserts missing keys at the top of the block and replaces only a list-valued `type` block.

**Reserved names are renamed.** A note called `index.md` or `log.md` becomes `index-note.md` / `log-note.md` (with a number when taken), and links to it follow.

**Index files are generated.** Every directory gets an `index.md` with no frontmatter (the root one has only `okf_version: "0.2"`), one heading, and `* [Title](path) - description` entries for concepts and subdirectories.

**The check is permissive like the spec.** Errors are only the three conformance rules plus a non-string `type`. Broken links, missing `title` / `description`, and the legacy `timestamp` key are warnings.

## Risks / Trade-offs

- [Prose edges look odd to OKF readers] -> the line reads `knows:: Bob`, which is still understandable; the article explains it.
- [Default type `Note` is vague] -> configurable; the report lists every note that got it so authors can type them.
- [Description derived from the first paragraph may be poor] -> only filled when missing, and listed in the report.
