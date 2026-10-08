import { describe, expect, it } from 'vitest';
import { chunkNote, cosine, Graph, nodeScore, poolVectors, verbalizeEdge, type NoteInput } from '../src/index.js';

const words = (n: number, w = 'lorem') => Array.from({ length: n }, (_, i) => `${w}${i}`).join(' ');

function graphOf(notes: (NoteInput & { type?: string })[]) {
  const paths = new Set(notes.map((n) => n.path));
  const g = new Graph((l) => [...paths].find((p) => p === `${l}.md` || p.endsWith(`/${l}.md`)) ?? null);
  for (const n of notes) g.upsertNote({ path: n.path, text: n.text, frontmatter: n.type ? { type: n.type } : null });
  return g;
}

describe('chunking', () => {
  // @lat: [[tests/chunking#One chunk per short section]]
  // @tg: verifies:: [[openspec:chunking-verbalization#Heading-aware chunking#Two sections]]
  it('produces one chunk per short section', () => {
    const chunks = chunkNote({ path: 'A.md', text: '## One\nfirst part\n## Two\nsecond part' });
    expect(chunks.map((c) => [c.heading, c.body])).toEqual([
      ['One', 'first part'],
      ['Two', 'second part'],
    ]);
  });

  // @lat: [[tests/chunking#Oversized section split on boundaries]]
  // @tg: verifies:: [[openspec:chunking-verbalization#Heading-aware chunking#Oversized section]]
  it('splits an oversized section within the limit without cutting words', () => {
    const text = `## Long\n${words(400)}`;
    const chunks = chunkNote({ path: 'A.md', text }, 600);
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(600);
      for (const w of c.body.split(' ')) expect(w).toMatch(/^lorem\d+$/);
    }
    expect(chunks.map((c) => c.body).join(' ')).toBe(words(400));
  });

  // @lat: [[tests/chunking#Context prefixed to every chunk]]
  // @tg: verifies:: [[openspec:chunking-verbalization#Context prepended to every chunk#Chunk carries context]]
  // @tg: verifies:: [[openspec:chunking-verbalization#Context prepended to every chunk#No frontmatter]]
  it('prefixes title, type and frontmatter to every chunk, or the title alone', () => {
    const chunks = chunkNote(
      { path: 'People/Alice.md', text: `---\ntype: Person\nrole: engineer\n---\n${words(60)}\n\n${words(60, 'ipsum')}\n\n${words(60, 'dolor')}`, frontmatter: { type: 'Person', role: 'engineer' }, labels: ['Person'] },
      700,
    );
    expect(chunks).toHaveLength(3);
    for (const c of chunks) expect(c.text.startsWith('Alice (Person)\nrole: engineer\n\n')).toBe(true);
    expect(chunkNote({ path: 'Plain.md', text: 'just text' })[0]!.text).toBe('Plain\n\njust text');
  });

  // @lat: [[tests/chunking#Chunk provenance recorded]]
  // @tg: verifies:: [[openspec:chunking-verbalization#Chunk provenance#Chunk under a heading]]
  // @tg: verifies:: [[openspec:chunking-verbalization#Chunk provenance#Text before any heading]]
  it('records note path and heading, or no heading before the first one', () => {
    const chunks = chunkNote({ path: 'People/Alice.md', text: 'intro text\n# Bio\n## Career\nworked at Acme' });
    expect(chunks.map((c) => [c.path, c.heading, c.headingPath])).toEqual([
      ['People/Alice.md', null, []],
      ['People/Alice.md', 'Career', ['Bio', 'Career']],
    ]);
  });

  // @lat: [[tests/chunking#Stable chunk ids]]
  // @tg: verifies:: [[openspec:chunking-verbalization#Deterministic chunk identity#Edited chunk]]
  // @tg: verifies:: [[openspec:chunking-verbalization#Deterministic chunk identity#Re-chunk unchanged note]]
  it('keeps chunk ids stable and changes only the edited chunk id', () => {
    const text = `## A\n${words(50)}\n## B\n${words(50, 'ipsum')}\n## C\n${words(50, 'dolor')}`;
    const a = chunkNote({ path: 'N.md', text });
    expect(chunkNote({ path: 'N.md', text })).toEqual(a);
    const b = chunkNote({ path: 'N.md', text: text.replace('ipsum3 ', 'IPSUM3 ') });
    expect(a.map((c, i) => c.id === b[i]!.id)).toEqual([true, false, true]);
    expect(new Set(a.map((c) => c.id)).size).toBe(3);
  });

  // @lat: [[tests/chunking#Node score best or pooled]]
  // @tg: verifies:: [[openspec:chunking-verbalization#Node score aggregation#Best chunk]]
  // @tg: verifies:: [[openspec:chunking-verbalization#Node score aggregation#Pooled]]
  it('scores a node by its best chunk or by the pooled vector', () => {
    const q = [1, 0];
    const c1 = [Math.cos(Math.acos(0.3)), Math.sin(Math.acos(0.3))];
    const c2 = [0.8, 0.6];
    expect(nodeScore(q, [c1, c2])).toBeCloseTo(0.8, 6);
    expect(nodeScore(q, [c1, c2], 'pooled')).toBeCloseTo(cosine(q, poolVectors([c1, c2])), 9);
    expect(nodeScore(q, [])).toBe(0);
  });

  // @lat: [[tests/chunking#Cosine refuses mixed dimensions]]
  // @tg: verifies:: [[openspec:vector-index#Mismatch blocks writes and offers rebuild#Dimension changed]]
  it('throws instead of returning NaN for vectors of different length', () => {
    expect(() => cosine([1, 0, 0], [1, 0])).toThrow(/different dimensions \(3 and 2\)/);
    expect(() => nodeScore([1, 0], [[1, 0, 0]])).toThrow(RangeError);
    expect(cosine([1, 0], [0.6, 0.8])).toBeCloseTo(0.6, 9);
  });
});

