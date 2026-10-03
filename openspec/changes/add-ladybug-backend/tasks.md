## 1. Interface and selection

- [ ] 1.1 Define the shared query backend interface and register the built-in engine behind it
- [ ] 1.2 Add the `backend` header option, the plugin default setting and header error for unknown values
- [ ] 1.3 Add a backend availability state (available, unavailable with reason, not ready) fed by platform, install probe and mirror status

## 2. Read-only guard

- [ ] 2.1 Implement the tokenizing allow-list check ignoring strings and comments; reject write clauses, multiple statements and non-read statements
- [ ] 2.2 Open the database read-only where the API supports it
- [ ] 2.3 Adversarial test table: writes after WITH, in subqueries, in second statements, keywords in strings and comments, schema statements

## 3. Execution

- [ ] 3.1 Implement query translation onto the mirror layout for labels and properties including `sign`, `id`, `stub`
- [ ] 3.2 Map database values to nodes, relationships and scalars and compute column kinds
- [ ] 3.3 Wait for pending sync before reads or flag staleness; re-run blocks when the mirror becomes ready
- [ ] 3.4 Surface database syntax and runtime errors with position in the block

## 4. Tests

- [ ] 4.1 Table tests covering every scenario in the ladybug-backend spec using a fake adapter
- [ ] 4.2 Integration tests against real LadybugDB gated on availability

## 5. Sync

- [ ] 5.1 Update lat.md/query-engine and lat.md/ladybug-mirror, add test-spec sections and `@lat:` refs, run `lat check` and `openspec validate add-ladybug-backend --strict`
