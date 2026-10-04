/** One compiled `.gitignore` file: patterns evaluated in order, the last match wins, `!` re-includes. */
export interface IgnoreRules {
  /** `rel` is relative to the directory holding the .gitignore. Returns true ignored, false re-included, null no match. */
  test(rel: string, isDir: boolean): boolean | null;
}

function globToRegex(glob: string): string {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === '*') {
      if (glob[i + 1] === '*') {
        const slashAfter = glob[i + 2] === '/';
        const atStart = i === 0 || glob[i - 1] === '/';
        if (atStart && slashAfter) {
          re += '(?:.*/)?';
          i += 2;
        } else if (atStart && i + 2 === glob.length) {
          re += '.*';
          i += 1;
        } else {
          re += '[^/]*';
          i += 1;
        }
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '[') {
      const end = glob.indexOf(']', i + 2);
      if (end === -1) re += '\\[';
      else {
        const body = glob.slice(i + 1, end).replace(/^!/, '^').replace(/\\/g, '\\\\');
        re += `[${body}]`;
        i = end;
      }
    } else if (c === '\\' && i + 1 < glob.length) {
      re += glob[++i]!.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    } else re += c.replace(/[.+^${}()|\\]/g, '\\$&');
  }
  return re;
}

export function compileIgnore(text: string): IgnoreRules {
  interface Rule {
    re: RegExp;
    negate: boolean;
    dirOnly: boolean;
  }
  const rules: Rule[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.replace(/(?<!\\)\s+$/, '');
    if (!line || line.startsWith('#')) continue;
    let negate = false;
    if (line.startsWith('!')) {
      negate = true;
      line = line.slice(1);
    }
    if (line.startsWith('\\#') || line.startsWith('\\!')) line = line.slice(1);
    let dirOnly = false;
    if (line.endsWith('/')) {
      dirOnly = true;
      line = line.slice(0, -1);
    }
    if (!line) continue;
    const anchored = line.includes('/');
    if (line.startsWith('/')) line = line.slice(1);
    const body = globToRegex(line);
    rules.push({ re: new RegExp(anchored ? `^${body}$` : `^(?:.*/)?${body}$`), negate, dirOnly });
  }
  return {
    test(rel, isDir) {
      let result: boolean | null = null;
      for (const r of rules) {
        if (r.dirOnly && !isDir) continue;
        if (r.re.test(rel)) result = !r.negate;
      }
      return result;
    },
  };
}
