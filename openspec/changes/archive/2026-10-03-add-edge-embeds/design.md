## Context

lat.md/edge-syntax defines both embed forms resolved through one lookup, and edge IDs derived as `source#type#target#n` or pinned with `id`. Derived IDs shift on reorder, which is the reason for warnings.

## Goals / Non-Goals

**Goals:** two embed forms, one lookup; value and table rendering; stable-reference warnings; live updates.

**Non-Goals:** editing properties through the embed, embeds of node properties, automatic pinning (writing `id` into notes).

## Decisions

**One lookup with two keys.** The lookup accepts either a pinned ID or (source, type, target, optional sign). The embed parser decides which by presence of `->`. Separate resolvers were rejected as duplicate logic.

**Endpoint embeds do not count as pinned references.** Only they trigger warnings, since pinned references are already stable. Warning on every unpinned edge was rejected as noisy.

**Sign lives inside the arrow, before the type.** `-knows->` matches either sign, `--knows->` only negative and `-+knows->` only positive. The original wording used `-knows->` both for an unsigned match and for a negative one, which cannot both hold.

**Ambiguity picks the lowest ordinal and warns.** Failing outright would break prose; silent choice would hide the instability.

**Warnings are diagnostics, not render errors.** The page renders with an unresolved marker or the first match.

**Render through a markdown post-processor, in both reading and live preview.** Alternative, a custom editor widget only, was rejected for reading-view parity.

## Risks / Trade-offs

- [Live preview widget differences] -> test both modes; table styling uses theme variables only.
- [Embed syntax collides with other `{{ }}` plugins] -> only the `edge:` prefix is claimed.
- [Note titles containing `-` or `>`] -> endpoints may be wrapped in `[[ ]]`; plain form splits on the first ` -` and `-> ` markers with spaces.
