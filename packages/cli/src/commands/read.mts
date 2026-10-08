import { readFileSync } from 'node:fs';
import { lookupSymbol, type FindMatch, type LatIndex, type Section } from '@obsigraph/core';
import { EXIT_ERROR, EXIT_FINDINGS, EXIT_OK, register, type Command, type Ctx } from '../cli.mjs';
import { NoLatDir, Project } from '../project.mjs';

function open(ctx: Ctx): Project | null {
  try {
    return new Project(ctx.root);
  } catch (e) {
    if (e instanceof NoLatDir) {
      ctx.err(`${e.message}\n`);
      return null;
    }
    throw e;
  }
}

const strip = (q: string): string => q.trim().replace(/^\[\[|\]\]$/g, '');
const loc = (s: Section): string => `${s.filePath}:${s.startLine}-${s.endLine}`;
const quote = (s: string): string => s.split('\n').map((l) => (l ? `  > ${l}` : '  >')).join('\n');
const trunc = (s: string, n = 80): string => (s.length > n ? `${s.slice(0, n - 3)}...` : s);

/** No section matched: one JSON document under --json, else the text message; exit 1 either way. */
function noMatch(ctx: Ctx, query: string, message: string): number {
  ctx.out(ctx.json ? `${JSON.stringify({ query, found: false, message })}\n` : `${message}\n`);
  return EXIT_FINDINGS;
}

function preview(m: FindMatch, label?: string): string {
  const s = m.section;
  return [`* Section: [[${s.id}]] (${label ?? m.reason})`, `  Defined in ${loc(s)}`, '', s.firstParagraph ? quote(s.firstParagraph) : '  > (no leading paragraph)', ''].join('\n');
}

function sectionBody(project: Project, s: Section): string {
  const text = project.text(s.filePath) ?? '';
  return text.split('\n').slice(s.startLine - 1, s.endLine).map((l) => (l ? `> ${l}` : '>')).join('\n');
}

function snippetOf(project: Project, file: string, symbol: string | null): { range: string; lines: string[] } | null {
  const text = project.text(file);
  if (text === null) return null;
  if (!symbol) return { range: file, lines: [] };
  const hit = lookupSymbol(file, text, symbol);
  if (hit.status !== 'found') return { range: file, lines: [] };
  const lines = text.split('\n').slice(hit.symbol.startLine - 1, hit.symbol.endLine);
  return { range: `${file}:${hit.symbol.startLine}-${hit.symbol.endLine}`, lines: lines.slice(0, 5) };
}

/** Code lines around an annotation, as lat.md shows them: two before, three after. */
function around(project: Project, file: string, line: number): string[] {
  const lines = (project.text(file) ?? '').split('\n');
  return lines.slice(Math.max(0, line - 3), line + 3).map((l) => `  | ${l}`);
}

// @tg: implements:: [[openspec:tg-check#Locate and section]]
export const locate: Command = {
  name: 'locate',
  summary: 'Find sections by id, short id or fuzzy name',
  usage: 'locate <query>',
  run(ctx, args) {
    const project = open(ctx);
    if (!project) return EXIT_ERROR;
    const query = strip(args.join(' '));
    if (!query) {
      ctx.err('usage: tg locate <query>\n');
      return EXIT_ERROR;
    }
    const matches = project.index().find(query);
    if (ctx.json) {
      ctx.out(`${JSON.stringify(matches.map((m) => ({ id: m.section.id, file: m.section.filePath, startLine: m.section.startLine, endLine: m.section.endLine, reason: m.reason, summary: m.section.firstParagraph })))}\n`);
      return matches.length ? EXIT_OK : EXIT_FINDINGS;
    }
    if (!matches.length) {
      ctx.out(`No sections matching "${query}" (no exact, substring, or fuzzy matches)\n`);
      return EXIT_FINDINGS;
    }
    ctx.out(`## Sections matching "${query}":\n\n${matches.map((m) => preview(m)).join('\n')}\n`);
    return EXIT_OK;
  },
};

function refsOfSection(index: LatIndex, s: Section) {
  return index.refs().filter((r) => r.fromSection === s.id);
}

// @tg: implements:: [[openspec:tg-check#Locate and section]]
export const section: Command = {
  name: 'section',
  summary: 'Show a section with its content, outgoing references and incoming references',
  usage: 'section <query>',
  run(ctx, args) {
    const project = open(ctx);
    if (!project) return EXIT_ERROR;
    const query = strip(args.join(' '));
    const index = project.index();
    const match = index.find(query)[0];
    if (!match) return noMatch(ctx, query, `No sections matching "${query}"`);
    const s = match.section;
    const out: Section[] = [];
    const outgoing: string[] = [];
    for (const r of refsOfSection(index, s)) {
      const res = index.resolve(r.target);
      if (res.kind === 'section') {
        if (!out.includes(res.section)) {
          out.push(res.section);
          outgoing.push(`* [[${res.id}]] — ${trunc(res.section.firstParagraph)}`);
        }
      } else if (res.kind === 'code') {
        const snip = snippetOf(project, res.file, res.symbol);
        outgoing.push(`* [[${r.target}]] (${snip?.range ?? res.file})`, ...(snip?.lines.map((l) => `  | ${l}`) ?? []));
      }
    }
    const incomingMd = index.refs().filter((r) => {
      const res = index.resolve(r.target);
      return res.kind === 'section' && res.section === s && r.fromSection !== s.id;
    });
    const seen = new Set<string>();
    const mdLines: string[] = [];
    for (const r of incomingMd) {
      if (seen.has(r.fromSection)) continue;
      seen.add(r.fromSection);
      const from = index.section(r.fromSection);
      if (from) mdLines.push(`* [[${from.id}]] — ${trunc(from.firstParagraph)}`);
    }
    const codeRefs = project
      .annotations()
      .annotations.flatMap((a) => a.edges.filter((e) => index.resolveRef(e.target).resolved.toLowerCase() === s.id.toLowerCase()).map(() => a));
    const codeLines = codeRefs.flatMap((a) => [`* ${a.file}:${a.line}`, ...around(project, a.file, a.line)]);
    if (ctx.json) {
      ctx.out(`${JSON.stringify({ id: s.id, file: s.filePath, startLine: s.startLine, endLine: s.endLine, outgoing, referencedBy: mdLines, referencedByCode: codeRefs.map((a) => ({ file: a.file, line: a.line, kind: a.kind })) })}\n`);
      return EXIT_OK;
    }
    const parts = [`[[${s.id}]] (${loc(s)})`, '', sectionBody(project, s), ''];
    if (outgoing.length) parts.push('## This section references:', '', ...outgoing, '');
    if (mdLines.length) parts.push('## Referenced by:', '', ...mdLines, '');
    if (codeLines.length) parts.push('## Referenced by code:', '', ...codeLines, '');
    ctx.out(`${parts.join('\n')}\n`);
    return EXIT_OK;
  },
};

