export type PropValue = string | number | boolean | null | PropValue[];
export type Props = Record<string, PropValue>;

export class PropsSyntaxError extends Error {
  constructor(
    message: string,
    readonly offset: number,
  ) {
    super(message);
  }
}

/**
 * Parse a tolerant JSON5-like property block such as
 * `{since: 2020, label: "met at conf", tags: [a, b],}`.
 * Returns the props and the offset just past the closing brace.
 */
export function parseProps(src: string, start = 0): { props: Props; end: number } {
  let i = start;

  const fail = (msg: string): never => {
    throw new PropsSyntaxError(msg, i);
  };
  const ws = () => {
    while (i < src.length && /\s/.test(src[i]!)) i++;
  };
  const expect = (ch: string) => {
    ws();
    if (src[i] !== ch) fail(`expected '${ch}'`);
    i++;
  };

  const parseString = (): string => {
    const quote = src[i]!;
    i++;
    let out = '';
    while (i < src.length && src[i] !== quote) {
      if (src[i] === '\\' && i + 1 < src.length) {
        const next = src[i + 1]!;
        out += next === 'n' ? '\n' : next === 't' ? '\t' : next;
        i += 2;
      } else {
        out += src[i++];
      }
    }
    if (i >= src.length) fail('unterminated string');
    i++;
    return out;
  };

  const parseKey = (): string => {
    ws();
    if (src[i] === '"' || src[i] === "'") return parseString();
    const m = /^[\p{L}_$][\p{L}\p{N}_$-]*/u.exec(src.slice(i));
    if (!m) fail('expected property name');
    i += m![0].length;
    return m![0];
  };

  const parseValue = (): PropValue => {
    ws();
    const ch = src[i];
    if (ch === undefined) fail('unexpected end of property block');
    if (ch === '"' || ch === "'") return parseString();
    if (ch === '[') {
      i++;
      const items: PropValue[] = [];
      ws();
      while (src[i] !== ']') {
        items.push(parseValue());
        ws();
        if (src[i] === ',') {
          i++;
          ws();
        } else if (src[i] !== ']') fail("expected ',' or ']'");
      }
      i++;
      return items;
    }
    // Bare token: number, boolean, null, or unquoted word.
    const m = /^[^,}\]\s][^,}\]]*/.exec(src.slice(i));
    if (!m) fail('expected value');
    const raw = m![0].trimEnd();
    i += m![0].length;
    if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(raw)) return Number(raw);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === 'null') return null;
    return raw;
  };

  expect('{');
  const props: Props = {};
  ws();
  while (src[i] !== '}') {
    if (i >= src.length) fail("expected '}'");
    const key = parseKey();
    expect(':');
    props[key] = parseValue();
    ws();
    if (src[i] === ',') {
      i++;
      ws();
    } else if (src[i] !== '}') fail("expected ',' or '}'");
  }
  i++;
  return { props, end: i };
}
