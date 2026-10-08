import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findLuhmannParent, planNewNote, schemasFromGraph, splitFrontmatter, templatePath, type LuhmannParent, type NewNotePlan, type TypeSchema } from '@obsigraph/core';
import type { WorkspaceIndex } from './workspace-index';

/** Characters that cannot be part of a note title (they break file names and links). */
export const BAD_TITLE = /[\\/:*?"<>|#^[\]]/;

/** The types declared in the schema folder, by name. */
export function typesIn(index: WorkspaceIndex, schemaFolder: string): TypeSchema[] {
  return [...schemasFromGraph(index.graph, schemaFolder).schemas.values()].sort((a, b) => a.type.localeCompare(b.type));
}

/** The Luhmann id of a note, with the type that gives it meaning; null when it has none. */
export function luhmannParentOf(index: WorkspaceIndex, schemaFolder: string, path: string): LuhmannParent | null {
  return findLuhmannParent(index.graph, schemasFromGraph(index.graph, schemaFolder), path);
}

export interface NewNoteOptions {
  schemaFolder: string;
  type: string;
  title: string;
  /** Workspace-relative folder for the note, `''` for the workspace folder. */
  folder: string;
  parent?: LuhmannParent & { placement: 'child' | 'sibling' };
  /** Take the next top-level Luhmann number. */
  luhmann?: boolean;
  now?: Date;
}

async function bodyAt(workspace: string, path: string | null): Promise<string | null> {
  if (!path) return null;
  const text = await readFile(join(workspace, path), 'utf8').catch(() => null);
  return text === null ? null : splitFrontmatter(text).body;
}

/**
 * Plan a note of a declared type: its path in the workspace and its content,
 * with ids and template tokens filled in. Reads templates from disk; writes nothing.
 */
// @lat: [[vscode#Creating notes]]
export async function planWorkspaceNote(index: WorkspaceIndex, workspace: string, opts: NewNoteOptions): Promise<NewNotePlan & { path: string }> {
  const schema = schemasFromGraph(index.graph, opts.schemaFolder).schemas.get(opts.type);
  if (!schema) throw new Error(`No type '${opts.type}' in ${opts.schemaFolder}`);
  if (!opts.title.trim() || BAD_TITLE.test(opts.title)) throw new Error(`"${opts.title}" cannot be used as a note title`);
  const linkedBody = await bodyAt(workspace, schema.template ? templatePath(schema.template, schema.path, (link, from) => index.graph.resolveLink(link, from)) : null);
  const schemaBody = (await bodyAt(workspace, schema.path)) ?? '';
  const plan = planNewNote({ schema, title: opts.title.trim(), linkedBody, schemaBody, graph: index.graph, parent: opts.parent, luhmann: opts.luhmann, now: opts.now });
  const folder = opts.folder.replace(/^\/+|\/+$/g, '');
  return { ...plan, path: folder ? `${folder}/${plan.fileName}` : plan.fileName };
}
