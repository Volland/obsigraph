import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Graph, isSourceTarget, noteFrontmatter, parseAsciidoc, pathResolver, type Diagnostic, type Finding } from '@obsigraph/core';
import { parseYaml } from '@obsigraph/node-vault';
import type { Project } from './project.mjs';

/** Diagnostic codes of AsciiDoc notes that fail `tg check`; every other code is a warning. */
const ERROR_CODES = new Set(['ambiguous-link', 'adoc-include', 'frontmatter-yaml', 'edge-syntax']);

export interface NoteCheck {
  findings: Finding[];
  warnings: Diagnostic[];
}

/**
 * Check the AsciiDoc notes matched by the `notes` globs: broken includes and cross references, ambiguous links,
 * source links that name a missing file or symbol, and unreadable property blocks are errors; edge syntax that
 * would render, property conflicts, and `.adoc` files inside the docs folder are warnings. The notes are never
 * scanned for code annotations.
 */
// @tg: implements:: [[openspec:asciidoc-notes#Hosts index AsciiDoc notes]]
// @tg: implements:: [[openspec:asciidoc-notes#lat.md folder stays Markdown-only]]
export function checkNotes(project: Project): NoteCheck {
  const findings: Finding[] = [];
  const warnings: Diagnostic[] = [];
  const { error } = project.config();
  if (error) findings.push({ kind: 'link', file: '.tg/config.json', line: 0, message: error });
  for (const file of project.latAdocFiles()) {
    warnings.push({ path: file, line: 0, column: 0, code: 'adoc-in-lat', message: `${project.latDirName}/ holds only Markdown; ${file} is not read as lat.md sections` });
  }

  const paths = project.noteFiles();
  const graph = new Graph(pathResolver(() => paths), undefined, { linkEdges: true, parseYaml });
  for (const path of paths) {
    const text = project.text(path) ?? '';
    graph.upsertNote({ path, text, frontmatter: noteFrontmatter(path, text, parseYaml).frontmatter });
  }
  for (const d of graph.diagnostics()) {
    if (ERROR_CODES.has(d.code ?? '')) findings.push({ kind: 'link', file: d.path ?? '', line: d.line + 1, message: d.message });
    else warnings.push(d);
  }

  for (const path of paths) {
    for (const e of parseAsciidoc(project.text(path) ?? '', path, { linkEdges: true }).edges) {
      const line = e.line + 1;
      if (e.type === 'includes' || (e.type === 'links_to' && /\.adoc$/i.test(e.target))) {
        if (!existsSync(join(project.root, e.target))) {
          findings.push({ kind: 'link', file: path, line, target: e.target, message: `${e.type === 'includes' ? 'include' : 'cross reference'} target "${e.target}" not found` });
        }
      } else if (isSourceTarget(e.target)) {
        const err = project.checkSourceLink(e.target, e.subpath);
        if (err) findings.push({ kind: 'link', file: path, line, target: e.target, message: `broken link [[${e.target}${e.subpath ? `#${e.subpath}` : ''}]] — ${err}` });
      }
    }
  }
  return { findings, warnings };
}