describe('edge verbalization', () => {
  const g = graphOf([
    { path: 'Alice.md', type: 'Person', text: 'knows:: [[Bob]] {since: 2020, label: "met at conf", id: "a-b"}\nworks_at:: [[Acme]]\n-trusts:: [[Eve]]\n## Colleagues\nhelps:: [[Plain]]' },
    { path: 'Bob.md', type: 'Person', text: '' },
    { path: 'Acme.md', type: 'Company', text: '' },
    { path: 'Eve.md', type: 'Person', text: '' },
    { path: 'Plain.md', text: '' },
  ]);
  const say = (type: string) => verbalizeEdge(g.outEdges('Alice.md').find((e) => e.type === type)!, g);

  // @lat: [[tests/chunking#Edge sentence with properties]]
  // @tg: verifies:: [[openspec:chunking-verbalization#Edge verbalization#Edge with properties]]
  it('renders type, endpoints and properties, with label bare and id omitted', () => {
    expect(say('knows').text).toBe('Alice (Person) knows Bob (Person) - since 2020, met at conf');
  });

  // @lat: [[tests/chunking#Edge sentence without properties]]
  // @tg: verifies:: [[openspec:chunking-verbalization#Edge verbalization#Edge without properties]]
  it('turns the type name into a verb when there are no properties', () => {
    expect(say('works_at').text).toBe('Alice (Person) works at Acme (Company)');
  });

  // @lat: [[tests/chunking#Untyped endpoint has no parentheses]]
  // @tg: verifies:: [[openspec:chunking-verbalization#Edge verbalization#Untyped endpoint]]
  it('omits parentheses for an untyped endpoint', () => {
    expect(say('helps').text).toBe('Alice (Person) helps Plain');
  });

  // @lat: [[tests/chunking#Negative edges say so]]
  // @tg: verifies:: [[openspec:chunking-verbalization#Negative edges are verbalized as negative#Negative edge]]
  it('marks negative edges as negative', () => {
    expect(say('trusts').text).toBe('Alice (Person) trusts (negative) Eve (Person)');
  });

  // @lat: [[tests/chunking#Edge sentence provenance]]
  // @tg: verifies:: [[openspec:chunking-verbalization#Edge sentence provenance#Edge under a heading]]
  it('records edge id, source path and heading', () => {
    expect(say('helps')).toMatchObject({ edgeId: 'Alice.md#helps#Plain.md#0', path: 'Alice.md', heading: 'Colleagues' });
    expect(say('knows').edgeId).toBe('a-b');
  });
});
