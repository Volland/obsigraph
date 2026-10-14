import type { GraphElements } from '@obsigraph/graph-ui';
import { sizeSummary } from './pdf';

export interface ExportTheme {
  text: string;
  muted: string;
  background: string;
}

export interface HtmlExport {
  elements: GraphElements;
  /** Node positions in the panel, so the page shows the same layout without running one. */
  positions: Record<string, { x: number; y: number }>;
  theme: ExportTheme;
  scope: 'file' | 'project';
  omitted: number;
  limit: number;
  date: Date;
  /** The viewer bundle (`dist/viewer.js`), inlined into the page. */
  viewerScript: string;
}

/** Text safe inside an HTML element or attribute. */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** JSON that cannot close or open a script element, whatever a note title says. */
const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16)}`);

/** A color the page may use in a style attribute: hex or rgb() only, else a fallback. */
const color = (c: string, fallback: string) => (/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(c.trim()) ? c.trim() : fallback);

/**
 * One self-contained HTML page: the graph data, the viewer script and its styles all inline,
 * with a policy that allows no network access at all.
 */
// @tg: implements:: [[vscode#Graph export]] {since: "2026-10-14"}
// @lat: [[vscode#Graph export]]
// @tg: implements:: [[openspec:graph-export#Export the graph as standalone HTML]]
export function buildHtml(x: HtmlExport): string {
  const t = { text: color(x.theme.text, '#1f1f1f'), muted: color(x.theme.muted, '#6b6b6b'), background: color(x.theme.background, '#ffffff') };
  const summary = sizeSummary(x.elements.nodes.length, x.elements.edges.length, x);
  const data = { elements: x.elements, positions: x.positions, theme: t };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:">
<title>TypeGraph - ${esc(summary)}</title>
<style>
html,body{margin:0;height:100%;background:${t.background};color:${t.text};font:13px system-ui,sans-serif}
header{position:absolute;top:0;left:0;right:0;padding:10px 14px;z-index:2;pointer-events:none}
header b{font-size:15px}header span{color:${t.muted};margin-left:10px}
#graph{position:absolute;inset:0}
aside{position:absolute;top:44px;right:12px;width:300px;max-height:calc(100% - 64px);overflow:auto;z-index:2;background:${t.background};border:1px solid ${t.muted};border-radius:6px;padding:10px 12px;display:none}aside.open{display:block}
aside h2{margin:0 0 6px;font-size:14px}aside dt{color:${t.muted};font-size:11px;margin-top:6px}aside dd{margin:0;word-break:break-word}
</style>
</head>
<body>
<header><b>TypeGraph</b><span>${esc(summary)} - ${esc(x.date.toISOString().slice(0, 10))}</span></header>
<div id="graph"></div>
<aside id="details"></aside>
<script id="data" type="application/json">${safeJson(data)}</script>
<script>${x.viewerScript.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>
`;
}

/** Default file name for a save dialog: `typegraph-<scope>-<yyyy-mm-dd>.<ext>`. */
export function exportFileName(scope: 'file' | 'project', ext: 'html' | 'pdf', date: Date): string {
  return `typegraph-${scope === 'project' ? 'project' : 'file'}-${date.toISOString().slice(0, 10)}.${ext}`;
}
