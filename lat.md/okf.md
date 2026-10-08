---
openspec: [okf-compat]
---
# OKF

Compatibility with Google Cloud's Open Knowledge Format (OKF v0.2): reading bundles into the typed graph, exporting a vault as a conformant bundle, and checking conformance.

OKF (spec: `okf/SPEC.md` in github.com/GoogleCloudPlatform/knowledge-catalog) is a directory of markdown concepts with YAML frontmatter. Its only required key is `type`; `title`, `description`, `resource` and `tags` are recommended; concepts link with standard markdown links, bundle-absolute (`/a/b.md`) or relative; `index.md` and `log.md` are reserved. Links are untyped: the kind of relationship is "conveyed by the surrounding prose".

## Reading

Frontmatter `type` already gives node labels, so reading needs markdown links: typed edge lines accept them, and an opt-in turns prose links into `links_to` edges.

`knows:: [Bob](/people/bob.md) {since: 2020}` is parsed like its wikilink form (see [[edge-syntax#Markdown link targets]]). Plain links in prose become edges only with link edges on (see [[graph-model#Plain link edges]]); the sidecar enables them with `OBSIGRAPH_LINK_EDGES=1`. A `types` list next to `type` adds labels, which is how the export keeps multi-label notes.

## Export

`tg export <out> --format okf` writes a conformant bundle at `<out>/` through [[packages/core/src/okf/export.ts#exportOkf]], keeping typed edges as prose so tg reads it back into the same graph.

Wikilinks become bundle-absolute markdown links with percent-encoded paths and GitHub-style heading anchors; inside edge lines the type, sign and property block stay, so `knows:: [[Bob]] {since: 2020}` becomes `knows:: [Bob](/People/Bob.md) {since: 2020}`. To an OKF reader that is a link whose kind the prose names, exactly the spec's model. Links to notes outside the export stay links to not-yet-written concepts, which OKF allows. `{{edge: ...}}` embeds become their value, `![[note]]` becomes a plain link, and `![[file.png]]` becomes a markdown image whose file is copied.

Every concept gets a string `type` (missing ones get `--default-type`, default `Note`; a list keeps its first entry and moves the full list to `types`), plus `title` (first H1 or file name) and `description` (first sentence of the first paragraph) when missing. Frontmatter is edited, not re-serialized, so the author's YAML stays as written; unparseable frontmatter is left alone and reported. Notes named `index.md` or `log.md` are renamed to `index-note.md` / `log-note.md` and links follow. Every directory gets an `index.md` listing concepts with descriptions and subdirectories; only the root one has frontmatter, `okf_version: "0.2"`. `--title` names the root index.

The command prints a change report (kinds in `OKF_CHANGE_DESCRIPTIONS`), verifies the output with the check below, and shares the lat export's safety rules: no non-empty target without `--force`, never a target inside the notes.

## Conformance check

`tg okf check [dir]` runs [[packages/core/src/okf/check.ts#checkOkf]], failing only on the spec's conformance rules and reporting everything consumers must tolerate as warnings.

Errors: a non-reserved `.md` without frontmatter or with unparseable YAML, a missing, empty or list `type`, frontmatter in a nested `index.md` or keys other than `okf_version` in the root one, and `log.md` date headings that are not `YYYY-MM-DD`. Warnings: broken markdown links, wikilinks (OKF consumers do not follow them), a missing `description`, and the v0.1 `timestamp` key without `generated`. Exit code 1 means errors; `--json` gives `{ok, files, errors, warnings}`. Google's sample bundles pass. YAML is parsed in the CLI (`packages/cli/src/okf.mts`), keeping core dependency-free.

## Not covered

Provenance, trust and lifecycle fields (`sources`, `generated`, `verified`, `status`, `stale_after`) and attested computations are preserved when present but never invented by the export.

They describe who wrote and confirmed a concept, which a vault does not record. Authors who want trust tiers add them by hand, as the website article explains.
