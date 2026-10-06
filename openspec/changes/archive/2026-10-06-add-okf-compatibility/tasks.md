## 1. Reading OKF

- [x] 1.1 Accept markdown link targets in edge lines with path normalization
- [x] 1.2 Add the `linkEdges` graph option producing `links_to` edges
- [x] 1.3 Wire `OBSIGRAPH_LINK_EDGES` into the sidecar

## 2. Export

- [x] 2.1 Implement `exportOkf` in core: link rewrite, frontmatter, reserved names, index files, change report
- [x] 2.2 Add `--format okf` and `--default-type` to `tg export`, verify with the OKF check

## 3. Check

- [x] 3.1 Implement `checkOkf` in core and the `tg okf check` command

## 4. Tests

- [x] 4.1 Write tests covering every scenario in the okf-compat, edge-parsing and graph-model deltas

## 5. Sync

- [x] 5.1 Document in lat.md, add test-spec sections and `@lat:` refs, website article, run `lat check` and `openspec validate`
