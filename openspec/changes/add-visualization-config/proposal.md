## Why

v0.1 styles nodes and edges only from plugin settings. Once schema notes exist, a type should carry its own look, and an individual query block should be able to override it. Precedence was an open question in lat.md/visualization and is settled here.

## What Changes

- Per-type visualization (color, shape, icon, label property) read from a schema note's `visualization` block.
- Per-edge-type styling (color, line style, sign rendering) from schema notes and settings.
- Optional `style` entries in `graph-query` block headers.
- Decision: precedence, highest first, is block header, then schema note, then plugin settings, then built-in default, resolved per attribute.
- Assumptions: icons are Obsidian/Lucide icon names; colors are CSS color strings; an invalid value is ignored with a diagnostic and falls through to the next level; the settings level is device-local while schema notes sync with the vault.

## Capabilities

### New Capabilities
- `visualization-config`: Where per-type and per-edge-type visual attributes come from and how conflicts are resolved.

### Modified Capabilities

## Impact

- Style resolution in `packages/core` (pure), consumption by the shared renderer and header parser in `packages/plugin`.
- Depends on `add-schema-notes`, `graph-query-block` and `graph-view`. The existing settings-only defaults keep working as the third level.
