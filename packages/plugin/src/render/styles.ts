export type NodeShape = 'ellipse' | 'rectangle' | 'round-rectangle' | 'diamond' | 'hexagon' | 'triangle' | 'star';

export interface TypeStyle {
  color?: string;
  shape?: NodeShape;
}

export type TypeStyles = Record<string, TypeStyle>;

export interface Theme {
  text: string;
  muted: string;
  background: string;
}

export interface StyleRule {
  selector: string;
  style: Record<string, string | number>;
}

const PALETTE = ['#4e79a7', '#f28e2b', '#59a14f', '#b07aa1', '#76b7b2', '#edc948', '#9c755f', '#e15759'];

/** Stable default color for a type label without a configured style. */
export function colorFor(label: string): string {
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

/** CSS-class-safe name for a type label. */
export function typeClass(label: string): string {
  return `t-${label.replace(/[^\p{L}\p{N}_-]/gu, '_')}`;
}

/**
 * Build the Cytoscape style sheet. Negative edges are dashed and red, positive
 * edges solid; both always carry their type as a text label.
 */
// @lat: [[visualization#Styling]]
export function buildStylesheet(styles: TypeStyles, labelsInUse: Iterable<string>, theme: Theme): StyleRule[] {
  const rules: StyleRule[] = [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        color: theme.text,
        'font-size': 11,
        'text-valign': 'bottom',
        'text-margin-y': 4,
        'background-color': theme.muted,
        width: 22,
        height: 22,
      },
    },
    {
      selector: 'edge',
      style: {
        label: 'data(type)',
        'font-size': 9,
        color: theme.text,
        'text-rotation': 'autorotate',
        'text-background-opacity': 0.7,
        'text-background-color': theme.background,
        'text-background-padding': 1,
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        width: 1.5,
        'line-color': '#8a8a8a',
        'target-arrow-color': '#8a8a8a',
      },
    },
    { selector: 'edge.negative', style: { 'line-style': 'dashed', 'line-color': '#d94848', 'target-arrow-color': '#d94848', 'target-arrow-shape': 'tee' } },
    { selector: 'node.stub', style: { 'background-opacity': 0.15, 'border-width': 1.5, 'border-style': 'dashed', 'border-color': theme.muted, shape: 'ellipse' } },
    { selector: ':selected', style: { 'overlay-opacity': 0.15, 'overlay-color': '#4e79a7' } },
  ];
  const seen = new Set<string>();
  for (const label of [...labelsInUse, ...Object.keys(styles)]) {
    if (seen.has(label)) continue;
    seen.add(label);
    const s = styles[label] ?? {};
    rules.push({
      selector: `node.${typeClass(label)}`,
      style: { 'background-color': s.color ?? colorFor(label), ...(s.shape ? { shape: s.shape } : {}) },
    });
  }
  // Stub styling must win over type colors.
  rules.push({ selector: 'node.stub', style: { 'background-opacity': 0.15 } });
  return rules;
}

/** Classes for a node: one per type label, plus `stub`. */
export function nodeClasses(labels: string[], stub: boolean): string[] {
  return [...labels.map(typeClass), ...(stub ? ['stub'] : [])];
}

const SHAPES: NodeShape[] = ['ellipse', 'rectangle', 'round-rectangle', 'diamond', 'hexagon', 'triangle', 'star'];

/** Validate user-entered type styles; returns an error message or the parsed styles. */
export function parseTypeStyles(json: string): TypeStyles | string {
  let raw: unknown;
  try {
    raw = JSON.parse(json || '{}');
  } catch (e) {
    return `Invalid JSON: ${(e as Error).message}`;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'Expected an object keyed by type label';
  const out: TypeStyles = {};
  for (const [label, v] of Object.entries(raw)) {
    if (typeof v !== 'object' || v === null) return `Style for '${label}' must be an object`;
    const { color, shape } = v as Record<string, unknown>;
    if (color !== undefined && typeof color !== 'string') return `color for '${label}' must be a string`;
    if (shape !== undefined && !SHAPES.includes(shape as NodeShape)) return `shape for '${label}' must be one of ${SHAPES.join(', ')}`;
    out[label] = { ...(color ? { color } : {}), ...(shape ? { shape: shape as NodeShape } : {}) };
  }
  return out;
}
