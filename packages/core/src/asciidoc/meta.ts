/** A YAML parser supplied by the host (`yaml`, Obsidian's `parseYaml`); core carries none of its own. */
export type YamlParser = (source: string) => unknown;

/** One-line YAML value: number, boolean, null, quoted string, flow list, otherwise the text. */
export function oneLineYaml(raw: string, parseYaml?: YamlParser): unknown {
  const v = raw.trim();
  if (v === '' || v === '~' || v === 'null') return null;
  if (parseYaml) {
    try {
      return parseYaml(v);
    } catch {
      return v;
    }
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^[-+]?\d+(\.\d+)?$/.test(v)) return Number(v);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    try {
      return v[0] === '"' ? JSON.parse(v) : v.slice(1, -1).replace(/''/g, "'");
    } catch {
      return v.slice(1, -1);
    }
  }
  if (v.startsWith('[') && v.endsWith(']')) {
    const items: string[] = [];
    let depth = 0;
    let quote = '';
    let cur = '';
    for (const c of v.slice(1, -1)) {
      if (quote) {
        if (c === quote) quote = '';
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '[') depth++;
      else if (c === ']') depth--;
      else if (c === ',' && depth === 0) {
        items.push(cur);
        cur = '';
        continue;
      }
      cur += c;
    }
    if (cur.trim()) items.push(cur);
    return items.map((i) => oneLineYaml(i));
  }
  return v;
}

/**
 * Minimal flat YAML for hosts without a parser: `key: value` lines (values as `oneLineYaml`) and `- item`
 * lists under a key. Anything else, such as a licence banner, is an error like broken frontmatter.
 */
function flatYaml(source: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let listKey: string | null = null;
  source.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim() || line.trim().startsWith('#')) return;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && listKey) {
      if (!Array.isArray(out[listKey])) out[listKey] = [];
      (out[listKey] as unknown[]).push(oneLineYaml(item[1]!));
      return;
    }
    const kv = /^([^\s:#'"][^:]*?|"[^"]*"|'[^']*'):(?:\s+(.*))?$/.exec(line);
    if (!kv) throw new Error(`line ${i + 1} is not a \`key: value\` pair`);
    const key = kv[1]!.replace(/^["']|["']$/g, '');
    if (kv[2] === undefined || kv[2].trim() === '') {
      out[key] = null;
      listKey = key;
      return;
    }
    listKey = null;
    out[key] = oneLineYaml(kv[2]);
  });
  return out;
}

/** Parse YAML text into a mapping, or fail with a one-line message. */
export function parseMapping(source: string, parseYaml?: YamlParser): Record<string, unknown> | null {
  let parsed: unknown;
  try {
    parsed = parseYaml ? parseYaml(source) : flatYaml(source);
  } catch (e) {
    throw new Error((e as Error).message.split('\n')[0]);
  }
  if (parsed === null || parsed === undefined) return null;
  if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not a YAML mapping');
  return parsed as Record<string, unknown>;
}
