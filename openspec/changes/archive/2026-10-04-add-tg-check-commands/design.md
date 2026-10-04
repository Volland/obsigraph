## Context

Agents run these commands in hooks, so output must be stable and terse. lat.md output format is the de facto contract, copied loosely, not byte-for-byte.

## Goals / Non-Goals

**Goals:** identical verdicts to lat.md; clear error messages with file and line; stable JSON.

**Non-Goals:** byte-identical text output; fixing lat.md's own bugs silently.

## Decisions

**Parity is defined by verdicts, not text.** The suite compares the set of (kind, file, line) findings, normalizing message wording. Matching text exactly would lock in incidental formatting.

**Intentional differences are recorded** in a differences file and asserted, mirroring the engine-conformance suite.

**Check collects all findings** then exits 1; it never stops at the first.

**Code-ref checks degrade honestly:** a file that cannot be parsed yields an `unresolvable` warning, only a parsed file lacking the symbol yields an error.

## Risks / Trade-offs

- [lat.md changes behavior in a new release] -> pin the reference version in CI and bump it deliberately.
- [Real-project fixtures contain licensed content] -> use only permissively licensed projects or sanitized excerpts.
