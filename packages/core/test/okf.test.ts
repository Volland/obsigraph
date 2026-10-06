import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { checkOkf, exportOkf, Graph, labelsOf, parseEdges, pathResolver, splitFrontmatter, type OkfNote } from '../src/index.js';

const note = (path: string, text: string): OkfNote => {
  const { yaml } = splitFrontmatter(text);
  let frontmatter: Record<string, unknown> | null = null;
  let frontmatterError: string | null = null;
  if (yaml !== null) {
    try {
      frontmatter = (parseYaml(yaml) as Record<string, unknown> | null) ?? null;
    } catch (e) {
      frontmatterError = (e as Error).message;
    }
  }
  return { path, text, frontmatter, frontmatterError };
};

const graphOf = (notes: OkfNote[], linkEdges = false): Graph => {
  const paths = notes.map((n) => n.path);
  const g = new Graph(pathResolver(() => paths), undefined, { linkEdges });
  for (const n of notes) g.upsertNote({ path: n.path, text: n.text, frontmatter: n.frontmatter });
  return g;
};

describe('reading OKF links', () => {
  // @lat: [[tests/okf-compat#Reading#Bundle-absolute link target]]
  it('accepts a bundle-absolute markdown link as an edge target', () => {
    const { edges } = parseEdges('knows:: [Bob](/people/bob.md) {since: 2020}\ncites:: [Paper](/papers/Typed%20Links.md#intro)', 'people/alice.md');
    expect(edges[0]).toMatchObject({ type: 'knows', target: 'people/bob.md', alias: 'Bob', props: { since: 2020 } });
    expect(edges[1]).toMatchObject({ target: 'papers/Typed Links.md', subpath: 'intro' });
  });

  // @lat: [[tests/okf-compat#Reading#Relative link target]]
  it('resolves relative links against the source folder and mixes link forms', () => {
    const { edges } = parseEdges('works_at:: [Acme](../orgs/acme.md), [[Initech]], [Peer](./carol.md)', 'people/alice.md');
    expect(edges.map((e) => e.target)).toEqual(['orgs/acme.md', 'Initech', 'people/carol.md']);
    expect(edges.every((e) => e.type === 'works_at')).toBe(true);
  });

  // @lat: [[tests/okf-compat#Reading#External URL ignored]]
  it('ignores URLs, anchors and non-note files in edge lines', () => {
    expect(parseEdges('cites:: [paper](https://example.com/paper)', 'a.md').edges).toEqual([]);
    expect(parseEdges('see:: [x](#heading)', 'a.md').edges).toEqual([]);
    expect(parseEdges('shows:: [img](/img/a.png)', 'a.md').edges).toEqual([]);
    expect(parseEdges('mail:: [me](mailto:a@b.c), [Bob](bob.md)', 'a.md').edges.map((e) => e.target)).toEqual(['bob.md']);
  });

  // @lat: [[tests/okf-compat#Reading#Link edges from prose]]
  it('turns prose links into links_to edges when link edges are on', () => {
    const g = graphOf(
      [
        note('tables/orders.md', '---\ntype: BigQuery Table\n---\nJoined with [customers](/tables/customers.md) on `customer_id`.\nAlso see [[Runbook]] and [later](./future.md).\n'),
        note('tables/customers.md', '---\ntype: BigQuery Table\n---\n# Customers\n'),
      ],
      true,
    );
    const out = g.outEdges('tables/orders.md');
    expect(out.map((e) => [e.type, e.sign, e.target])).toEqual([
      ['links_to', 1, 'tables/customers.md'],
      ['links_to', 1, 'Runbook'],
      ['links_to', 1, 'tables/future'],
    ]);
    expect(g.node('tables/future')?.stub).toBe(true);
    expect(g.node('tables/orders.md')?.labels).toEqual(['BigQuery Table']);
  });

  // @lat: [[tests/okf-compat#Reading#Link edges off by default]]
  it('produces no prose edges without the option', () => {
    const g = graphOf([note('a.md', 'See [b](/b.md) and [[b]].\n'), note('b.md', '# B\n')]);
    expect(g.size.edges).toBe(0);
  });

  // @lat: [[tests/okf-compat#Reading#Images are not edges]]
  it('never turns images or code spans into edges', () => {
    const { edges } = parseEdges('![a](/img/a.md) ![[a.png]] `[x](/x.md)` and `[[y]]`\n```\n[z](/z.md)\n```\n', 'n.md', { linkEdges: true });
    expect(edges).toEqual([]);
  });

  // @lat: [[tests/okf-compat#Reading#Frontmatter title kept]]
  it('uses a frontmatter title as the node title', () => {
    const g = graphOf([note('tables/events_.md', '---\ntype: BigQuery Table\ntitle: GA4 Events Export\n---\n'), note('b.md', '# B\n')]);
    expect(g.node('tables/events_.md')?.props.title).toBe('GA4 Events Export');
    expect(g.node('b.md')?.props.title).toBe('b');
  });

  // @lat: [[tests/okf-compat#Reading#Types list adds labels]]
  it('merges a types list into the labels', () => {
    expect(labelsOf({ type: 'Person', types: ['Person', 'Engineer'] })).toEqual(['Person', 'Engineer']);
  });
});