// @tg: implements:: [[openspec:tg-check#Refs and expand]]
export const refs: Command = {
  name: 'refs',
  summary: 'Find sections and code that reference a section',
  usage: 'refs [--scope md|code|md+code] <query>',
  flags: { scope: 'string' },
  run(ctx, args, flags) {
    const project = open(ctx);
    if (!project) return EXIT_ERROR;
    const scope = typeof flags.get('scope') === 'string' ? (flags.get('scope') as string) : 'md+code';
    if (!['md', 'code', 'md+code'].includes(scope)) {
      ctx.err(`unknown scope "${scope}"; expected md, code or md+code\n`);
      return EXIT_ERROR;
    }
    const query = strip(args.join(' '));
    const index = project.index();
    const match = index.find(query)[0];
    if (!match) return noMatch(ctx, query, `No section matching "${query}"`);
    const s = match.section;
    const mdFrom: Section[] = [];
    if (scope !== 'code') {
      for (const r of index.refs()) {
        const res = index.resolve(r.target);
        const from = index.section(r.fromSection);
        if (res.kind === 'section' && res.section === s && from && !mdFrom.includes(from)) mdFrom.push(from);
      }
    }
    const codeFrom = scope === 'md' ? [] : project.annotations().annotations.filter((a) => a.edges.some((e) => index.resolveRef(e.target).resolved.toLowerCase() === s.id.toLowerCase()));
    if (ctx.json) {
      ctx.out(`${JSON.stringify({ id: s.id, sections: mdFrom.map((f) => f.id), code: codeFrom.map((a) => ({ file: a.file, line: a.line, kind: a.kind, edges: a.edges.map((e) => e.type) })) })}\n`);
      return EXIT_OK;
    }
    const out: string[] = [`\n## References to "${s.id}":\n`];
    for (const f of mdFrom) out.push(preview({ section: f, reason: 'wiki link' }, 'wiki link'));
    if (codeFrom.length) out.push('## Code references:\n', ...codeFrom.map((a) => `* ${a.file}:${a.line}`), '');
    if (!mdFrom.length && !codeFrom.length) out.push('No references found.\n');
    ctx.out(`${out.join('\n')}\n`);
    return EXIT_OK;
  },
};

// @tg: implements:: [[openspec:tg-check#Refs and expand]]
export const expand: Command = {
  name: 'expand',
  summary: 'Expand [[refs]] in text to section locations',
  usage: 'expand [--stdin] [text]',
  flags: { stdin: 'bool' },
  run(ctx, args, flags) {
    const project = open(ctx);
    if (!project) return EXIT_ERROR;
    const text = flags.has('stdin') ? readFileSync(0, 'utf8') : args.join(' ');
    const index = project.index();
    const found: { raw: string; section: Section }[] = [];
    const failed: string[] = [];
    const replaced = text.replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (whole, raw: string) => {
      const m = index.find(raw.trim())[0];
      if (!m) {
        failed.push(raw);
        return whole;
      }
      found.push({ raw, section: m.section });
      return `[[${m.section.id}]]`;
    });
    if (ctx.json) {
      // One document in every case: unresolved refs are listed and still exit 1.
      ctx.out(`${JSON.stringify({ text: replaced, refs: found.map((f) => ({ ref: f.raw, id: f.section.id, location: loc(f.section), summary: f.section.firstParagraph })), unresolved: failed })}\n`);
      return failed.length ? EXIT_FINDINGS : EXIT_OK;
    }
    if (failed.length) {
      ctx.out(`No section found for [[${failed[0]}]] (no exact, substring, or fuzzy matches).\nAsk the user to correct the reference.\n`);
      return EXIT_FINDINGS;
    }
    if (!found.length) {
      ctx.out(text);
      return EXIT_OK;
    }
    const ctxLines = ['<lat-context>'];
    for (const f of found) {
      ctxLines.push(`* \`[[${f.raw}]]\` is referring to:`, `  * [[${f.section.id}]]`, `    * ${loc(f.section)}`, ...(f.section.firstParagraph ? [`    * ${f.section.firstParagraph.split('\n')[0]}`] : []));
    }
    ctxLines.push('</lat-context>');
    ctx.out(`${replaced}\n\n${ctxLines.join('\n')}\n`);
    return EXIT_OK;
  },
};

register(locate, section, refs, expand);
