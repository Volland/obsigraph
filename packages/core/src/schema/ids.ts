/**
 * Identifiers for new notes: random and time-ordered UUIDs, the classic
 * timestamp id, and Luhmann's branching Folgezettel ids (`1`, `1a`, `1a1`, `2`).
 * Everything is pure; randomness and the clock are injected.
 */

export type IdKind = 'uuid' | 'uuid7' | 'timestamp' | 'luhmann';
export const ID_KINDS: readonly IdKind[] = ['uuid', 'uuid7', 'timestamp', 'luhmann'];

/** One identifier a type asks for when a note of that type is created. */
export interface IdRule {
  kind: IdKind;
  /** Frontmatter property that holds the id. */
  property: string;
  /** Generated on every new note; otherwise only when asked for (Luhmann placement). */
  auto: boolean;
  /** Prefix the file name with the id (`202601121530 Title.md`). */
  filename: boolean;
}

export type RandomBytes = (length: number) => Uint8Array;

const defaultRandom: RandomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
const hex = (bytes: Uint8Array): string => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const dashed = (h: string): string => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;

/** A random (version 4) UUID. */
export function uuid4(random: RandomBytes = defaultRandom): string {
  const b = random(16).slice();
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  return dashed(hex(b));
}

/**
 * A time-ordered (version 7) UUID: the first 48 bits are the Unix time in
 * milliseconds, so ids sort as strings in creation order.
 */
export function uuid7(now: Date, random: RandomBytes = defaultRandom): string {
  const ms = now.getTime();
  const b = random(16).slice();
  for (let i = 0; i < 6; i++) b[i] = Math.floor(ms / 2 ** (8 * (5 - i))) & 0xff;
  b[6] = (b[6]! & 0x0f) | 0x70;
  b[8] = (b[8]! & 0x3f) | 0x80;
  return dashed(hex(b));
}

const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

/** `YYYYMMDDHHmm` in local time, moved forward a minute at a time until it is unused. */
export function timestampId(now: Date, existing: ReadonlySet<string>): string {
  const d = new Date(now.getTime());
  d.setSeconds(0, 0);
  for (let i = 0; i < 100_000; i++) {
    const id = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
    if (!existing.has(id)) return id;
    d.setMinutes(d.getMinutes() + 1);
  }
  throw new Error('No free timestamp id');
}

/** `YYYY-MM-DD` and `HH:mm` in local time, for template tokens. */
export function dateParts(now: Date): { date: string; time: string } {
  return { date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`, time: `${pad(now.getHours())}:${pad(now.getMinutes())}` };
}

// ---- Luhmann ids -----------------------------------------------------------

const SEGMENT = /\d+|[a-z]+/g;

/** Split `1a2b` into `['1', 'a', '2', 'b']`; null when it is not an alternating number/letter id starting with a number. */
export function parseLuhmann(id: string): string[] | null {
  if (!/^(?:\d+|[a-z]+)+$/.test(id) || !/^\d/.test(id)) return null;
  const parts = id.match(SEGMENT) ?? [];
  for (let i = 0; i < parts.length; i++) if (/^\d/.test(parts[i]!) !== (i % 2 === 0)) return null;
  return parts;
}

/** The next letters in the series a, b, ..., z, aa, ab, ... */
function nextLetters(s: string): string {
  const chars = s.split('');
  let i = chars.length - 1;
  while (i >= 0 && chars[i] === 'z') {
    chars[i] = 'a';
    i--;
  }
  if (i < 0) return `a${chars.join('')}`;
  chars[i] = String.fromCharCode(chars[i]!.charCodeAt(0) + 1);
  return chars.join('');
}

const nextSegment = (s: string): string => (/^\d/.test(s) ? String(Number(s) + 1) : nextLetters(s));

/** The first unused id after `id` among its siblings: `1a` becomes `1b`, `1z` becomes `1aa`, `3` becomes `4`. */
export function luhmannSibling(id: string, existing: ReadonlySet<string>): string {
  const parts = parseLuhmann(id);
  if (!parts) throw new Error(`'${id}' is not a Luhmann id`);
  const head = parts.slice(0, -1).join('');
  let last = parts[parts.length - 1]!;
  let candidate: string;
  do {
    last = nextSegment(last);
    candidate = head + last;
  } while (existing.has(candidate));
  return candidate;
}

/** The first unused child of `parent`: `1` gets `1a`, `1a` gets `1a1`; a taken first child moves on to its next sibling. */
export function luhmannChild(parent: string, existing: ReadonlySet<string>): string {
  const parts = parseLuhmann(parent);
  if (!parts) throw new Error(`'${parent}' is not a Luhmann id`);
  const first = /\d$/.test(parent) ? 'a' : '1';
  let candidate = parent + first;
  while (existing.has(candidate)) candidate = luhmannSibling(candidate, existing);
  return candidate;
}

/** The next top-level number: one more than the largest existing one. */
export function luhmannRoot(existing: ReadonlySet<string>): string {
  let max = 0;
  for (const id of existing) {
    const parts = parseLuhmann(id);
    if (parts) max = Math.max(max, Number(parts[0]));
  }
  return String(max + 1);
}

/** Order ids as a slip box shelves them: `1`, `1a`, `1a1`, `1b`, `2`, `10`. */
export function compareLuhmann(a: string, b: string): number {
  const pa = parseLuhmann(a) ?? [a];
  const pb = parseLuhmann(b) ?? [b];
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    const x = pa[i]!;
    const y = pb[i]!;
    if (x === y) continue;
    if (/^\d/.test(x) && /^\d/.test(y)) return Number(x) - Number(y);
    if (x.length !== y.length) return x.length - y.length;
    return x < y ? -1 : 1;
  }
  return pa.length - pb.length;
}

export interface IdContext {
  now: Date;
  /** Ids already in use for this property. */
  existing: ReadonlySet<string>;
  random?: RandomBytes;
  /** For Luhmann ids: the note to attach to, and whether the new note is its child or its sibling. */
  parent?: { id: string; placement: 'child' | 'sibling' };
}

/** Generate one id of `kind`; a Luhmann id without a parent is the next top-level number. */
export function generateId(kind: IdKind, ctx: IdContext): string {
  const taken = ctx.existing;
  switch (kind) {
    case 'uuid': {
      for (;;) {
        const id = uuid4(ctx.random);
        if (!taken.has(id)) return id;
      }
    }
    case 'uuid7': {
      for (;;) {
        const id = uuid7(ctx.now, ctx.random);
        if (!taken.has(id)) return id;
      }
    }
    case 'timestamp':
      return timestampId(ctx.now, taken);
    case 'luhmann':
      if (!ctx.parent) return luhmannRoot(taken);
      return ctx.parent.placement === 'child' ? luhmannChild(ctx.parent.id, taken) : luhmannSibling(ctx.parent.id, taken);
  }
}
