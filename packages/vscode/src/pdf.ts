/** What the PDF draws: the graph as the panel shows it, read from the renderer by the webview. */
export interface SceneNode {
  id: string;
  /** Center, in the renderer's model coordinates (y grows downward). */
  x: number;
  y: number;
  w: number;
  h: number;
  shape: string;
  color: string;
  label: string;
  stub: boolean;
}

export interface SceneEdge {
  source: string;
  target: string;
  color: string;
  line: string;
  negative: boolean;
  label: string;
}

export interface Scene {
  nodes: SceneNode[];
  edges: SceneEdge[];
}

export interface PdfMeta {
  scope: 'file' | 'project';
  /** Nodes the whole-project scope left out because of the limit. */
  omitted: number;
  limit: number;
  date: Date;
}

/** PDF 1.4 viewers accept pages up to 14400 units on a side. */
export const MAX_PAGE = 14400;
const MARGIN = 36;
const BAND = 52;
const LABEL_SIZE = 11;
const EDGE_LABEL_SIZE = 8;
/** Edge-type labels are left out of dense graphs, where they only clutter. */
const EDGE_LABEL_LIMIT = 400;

const scopeName = (scope: PdfMeta['scope']) => (scope === 'project' ? 'Whole project' : 'Active file');

/** The size line shown in the caption and stored in the Subject metadata. */
// @tg: implements:: [[openspec:graph-export#Export the graph as PDF]]
export function sizeSummary(nodes: number, edges: number, meta: Pick<PdfMeta, 'scope' | 'omitted' | 'limit'>): string {
  const base = `${scopeName(meta.scope)}: ${nodes} ${nodes === 1 ? 'node' : 'nodes'}, ${edges} ${edges === 1 ? 'edge' : 'edges'}`;
  return meta.omitted > 0 ? `${base}, ${meta.omitted} ${meta.omitted === 1 ? 'node' : 'nodes'} left out (limit ${meta.limit})` : base;
}

/**
 * A one-page vector PDF of the scene: filled paths for nodes, stroked paths with arrowheads for
 * edges, and Helvetica text for labels, so it stays sharp and its labels can be searched.
 * Written by hand (catalog, page, content stream, base-14 font, info, xref): no library, no browser.
 */
