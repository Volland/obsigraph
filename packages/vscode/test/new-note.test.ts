import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { luhmannParentOf, planWorkspaceNote, typesIn } from '../src/new-note';
import { WorkspaceIndex } from '../src/workspace-index';
import { workspace } from './index.test';

const FILES: Record<string, string> = {
  'Types/Idea.md': '---\ntgs: "0.2"\nschemas:\n  Idea:\n    id:\n      - {kind: uuid7, property: uid}\n      - {kind: luhmann, property: luhmann}\n    template: "[[Templates/Idea]]"\n---\nIdeas.\n',
  'Templates/Idea.md': 'Idea {{title}} on {{date}} ({{luhmann}})\n\nfollows:: {{parent-link}} {luhmann: "{{luhmann}}"}\n',
  'Ideas/Root.md': '---\ntype: Idea\nluhmann: "1"\n---\nRoot idea.\n',
  'Ideas/Leaf.md': '---\ntype: Idea\nluhmann: "1a"\n---\nA leaf.\n',
  'Ideas/Plain.md': 'No type here.\n',
};

async function open() {
  const dir = workspace(FILES);
  const idx = new WorkspaceIndex({ workspace: dir, roots: ['.'], ignore: ['node_modules'] });
  await idx.load();
  return { dir, idx };
}

// @lat: [[tests/vscode-extension#Creating notes#Plan from a type]]
it('plans a note of a declared type with ids and its template, and refuses bad input', async () => {
  const { dir, idx } = await open();
  expect(typesIn(idx, 'Types/').map((t) => t.type)).toEqual(['Idea']);
  const plan = await planWorkspaceNote(idx, dir, { schemaFolder: 'Types/', type: 'Idea', title: 'Fresh thought', folder: 'Ideas/', now: new Date(2026, 0, 12, 9, 0) });
  expect(plan.path).toBe('Ideas/Fresh thought.md');
  expect(plan.ids.uid).toMatch(/^[0-9a-f-]{36}$/);
  expect(plan.ids.luhmann).toBeUndefined();
  expect(plan.content).toContain(`uid: ${plan.ids.uid}`);
  expect(plan.content).toContain('Idea Fresh thought on 2026-01-12 ({{luhmann}})');
  expect(plan.content).not.toContain('follows');
  await expect(planWorkspaceNote(idx, dir, { schemaFolder: 'Types/', type: 'Nope', title: 'x', folder: '' })).rejects.toThrow(/No type 'Nope'/);
  await expect(planWorkspaceNote(idx, dir, { schemaFolder: 'Types/', type: 'Idea', title: 'a/b', folder: '' })).rejects.toThrow(/cannot be used/);
  expect(() => readFileSync(`${dir}/Ideas/Fresh thought.md`)).toThrow();
});

// @lat: [[tests/vscode-extension#Creating notes#Luhmann branch from a note]]
it('branches a child or sibling from the active note with the next free Luhmann id', async () => {
  const { dir, idx } = await open();
  const parent = luhmannParentOf(idx, 'Types/', 'Ideas/Root.md')!;
  expect(parent).toMatchObject({ id: '1', type: 'Idea', property: 'luhmann', title: 'Root' });
  expect(luhmannParentOf(idx, 'Types/', 'Ideas/Plain.md')).toBeNull();
  const child = await planWorkspaceNote(idx, dir, { schemaFolder: 'Types/', type: 'Idea', title: 'Child', folder: 'Ideas', parent: { ...parent, placement: 'child' } });
  expect(child.ids.luhmann).toBe('1b');
  expect(child.content).toContain('follows:: [[Root]] {luhmann: "1b"}');
  const sibling = await planWorkspaceNote(idx, dir, { schemaFolder: 'Types/', type: 'Idea', title: 'Sib', folder: 'Ideas', parent: { ...parent, placement: 'sibling' } });
  expect(sibling.ids.luhmann).toBe('2');
});
