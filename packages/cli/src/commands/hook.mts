import { execSync } from 'node:child_process';
import { buildSearchDocs, checkLattice, LexicalIndex, SOURCE_EXTENSIONS } from '@obsigraph/core';
import { run, EXIT_OK, register, type Command, type Ctx, type Io } from '../cli.mjs';
import { Project } from '../project.mjs';
import { findRoot } from '../root.mjs';

const REMINDER = [
  "Before starting work, run `tg search` with one or more queries describing the user's intent.",
  'ALWAYS do this, even when the task seems straightforward — search results may reveal critical design details, protocols, or constraints.',
  'Use `tg section` to read the full content of relevant matches.',
  'Do not read files, write code, or run commands until you have searched.',
  '',
  'Remember: `lat.md/` must stay in sync with the codebase. If you change code, update the relevant sections in `lat.md/` and run `tg check` before finishing.',
];

/** Minimum code change (lines) before a missing lat.md/ update is flagged, and the ratio below which it is. */
const DIFF_THRESHOLD = 5;
const LATMD_RATIO = 0.05;
const LATMD_UPPER = 50;

function capture(io: Io): { io: Io; text: () => string } {
  let out = '';
  return { io: { ...io, out: (t) => (out += t), err: () => undefined }, text: () => out };
}

// @tg: implements:: [[openspec:tg-agent-integration#Agent hooks]]
async function promptSubmit(ctx: Ctx, root: string | null): Promise<string> {
  const parts = [...REMINDER];
  let prompt = '';
  try {
    const input = JSON.parse(ctx.stdin?.() ?? '{}') as { prompt?: string; user_prompt?: string };
    prompt = input.prompt ?? input.user_prompt ?? '';
  } catch {
    // Unparseable input still gets the reminder.
  }
  if (root && prompt) {
    if (/\[\[[^\]]+\]\]/.test(prompt)) {
      const c = capture({ ...ctx, cwd: root });
      const code = await run(['expand', prompt], c.io);
      parts.push('', code === 0 ? `Expanded user prompt with resolved [[refs]]:\n${c.text()}` : 'NOTE: The user prompt contains [[refs]] but they could not be resolved. Ask the user to correct them.');
    }
    try {
      const project = new Project(root);
      const hits = new LexicalIndex(buildSearchDocs(project.index(), (p) => project.text(p))).search(prompt, 3);
      if (hits.length) {
        parts.push('', `Search results for the user prompt (${hits.length} matches):`, '', ...hits.map((h) => `* [[${h.id}]] (${h.doc.file}:${h.doc.startLine}-${h.doc.endLine}) — ${h.doc.summary.split('\n')[0]}`));
      }
    } catch {
      // The agent can still search by hand.
    }
  }
  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: parts.join('\n') } });
}

function diffLines(root: string): { code: number; latmd: number } {
  let out: string;
  try {
    out = execSync('git diff HEAD --numstat', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return { code: 0, latmd: 0 };
  }
  let code = 0;
  let latmd = 0;
  for (const line of out.split('\n')) {
    const [a, d, file] = line.split('\t');
    if (!file) continue;
    const n = (parseInt(a!, 10) || 0) + (parseInt(d!, 10) || 0);
    if (file.startsWith('lat.md/')) latmd += n;
    else if (SOURCE_EXTENSIONS.has(file.slice(file.lastIndexOf('.')))) code += n;
  }
  return { code, latmd };
}

function stopReason(root: string): { reason: string | null; errors: number } {
  const project = new Project(root);
  const findings = checkLattice({
    index: project.index(),
    annotations: project.annotations().annotations,
    latEntries: project.latEntries(),
    latDirName: 'lat.md',
    readLatFile: (rel) => project.text(`lat.md/${rel}`),
    checkSourceLink: (f, s) => project.checkSourceLink(f, s),
    specs: project.specIndex(),
  });
  const { code, latmd } = diffLines(root);
  const needsSync = code >= DIFF_THRESHOLD && latmd < LATMD_UPPER && latmd < code * LATMD_RATIO;
  if (!findings.length && !needsSync) return { reason: null, errors: 0 };
  const sync = latmd === 0 ? `The codebase has changes (${code} lines) but \`lat.md/\` was not updated.` : `The codebase has changes (${code} lines) but \`lat.md/\` may not be fully in sync (${latmd} lines changed).`;
  let reason: string;
  if (findings.length && needsSync) reason = `\`tg check\` found errors. ${sync} Before finishing:\n\n1. Update \`lat.md/\` to reflect your code changes — run \`tg search\` to find relevant sections.\n2. Run \`tg check\` until it passes.`;
  else if (findings.length) reason = `\`tg check\` found ${findings.length} error(s). Run \`tg check\`, fix the errors, and repeat until it passes.`;
  else reason = `${sync} Verify \`lat.md/\` is in sync — run \`tg search\` to find relevant sections. Run \`tg check\` at the end.`;
  return { reason, errors: findings.length };
}

// @tg: implements:: [[openspec:tg-agent-integration#Agent hooks]]
export const hook: Command = {
  name: 'hook',
  summary: 'Handle agent hook events (called by agent hooks, not directly)',
  usage: 'hook <claude|cursor> <event>',
  noProject: true,
  async run(ctx, args) {
    const [agent, event] = args;
    try {
      const root = findRoot(ctx.cwd);
      if (agent === 'claude' && event === 'UserPromptSubmit') {
        ctx.out(await promptSubmit(ctx, root));
      } else if (agent === 'claude' && event === 'Stop') {
        if (!root) return EXIT_OK;
        let active = false;
        try {
          active = Boolean((JSON.parse(ctx.stdin?.() ?? '{}') as { stop_hook_active?: boolean }).stop_hook_active);
        } catch {
          // First attempt.
        }
        const { reason, errors } = stopReason(root);
        if (active) {
          if (errors) ctx.err(`tg check is still failing (${errors} error(s)). Run \`tg check\` to see details.\n`);
        } else if (reason) ctx.out(JSON.stringify({ decision: 'block', reason }));
      } else if (agent === 'cursor' && event === 'stop') {
        if (!root) return EXIT_OK;
        const { reason } = stopReason(root);
        if (reason) ctx.out(JSON.stringify({ followup_message: reason }));
      } else {
        ctx.err(`unknown hook "${agent ?? ''} ${event ?? ''}"; supported: claude UserPromptSubmit, claude Stop, cursor stop\n`);
      }
    } catch (e) {
      // A hook must never block the agent.
      ctx.err(`tg hook: ${(e as Error).message}\n`);
    }
    return EXIT_OK;
  },
};

register(hook);
