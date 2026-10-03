import { beforeEach, describe, expect, it } from 'vitest';
import { BuiltinEngine, CypherError, Graph, NodeRef, RelRef, type QueryResult } from '../src/index.js';

let engine: BuiltinEngine;

beforeEach(() => {
  const notes: Record<string, { text: string; type?: string | string[]; age?: number }> = {
    'Alice.md': { type: 'Person', age: 31, text: 'knows:: [[Bob]] {since: 2020}\n-distrusts:: [[Eve]]\nknows:: [[Carol]] {since: 2018}' },
    'Bob.md': { type: ['Person', 'Employee'], age: 40, text: 'knows:: [[Carol]] {since: 2021}\nworks_at:: [[Acme]]' },
    'Carol.md': { type: 'Person', age: 25, text: 'likes:: [[Ghost]]' },
    'Eve.md': { type: 'Person', age: 35, text: '' },
    'Acme.md': { type: 'Company', text: '' },
  };
  const graph = new Graph((link) => (`${link}.md` in notes ? `${link}.md` : null));
  for (const [path, n] of Object.entries(notes)) {
    graph.upsertNote({ path, text: n.text, frontmatter: { type: n.type, ...(n.age ? { age: n.age } : {}) } });
  }
  engine = new BuiltinEngine(graph);
});

const run = (q: string, params?: Record<string, unknown>): QueryResult => engine.run(q, params);
const titles = (r: QueryResult, col = 0) =>
  r.rows.map((row) => {
    const v = row[col];
    return v instanceof NodeRef ? v.node.props.title : v;
  });
const fail = (q: string): CypherError => {
  try {
    run(q);
  } catch (e) {
    if (e instanceof CypherError) return e;
    throw e;
  }
  throw new Error(`expected query to fail: ${q}`);
};

