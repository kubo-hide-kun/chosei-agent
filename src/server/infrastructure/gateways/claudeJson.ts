/**
 * Claude のテキスト応答から JSON を取り出して parse する。
 *
 * Node の SyntaxError メッセージには入力の断片が含まれるため、そのまま投げると
 * ユーザーの自然文(名前など PII)由来のモデル出力がフォールバックログに流出する。
 * ここで捕捉し、内容を含まない固定メッセージに差し替える(ADR 0008: PII をログに残さない)。
 */
export class ClaudeJsonParseError extends Error {
  /** 応答テキストの文字数(内容そのものは含まない診断用フィールド) */
  readonly rawLength: number;
  /** Claude API のレスポンスの stop_reason(呼び出し元が分かれば設定する) */
  stopReason?: string;

  constructor(rawLength: number) {
    super('Claude 応答を JSON として解析できませんでした');
    this.name = 'ClaudeJsonParseError';
    this.rawLength = rawLength;
  }
}

export function parseClaudeJson(text: string): unknown {
  const stripped = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return JSON.parse(extractJsonCandidate(stripped));
  } catch {
    throw new ClaudeJsonParseError(text.length);
  }
}

/**
 * モデルが指示に反して JSON の前後に説明文を付けた場合に備え、
 * 最初の `{`/`[` から対応する最後の `}`/`]` までを抜き出す。
 */
function extractJsonCandidate(text: string): string {
  const trimmed = text.trim();
  const first = trimmed.search(/[{[]/);
  if (first === -1) return trimmed;
  const closing = trimmed[first] === '{' ? '}' : ']';
  const last = trimmed.lastIndexOf(closing);
  if (last === -1 || last < first) return trimmed;
  return trimmed.slice(first, last + 1);
}
