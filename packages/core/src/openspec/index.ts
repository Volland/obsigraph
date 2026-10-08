import { levenshtein } from '../latmd/index.js';

/** One OpenSpec file to index: project-relative posix path and text. */
export interface SpecFile {
  path: string;
  text: string;
}

export interface SpecScenario {
  /** `openspec:<capability>#<requirement>#<scenario>` with the names as written. */
  id: string;
  name: string;
  file: string;
  /** 1-based line of the `#### Scenario:` heading. */
  line: number;
}

export interface SpecRequirement {
  /** `openspec:<capability>#<requirement>` with the names as written. */
  id: string;
  capability: string;
  name: string;
  /** The first paragraph under the heading, normally the SHALL sentence. */
  text: string;
  file: string;
  line: number;
  /** `active` from `openspec/specs/`, `pending` from an unarchived change. */
  status: 'active' | 'pending';
  /** The change that adds or modifies it, for pending requirements. */
  change: string | null;
  /** Active changes that remove or rename this requirement. */
  removedBy: string[];
  scenarios: SpecScenario[];
}

export type SpecResolution =
  | { kind: 'requirement'; requirement: SpecRequirement }
  | { kind: 'scenario'; requirement: SpecRequirement; scenario: SpecScenario }
  | { kind: 'missing'; message: string; suggestion: string | null };

export const SPEC_SCHEME = 'openspec:';

/** True for `openspec:` targets, which the OpenSpec index resolves instead of the lattice. */
export function isSpecTarget(target: string): boolean {
  return target.slice(0, SPEC_SCHEME.length).toLowerCase() === SPEC_SCHEME;
}

const norm = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const REQ = /^###\s+Requirement:\s*(.+?)\s*$/;
const SCEN = /^####\s+Scenario:\s*(.+?)\s*$/;
const DELTA = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/i;
const RENAME_FROM = /^\s*-\s*FROM:\s*`?###\s+Requirement:\s*(.+?)`?\s*$/i;

interface ParsedSpec {
  requirements: SpecRequirement[];
  /** Requirement names a change removes or renames away. */
  removed: string[];
}

/**
 * Parse one spec file. `capability` is its folder name; `change` is null for
 * `openspec/specs/` and the change name for a delta, where only ADDED and
 * MODIFIED requirements are taken and REMOVED or RENAMED names are collected.
 */
export function parseSpec(path: string, text: string, capability: string, change: string | null): ParsedSpec {
  const lines = text.split(/\r?\n/);
  const requirements: SpecRequirement[] = [];
  const removed: string[] = [];
  let fence: string | null = null;
  let delta: string | null = change ? null : 'MAIN';
  let current: SpecRequirement | null = null;
  let wantText = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const f = FENCE.exec(line);
    if (f) {
      if (!fence) fence = f[1]![0]!;
      else if (f[1]![0] === fence) fence = null;
      continue;
    }
    if (fence) continue;
    const d = DELTA.exec(line);
    if (d && change) {
      delta = d[1]!.toUpperCase();
      current = null;
      continue;
    }
    if (/^##\s/.test(line)) {
      if (change) delta = null;
      current = null;
      continue;
    }
    if (delta === 'REMOVED' || delta === 'RENAMED') {
      const r = delta === 'REMOVED' ? REQ.exec(line) : RENAME_FROM.exec(line);
      if (r) removed.push(r[1]!);
      continue;
    }
    if (delta !== 'MAIN' && delta !== 'ADDED' && delta !== 'MODIFIED') continue;
    const r = REQ.exec(line);
    if (r) {
      const name = r[1]!;
      current = { id: `${SPEC_SCHEME}${capability}#${name}`, capability, name, text: '', file: path, line: i + 1, status: change ? 'pending' : 'active', change, removedBy: [], scenarios: [] };
      requirements.push(current);
      wantText = true;
      continue;
    }
    const s = SCEN.exec(line);
    if (s && current) {
      current.scenarios.push({ id: `${current.id}#${s[1]!}`, name: s[1]!, file: path, line: i + 1 });
      wantText = false;
      continue;
    }
    if (current && wantText) {
      if (line.trim()) current.text = current.text ? `${current.text} ${line.trim()}` : line.trim();
      else if (current.text) wantText = false;
    }
  }
  return { requirements, removed };
}

