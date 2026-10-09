---
lat:
  require-code-mention: true
---
# TG Validate Tests

Test specifications for `tg validate`, covering every scenario in the tg-validate spec. See [[cli#Vault validation]].

## Findings reported

A Person note without its required `email` and a disallowed edge are listed per note with severity, code and 1-based line, the summary counts them, the exit code is 0 and no file changes.

## Clean vault

A vault without findings prints one summary line and exits 0.

## Vault without schemas

With no schema notes only `edge-syntax` and `embed` findings appear, with their lines.

## Finding codes

A disallowed edge gives `edge-not-allowed` as a warning with path and line; `edges: 5` in a schema note gives `invalid-declaration` as an error and exit code 1.

## Exit codes

Warnings exit 0, `--strict` makes them exit 1, and a missing vault or an unknown format exits 2 with an error.

## Selecting findings

`--ignore` and `--only` filter findings and counts by code, and `--schema-only` reports a duplicate type but not a malformed edge in a data note.

## Output formats

`--json` and `--format json` print one document with `ok`, note count, counts by severity and findings; `--format sarif` prints a SARIF 2.1.0 log with rules, levels and physical locations.

## Plugin and command agree

The example vault gives the same findings through `tg validate --json` and through the plugin's `VaultIndex.diagnostics()` without lat.md link findings.
