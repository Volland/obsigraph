// SHACL interop lives in its own entry point so hosts that never export or
// import shapes do not bundle the Turtle parser.
export { compact, exportShacl, stableJson } from './shacl/export.js';
export type { ShaclExportOptions } from './shacl/export.js';
export { importShacl } from './shacl/import.js';
export type { DroppedConstruct, ImportedEdgeType, ImportedType, ShaclImport, ShaclImportOptions } from './shacl/import.js';
export { compactEdgeType, compactType, emitYaml, planImport, replaceSchemaKeys } from './shacl/write.js';
export type { ExistingNote, ImportPlan, ImportPlanOptions, ImportWrite } from './shacl/write.js';
