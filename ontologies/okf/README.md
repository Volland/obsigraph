# OKF ontology

A data and knowledge catalog you can hand to an agent: tables, metrics, dashboards, glossary terms, runbooks and owners, with typed links between them. Open this folder as an Obsidian vault with the Typed Graph plugin, or copy `Types/` into your own vault.

- **Types:** `Table`, `Metric`, `Dashboard`, `Term`, `Runbook`, `Person`. Each has OKF's recommended `title`, `description`, `resource` and `tags`.
- **Edges:** `owned_by`, `derived_from`, `computed_from`, `defined_by`, `shown_in`, `covers`.
- **OKF:** the notes already have a `type` and a description, so `tg export out --format okf` writes a conformant Open Knowledge Format bundle and `tg okf check out` verifies it. Typed edges survive as prose in the export.

```
tg export bundle --format okf --vault .
tg okf check bundle
```

OKF is a Google Cloud specification and Typed Graph is not affiliated with Google. See the article "Getting your vault OKF-ready" on the website.