// @lat: [[vscode#Graph export]]
// @tg: implements:: [[openspec:graph-export#Export the graph as PDF]]
export function buildGraphPdf(scene: Scene, meta: PdfMeta): Buffer {
  const nodes = scene.nodes.filter((n) => [n.x, n.y, n.w, n.h].every(Number.isFinite));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = scene.edges.filter((e) => byId.has(e.source) && byId.has(e.target));

  const heading = `TypeGraph - ${scopeName(meta.scope)}`;
  const summary = sizeSummary(nodes.length, edges.length, meta);
  const caption = `${summary}  |  ${meta.date.toISOString().slice(0, 10)}`;

  // Bounding box of the drawing, labels included, in model coordinates.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const half = Math.max(n.w / 2, textWidth(clip(n.label), LABEL_SIZE) / 2);
    minX = Math.min(minX, n.x - half);
    maxX = Math.max(maxX, n.x + half);
    minY = Math.min(minY, n.y - n.h / 2);
    maxY = Math.max(maxY, n.y + n.h / 2 + 4 + LABEL_SIZE);
  }
  if (nodes.length === 0) [minX, maxX, minY, maxY] = [0, 0, 0, 0];
  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const captionW = Math.max(textWidth(heading, 14), textWidth(caption, 10));
  const pageW = Math.max(contentW, captionW) + 2 * MARGIN;
  const pageH = contentH + 2 * MARGIN + BAND;
  const scale = Math.min(1, MAX_PAGE / Math.max(pageW, pageH));
  const offsetX = (pageW - 2 * MARGIN - contentW) / 2;

  const X = (x: number) => MARGIN + offsetX + (x - minX);
  const Y = (y: number) => pageH - (MARGIN + BAND + (y - minY));

  const c: string[] = [`${num(scale)} 0 0 ${num(scale)} 0 0 cm`, '1 1 1 rg', `0 0 ${num(pageW)} ${num(pageH)} re f`];

  // Caption.
  c.push(text(heading, MARGIN, pageH - MARGIN - 6, 14, 'F2', '0 g'));
  c.push(text(caption, MARGIN, pageH - MARGIN - 24, 10, 'F1', '0.35 g'));

  // Edges first, so nodes sit on top of them.
  const pairs = new Map<string, SceneEdge[]>();
  for (const e of edges) {
    const key = e.source < e.target ? `${e.source}\u0000${e.target}` : `${e.target}\u0000${e.source}`;
    pairs.set(key, [...(pairs.get(key) ?? []), e]);
  }
  const labelEdges = edges.length <= EDGE_LABEL_LIMIT;
  for (const group of pairs.values()) {
    group.forEach((e, k) => {
      const s = byId.get(e.source)!;
      const t = byId.get(e.target)!;
      c.push(...edgeOps(e, s, t, (k - (group.length - 1) / 2) * 26, X, Y, labelEdges));
    });
  }

  for (const n of nodes) c.push(nodeOps(n, X(n.x), Y(n.y)));
  for (const n of nodes) {
    const label = clip(n.label);
    c.push(text(label, X(n.x) - textWidth(label, LABEL_SIZE) / 2, Y(n.y) - n.h / 2 - 4 - LABEL_SIZE * 0.8, LABEL_SIZE, 'F1', '0 g'));
  }

  const stream = c.join('\n');
  const info = `<< /Title ${str(heading)} /Subject ${str(summary)} /Creator ${str('TypeGraph for VS Code')} /Producer ${str('TypeGraph')} /CreationDate (${pdfDate(meta.date)}) >>`;
  const bodies = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(pageW * scale)} ${num(pageH * scale)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    info,
  ];
  let out = '%PDF-1.4\n%âãÏÓ\n';
  const offsets: number[] = [];
  bodies.forEach((b, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${b}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// --- drawing -------------------------------------------------------------------------------

function nodeOps(n: SceneNode, cx: number, cy: number): string {
  const [r, g, b] = rgb(n.color);
  const fill = n.stub ? mix([r, g, b], 0.18) : [r, g, b];
  const ops = [n.stub ? '[3 2] 0 d 0.7 w 0.5 G' : '[] 0 d 0.8 w 0.2 G', `${fill.map((v) => num(v / 255)).join(' ')} rg`, shapePath(n.shape, cx, cy, n.w / 2, n.h / 2), 'B'];
  return ops.join('\n');
}

function shapePath(shape: string, cx: number, cy: number, rx: number, ry: number): string {
  const poly = (pts: [number, number][]) => `${pts.map(([x, y], i) => `${num(x)} ${num(y)} ${i === 0 ? 'm' : 'l'}`).join(' ')} h`;
  switch (shape) {
    case 'rectangle':
      return `${num(cx - rx)} ${num(cy - ry)} ${num(rx * 2)} ${num(ry * 2)} re`;
    case 'round-rectangle': {
      const r = Math.min(4, rx, ry);
      const k = r * 0.4477;
      const [l, rr, bt, tp] = [cx - rx, cx + rx, cy - ry, cy + ry];
      return [
        `${num(l + r)} ${num(bt)} m`,
        `${num(rr - r)} ${num(bt)} l ${num(rr - k)} ${num(bt)} ${num(rr)} ${num(bt + k)} ${num(rr)} ${num(bt + r)} c`,
        `${num(rr)} ${num(tp - r)} l ${num(rr)} ${num(tp - k)} ${num(rr - k)} ${num(tp)} ${num(rr - r)} ${num(tp)} c`,
        `${num(l + r)} ${num(tp)} l ${num(l + k)} ${num(tp)} ${num(l)} ${num(tp - k)} ${num(l)} ${num(tp - r)} c`,
        `${num(l)} ${num(bt + r)} l ${num(l)} ${num(bt + k)} ${num(l + k)} ${num(bt)} ${num(l + r)} ${num(bt)} c h`,
      ].join(' ');
    }
    case 'diamond':
      return poly([[cx, cy + ry], [cx + rx, cy], [cx, cy - ry], [cx - rx, cy]]);
    case 'triangle':
      return poly([[cx, cy + ry], [cx + rx, cy - ry], [cx - rx, cy - ry]]);
    case 'hexagon':
      return poly([0, 1, 2, 3, 4, 5].map((i) => [cx + rx * Math.cos((Math.PI / 3) * i), cy + ry * Math.sin((Math.PI / 3) * i)] as [number, number]));
    case 'star':
      return poly(Array.from({ length: 10 }, (_, i) => {
        const f = i % 2 === 0 ? 1 : 0.45;
        const a = Math.PI / 2 + (Math.PI / 5) * i;
        return [cx + rx * f * Math.cos(a), cy + ry * f * Math.sin(a)] as [number, number];
      }));
    default: {
      const k = 0.5523;
      return [
        `${num(cx + rx)} ${num(cy)} m`,
        `${num(cx + rx)} ${num(cy + ry * k)} ${num(cx + rx * k)} ${num(cy + ry)} ${num(cx)} ${num(cy + ry)} c`,
        `${num(cx - rx * k)} ${num(cy + ry)} ${num(cx - rx)} ${num(cy + ry * k)} ${num(cx - rx)} ${num(cy)} c`,
        `${num(cx - rx)} ${num(cy - ry * k)} ${num(cx - rx * k)} ${num(cy - ry)} ${num(cx)} ${num(cy - ry)} c`,
        `${num(cx + rx * k)} ${num(cy - ry)} ${num(cx + rx)} ${num(cy - ry * k)} ${num(cx + rx)} ${num(cy)} c h`,
      ].join(' ');
    }
  }
}

function edgeOps(e: SceneEdge, s: SceneNode, t: SceneNode, bend: number, X: (x: number) => number, Y: (y: number) => number, withLabel: boolean): string[] {
  const [sx, sy, tx, ty] = [X(s.x), Y(s.y), X(t.x), Y(t.y)];
  const rs = Math.max(s.w, s.h) / 2;
  const rt = Math.max(t.w, t.h) / 2;
  const ops = [e.line === 'dashed' ? '[5 3] 0 d' : e.line === 'dotted' ? '[1.5 2.5] 0 d' : '[] 0 d', '1.2 w'];
  const [r, g, b] = rgb(e.color);
  const col = `${num(r / 255)} ${num(g / 255)} ${num(b / 255)}`;
  ops.push(`${col} RG ${col} rg`);

  let p0: [number, number];
  let p1: [number, number];
  let path: string;
  let mid: [number, number];
  let tangent: [number, number];
  if (s === t) {
    // A self-loop: a small circle above the node.
    const lr = rs * 0.9;
    const [lx, ly] = [sx, sy + rs + lr];
    ops.push(`${shapePath('ellipse', lx, ly, lr, lr)} S`);
    p1 = [sx + lr * 0.6, sy + rs + lr * 0.2];
    tangent = [-0.5, -1];
    mid = [lx, ly + lr];
    return [...ops, ...arrow(p1, tangent, e.negative, col), ...(withLabel ? [text(clip(e.label, 24), mid[0] - textWidth(clip(e.label, 24), EDGE_LABEL_SIZE) / 2, mid[1] + 3, EDGE_LABEL_SIZE, 'F1', '0.3 g')] : [])];
  }
  const [dx, dy] = [tx - sx, ty - sy];
  const len = Math.hypot(dx, dy) || 1;
  // Normal for a bend that is stable whichever way the edge points.
  const flip = s.id < t.id ? 1 : -1;
  const [nx, ny] = [(-dy / len) * flip, (dx / len) * flip];
  if (bend === 0) {
    const [ux, uy] = [dx / len, dy / len];
    p0 = [sx + ux * rs, sy + uy * rs];
    p1 = [tx - ux * rt, ty - uy * rt];
    path = `${num(p0[0])} ${num(p0[1])} m ${num(p1[0])} ${num(p1[1])} l S`;
    mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    tangent = [ux, uy];
  } else {
    const q: [number, number] = [(sx + tx) / 2 + nx * bend * 2, (sy + ty) / 2 + ny * bend * 2];
    const [ax, ay] = unit(q[0] - sx, q[1] - sy);
    const [bx, by] = unit(tx - q[0], ty - q[1]);
    p0 = [sx + ax * rs, sy + ay * rs];
    p1 = [tx - bx * rt, ty - by * rt];
    const c1: [number, number] = [p0[0] + ((q[0] - p0[0]) * 2) / 3, p0[1] + ((q[1] - p0[1]) * 2) / 3];
    const c2: [number, number] = [p1[0] + ((q[0] - p1[0]) * 2) / 3, p1[1] + ((q[1] - p1[1]) * 2) / 3];
    path = `${num(p0[0])} ${num(p0[1])} m ${num(c1[0])} ${num(c1[1])} ${num(c2[0])} ${num(c2[1])} ${num(p1[0])} ${num(p1[1])} c S`;
    mid = [0.25 * p0[0] + 0.5 * q[0] + 0.25 * p1[0], 0.25 * p0[1] + 0.5 * q[1] + 0.25 * p1[1]];
    tangent = [bx, by];
  }
  ops.push(path, '[] 0 d', ...arrow(p1, tangent, e.negative, col));
  if (withLabel && e.label) {
    const label = clip(e.label, 24);
    ops.push(text(label, mid[0] - textWidth(label, EDGE_LABEL_SIZE) / 2, mid[1] + 2, EDGE_LABEL_SIZE, 'F1', '0.3 g'));
  }
  return ops;
}

/** An arrowhead at `tip` pointing along `dir` (a triangle), or a tee for a negative edge. */
function arrow(tip: [number, number], dir: [number, number], tee: boolean, col: string): string[] {
  const [ux, uy] = unit(dir[0], dir[1]);
  const [px, py] = [-uy, ux];
  if (tee) {
    return ['[] 0 d', `${col} RG`, `${num(tip[0] + px * 5)} ${num(tip[1] + py * 5)} m ${num(tip[0] - px * 5)} ${num(tip[1] - py * 5)} l S`];
  }
  const base: [number, number] = [tip[0] - ux * 8, tip[1] - uy * 8];
  return [`${col} rg`, `${num(tip[0])} ${num(tip[1])} m ${num(base[0] + px * 3.5)} ${num(base[1] + py * 3.5)} l ${num(base[0] - px * 3.5)} ${num(base[1] - py * 3.5)} l h f`];
}

// --- text and numbers ----------------------------------------------------------------------

function text(s: string, x: number, y: number, size: number, font: 'F1' | 'F2', color: string): string {
  return `BT ${color} /${font} ${size} Tf ${num(x)} ${num(y)} Td ${str(s)} Tj ET`;
}

/** Helvetica averages about half an em per character; good enough for sizing the page. */
function textWidth(s: string, size: number): number {
  return s.length * size * 0.54;
}

function clip(s: string, max = 40): string {
  return s.length > max ? `${s.slice(0, max - 1)}...` : s;
}

/** A PDF string in WinAnsi: Latin-1 is kept, anything else is drawn as `?`. */
function str(s: string): string {
  let out = '(';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    const safe = code >= 32 && code <= 255 && !(code >= 127 && code <= 159) ? ch : '?';
    out += safe === '(' || safe === ')' || safe === '\\' ? `\\${safe}` : safe;
  }
  return `${out})`;
}

function pdfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

function num(n: number): string {
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : '0';
}

function unit(x: number, y: number): [number, number] {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

function rgb(color: string): [number, number, number] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return [136, 136, 136];
  const hex = m[1]!;
  const h = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mix([r, g, b]: [number, number, number], amount: number): number[] {
  return [r, g, b].map((v) => Math.round(v * amount + 255 * (1 - amount)));
}
