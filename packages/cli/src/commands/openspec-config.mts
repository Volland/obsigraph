import { isMap, isScalar, isSeq, parseDocument } from 'yaml';
import rulesTemplate from '../../templates/openspec/config-rules.md';

/** Rules `tg init` adds to `openspec/config.yaml`; the `tg:` prefix marks them as tg's to replace. */
export const TG_RULE_PREFIX = 'tg:';

/** Rules by artifact, read from the bundled template: each `## artifact` heading and the list items under it. */
export const TG_RULES: Record<string, string[]> = parseRules(rulesTemplate);

function parseRules(md: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  let artifact: string | null = null;
  for (const line of md.split(/\r?\n/)) {
    const h = /^##\s+(\S+)/.exec(line);
    if (h) out[(artifact = h[1]!)] = [];
    else if (artifact && line.startsWith('- ')) out[artifact]!.push(`${TG_RULE_PREFIX} ${line.slice(2).trim()}`);
  }
  return out;
}

const ruleText = (item: unknown): string => String(isScalar(item) ? item.value : item);
const isTgRule = (item: unknown): boolean => ruleText(item).startsWith(TG_RULE_PREFIX);

/**
 * Add or refresh tg's rules in an OpenSpec `config.yaml`, keeping every other
 * rule, key and comment. Returns the text unchanged when the rules are
 * current, and null when the file is not a YAML mapping tg can safely edit.
 */
// @tg: implements:: [[openspec:tg-agent-integration#OpenSpec config rules]]
export function withOpenspecRules(existing: string): string | null {
  const doc = parseDocument(existing);
  if (doc.errors.length || (doc.contents !== null && !isMap(doc.contents))) return null;
  const rules = doc.get('rules', true);
  if (rules !== undefined && rules !== null && !isMap(rules)) return null;

  const current = Object.entries(TG_RULES).every(([artifact, wanted]) => {
    const seq = isMap(rules) ? rules.get(artifact, true) : undefined;
    const mine = isSeq(seq) ? seq.items.filter(isTgRule).map(ruleText) : [];
    return mine.length === wanted.length && mine.every((r, i) => r === wanted[i]);
  });
  if (current) return existing;

  if (!isMap(rules)) doc.set('rules', doc.createNode({}));
  const map = doc.get('rules', true);
  if (!isMap(map)) return null;
  for (const [artifact, wanted] of Object.entries(TG_RULES)) {
    const seq = map.get(artifact, true);
    if (seq === undefined || seq === null) {
      map.set(artifact, doc.createNode(wanted));
      continue;
    }
    // A project rule written as a single string or mapping is left alone.
    if (!isSeq(seq)) continue;
    seq.items = seq.items.filter((item) => !isTgRule(item));
    for (const r of wanted) seq.items.push(doc.createNode(r));
  }
  return doc.toString({ lineWidth: 0 });
}
