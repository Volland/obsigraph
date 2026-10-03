import { NodeRef, RelRef, type QueryResult, type Value } from '@obsigraph/core';

/** Plain-text form of a value for table cells. */
export function cellText(v: Value): string {
  if (v === null) return '';
  if (v instanceof NodeRef) return String(v.node.props.title ?? v.id);
  if (v instanceof RelRef) return `${v.edge.sign < 0 ? '−' : ''}${v.edge.type}`;
  if (Array.isArray(v)) return v.map(cellText).join(', ');
  if (typeof v === 'object') return JSON.stringify(v, (_k, x) => (x instanceof NodeRef || x instanceof RelRef ? cellText(x) : x));
  return String(v);
}

/** Render a result as a table; node cells link to their notes. */
export function renderTable(
  parent: HTMLElement,
  result: QueryResult,
  indexes: number[],
  openNote: (path: string) => void,
): HTMLTableElement {
  const table = parent.createEl('table', { cls: 'obsigraph-table' });
  const head = table.createEl('thead').createEl('tr');
  for (const i of indexes) head.createEl('th', { text: result.columns[i]!.name });
  const body = table.createEl('tbody');
  for (const row of result.rows) {
    const tr = body.createEl('tr');
    for (const i of indexes) {
      const td = tr.createEl('td');
      appendValue(td, row[i] ?? null, openNote);
    }
  }
  if (result.rows.length === 0) {
    body.createEl('tr').createEl('td', { text: 'No results', cls: 'obsigraph-empty', attr: { colspan: String(indexes.length) } });
  }
  return table;
}

function appendValue(td: HTMLElement, v: Value, openNote: (path: string) => void): void {
  if (v instanceof NodeRef && !v.node.stub) {
    const a = td.createEl('a', { text: cellText(v), cls: 'internal-link', href: v.id });
    a.addEventListener('click', (e) => {
      e.preventDefault();
      openNote(v.id);
    });
    return;
  }
  if (v instanceof RelRef) {
    td.createSpan({ text: cellText(v), cls: v.edge.sign < 0 ? 'obsigraph-negative' : '', attr: { title: v.id } });
    return;
  }
  if (Array.isArray(v) && v.some((x) => x instanceof NodeRef)) {
    v.forEach((x, i) => {
      if (i > 0) td.appendText(', ');
      appendValue(td, x, openNote);
    });
    return;
  }
  td.setText(cellText(v));
}