/** Folder layout: `openspec/specs/<cap>/spec.md` or `openspec/changes/<change>/specs/<cap>/spec.md`. */
function locate(path: string): { capability: string; change: string | null } | null {
  const main = /(?:^|\/)openspec\/specs\/([^/]+)\/spec\.md$/.exec(path);
  if (main) return { capability: main[1]!, change: null };
  const delta = /(?:^|\/)openspec\/changes\/([^/]+)\/specs\/([^/]+)\/spec\.md$/.exec(path);
  if (delta && delta[1] !== 'archive') return { capability: delta[2]!, change: delta[1]! };
  return null;
}

/**
 * Every OpenSpec requirement and scenario of a project, addressable as
 * `openspec:<capability>#<requirement>[#<scenario>]`. Lookups ignore case and
 * collapse whitespace; a main-spec requirement wins over a pending one.
 */
// @lat: [[cli#Requirement trace]]
// @tg: implements:: [[openspec:tg-trace#OpenSpec reader]]
// @tg: implements:: [[openspec:tg-trace#Requirement ids]]
export class SpecIndex {
  private byKey = new Map<string, SpecRequirement>();
  private caps = new Map<string, string>();
  private all: SpecRequirement[] = [];

  constructor(files: SpecFile[] = []) {
    const main: SpecRequirement[] = [];
    const pending: SpecRequirement[] = [];
    const removed: { capability: string; name: string; change: string }[] = [];
    for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
      const at = locate(f.path);
      if (!at) continue;
      const p = parseSpec(f.path, f.text, at.capability, at.change);
      (at.change ? pending : main).push(...p.requirements);
      for (const name of p.removed) removed.push({ capability: at.capability, name, change: at.change! });
    }
    for (const r of [...main, ...pending]) {
      const key = `${norm(r.capability)}#${norm(r.name)}`;
      const shadowed = this.byKey.get(key);
      if (shadowed) {
        // A MODIFIED requirement keeps the main one, plus any scenario the change adds.
        for (const sc of r.scenarios) if (!shadowed.scenarios.some((x) => norm(x.name) === norm(sc.name))) shadowed.scenarios.push({ ...sc, id: `${shadowed.id}#${sc.name}` });
        continue;
      }
      this.byKey.set(key, r);
      this.all.push(r);
      if (!this.caps.has(norm(r.capability))) this.caps.set(norm(r.capability), r.capability);
    }
    for (const x of removed) this.byKey.get(`${norm(x.capability)}#${norm(x.name)}`)?.removedBy.push(x.change);
  }

  requirements(): SpecRequirement[] {
    return this.all;
  }

  /** Capability names as their folders spell them, sorted. */
  capabilities(): string[] {
    return [...this.caps.values()].sort();
  }

  hasCapability(name: string): boolean {
    return this.caps.has(norm(name));
  }

  /** Requirements of one capability, in file order. */
  ofCapability(name: string): SpecRequirement[] {
    const n = norm(name);
    return this.all.filter((r) => norm(r.capability) === n);
  }

  /** Resolve `openspec:cap#req[#scenario]`, or the same without the scheme. */
  resolve(target: string): SpecResolution {
    const body = isSpecTarget(target) ? target.slice(SPEC_SCHEME.length) : target;
    const [cap = '', req, ...rest] = body.split('#');
    const scenario = rest.length ? rest.join('#') : null;
    if (!this.hasCapability(cap)) {
      const near = closest(cap, [...this.caps.values()]);
      return { kind: 'missing', message: `no OpenSpec capability "${cap}"`, suggestion: near ? `${SPEC_SCHEME}${near}` : null };
    }
    if (!req) return { kind: 'missing', message: `"${target}" names a capability; add #<requirement>`, suggestion: null };
    const r = this.byKey.get(`${norm(cap)}#${norm(req)}`);
    if (!r) {
      const near = closest(req, this.ofCapability(cap).map((x) => x.name));
      return { kind: 'missing', message: `no requirement "${req}" in capability "${this.caps.get(norm(cap))}"`, suggestion: near ? `${SPEC_SCHEME}${this.caps.get(norm(cap))}#${near}` : null };
    }
    if (scenario === null) return { kind: 'requirement', requirement: r };
    const s = r.scenarios.find((x) => norm(x.name) === norm(scenario));
    if (s) return { kind: 'scenario', requirement: r, scenario: s };
    const near = closest(scenario, r.scenarios.map((x) => x.name));
    return { kind: 'missing', message: `no scenario "${scenario}" in requirement "${r.name}"`, suggestion: near ? `${r.id}#${near}` : null };
  }
}

/** The candidate nearest to `query` by edit distance, if reasonably close. */
function closest(query: string, candidates: string[]): string | null {
  const q = norm(query);
  let best: string | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = levenshtein(q, norm(c));
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best !== null && bestD <= Math.max(2, Math.floor(q.length * 0.4)) ? best : null;
}