const vault = (): OkfNote[] => [
  note('People/Alice.md', '---\ntype: Person\nrole: lead\n---\nAlice is a researcher.\n\nknows:: [[Bob]] {since: 2020}\n-distrusts:: [[Eve Doe]]\n\nShe also reads [[Missing Note]] and [[Projects/index|the project list]].\n'),
  note('People/Bob.md', '---\ntype: [Person, Employee]\n---\n# Bob\n\nBob is an engineer.\n\nworks_at:: [[Acme]] {role: engineer}\n'),
  note('People/Eve Doe.md', 'Eve is an outsider.\n'),
  note('Acme.md', '---\ntitle: Acme Corp\n---\nA company.\n'),
  note('Projects/index.md', '# Projects\n\nAll projects.\n'),
];

const byPath = (files: { path: string; text: string }[], p: string): string => files.find((f) => f.path === p)?.text ?? '';

describe('OKF export', () => {
  // @lat: [[tests/okf-compat#Export#Typed edge kept as prose]]
  it('keeps typed edges as prose with markdown links', () => {
    const { files } = exportOkf(vault());
    const alice = byPath(files, 'People/Alice.md');
    expect(alice).toContain('knows:: [Bob](/People/Bob.md) {since: 2020}');
    expect(alice).toContain('-distrusts:: [Eve Doe](/People/Eve%20Doe.md)');
  });

  // @lat: [[tests/okf-compat#Export#Round trip]]
  it('reads back into the same typed graph', () => {
    const before = graphOf(vault());
    const { files } = exportOkf(vault());
    const after = graphOf(files.map((f) => note(f.path, f.text)));
    const typed = (g: Graph) =>
      [...g.edges()].map((e) => `${e.source.replace('Projects/index.md', 'Projects/index-note.md')} ${e.sign}${e.type} ${e.target} ${JSON.stringify(e.props)}`).sort();
    expect(typed(after)).toEqual(typed(before));
    expect(after.node('People/Bob.md')?.labels).toEqual(['Person', 'Employee']);
  });

  // @lat: [[tests/okf-compat#Export#Unresolved link kept]]
  it('keeps unresolved links as links to not-yet-written concepts', () => {
    const { files, report } = exportOkf(vault());
    expect(byPath(files, 'People/Alice.md')).toContain('[Missing Note](/Missing%20Note.md)');
    expect(report.find((r) => r.kind === 'broken-link')?.count).toBe(1);
  });

  // @lat: [[tests/okf-compat#Export#Missing type defaulted]]
  it('adds type, title and description without touching other keys', () => {
    const { files } = exportOkf(vault(), { defaultType: 'Concept' });
    expect(byPath(files, 'People/Eve Doe.md').startsWith('---\ntype: Concept\ntitle: Eve Doe\ndescription: Eve is an outsider.\n---\n\nEve is an outsider.')).toBe(true);
    expect(byPath(files, 'Acme.md')).toContain('type: Concept\ndescription: A company.\ntitle: Acme Corp\n---');
    expect(byPath(files, 'People/Alice.md')).toContain('title: Alice\ndescription: Alice is a researcher.\ntype: Person\nrole: lead');
  });

  // @lat: [[tests/okf-compat#Export#List type split]]
  it('splits a list type into type and types', () => {
    const bob = byPath(exportOkf(vault()).files, 'People/Bob.md');
    const fm = parseYaml(splitFrontmatter(bob).yaml!) as Record<string, unknown>;
    expect(fm.type).toBe('Person');
    expect(fm.types).toEqual(['Person', 'Employee']);
    expect(fm.title).toBe('Bob');
  });

  // @lat: [[tests/okf-compat#Export#Reserved note renamed]]
  it('renames reserved notes and rewrites links to them', () => {
    const { files } = exportOkf(vault());
    expect(byPath(files, 'Projects/index-note.md')).toContain('type: Note');
    expect(byPath(files, 'People/Alice.md')).toContain('[the project list](/Projects/index-note.md)');
  });

  // @lat: [[tests/okf-compat#Export#Index files generated]]
  it('generates an index.md per directory, frontmatter only at the root', () => {
    const { files } = exportOkf(vault(), { title: 'Lab' });
    const root = byPath(files, 'index.md');
    expect(root.startsWith('---\nokf_version: "0.2"\n---\n\n# Lab\n')).toBe(true);
    expect(root).toContain('* [Acme Corp](Acme.md) - A company.');
    expect(root).toContain('* [People](People/) - 3 concepts');
    const people = byPath(files, 'People/index.md');
    expect(people.startsWith('# People\n')).toBe(true);
    expect(people).toContain('* [Eve Doe](Eve%20Doe.md) - Eve is an outsider.');
    expect(checkOkf(files.map((f) => note(f.path, f.text))).filter((f) => f.severity === 'error')).toEqual([]);
  });
});