describe('cypher subset', () => {
  // @lat: [[tests/cypher-query#Typed traversal with filter]]
  it('matches typed traversals filtered by relationship properties', () => {
    const r = run('MATCH (a:Person)-[r:knows]->(b) WHERE r.since > 2019 RETURN a, r, b');
    expect(r.rows).toHaveLength(2);
    const pairs = r.rows.map(([a, rel, b]) => [
      (a as NodeRef).node.props.title,
      (rel as RelRef).edge.props.since,
      (b as NodeRef).node.props.title,
    ]);
    expect(pairs.sort()).toEqual([
      ['Alice', 2020, 'Bob'],
      ['Bob', 2021, 'Carol'],
    ]);
  });

  // @lat: [[tests/cypher-query#Ordering and limit]]
  it('orders, skips and limits rows', () => {
    expect(titles(run('MATCH (n:Person) RETURN n ORDER BY n.title LIMIT 3'))).toEqual(['Alice', 'Bob', 'Carol']);
    expect(titles(run('MATCH (n:Person) RETURN n.title AS t ORDER BY n.age DESC SKIP 1 LIMIT 2'))).toEqual(['Eve', 'Alice']);
    expect(titles(run('MATCH (n) RETURN n.age AS age ORDER BY age'))).toEqual([25, 31, 35, 40, null, null]);
  });

  // @lat: [[tests/cypher-query#Sign and id are queryable]]
  it('exposes r.sign, r.id and n.stub', () => {
    const neg = run('MATCH (a)-[r]->(b) WHERE r.sign = -1 RETURN a.title, b.title, r.id');
    expect(neg.rows).toEqual([['Alice', 'Eve', 'Alice.md#distrusts#Eve.md#0']]);
    const stubs = run('MATCH (n) WHERE n.stub = true RETURN n.title');
    expect(stubs.rows).toEqual([['Ghost']]);
  });

  // @lat: [[tests/cypher-query#Write clauses rejected]]
  it('rejects every write clause as read-only', () => {
    for (const q of ['CREATE (n:Person)', 'MATCH (n) SET n.x = 1 RETURN n', 'MATCH (n) DELETE n', 'MERGE (n {a: 1})', 'MATCH (n) REMOVE n.x', 'MATCH (n) DETACH DELETE n']) {
      const e = fail(q);
      expect(e.kind, q).toBe('readonly');
      expect(e.message).toMatch(/read-only/);
    }
  });

  // @lat: [[tests/cypher-query#Unsupported syntax named]]
  it('names unsupported clauses and functions', () => {
    const cases: [string, RegExp][] = [
      ['UNWIND [1] AS x RETURN x', /UNWIND/],
      ['MATCH (n) RETURN n UNION MATCH (m) RETURN m', /UNION/],
      ['CALL db.labels()', /CALL/],
      ['MATCH (n) RETURN CASE WHEN true THEN 1 END', /CASE/],
      ['MATCH (n) RETURN stDev(n.age)', /stDev\(\)/],
      ['MATCH (n) RETURN foo(n)', /foo\(\)/],
      ['MATCH (n) WHERE n.title =~ "A.*" RETURN n', /=~/],
      ['MATCH p = shortestPath((a)-->(b)) RETURN p', /shortestPath/],
      ['RETURN [1, 2][0..1]', /List slicing/],
    ];
    for (const [q, re] of cases) {
      const e = fail(q);
      expect(e.kind, q).toBe('unsupported');
      expect(e.message).toMatch(re);
    }
  });

  // @lat: [[tests/cypher-query#Syntax errors have positions]]
  it('reports syntax errors with line and column', () => {
    const e = fail('MATCH (a RETURN a');
    expect(e.kind).toBe('syntax');
    expect(e.message).toMatch(/Expected '\)'/);
    expect([e.line, e.column]).toEqual([1, 10]);
    const multi = fail('MATCH (a)\nRETURN b');
    expect(multi.message).toMatch(/Variable `b` not defined/);
    expect([multi.line, multi.column]).toEqual([2, 8]);
  });

  // @lat: [[tests/cypher-query#Column kinds reported]]
  it('reports column kinds statically, even for empty results', () => {
    const r = run('MATCH (a)-[r:knows]->(b) WHERE a.title = "Nobody" RETURN a, r, r.since');
    expect(r.rows).toEqual([]);
    expect(r.columns).toEqual([
      { name: 'a', kind: 'node' },
      { name: 'r', kind: 'relationship' },
      { name: 'r.since', kind: 'scalar' },
    ]);
  });

  // @lat: [[tests/cypher-query#Stubs included by default]]
  it('includes stubs by default and lets queries exclude them', () => {
    expect(run('MATCH (n) RETURN n').rows).toHaveLength(6);
    expect(titles(run('MATCH (n) WHERE n.stub = false RETURN n ORDER BY n.title'))).toEqual(['Acme', 'Alice', 'Bob', 'Carol', 'Eve']);
  });

  // @lat: [[tests/cypher-query#Expression semantics]]
  it('evaluates expressions with openCypher null semantics', () => {
    const one = (q: string, params?: Record<string, unknown>) => run(q, params).rows[0]![0];
    expect(one('RETURN 1 + 2 * 3')).toBe(7);
    expect(one('RETURN null = null')).toBe(null);
    expect(one('RETURN null OR true')).toBe(true);
    expect(one('RETURN null AND false')).toBe(false);
    expect(one('RETURN 2 IN [1, null]')).toBe(null);
    expect(one("RETURN 'obsi' + 'graph' STARTS WITH 'obs'")).toBe(true);
    expect(one('RETURN toUpper($x)', { x: 'ok' })).toBe('OK');
    expect(one('RETURN coalesce(null, [1, 2][-1])')).toBe(2);
    expect(titles(run('MATCH (n) WHERE n:Employee RETURN n'))).toEqual(['Bob']);
    expect(titles(run('MATCH (n:Person {age: 25}) RETURN n'))).toEqual(['Carol']);
    expect(run('MATCH (a)-[:knows|likes]->(b) RETURN DISTINCT b.title AS t ORDER BY t').rows).toEqual([['Bob'], ['Carol'], ['Ghost']]);
  });

  // @lat: [[tests/cypher-query#Undirected and multi-pattern matches]]
  it('matches undirected relationships, shared variables and enforces relationship uniqueness', () => {
    const undirected = run('MATCH (a {title: "Carol"})-[:knows]-(b) RETURN b.title ORDER BY b.title');
    expect(undirected.rows).toEqual([['Alice'], ['Bob']]);
    const incoming = run('MATCH (a)<-[:knows]-(b) WHERE a.title = "Carol" RETURN b.title ORDER BY b.title');
    expect(incoming.rows).toEqual([['Alice'], ['Bob']]);
    const triangle = run('MATCH (a)-[:knows]->(b), (b)-[:knows]->(c), (a)-[:knows]->(c) RETURN a.title, b.title, c.title');
    expect(triangle.rows).toEqual([['Alice', 'Bob', 'Carol']]);
    const unique = run('MATCH (a)-[r1]-(b)-[r2]-(a) RETURN r1');
    expect(unique.rows).toEqual([]);
    expect(run('MATCH (a:Company) RETURN *').columns).toEqual([{ name: 'a', kind: 'node' }]);
  });
});
