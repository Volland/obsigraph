import type { Diagnostic, Sign } from '../edges/parse.js';
import type { TypeSchema } from '../schema/schema.js';

export const NODE_SHAPES = ['ellipse', 'rectangle', 'round-rectangle', 'diamond', 'hexagon', 'triangle', 'star'] as const;
export type NodeShape = (typeof NODE_SHAPES)[number];
export const LINE_STYLES = ['solid', 'dashed', 'dotted'] as const;
export type LineStyle = (typeof LINE_STYLES)[number];

export interface NodeStyle {
  color?: string;
  shape?: NodeShape;
  /** Icon name (Lucide in Obsidian). */
  icon?: string;
  /** Node property used as the display label instead of the title. */
  label?: string;
}

export interface EdgeStyle {
  color?: string;
  line?: LineStyle;
}

/** One level in the precedence order, e.g. a block header, a schema note or settings. */
export interface StyleSource {
  /** Human-readable origin shown in diagnostics and details, e.g. `schema Types/Person.md`. */
  name: string;
  /**
   * Precedence level. Adjacent sources sharing a level (one per schema note)
   * are searched together, so label order decides between them.
   */
  level?: string;
  nodes: Record<string, NodeStyle>;
  edges: Record<string, EdgeStyle>;
}

export type IconCheck = (name: string) => boolean;

const PALETTE = ['#4e79a7', '#f28e2b', '#59a14f', '#b07aa1', '#76b7b2', '#edc948', '#9c755f', '#e15759'];
export const DEFAULT_NODE_COLOR = '#8a8a8a';
export const DEFAULT_EDGE_COLOR = '#8a8a8a';
export const NEGATIVE_EDGE_COLOR = '#d94848';

