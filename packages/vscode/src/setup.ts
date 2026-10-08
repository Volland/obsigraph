import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Files `tg init --agent claude` creates or changes in a fresh project; verified against the CLI by a test. */
export const SETUP_FILES = ['lat.md/lat.md', 'CLAUDE.md', '.claude/settings.json', '.mcp.json', '.claude/skills/tg-docs/SKILL.md', '.claude/skills/tg-graph/SKILL.md', 'lat.md/code-ontology.md', 'ontology/code-types.md'] as const;

/** True when the workspace lacks `lat.md/` or any tg-managed instruction block. */
// @tg: implements:: [[openspec:vscode-extension#Set up TypeGraph]]
export function needsSetup(workspace: string): boolean {
  if (!existsSync(join(workspace, 'lat.md'))) return true;
  for (const doc of ['CLAUDE.md', 'AGENTS.md']) {
    try {
      if (readFileSync(join(workspace, doc), 'utf8').includes('%% tg:begin %%')) return false;
    } catch {
      // missing file: keep looking
    }
  }
  return !existsSync(join(workspace, '.cursor/rules/tg.mdc'));
}

/** Prefer a global `tg`; otherwise run the published CLI through npx. */
export function setupCommand(hasGlobalTg: boolean): string {
  return hasGlobalTg ? 'tg init --write' : 'npx @typedgraph/cli init --write';
}

export interface SetupDeps {
  hasGlobalTg: () => boolean;
  /** Show the files and ask; resolves true to proceed. */
  confirm: (files: readonly string[], command: string) => Promise<boolean>;
  runInTerminal: (command: string) => void;
}

/** Ask first, then run in a visible terminal; declining runs nothing. Returns whether a command was started. */
// @lat: [[vscode#Set up TypeGraph]]
// @tg: implements:: [[openspec:vscode-extension#Set up TypeGraph]]
export async function runSetup(deps: SetupDeps): Promise<boolean> {
  const command = setupCommand(deps.hasGlobalTg());
  if (!(await deps.confirm(SETUP_FILES, command))) return false;
  deps.runInTerminal(command);
  return true;
}
