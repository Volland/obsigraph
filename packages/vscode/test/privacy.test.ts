import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', 'src');

// @lat: [[tests/vscode-extension#Privacy#No telemetry]]
it('imports no networking module and calls no fetch', () => {
  const offenders = readdirSync(SRC, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.ts'))
    .filter((f) => /from\s+['"](node:)?(https?|net|tls|dgram|http2)['"]|\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/.test(readFileSync(join(SRC, f), 'utf8')));
  expect(offenders).toEqual([]);
});
