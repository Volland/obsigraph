import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convert, load } from '@asciidoctor/core';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import { parseAsciidoc, scanLines } from '../src/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/asciidoc-book');
const FILES = ['book.adoc', 'chapters/ch01.adoc', 'chapters/ch02.adoc'];
// A book pulls its chapters in through `include::`, which the graph keeps as edges; section checks use the chapters.
const SECTION_FILES = FILES.filter((f) => f !== 'book.adoc');

/** The same file without graph metadata: leading property block, `@tg` comments and blocks, `:tg-*:` attributes. */
function withoutMetadata(text: string): string {
  const lines = scanLines(text.split(/\r?\n/));
  const drop = new Set<number>();
  let first = lines.findIndex((l) => l.kind !== 'blank');
  if (lines[first]?.kind === 'comment-open') {
    let end = first;
    while (lines[end + 1]?.kind === 'comment-body') end++;
    const body = lines.slice(first + 1, end + 1).find((l) => l.text.trim());
    if (body?.text.trim() !== '@tg') for (let i = first; i <= end + 1; i++) drop.add(i);
  }
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (l.kind === 'comment' && /^\/\/\s*@tg:/.test(l.text) && !l.verbatim) drop.add(i);
    if (l.kind === 'attr' && l.name!.startsWith('tg-')) drop.add(i);
    if (l.kind === 'comment-open') {
      let end = i;
      while (lines[end + 1]?.kind === 'comment-body') end++;
      const body = lines.slice(i + 1, end + 1).find((b) => b.text.trim());
      if (body?.text.trim() === '@tg') for (let j = i; j <= end + 1; j++) drop.add(j);
    }
  }
  return lines.filter((l) => !drop.has(l.n)).map((l) => l.text).join('\n');
}

const baseOf = (file: string) => dirname(join(root, file));
const render = async (text: string, file: string) => String(await convert(text, { safe: 'unsafe', base_dir: baseOf(file), standalone: false }));

describe('asciidoc render safety', () => {
  // @tg: verifies:: [[openspec:asciidoc-notes#Rendering is unchanged by graph metadata#Rendered fixture book]] {level: integration}
  // @lat: [[tests/asciidoc-notes#Render safety#Rendering unchanged]]
  it.each(FILES)('%s renders identically with and without metadata', async (file) => {
    const text = readFileSync(join(root, file), 'utf8');
    const twin = withoutMetadata(text);
    if (file !== 'chapters/ch02.adoc') expect(twin.length).toBeLessThan(text.length);
    const html = await render(text, file);
    expect(html).toBe(await render(twin, file));
    for (const leak of ['Pavlyshyn 2024', 'status: draft', 'type: Chapter', 'extends::', 'contrasts_with', 'tg-pages']) {
      expect(html).not.toContain(leak);
    }
    // The only `@tg` left is the one in the listing block, where it is content and not metadata.
    expect(html.split('@tg').length - 1).toBe(file === 'chapters/ch02.adoc' ? 0 : 1);
  });

  // @tg: verifies:: [[openspec:asciidoc-notes#Rendering is unchanged by graph metadata#Ids agree]] {level: integration}
  // @lat: [[tests/asciidoc-notes#Render safety#Ids agree with Asciidoctor]]
  it.each(SECTION_FILES)('%s section ids resolve to the same title path', async (file) => {
    const text = readFileSync(join(root, file), 'utf8');
    const ours = parseAsciidoc(text, file, { parseYaml });
    const doc = await load(text, { safe: 'unsafe', base_dir: baseOf(file) });
    await doc.convert();
    const walk = (sections: any[], parents: string[]): [string, string][] =>
      sections.flatMap((s) => {
        const path = [...parents, String(s.getTitle())];
        return [[String(s.getId()), path.join('#')] as [string, string], ...walk(s.getSections(), path)];
      });
    const expected = walk(doc.getSections() as any[], []);
    expect(expected.length).toBeGreaterThan(0);
    const byAlias = new Map(ours.sections.flatMap((s) => s.aliases.map((a) => [a, s.headingPath.join('#')] as const)));
    for (const [id, path] of expected) expect(byAlias.get(id), id).toBe(path);
  });

  // @tg: verifies:: [[openspec:asciidoc-notes#Rendering is unchanged by graph metadata#Rendered fixture book]] {level: integration}
  // @lat: [[tests/asciidoc-notes#Render safety#Section tree agrees with Asciidoctor]]
  it.each(SECTION_FILES)('%s section tree equals the processor tree', async (file) => {
    const text = readFileSync(join(root, file), 'utf8');
    const ours = parseAsciidoc(text, file, { parseYaml });
    const doc = await load(text, { safe: 'unsafe', base_dir: baseOf(file) });
    const shape = (sections: any[]): unknown[] => sections.map((s) => [String(s.getTitle()), shape(s.getSections())]);
    const tree = (flat: typeof ours.sections): unknown[] => {
      const out: any[] = [];
      const stack: { level: number; kids: any[] }[] = [{ level: 0, kids: out }];
      for (const s of flat) {
        while (stack[stack.length - 1]!.level >= s.level) stack.pop();
        const node = [s.heading, [] as any[]];
        stack[stack.length - 1]!.kids.push(node);
        stack.push({ level: s.level, kids: node[1] as any[] });
      }
      return out;
    };
    expect(tree(ours.sections)).toEqual(shape(doc.getSections() as any[]));
  });
});
