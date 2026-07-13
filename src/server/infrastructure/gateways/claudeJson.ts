/**
 * Claude のテキスト応答から JSON を取り出して parse する。
 *
 * Node の SyntaxError メッセージには入力の断片が含まれるため、そのまま投げると
 * ユーザーの自然文(名前など PII)由来のモデル出力がフォールバックログに流出する。
 * ここで捕捉し、内容を含まない固定メッセージに差し替える(ADR 0008: PII をログに残さない)。
 *
 * `rawResponse` は例外に保持するが、これ自体はログに出さない。呼び出し元が
 * ユーザーの明示的な同意(ADR 0010)を確認した場合にのみ、呼び出し元の判断で
 * ログへ含めてよい。
 */
export class ClaudeJsonParseError extends Error {
  /** 応答テキストの文字数(内容そのものは含まない診断用フィールド) */
  readonly rawLength: number;
  /** 応答に `{`/`[` が一つも見つからなかった(JSON の痕跡が無い = 空応答や定型拒否文の可能性) */
  readonly hasJsonStart: boolean;
  /** 開始括弧に対応する閉じ括弧が見つからなかった(出力が途中で切れている可能性) */
  readonly truncated: boolean;
  /** `JSON.parse` の SyntaxError が報告した文字位置(内容は含まない) */
  readonly errorPosition?: number;
  /** Claude API のレスポンスの stop_reason(呼び出し元が分かれば設定する) */
  stopReason?: string;
  /** 応答の生テキスト(PII を含みうる)。ユーザー同意が無い限りログに出さないこと */
  readonly rawResponse: string;

  constructor(params: {
    rawResponse: string;
    hasJsonStart: boolean;
    truncated: boolean;
    errorPosition?: number;
  }) {
    super('Claude 応答を JSON として解析できませんでした');
    this.name = 'ClaudeJsonParseError';
    this.rawLength = params.rawResponse.length;
    this.hasJsonStart = params.hasJsonStart;
    this.truncated = params.truncated;
    this.errorPosition = params.errorPosition;
    this.rawResponse = params.rawResponse;
  }
}

export function parseClaudeJson(text: string): unknown {
  const stripped = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  const extraction = extractJsonCandidate(stripped);
  try {
    return JSON.parse(extraction.candidate);
  } catch (err) {
    throw new ClaudeJsonParseError({
      rawResponse: text,
      hasJsonStart: extraction.hasJsonStart,
      truncated: extraction.truncated,
      errorPosition: extractErrorPosition(err),
    });
  }
}

interface JsonExtraction {
  candidate: string;
  hasJsonStart: boolean;
  truncated: boolean;
}

/**
 * モデルが指示に反して JSON の前後に説明文を付けた場合に備え、
 * 最初の `{`/`[` から対応する最後の `}`/`]` までを抜き出す。
 */
function extractJsonCandidate(text: string): JsonExtraction {
  const trimmed = text.trim();
  const first = trimmed.search(/[{[]/);
  if (first === -1) {
    return { candidate: trimmed, hasJsonStart: false, truncated: false };
  }
  const closing = trimmed[first] === '{' ? '}' : ']';
  const last = trimmed.lastIndexOf(closing);
  if (last === -1 || last < first) {
    return { candidate: trimmed, hasJsonStart: true, truncated: true };
  }
  return { candidate: trimmed.slice(first, last + 1), hasJsonStart: true, truncated: false };
}

/** Node の SyntaxError メッセージから文字位置だけを抜き出す(内容は含まない) */
function extractErrorPosition(err: unknown): number | undefined {
  if (!(err instanceof Error)) return undefined;
  const match = /position (\d+)/.exec(err.message);
  return match ? Number(match[1]) : undefined;
}
