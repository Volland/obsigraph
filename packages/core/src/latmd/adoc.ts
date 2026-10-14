import { parseAsciidoc } from '../asciidoc/parse.js';
import type { Section } from './markdown.js';

/**
 * The sections of an AsciiDoc note as lattice sections, so `tg locate`, `section` and `search` reach them:
 * ids are heading paths under the file path with its extension (`book/ch03.adoc#Metagraphs#Definition`),
 * `==` headings are the roots, lines are 1-based.
 */
// @tg: implements:: [[openspec:asciidoc-notes#Sections and id aliases]] {confidence: partial}
export function adocSections(path: string, text: string): { roots: Section[]; flat: Section[] } {
  const parsed = parseAsciidoc(text, path);
  const paragraphs = new Map(parsed.chunks.map((c) => [c.headingPath.join('\u0001'), c.text.split(/\n\s*\n/)[0]!.trim()]));
  const roots: Section[] = [];
  const flat: Section[] = [];
  const stack: Section[] = [];
  for (const s of parsed.sections) {
    const section: Section = {
      id: s.id,
      heading: s.heading,
      depth: s.level,
      file: path,
      filePath: path,
      children: [],
      startLine: s.startLine + 1,
      endLine: s.endLine + 1,
      firstParagraph: paragraphs.get(s.headingPath.join('\u0001')) ?? '',
    };
    while (stack.length && stack[stack.length - 1]!.depth >= section.depth) stack.pop();
    (stack.length ? stack[stack.length - 1]!.children : roots).push(section);
    stack.push(section);
    flat.push(section);
  }
  return { roots, flat };
}
