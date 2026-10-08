import type { GraphNode, QueryResult } from '@obsigraph/core';
import { elementCount, excludeCode, toElements, type GraphElements } from '../render/elements';
import { chooseView, selectColumns, type BlockOptions } from './block';

export type RenderPlan =
  | { kind: 'graph'; elements: GraphElements; notices: string[] }
  | { kind: 'table'; indexes: number[]; notice: string | null; notices: string[] }
  | { kind: 'error'; messages: string[] };

/**
 * Decide how to show a query result: graph or table by result shape and the
 * `view` option, with a table fallback when the graph exceeds the element cap.
 */
// @lat: [[query-engine#Query block]]
// @tg: implements:: [[openspec:code-layer#Visible on demand]]
// @tg: implements:: [[openspec:graph-query-block#Large results are bounded]]
// @tg: implements:: [[openspec:graph-query-block#Renderer chosen by result shape]]
export function planRender(
  result: QueryResult,
  options: BlockOptions,
  maxElements: number,
  lookup: (id: string) => GraphNode | undefined,
): RenderPlan {
  const view = chooseView(result, options.view);
  const table = (notice: string | null): RenderPlan => {
    const { indexes, errors } = selectColumns(result, options.columns);
    return errors.length > 0 ? { kind: 'error', messages: errors } : { kind: 'table', indexes, notice, notices: result.notices ?? [] };
  };
  if (view === 'table') return table(null);

  const shown = toElements(result, lookup);
  const elements = options.code === 'hide' ? excludeCode(shown) : shown;
  const count = elementCount(elements);
  if (count > maxElements) {
    return table(`Graph has ${count} elements, above the limit of ${maxElements}; showing a table. Narrow the query or raise the limit in settings.`);
  }
  return { kind: 'graph', elements, notices: result.notices ?? [] };
}
