import { describe, expect, it } from 'vitest';
import { BuiltinEngine, Graph, LatIndex, buildLatGraph, resolveNodeStyle, type CodeMode } from '../src/index.js';

// Built from parts so the real lat.md scanner does not read these fixtures as annotations.
const TG = '@' + 'tg:';

const AUTH = `// ${TG} implements:: [[auth#Login]] {since: 2}\nexport function login() {}\n\nexport function logout() {}\n\nexport class Session {\n  // ${TG} tests:: [[auth#Login]]\n  start() {}\n  stop() {}\n}\n`;

function lattice(extra = '') {
  return new LatIndex([
    { path: 'lat.md/lat.md', text: '# Lat\n\nIndex.\n' },
    { path: 'lat.md/auth.md', text: `# Auth\n\nHow login works.\n\n## Login\n\nCredentials are checked in [[src/auth.ts#login]].${extra}\n` },
  ]);
}

function graph(mode: CodeMode, files = [{ path: 'src/auth.ts', text: AUTH }]) {
  return buildLatGraph(lattice(), { code: { mode, files } });
}

const rows = (g: Graph, q: string) => new BuiltinEngine(g).run(q).rows;

describe('code layer', () => {
  // @lat: [[tests/code-layer#Derived code nodes#Annotated symbol]]
  it('builds a CodeSymbol with its typed edge to the section node', () => {
    const { graph: g } = graph('annotated');
    const sym = g.node('src/auth.ts#login')!;
    expect(sym.labels).toEqual(['CodeSymbol']);
    expect(sym.props).toMatchObject({ name: 'login', kind: 'function', path: 'src/auth.ts', lang: 'typescript', lines: '2-2' });
    const e = g.outEdges('src/auth.ts#login').find((x) => x.type === 'implements')!;
    expect(e).toMatchObject({ target: 'lat.md/auth#Auth#Login', sign: 1, props: { since: 2 } });
    expect(g.node('src/auth.ts')!.labels).toEqual(['CodeFile']);
  });

  // @lat: [[tests/code-layer#Code mode setting#Off]]
  it('creates no code nodes or annotation edges when off', () => {
    const { graph: g } = graph('off');
    expect([...g.nodes()].some((n) => n.labels.some((l) => l.startsWith('Code')))).toBe(false);
    expect([...g.edges()].some((e) => e.type === 'implements')).toBe(false);
  });

  // @lat: [[tests/code-layer#Code mode setting#Annotated only]]
  it('keeps only annotated symbols and their file in annotated mode, and everything in all mode', () => {
    const { graph: g } = graph('annotated');
    const symbols = [...g.nodes()].filter((n) => n.labels.includes('CodeSymbol')).map((n) => n.id).sort();
    expect(symbols).toEqual(['src/auth.ts#Session', 'src/auth.ts#Session#start', 'src/auth.ts#login']);
    expect(g.node('src/auth.ts#logout')).toBeUndefined();
    const all = graph('all').graph;
    expect(all.node('src/auth.ts#logout')).toBeDefined();
    expect(all.node('src/auth.ts#Session#stop')).toBeDefined();
    const contains = all.outEdges('src/auth.ts#Session').map((e) => e.target).sort();
    expect(contains).toEqual(['src/auth.ts#Session#start', 'src/auth.ts#Session#stop']);
  });

  // @lat: [[tests/code-layer#Queryable code nodes#Match code symbols]]
  it('matches code symbols and their relationships in Cypher', () => {
    const { graph: g } = graph('annotated');
    const r = rows(g, 'MATCH (c:CodeSymbol)-[r:implements]->(s) RETURN c.path, s.title');
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual(['src/auth.ts', 'Login']);
    const t = rows(g, 'MATCH (c:CodeSymbol)-[r:tests]->(s:Section) RETURN c.symbol, r.sign');
    expect(t).toEqual([['Session#start', 1]]);
  });

  // @lat: [[tests/code-layer#Link and node identity agree#Link from a note]]
  it('links a note to the code node instead of making a stub', () => {
    const { graph: g } = graph('annotated');
    const link = g.outEdges('lat.md/auth#Auth#Login').find((e) => e.type === 'references')!;
    expect(link.target).toBe('src/auth.ts#login');
    expect([...g.nodes()].some((n) => n.stub)).toBe(false);
    // The same holds for a typed edge written in a plain note when the graph has a subpath resolver.
    const plain = new Graph(
      (l) => (l === 'src/auth.ts' ? 'src/auth.ts' : null),
      (l, sub) => (g.node(`${l}#${sub}`) ? `${l}#${sub}` : null),
    );
    plain.upsertNote({ path: 'src/auth.ts#login', text: '', frontmatter: { type: 'CodeSymbol' } });
    plain.upsertNote({ path: 'Note.md', text: 'documents:: [[src/auth.ts#login]]' });
    expect(plain.outEdges('Note.md')[0]!.target).toBe('src/auth.ts#login');
  });

  // @lat: [[tests/code-layer#Visible on demand#Toggle on]]
  it('gives code nodes distinct built-in styles', () => {
    const file = resolveNodeStyle(['CodeFile'], []);
    const sym = resolveNodeStyle(['CodeSymbol'], []);
    const note = resolveNodeStyle(['Person'], []);
    expect(file.shape).toBe('rectangle');
    expect(sym.shape).toBe('round-rectangle');
    expect(new Set([file.color, sym.color, note.color]).size).toBe(3);
    expect(resolveNodeStyle(['CodeSymbol'], [{ name: 'settings', nodes: { CodeSymbol: { color: '#ff0000' } }, edges: {} }]).color).toBe('#ff0000');
  });
});
