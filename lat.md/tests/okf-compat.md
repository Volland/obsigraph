---
lat:
  require-code-mention: true
---
# OKF Compatibility Tests

Test specifications for reading Open Knowledge Format bundles, exporting a vault to one and checking conformance. See [[okf]].

## Reading

How the parser and graph read OKF-style links and types.

### Bundle-absolute link target

`knows:: [Bob](/people/bob.md) {since: 2020}` in `people/alice.md` yields a `knows` edge to `people/bob.md` with its properties, and percent escapes are decoded.

### Relative link target

`works_at:: [Acme](../orgs/acme.md)` resolves against the source note's folder to `orgs/acme.md`, and wikilinks and markdown links mix in one comma list.

### External URL ignored

A markdown link with a URL scheme, a pure anchor or a non-note file in an edge line produces no edge.

### Link edges from prose

With `linkEdges` on, a prose markdown link or wikilink to a note becomes a `links_to` edge with sign +1, and a missing target becomes a stub.

### Link edges off by default

Without the option, the same prose links produce no edges, so existing graphs are unchanged.

### Images are not edges

`![a](/img/a.png)`, `![[a.png]]` and links inside inline code never become edges, even with link edges on.

### Frontmatter title kept

A note with frontmatter `title: GA4 Events Export` has that as its node `title`; without one the title is the file name.

### Types list adds labels

Frontmatter `types: [Person, Engineer]` next to `type: Person` yields both labels once each.

## Export

What `exportOkf` and `tg export --format okf` produce.

### Typed edge kept as prose

`knows:: [[Bob]] {since: 2020}` becomes `knows:: [Bob](/People/Bob.md) {since: 2020}`, sign prefixes stay, and paths with spaces are percent-encoded.

### Round trip

Loading the exported bundle into a graph gives the same typed edges (source, type, sign, target, properties) and labels as the vault.

### Unresolved link kept

`[[Missing Note]]` becomes a link to `/Missing%20Note.md`, counted as a broken link, which OKF allows.

### Missing type defaulted

A note without frontmatter gets `type` (the default or `--default-type`), `title` and `description`; existing keys stay as written.

### List type split

`type: [Person, Employee]` becomes `type: Person` with `types` listing both.

### Reserved note renamed

A note named `index.md` is exported as `index-note.md` and links to it follow.

### Index files generated

Every directory gets an `index.md` listing concepts with descriptions and subdirectories; only the root one has frontmatter, `okf_version: "0.2"`.

## Check

What `checkOkf` and `tg okf check` report.

### Conformant despite broken links

A bundle whose concepts all have a string `type` has no errors, while broken links, wikilinks and missing descriptions are warnings.

### Missing type rejected

A concept without frontmatter, with unparseable frontmatter, without `type` or with a list `type` is an error.

### Index and log structure

Frontmatter in a nested `index.md`, extra keys in the root one, and a non-ISO `log.md` date heading are errors.

### Check command exit codes

`tg okf check` exits 0 on a conformant folder, 1 with errors, and lists warnings without failing.

### Export command verifies

`tg export --format okf` writes the bundle at the target root, copies embedded attachments, prints the change report and passes its own check.
