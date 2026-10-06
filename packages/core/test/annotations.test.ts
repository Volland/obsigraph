import { expect, it } from 'vitest';
import { checkAnnotationTarget, scanAnnotations, schemaIssues } from '../src/code.js';
import { LatIndex } from '../src/latmd.js';

// Built from parts so the real lat.md scanner does not read these fixtures as annotations.
const LAT = '@' + 'lat:';
const TG = '@' + 'tg:';

// @lat: [[tests/tg-annotations#lat annotations#Test reference]]
it('reads a lat annotation as a references edge from the next function', () => {
  const src = `import x from 'y';\n\n// ${LAT} [[tests#Login#Rejects expired tokens]]\nit('rejects expired tokens', () => {});\n`;
  const { annotations } = scanAnnotations('test/login.test.ts', src);
  expect(annotations).toHaveLength(1);
  expect(annotations[0]).toMatchObject({ kind: 'lat', line: 3, edges: [{ type: 'references', sign: 1, target: 'tests#Login#Rejects expired tokens' }] });
  const fn = scanAnnotations('test/login.test.ts', `// ${LAT} [[a#b]]\nexport function login() {}\n`).annotations[0]!;
  expect(fn.source).toMatchObject({ kind: 'symbol', name: 'login', symbolPath: 'login' });
});

// @lat: [[tests/tg-annotations#lat annotations#Python comment]]
it('reads hash comments in Python', () => {
  const { annotations } = scanAnnotations('t.py', `# ${LAT} [[tests#Login]]\ndef test_login():\n    pass\n`);
  expect(annotations[0]).toMatchObject({ kind: 'lat', source: { kind: 'symbol', name: 'test_login' } });
});

// @lat: [[tests/tg-annotations#tg annotations#Typed edge with properties]]
it('parses typed edges with properties', () => {
  const { annotations, diagnostics } = scanAnnotations('auth.ts', `// ${TG} implements:: [[auth#Login]] {since: 2}\nexport function login() {}\n`);
  expect(diagnostics).toEqual([]);
  expect(annotations[0]!.edges).toEqual([{ type: 'implements', sign: 1, target: 'auth#Login', props: { since: 2 } }]);
});

// @lat: [[tests/tg-annotations#tg annotations#Negative edge]]
it('reads a minus prefix as a negative edge', () => {
  const { annotations } = scanAnnotations('a.ts', `// ${TG} -contradicts:: [[design#Cache]]\nexport const cache = 1;\n`);
  expect(annotations[0]!.edges[0]).toMatchObject({ type: 'contradicts', sign: -1, target: 'design#Cache' });
});

// @lat: [[tests/tg-annotations#tg annotations#Several edges]]
it('produces one edge per comma-separated segment and treats a bare link as references', () => {
  const { annotations } = scanAnnotations('a.ts', `/* ${TG} implements:: [[a#X]] {n: 1, m: 2}, tests:: [[b#Y]] */\nexport class Thing {}\n`);
  expect(annotations[0]!.edges.map((e) => [e.type, e.target])).toEqual([['implements', 'a#X'], ['tests', 'b#Y']]);
  expect(annotations[0]!.edges[0]!.props).toEqual({ n: 1, m: 2 });
  const bare = scanAnnotations('a.ts', `// ${TG} [[a#X]]\nfunction f() {}\n`).annotations[0]!;
  expect(bare.edges[0]).toMatchObject({ type: 'references', target: 'a#X' });
});

// @lat: [[tests/tg-annotations#Edge source#Next declaration]]
it('attaches to a member declared within three lines, skipping a comment run', () => {
  const src = `class Api {\n  // ${TG} implements:: [[a#X]]\n  // more notes\n  /** doc */\n  handle() {}\n}\n`;
  const a = scanAnnotations('api.ts', src).annotations[0]!;
  expect(a.source).toMatchObject({ kind: 'symbol', name: 'handle', parent: 'Api', symbolPath: 'Api#handle' });
});

// @lat: [[tests/tg-annotations#Edge source#File fallback]]
it('falls back to the file with a warning when no declaration follows', () => {
  const src = `// ${TG} implements:: [[a#X]]\n\n\n\n\nexport function far() {}\n`;
  const { annotations, diagnostics } = scanAnnotations('a.ts', src);
  expect(annotations[0]!.source).toEqual({ kind: 'file' });
  expect(diagnostics[0]!.message).toContain('attached to the file');
});

// @lat: [[tests/tg-annotations#Annotation validation#Broken target]]
it('reports a target whose section was renamed, and advisory schema violations', () => {
  const index = new LatIndex([{ path: 'lat.md/auth.md', text: '# Auth\n\nx.\n\n## Sign in\n\ny.\n' }]);
  const ok = scanAnnotations('a.ts', `// ${LAT} [[auth#Sign in]]\nfunction f() {}\n`).annotations[0]!;
  expect(checkAnnotationTarget(index, ok.edges[0]!)).toBeNull();
  const renamed = scanAnnotations('a.ts', `// ${LAT} [[auth#Login]]\nfunction f() {}\n`).annotations[0]!;
  expect(checkAnnotationTarget(index, renamed.edges[0]!)).toMatchObject({ kind: 'broken', message: 'no matching section found' });
  const code = scanAnnotations('a.ts', `// ${TG} documents:: [[src/b.ts#helper]]\nfunction g() {}\n`).annotations[0]!;
  expect(checkAnnotationTarget(index, code.edges[0]!)).toMatchObject({ kind: 'code', file: 'src/b.ts', symbol: 'helper' });
  const typed = scanAnnotations('a.ts', `// ${TG} drops:: [[auth#Sign in]]\nfunction h() {}\n`).annotations[0]!;
  const rule = (type: string) => ({ type, targets: null, many: true, required: false });
  const schema = { type: 'CodeSymbol', path: 'Types/CodeSymbol.md', properties: [], edges: [rule('implements'), rule('tests')], style: null, uri: null, template: null, bodyIsTemplate: true };
  expect(schemaIssues(schema, typed)[0]).toContain("'drops' is not allowed");
  expect(schemaIssues(undefined, typed)).toEqual([]);
});
