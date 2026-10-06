import { markdownTarget, type Diagnostic } from '../edges/parse.js';
import { titleOf, type Graph } from '../graph/graph.js';
import { toYaml } from './frontmatter.js';

export type PropertyKind = 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'link' | 'list';
export const PROPERTY_KINDS: readonly PropertyKind[] = ['text', 'number', 'boolean', 'date', 'datetime', 'link', 'list'];

export interface PropertySchema {
  name: string;
  kind: PropertyKind;
  default: unknown;
  required: boolean;
  /** The value is a list; always true for kind `list`. */
  many: boolean;
  /** Allowed values (enum); null means any. */
  values: unknown[] | null;
  /** IRI or CURIE as written; null means base IRI plus name. */
  uri: string | null;
}

/** One allowed outgoing edge type of a node type. */
export interface EdgeRule {
  type: string;
  /** Allowed target types; null means any target. */
  targets: string[] | null;
  many: boolean;
  required: boolean;
}

export interface TypeSchema {
  type: string;
  /** Path of the schema note. */
  path: string;
  properties: PropertySchema[];
  /** Allowed outgoing edges; null means unrestricted. */
  edges: EdgeRule[] | null;
  /** Raw `visualization` block (alias `style`), interpreted by the visualization config. */
  style: Record<string, unknown> | null;
  uri: string | null;
  /** Template link as written (`[[...]]`, markdown link or path). */
  template: string | null;
  /** Declared under `schema:` (or implied by the note title), so the note body is the template. */
  bodyIsTemplate: boolean;
}

export interface EdgeTypeSchema {
  type: string;
  path: string;
  /** Allowed source types; null means any. */
  from: string[] | null;
  /** Allowed target types; null means any. */
  to: string[] | null;
  properties: PropertySchema[];
  uri: string | null;
  style: Record<string, unknown> | null;
}

/** Everything one schema note declares. */
export interface SchemaNote {
  path: string;
  types: TypeSchema[];
  edgeTypes: EdgeTypeSchema[];
  prefixes: Record<string, string>;
  diagnostics: Diagnostic[];
}

export interface SchemaSet {
  schemas: Map<string, TypeSchema>;
  edgeTypes: Map<string, EdgeTypeSchema>;
  /** Built-in prefixes plus those declared in schema notes. */
  prefixes: Record<string, string>;
  diagnostics: Diagnostic[];
}

export const DEFAULT_SCHEMA_FOLDER = 'Types/';
/** The Typed Graph Schema version this reader implements. */
export const TGS_VERSION = '0.1';
export const TGS_NAMESPACE = 'https://volland.github.io/obsigraph/ns/tgs#';
export const DEFAULT_BASE_IRI = 'urn:tgs:';
export const BUILTIN_PREFIXES: Readonly<Record<string, string>> = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  sh: 'http://www.w3.org/ns/shacl#',
  schema: 'https://schema.org/',
  foaf: 'http://xmlns.com/foaf/0.1/',
  tgs: TGS_NAMESPACE,
};
const IRI_SCHEMES = new Set(['http', 'https', 'urn', 'mailto', 'tag', 'did', 'file']);

const TYPE_KEYS = new Set(['properties', 'edges', 'visualization', 'style', 'uri', 'template']);
const EDGE_TYPE_KEYS = new Set(['from', 'to', 'properties', 'uri', 'visualization', 'style']);

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

type Diag = (message: string) => void;

/**
 * Read every declaration in a schema note: the type named by the title
 * (`schema:`), types under `schemas:`, edge types under `edgeTypes:` and
 * prefixes. A note with none of these keys declares an empty title type.
 */
