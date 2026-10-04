---
lat:
  require-code-mention: true
---
# TG Vault Integration Tests

Test specifications for exporting vault notes to a lat.md folder, importing one, and reading one in place inside Obsidian. See [[cli#Vault integration]].

## Read in place

How a lat.md folder behaves inside a vault.

### Nested heading link

A link like `[[architecture#Monorepo layout#core]]` or a short id resolves through the lat resolver to the section and its line, which the plugin opens on click, while the file stays byte-identical.

### Code link

A link like `[[src/config.ts#getConfigDir]]` resolves to a code target, which the plugin reports instead of opening a nonexistent note.

## Export projection

What `tg export` produces.

### Typed edge flattened

A line `knows:: [[Bob]] {since: 2020}` becomes `knows: [[Bob]]` with the property block gone, negative edges say "(negative)", embeds become their value, and the source vault is unchanged.

### Valid output

The exported folder gets headings, directory index files and resolvable links so that both `tg check` and `lat check` pass on it.

## Loss report

Saying what was lost.

### Report shown

Export prints a count per kind of dropped or flattened construct with examples and states that a round trip is not guaranteed.

## Safe export target

Never clobbering files.

### Non-empty target

Export into a non-empty folder exits 2 and changes nothing unless `--force` is given, and it refuses a target inside the exported notes.

## Import

Adopting an existing folder.

### Copy

`tg import` copies a lat.md folder into the vault, or mounts it as a symlink with `--mount`, refuses a non-empty destination and never touches the source.
