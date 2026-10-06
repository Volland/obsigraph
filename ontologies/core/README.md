# Core ontology

The shared base for composing ontologies. It declares the edge types that more than one ontology uses, `contradicts` (with `why`, `until` and `ticket`) and `derived_from` (with an optional `transform`), so that putting several ontologies in one `Types/` folder never declares the same edge type twice.

Copy `Types/Core.md` next to any other ontology's `Types/` notes. Each ontology also works without it; it then loses the declared edge properties, not the edge.
