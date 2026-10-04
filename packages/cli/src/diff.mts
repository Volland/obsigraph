/** Unified-style diff of two texts, enough to review what `tg init` would change. */
export function unifiedDiff(path: string, before: string | null, after: string): string {
  const a = before === null ? [] : before.split('\n');
  const b = after.split('\n');
  const head = [`--- ${before === null ? '/dev/null' : `a/${path}`}`, `+++ b/${path}`];
  // Longest common subsequence over lines; docs and configs are small.
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const body: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      body.push(` ${a[i]}`);
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) body.push(`-${a[i++]}`);
    else body.push(`+${b[j++]}`);
  }
  while (i < n) body.push(`-${a[i++]}`);
  while (j < m) body.push(`+${b[j++]}`);
  // Keep three lines of context around changes.
  const keep = new Set<number>();
  body.forEach((l, idx) => {
    if (l[0] !== ' ') for (let k = Math.max(0, idx - 3); k <= Math.min(body.length - 1, idx + 3); k++) keep.add(k);
  });
  const out: string[] = [];
  let last = -1;
  body.forEach((l, idx) => {
    if (!keep.has(idx)) return;
    if (last !== -1 && idx !== last + 1) out.push('@@');
    out.push(l);
    last = idx;
  });
  return [...head, ...out].join('\n');
}
