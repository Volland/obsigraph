---
lat:
  require-code-mention: true
---
# TGS Specification Tests

Test specifications for the published Typed Graph Schema specification, its JSON Schema and its conformance examples. See [[shacl#Typed Graph Schema]].

## Conformance examples pass

Every example in `spec/tgs/examples` gives the expected declarations and diagnostics through the reader and validator, the expected SHACL where present, and the expected JSON Schema result per note.

## Spec examples validate

Every YAML example in `SPEC.md` and the schema scaffold validates against the JSON Schema and reads without diagnostics.

## Invalid notes rejected

Malformed declarations such as `edges: 5`, an unknown kind or an unknown key fail the JSON Schema.

## Namespace terms documented

Every `tgs:` term the SHACL export or import uses is listed in `namespace.json`, and no listed term is unused.
