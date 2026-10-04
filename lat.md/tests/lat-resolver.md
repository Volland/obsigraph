---
lat:
  require-code-mention: true
---
# Lat Resolver Tests

Test specifications for the lat.md-compatible section tree and link resolver in `packages/core/src/latmd`, one section per scenario of the lat-resolver spec. See [[cli#Compatibility contract]].

## Section tree

How a markdown file becomes nested sections.

### Nested headings

`#`, `##` and `###` produce nested sections whose ids chain the heading texts after the project-relative file path, and whose end line is the line before the next heading.

### Heading in code fence

A heading-like line or a wiki link inside a fenced block, or a link inside an inline code span, creates no section and no reference.

## Section ids

Full and short forms of a section id.

### Short id

`search#Indexing` resolves to the section in the one file named `search.md`, case-insensitively, and the full `lat.md/...` form resolves to the same section.

### Ambiguous short id

When two files share a name the short id resolves to `ambiguous`, listing both candidates and suggesting the one that actually has the section.

## Link resolution

What a wiki-link target points at.

### Code target

A link whose file part has a supported source extension, including the Node ES-module `.mts`, resolves to a `code` result naming the file and the symbol path.

### Missing section

A link to a nonexistent heading in an existing file resolves to `missing` with the closest section id as a suggestion, and an unsupported extension is reported as such.

### Real project resolves

Every section link in this repository's own `lat.md/` resolves and every section passes the leading-paragraph rule, which anchors the resolver to a real lat.md project.

## Leading paragraph rule

The overview sentence every section must have.

### Missing leading paragraph

A heading followed directly by a child heading, with no paragraph before it, is reported as lacking a leading paragraph.

### Wiki links not counted

The 250-character limit excludes wiki-link content, so a short paragraph with a very long link passes while 260 plain characters fail.
