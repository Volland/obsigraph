import { beforeAll, describe, expect, it } from 'vitest';
import { BuiltinEngine, CypherError, Graph, NodeRef, PathRef, RelRef, type QueryResult } from '../src/index.js';

let graph: Graph;

beforeAll(() => {
  const notes: Record<string, [string, string]> = {
    'Alice.md': ['Person', 'knows:: [[Bob]]\nknows:: [[Carol]]\nknows:: [[Dave]]\nrated:: [[Movie]] {score: 4}'],
    'Bob.md': ['Person', 'knows:: [[Carol]]\nworksAt:: [[Acme]]\nrated:: [[Movie]] {score: 2}'],
    'Carol.md': ['Person', 'knows:: [[Alice]]\nrated:: [[Movie2]] {score: 3}'],
    'Dave.md': ['Person', ''],
    'Acme.md': ['Company', ''],
    'Movie.md': ['Film', ''],
    'Movie2.md': ['Film', ''],
  };
  graph = new Graph((l) => (`${l}.md` in notes ? `${l}.md` : null));
  for (const [path, [type, text]] of Object.entries(notes)) graph.upsertNote({ path, text, frontmatter: { type } });
});

const run = (q: string, maxPathDepth?: number): QueryResult => new BuiltinEngine(graph, () => ({ maxPathDepth })).run(q);
const plain = (r: QueryResult) =>
  r.rows.map((row) => row.map((v) => (v instanceof NodeRef ? v.node.props.title : v)));
const fail = (q: string): CypherError => {
  try {
    run(q);
  } catch (e) {
    if (e instanceof CypherError) return e;
    throw e;
  }
  throw new Error(`expected failure: ${q}`);
};

