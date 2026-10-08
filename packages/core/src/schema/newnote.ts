import type { Graph } from '../graph/graph.js';
import { dateParts, generateId, type IdRule, type RandomBytes } from './ids.js';
import { chooseTemplate, renderNoteFromType, templatePath, type SchemaSet, type TypeSchema } from './schema.js';

/** The note a new Luhmann-style note attaches to. */
export interface LuhmannParent {
  /** Vault-relative path of the parent note. */
  path: string;
  title: string;
  /** The type whose Luhmann id rule applies, and that rule's property. */
  type: string;
  property: string;
  id: string;
}

/** Every value of `property` among the notes of the graph, for uniqueness. */
export function collectIds(graph: Graph, property: string): Set<string> {
  const out = new Set<string>();
  for (const n of graph.nodes()) {
    if (n.stub) continue;
    const v = n.props[property];
    for (const x of Array.isArray(v) ? v : [v]) if (typeof x === 'string' || typeof x === 'number') out.add(String(x));
  }
  return out;
}

/** The first Luhmann rule of a type, if it has one. */
export function luhmannRule(schema: TypeSchema): IdRule | null {
  return schema.ids.find((r) => r.kind === 'luhmann') ?? null;
}

/** Types that have a Luhmann id rule, by name. */
export function luhmannTypes(set: SchemaSet): TypeSchema[] {
  return [...set.schemas.values()].filter((s) => luhmannRule(s)).sort((a, b) => a.type.localeCompare(b.type));
}

/**
 * The Luhmann id of the note at `path`, using the first of its types that has
 * a Luhmann rule and a value; null when the note has none.
 */
// @tg: implements:: [[openspec:typed-note-creation#Luhmann placement]]
export function findLuhmannParent(graph: Graph, set: SchemaSet, path: string): LuhmannParent | null {
  const node = graph.node(path);
  if (!node || node.stub) return null;
  for (const label of node.labels) {
    const schema = set.schemas.get(label);
    const rule = schema && luhmannRule(schema);
    const raw = rule ? node.props[rule.property] : undefined;
    if (schema && rule && (typeof raw === 'string' || typeof raw === 'number')) {
      return { path, title: String(node.props.title ?? path), type: schema.type, property: rule.property, id: String(raw) };
    }
  }
  return null;
}

const TOKEN = /\{\{\s*([a-z][\w-]*)\s*\}\}/gi;

/**
 * Replace `{{title}}`, `{{date}}`, `{{time}}`, `{{parent}}`, `{{parent-link}}`,
 * `{{id}}` and `{{<id property>}}` in a template body. Other `{{...}}` text,
 * such as edge embeds, is left alone, and a line that mentions a parent token
 * is dropped when there is no parent.
 */
// @tg: implements:: [[openspec:typed-note-creation#Template tokens]]
export function expandTokens(body: string, vars: Record<string, string>): string {
  const hasParent = vars.parent !== undefined;
  return body
    .split('\n')
    .filter((line) => hasParent || !/\{\{\s*parent(?:-link)?\s*\}\}/i.test(line))
    .map((line) => line.replace(TOKEN, (whole, name: string) => vars[name.toLowerCase()] ?? whole))
    .join('\n');
}

export interface NewNoteRequest {
  schema: TypeSchema;
  title: string;
  /** Body of the type's linked template note, or null when it has none or it is missing. */
  linkedBody: string | null;
  /** Body of the type's schema note. */
  schemaBody: string;
  graph: Graph;
  /** Attach a Luhmann id to this note as its child or sibling; other Luhmann rules are skipped unless `luhmann` is set. */
  parent?: LuhmannParent & { placement: 'child' | 'sibling' };
  /** Also generate the type's Luhmann id as a new top-level number. */
  luhmann?: boolean;
  now?: Date;
  random?: RandomBytes;
}

export interface NewNotePlan {
  /** File name without folder, ending in `.md`. */
  fileName: string;
  content: string;
  /** Generated ids by property. */
  ids: Record<string, string>;
}

/**
 * Plan a note created from a type: the template body with tokens filled in,
 * frontmatter with `type`, defaults and generated ids, and a file name that
 * carries an id when the rule says so. Pure; the host writes the file.
 */
// @lat: [[graph-model#Schema notes]]
// @tg: implements:: [[openspec:schema-notes#Create a note from a type]]
// @tg: implements:: [[openspec:typed-note-creation#File name carries the id]]
export function planNewNote(req: NewNoteRequest): NewNotePlan {
  const { schema, title } = req;
  const now = req.now ?? new Date();
  const ids: Record<string, string> = {};
  let filenameId: string | null = null;
  for (const rule of schema.ids) {
    const wanted = rule.auto || (rule.kind === 'luhmann' && (req.parent !== undefined || req.luhmann === true));
    if (!wanted) continue;
    const useParent = rule.kind === 'luhmann' && req.parent && req.parent.property === rule.property;
    ids[rule.property] = generateId(rule.kind, {
      now,
      existing: collectIds(req.graph, rule.property),
      random: req.random,
      parent: useParent ? { id: req.parent!.id, placement: req.parent!.placement } : undefined,
    });
    if (rule.filename && filenameId === null) filenameId = ids[rule.property]!;
  }
  const { body, generated } = chooseTemplate(schema, { linkedBody: req.linkedBody, schemaBody: req.schemaBody });
  const { date, time } = dateParts(now);
  const vars: Record<string, string> = { title, date, time, ...ids };
  const first = Object.values(ids)[0];
  if (first !== undefined) vars.id = first;
  if (req.parent) {
    vars.parent = req.parent.title;
    vars['parent-link'] = `[[${req.parent.title}]]`;
    vars['parent-id'] = req.parent.id;
  }
  const content = renderNoteFromType(schema, expandTokens(body, vars), { placeholders: generated, ids });
  return { fileName: `${filenameId ? `${filenameId} ` : ''}${title}.md`, content, ids };
}

/** The vault path of a type's linked template note, resolved the way the host resolves links. */
export function templateNotePath(schema: TypeSchema, resolve: (link: string, from: string) => string | null): string | null {
  return schema.template ? templatePath(schema.template, schema.path, resolve) : null;
}
