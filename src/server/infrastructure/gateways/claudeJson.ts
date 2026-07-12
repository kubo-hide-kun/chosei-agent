/**
 * Claude のテキスト応答から JSON を取り出して parse する。
 *
 * Node の SyntaxError メッセージには入力の断片が含まれるため、そのまま投げると
 * ユーザーの自然文(名前など PII)由来のモデル出力がフォールバックログに流出する。
 * ここで捕捉し、内容を含まない固定メッセージに差し替える(ADR 0008: PII をログに残さない)。
 */
export function parseClaudeJson(text: string): unknown {
  const raw = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Claude 応答を JSON として解析できませんでした');
  }
}