// @lat: [[graph-model#Schema notes]]
export function readSchemaNote(path: string, frontmatter: Record<string, unknown> | null | undefined): SchemaNote {
  const fm = frontmatter ?? {};
  const out: SchemaNote = { path, types: [], edgeTypes: [], prefixes: {}, diagnostics: [] };
  const diag: Diag = (message) => out.diagnostics.push({ path, line: 0, column: 0, message });

  let strict = false;
  if (fm.tgs !== undefined) {
    const v = typeof fm.tgs === 'number' && Number.isInteger(fm.tgs) ? `${fm.tgs}.0` : String(fm.tgs);
    const m = /^(\d+)\.(\d+)$/.exec(v);
    if (!m) diag(`\`tgs\` must be a version such as "${TGS_VERSION}"`);
    else if (Number(m[1]) !== 0) {
      diag(`TGS version ${v} is not supported (this reader implements ${TGS_VERSION}); schema ignored`);
      return out;
    } else if (Number(m[2]) > 1) strict = true;
  }

  const has = (k: string) => fm[k] !== undefined;
  if (has('schema') || !(has('schemas') || has('edgeTypes') || has('prefixes'))) {
    const raw = fm.schema;
    if (raw !== undefined && raw !== null && !isRecord(raw)) diag('`schema` must be a mapping');
    out.types.push(readTypeBlock(titleOf(path), path, isRecord(raw) ? raw : {}, true, diag, strict));
  }
  if (has('schemas')) {
    if (!isRecord(fm.schemas)) diag('`schemas` must be a mapping from type name to schema');
    else
      for (const [name, raw] of Object.entries(fm.schemas)) {
        const d: Diag = (m) => diag(`Type '${name}': ${m}`);
        if (raw !== null && !isRecord(raw)) d('schema must be a mapping');
        out.types.push(readTypeBlock(name, path, isRecord(raw) ? raw : {}, false, d, strict));
      }
  }
  if (has('edgeTypes')) {
    if (!isRecord(fm.edgeTypes)) diag('`edgeTypes` must be a mapping from edge type name to declaration');
    else
      for (const [name, raw] of Object.entries(fm.edgeTypes)) {
        const d: Diag = (m) => diag(`Edge type '${name}': ${m}`);
        if (raw !== null && !isRecord(raw)) d('declaration must be a mapping');
        out.edgeTypes.push(readEdgeTypeBlock(name, path, isRecord(raw) ? raw : {}, d, strict));
      }
  }
  if (has('prefixes')) {
    if (!isRecord(fm.prefixes)) diag('`prefixes` must be a mapping from prefix to IRI');
    else
      for (const [p, iri] of Object.entries(fm.prefixes)) {
        if (typeof iri === 'string' && iri) out.prefixes[p] = iri;
        else diag(`Prefix '${p}' must map to an IRI`);
      }
  }
  return out;
}

/**
 * Read the schema of the type named by a note's title. Kept for callers
 * that only care about the single-type form; see {@link readSchemaNote}.
 */
export function readSchema(path: string, frontmatter: Record<string, unknown> | null | undefined): { schema: TypeSchema; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const raw = frontmatter?.schema;
  if (raw !== undefined && raw !== null && !isRecord(raw)) diagnostics.push({ path, line: 0, column: 0, message: '`schema` must be a mapping' });
  const schema = readTypeBlock(titleOf(path), path, isRecord(raw) ? raw : {}, true, (message) => diagnostics.push({ path, line: 0, column: 0, message }), false);
  return { schema, diagnostics };
}

function readTypeBlock(type: string, path: string, decl: Record<string, unknown>, bodyIsTemplate: boolean, diag: Diag, strict: boolean): TypeSchema {
  if (strict) for (const k of Object.keys(decl)) if (!TYPE_KEYS.has(k)) diag(`Unknown key '${k}' (newer TGS version?)`);
  // `visualization` is the documented key; `style` is accepted as an alias.
  const vis = decl.visualization ?? decl.style;
  if (vis !== undefined && !isRecord(vis)) diag('`visualization` must be a mapping');
  return {
    type,
    path,
    properties: readProperties(decl.properties, diag),
    edges: readEdges(decl.edges, diag),
    style: isRecord(vis) ? vis : null,
    uri: readString(decl.uri, '`uri`', diag),
    template: readString(decl.template, '`template`', diag),
    bodyIsTemplate,
  };
}

function readEdgeTypeBlock(type: string, path: string, decl: Record<string, unknown>, diag: Diag, strict: boolean): EdgeTypeSchema {
  if (strict) for (const k of Object.keys(decl)) if (!EDGE_TYPE_KEYS.has(k)) diag(`Unknown key '${k}' (newer TGS version?)`);
  const vis = decl.visualization ?? decl.style;
  if (vis !== undefined && !isRecord(vis)) diag('`visualization` must be a mapping');
  return {
    type,
    path,
    from: readNames(decl.from, '`from`', diag),
    to: readNames(decl.to, '`to`', diag),
    properties: readProperties(decl.properties, diag),
    uri: readString(decl.uri, '`uri`', diag),
    style: isRecord(vis) ? vis : null,
  };
}

