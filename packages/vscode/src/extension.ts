import { spawnSync } from 'node:child_process';
import { posix } from 'node:path';
import * as vscode from 'vscode';
import { backlinksFor, type BacklinkGroup, type BacklinkItem } from './backlinks';
import { GraphSession } from './graph-session';
import { BAD_TITLE, luhmannParentOf, planWorkspaceNote, typesIn } from './new-note';
import { needsSetup, runSetup } from './setup';
import { WorkspaceIndex } from './workspace-index';

const SOURCE_GLOB = '**/*.{md,ts,tsx,js,jsx,py,rs,go,c,h,mts,cts,mjs,cjs}';

type Node = { kind: 'group'; group: BacklinkGroup } | { kind: 'item'; item: BacklinkItem; folder: string } | { kind: 'empty'; text: string };

/** Thin VS Code adapter: everything it shows is computed by the pure modules next to it. */
export function activate(context: vscode.ExtensionContext): void {
  const folder = vscode.workspace.workspaceFolders?.[0];
  const changed = new vscode.EventEmitter<void>();
  let index: WorkspaceIndex | null = null;
  let loading: Promise<void> | null = null;
  let panel: vscode.WebviewPanel | null = null;
  const session = new GraphSession(() => index!.graph);

  const settings = () => {
    const c = vscode.workspace.getConfiguration('typegraph');
    return { roots: c.get<string[]>('roots', ['.']), ignore: c.get<string[]>('ignore', ['node_modules']) };
  };
  const schemaFolder = () => vscode.workspace.getConfiguration('typegraph').get<string>('schemaFolder', 'Types/');

  const activePath = (): string | null => {
    const doc = vscode.window.activeTextEditor?.document;
    if (!doc || !folder || doc.uri.scheme !== 'file') return null;
    const rel = vscode.workspace.asRelativePath(doc.uri, false);
    return rel.startsWith('..') ? null : rel.split('\\').join('/');
  };

  const refreshContext = () => {
    if (folder) void vscode.commands.executeCommand('setContext', 'typegraph.needsSetup', needsSetup(folder.uri.fsPath));
  };

  const ensureLoaded = (): Promise<void> => {
    if (!folder) return Promise.resolve();
    if (!loading) {
      index = new WorkspaceIndex({ workspace: folder.uri.fsPath, ...settings() });
      loading = index.load().then(() => changed.fire());
    }
    return loading;
  };

  const reload = () => {
    loading = null;
    index = null;
    void ensureLoaded();
  };

  let timer: NodeJS.Timeout | undefined;
  const touched = (uri: vscode.Uri, deleted: boolean) => {
    if (!folder || !index) return;
    const rel = vscode.workspace.asRelativePath(uri, false).split('\\').join('/');
    const task = deleted ? Promise.resolve(index.remove(rel)) : index.update(rel);
    void task.then(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        changed.fire();
        postGraph();
        refreshContext();
      }, 150);
    });
  };

  const tree: vscode.TreeDataProvider<Node> = {
    onDidChangeTreeData: changed.event,
    getTreeItem(n) {
      if (n.kind === 'empty') return new vscode.TreeItem(n.text);
      if (n.kind === 'group') {
        const t = new vscode.TreeItem(`${n.group.title} (${n.group.items.length})`, vscode.TreeItemCollapsibleState.Expanded);
        t.iconPath = new vscode.ThemeIcon('symbol-event');
        return t;
      }
      const i = n.item;
      const t = new vscode.TreeItem(`${i.sign === -1 ? '− ' : ''}${i.label}`);
      const props = Object.entries(i.props).map(([k, v]) => `${k}: ${String(v)}`).join(', ');
      t.description = [i.target, props].filter(Boolean).join('  ');
      t.tooltip = `${i.path}:${i.line}`;
      t.iconPath = new vscode.ThemeIcon(i.sign === -1 ? 'circle-slash' : i.sign === null ? 'file-code' : 'file');
      t.command = { command: 'vscode.open', title: 'Open', arguments: [vscode.Uri.joinPath(vscode.Uri.file(n.folder), i.path), { selection: new vscode.Range(Math.max(0, i.line - 1), 0, Math.max(0, i.line - 1), 0) }] };
      return t;
    },
    async getChildren(n) {
      if (!folder) return [{ kind: 'empty', text: 'Open a folder to see backlinks.' }];
      await ensureLoaded();
      if (n?.kind === 'group') return n.group.items.map((item) => ({ kind: 'item', item, folder: folder.uri.fsPath }));
      if (n) return [];
      const path = activePath();
      if (!path || !index) return [{ kind: 'empty', text: 'Open a markdown or source file.' }];
      const r = backlinksFor(index, path);
      if (r.kind === 'empty') return [{ kind: 'empty', text: `No typed edges for ${posix.basename(path)}.` }];
      return r.groups.map((group) => ({ kind: 'group', group }));
    },
  };

  const postGraph = () => {
    if (!panel || !index) return;
    void panel.webview.postMessage({ type: 'elements', elements: session.elements(activePath()) });
  };

  const openGraph = async () => {
    if (!folder) return;
    await ensureLoaded();
    if (panel) {
      panel.reveal();
      return postGraph();
    }
    const dist = vscode.Uri.joinPath(context.extensionUri, 'dist');
    panel = vscode.window.createWebviewPanel('typegraph.graph', 'TypeGraph', vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [dist] });
    const script = panel.webview.asWebviewUri(vscode.Uri.joinPath(dist, 'webview.js'));
    const nonce = Math.random().toString(36).slice(2);
    panel.webview.html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"></head><body style="margin:0"><div id="graph" style="height:100vh"></div><script nonce="${nonce}" src="${script}"></script></body></html>`;
    panel.webview.onDidReceiveMessage((m: { type: string; id?: string; path?: string }) => {
      if (m.type === 'ready') postGraph();
      else if (m.type === 'expand' && m.id) {
        session.expand(m.id);
        postGraph();
      } else if (m.type === 'open' && m.path) void vscode.commands.executeCommand('vscode.open', vscode.Uri.joinPath(folder.uri, m.path));
    });
    panel.onDidDispose(() => (panel = null));
  };

  const setup = async () => {
    if (!folder) return;
    await runSetup({
      hasGlobalTg: () => spawnSync('tg', ['--version'], { cwd: folder.uri.fsPath, shell: process.platform === 'win32' }).status === 0,
      confirm: async (files, command) => {
        const pick = await vscode.window.showInformationMessage(`Run "${command}" in a terminal?`, { modal: true, detail: `These files will be created or changed:\n\n${files.join('\n')}\n\ntg init never overwrites other content in them.` }, 'Run');
        return pick === 'Run';
      },
      runInTerminal: (command) => {
        const t = vscode.window.createTerminal({ name: 'TypeGraph setup', cwd: folder.uri.fsPath });
        t.show();
        t.sendText(command);
      },
    });
  };

  /** Create a note from a type, refusing to overwrite, and open it. */
  const createNote = async (opts: { type: string; title: string; folder: string; parent?: Parameters<typeof planWorkspaceNote>[2]['parent']; luhmann?: boolean }) => {
    if (!folder || !index) return;
    try {
      const plan = await planWorkspaceNote(index, folder.uri.fsPath, { schemaFolder: schemaFolder(), ...opts });
      const uri = vscode.Uri.joinPath(folder.uri, ...plan.path.split('/'));
      const exists = await vscode.workspace.fs.stat(uri).then(() => true, () => false);
      if (exists) return void vscode.window.showWarningMessage(`${plan.path} already exists; nothing was changed.`);
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
      await vscode.workspace.fs.writeFile(uri, Buffer.from(plan.content, 'utf8'));
      await vscode.window.showTextDocument(uri);
    } catch (e) {
      void vscode.window.showErrorMessage((e as Error).message);
    }
  };

  const askTitle = (prompt: string) =>
    vscode.window.showInputBox({ prompt, validateInput: (v) => (v.trim() && !BAD_TITLE.test(v) ? null : 'Enter a title without \\ / : * ? " < > | # ^ [ ]') });

  /** The folder to create in: the one given by the Explorer, else the active note's folder. */
  const targetFolder = async (uri?: vscode.Uri): Promise<string> => {
    if (!folder) return '';
    let base: vscode.Uri | null = uri ?? vscode.window.activeTextEditor?.document.uri ?? null;
    if (base && uri && !(await vscode.workspace.fs.stat(uri).then((s) => s.type === vscode.FileType.Directory, () => false))) base = vscode.Uri.joinPath(uri, '..');
    else if (base && !uri) base = vscode.Uri.joinPath(base, '..');
    if (!base || base.scheme !== 'file') return '';
    const rel = vscode.workspace.asRelativePath(base, false).split('\\').join('/');
    return rel.startsWith('..') || rel === base.fsPath ? '' : rel;
  };

  const newNote = async (uri?: vscode.Uri) => {
    if (!folder) return;
    await ensureLoaded();
    const types = typesIn(index!, schemaFolder());
    if (types.length === 0) return void vscode.window.showInformationMessage(`No schema notes found in ${schemaFolder()}. Set typegraph.schemaFolder or add types.`);
    const pick = await vscode.window.showQuickPick(
      types.map((t) => ({ label: t.type, description: t.ids.map((r) => `${r.kind}${r.auto ? '' : ' on request'}`).join(', '), detail: t.properties.map((p) => p.name).join(', '), type: t.type })),
      { placeHolder: 'Choose a type', matchOnDetail: true },
    );
    if (!pick) return;
    const title = await askTitle(`New ${pick.type}`);
    if (title) await createNote({ type: pick.type, title: title.trim(), folder: await targetFolder(uri) });
  };

  const newLuhmann = async (placement: 'child' | 'sibling') => {
    const path = activePath();
    if (!folder || !path) return void vscode.window.showInformationMessage('Open a note with a Luhmann id first.');
    await ensureLoaded();
    const parent = luhmannParentOf(index!, schemaFolder(), path);
    if (!parent) return void vscode.window.showInformationMessage('This note has no Luhmann id. Its type needs `id: {kind: luhmann, property: ...}` and a value for it.');
    const title = await askTitle(`New ${placement} of ${parent.title} (${parent.id})`);
    if (title) await createNote({ type: parent.type, title: title.trim(), folder: await targetFolder(), parent: { ...parent, placement } });
  };

  const watcher = vscode.workspace.createFileSystemWatcher(SOURCE_GLOB);
  context.subscriptions.push(
    vscode.window.createTreeView('typegraph.backlinks', { treeDataProvider: tree }),
    watcher,
    watcher.onDidChange((u) => touched(u, false)),
    watcher.onDidCreate((u) => touched(u, false)),
    watcher.onDidDelete((u) => touched(u, true)),
    vscode.window.onDidChangeActiveTextEditor(() => {
      changed.fire();
      postGraph();
    }),
    vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('typegraph') && reload()),
    vscode.commands.registerCommand('typegraph.openGraph', openGraph),
    vscode.commands.registerCommand('typegraph.setup', setup),
    vscode.commands.registerCommand('typegraph.refresh', reload),
    vscode.commands.registerCommand('typegraph.newNote', newNote),
    vscode.commands.registerCommand('typegraph.newChildNote', () => newLuhmann('child')),
    vscode.commands.registerCommand('typegraph.newSiblingNote', () => newLuhmann('sibling')),
    changed,
  );
  refreshContext();
}

export function deactivate(): void {}
