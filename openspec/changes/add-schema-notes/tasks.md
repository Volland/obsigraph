## 1. Schema model

- [ ] 1.1 Define the schema shape (properties, kinds, defaults, required, allowed edge types, template) in `packages/core`
- [ ] 1.2 Implement the schema reader for notes in the schema folder with diagnostics for bad kinds
- [ ] 1.3 Implement multi-label schema merging
- [ ] 1.4 Add the schema folder setting with default `Types/`

## 2. Validation

- [ ] 2.1 Report missing required properties as diagnostics without dropping nodes
- [ ] 2.2 Report disallowed edge types per source node type
- [ ] 2.3 Re-evaluate diagnostics when a schema note or a typed note changes
- [ ] 2.4 Surface diagnostics in the plugin with an off switch in settings

## 3. Create from type

- [ ] 3.1 Add the create-note-from-type command with a type and title prompt
- [ ] 3.2 Apply `type`, defaults and template body, refusing to overwrite existing notes
- [ ] 3.3 Add a create-schema-note command that scaffolds a schema note

## 4. Tests

- [ ] 4.1 Write tests covering every scenario in the schema-notes spec

## 5. Sync

- [ ] 5.1 Update lat.md/graph-model Schema notes, add lat.md test-spec sections and `@lat:` refs, run `lat check` and `openspec validate`