function readProperties(props: unknown, diag: Diag): PropertySchema[] {
  const properties: PropertySchema[] = [];
  const add = (name: string, spec: unknown) => {
    const s = isRecord(spec) ? spec : { kind: spec ?? undefined };
    let kind = typeof s.kind === 'string' ? (s.kind.toLowerCase() as PropertyKind) : s.kind === undefined ? 'text' : (String(s.kind) as PropertyKind);
    if (!PROPERTY_KINDS.includes(kind)) {
      diag(`Property '${name}' has unknown kind '${String(s.kind)}'; treated as text`);
      kind = 'text';
    }
    if (properties.some((p) => p.name === name)) return;
    let values: unknown[] | null = null;
    if (Array.isArray(s.values)) values = s.values;
    else if (s.values !== undefined) diag(`Property '${name}': \`values\` must be a list`);
    properties.push({
      name,
      kind,
      default: s.default ?? null,
      required: s.required === true,
      many: kind === 'list' || s.many === true,
      values,
      uri: readString(s.uri, `Property '${name}': \`uri\``, diag),
    });
  };
  if (Array.isArray(props)) {
    for (const p of props) {
      if (typeof p === 'string') add(p, 'text');
      else if (isRecord(p) && typeof p.name === 'string') add(p.name, p);
      else diag('Each entry in `properties` needs a `name`');
    }
  } else if (isRecord(props)) {
    for (const [name, spec] of Object.entries(props)) add(name, spec);
  } else if (props !== undefined && props !== null) {
    diag('`properties` must be a mapping or a list');
  }
  return properties;
}

function readEdges(raw: unknown, diag: Diag): EdgeRule[] | null {
  if (raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) return raw.map((t) => ({ type: String(t), targets: null, many: true, required: false }));
  if (!isRecord(raw)) {
    diag('`edges` must be a list or a mapping of edge types');
    return null;
  }
  return Object.entries(raw).map(([type, v]) => {
    const d: Diag = (m) => diag(`Edge '${type}': ${m}`);
    if (isRecord(v)) return { type, targets: readNames(v.target, '`target`', d), many: v.many !== false, required: v.required === true };
    return { type, targets: readNames(v, 'target', d), many: true, required: false };
  });
}

function readNames(raw: unknown, what: string, diag: Diag): string[] | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw) && raw.every((x) => typeof x === 'string')) return raw as string[];
  diag(`${what} must be a type name or a list of type names`);
  return null;
}

function readString(raw: unknown, what: string, diag: Diag): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  diag(`${what} must be a non-empty string`);
  return null;
}

/**
 * Expand an IRI or CURIE. A known prefix wins over an IRI scheme of the same
 * name; `scheme://` and well-known schemes such as `urn:` are kept as written.
 */
export function expandIri(value: string, prefixes: Record<string, string>): { iri: string } | { error: string } {
  const m = /^([A-Za-z][\w.-]*):(.*)$/s.exec(value);
  if (!m) return { error: `'${value}' is not an IRI or CURIE` };
  const [, prefix, local] = m as unknown as [string, string, string];
  if (local.startsWith('//')) return { iri: value };
  if (Object.hasOwn(prefixes, prefix)) return { iri: prefixes[prefix] + local };
  if (IRI_SCHEMES.has(prefix.toLowerCase())) return { iri: value };
  return { error: `unknown prefix '${prefix}'` };
}

/** IRI of a declaration: its `uri` expanded, or the base IRI plus its encoded name. */
export function iriOf(decl: { uri: string | null }, name: string, base: string, prefixes: Record<string, string>): string {
  if (decl.uri) {
    const r = expandIri(decl.uri, prefixes);
    if ('iri' in r) return r.iri;
  }
  return base + encodeURIComponent(name);
}

/** Collect schemas from every note in the schema folder; the first declaration by path wins. */
export function schemasFromGraph(graph: Graph, folder: string): SchemaSet {
  const notes: SchemaNote[] = [];
  for (const n of graph.nodes()) {
    if (n.stub || !isSchemaPath(n.id, folder)) continue;
    notes.push(readSchemaNote(n.id, n.props));
  }
  return schemaSetFromNotes(notes);
}