describe('cypher extensions', () => {
  // @lat: [[tests/cypher-extensions#Filter on aggregate]]
  // @tg: verifies:: [[openspec:cypher-extensions#WITH stages a query#Filter on aggregate]]
  it('stages with WITH and filters on an aggregate', () => {
    expect(plain(run('MATCH (a)-[:knows]->(b) WITH a, count(b) AS n WHERE n > 2 RETURN a, n'))).toEqual([['Alice', 3]]);
  });

  // @lat: [[tests/cypher-extensions#Out-of-scope variable]]
  // @tg: verifies:: [[openspec:cypher-extensions#WITH stages a query#Out-of-scope variable]]
  it('hides variables not carried by WITH', () => {
    const e = fail('MATCH (a)-->(b) WITH a RETURN b');
    expect(e.kind).toBe('syntax');
    expect(e.message).toBe('Variable `b` not defined');
    expect(fail('MATCH (a) WITH a.title RETURN a').message).toMatch(/must be aliased with AS/);
  });

  // @lat: [[tests/cypher-extensions#Order and limit inside WITH]]
  // @tg: verifies:: [[openspec:cypher-extensions#WITH stages a query#Ordering and limit inside WITH]]
  it('orders and limits inside WITH before further matching', () => {
    const r = run('MATCH (a:Person) WITH a ORDER BY a.title DESC LIMIT 2 MATCH (a)-[:knows]->(b) RETURN a.title, b.title');
    expect(r.rows).toEqual([['Carol', 'Alice']]);
  });

  // @lat: [[tests/cypher-extensions#Optional match yields null]]
  // @tg: verifies:: [[openspec:cypher-extensions#OPTIONAL MATCH#Missing relationship yields null]]
  it('keeps rows without an optional match, binding null', () => {
    const r = run('MATCH (p:Person) OPTIONAL MATCH (p)-[:worksAt]->(c) RETURN p.title, c.title ORDER BY p.title');
    expect(r.rows).toEqual([['Alice', null], ['Bob', 'Acme'], ['Carol', null], ['Dave', null]]);
  });

  // @lat: [[tests/cypher-extensions#Optional where keeps row]]
  // @tg: verifies:: [[openspec:cypher-extensions#OPTIONAL MATCH#Optional WHERE applies to the optional part]]
  it('applies WHERE to the optional part only', () => {
    const r = run("MATCH (p:Person) OPTIONAL MATCH (p)-[:knows]->(f) WHERE f.title = 'Zed' RETURN p.title, f ORDER BY p.title");
    expect(r.rows).toEqual([['Alice', null], ['Bob', null], ['Carol', null], ['Dave', null]]);
  });

  // @lat: [[tests/cypher-extensions#Bounded reachability]]
  // @tg: verifies:: [[openspec:cypher-extensions#Variable-length paths#Bounded reachability]]
  it('finds nodes reachable within a bounded number of hops', () => {
    const r = run('MATCH (a {title: "Alice"})-[:knows*1..3]->(b) RETURN DISTINCT b.title AS t ORDER BY t');
    expect(r.rows).toEqual([['Alice'], ['Bob'], ['Carol'], ['Dave']]);
    expect(run('MATCH (a {title: "Alice"})-[:knows*2]->(b) RETURN DISTINCT b.title AS t ORDER BY t').rows).toEqual([['Alice'], ['Carol']]);
    expect(run('MATCH (a {title: "Dave"})-[:knows*0..1]->(b) RETURN b.title').rows).toEqual([['Dave']]);
  });

  // @lat: [[tests/cypher-extensions#Cycles terminate]]
  // @tg: verifies:: [[openspec:cypher-extensions#Variable-length paths#Cycles terminate]]
  it('terminates on cycles and never repeats a relationship in a path', () => {
    const r = run('MATCH (a {title: "Alice"})-[rs:knows*]->(b) RETURN rs');
    expect(r.rows.length).toBeGreaterThan(0);
    for (const [rs] of r.rows) {
      const ids = (rs as RelRef[]).map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(r.notices).toBeUndefined();
  });

  // @lat: [[tests/cypher-extensions#Unbounded depth is capped]]
  // @tg: verifies:: [[openspec:cypher-extensions#Variable-length paths#Unbounded depth is capped]]
  it('stops unbounded expansion at the cap and says so', () => {
    const r = run('MATCH (a {title: "Alice"})-[:knows*]->(b) RETURN DISTINCT b.title', 1);
    expect(plain(r).flat().sort()).toEqual(['Bob', 'Carol', 'Dave']);
    expect(r.notices).toEqual(['Variable-length expansion stopped at the depth cap of 1; set an upper bound or raise the cap.']);
    expect(run('MATCH (a {title: "Alice"})-[:knows*1..1]->(b) RETURN b', 1).notices).toBeUndefined();
  });

  // @lat: [[tests/cypher-extensions#Path result]]
  // @tg: verifies:: [[openspec:cypher-query#Result shape#Path column]]
  it('binds path variables and reports a path column', () => {
    const r = run('MATCH p = (a {title: "Alice"})-[:knows*1..2]->(b) RETURN p, length(p) AS len ORDER BY len');
    expect(r.columns).toEqual([{ name: 'p', kind: 'path' }, { name: 'len', kind: 'scalar' }]);
    for (const [p, len] of r.rows) {
      const path = p as PathRef;
      expect(path.nodes.length).toBe(path.rels.length + 1);
      expect(path.rels.length).toBe(len);
      expect(path.nodes[0]!.node.props.title).toBe('Alice');
      path.rels.forEach((rel, i) => {
        expect(rel.edge.source).toBe(path.nodes[i]!.id);
        expect(rel.edge.target).toBe(path.nodes[i + 1]!.id);
      });
    }
    expect(r.rows.map(([, len]) => len)).toEqual([1, 1, 1, 2, 2]);
  });

  // @lat: [[tests/cypher-extensions#Count per group]]
  // @tg: verifies:: [[openspec:cypher-extensions#Aggregation functions#Count per group]]
  it('groups by non-aggregate items and counts', () => {
    const r = run('MATCH (a)-[r:knows]->() RETURN a.title, count(r) AS n ORDER BY n DESC, a.title');
    expect(r.rows).toEqual([['Alice', 3], ['Bob', 1], ['Carol', 1]]);
    expect(run('MATCH (a)-[:knows]->(b) RETURN count(*), count(DISTINCT b)').rows).toEqual([[5, 4]]);
  });

  // @lat: [[tests/cypher-extensions#Numeric aggregates]]
  // @tg: verifies:: [[openspec:cypher-extensions#Aggregation functions#Numeric aggregates on edge property]]
  it('computes avg, min, max and sum over an edge property', () => {
    expect(run('MATCH ()-[r:rated]->() RETURN avg(r.score), min(r.score), max(r.score), sum(r.score)').rows).toEqual([[3, 2, 4, 9]]);
  });

  // @lat: [[tests/cypher-extensions#Collect values]]
  // @tg: verifies:: [[openspec:cypher-extensions#Aggregation functions#Collect values]]
  it('collects values per group', () => {
    const r = run("MATCH (a)-[:knows]->(b) WHERE a.title = 'Alice' RETURN a.title, collect(b.title) AS friends");
    expect(r.rows.length).toBe(1);
    expect((r.rows[0]![1] as string[]).sort()).toEqual(['Bob', 'Carol', 'Dave']);
  });

  // @lat: [[tests/cypher-extensions#Empty input aggregates]]
  // @tg: verifies:: [[openspec:cypher-extensions#Aggregation functions#Empty input]]
  it('returns openCypher empty-input values without grouping keys', () => {
    const r = run('MATCH (a:Nobody) RETURN count(a), count(*), sum(a.x), avg(a.x), min(a.x), max(a.x), collect(a.x)');
    expect(r.rows).toEqual([[0, 0, 0, null, null, null, []]]);
    expect(run('MATCH (a:Nobody) RETURN a.title, count(a)').rows).toEqual([]);
  });

  // @lat: [[tests/cypher-extensions#Non-numeric sum]]
  // @tg: verifies:: [[openspec:cypher-extensions#Aggregation type errors#Non-numeric sum]]
  it('fails sum and avg on non-numeric values, naming the function', () => {
    const e = fail('MATCH (a:Person) RETURN sum(a.title)');
    expect(e.kind).toBe('runtime');
    expect(e.message).toBe('sum() requires numbers, got string');
    expect(fail('MATCH (a:Person) RETURN avg(a.title)').message).toMatch(/^avg\(\)/);
    expect(fail('MATCH (a) WHERE count(a) > 1 RETURN a').message).toMatch(/not allowed in WHERE/);
  });

  // @lat: [[tests/cypher-extensions#Aggregates are scalar columns]]
  it('reports aggregate and list columns as scalars', () => {
    const r = run('MATCH (a)-[r:knows]->(b) RETURN a, count(r) AS n, collect(b) AS bs');
    expect(r.columns.map((c) => c.kind)).toEqual(['node', 'scalar', 'scalar']);
  });

  // @lat: [[tests/cypher-extensions#Still unsupported or read-only]]
  // @tg: verifies:: [[openspec:cypher-extensions#Remaining unsupported syntax still fails clearly#Writes remain rejected]]
  it('keeps rejecting unsupported functions and writes after WITH', () => {
    expect(fail('MATCH (n) RETURN percentileCont(n.age, 0.5)').kind).toBe('unsupported');
    const w = fail('MATCH (n) WITH n SET n.x = 1 RETURN n');
    expect(w.kind).toBe('readonly');
    expect(fail('MATCH (n) WITH n CREATE (m) RETURN m').kind).toBe('readonly');
  });
});
