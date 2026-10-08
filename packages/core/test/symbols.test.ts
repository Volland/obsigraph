import { afterEach, expect, it } from 'vitest';
import { compileIgnore, langOfFile, lookupSymbol, registerProvider, resetProviders, scanFile, type SymbolProvider } from '../src/code.js';

afterEach(() => resetProviders());

const names = (path: string, text: string) => scanFile(path, text)!.symbols.map((s) => (s.parent ? `${s.parent}#${s.name}` : s.name));

// @lat: [[tests/symbol-provider#Symbol discovery#Class method]]
// @tg: verifies:: [[openspec:symbol-provider#Symbol discovery#Class method]]
it('finds TypeScript classes with their methods and top-level declarations', () => {
  const ts = `
export class App {
  private x = 1;
  listen(port: number) { if (port) { return 1; } }
  static create(): App { return new App(); }
  handler = async (e: Event) => { return e; };
}
export async function main() {}
export const VERSION = '1.0';
const re = /[{]/g;
const s = "}{"; // }
export type Id = string;
export interface Opts { a: number }
`;
  expect(names('a.ts', ts)).toEqual(['App', 'App#listen', 'App#create', 'App#handler', 'main', 'VERSION', 're', 's', 'Id', 'Opts']);
  const app = scanFile('a.ts', ts)!.symbols[0]!;
  expect([app.startLine, app.endLine]).toEqual([2, 7]);
  expect(scanFile('a.ts', ts)!.reliable).toBe(true);
});

// @lat: [[tests/symbol-provider#Symbol discovery#Python function]]
// @tg: verifies:: [[openspec:symbol-provider#Symbol discovery#Python function]]
it('finds Python functions, classes and methods', () => {
  const py = `import os\n\nCONST = 3\n\ndef parse_args():\n    """doc with def fake():"""\n    return 1\n\nclass Greeter:\n    def greet(self):\n        def inner(): pass\n    async def wave(self): ...\n\nasync def go(): pass\n`;
  expect(names('a.py', py)).toEqual(['CONST', 'parse_args', 'Greeter', 'Greeter#greet', 'Greeter#wave', 'go']);
});

it('treats one-line bodies as partial so absence is not an error', () => {
  const r = scanFile('a.ts', 'class A { m() {} }\n')!;
  expect(r.reliable).toBe(false);
  expect(lookupSymbol('a.ts', 'class A { m() {} }\n', 'A#m').status).toBe('unresolvable');
});

it('finds Go, Rust and C symbols', () => {
  const go = `package a\nfunc Run() {}\nfunc (s *Server) Start(a int) error { return nil }\ntype Server struct { x int }\nconst (\n  A = 1\n  B = 2\n)\n`;
  expect(names('a.go', go)).toEqual(['Run', 'Server#Start', 'Server', 'A', 'B']);
  const rs = `pub struct Greeter { n: u8 }\nimpl Greeter {\n    pub fn greet(&self) -> &'static str { "hi" }\n}\nimpl<T> Show for Wrapper<T> {\n    fn show(&self) {}\n}\npub fn free<'a>(x: &'a str) {}\nfn weird() { let c = '{'; }\n`;
  expect(names('a.rs', rs)).toEqual(['Greeter', 'Greeter#greet', 'Wrapper#show', 'free', 'weird']);
  const c = `#define MAX 10\nstruct point {\n  int x;\n  int y;\n};\nenum Color {\n  RED,\n  GREEN = 2\n};\nstatic int add(int a, int b)\n{\n  return a + b;\n}\nint proto(void);\ntypedef unsigned long ulong;\n`;
  const cn = names('a.c', c);
  expect(cn).toEqual(expect.arrayContaining(['MAX', 'point', 'point#x', 'point#y', 'Color', 'RED', 'Color#RED', 'GREEN', 'add', 'ulong']));
  expect(cn).not.toContain('proto');
});

// @lat: [[tests/symbol-provider#Symbol discovery#Node ES-module sources]]
// @tg: verifies:: [[openspec:symbol-provider#Symbol discovery#Node ES-module sources]]
it('treats .mts and .cts as TypeScript and .mjs as JavaScript', () => {
  expect(langOfFile('src/main.mts')).toBe('typescript');
  expect(langOfFile('x.cts')).toBe('typescript');
  expect(langOfFile('x.mjs')).toBe('javascript');
  expect(names('main.mts', 'export function createApi() {}\n')).toEqual(['createApi']);
});

// @lat: [[tests/symbol-provider#Honest lookup#Absent symbol]]
// @tg: verifies:: [[openspec:symbol-provider#Honest lookup#Absent symbol]]
it('reports absent for a symbol missing from a cleanly scanned file', () => {
  expect(lookupSymbol('a.ts', 'export function here() {}\n', 'gone')).toEqual({ status: 'absent' });
  expect(lookupSymbol('a.ts', 'export function here() {}\n', 'here').status).toBe('found');
  expect(lookupSymbol('a.ts', 'class A {\n  m() {}\n}\n', 'A#m').status).toBe('found');
  expect(lookupSymbol('a.ts', 'class A {\n  m() {}\n}\n', 'm').status).toBe('absent');
  expect(lookupSymbol('a.ts', 'function a() { return `unterminated\n', 'gone')).toEqual({ status: 'unresolvable', reason: 'uncertain' });
});

// @lat: [[tests/symbol-provider#Honest lookup#Unsupported language]]
// @tg: verifies:: [[openspec:symbol-provider#Honest lookup#Unsupported language]]
it('reports unresolvable for an unsupported language or unreadable file', () => {
  expect(lookupSymbol('a.rb', 'def x; end', 'x')).toEqual({ status: 'unresolvable', reason: 'unsupported-language' });
  expect(lookupSymbol('a.ts', null, 'x')).toEqual({ status: 'unresolvable', reason: 'unreadable' });
});

// @lat: [[tests/symbol-provider#Source walker#Ignored folder]]
it('honors gitignore patterns', () => {
  const rules = compileIgnore('node_modules/\n*.log\n/build\n!keep.log\ndocs/**/tmp\n');
  expect(rules.test('node_modules', true)).toBe(true);
  expect(rules.test('node_modules', false)).toBeNull();
  expect(rules.test('a/b/x.log', false)).toBe(true);
  expect(rules.test('keep.log', false)).toBe(false);
  expect(rules.test('build', true)).toBe(true);
  expect(rules.test('src/build', true)).toBeNull();
  expect(rules.test('docs/a/b/tmp', true)).toBe(true);
});

// @lat: [[tests/symbol-provider#Replaceable provider#Registered provider]]
// @tg: verifies:: [[openspec:symbol-provider#Replaceable provider#Registered provider]]
it('uses a registered provider instead of the built-in finder', () => {
  const custom: SymbolProvider = { scan: () => ({ symbols: [{ name: 'fromCustom', kind: 'function', parent: null, startLine: 1, endLine: 1, signature: '' }], reliable: true }) };
  registerProvider('typescript', custom);
  expect(lookupSymbol('a.ts', 'function real() {}', 'fromCustom').status).toBe('found');
  expect(lookupSymbol('a.ts', 'function real() {}', 'real').status).toBe('absent');
});