/** Merge schema notes into one set, reporting duplicates and bad identifiers. */
export function schemaSetFromNotes(notes: SchemaNote[]): SchemaSet {
  const set: SchemaSet = { schemas: new Map(), edgeTypes: new Map(), prefixes: { ...BUILTIN_PREFIXES }, diagnostics: [] };
  const userPrefix = new Map<string, string>();
  const dup = (what: string, name: string, first: string, path: string) =>
    set.diagnostics.push({ path, line: 0, column: 0, message: `${what} '${name}' is declared in both ${first} and ${path}; using ${first}` });
  for (const note of [...notes].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    set.diagnostics.push(...note.diagnostics);
    for (const t of note.types) {
      const prev = set.schemas.get(t.type);
      if (prev) dup('Type', t.type, prev.path, note.path);
      else set.schemas.set(t.type, t);
    }
    for (const e of note.edgeTypes) {
      const prev = set.edgeTypes.get(e.type);
      if (prev) dup('Edge type', e.type, prev.path, note.path);
      else set.edgeTypes.set(e.type, e);
    }
    for (const [p, iri] of Object.entries(note.prefixes)) {
      const first = userPrefix.get(p);
      if (first !== undefined) {
        if (set.prefixes[p] !== iri) dup('Prefix', p, first, note.path);
        continue;
      }
      userPrefix.set(p, note.path);
      set.prefixes[p] = iri;
    }
  }
  const check = (uri: string | null, subject: string, path: string) => {
    if (!uri) return;
    const r = expandIri(uri, set.prefixes);
    if ('error' in r) set.diagnostics.push({ path, line: 0, column: 0, message: `${subject} has uri '${uri}': ${r.error}` });
  };
  for (const t of set.schemas.values()) {
    check(t.uri, `Type '${t.type}'`, t.path);
    for (const p of t.properties) check(p.uri, `Property '${p.name}' of type '${t.type}'`, t.path);
  }
  for (const e of set.edgeTypes.values()) {
    check(e.uri, `Edge type '${e.type}'`, e.path);
    for (const p of e.properties) check(p.uri, `Property '${p.name}' of edge type '${e.type}'`, e.path);
  }
  return set;
}

/** Names of the allowed edge types, or null when unrestricted. */
export function edgeNames(schema: { edges: EdgeRule[] | null }): string[] | null {
  return schema.edges ? schema.edges.map((r) => r.type) : null;
}

/**
 * Merge the schemas of a multi-label node in label order: the first
 * declaration of a property wins; allowed edges are the union of the rules
 * declared (targets unioned, any target if one rule allows any), or
 * unrestricted when no schema declares edges.
 */
export function mergeSchemas(labels: string[], schemas: Map<string, TypeSchema>): TypeSchema | null {
  const found = labels.map((l) => schemas.get(l)).filter((s): s is TypeSchema => !!s);
  if (found.length === 0) return null;
  const properties: PropertySchema[] = [];
  for (const s of found) for (const p of s.properties) if (!properties.some((q) => q.name === p.name)) properties.push(p);
  let edges: EdgeRule[] | null = null;
  for (const s of found) {
    if (!s.edges) continue;
    edges ??= [];
    for (const r of s.edges) {
      const prev = edges.find((e) => e.type === r.type);
      if (!prev) edges.push({ ...r, targets: r.targets && [...r.targets] });
      else {
        prev.targets = prev.targets && r.targets ? [...new Set([...prev.targets, ...r.targets])] : null;
        prev.many ||= r.many;
        prev.required ||= r.required;
      }
    }
  }
  const first = found[0]!;
  return { ...first, type: found.map((s) => s.type).join('+'), properties, edges };
}

const present = (v: unknown) => v !== undefined && v !== null && v !== '';
const inValues = (values: unknown[], x: unknown) => values.some((a) => a === x || String(a) === String(x));
const show = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

/**
 * Advisory validation: required and enum properties, list values, allowed,
 * required and single edges, edge endpoints and edge properties. Never
 * removes anything from the graph.
 */
