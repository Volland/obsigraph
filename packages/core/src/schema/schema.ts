import type { Diagnostic } from '../edges/parse.js';
import { titleOf, type Graph } from '../graph/graph.js';
import { toYaml } from './frontmatter.js';

export type PropertyKind = 'text' | 'number' | 'boolean' | 'date' | 'link';
const KINDS: PropertyKind[] = ['text', 'number', 'boolean', 'date', 'link'];

export interface PropertySchema {
  name: string;
  kind: PropertyKind;
  default: unknown;
  required: boolean;
}

export interface TypeSchema {
  type: string;
  /** Path of the schema note. */
  path: string;
  properties: PropertySchema[];
  /** Allowed outgoing edge types; null means unrestricted. */
  edges: string[] | null;
  /** Raw visualization block, interpreted by the visualization config. */
  style: Record<string, unknown> | null;
}

export const DEFAULT_SCHEMA_FOLDER = 'Types/';

export function normalizeFolder(folder: string): string {
  const f = folder.trim().replace(/^\/+/, '');
  return f === '' ? '' : f.endsWith('/') ? f : `${f}/`;
}

/** True when `path` is a markdown note directly inside the schema folder. */
export function isSchemaPath(path: string, folder: string): boolean {
  const f = normalizeFolder(folder);
  if (!f || !path.startsWith(f) || !path.endsWith('.md')) return false;
  return !path.slice(f.length).includes('/');
}

/**
 * Read a schema note. The type is the note title; the schema lives in
 * frontmatter under `schema:` with `properties`, `edges` and `style`.
 */
// @lat: [[graph-model#Schema notes]]
export function readSchema(path: string, frontmatter: Record<string, unknown> | null | undefined): { schema: TypeSchema; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const diag = (message: string) => diagnostics.push({ path, line: 0, column: 0, message });
  const raw = frontmatter?.schema;
  const decl = isRecord(raw) ? raw : {};
  if (raw !== undefined && !isRecord(raw)) diag('`schema` must be a mapping');

  const properties: PropertySchema[] = [];
  const addProp = (name: string, spec: unknown) => {
    const s = isRecord(spec) ? spec : { kind: spec };
    let kind = typeof s.kind === 'string' ? (s.kind.toLowerCase() as PropertyKind) : s.kind === undefined ? 'text' : (String(s.kind) as PropertyKind);
    if (!KINDS.includes(kind)) {
      diag(`Property '${name}' has unknown kind '${String(s.kind)}'; treated as text`);
      kind = 'text';
    }
    if (properties.some((p) => p.name === name)) return;
    properties.push({ name, kind, default: s.default ?? null, required: s.required === true });
  };
  const props = decl.properties;
  if (Array.isArray(props)) {
    for (const p of props) {
      if (typeof p === 'string') addProp(p, 'text');
      else if (isRecord(p) && typeof p.name === 'string') addProp(p.name, p);
      else diag('Each entry in `properties` needs a `name`');
    }
  } else if (isRecord(props)) {
    for (const [name, spec] of Object.entries(props)) addProp(name, spec);
  } else if (props !== undefined) {
    diag('`properties` must be a mapping or a list');
  }

  let edges: string[] | null = null;
  if (Array.isArray(decl.edges)) edges = decl.edges.map(String);
  else if (decl.edges !== undefined) diag('`edges` must be a list of edge types');

  const style = isRecord(decl.style) ? decl.style : null;
  return { schema: { type: titleOf(path), path, properties, edges, style }, diagnostics };
}

export interface SchemaSet {
  schemas: Map<string, TypeSchema>;
  diagnostics: Diagnostic[];
}

/** Collect schemas from every note in the schema folder. */
export function schemasFromGraph(graph: Graph, folder: string): SchemaSet {
  const schemas = new Map<string, TypeSchema>();
  const diagnostics: Diagnostic[] = [];
  for (const n of graph.nodes()) {
    if (n.stub || !isSchemaPath(n.id, folder)) continue;
    const r = readSchema(n.id, n.props);
    schemas.set(r.schema.type, r.schema);
    diagnostics.push(...r.diagnostics);
  }
  return { schemas, diagnostics };
}

/**
 * Merge the schemas of a multi-label node in label order: the first
 * declaration of a property wins; allowed edges are the union of the lists
 * declared, or unrestricted when no schema declares one.
 */
export function mergeSchemas(labels: string[], schemas: Map<string, TypeSchema>): TypeSchema | null {
  const found = labels.map((l) => schemas.get(l)).filter((s): s is TypeSchema => !!s);
  if (found.length === 0) return null;
  const properties: PropertySchema[] = [];
  for (const s of found) for (const p of s.properties) if (!properties.some((q) => q.name === p.name)) properties.push(p);
  const lists = found.map((s) => s.edges).filter((e): e is string[] => e !== null);
  const edges = lists.length === 0 ? null : [...new Set(lists.flat())];
  return { type: found.map((s) => s.type).join('+'), path: found[0]!.path, properties, edges, style: found[0]!.style };
}

/**
 * Advisory validation: missing required properties and disallowed edge types.
 * Never removes anything from the graph.
 */
// @lat: [[graph-model#Schema notes]]
export function validateSchemas(graph: Graph, set: SchemaSet): Diagnostic[] {
  const out: Diagnostic[] = [];
  if (set.schemas.size === 0) return out;
  for (const n of graph.nodes()) {
    if (n.stub) continue;
    const schema = mergeSchemas(n.labels, set.schemas);
    if (!schema) continue;
    for (const p of schema.properties) {
      const v = n.props[p.name];
      if (p.required && (v === undefined || v === null || v === '')) {
        out.push({ path: n.id, line: 0, column: 0, message: `Missing required property '${p.name}' for type ${n.labels.join(', ')}` });
      }
    }
    if (schema.edges) {
      for (const e of graph.outEdges(n.id)) {
        if (!schema.edges.includes(e.type)) {
          out.push({ path: n.id, line: e.line, column: 0, message: `Edge type '${e.type}' is not allowed for ${n.labels.join(', ')} (allowed: ${schema.edges.join(', ') || 'none'})` });
        }
      }
    }
  }
  return out;
}

/** Content for a new note created from a type: `type`, defaults, then the template body. */
// @lat: [[graph-model#Schema notes]]
export function renderNoteFromType(schema: TypeSchema, templateBody: string): string {
  const fm: Record<string, unknown> = { type: schema.type };
  for (const p of schema.properties) if (p.default !== null && p.default !== undefined) fm[p.name] = p.default;
  const body = templateBody.trim();
  return `---\n${toYaml(fm)}\n---\n${body ? `\n${body}\n` : ''}`;
}

/** Scaffold for a new schema note. */
export function scaffoldSchemaNote(): string {
  return [
    '---',
    'schema:',
    '  properties:',
    '    status: {kind: text, default: active}',
    '  # edges: [knows, worksAt]',
    '---',
    '',
    '## Notes',
    '',
  ].join('\n');
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
