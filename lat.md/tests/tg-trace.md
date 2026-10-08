---
lat:
  require-code-mention: true
---
# TG Trace Tests

Test specifications for OpenSpec traceability: the requirement index, `openspec:` targets and frontmatter, test-call attachment and `tg trace`. See [[cli#Requirement trace]].

## OpenSpec reader

How spec files become an index of requirements.

### Main spec

A `### Requirement:` heading in `openspec/specs/<cap>/spec.md` becomes an active requirement of that capability with its SHALL sentence and every `#### Scenario:` under it.

### Active change

ADDED and MODIFIED requirements of an unarchived change resolve as `pending` with the change name; REMOVED names mark the main requirement, and archived changes are ignored.

### No openspec folder

A project without `openspec/` gets no index, `tg check` stays green, and `tg trace` exits 2 with a message.

## Requirement ids

How `openspec:` targets resolve.

### Scenario id

Capability, requirement and scenario match case-insensitively with whitespace collapsed, and a main-spec requirement wins over a pending one of the same name.

### Misspelled requirement

An unknown requirement or capability does not resolve and the message suggests the nearest id.

## Annotations on tests

How `@tg:` comments above test calls attach.

### Test call

A `@tg:` comment directly above `it('name', ...)` attaches to the file without a warning and records `test: name` on every edge.

## Docs frontmatter

How lat.md files name the requirements they explain.

### Capability entry

`openspec: [cap, "cap#Req"]` in a lattice file's frontmatter makes its root section reference those requirements, and `tg trace` lists the file as documentation.

## Check

How `tg check` treats OpenSpec references.

### Broken requirement target

A `@tg:` target `openspec:cap#Misspelled` is reported with file, line and a did-you-mean suggestion.

### Unknown frontmatter capability

An `openspec:` frontmatter entry naming no capability is reported against the file.

### Untraced requirement

A requirement with no annotations at all is not a `tg check` finding.

## Trace command

What `tg trace` reports.

### Full trace

A requirement with an `implements` annotation and a `verifies` annotation on each scenario is listed as implemented and verified with their locations.

### Strict gap

`--strict` exits 1 while any requirement is unimplemented or a scenario unverified, `--gaps` lists only those, and the default run exits 0.

### Unknown capability

Naming a capability that does not exist exits 2 and lists the known ones.

## Requirement nodes

Requirements in the section graph.

### Cypher over requirements

`tg cypher` sees `Requirement` and `Scenario` nodes, and a code symbol's `implements` edge ends at the requirement node.
