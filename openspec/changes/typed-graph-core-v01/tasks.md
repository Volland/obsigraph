## 1. Monorepo setup

- [ ] 1.1 Create npm workspaces with `packages/core` and `packages/plugin`, TypeScript config, and a shared lint setup
- [ ] 1.2 Add a lint rule that forbids Obsidian and DOM imports in `packages/core`
- [ ] 1.3 Add a test runner for `core` and a build for `plugin` (esbuild, Obsidian manifest, dev vault install script)

## 2. Edge parsing (core)

- [ ] 2.1 Implement the line scanner that finds `type:: [[Target]]` lines and skips fenced code blocks
- [ ] 2.2 Implement the tolerant property-block parser (unquoted keys, numbers, booleans, strings)
- [ ] 2.3 Implement sign-prefix handling, default sign +1, and keep `weight` independent of sign
- [ ] 2.4 Record the nearest preceding heading as edge metadata
- [ ] 2.5 Emit diagnostics with note and line for malformed property blocks while keeping the edge
- [ ] 2.6 Write tests covering every scenario in the edge-parsing spec

## 3. Graph model (core)

- [ ] 3.1 Implement the graph store (node and edge maps, per-file contribution tracking)
- [ ] 3.2 Implement link resolution through an injected resolver and stub node creation with reference counting
- [ ] 3.3 Derive node labels from frontmatter `type` (string or list) and expose frontmatter, path and title as properties
- [ ] 3.4 Implement derived edge IDs with ordinals and pinned `id` override
- [ ] 3.5 Implement incremental add, modify, rename and delete of a file's contributions, including stub promotion and demotion
- [ ] 3.6 Write tests covering every scenario in the graph-model spec

## 4. Cypher engine (core)

- [ ] 4.1 Implement the lexer and recursive-descent parser for `MATCH`, `WHERE`, `RETURN`, `ORDER BY`, `LIMIT`
- [ ] 4.2 Reject write clauses at parse time and report unsupported clauses by name and syntax errors with line and column
- [ ] 4.3 Implement the pattern-matching executor with label and relationship-type filters
- [ ] 4.4 Implement the expression evaluator for WHERE and property access, including `r.sign`, `r.id` and `n.stub`
- [ ] 4.5 Implement ORDER BY and LIMIT and the result shape `{columns: {name, kind}[], rows}`
- [ ] 4.6 Write a table of accepted and rejected queries as tests covering every scenario in the cypher-query spec

## 5. Plugin integration

- [ ] 5.1 Implement the plugin entry, settings tab and per-type default styles in settings
- [ ] 5.2 Feed `core` from the vault: batched initial indexing with progress, link resolver backed by Obsidian, reading note text for changed files
- [ ] 5.3 Subscribe to metadata-cache events and notify subscribed views with a debounce
- [ ] 5.4 Verify the plugin loads on Obsidian mobile and that nothing writes to notes

## 6. Rendering

- [ ] 6.1 Build the shared `GraphRenderer` on Cytoscape.js with a style sheet generated from the type-to-style map
- [ ] 6.2 Style edges as labeled arrows with positive solid and negative dashed styling, and stub nodes distinctly
- [ ] 6.3 Build the table renderer with node titles linking to notes
- [ ] 6.4 Add the element cap with notice and table fallback

## 7. graph-query block

- [ ] 7.1 Register the `graph-query` code block processor and parse the header (`view`, `columns`) and Cypher body
- [ ] 7.2 Choose the renderer from result shape and honor `view` and `columns` overrides
- [ ] 7.3 Show query and header errors in place with message and position
- [ ] 7.4 Subscribe blocks to live refresh while visible and unsubscribe when hidden
- [ ] 7.5 Add tests or manual checks for every scenario in the graph-query-block spec

## 8. Graph view leaf

- [ ] 8.1 Register the Graph view and the open command with a query bar
- [ ] 8.2 Default to the active note's neighborhood when no query is entered
- [ ] 8.3 Implement neighbor expansion and open-note on double-click or modifier-click
- [ ] 8.4 Implement the selection details panel for nodes and edges
- [ ] 8.5 Verify the view and inline blocks render the same element identically

## 9. Documentation and sync

- [ ] 9.1 Update `lat.md/` sections to link source symbols and add test-spec sections with `@lat:` refs as code lands
- [ ] 9.2 Document the supported Cypher subset and the edge syntax for users
- [ ] 9.3 Run `lat check` and `openspec validate` and fix any failures
