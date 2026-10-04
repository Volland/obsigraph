export type Lang = 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'c';

export interface Masked {
  /** Same length and line structure as the input, with comments and string contents blanked. */
  text: string;
  /** False when the scan ended inside a string or comment, so structure cannot be trusted. */
  ok: boolean;
}

const REGEX_PREV = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);

function blankRange(out: string[], from: number, to: number, src: string): void {
  for (let i = from; i < to; i++) if (src[i] !== '\n') out[i] = ' ';
}

/** Blank comments and string literals so declarations and braces can be found with plain patterns. */
export function maskCode(src: string, lang: Lang): Masked {
  const out = src.split('');
  const n = src.length;
  let ok = true;
  let i = 0;

  if (lang === 'python') {
    while (i < n) {
      const c = src[i]!;
      if (c === '#') {
        const e = src.indexOf('\n', i);
        const end = e === -1 ? n : e;
        blankRange(out, i, end, src);
        i = end;
      } else if (c === '"' || c === "'") {
        const triple = src.startsWith(c.repeat(3), i);
        const q = triple ? c.repeat(3) : c;
        let j = i + q.length;
        let closed = false;
        while (j < n) {
          if (src[j] === '\\') {
            j += 2;
            continue;
          }
          if (src.startsWith(q, j)) {
            closed = true;
            break;
          }
          if (!triple && src[j] === '\n') break;
          j++;
        }
        const end = closed ? j + q.length : Math.min(j, n);
        if (!closed && triple) ok = false;
        blankRange(out, i + q.length, closed ? j : end, src);
        i = end;
      } else i++;
    }
    return { text: out.join(''), ok };
  }

  let prev = '';
  while (i < n) {
    const c = src[i]!;
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      const e = src.indexOf('\n', i);
      const end = e === -1 ? n : e;
      blankRange(out, i, end, src);
      i = end;
      continue;
    }
    if (c === '/' && next === '*') {
      const e = src.indexOf('*/', i + 2);
      if (e === -1) {
        ok = false;
        blankRange(out, i, n, src);
        i = n;
      } else {
        blankRange(out, i, e + 2, src);
        i = e + 2;
      }
      continue;
    }
    if (lang === 'rust' && (c === 'r' || (c === 'b' && next === 'r')) && /^b?r#*"/.test(src.slice(i, i + 12))) {
      const m = /^b?r(#*)"/.exec(src.slice(i, i + 12))!;
      const close = `"${m[1]}`;
      const start = i + m[0].length;
      const e = src.indexOf(close, start);
      const end = e === -1 ? n : e + close.length;
      if (e === -1) ok = false;
      blankRange(out, start, e === -1 ? n : e, src);
      i = end;
      prev = '"';
      continue;
    }
    if (c === '"' || (c === '`' && (lang === 'typescript' || lang === 'javascript' || lang === 'go'))) {
      let j = i + 1;
      let closed = false;
      while (j < n) {
        if (src[j] === '\\' && c !== '`') {
          j += 2;
          continue;
        }
        if (src[j] === c) {
          closed = true;
          break;
        }
        if (c === '"' && src[j] === '\n' && lang !== 'rust') break;
        j++;
      }
      if (!closed && (c === '`' || lang === 'rust')) ok = false;
      blankRange(out, i + 1, Math.min(j, n), src);
      i = closed ? j + 1 : Math.min(j, n);
      prev = '"';
      continue;
    }
    if (c === "'") {
      if (lang === 'rust') {
        // Char literal `'x'` or `'\n'`; anything else is a lifetime.
        const m = /^'(?:\\.[^']*|[^'\\])'/.exec(src.slice(i, i + 12));
        if (m) {
          blankRange(out, i + 1, i + m[0].length - 1, src);
          i += m[0].length;
        } else i++;
        prev = "'";
        continue;
      }
      let j = i + 1;
      while (j < n && src[j] !== "'" && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      blankRange(out, i + 1, Math.min(j, n), src);
      i = src[j] === "'" ? j + 1 : Math.min(j, n);
      prev = "'";
      continue;
    }
    if (c === '/' && (lang === 'typescript' || lang === 'javascript')) {
      const before = src.slice(Math.max(0, i - 8), i).trimEnd();
      const last = before.slice(-1);
      if (before === '' || REGEX_PREV.has(last) || /(?:^|[^\w$])(?:return|typeof|case|in|of)$/.test(before)) {
        let j = i + 1;
        let cls = false;
        let closed = false;
        while (j < n && src[j] !== '\n') {
          if (src[j] === '\\') {
            j += 2;
            continue;
          }
          if (src[j] === '[') cls = true;
          else if (src[j] === ']') cls = false;
          else if (src[j] === '/' && !cls) {
            closed = true;
            break;
          }
          j++;
        }
        if (closed) {
          blankRange(out, i + 1, j, src);
          i = j + 1;
          prev = '/';
          continue;
        }
      }
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  void prev;
  return { text: out.join(''), ok };
}
