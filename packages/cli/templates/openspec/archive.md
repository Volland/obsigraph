## Traceability with tg

This project traces OpenSpec requirements to code with `tg` (see the `tg-trace` skill). Around the archive:

- Before archiving, run `tg trace <capabilities of this change> --gaps` and include the result in the summary. Unimplemented or unverified requirements are worth a warning and a confirmation, like incomplete tasks.
- Check the deltas for renamed requirements or scenarios (RENAMED, or a MODIFIED header that no longer matches): annotations still point at the old names. `tg edges --to "openspec:<capability>#<Old name>"` lists them; update them before or with the archive.
- After archiving, run `tg check`: every `openspec:` link must still resolve against the merged specs. Fix any it reports before finishing.
- If the archive created a new capability spec, make sure a lat.md file names it in its `openspec:` frontmatter, and replace the generated "TBD" Purpose.
