import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { expect, it } from 'vitest';
import { run, type Io } from '../src/cli.mjs';
import '../src/commands/index.mjs';
import { createTgMcpServer } from '../src/commands/mcp-server.mjs';

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), 'tg-agent-'));
  mkdirSync(join(dir, 'lat.md'));
  writeFileSync(join(dir, 'lat.md', 'lat.md'), '# Lat\n\nIndex.\n\n- [[auth]] — auth\n');
  writeFileSync(join(dir, 'lat.md', 'auth.md'), '# Auth\n\nHow login works.\n\n## Login\n\nCredentials are checked; see [[auth#Tokens]].\n\n## Tokens\n\nTokens expire.\n');
  return dir;
}

async function tg(cwd: string, args: string[], stdin = '') {
  let out = '';
  let err = '';
  const io: Io = { cwd, out: (t) => (out += t), err: (t) => (err += t), env: {}, stdin: () => stdin };
  const code = await run(args, io);
  return { code, out, err };
}

const read = (dir: string, p: string) => readFileSync(join(dir, p), 'utf8');

// @lat: [[tests/tg-agent#Safe init#Dry run]]
it('prints a diff and changes nothing without --write', async () => {
  const dir = project();
  const r = await tg(dir, ['init']);
  expect(r.code).toBe(0);
  expect(r.out).toContain('+++ b/CLAUDE.md');
  expect(r.out).toContain('+++ b/.claude/settings.json');
  expect(r.out).toContain('Dry run');
  expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(false);
  expect(existsSync(join(dir, '.claude'))).toBe(false);
});

// @lat: [[tests/tg-agent#Safe init#Idempotent write]]
it('writes once and then has nothing left to change', async () => {
  const dir = project();
  await tg(dir, ['init', '--write']);
  const first = read(dir, 'CLAUDE.md');
  const again = await tg(dir, ['init', '--write']);
  expect(again.out).toContain('already set up');
  expect(read(dir, 'CLAUDE.md')).toBe(first);
  const settings = JSON.parse(read(dir, '.claude/settings.json')) as { hooks: Record<string, unknown[]> };
  expect(settings.hooks.Stop).toHaveLength(1);
});

// @lat: [[tests/tg-agent#Migration from lat#Existing block detected]]
it('reports an existing lat block and leaves it alone without --migrate', async () => {
  const dir = project();
  writeFileSync(join(dir, 'CLAUDE.md'), '# Mine\n\nKeep me.\n\n%% lat:begin %%\nRun `lat search`.\n%% lat:end %%\n');
  const r = await tg(dir, ['init', '--write']);
  expect(r.out).toContain('--migrate');
  expect(read(dir, 'CLAUDE.md')).toContain('%% lat:begin %%');
});

// @lat: [[tests/tg-agent#Migration from lat#Migration applied]]
it('replaces the lat block, hooks and MCP entry with --write --migrate', async () => {
  const dir = project();
  writeFileSync(join(dir, 'CLAUDE.md'), '# Mine\n\nKeep me.\n\n%% lat:begin %%\nRun `lat search`.\n%% lat:end %%\n\nAfter.\n');
  mkdirSync(join(dir, '.claude'));
  writeFileSync(join(dir, '.claude/settings.json'), JSON.stringify({ model: 'x', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'lat hook claude Stop' }] }] } }));
  writeFileSync(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: { lat: { command: 'lat', args: ['mcp'] }, other: { command: 'o' } } }));
  await tg(dir, ['init', '--write', '--migrate']);
  const md = read(dir, 'CLAUDE.md');
  expect(md).not.toContain('lat:begin');
  expect(md).toContain('%% tg:begin %%');
  expect(md.startsWith('# Mine\n\nKeep me.\n\n')).toBe(true);
  expect(md.endsWith('\n\nAfter.\n')).toBe(true);
  const settings = JSON.parse(read(dir, '.claude/settings.json')) as { model: string; hooks: { Stop: { hooks: { command: string }[] }[] } };
  expect(settings.model).toBe('x');
  expect(settings.hooks.Stop.flatMap((e) => e.hooks.map((h) => h.command))).toEqual(['tg hook claude Stop']);
  const mcp = JSON.parse(read(dir, '.mcp.json')) as { mcpServers: Record<string, unknown> };
  expect(Object.keys(mcp.mcpServers).sort()).toEqual(['other', 'tg']);
});

// @lat: [[tests/tg-agent#Instruction generation#Generate]]
it('generates instructions that tell the agent to search first and check last', async () => {
  const r = await tg(mkdtempSync(join(tmpdir(), 'tg-gen-')), ['gen', 'claude.md']);
  expect(r.code).toBe(0);
  expect(r.out).toContain('tg search');
  expect(r.out).toContain('tg check');
  expect((await tg(process.cwd(), ['gen', 'nope'])).code).toBe(2);
});

