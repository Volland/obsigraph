export type ErrorKind = 'syntax' | 'unsupported' | 'readonly' | 'runtime' | 'timeout';

export class CypherError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
    readonly line: number,
    readonly column: number,
  ) {
    super(message);
    this.name = 'CypherError';
  }
}

export type TokenKind = 'name' | 'escaped' | 'number' | 'string' | 'param' | 'punct' | 'eof';

export interface Token {
  kind: TokenKind;
  value: string;
  start: number;
  end: number;
  line: number;
  column: number;
}

const PUNCT2 = new Set(['<>', '<=', '>=', '->', '<-', '=~', '..']);
const PUNCT1 = new Set('()[]{}:,.-+*/%^=<>|;'.split(''));

export function lex(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let lineStart = 0;

  const newlinesIn = (from: number, to: number) => {
    for (let j = from; j < to; j++) {
      if (src[j] === '\n') {
        line++;
        lineStart = j + 1;
      }
    }
  };

  while (i < src.length) {
    const c = src[i]!;
    if (c === '\n') {
      i++;
      line++;
      lineStart = i;
      continue;
    }
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2);
      const stop = close < 0 ? src.length : close + 2;
      newlinesIn(i, stop);
      i = stop;
      continue;
    }

    const start = i;
    const tokLine = line;
    const tokCol = i - lineStart + 1;
    const push = (kind: TokenKind, value: string) =>
      tokens.push({ kind, value, start, end: i, line: tokLine, column: tokCol });

    if (/[\p{L}_]/u.test(c)) {
      const m = /^[\p{L}\p{N}_]+/u.exec(src.slice(i))!;
      i += m[0].length;
      push('name', m[0]);
    } else if (c === '`') {
      const close = src.indexOf('`', i + 1);
      if (close < 0) throw new CypherError('syntax', 'Unterminated backtick name', tokLine, tokCol);
      i = close + 1;
      push('escaped', src.slice(start + 1, close));
    } else if (/\d/.test(c) || (c === '.' && /\d/.test(src[i + 1] ?? ''))) {
      const m = /^(\d+\.\d+|\d+|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i))!;
      i += m[0].length;
      push('number', m[0]);
    } else if (c === '"' || c === "'") {
      let out = '';
      i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\' && i + 1 < src.length) {
          const e = src[i + 1]!;
          out += e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '\r' : e;
          i += 2;
        } else {
          out += src[i++];
        }
      }
      if (i >= src.length) throw new CypherError('syntax', 'Unterminated string literal', tokLine, tokCol);
      i++;
      newlinesIn(start, i);
      push('string', out);
    } else if (c === '$') {
      const m = /^\$([\p{L}_][\p{L}\p{N}_]*|\d+)/u.exec(src.slice(i));
      if (!m) throw new CypherError('syntax', "Expected parameter name after '$'", tokLine, tokCol);
      i += m[0].length;
      push('param', m[1]!);
    } else {
      const two = src.slice(i, i + 2);
      if (PUNCT2.has(two)) {
        i += 2;
        push('punct', two);
      } else if (PUNCT1.has(c)) {
        i++;
        push('punct', c);
      } else {
        throw new CypherError('syntax', `Unexpected character '${c}'`, tokLine, tokCol);
      }
    }
  }

  tokens.push({ kind: 'eof', value: '', start: src.length, end: src.length, line, column: src.length - lineStart + 1 });
  return tokens;
}