// @lat: [[graph-model#Schema notes]]
export function validateSchemas(graph: Graph, set: SchemaSet): Diagnostic[] {
  const out: Diagnostic[] = [];
  if (set.schemas.size === 0 && set.edgeTypes.size === 0) return out;
  const at = (path: string, line: number, message: string) => out.push({ path, line, column: 0, message });
  for (const n of graph.nodes()) {
    if (n.stub) continue;
    const labels = n.labels.join(', ');
    const schema = mergeSchemas(n.labels, set.schemas);
    const outEdges = graph.outEdges(n.id);
    if (schema) {
      for (const p of schema.properties) {
        const v = n.props[p.name];
        if (!present(v)) {
          if (p.required) at(n.id, 0, `Missing required property '${p.name}' for type ${labels}`);
          continue;
        }
        if (!p.many && Array.isArray(v)) at(n.id, 0, `Property '${p.name}' holds a list but is not declared many for type ${labels}`);
        if (p.values) for (const x of Array.isArray(v) ? v : [v]) if (!inValues(p.values, x)) at(n.id, 0, `Property '${p.name}' value '${show(x)}' is not one of: ${p.values.map(show).join(', ')}`);
      }
      if (schema.edges) {
        const names = schema.edges.map((r) => r.type);
        for (const e of outEdges) {
          if (!names.includes(e.type)) at(n.id, e.line, `Edge type '${e.type}' is not allowed for ${labels} (allowed: ${names.join(', ') || 'none'})`);
        }
        for (const r of schema.edges) {
          const own = outEdges.filter((e) => e.type === r.type);
          if (r.required && own.length === 0) at(n.id, 0, `Missing required edge '${r.type}' for type ${labels}`);
          if (!r.many && own.length > 1) at(n.id, own[1]!.line, `Edge type '${r.type}' allows one edge for ${labels}, found ${own.length}`);
        }
      }
    }
    for (const e of outEdges) {
      const et = set.edgeTypes.get(e.type);
      const targets = schema?.edges?.find((r) => r.type === e.type)?.targets ?? et?.to ?? null;
      if (targets) {
        const t = graph.node(e.target);
        if (t && !t.stub && t.labels.length && !t.labels.some((l) => targets.includes(l))) {
          at(n.id, e.line, `Edge '${e.type}' expects target type ${targets.join(' or ')}, found ${t.labels.join(', ')}`);
        }
      }
      if (!et) continue;
      if (et.from && n.labels.length && !n.labels.some((l) => et.from!.includes(l))) {
        at(n.id, e.line, `Edge '${e.type}' expects source type ${et.from.join(' or ')}, found ${labels}`);
      }
      for (const p of et.properties) {
        const v = e.props[p.name];
        if (!present(v)) {
          if (p.required) at(n.id, e.line, `Missing required property '${p.name}' on edge '${e.type}'`);
          continue;
        }
        if (p.values) for (const x of Array.isArray(v) ? v : [v]) if (!inValues(p.values, x)) at(n.id, e.line, `Edge property '${p.name}' value '${show(x)}' is not one of: ${p.values.map(show).join(', ')}`);
      }
    }
  }
  return out;
}

/**
 * Resolve a `template` link to a vault path: a wikilink through `resolve`, a
 * markdown link relative to the schema note, otherwise a vault-relative path.
 */
export function templatePath(link: string, fromPath: string, resolve: (link: string, from: string) => string | null): string | null {
  const s = link.trim();
  const wiki = /^\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]$/.exec(s);
  if (wiki) return resolve(wiki[1]!.trim(), fromPath);
  const md = /^\[[^\]]*\]\(([^)]+)\)$/.exec(s);
  if (md) return markdownTarget(md[1]!, fromPath)?.target ?? null;
  const p = s.replace(/^\/+/, '');
  if (!p) return null;
  return /\.[^/]+$/.test(p) ? p : `${p}.md`;
}

/** Template body generated from a schema: a notes heading and one placeholder line per declared edge. */
export function generateTemplateBody(schema: TypeSchema): string {
  const lines = ['## Notes', ''];
  if (schema.edges?.length) lines.push('## Relations', '', ...schema.edges.map((r) => `- ${r.type}::`), '');
  return lines.join('\n');
}

/**
 * Pick the template body for a new note: the linked template note, else the
 * body of a `schema:` note, else one generated from the schema.
 */
export function chooseTemplate(schema: TypeSchema, sources: { linkedBody: string | null; schemaBody: string }): { body: string; generated: boolean } {
  if (sources.linkedBody !== null) return { body: sources.linkedBody, generated: false };
  if (schema.bodyIsTemplate && sources.schemaBody.trim()) return { body: sources.schemaBody, generated: false };
  return { body: generateTemplateBody(schema), generated: true };
}

/**
 * Content for a new note created from a type: `type`, defaults, then the
 * template body. With `placeholders`, every declared property gets a key.
 */
// @lat: [[graph-model#Schema notes]]
export function renderNoteFromType(schema: TypeSchema, templateBody: string, opts: { placeholders?: boolean } = {}): string {
  const fm: Record<string, unknown> = { type: schema.type };
  for (const p of schema.properties) {
    if (p.default !== null && p.default !== undefined) fm[p.name] = p.default;
    else if (opts.placeholders) fm[p.name] = p.many ? [] : null;
  }
  const body = templateBody.trim();
  return `---\n${toYaml(fm, { emptyNull: true })}\n---\n${body ? `\n${body}\n` : ''}`;
}

/** Scaffold for a new schema note. */
export function scaffoldSchemaNote(): string {
  return [
    '---',
    'schema:',
    '  properties:',
    '    status: {kind: text, default: active}',
    '  # edges: {knows: Person, worksAt: Company}',
    '---',
    '',
    '## Notes',
    '',
  ].join('\n');
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
