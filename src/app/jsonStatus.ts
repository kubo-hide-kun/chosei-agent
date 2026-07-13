export type JsonSyntaxStatus = { state: 'empty' | 'valid' | 'invalid'; message: string };

/** テキストエリアの JSON 構文を即時チェックし、送信前に OK / NG を表示するための共通ロジック */
export function checkJsonSyntax(text: string): JsonSyntaxStatus {
  if (text.trim().length === 0) return { state: 'empty', message: '' };
  try {
    JSON.parse(text);
    return { state: 'valid', message: '✓ JSON の構文は有効です' };
  } catch (e) {
    return { state: 'invalid', message: `JSON の構文エラー: ${(e as Error).message}` };
  }
}