describe('OKF check', () => {
  // @lat: [[tests/okf-compat#Check#Conformant despite broken links]]
  it('treats broken links, wikilinks and missing descriptions as warnings', () => {
    const findings = checkOkf([note('a.md', '---\ntype: Metric\n---\nSee [b](/b.md) and [[c]].\n')]);
    expect(findings.filter((f) => f.severity === 'error')).toEqual([]);
    expect(findings.map((f) => f.kind).sort()).toEqual(['broken-link', 'missing-description', 'wikilink']);
  });

  // @lat: [[tests/okf-compat#Check#Missing type rejected]]
  it('rejects concepts without parseable frontmatter or a string type', () => {
    const kinds = checkOkf([
      note('none.md', '# No frontmatter\n'),
      note('bad.md', '---\ntype: [unclosed\n---\n'),
      note('untyped.md', '---\ntitle: X\ndescription: Y.\n---\n'),
      note('list.md', '---\ntype: [A, B]\ndescription: Y.\n---\n'),
    ])
      .filter((f) => f.severity === 'error')
      .map((f) => `${f.file} ${f.kind}`);
    expect(kinds).toEqual(['bad.md invalid-frontmatter', 'list.md type-not-string', 'none.md missing-frontmatter', 'untyped.md missing-type']);
  });

  // @lat: [[tests/okf-compat#Check#Index and log structure]]
  it('checks index frontmatter and log date headings', () => {
    const errors = checkOkf([
      note('index.md', '---\nokf_version: "0.2"\nowner: me\n---\n# Root\n'),
      note('sub/index.md', '---\nokf_version: "0.2"\n---\n# Sub\n'),
      note('log.md', '# Log\n\n## 2026-05-22\n* **Update**: x\n\n## May 15\n* y\n'),
    ]).filter((f) => f.severity === 'error');
    expect(errors.map((f) => `${f.file}:${f.line} ${f.kind}`)).toEqual(['index.md:1 index-frontmatter', 'log.md:6 log-date', 'sub/index.md:1 index-frontmatter']);
    expect(checkOkf([note('index.md', '---\nokf_version: "0.2"\n---\n# Root\n')])).toEqual([]);
  });
});
