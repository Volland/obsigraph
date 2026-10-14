import { emitKeypressEvents } from 'node:readline';
import { createInterface } from 'node:readline/promises';

export interface ChoiceItem {
  id: string;
  label: string;
  checked: boolean;
}

/**
 * A terminal checklist: arrow keys (or j/k) move, space toggles, `a` toggles
 * all, Enter confirms. Returns the checked ids in list order. Ctrl+C restores
 * the terminal and exits with 130, as shells expect.
 */
export function checklist(title: string, items: ChoiceItem[], input: NodeJS.ReadStream = process.stdin, output: NodeJS.WriteStream = process.stdout): Promise<string[]> {
  const state = items.map((i) => ({ ...i }));
  let cursor = 0;
  let drawn = 0;
  const draw = () => {
    if (drawn) output.write(`\x1b[${drawn}A\x1b[0J`);
    const lines = [
      `\x1b[1m${title}\x1b[0m`,
      '\x1b[2m↑/↓ move · space toggle · a all · enter confirm\x1b[0m',
      ...state.map((it, i) => `${i === cursor ? '\x1b[36m❯\x1b[0m' : ' '} ${it.checked ? '\x1b[32m◉\x1b[0m' : '◯'} ${it.label}`),
    ];
    output.write(`${lines.join('\n')}\n`);
    drawn = lines.length;
  };
  return new Promise((resolve) => {
    emitKeypressEvents(input);
    const raw = input.isRaw;
    input.setRawMode(true);
    input.resume();
    output.write('\x1b[?25l');
    const done = () => {
      input.off('keypress', onKey);
      input.setRawMode(raw);
      input.pause();
      output.write('\x1b[?25h');
    };
    const onKey = (_: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === 'c') {
        done();
        output.write('\n');
        process.exit(130);
      }
      if (key.name === 'up' || key.name === 'k') cursor = (cursor + state.length - 1) % state.length;
      else if (key.name === 'down' || key.name === 'j') cursor = (cursor + 1) % state.length;
      else if (key.name === 'space') state[cursor]!.checked = !state[cursor]!.checked;
      else if (key.name === 'a') {
        const all = state.every((s) => s.checked);
        for (const s of state) s.checked = !all;
      } else if (key.name === 'return' || key.name === 'enter') {
        done();
        const picked = state.filter((s) => s.checked);
        // Collapse the list into one summary line so the scrollback stays short.
        output.write(`\x1b[${drawn}A\x1b[0J\x1b[1m${title}\x1b[0m ${picked.map((s) => s.label.split(/\s*[:(]/)[0]).join(', ') || '(none)'}\n`);
        resolve(picked.map((s) => s.id));
        return;
      }
      draw();
    };
    input.on('keypress', onKey);
    draw();
  });
}

/** A terminal single choice: arrow keys move, Enter picks; returns the picked id. Ctrl+C exits with 130. */
export function select(title: string, items: { id: string; label: string }[], input: NodeJS.ReadStream = process.stdin, output: NodeJS.WriteStream = process.stdout): Promise<string> {
  let cursor = 0;
  let drawn = 0;
  const draw = () => {
    if (drawn) output.write(`\x1b[${drawn}A\x1b[0J`);
    const lines = [`\x1b[1m${title}\x1b[0m`, '\x1b[2m↑/↓ move · enter pick\x1b[0m', ...items.map((it, i) => `${i === cursor ? '\x1b[36m❯ ●\x1b[0m' : '  ○'} ${it.label}`)];
    output.write(`${lines.join('\n')}\n`);
    drawn = lines.length;
  };
  return new Promise((resolve) => {
    emitKeypressEvents(input);
    const raw = input.isRaw;
    input.setRawMode(true);
    input.resume();
    output.write('\x1b[?25l');
    const done = () => {
      input.off('keypress', onKey);
      input.setRawMode(raw);
      input.pause();
      output.write('\x1b[?25h');
    };
    const onKey = (_: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === 'c') {
        done();
        output.write('\n');
        process.exit(130);
      }
      if (key.name === 'up' || key.name === 'k') cursor = (cursor + items.length - 1) % items.length;
      else if (key.name === 'down' || key.name === 'j') cursor = (cursor + 1) % items.length;
      else if (key.name === 'return' || key.name === 'enter') {
        done();
        output.write(`\x1b[${drawn}A\x1b[0J\x1b[1m${title}\x1b[0m ${items[cursor]!.label.split(/\s+\(/)[0]}\n`);
        resolve(items[cursor]!.id);
        return;
      }
      draw();
    };
    input.on('keypress', onKey);
    draw();
  });
}

/** Ask one line of text. */
export async function askLine(question: string, input: NodeJS.ReadStream = process.stdin, output: NodeJS.WriteStream = process.stdout): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}
