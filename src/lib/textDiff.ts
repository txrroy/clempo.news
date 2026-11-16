export interface DiffToken {
  type: 'equal' | 'removed' | 'added';
  text: string;
}

/**
 * Computes a compact word-level diff between two draft strings so editors
 * can see what changed between Draft 1 and Draft 2 after autonomous retry.
 */
export function computeWordDiff(beforeText: string, afterText: string): DiffToken[] {
  const a = beforeText.trim().split(/\s+/).filter(Boolean);
  const b = afterText.trim().split(/\s+/).filter(Boolean);

  if (a.length === 0 && b.length === 0) return [];
  if (a.length === 0) return [{ type: 'added', text: b.join(' ') }];
  if (b.length === 0) return [{ type: 'removed', text: a.join(' ') }];

  const m = a.length;
  const n = b.length;

  // Classic LCS table (drafts are short ~10-120 words, so O(m*n) is <1ms).
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const raw: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      raw.push({ type: 'equal', text: a[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ type: 'removed', text: a[i] });
      i += 1;
    } else {
      raw.push({ type: 'added', text: b[j] });
      j += 1;
    }
  }
  while (i < m) {
    raw.push({ type: 'removed', text: a[i] });
    i += 1;
  }
  while (j < n) {
    raw.push({ type: 'added', text: b[j] });
    j += 1;
  }

  // Coalesce adjacent tokens of the same type for clean rendering.
  const merged: DiffToken[] = [];
  for (const tok of raw) {
    const prev = merged[merged.length - 1];
    if (prev && prev.type === tok.type) {
      prev.text = `${prev.text} ${tok.text}`;
    } else {
      merged.push({ ...tok });
    }
  }
  return merged;
}
