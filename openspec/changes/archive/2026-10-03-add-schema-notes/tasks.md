## 1. Schema model

- [x] 1.1 Define the schema shape (properties, kinds, defaults, required, allowed edge types, template) in `packages/core`
- [x] 1.2 Implement the schema reader for notes in the schema folder with diagnostics for bad kinds
- [x] 1.3 Implement multi-label schema merging
- [x] 1.4 Add the schema folder setting with default `Types/`

## 2. Validation

- [x] 2.1 Report missing required properties as diagnostics without dropping nodes
- [x] 2.2 Report disallowed edge types per source node type
- [x] 2.3 Re-evaluate diagnostics when a schema note or a typed note changes
- [x] 2.4 Surface diagnostics in the plugin with an off switch in settings

## 3. Create from type

- [x] 3.1 Add the create-note-from-type command with a type and title prompt
- [x] 3.2 Apply `type`, defaults and template body, refusing to overwrite existing notes
- [x] 3.3 Add a create-schema-note command that scaffolds a schema note

## 4. Tests

- [x] 4.1 Write tests covering every scenario in the schema-notes spec

## 5. Sync

- [x] 5.1 Update lat.md/graph-model Schema notes, add lat.md test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