// @lat: [[tests/tg-agent#Agent hooks#Prompt hook]]
it('the prompt hook reminds, expands refs and adds search hits', async () => {
  const dir = project();
  const r = await tg(dir, ['hook', 'claude', 'UserPromptSubmit'], JSON.stringify({ prompt: 'fix [[auth#Login]] and the token expiry' }));
  expect(r.code).toBe(0);
  const ctx = (JSON.parse(r.out) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } }).hookSpecificOutput;
  expect(ctx.hookEventName).toBe('UserPromptSubmit');
  expect(ctx.additionalContext).toContain('run `tg search`');
  expect(ctx.additionalContext).toContain('[[lat.md/auth#Auth#Login]]');
  expect(ctx.additionalContext).toContain('Search results for the user prompt');
});

// @lat: [[tests/tg-agent#Agent hooks#Internal failure]]
it('a hook outside any project exits 0 without blocking', async () => {
  const empty = mkdtempSync(join(tmpdir(), 'tg-nohook-'));
  const stop = await tg(empty, ['hook', 'claude', 'Stop'], '{}');
  expect(stop.code).toBe(0);
  expect(stop.out).toBe('');
  const bad = await tg(empty, ['hook', 'claude', 'UserPromptSubmit'], 'not json');
  expect(bad.code).toBe(0);
  expect(bad.out).toContain('run `tg search`');
});

// @lat: [[tests/tg-agent#MCP server#Cypher over docs and code]]
it('serves the tools over MCP and tg_cypher returns the tagged result contract', async () => {
  const dir = project();
  const server = createTgMcpServer(dir, { cwd: dir, out: () => undefined, err: () => undefined, env: {} });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 't', version: '0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  const tools = (await client.listTools()).tools.map((t) => t.name).sort();
  expect(tools).toEqual(['tg_check', 'tg_cypher', 'tg_edges', 'tg_expand', 'tg_locate', 'tg_refs', 'tg_search', 'tg_section']);
  const res = (await client.callTool({ name: 'tg_cypher', arguments: { query: 'MATCH (a:Section {title: \"Login\"})-[:references]->(b:Section) RETURN a, b.title' } })) as { content: { text: string }[] };
  const json = JSON.parse(res.content[0]!.text) as { columns: unknown[]; rows: Record<string, unknown>[][] };
  expect(json.rows).toHaveLength(1);
  expect(json.rows[0]![0]).toMatchObject({ _type: 'node', labels: ['Section'] });
  expect(json.rows[0]![1]).toBe('Tokens');
  const check = (await client.callTool({ name: 'tg_check', arguments: {} })) as { content: { text: string }[]; isError?: boolean };
  expect(check.content[0]!.text).toContain('All checks passed');
});

// @lat: [[tests/tg-agent#Bundled skills#Skills installed]]
it('installs both skills for Claude Code', async () => {
  const dir = project();
  await tg(dir, ['init', '--write']);
  expect(read(dir, '.claude/skills/tg-docs/SKILL.md')).toContain('name: tg-docs');
  expect(read(dir, '.claude/skills/tg-graph/SKILL.md')).toContain('name: tg-graph');
});

// @lat: [[tests/tg-agent#Code ontology#Ontology installed]]
it('installs the ontology note and schema, and the project still checks clean', async () => {
  const dir = project();
  await tg(dir, ['init', '--write']);
  expect(read(dir, 'lat.md/code-ontology.md')).toContain('# Code Ontology');
  expect(read(dir, 'ontology/code-types.md')).toContain('edgeTypes:');
  expect(read(dir, 'lat.md/lat.md')).toContain('[[code-ontology]]');
  const checked = await tg(dir, ['check']);
  expect(checked.err + checked.out).not.toContain('broken');
  expect(checked.code).toBe(0);
  const exported = await tg(dir, ['schema', 'export', 'shapes.ttl', '--schema-folder', 'ontology', '--json']);
  const report = JSON.parse(exported.out) as { types: number; edgeTypes: number; diagnostics: unknown[] };
  expect(report).toMatchObject({ types: 6, edgeTypes: 11, diagnostics: [] });
});

// @lat: [[tests/tg-agent#Code ontology#Ontology kept on re-run]]
it('does not overwrite an edited ontology note on a later init', async () => {
  const dir = project();
  await tg(dir, ['init', '--write']);
  writeFileSync(join(dir, 'lat.md/code-ontology.md'), '# Ours\n\nOur own words.\n');
  const again = await tg(dir, ['init', '--write']);
  expect(again.out).toContain('already set up');
  expect(read(dir, 'lat.md/code-ontology.md')).toBe('# Ours\n\nOur own words.\n');
});

// @lat: [[tests/tg-agent#Code ontology#Ontology opt-out]]
it('leaves the ontology out with --no-ontology', async () => {
  const dir = project();
  await tg(dir, ['init', '--write', '--no-ontology']);
  expect(existsSync(join(dir, 'lat.md/code-ontology.md'))).toBe(false);
  expect(existsSync(join(dir, 'ontology'))).toBe(false);
});
