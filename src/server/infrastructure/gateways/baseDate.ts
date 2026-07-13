const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** Claude への基準日文字列(相対表現の解決に使う)。例: "2026-07-13 (月)" */
export function formatBaseDate(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')} (${WEEKDAYS[now.getDay()]})`;
}
