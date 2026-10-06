## Context

The plugin builds its diagnostics list in `VaultIndex.diagnostics()` ([vault-index.ts](packages/plugin/src/vault-index.ts)) from five sources: `graph.diagnostics()` (edge syntax), `schemasFromGraph().diagnostics` (declarations), `validateSchemas`, `styleSources().diagnostics`, and `EmbedIndex.warnings()`, plus lat.md link findings. All of them except the last live in `@obsigraph/core` and need only notes, so the command can reuse them. Diagnostics are `{path, line, column, message}` with no code or severity, and TGS diagnostic names are currently derived from message text only in the conformance test. The CLI already reads notes with frontmatter for `tg okf` and `tg schema`, and `@obsigraph/node-vault` lists and reads vault notes for the sidecar and VS Code extension. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- One `validateVault` function in core that both the plugin and `tg validate` call.
- Stable finding codes, so CI configuration does not break when message wording changes.
- Output usable by humans, scripts and code-scanning tools.

**Non-Goals:**
- Auto-fixing findings.
- Validating lat.md links and code annotations; that stays with `tg check`.
- Checking property values against their kind, which TGS 0.1 does not require.
- A watch mode.

## Decisions

**1. Findings get a `code` at the source, not by parsing messages.** `Diagnostic` gains an optional `code`, set where each diagnostic is created (`validateSchemas`, `readSchemaNote`, `schemaSetFromNotes`, edge parsing, style, embeds). Message text stays unchanged so existing tests and the plugin UI keep working. The conformance test's message-to-name mapping is then replaced by reading `code`, which removes the regexes. Alternative: derive codes from messages in the CLI. Rejected because it breaks silently when a message is reworded.

**2. Severity is a function of code.** A table in core maps codes to `error` or `warning`; declaration problems are errors because the schema itself is unusable, everything else is a warning because the schema is advisory by design (see the TGS specification). `--strict` is applied by the command, not by core, so the plugin keeps showing one flat list.

**3. `validateVault(notes, {schemaFolder, linkEdges})` takes parsed notes.** It builds a `Graph`, runs the five sources and returns findings sorted by path, line and code, with `--schema-only` implemented by validating just the schema folder's notes. The CLI reads notes with the helper already used by `tg schema` and lists files with `@obsigraph/node-vault`, so ignore rules (dot folders) match the sidecar. Alternative: put the vault walk in core. Rejected because core stays free of Node APIs.

**4. SARIF by hand.** SARIF 2.1.0 for this use is a small fixed shape (tool, rules, results with level and physical location), so it is written directly instead of adding a dependency. Rules are the codes in use.

**5. Line numbers.** Edge findings already carry a line (0-based internally). Schema findings carry none today, so they are reported at note level; points to a key (line of `schemas:` and so on) are a later refinement that would not change codes.

## Risks / Trade-offs

- [Adding `code` to `Diagnostic` touches many creation sites] → The field is optional, so untouched sites compile; a test asserts every diagnostic produced by the example vault and the conformance examples has a code.
- [Warnings that never fail may be missed in CI] → The text summary always shows counts, and `--strict` is documented in the CI example.
- [Large vaults] → Everything is in memory like the sidecar; a 10k-note vault is acceptable and the command prints elapsed time with `--verbose`.

## Migration Plan

Purely additive. The plugin's list is unchanged apart from now using the shared function.
