## 1. Chunking

- [ ] 1.1 Implement heading-aware splitting with a size limit and word-boundary fallback
- [ ] 1.2 Build the context prefix from title, type labels and capped frontmatter
- [ ] 1.3 Attach path and heading provenance to each chunk
- [ ] 1.4 Derive deterministic chunk identifiers from path, heading, ordinal and text

## 2. Scoring

- [ ] 2.1 Implement best-chunk node score and pooled-vector mode

## 3. Verbalization

- [ ] 3.1 Implement the edge sentence renderer with verb, endpoint types, properties and negative sign
- [ ] 3.2 Attach edge identifier, path and heading to each sentence record

## 4. Tests

- [ ] 4.1 Write tests covering every scenario in the chunking-verbalization spec

## 5. Sync

- [ ] 5.1 Update lat.md/vector-search, add test-spec sections and `@lat:` refs, link verbalizer symbols from lat.md/architecture, run `lat check` and `openspec validate`