/** Stable default color for a type label without a configured style. */
export function colorFor(label: string): string {
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

const NAMED = new Set(
  ('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue ' +
    'chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey ' +
    'darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray ' +
    'darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen ' +
    'fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
    'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen ' +
    'lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime ' +
    'limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue ' +
    'mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive ' +
    'olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum ' +
    'powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver ' +
    'skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white ' +
    'whitesmoke yellow yellowgreen').split(' '),
);

/** Accepts hex, rgb[a](), hsl[a]() and CSS named colors. */
export function isCssColor(s: string): boolean {
  const v = s.trim().toLowerCase();
  return (
    NAMED.has(v) ||
    /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(v) ||
    /^(rgb|hsl)a?\(\s*[\d.]+%?(\s*[,\s]\s*[\d.]+%?){2}(\s*[,/]\s*[\d.]+%?)?\s*\)$/.test(v)
  );
}

interface ReadCtx {
  source: string;
  path: string | null;
  subject: string;
  iconExists?: IconCheck;
  diagnostics: Diagnostic[];
}

function bad(ctx: ReadCtx, attr: string, value: unknown, expected: string): void {
  ctx.diagnostics.push({
    path: ctx.path,
    line: 0,
    column: 0,
    message: `Ignored ${attr} '${String(value)}' for ${ctx.subject} in ${ctx.source}: expected ${expected}`,
  });
}

/** Validate a raw node style; invalid attributes are dropped with a diagnostic. */
export function readNodeStyle(raw: unknown, ctx: ReadCtx): NodeStyle {
  const out: NodeStyle = {};
  if (!isRecord(raw)) {
    if (raw !== undefined && raw !== null) bad(ctx, 'style', raw, 'a mapping');
    return out;
  }
  if (raw.color !== undefined) {
    if (typeof raw.color === 'string' && isCssColor(raw.color)) out.color = raw.color.trim();
    else bad(ctx, 'color', raw.color, 'a CSS color');
  }
  if (raw.shape !== undefined) {
    if (typeof raw.shape === 'string' && (NODE_SHAPES as readonly string[]).includes(raw.shape)) out.shape = raw.shape as NodeShape;
    else bad(ctx, 'shape', raw.shape, NODE_SHAPES.join(', '));
  }
  if (raw.icon !== undefined) {
    if (typeof raw.icon === 'string' && raw.icon.trim() && (!ctx.iconExists || ctx.iconExists(raw.icon.trim()))) out.icon = raw.icon.trim();
    else bad(ctx, 'icon', raw.icon, 'a known icon name');
  }
  const label = raw.label ?? raw.labelProperty;
  if (label !== undefined) {
    if (typeof label === 'string' && label.trim()) out.label = label.trim();
    else bad(ctx, 'label', label, 'a property name');
  }
  return out;
}

/** Validate a raw edge style; invalid attributes are dropped with a diagnostic. */
export function readEdgeStyle(raw: unknown, ctx: ReadCtx): EdgeStyle {
  const out: EdgeStyle = {};
  if (!isRecord(raw)) {
    if (raw !== undefined && raw !== null) bad(ctx, 'style', raw, 'a mapping');
    return out;
  }
  if (raw.color !== undefined) {
    if (typeof raw.color === 'string' && isCssColor(raw.color)) out.color = raw.color.trim();
    else bad(ctx, 'color', raw.color, 'a CSS color');
  }
  const line = raw.line ?? raw.lineStyle;
  if (line !== undefined) {
    if (typeof line === 'string' && (LINE_STYLES as readonly string[]).includes(line)) out.line = line as LineStyle;
    else bad(ctx, 'line', line, LINE_STYLES.join(', '));
  }
  return out;
}

/** Build a source from maps of raw node and edge styles (settings or a block header). */
export function styleSource(
  name: string,
  path: string | null,
  rawNodes: Record<string, unknown>,
  rawEdges: Record<string, unknown>,
  iconExists?: IconCheck,
): { source: StyleSource; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const nodes: Record<string, NodeStyle> = {};
  const edges: Record<string, EdgeStyle> = {};
  for (const [type, raw] of Object.entries(rawNodes)) {
    nodes[type] = readNodeStyle(raw, { source: name, path, subject: `type ${type}`, iconExists, diagnostics });
  }
  for (const [type, raw] of Object.entries(rawEdges)) {
    edges[type] = readEdgeStyle(raw, { source: name, path, subject: `edge type ${type}`, iconExists, diagnostics });
  }
  return { source: { name, nodes, edges }, diagnostics };
}

/**
 * One source per schema note, in type-name order. A schema's `visualization`
 * block styles its own type; its `edges` map styles edge types.
 */
export function styleSourcesFromSchemas(
  schemas: Map<string, TypeSchema>,
  iconExists?: IconCheck,
): { sources: StyleSource[]; diagnostics: Diagnostic[] } {
  const sources: StyleSource[] = [];
  const diagnostics: Diagnostic[] = [];
  for (const schema of [...schemas.values()].sort((a, b) => a.type.localeCompare(b.type))) {
    if (!schema.style) continue;
    const { edges: rawEdges, ...nodeRaw } = schema.style;
    const r = styleSource(`schema ${schema.path}`, schema.path, { [schema.type]: nodeRaw }, isRecord(rawEdges) ? rawEdges : {}, iconExists);
    if (rawEdges !== undefined && !isRecord(rawEdges)) {
      r.diagnostics.push({ path: schema.path, line: 0, column: 0, message: `Ignored visualization.edges in schema ${schema.path}: expected a mapping` });
    }
    sources.push({ ...r.source, level: 'schema' });
    diagnostics.push(...r.diagnostics);
  }
  return { sources, diagnostics };
}

/** Split sources into precedence levels, keeping order; unlevelled sources stand alone. */
function levels(sources: StyleSource[]): StyleSource[][] {
  const out: StyleSource[][] = [];
  for (const s of sources) {
    const last = out[out.length - 1];
    if (last && s.level !== undefined && last[0]!.level === s.level) last.push(s);
    else out.push([s]);
  }
  return out;
}

export const BUILTIN = 'built-in default';

/** Built-in look for the derived code layer, below every configured source. */
const CODE_DEFAULTS: Record<string, { color: string; shape: NodeShape }> = {
  CodeFile: { color: '#64748b', shape: 'rectangle' },
  CodeSymbol: { color: '#0d9488', shape: 'round-rectangle' },
};

export interface ResolvedNodeStyle {
  color: string;
  shape: NodeShape;
  icon: string | null;
  label: string | null;
  origin: { color: string; shape: string; icon: string; label: string };
}

export interface ResolvedEdgeStyle {
  color: string;
  line: LineStyle;
  origin: { color: string; line: string };
}

/**
 * Resolve each attribute independently: precedence levels in order, and
 * within a level the node's labels in label order; first value wins.
 */
// @lat: [[visualization#Styling]]
export function resolveNodeStyle(labels: string[], sources: StyleSource[]): ResolvedNodeStyle {
  const pick = <K extends keyof NodeStyle>(attr: K): [NodeStyle[K], string] | null => {
    for (const level of levels(sources)) {
      for (const l of labels) {
        for (const s of level) {
          const v = s.nodes[l]?.[attr];
          if (v !== undefined) return [v, s.name];
        }
      }
    }
    return null;
  };
  const color = pick('color');
  const shape = pick('shape');
  const icon = pick('icon');
  const label = pick('label');
  return {
    color: color?.[0] ?? labels.map((l) => CODE_DEFAULTS[l]?.color).find(Boolean) ?? (labels[0] ? colorFor(labels[0]) : DEFAULT_NODE_COLOR),
    shape: shape?.[0] ?? labels.map((l) => CODE_DEFAULTS[l]?.shape).find(Boolean) ?? 'ellipse',
    icon: icon?.[0] ?? null,
    label: label?.[0] ?? null,
    origin: {
      color: color?.[1] ?? BUILTIN,
      shape: shape?.[1] ?? BUILTIN,
      icon: icon?.[1] ?? BUILTIN,
      label: label?.[1] ?? BUILTIN,
    },
  };
}

/** Negative edges default to a dashed red line unless a source sets the attribute. */
// @lat: [[visualization#Styling]]
export function resolveEdgeStyle(type: string, sign: Sign, sources: StyleSource[]): ResolvedEdgeStyle {
  const pick = <K extends keyof EdgeStyle>(attr: K): [EdgeStyle[K], string] | null => {
    for (const s of sources) {
      const v = s.edges[type]?.[attr];
      if (v !== undefined) return [v, s.name];
    }
    return null;
  };
  const color = pick('color');
  const line = pick('line');
  return {
    color: color?.[0] ?? (sign < 0 ? NEGATIVE_EDGE_COLOR : DEFAULT_EDGE_COLOR),
    line: line?.[0] ?? (sign < 0 ? 'dashed' : 'solid'),
    origin: { color: color?.[1] ?? BUILTIN, line: line?.[1] ?? BUILTIN },
  };
}

/** Display text for a node: the label property when set and present, else the title. */
export function nodeLabelText(props: Record<string, unknown>, fallback: string, labelProperty: string | null): string {
  if (labelProperty) {
    const v = props[labelProperty];
    if (typeof v === 'string' && v.trim()) return v;
    if (typeof v === 'number') return String(v);
  }
  return fallback;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
