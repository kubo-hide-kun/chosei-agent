import { describe, expect, it } from 'vitest';
import { ClaudeJsonParseError, parseClaudeJson } from '../src/server/infrastructure/gateways/claudeJson';

describe('parseClaudeJson', () => {
  it('素の JSON を parse できる', () => {
    expect(parseClaudeJson('{"title":"新年会"}')).toEqual({ title: '新年会' });
  });

  it('コードフェンス付きの JSON を parse できる', () => {
    expect(parseClaudeJson('```json\n{"title":"新年会"}\n```')).toEqual({ title: '新年会' });
    expect(parseClaudeJson('```\n[1,2]\n```')).toEqual([1, 2]);
  });

  it('前後に説明文が付いていても JSON 本体を抽出できる', () => {
    expect(parseClaudeJson('以下がJSONです:\n{"title":"新年会"}\nよろしくお願いします')).toEqual({
      title: '新年会',
    });
  });

  it('parse 失敗時のエラーメッセージに入力内容(PII になりうる断片)を含めない', () => {
    const secret = '田中太郎の電話番号は090-0000-0000';
    let caught: unknown;
    try {
      parseClaudeJson(`ごめんなさい、${secret} は JSON にできません`);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ClaudeJsonParseError);
    const message = (caught as Error).message;
    expect(message).not.toContain('田中');
    expect(message).not.toContain('090');
    expect(message).toBe('Claude 応答を JSON として解析できませんでした');
    expect((caught as ClaudeJsonParseError).rawLength).toBeGreaterThan(0);
  });
});
