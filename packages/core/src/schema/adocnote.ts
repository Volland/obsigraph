import { parseMapping } from '../asciidoc/meta.js';
import { scanLines } from '../asciidoc/scan.js';
import { scalar, toYaml } from './frontmatter.js';

/**
 * Content for a new AsciiDoc note from a type: the template's leading `////` property block is rewritten
 * with `type`, defaults and generated ids (the template's own values win), and an existing empty `:tg-key:`
 * entry is filled from the same values. A template with no property block gets one.
 */
// @tg: implements:: [[openspec:asciidoc-notes#AsciiDoc limits in this version]]
export function renderAdocNote(base: Record<string, unknown>, templateBody: string): string {
  const lines = scanLines(templateBody.split('\n'));
  const out: string[] = [];
  let rest = lines;
  let block: Record<string, unknown> = {};
  const first = lines.findIndex((l) => l.kind !== 'blank');
  if (lines[first]?.kind === 'comment-open') {
    let end = first;
    while (lines[end + 1]?.kind === 'comment-body') end++;
    const body = lines.slice(first + 1, end + 1).map((l) => l.text);
    if (body.find((l) => l.trim())?.trim() !== '@tg') {
      try {
        block = parseMapping(body.join('\n')) ?? {};
      } catch {
        block = {};
      }
      rest = lines.slice(end + 2);
    }
  }
  const merged = { ...base, ...block };
  out.push('////', toYaml(merged, { emptyNull: true }), '////');
  for (const l of rest) {
    const name = l.kind === 'attr' && !l.unset ? l.name! : '';
    if (name.startsWith('tg-') && (l.value ?? '') === '') {
      const v = merged[name.slice(3)];
      if (v !== undefined && v !== null) {
        out.push(`:${name}: ${Array.isArray(v) ? `[${v.map((x) => scalar(x)).join(', ')}]` : scalar(v)}`);
        continue;
      }
    }
    out.push(l.text);
  }
  return `${out.join('\n').replace(/\s+$/, '')}\n`;
}
