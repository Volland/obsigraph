import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BuiltinEngine, findEmbeds, Graph, pathResolver, resolveEmbed, schemasFromGraph, splitFrontmatter, validateSchemas, viewEmbed } from '@obsigraph/core';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { parseBlock } from '../src/query/block';
import { planRender } from '../src/query/plan';

const ROOT = join(__dirname, '../../../example');
const PLAYGROUND = 'Sandbox/Diagnostics playground.md';

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.name.startsWith('.') ? [] : e.isDirectory() ? markdownFiles(join(dir, e.name)) : e.name.endsWith('.md') ? [join(dir, e.name)] : [],
  );
}

const notes = markdownFiles(ROOT).map((f) => ({ path: relative(ROOT, f).split('\\').join('/'), text: readFileSync(f, 'utf8') }));

function loadGraph(): Graph {
  const graph = new Graph(pathResolver(() => notes.map((n) => n.path)));
  for (const n of notes) {
    const { yaml } = splitFrontmatter(n.text);
    graph.upsertNote({ path: n.path, text: n.text, frontmatter: yaml ? (parseYaml(yaml) as Record<string, unknown>) : null });
  }
  return graph;
}

/** `graph-query` blocks, honoring fence length so examples nested in ```` fences are skipped. */
function queryBlocks(text: string): { line: number; source: string }[] {
  const out: { line: number; source: string }[] = [];
  let open: { fence: string; lang: string; line: number; body: string[] } | null = null;
  text.split('\n').forEach((line, i) => {
    const m = /^(`{3,}|~{3,})\s*(\S*)\s*$/.exec(line);
    if (!open) {
      if (m) open = { fence: m[1]!, lang: m[2]!, line: i + 1, body: [] };
    } else if (m && m[2] === '' && m[1]![0] === open.fence[0] && m[1]!.length >= open.fence.length) {
      if (open.lang === 'graph-query') out.push({ line: open.line, source: open.body.join('\n') });
      open = null;
    } else open.body.push(line);
  });
  return out;
}

const blocks = notes.flatMap((n) => queryBlocks(n.text).map((b) => ({ ...b, path: n.path })));

describe('example vault', () => {
  const graph = loadGraph();
  const engine = new BuiltinEngine(graph);

  // @lat: [[tests/example-vault#Every guide query runs]]
  it.each(blocks.filter((b) => b.path !== PLAYGROUND).map((b) => [`${b.path}:${b.line}`, b] as const))('%s runs and returns rows', (_, b) => {
    const block = parseBlock(b.source);
    expect(block.errors).toEqual([]);
    expect(block.options.backend).not.toBe('ladybug');
    const result = engine.run(block.query);
    expect(result.rows.length).toBeGreaterThan(0);
    const plan = planRender(result, block.options, 500, (id) => graph.node(id));
    expect(plan).toBeTruthy();
  });

  // @lat: [[tests/example-vault#Playground queries fail clearly]]
  it('reports the playground queries as positioned or read-only errors', () => {
    const broken = blocks.filter((b) => b.path === PLAYGROUND);
    expect(broken).toHaveLength(2);
    const errors = broken.map((b) => {
      try {
        engine.run(parseBlock(b.source).query);
        return null;
      } catch (e) {
        return e as Error & { kind?: string };
      }
    });
    expect(errors.every((e) => e !== null)).toBe(true);
    expect(errors[1]!.message).toMatch(/read-only/i);
  });

  // @lat: [[tests/example-vault#Embeds resolve]]
  it('resolves every embed outside the playground, and leaves the playground miss unresolved', () => {
    for (const n of notes) {
      for (const occ of findEmbeds(n.text)) {
        expect(occ.embed, `${n.path}: ${occ.raw}`).not.toBeNull();
        const view = viewEmbed(occ.embed!, resolveEmbed(graph, occ.embed!, n.path));
        const missing = occ.raw.includes('-hates->');
        expect(view.kind === 'unresolved', `${n.path}: ${occ.raw}`).toBe(missing);
      }
    }
  });

  // @lat: [[tests/example-vault#Deliberate diagnostics only]]
  it('reports exactly the deliberate schema and syntax problems', () => {
    const issues = validateSchemas(graph, schemasFromGraph(graph, 'Types'));
    const where = issues.map((d) => d.path).sort();
    expect(where).toEqual(['People/Dave.md', 'People/Mallory.md']);
    expect(issues.map((d) => d.message).join('\n')).toMatch(/role[\s\S]*sells_to|sells_to[\s\S]*role/);
    expect(graph.diagnostics().map((d) => d.path)).toEqual([PLAYGROUND]);
    expect([...graph.nodes()].filter((n) => n.stub).map((n) => n.id).sort()).toEqual(['Eve', 'Globex', 'Property Graphs 101']);
  });
});
