export { compileIgnore } from './code/ignore.js';
export type { IgnoreRules } from './code/ignore.js';
export { maskCode } from './code/mask.js';
export { builtinProvider, langOfFile, lookupSymbol, providerFor, registerProvider, resetProviders, scanFile } from './code/symbols.js';
export type { CodeSymbol, Lang, LookupResult, ScanResult, SymbolKind, SymbolProvider } from './code/symbols.js';
export { ATTACH_WINDOW, checkAnnotationTarget, scanAnnotations, schemaIssues } from './code/annotations.js';
export type { Annotation, AnnotationEdge, AnnotationIssue, AnnotationScan, AnnotationSource } from './code/annotations.js';
export { buildCodeLayer, symbolKey, upsertCodeNode } from './code/layer.js';
export type { CodeLayer, CodeMode, CodeNode, CodeSource } from './code/layer.js';
