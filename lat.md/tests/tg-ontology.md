---
lat:
  require-code-mention: true
---
# TG Ontology Tests

Test specifications for typed edges in docs, `tg ontology` and its check, and the ontology-aware agent guidance described in [[cli#Code ontology]].

## Typed edges in docs

Typed edge lines in doc sections become named edges in the section graph.

### Decision motivated by a constraint

A `motivated_by::` line with `{since: 2}` gives a `motivated_by` edge carrying `since`, `tg check` still passes, and no plain `references` edge joins the two sections.

### Negative edge to a requirement

A `-contradicts::` line to an `openspec:` requirement gives a `contradicts` edge with sign -1 and its `ticket`.

### Code fence ignored

A typed edge line inside a fenced code block adds no edge.

## Ontology listing

`tg ontology` prints the project's types and edge types.

### Code ontology listed

After `tg init`, the JSON listing has six types with `Decision` declaring `status`, and eleven edge types with `motivated_by` from `Decision` to `Constraint`, `Concept` and `Decision`; the text listing shows the same arrow.

### No ontology

Without schema notes the listing says no ontology is declared, points at `tg init` and exits 0.

## Ontology check

`tg ontology check` compares written typed edges with the ontology.

### Unknown edge name

`motivatedBy::` is reported at its file and line with the suggestion `motivated_by`, and the check exits 1.

### Wrong endpoint type

A `supersedes::` edge from a `Concept` section is reported as a wrong source, a `weight` outside its values and an undeclared `owner` property are reported too.

### Clean ontology use

Declared edges with allowed endpoints and properties pass with exit 0, plain wiki links and `@lat:` comments are ignored, and a project with no ontology has nothing to check.

## Ontology-aware guidance

The instructions, skills and OpenSpec guidance teach the ontology.

### Instructions teach the ontology

`tg gen claude.md` mentions `tg ontology`, shows a typed edge line with a property block and lists `tg ontology check` in the checklist; every skill and OpenSpec patch mentions `tg ontology`.

### OpenSpec rules teach typed records

The design rules ask for `Decision` sections with `motivated_by` edges and the task rules include `tg ontology check`.
