---
lat:
  require-code-mention: true
---
# TG Check Tests

Test specifications for `tg locate`, `section`, `refs`, `expand` and `check`, including the differential suite that compares `tg check` with `lat check`. See [[cli#Compatibility contract]].

## Locate and section

Reading sections from the command line.

### Fuzzy locate

A misspelled name still finds the section and prints its id and file range, while a nonsense query exits 1.

### Incoming references

`tg section` lists the sections and the code lines that reference the section being shown.

## Refs and expand

References and ref expansion.

### Code reference listed

`tg refs` lists code files and lines carrying an annotation that targets the section, and `--scope md` hides them.

### Expand text

`tg expand` rewrites short refs to full ids and appends a context block with locations, and an unresolvable ref exits 1 asking for a correction.

## Check

Validation verdicts.

### Uncovered test spec

A leaf section in a file with `require-code-mention: true` that no annotation targets is reported with its file and line, and the command exits 1.

### Clean project

A project with no findings prints a success line and exits 0.

## Parity with lat.md

Differential tests against the real `lat check`, skipped when `lat` is not installed and run in CI where it is.

### This repository

Both tools report no findings on this repository's own `lat.md/`.

### Seeded breakage

On a fixture with a broken link, a missing symbol, a bad code reference, an uncovered spec, a missing index entry and two leading-paragraph violations both tools report identical findings.

### Upstream project

On a snapshot of the upstream lat.md project, which has over two hundred findings, both tools report the same set; the only normalized difference is the message for `.mjs`, `.cjs`, `.mts` and `.cts` source links that tg accepts.
